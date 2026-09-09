import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';
import { broadcast } from '../realtime.js';
import { buildUninformedReportEmail, buildExplanationRejectedEmail, htmlToPlainText } from '../emailTemplate.cjs';

export const uninformedLeavesRouter = Router();

function toClientShape(row) {
  return {
    reportId: row.id,
    email: row.email,
    name: row.name,
    date: row.date,
    reasonHtml: row.reason_html,
    reportedBy: row.reported_by,
    reportedAt: row.reported_at,
    status: row.status,
    explanationHtml: row.explanation_html,
    explainedAt: row.explained_at,
    rejectionNote: row.rejection_note,
    rejectionNoteAt: row.rejection_note_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionHtml: row.resolution_html,
    linkedRequestId: row.linked_request_id
  };
}

// Owners see every report; a developer only ever sees their own - mirrors
// firestore.rules' `resource.data.email == emailLower() || isOwner()`.
uninformedLeavesRouter.get('/', requireAuth, async (req, res) => {
  const query = req.user.isOwner
    ? pool.query('SELECT * FROM uninformed_leaves ORDER BY reported_at DESC LIMIT 500')
    : pool.query('SELECT * FROM uninformed_leaves WHERE email = $1 ORDER BY reported_at DESC LIMIT 500', [
        req.user.email
      ]);
  const { rows } = await query;
  res.json(rows.map(toClientShape));
});

// Manager files a report against a developer - same fields as
// LeaveApiClient.reportUninformedLeave() (Android) / the Report tab's "New report".
uninformedLeavesRouter.post('/', requireAuth, requireOwner, async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(
    `INSERT INTO uninformed_leaves (email, name, date, reason_html, reported_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.email, b.name || '', b.date || null, b.reasonHtml || '', req.user.email]
  );
  const report = rows[0];
  broadcast({ resource: 'uninformedLeaves', id: report.id }, report.email);

  try {
    const { subject, html } = buildUninformedReportEmail(
      { name: report.name, reportedBy: report.reported_by, date: report.date, reasonHtml: report.reason_html },
      report.id
    );
    await sendMail({ to: report.email, subject, html });
  } catch (err) {
    console.error('Failed to send uninformed-leave report email:', err);
  }

  res.status(201).json(toClientShape(report));
});

// Developer explains themselves - reported -> explained. Only the reported
// developer, and only while still "reported" - mirrors firestore.rules'
// first update disjunct.
uninformedLeavesRouter.patch('/:id/explain', requireAuth, async (req, res) => {
  const explanationHtml = String(req.body?.explanationHtml || '');
  const { rows } = await pool.query(
    `UPDATE uninformed_leaves SET status = 'explained', explanation_html = $1, explained_at = now()
     WHERE id = $2 AND email = $3 AND status = 'reported'
     RETURNING *`,
    [explanationHtml, req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'Could not submit - please try again.' });
  broadcast({ resource: 'uninformedLeaves', id: rows[0].id }, 'owners');
  res.json(toClientShape(rows[0]));
});

// Manager accepts - explained -> resolved (or a direct reported -> resolved
// skip, per firestore.rules' fourth disjunct) - converts into an approved
// leaveRequests row, same conversion push-daemon's handleResolvedUninformedLeave
// used to do via the Admin SDK.
uninformedLeavesRouter.patch('/:id/accept', requireAuth, requireOwner, async (req, res) => {
  const resolutionHtml = String(req.body?.resolutionHtml || '');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE uninformed_leaves SET status = 'resolved', resolved_at = now(), resolved_by = $1, resolution_html = $2
       WHERE id = $3 AND status IN ('reported', 'explained')
       RETURNING *`,
      [req.user.email, resolutionHtml, req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This report has already been resolved.' });
    }
    const report = rows[0];

    const leaveResult = await client.query(
      `INSERT INTO leave_requests
         (email, name, type, status, week_label, requested_at, start_date, end_date,
          reason_html, decision_note, resolved_at, resolved_by)
       VALUES ($1,$2,'uninformedAbsence','approved','Uninformed absence',$3,$4,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        report.email,
        report.name,
        report.reported_at,
        report.date,
        report.reason_html,
        htmlToPlainText(resolutionHtml),
        report.resolved_at,
        report.resolved_by
      ]
    );
    const linkedRequestId = leaveResult.rows[0].id;
    await client.query('UPDATE uninformed_leaves SET linked_request_id = $1 WHERE id = $2', [
      linkedRequestId,
      report.id
    ]);
    await client.query('COMMIT');

    broadcast({ resource: 'uninformedLeaves', id: report.id }, report.email);
    broadcast({ resource: 'leaveRequests', id: linkedRequestId }, report.email);
    broadcast({ resource: 'leaveRequests', id: linkedRequestId }, 'owners');
    res.json({ ...toClientShape(report), linkedRequestId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to accept uninformed leave:', err);
    res.status(500).json({ error: 'Could not accept this report - please try again.' });
  } finally {
    client.release();
  }
});

// Manager rejects the developer's explanation - explained -> reported, with
// a note - mirrors firestore.rules' third disjunct exactly.
uninformedLeavesRouter.patch('/:id/reject', requireAuth, requireOwner, async (req, res) => {
  const rejectionNote = String(req.body?.rejectionNote || '');
  const { rows } = await pool.query(
    `UPDATE uninformed_leaves SET status = 'reported', rejection_note = $1, rejection_note_at = now()
     WHERE id = $2 AND status = 'explained'
     RETURNING *`,
    [rejectionNote, req.params.id]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'Could not send this back - please try again.' });
  const report = rows[0];
  broadcast({ resource: 'uninformedLeaves', id: report.id }, report.email);

  try {
    const { subject, html } = buildExplanationRejectedEmail(
      { name: report.name, reportedBy: report.reported_by, date: report.date, rejectionNote: report.rejection_note },
      report.id
    );
    await sendMail({ to: report.email, subject, html });
  } catch (err) {
    console.error('Failed to send explanation-rejected email:', err);
  }

  res.json(toClientShape(report));
});

import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';
import { broadcast } from '../realtime.js';
import { buildDecisionEmail } from '../emailTemplate.cjs';

export const leaveRequestsRouter = Router();

function toClientShape(row) {
  return {
    requestId: row.id,
    requestedAt: row.requested_at,
    startDate: row.start_date,
    endDate: row.end_date,
    customDates: row.custom_dates,
    email: row.email,
    name: row.name,
    weekLabel: row.week_label,
    type: row.type,
    reasonHtml: row.reason_html,
    status: row.status,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    attachments: row.attachments,
    halfDayPeriod: row.half_day_period,
    shortLeaveTime: row.short_leave_time,
    checkOutTime: row.check_out_time,
    checkInTime: row.check_in_time,
    decisionNote: row.decision_note,
    withdrawnAt: row.withdrawn_at,
    dismissed: row.dismissed
  };
}

// Owners see everyone's requests (the Requests/Archived tabs); everyone
// else only ever sees their own - same read scope as firestore.rules'
// `resource.data.email == emailLower() || isOwner()`.
leaveRequestsRouter.get('/', requireAuth, async (req, res) => {
  const query = req.user.isOwner
    ? pool.query('SELECT * FROM leave_requests ORDER BY requested_at DESC LIMIT 500')
    : pool.query('SELECT * FROM leave_requests WHERE email = $1 ORDER BY requested_at DESC LIMIT 500', [
        req.user.email
      ]);
  const { rows } = await query;
  res.json(rows.map(toClientShape));
});

leaveRequestsRouter.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(
    `INSERT INTO leave_requests
       (email, name, week_label, type, start_date, end_date, custom_dates, reason_html,
        half_day_period, short_leave_time, check_out_time, check_in_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      req.user.email,
      b.name || '',
      b.weekLabel || '',
      b.type || 'casualShort',
      b.startDate || null,
      b.endDate || null,
      JSON.stringify(b.customDates || []),
      b.reasonHtml === '<br>' ? '' : b.reasonHtml || '',
      b.halfDayPeriod || '',
      b.shortLeaveTime || '',
      b.checkOutTime || '',
      b.checkInTime || ''
    ]
  );
  broadcast({ resource: 'leaveRequests', id: rows[0].id }, 'owners');
  res.status(201).json(toClientShape(rows[0]));
});

// Only the requester, and only while still pending - mirrors firestore.rules'
// withdraw disjunct exactly.
leaveRequestsRouter.patch('/:id/withdraw', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leave_requests SET status = 'withdrawn', withdrawn_at = now()
     WHERE id = $1 AND email = $2 AND status = 'requested'
     RETURNING *`,
    [req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'This request can no longer be withdrawn.' });
  broadcast({ resource: 'leaveRequests', id: rows[0].id }, 'owners');
  broadcast({ resource: 'leaveRequests', id: rows[0].id }, req.user.email);
  res.json(toClientShape(rows[0]));
});

leaveRequestsRouter.patch('/:id/dismiss', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE leave_requests SET dismissed = true WHERE id = $1 AND email = $2 RETURNING *',
    [req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Request not found.' });
  res.json(toClientShape(rows[0]));
});

leaveRequestsRouter.patch('/:id/attachments', requireAuth, async (req, res) => {
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const { rows } = await pool.query(
    `UPDATE leave_requests SET attachments = $1
     WHERE id = $2 AND email = $3 AND status = 'requested'
     RETURNING *`,
    [JSON.stringify(attachments), req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'Could not attach files to this request.' });
  res.json(toClientShape(rows[0]));
});

// Manager-only: approve or reject a still-pending request. Sends the
// decision email inline (no separate push-daemon anymore - see PROJECT.md)
// and broadcasts to both the requester and every connected manager.
leaveRequestsRouter.patch('/:id/decide', requireAuth, async (req, res) => {
  if (!req.user.isOwner) return res.status(403).json({ error: 'Managers only.' });
  const status = req.body?.decision === 'approved' ? 'approved' : 'rejected';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  const { rows } = await pool.query(
    `UPDATE leave_requests SET status = $1, resolved_at = now(), resolved_by = $2,
       decision_note = COALESCE(NULLIF($3, ''), decision_note)
     WHERE id = $4 AND status = 'requested'
     RETURNING *`,
    [status, req.user.email, note, req.params.id]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'This request has already been resolved.' });
  const updated = rows[0];

  broadcast({ resource: 'leaveRequests', id: updated.id }, 'owners');
  broadcast({ resource: 'leaveRequests', id: updated.id }, updated.email);

  try {
    const { subject, html } = buildDecisionEmail({
      status: updated.status,
      name: updated.name,
      type: updated.type,
      startDate: updated.start_date,
      endDate: updated.end_date,
      weekLabel: updated.week_label,
      reasonHtml: updated.reason_html,
      requestedAt: updated.requested_at,
      resolvedAt: updated.resolved_at,
      resolvedBy: updated.resolved_by,
      decisionNote: updated.decision_note, // plain text - see the schema comment on this column
      attachments: updated.attachments
    });
    await sendMail({ to: updated.email, subject, html });
  } catch (err) {
    console.error('Failed to send decision email:', err);
  }

  res.json(toClientShape(updated));
});

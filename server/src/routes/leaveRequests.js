import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';
import { broadcast } from '../realtime.js';
import {
  buildDecisionEmail,
  buildReplacementRequestEmail,
  buildRescheduleNoticeEmail,
  addWorkingDays
} from '../emailTemplate.cjs';
import { sweepExpiredReplacements } from './leaveReplacements.js';

export const leaveRequestsRouter = Router();

// Short Leave and Out Pass are always a single day (a part of one day, not a
// whole-day absence) - the client already enforces this by disabling the
// Range/Custom date modes for these two types (see
// updateLeaveDateModeAvailability_ in app.js), but that's a UI guard only.
// Enforced again here so a malformed or future client (or a direct API call)
// can never create a multi-day partial-day leave.
const PARTIAL_DAY_TYPES = new Set(['casualShort', 'casualOutPass']);
// How long an emergency leave has to submit its reason/attachment before a
// manager has to chase it manually - there's no scheduled job in this
// codebase to auto-expire it (flagged deliberately, see PROJECT.md).
const EMERGENCY_DOCS_WORKING_DAYS = 3;

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
    dismissed: row.dismissed,
    allowReschedule: row.allow_reschedule,
    rescheduled: row.rescheduled,
    docsDueAt: row.docs_due_at
  };
}

// Owners see everyone's requests (the Requests/Archived tabs, and the
// owner-wide Analytics read) unless ?mine=1 is passed - the web app's My
// Leaves drawer is always the *caller's own* personal history, even for an
// owner viewing their own leave record, so it always passes ?mine=1 to force
// self-scoping regardless of role. Non-owners always get their own requests
// either way - same read scope as firestore.rules'
// `resource.data.email == emailLower() || isOwner()`.
leaveRequestsRouter.get('/', requireAuth, async (req, res) => {
  const mine = req.query.mine === '1' || req.query.mine === 'true';
  const query = (req.user.isOwner && !mine)
    ? pool.query('SELECT * FROM leave_requests ORDER BY requested_at DESC LIMIT 500')
    : pool.query('SELECT * FROM leave_requests WHERE email = $1 ORDER BY requested_at DESC LIMIT 500', [
        req.user.email
      ]);
  const { rows } = await query;
  res.json(rows.map(toClientShape));
});

// Create a request - optionally naming a replacement (leave_replacements
// row, "occupied until free" - see db/schema.sql), and optionally as an
// emergency leave (type='emergency'), which starts in a distinct
// 'pending_documentation' state rather than the normal 'requested' one - see
// PATCH /:id/submit-docs below. Both additions are wrapped in one
// transaction with the leave_requests insert itself: if the named
// replacement is already occupied (the partial unique index on
// leave_replacements rejects it), the whole request fails atomically rather
// than leaving an orphaned leave request with no replacement attached.
leaveRequestsRouter.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const type = b.type || 'casualShort';
  const customDates = Array.isArray(b.customDates) ? b.customDates : [];
  const spansMultipleDays = customDates.length > 1 || (b.startDate && b.endDate && b.startDate !== b.endDate);
  if (PARTIAL_DAY_TYPES.has(type) && spansMultipleDays) {
    return res.status(400).json({ error: 'Short Leave and Out Pass can only be requested for a single day.' });
  }

  const isEmergency = type === 'emergency';
  const today = new Date().toISOString().slice(0, 10);
  const startDate = b.startDate || (isEmergency ? today : null);
  const endDate = b.endDate || startDate;
  const initialStatus = isEmergency ? 'pending_documentation' : 'requested';
  const docsDueAt = isEmergency ? addWorkingDays(new Date(), EMERGENCY_DOCS_WORKING_DAYS) : null;

  const replacementEmail =
    typeof b.replacementEmail === 'string' ? b.replacementEmail.toLowerCase().trim() : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO leave_requests
         (email, name, week_label, type, start_date, end_date, custom_dates, reason_html,
          half_day_period, short_leave_time, check_out_time, check_in_time, status, docs_due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        req.user.email,
        b.name || '',
        b.weekLabel || '',
        type,
        startDate,
        endDate,
        JSON.stringify(customDates),
        b.reasonHtml === '<br>' ? '' : b.reasonHtml || '',
        b.halfDayPeriod || '',
        b.shortLeaveTime || '',
        b.checkOutTime || '',
        b.checkInTime || '',
        initialStatus,
        docsDueAt
      ]
    );
    const created = rows[0];

    let replacementId = null;
    if (replacementEmail) {
      // Lazily frees any of this person's stale 'accepted' rows whose leave
      // is over/withdrawn/rejected but was never explicitly cancelled - see
      // leaveReplacements.js's sweepExpiredReplacements doc comment. Without
      // this, the unique index below could wrongly reject a legitimate
      // reassignment based on a long-finished leave nobody ever cleaned up.
      await sweepExpiredReplacements(client);
      const repResult = await client.query(
        `INSERT INTO leave_replacements (leave_request_id, replacement_email) VALUES ($1, $2) RETURNING id`,
        [created.id, replacementEmail]
      );
      replacementId = repResult.rows[0].id;
    }

    await client.query('COMMIT');
    broadcast({ resource: 'leaveRequests', id: created.id }, 'owners');

    if (replacementId) {
      broadcast({ resource: 'leaveReplacements', id: replacementId }, replacementEmail);
      try {
        const { rows: userRows } = await pool.query('SELECT name FROM users WHERE email = $1', [replacementEmail]);
        const { subject, html } = buildReplacementRequestEmail(
          {
            replacementName: userRows[0]?.name,
            requesterName: created.name,
            type: created.type,
            startDate: created.start_date,
            endDate: created.end_date,
            weekLabel: created.week_label
          },
          replacementId
        );
        await sendMail({ to: replacementEmail, subject, html });
      } catch (err) {
        console.error('Failed to send replacement-request email:', err);
      }
    }

    res.status(201).json({ ...toClientShape(created), replacementId });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That person is already covering someone else right now - pick someone else.' });
    }
    console.error('Failed to create leave request:', err);
    res.status(500).json({ error: 'Could not submit this request - please try again.' });
  } finally {
    client.release();
  }
});

// Only the requester, and only while still pending - mirrors firestore.rules'
// withdraw disjunct exactly.
// Frees up whoever was covering this request immediately, rather than
// waiting for sweepExpiredReplacements to notice on some later, unrelated
// touch - see leaveReplacements.js's doc comment on why both exist.
async function cancelActiveReplacementFor(requestId) {
  await pool.query(
    `UPDATE leave_replacements SET status = 'cancelled'
     WHERE leave_request_id = $1 AND status IN ('pending', 'accepted')`,
    [requestId]
  );
}

leaveRequestsRouter.patch('/:id/withdraw', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leave_requests SET status = 'withdrawn', withdrawn_at = now()
     WHERE id = $1 AND email = $2 AND status = 'requested'
     RETURNING *`,
    [req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'This request can no longer be withdrawn.' });
  await cancelActiveReplacementFor(rows[0].id);
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

// Self only, and only once a manager has both rejected the request AND
// explicitly granted a reschedule on that rejection (see PATCH /:id/decide's
// allowReschedule flag) - lets the requester pick new dates on this exact
// row instead of filing a brand new request. One-shot: `rescheduled` flips
// true so the same grant can't be used twice: to reschedule again, the
// manager has to reject it again and grant a fresh one.
leaveRequestsRouter.patch('/:id/reschedule', requireAuth, async (req, res) => {
  const b = req.body || {};
  if (!b.startDate) return res.status(400).json({ error: 'startDate is required.' });
  const customDates = Array.isArray(b.customDates) ? b.customDates : [];

  const { rows } = await pool.query(
    `UPDATE leave_requests
       SET start_date = $1, end_date = $2, custom_dates = $3, status = 'requested',
           resolved_at = NULL, resolved_by = '', decision_note = '',
           allow_reschedule = FALSE, rescheduled = TRUE
     WHERE id = $4 AND email = $5 AND status = 'rejected' AND allow_reschedule = TRUE AND rescheduled = FALSE
     RETURNING *`,
    [b.startDate, b.endDate || b.startDate, JSON.stringify(customDates), req.params.id, req.user.email]
  );
  if (rows.length === 0) {
    return res.status(409).json({ error: 'This request is not eligible to be rescheduled.' });
  }
  const updated = rows[0];
  broadcast({ resource: 'leaveRequests', id: updated.id }, 'owners');
  broadcast({ resource: 'leaveRequests', id: updated.id }, updated.email);

  try {
    const { subject, html } = buildRescheduleNoticeEmail({
      requesterName: updated.name,
      type: updated.type,
      startDate: updated.start_date,
      endDate: updated.end_date,
      weekLabel: updated.week_label
    });
    const { rows: managers } = await pool.query('SELECT email FROM users WHERE is_owner = true AND active = true');
    await Promise.all(managers.map((m) => sendMail({ to: m.email, subject, html })));
  } catch (err) {
    console.error('Failed to send reschedule-notice email:', err);
  }

  res.json(toClientShape(updated));
});

// Self only - submits the reason/attachment an emergency leave was created
// without, moving it from 'pending_documentation' into the normal
// 'requested' flow (decided exactly like any other request from here on).
leaveRequestsRouter.patch('/:id/submit-docs', requireAuth, async (req, res) => {
  const b = req.body || {};
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  const { rows } = await pool.query(
    `UPDATE leave_requests
       SET reason_html = $1, attachments = $2, status = 'requested', docs_due_at = NULL
     WHERE id = $3 AND email = $4 AND status = 'pending_documentation'
     RETURNING *`,
    [b.reasonHtml || '', JSON.stringify(attachments), req.params.id, req.user.email]
  );
  if (rows.length === 0) {
    return res.status(409).json({ error: 'Documentation can no longer be submitted for this request.' });
  }
  const updated = rows[0];
  broadcast({ resource: 'leaveRequests', id: updated.id }, 'owners');
  broadcast({ resource: 'leaveRequests', id: updated.id }, updated.email);
  res.json(toClientShape(updated));
});

// Manager-only: approve or reject a still-pending request. Sends the
// decision email inline (no separate push-daemon anymore - see PROJECT.md)
// and broadcasts to both the requester and every connected manager.
// `allowReschedule` is only ever meaningful alongside a 'rejected' decision
// (see PATCH /:id/reschedule above) but is accepted/stored regardless -
// harmless on an approval since nothing ever reads it there.
leaveRequestsRouter.patch('/:id/decide', requireAuth, async (req, res) => {
  if (!req.user.isOwner) return res.status(403).json({ error: 'Managers only.' });
  const status = req.body?.decision === 'approved' ? 'approved' : 'rejected';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const allowReschedule = req.body?.allowReschedule === true;

  const { rows } = await pool.query(
    `UPDATE leave_requests SET status = $1, resolved_at = now(), resolved_by = $2,
       decision_note = COALESCE(NULLIF($3, ''), decision_note),
       allow_reschedule = $4
     WHERE id = $5 AND status = 'requested'
     RETURNING *`,
    [status, req.user.email, note, allowReschedule, req.params.id]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'This request has already been resolved.' });
  const updated = rows[0];
  if (updated.status === 'rejected') await cancelActiveReplacementFor(updated.id);

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

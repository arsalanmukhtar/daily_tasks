import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';
import { broadcast } from '../realtime.js';
import { buildReplacementRequestEmail, buildReplacementResolvedEmail } from '../emailTemplate.cjs';

export const leaveReplacementsRouter = Router();
export { sweepExpiredReplacements };

// The partial unique index on (replacement_email) WHERE status IN
// ('pending','accepted') is what actually enforces "occupied until free" -
// but it only knows about `status`, not whether the *parent* leave_requests
// row was since withdrawn/rejected, or whether the leave is simply over.
// withdraw/decide(reject) below proactively cancel the tied replacement row
// the moment that happens (the common case, fixed immediately). This sweep
// covers the one case that can't be fixed proactively - a still-'accepted'
// replacement whose leave's last day has just quietly passed - by lazily
// cancelling any such row right before anything that depends on accurate
// occupancy runs. There's no scheduled job in this codebase to do this
// eagerly (see PROJECT.md's known-gaps notes) - "on next touch" is the
// substitute: correct whenever it matters, at the cost of a stale row
// possibly sitting around unnoticed between touches, which is harmless
// since nothing reads `status` for display purposes without also knowing
// the parent request's own status/dates.
async function sweepExpiredReplacements(queryable) {
  await queryable.query(
    `UPDATE leave_replacements lr SET status = 'cancelled'
     FROM leave_requests r
     WHERE lr.leave_request_id = r.id AND lr.status IN ('pending', 'accepted')
       AND (r.status IN ('withdrawn', 'rejected') OR COALESCE(r.end_date, r.start_date) < CURRENT_DATE)`
  );
}

// Any signed-in user can check this (not just an owner) - the leave-apply
// form's replacement picker needs to grey out occupied candidates for
// *whoever* is applying, not just for a manager. Deliberately minimal: just
// the occupied emails, nothing about who they're covering for or why -
// that detail stays scoped to the people actually involved (see GET '/'
// below).
leaveReplacementsRouter.get('/occupied', requireAuth, async (req, res) => {
  await sweepExpiredReplacements(pool);
  const { rows } = await pool.query(
    `SELECT DISTINCT replacement_email FROM leave_replacements WHERE status IN ('pending', 'accepted')`
  );
  res.json({ occupiedEmails: rows.map((r) => r.replacement_email) });
});

// One denormalized row per leave_replacements row, joined with its parent
// leave_requests row and the replacement's own name - covers every caller
// (the list route, and the accept/reject/reassign routes, which all need
// the same shape to build an email and a client response).
const SELECT_JOINED = `
  SELECT lr.id, lr.leave_request_id, lr.replacement_email, lr.status,
         lr.requested_at, lr.responded_at,
         req.email AS requester_email, req.name AS requester_name, req.type,
         req.start_date, req.end_date, req.custom_dates, req.week_label,
         req.status AS request_status,
         u.name AS replacement_name
  FROM leave_replacements lr
  JOIN leave_requests req ON req.id = lr.leave_request_id
  JOIN users u ON u.email = lr.replacement_email
`;

function toClientShape(row) {
  return {
    id: row.id,
    leaveRequestId: row.leave_request_id,
    replacementEmail: row.replacement_email,
    replacementName: row.replacement_name,
    status: row.status,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    customDates: row.custom_dates,
    weekLabel: row.week_label,
    requestStatus: row.request_status
  };
}

// Owners see every replacement (needed for the mobile reassign UI); a
// normal user sees only rows where they're the one asked to cover, or
// rows tied to their own request (so their own leave card can show its
// replacement's status) - mirrors the same self-or-owner scoping every
// other list route in this file uses.
leaveReplacementsRouter.get('/', requireAuth, async (req, res) => {
  const query = req.user.isOwner
    ? pool.query(`${SELECT_JOINED} ORDER BY lr.requested_at DESC LIMIT 500`)
    : pool.query(
        `${SELECT_JOINED} WHERE lr.replacement_email = $1 OR req.email = $1 ORDER BY lr.requested_at DESC LIMIT 500`,
        [req.user.email]
      );
  const { rows } = await query;
  res.json(rows.map(toClientShape));
});

// The person asked to cover accepts.
leaveReplacementsRouter.patch('/:id/accept', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leave_replacements SET status = 'accepted', responded_at = now()
     WHERE id = $1 AND replacement_email = $2 AND status = 'pending'
     RETURNING id`,
    [req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'This request is no longer pending.' });
  await resolveAndNotify(rows[0].id, 'accepted', req, res);
});

// The person asked to cover declines - frees the slot immediately (see the
// partial unique index: only 'pending'/'accepted' rows count as occupying).
leaveReplacementsRouter.patch('/:id/reject', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leave_replacements SET status = 'rejected', responded_at = now()
     WHERE id = $1 AND replacement_email = $2 AND status = 'pending'
     RETURNING id`,
    [req.params.id, req.user.email]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'This request is no longer pending.' });
  await resolveAndNotify(rows[0].id, 'rejected', req, res);
});

async function resolveAndNotify(id, status, req, res) {
  const { rows } = await pool.query(`${SELECT_JOINED} WHERE lr.id = $1`, [id]);
  const detail = rows[0];
  broadcast({ resource: 'leaveReplacements', id }, detail.requester_email);
  broadcast({ resource: 'leaveReplacements', id }, 'owners');

  try {
    const { subject, html } = buildReplacementResolvedEmail({
      status,
      requesterName: detail.requester_name,
      replacementName: detail.replacement_name,
      type: detail.type,
      startDate: detail.start_date,
      endDate: detail.end_date,
      weekLabel: detail.week_label
    });
    await sendMail({ to: detail.requester_email, subject, html });
  } catch (err) {
    console.error('Failed to send replacement-resolved email:', err);
  }

  res.json(toClientShape(detail));
}

// Manager reassigns who's covering, while the current assignment hasn't
// been accepted yet (pending or already-rejected) - resets it to pending
// under the new person and re-sends the invitation. Refuses once accepted,
// since silently overriding a commitment someone already made would be
// confusing - the manager would need the replacement to first be reset via
// a fresh leave request instead.
leaveReplacementsRouter.patch('/:id', requireAuth, requireOwner, async (req, res) => {
  const newEmail = String(req.body?.replacementEmail || '').toLowerCase().trim();
  if (!newEmail) return res.status(400).json({ error: 'replacementEmail is required.' });

  await sweepExpiredReplacements(pool);
  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE leave_replacements SET replacement_email = $1, status = 'pending', responded_at = NULL
       WHERE id = $2 AND status IN ('pending', 'rejected')
       RETURNING id`,
      [newEmail, req.params.id]
    ));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That person is already covering someone else right now - pick someone else.' });
    }
    throw err;
  }
  if (rows.length === 0) {
    return res.status(409).json({ error: 'Cannot reassign - this replacement has already been accepted.' });
  }

  const { rows: detailRows } = await pool.query(`${SELECT_JOINED} WHERE lr.id = $1`, [rows[0].id]);
  const detail = detailRows[0];
  broadcast({ resource: 'leaveReplacements', id: detail.id }, detail.requester_email);
  broadcast({ resource: 'leaveReplacements', id: detail.id }, newEmail);
  broadcast({ resource: 'leaveReplacements', id: detail.id }, 'owners');

  try {
    const { subject, html } = buildReplacementRequestEmail(
      {
        replacementName: detail.replacement_name,
        requesterName: detail.requester_name,
        type: detail.type,
        startDate: detail.start_date,
        endDate: detail.end_date,
        weekLabel: detail.week_label
      },
      detail.id
    );
    await sendMail({ to: newEmail, subject, html });
  } catch (err) {
    console.error('Failed to send replacement-request email:', err);
  }

  res.json(toClientShape(detail));
});

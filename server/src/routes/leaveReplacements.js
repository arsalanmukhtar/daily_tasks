import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';
import { broadcast } from '../realtime.js';
import { buildReplacementRequestEmail, buildReplacementResolvedEmail } from '../emailTemplate.cjs';

export const leaveReplacementsRouter = Router();
export { sweepExpiredReplacements, expandLeaveDays, isOccupiedForDays };

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

// Occupancy is date-overlap based, not a flat "one assignment at a time"
// lock: someone covering leave A is still available as a replacement for
// leave B as long as A and B's days don't actually overlap. `days` is every
// calendar day ('YYYY-MM-DD') the *candidate* leave being applied for would
// cover - a plain range expands to every day in it, a Custom pick is used
// as-is (mirrors leaveRequests.js's own spansMultipleDays/customDates
// convention and attendance.js's isOnApprovedLeave day-membership check).
function expandLeaveDays(startDate, endDate, customDates) {
  if (Array.isArray(customDates) && customDates.length > 1) return customDates;
  if (!startDate) return [];
  const days = [];
  let cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date((endDate || startDate) + 'T00:00:00Z');
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// True if `email` has an active (pending/accepted) replacement assignment
// whose parent leave request's days overlap any of `days`. Takes a
// queryable (pool or an in-flight transaction client) like
// sweepExpiredReplacements does, so a create-time check can run inside the
// same transaction as the insert it's guarding.
async function isOccupiedForDays(queryable, email, days) {
  if (!days.length) return false;
  const { rows } = await queryable.query(
    `SELECT EXISTS (
       SELECT 1 FROM leave_replacements lr
       JOIN leave_requests req ON req.id = lr.leave_request_id
       WHERE lr.replacement_email = $1 AND lr.status IN ('pending', 'accepted')
         AND EXISTS (
           SELECT 1 FROM unnest($2::date[]) AS cand(day)
           WHERE (jsonb_array_length(req.custom_dates) > 1 AND req.custom_dates @> to_jsonb(cand.day::text))
              OR (jsonb_array_length(req.custom_dates) <= 1 AND cand.day BETWEEN req.start_date AND COALESCE(req.end_date, req.start_date))
         )
     ) AS occupied`,
    [email, days]
  );
  return rows[0].occupied;
}

// Any signed-in user can check this (not just an owner) - the leave-apply
// form's replacement picker needs to grey out occupied candidates for
// *whoever* is applying, not just for a manager. Deliberately minimal: just
// the occupied emails, nothing about who they're covering for or why -
// that detail stays scoped to the people actually involved (see GET '/'
// below). Accepts the candidate leave's own dates (?start=&end= for a plain
// range, or ?dates=<JSON array> for a Custom pick) so occupancy reflects
// actual date overlap rather than a flat "covering someone, anyone" lock -
// with no dates given (nothing picked yet), nobody is reported occupied.
leaveReplacementsRouter.get('/occupied', requireAuth, async (req, res) => {
  await sweepExpiredReplacements(pool);

  let days = [];
  if (typeof req.query.dates === 'string') {
    try {
      const parsed = JSON.parse(req.query.dates);
      if (Array.isArray(parsed)) days = parsed;
    } catch (_e) { /* ignore malformed input, treat as no dates */ }
  } else if (req.query.start) {
    days = expandLeaveDays(String(req.query.start), req.query.end ? String(req.query.end) : null, []);
  }

  if (!days.length) return res.json({ occupiedEmails: [] });

  const { rows } = await pool.query(
    `SELECT DISTINCT lr.replacement_email
     FROM leave_replacements lr
     JOIN leave_requests req ON req.id = lr.leave_request_id
     WHERE lr.status IN ('pending', 'accepted')
       AND EXISTS (
         SELECT 1 FROM unnest($1::date[]) AS cand(day)
         WHERE (jsonb_array_length(req.custom_dates) > 1 AND req.custom_dates @> to_jsonb(cand.day::text))
            OR (jsonb_array_length(req.custom_dates) <= 1 AND cand.day BETWEEN req.start_date AND COALESCE(req.end_date, req.start_date))
       )`,
    [days]
  );
  res.json({ occupiedEmails: rows.map((r) => r.replacement_email) });
});

// One denormalized row per leave_replacements row, joined with its parent
// leave_requests row and the replacement's own name - covers every caller
// (the list route, and the accept/reject/reassign routes, which all need
// the same shape to build an email and a client response).
// start_date/end_date are cast to text in SQL (not left as node-pg's default
// parsed Date) for the same reason leaveRequests.js's dateOnly() exists -
// .toISOString() on a plain-DATE-parsed local-midnight Date shifts it onto
// the previous day's evening on this UTC+5 server. See leaveRequests.js's
// dateOnly() doc comment for the full explanation.
const SELECT_JOINED = `
  SELECT lr.id, lr.leave_request_id, lr.replacement_email, lr.status,
         lr.requested_at, lr.responded_at,
         req.email AS requester_email, req.name AS requester_name, req.type,
         to_char(req.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(req.end_date, 'YYYY-MM-DD') AS end_date,
         req.custom_dates, req.week_label,
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

  const { rows: parentRows } = await pool.query(
    `SELECT to_char(req.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(req.end_date, 'YYYY-MM-DD') AS end_date, req.custom_dates
     FROM leave_replacements lr JOIN leave_requests req ON req.id = lr.leave_request_id
     WHERE lr.id = $1`,
    [req.params.id]
  );
  if (parentRows.length === 0) return res.status(404).json({ error: 'Replacement not found.' });
  const days = expandLeaveDays(parentRows[0].start_date, parentRows[0].end_date, parentRows[0].custom_dates);
  if (await isOccupiedForDays(pool, newEmail, days)) {
    return res.status(409).json({ error: 'That person is already covering someone else over those dates - pick someone else.' });
  }

  const { rows } = await pool.query(
    `UPDATE leave_replacements SET replacement_email = $1, status = 'pending', responded_at = NULL
     WHERE id = $2 AND status IN ('pending', 'rejected')
     RETURNING id`,
    [newEmail, req.params.id]
  );
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

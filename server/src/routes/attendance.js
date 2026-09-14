import crypto from 'node:crypto';

import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { broadcast } from '../realtime.js';

// Manager-only throughout - the developer app never shows attendance (see
// PROJECT.md's Team-feature plan). Deliberately thin: no server-side
// aggregation and no server-side "On Leave" derivation for stats - stats and
// the On-Leave overlay are both computed client-side from this table's raw
// rows plus the already-fetched leave_requests list, matching how the
// Summary tab already does its aggregation entirely client-side. The one
// exception is assertMarkable() below, which *is* a server-side On Leave
// check - not for stats, but to actually refuse a write, which can only ever
// be enforced server-side (a client-only guard is just a suggestion).
export const attendanceRouter = Router();

const VALID_STATUSES = new Set(['present', 'absent', 'late', 'night_duty', 'on_duty']);
// Only 'on_duty' supports the range-mark route today - the other statuses
// are always a same-day correction, not a multi-day plan made in advance.
const RANGE_STATUSES = new Set(['on_duty']);

// Every column except `date`/`arrival_time` is fetched with SELECT/RETURNING
// *; both DATE/TIME columns are always fetched explicitly cast to text (see
// every query below) rather than the raw column. Reason: node-pg's default
// parser for both types builds a JS Date/time at LOCAL midnight/offset, and
// Express then serializes via .toISOString() (always UTC) - on a server
// whose system timezone is ahead of UTC (confirmed: both this VM and local
// dev run Asia/Karachi, UTC+5), that silently shifts the value in the JSON
// response. Formatting to text in SQL sidesteps the driver's parsing
// entirely, so the JSON fields are always the exact stored values,
// independent of the server's timezone.
function toClientShape(row) {
  return {
    id: row.id,
    email: row.email,
    date: row.date,
    status: row.status,
    note: row.note,
    arrivalTime: row.arrival_time,
    batchId: row.batch_id,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
    updatedAt: row.updated_at
  };
}

const SELECT_COLUMNS = `id, email, to_char(date, 'YYYY-MM-DD') AS date, status, note,
  to_char(arrival_time, 'HH24:MI') AS arrival_time, batch_id, marked_by, marked_at, updated_at`;

// True if `dateStr` ('YYYY-MM-DD') falls inside an approved leave_requests
// row for `email` - a plain start/end range, or one of its picked
// custom_dates when more than one was picked. Mirrors the exact same
// precedence the mobile client's resolveAttendanceStatus()/LeaveRequest.
// leaveDays already use (see mobile_app/lib/features/manager/team/
// team_providers.dart and data/models/leave_request.dart) - kept in sync by
// hand since there's no shared code between the two runtimes.
async function isOnApprovedLeave(email, dateStr) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM leave_requests
       WHERE email = $1 AND status = 'approved' AND (
         (jsonb_array_length(custom_dates) > 1 AND custom_dates @> to_jsonb($2::text))
         OR (jsonb_array_length(custom_dates) <= 1 AND $2::date BETWEEN start_date AND COALESCE(end_date, start_date))
       )
     ) AS on_leave`,
    [email, dateStr]
  );
  return rows[0].on_leave;
}

// Every manual mark in [start, end] inclusive, every user - backs both a
// single day's roster (start === end) and a stats period's whole range.
attendanceRouter.get('/', requireAuth, requireOwner, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end are required.' });
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM attendance WHERE date BETWEEN $1 AND $2 ORDER BY date, email`,
    [start, end]
  );
  res.json(rows.map(toClientShape));
});

// Mark one person On Duty across a contiguous range in one action, instead
// of remarking every day individually. Days inside the range that are
// already covered by an approved leave are silently skipped rather than
// failing the whole range - the response reports which dates actually got
// marked vs. skipped so the UI can say e.g. "4 of 5 marked, 1 already on leave".
// Registered before '/:email/:date' below - Express matches route patterns
// in registration order, and '/:email/:date' would otherwise swallow
// '/foo@bar.com/range' as email='foo@bar.com', date='range'.
attendanceRouter.put('/:email/range', requireAuth, requireOwner, async (req, res) => {
  const email = req.params.email.toLowerCase();
  const { startDate, endDate, status } = req.body || {};
  if (!RANGE_STATUSES.has(status)) {
    return res.status(400).json({ error: "status must be 'on_duty' for a range mark." });
  }
  if (!startDate || !endDate || String(startDate) > String(endDate)) {
    return res.status(400).json({ error: 'startDate/endDate are required and startDate must not be after endDate.' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const batchId = crypto.randomUUID();

  const dates = [];
  for (let d = new Date(`${startDate}T00:00:00Z`); d <= new Date(`${endDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const marked = [];
  const skipped = [];
  for (const date of dates) {
    if (await isOnApprovedLeave(email, date)) {
      skipped.push(date);
      continue;
    }
    await pool.query(
      `INSERT INTO attendance (email, date, status, note, batch_id, marked_by, marked_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       ON CONFLICT (email, date) DO UPDATE
         SET status = $3, note = $4, batch_id = $5, marked_by = $6, updated_at = now()`,
      [email, date, status, note, batchId, req.user.email]
    );
    marked.push(date);
  }
  broadcast({ resource: 'attendance', id: email }, 'owners');
  res.json({ marked, skipped, batchId });
});

// Create/overwrite one person's mark for one day.
attendanceRouter.put('/:email/:date', requireAuth, requireOwner, async (req, res) => {
  const { email, date } = req.params;
  const status = req.body?.status;
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be present, absent, late, night_duty, or on_duty.' });
  }
  if (await isOnApprovedLeave(email.toLowerCase(), date)) {
    return res.status(409).json({ error: 'This day is covered by an approved leave and cannot be marked.' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  // Only meaningful for 'late' - stored either way is harmless, but only
  // 'late' ever sends one from the client.
  const arrivalTime = status === 'late' && typeof req.body?.arrivalTime === 'string' ? req.body.arrivalTime : null;

  const { rows } = await pool.query(
    `INSERT INTO attendance (email, date, status, note, arrival_time, marked_by, marked_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())
     ON CONFLICT (email, date) DO UPDATE
       SET status = $3, note = $4, arrival_time = $5, marked_by = $6, updated_at = now()
     RETURNING ${SELECT_COLUMNS}`,
    [email.toLowerCase(), date, status, note, arrivalTime, req.user.email]
  );
  broadcast({ resource: 'attendance', id: rows[0].id }, 'owners');
  res.json(toClientShape(rows[0]));
});

// Undo a mistaken mark - back to "unmarked" (excluded from stats), distinct
// from marking someone Absent.
attendanceRouter.delete('/:email/:date', requireAuth, requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM attendance WHERE email = $1 AND date = $2 RETURNING id',
    [req.params.email.toLowerCase(), req.params.date]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'No mark to remove.' });
  broadcast({ resource: 'attendance', id: rows[0].id }, 'owners');
  res.status(204).end();
});

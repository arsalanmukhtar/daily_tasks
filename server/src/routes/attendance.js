import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { broadcast } from '../realtime.js';

// Manager-only throughout - the developer app never shows attendance (see
// PROJECT.md's Team-feature plan). Deliberately thin: no server-side
// aggregation and no server-side "On Leave" derivation - stats and the
// On-Leave overlay are both computed client-side from this table's raw rows
// plus the already-fetched leave_requests list, matching how the Summary
// tab already does its aggregation entirely client-side.
export const attendanceRouter = Router();

const VALID_STATUSES = new Set(['present', 'absent', 'late']);

// Every column except `date` is fetched with SELECT/RETURNING *; `date` is
// always fetched explicitly as `to_char(date, 'YYYY-MM-DD') AS date` (see
// both queries below) rather than the raw DATE column. Reason: node-pg's
// default DATE parser builds a JS Date at LOCAL midnight, and Express then
// serializes it via .toISOString() (always UTC) - on a server whose system
// timezone is ahead of UTC (confirmed: both this VM and local dev run
// Asia/Karachi, UTC+5), that silently shifts the date back by one calendar
// day in the JSON response (e.g. a stored '2026-09-19' comes back as
// "2026-09-18T19:00:00.000Z"). Formatting to text in SQL sidesteps the
// driver's Date parsing entirely, so the JSON `date` field is always the
// exact stored calendar day, independent of the server's timezone.
function toClientShape(row) {
  return {
    id: row.id,
    email: row.email,
    date: row.date,
    status: row.status,
    note: row.note,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
    updatedAt: row.updated_at
  };
}

// Every manual mark in [start, end] inclusive, every user - backs both a
// single day's roster (start === end) and a stats period's whole range.
attendanceRouter.get('/', requireAuth, requireOwner, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end are required.' });
  const { rows } = await pool.query(
    `SELECT id, email, to_char(date, 'YYYY-MM-DD') AS date, status, note, marked_by, marked_at, updated_at
     FROM attendance WHERE date BETWEEN $1 AND $2 ORDER BY date, email`,
    [start, end]
  );
  res.json(rows.map(toClientShape));
});

// Create/overwrite one person's mark for one day.
attendanceRouter.put('/:email/:date', requireAuth, requireOwner, async (req, res) => {
  const { email, date } = req.params;
  const status = req.body?.status;
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be present, absent, or late.' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  const { rows } = await pool.query(
    `INSERT INTO attendance (email, date, status, note, marked_by, marked_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     ON CONFLICT (email, date) DO UPDATE
       SET status = $3, note = $4, marked_by = $5, updated_at = now()
     RETURNING id, email, to_char(date, 'YYYY-MM-DD') AS date, status, note, marked_by, marked_at, updated_at`,
    [email.toLowerCase(), date, status, note, req.user.email]
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

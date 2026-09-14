import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';
import { broadcast } from '../realtime.js';
import { buildLateNoticeEmail } from '../emailTemplate.cjs';

// Self-service: a developer tells their manager(s) ahead of time (or
// same-day) that they'll be late. Purely informational today - no
// accept/reject workflow like uninformed_leaves, just submitted/acknowledged
// (see PROJECT.md's Team-feature-v2 plan).
export const lateArrivalNoticesRouter = Router();

function toClientShape(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    date: row.date,
    expectedArrivalTime: row.expected_arrival_time,
    reasonHtml: row.reason_html,
    attachments: row.attachments,
    status: row.status,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by
  };
}

const SELECT_COLUMNS = `id, email, name, to_char(date, 'YYYY-MM-DD') AS date,
  to_char(expected_arrival_time, 'HH24:MI') AS expected_arrival_time, reason_html, attachments,
  status, created_at, acknowledged_at, acknowledged_by`;

// Manager-only list (there's no per-developer "my late notices" view today -
// this is purely something you file and your manager sees, matching the
// "should go into the db" scope of the original request).
lateArrivalNoticesRouter.get('/', requireAuth, requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM late_arrival_notices ORDER BY created_at DESC LIMIT 500`
  );
  res.json(rows.map(toClientShape));
});

// Self only - a developer files their own notice.
lateArrivalNoticesRouter.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  const { rows } = await pool.query(
    `INSERT INTO late_arrival_notices (email, name, date, expected_arrival_time, reason_html, attachments)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${SELECT_COLUMNS}`,
    [req.user.email, b.name || '', b.date || null, b.expectedArrivalTime || null, b.reasonHtml || '', JSON.stringify(attachments)]
  );
  const notice = rows[0];
  broadcast({ resource: 'lateArrivalNotices', id: notice.id }, 'owners');

  try {
    const { subject, html } = buildLateNoticeEmail({
      name: notice.name,
      date: notice.date,
      expectedArrivalTime: notice.expected_arrival_time,
      reasonHtml: notice.reason_html
    });
    const { rows: managers } = await pool.query('SELECT email FROM users WHERE is_owner = true AND active = true');
    await Promise.all(managers.map((m) => sendMail({ to: m.email, subject, html })));
  } catch (err) {
    console.error('Failed to send late-notice email:', err);
  }

  res.status(201).json(toClientShape(notice));
});

lateArrivalNoticesRouter.patch('/:id/acknowledge', requireAuth, requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE late_arrival_notices SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $1
     WHERE id = $2
     RETURNING ${SELECT_COLUMNS}`,
    [req.user.email, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Notice not found.' });
  broadcast({ resource: 'lateArrivalNotices', id: rows[0].id }, 'owners');
  res.json(toClientShape(rows[0]));
});

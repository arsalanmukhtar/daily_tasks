import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const submissionsRouter = Router();

function toClientShape(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    designation: row.designation,
    reportedTo: row.reported_to,
    domain: row.domain,
    weekLabel: row.week_label,
    weekRange: row.week_range,
    taskFormat: row.task_format,
    taskRows: row.task_rows,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

submissionsRouter.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM submissions WHERE email = $1', [req.user.email]);
  res.json(rows.map(toClientShape));
});

// Owner-only, whole-roster read for the web app's Export/Analytics features
// (app.js's fetchAnalyticsData_()/export flow used to do this as an
// unrestricted Firestore collection read) - optional filters narrow it to
// one week (export) or one developer+week (analytics drill-down), same
// queries those features already run today, just server-side now.
submissionsRouter.get('/', requireAuth, async (req, res) => {
  if (!req.user.isOwner) return res.status(403).json({ error: 'Managers only.' });
  const conditions = [];
  const params = [];
  if (req.query.weekLabel) {
    params.push(req.query.weekLabel);
    conditions.push(`week_label = $${params.length}`);
  }
  if (req.query.email) {
    params.push(String(req.query.email).toLowerCase());
    conditions.push(`email = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM submissions ${where} ORDER BY week_label DESC, name`, params);
  res.json(rows.map(toClientShape));
});

// Upsert by (email, week_label) - same "resubmitting overwrites" behavior
// as app.js's submitWeek_() (app.js:3472-3490).
submissionsRouter.put('/:weekLabel', requireAuth, async (req, res) => {
  const weekLabel = req.params.weekLabel;
  const { name, designation, reportedTo, domain, weekRange, taskRows } = req.body || {};
  if (!Array.isArray(taskRows) || taskRows.length === 0) {
    return res.status(400).json({ error: 'Please enter your tasks.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO submissions (email, name, designation, reported_to, domain, week_label, week_range, task_rows, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (email, week_label) DO UPDATE SET
       name = EXCLUDED.name, designation = EXCLUDED.designation, reported_to = EXCLUDED.reported_to,
       domain = EXCLUDED.domain, week_range = EXCLUDED.week_range, task_rows = EXCLUDED.task_rows,
       updated_at = now()
     RETURNING *`,
    [req.user.email, name || '', designation || '', reportedTo || '', domain || '', weekLabel, weekRange || '', JSON.stringify(taskRows)]
  );
  res.json(toClientShape(rows[0]));
});

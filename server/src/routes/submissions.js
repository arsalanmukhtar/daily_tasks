import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const submissionsRouter = Router();

submissionsRouter.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM submissions WHERE email = $1', [req.user.email]);
  res.json(rows);
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
  res.json(rows[0]);
});

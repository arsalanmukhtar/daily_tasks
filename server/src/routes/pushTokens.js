import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const pushTokensRouter = Router();

pushTokensRouter.post('/', requireAuth, async (req, res) => {
  const token = String(req.body?.token || '');
  const platform = req.body?.platform === 'ios' ? 'ios' : 'android';
  if (!token) return res.status(400).json({ error: 'Missing token.' });
  await pool.query(
    `INSERT INTO push_tokens (token, email, platform) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET email = EXCLUDED.email, platform = EXCLUDED.platform, registered_at = now()`,
    [token, req.user.email, platform]
  );
  res.status(201).json({ ok: true });
});

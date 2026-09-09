import { Router } from 'express';

import { requestMagicLink, verifyMagicLink, requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const authRouter = Router();

authRouter.post('/request-link', async (req, res) => {
  const email = String(req.body?.email || '');
  if (!email.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address.' });
  try {
    await requestMagicLink(email);
  } catch (err) {
    console.error('request-link failed:', err);
    // Still respond success-shaped - see requestMagicLink's doc comment on
    // why this endpoint never reveals whether an email is on the allowlist.
  }
  res.json({ ok: true });
});

authRouter.post('/verify', async (req, res) => {
  const token = String(req.body?.token || '');
  try {
    const result = await verifyMagicLink(token);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// The signed-in user's own profile - same shape as an allowlist entry.
authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT email, name, designation, reported_to, domain, is_owner, active FROM users WHERE email = $1',
    [req.user.email]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  res.json(rows[0]);
});

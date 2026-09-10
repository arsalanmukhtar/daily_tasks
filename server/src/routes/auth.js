import { Router } from 'express';

import { loginWithPassword, requestPasswordReset, resetPassword, requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const authRouter = Router();

// No self-service registration by design: accounts are provisioned by a
// manager (directly in the app, once that admin flow exists) and every
// account's very first password is set the same way as any later reset -
// via /forgot-password + /reset-password. This also closes what would
// otherwise be a real gap: without a manager-driven creation step, a bare
// "register with just email+password" endpoint would let anyone who knows
// an allowlisted address claim its password before the real owner ever
// signs in, with no proof of inbox access at all.
authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email || '');
  const password = String(req.body?.password || '');
  if (!email.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address.' });
  try {
    const result = await loginWithPassword(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '');
  const platform = req.body?.platform === 'mobile' ? 'mobile' : 'web';
  if (!email.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address.' });
  try {
    await requestPasswordReset(email, platform);
  } catch (err) {
    console.error('forgot-password failed:', err);
    // Still respond success-shaped - see requestPasswordReset's doc comment
    // on why this endpoint never reveals whether an email is on the allowlist.
  }
  res.json({ ok: true });
});

authRouter.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  try {
    const result = await resetPassword(token, password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The signed-in user's own profile - same shape as an allowlist entry. Also
// doubles as the web app's once-per-page-load "session restore" check, so it
// must re-verify `active` itself rather than trusting the JWT's stale claim -
// requireAuth only checks the signature, not current DB state, and a JWT
// lives for 30 days after a user could have been deactivated.
authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT email, name, designation, reported_to, domain, is_owner, active FROM users WHERE email = $1',
    [req.user.email]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  if (!user.active) return res.status(401).json({ error: 'This account is no longer authorized.' });
  res.json({
    email: user.email,
    name: user.name,
    designation: user.designation,
    reportedTo: user.reported_to,
    domain: user.domain,
    isOwner: user.is_owner,
    active: user.active
  });
});

import { Router } from 'express';

import { requestMagicLink, verifyMagicLink, requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const authRouter = Router();

authRouter.post('/request-link', async (req, res) => {
  const email = String(req.body?.email || '');
  const platform = req.body?.platform === 'mobile' ? 'mobile' : 'web';
  if (!email.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address.' });
  try {
    await requestMagicLink(email, platform);
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

// The signed-in user's own profile - same shape as an allowlist entry. Also
// doubles as the web app's once-per-page-load "session restore" check
// (replacing onAuthStateChanged -> getDoc(allowlist/email)), so it must
// re-verify `active` itself rather than trusting the JWT's stale claim -
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

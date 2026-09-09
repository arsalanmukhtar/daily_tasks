import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { pool } from './db.js';
import { sendMail } from './mailer.js';

const MAGIC_LINK_TTL_MINUTES = 15;
const JWT_TTL = '30d';

// Where the web app's login page lives, once deployed on the VM - the
// magic-link email points here with the token in the query string; the app
// picks it up client-side and calls /api/auth/verify itself (see the web
// cutover note in PROJECT.md) rather than the email link hitting the API
// directly, so it works the same way for the Flutter app's deep link too.
const APP_URL = process.env.APP_URL || 'http://localhost:8090';

/**
 * Starts a sign-in: if `email` is an active user, emails them a one-time
 * link. Always resolves the same way regardless of whether the email is
 * known, so this endpoint can't be used to enumerate the allowlist.
 *
 * `platform` picks the link format: the web app parses `#verify=<token>`
 * itself client-side, but a phone has no browser tab to parse a hash - so
 * `platform: 'mobile'` instead emails a `techewapp://verify?token=...`
 * custom-scheme link the Flutter app registers and catches directly. A
 * custom scheme (not Android App Links / iOS Universal Links) is used
 * deliberately: those require a real HTTPS domain with a signed
 * verification file, which this bare-IP, no-TLS deployment doesn't have.
 */
export async function requestMagicLink(email, platform = 'web') {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query('SELECT email FROM users WHERE email = $1 AND active = true', [normalized]);
  if (rows.length === 0) return; // silently no-op - see doc comment above

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000);
  await pool.query('INSERT INTO magic_links (email, token, expires_at) VALUES ($1, $2, $3)', [
    normalized,
    token,
    expiresAt
  ]);

  const link =
    platform === 'mobile'
      ? `techewapp://verify?token=${encodeURIComponent(token)}`
      : `${APP_URL}/#verify=${encodeURIComponent(token)}`;
  await sendMail({
    to: normalized,
    subject: 'Your Tech EW sign-in link',
    html: `
      <p>Click below to sign in to Tech EW. This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.</p>
      <p><a href="${link}">Sign in to Tech EW</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `
  });
}

/**
 * Redeems a magic-link token: valid, unexpired, and not already used.
 * Returns a signed JWT on success, throws on any failure - callers should
 * treat every failure the same way (a generic "invalid or expired link"),
 * not distinguish which check failed, so a token can't be probed.
 */
export async function verifyMagicLink(token) {
  const { rows } = await pool.query(
    `UPDATE magic_links SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING email`,
    [token]
  );
  if (rows.length === 0) throw new Error('This sign-in link is invalid or has expired.');

  const email = rows[0].email;
  const userResult = await pool.query('SELECT email, is_owner, active FROM users WHERE email = $1', [email]);
  const user = userResult.rows[0];
  if (!user?.active) throw new Error('This account is no longer authorized.');

  const jwtToken = jwt.sign({ email: user.email, isOwner: user.is_owner }, process.env.JWT_SECRET, {
    expiresIn: JWT_TTL
  });
  return { token: jwtToken, email: user.email, isOwner: user.is_owner };
}

/** Express middleware: rejects unless `Authorization: Bearer <jwt>` is valid. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { email: payload.email, isOwner: payload.isOwner === true };
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired - please sign in again.' });
  }
}

/** Express middleware: requireAuth must run first. */
export function requireOwner(req, res, next) {
  if (!req.user?.isOwner) return res.status(403).json({ error: 'Managers only.' });
  next();
}

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { pool } from './db.js';
import { sendMail } from './mailer.js';

const RESET_TOKEN_TTL_MINUTES = 15;
const JWT_TTL = '30d';
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

// Where the web app lives, once deployed on the VM - the password-reset
// email points here with the token in the URL fragment; the app picks it up
// client-side and calls /api/auth/reset-password itself, the same pattern
// the Flutter app's deep link uses.
const APP_URL = process.env.APP_URL || 'http://localhost:8090';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertPasswordStrength(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function issueJwt(user) {
  const token = jwt.sign({ email: user.email, isOwner: user.is_owner }, process.env.JWT_SECRET, {
    expiresIn: JWT_TTL
  });
  return { token, email: user.email, isOwner: user.is_owner };
}

/** Verifies email + password, returning a signed JWT on success. */
export async function loginWithPassword(email, password) {
  const normalized = normalizeEmail(email);
  const { rows } = await pool.query(
    'SELECT email, is_owner, active, password_hash FROM users WHERE email = $1',
    [normalized]
  );
  const user = rows[0];
  if (!user || !user.active) {
    throw new Error("This email isn't registered for Daily Tasks. Contact your manager to be added.");
  }
  if (!user.password_hash) {
    throw new Error('No password set for this account yet. Use "Forgot password?" to set one.');
  }
  const matches = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!matches) throw new Error('Incorrect email or password.');
  return issueJwt(user);
}

/**
 * Starts a password reset: if `email` is an active user, emails them a
 * one-time link. Always resolves the same way regardless of whether the
 * email is known, so this endpoint can't be used to enumerate the
 * allowlist. Doubles as "set your initial password" for an account that has
 * never registered one.
 *
 * `platform` picks the link format: the web app parses `#reset=<token>`
 * itself client-side, but a phone has no browser tab to parse a hash - so
 * `platform: 'mobile'` instead emails a `techewapp://reset?token=...`
 * custom-scheme link the Flutter app registers and catches directly. A
 * custom scheme (not Android App Links / iOS Universal Links) is used
 * deliberately: those require a real HTTPS domain with a signed
 * verification file, which this bare-IP, no-TLS deployment doesn't have.
 */
export async function requestPasswordReset(email, platform = 'web') {
  const normalized = normalizeEmail(email);
  const { rows } = await pool.query('SELECT email FROM users WHERE email = $1 AND active = true', [normalized]);
  if (rows.length === 0) return; // silently no-op - see doc comment above

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
  await pool.query('INSERT INTO magic_links (email, token, expires_at) VALUES ($1, $2, $3)', [
    normalized,
    token,
    expiresAt
  ]);

  const link =
    platform === 'mobile'
      ? `techewapp://reset?token=${encodeURIComponent(token)}`
      : `${APP_URL}/#reset=${encodeURIComponent(token)}`;
  await sendMail({
    to: normalized,
    subject: 'Reset your Daily Tasks password',
    html: `
      <p>Click below to set a new password for Daily Tasks. This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.</p>
      <p><a href="${link}">Set a new password</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `
  });
}

/**
 * Redeems a password-reset token - valid, unexpired, and not already used -
 * and sets it as the account's new password. Returns a signed JWT on
 * success (resetting logs you straight in), throws on any failure -
 * callers should treat every failure the same way (a generic "invalid or
 * expired link"), not distinguish which check failed, so a token can't be
 * probed.
 */
export async function resetPassword(token, newPassword) {
  assertPasswordStrength(newPassword);
  const { rows } = await pool.query(
    `UPDATE magic_links SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING email`,
    [token]
  );
  if (rows.length === 0) throw new Error('This reset link is invalid or has expired.');

  const email = rows[0].email;
  const userResult = await pool.query('SELECT email, is_owner, active FROM users WHERE email = $1', [email]);
  const user = userResult.rows[0];
  if (!user?.active) throw new Error('This account is no longer authorized.');

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, user.email]);
  return issueJwt(user);
}

/**
 * Changes an already-signed-in user's password - always requires the
 * current password (unlike a reset token), so a session left open on a
 * shared machine can't be used to silently lock the real owner out.
 */
export async function changePassword(email, currentPassword, newPassword) {
  const normalized = normalizeEmail(email);
  assertPasswordStrength(newPassword);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [normalized]);
  const user = rows[0];
  if (!user?.password_hash) throw new Error('No password set for this account yet.');
  const matches = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!matches) throw new Error('Current password is incorrect.');
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, normalized]);
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

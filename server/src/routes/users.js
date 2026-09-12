import { Router } from 'express';

import { requireAuth, requireOwner } from '../auth.js';
import { pool } from '../db.js';
import { broadcast } from '../realtime.js';

export const usersRouter = Router();

function toClientShape(row) {
  return {
    email: row.email,
    name: row.name,
    designation: row.designation,
    reportedTo: row.reported_to,
    domain: row.domain,
    isOwner: row.is_owner,
    active: row.active
  };
}

// The full roster - used for developer-picker dropdowns/filters on the
// manager screens (mirrors AllowlistRepository.listAll() in the Kotlin
// app), and now also the Team tab's directory list. Readable by any
// signed-in user, same as allowlist reads today.
usersRouter.get('/', requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT email, name, designation, reported_to, domain, is_owner, active FROM users ORDER BY name'
  );
  res.json(rows.map(toClientShape));
});

// Manager-only: a single profile - mainly useful for deep-linking straight
// into the Team tab's detail sheet without needing the whole roster fetched
// first.
usersRouter.get('/:email', requireAuth, requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT email, name, designation, reported_to, domain, is_owner, active FROM users WHERE email = $1',
    [req.params.email.toLowerCase()]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'No such user.' });
  res.json(toClientShape(rows[0]));
});

// Manager-only: edit a profile - including the manager's own. email/
// password_hash are never editable here (email is the login identity;
// password changes go through the reset-password flow). Only the fields
// actually present in the body are updated, so a partial edit (e.g. just
// `designation`) never clobbers the rest.
const EDITABLE_FIELDS = {
  name: 'name',
  designation: 'designation',
  reportedTo: 'reported_to',
  domain: 'domain',
  isOwner: 'is_owner',
  active: 'active'
};

usersRouter.patch('/:email', requireAuth, requireOwner, async (req, res) => {
  const email = req.params.email.toLowerCase();
  const isSelf = email === req.user.email;

  // Can't lock yourself out of the Team tab (or manager access entirely)
  // by mis-editing your own row.
  if (isSelf && req.body?.active === false) {
    return res.status(400).json({ error: "You can't deactivate your own account." });
  }
  if (isSelf && req.body?.isOwner === false) {
    return res.status(400).json({ error: "You can't remove your own manager access." });
  }

  const sets = [];
  const values = [];
  for (const [jsonKey, column] of Object.entries(EDITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, jsonKey)) {
      values.push(req.body[jsonKey]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No editable fields were given.' });

  values.push(email);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE email = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'No such user.' });

  broadcast({ resource: 'users', id: rows[0].email }, 'owners');
  res.json(toClientShape(rows[0]));
});

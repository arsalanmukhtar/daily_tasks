import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const usersRouter = Router();

// The full roster - used for developer-picker dropdowns/filters on the
// manager screens (mirrors AllowlistRepository.listAll() in the Kotlin
// app). Readable by any signed-in user, same as allowlist reads today.
usersRouter.get('/', requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT email, name, designation, reported_to, domain, is_owner, active FROM users ORDER BY name'
  );
  res.json(
    rows.map((u) => ({
      email: u.email,
      name: u.name,
      designation: u.designation,
      reportedTo: u.reported_to,
      domain: u.domain,
      isOwner: u.is_owner,
      active: u.active
    }))
  );
});

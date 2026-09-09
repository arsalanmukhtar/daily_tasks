import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'daily_tasks',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

pool.on('error', (err) => {
  // A background client emitted an error (e.g. connection dropped) - log
  // and let the pool recover on the next query rather than crashing the
  // whole process over one lost connection.
  console.error('Unexpected Postgres pool error:', err);
});

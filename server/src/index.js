import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import { attachRealtime } from './realtime.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { submissionsRouter } from './routes/submissions.js';
import { leaveRequestsRouter } from './routes/leaveRequests.js';
import { uninformedLeavesRouter } from './routes/uninformedLeaves.js';
import { pushTokensRouter } from './routes/pushTokens.js';
import { attachmentsRouter } from './routes/attachments.js';

for (const required of ['JWT_SECRET', 'DB_USER', 'DB_PASSWORD']) {
  if (!process.env[required]) {
    console.error(`Missing required env var ${required} - see server/README.md.`);
    process.exit(1);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/files', express.static(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/leave-requests', leaveRequestsRouter);
app.use('/api/uninformed-leaves', uninformedLeavesRouter);
app.use('/api/push-tokens', pushTokensRouter);
app.use('/api/attachments', attachmentsRouter);

// The web app's static files (index.html/app.js/styles.css) live one level
// up from server/ in the same repo checkout - served directly here rather
// than via nginx so the page, the API, and the WebSocket are all one
// plain-HTTP origin (see PROJECT.md's web cutover notes on why: the bare-IP,
// no-TLS deployment would otherwise trip the browser's mixed-content block
// if the page were served from anywhere else).
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
app.use(express.static(REPO_ROOT));

// Last resort - anything that reaches here is either a 404 or an unhandled
// error from a route above; never leak a stack trace to the client.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const server = http.createServer(app);
attachRealtime(server);

const port = Number(process.env.PORT || 8090);
server.listen(port, () => console.log(`daily_tasks API listening on :${port}`));

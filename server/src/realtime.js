import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

import { pool } from './db.js';

// ws -> { email, isOwner } for every currently-connected, authenticated
// client - lets broadcast() decide who should hear about a given change,
// same idea as Firestore security rules deciding who a listener applies to,
// just expressed as "who do we push this message to" instead.
const clients = new Map();

export function attachRealtime(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query('SELECT is_owner, active FROM users WHERE email = $1', [payload.email]);
      if (!rows[0]?.active) {
        ws.close(4001, 'unauthorized');
        return;
      }
      clients.set(ws, { email: payload.email, isOwner: rows[0].is_owner });
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
    } catch {
      ws.close(4001, 'unauthorized');
    }
  });

  return wss;
}

/**
 * Notifies connected clients that something changed, so every open screen
 * can refetch - the WebSocket message only ever carries a pointer
 * (`{resource, id}`), never the data itself, so there's no risk of leaking
 * something a given client shouldn't see over the wire.
 *
 * @param {{resource: string, id: string}} event
 * @param {'all'|'owners'|string} scope - 'all', 'owners' (managers only), or
 *   a specific email (the one developer this change belongs to).
 */
export function broadcast(event, scope = 'all') {
  const message = JSON.stringify(event);
  for (const [ws, meta] of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const shouldSend = scope === 'all' || (scope === 'owners' && meta.isOwner) || scope === meta.email;
    if (shouldSend) ws.send(message);
  }
}

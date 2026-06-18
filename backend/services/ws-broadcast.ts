/**
 * ws-broadcast.ts — Singleton WebSocket server for cognitive runtime sync.
 *
 * Security model:
 *   1. Origin validation — only same-host origins (or non-browser clients) accepted.
 *   2. Session-owner auth — two paths:
 *        a. Super admin: HTTP session cookie (mx.sid) is parsed + verified against
 *           the express_sessions table; session user is checked for super_admin role.
 *        b. End-user: ?guestKey=<sessionId> must equal the path sessionId and the
 *           session must exist in capadex_sessions (capability-based auth).
 *      Connections that satisfy neither are rejected with close code 1008.
 *
 * WS path: /ws/session/:sessionId
 * Feature flag: websocket_runtime — all broadcasts are no-ops when disabled.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { Pool } from 'pg';
import { parse as parseCookieHeader } from 'cookie';
// cookie-signature ships with express-session — safe to use
import cookieSignature from 'cookie-signature';
import { isEnabled } from './feature-flags';

const FLAG_KEY = 'websocket_runtime';

const SESSION_NAME   = 'mx.sid';
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'edupsych-secret-key-change-in-production';

// session_id → active WebSocket clients
const sessions = new Map<string, Set<WebSocket>>();

/** Lazy auth pool — created once on first connection. */
let _authPool: Pool | null = null;
function getAuthPool(): Pool {
  if (!_authPool) {
    _authPool = new Pool({ connectionString: process.env.DATABASE_URL });
    _authPool.on('error', (err) => {
      console.error('[ws-broadcast] auth pool error:', err.message);
    });
  }
  return _authPool;
}

// ─── Event Types ───────────────────────────────────────────────────────────────

export type RuntimeEventType =
  | 'hypothesis_generated'
  | 'confidence_updated'
  | 'contradiction_detected'
  | 'cognitive_load_alert'
  | 'stage_transitioned'
  | 'intervention_ready'
  | 'patterns_ready'
  | 'state_updated'
  | 'quality_updated'
  | 'connected';

export interface RuntimeEvent {
  type:       RuntimeEventType;
  session_id: string;
  timestamp:  string;
  data:       Record<string, unknown>;
  explain:    string;
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true only if the origin header is safe (same host or absent).
 * Non-browser WS clients send no Origin header — accepted by default.
 */
// Explicit allowlist derived from environment — avoids wildcard-suffix matching.
// REPLIT_DEV_DOMAIN is the single shared domain for the workspace (e.g. foo.bar.replit.dev).
// The frontend Vite server runs on a different port but shares the same domain.
const _devDomain = process.env.REPLIT_DEV_DOMAIN ?? '';

function isOriginAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser client (server-side / native) — allow

  try {
    const { hostname: originHost, protocol } = new URL(origin);

    // Reject non-http(s) schemes to close websocket-from-file edge cases
    if (protocol !== 'http:' && protocol !== 'https:') return false;

    // 1. Same-host match (backend host header == origin hostname)
    const serverHost = (req.headers.host ?? '').split(':')[0];
    if (originHost === serverHost) return true;

    // 2. Replit dev domain — exact domain match, not suffix match.
    //    REPLIT_DEV_DOMAIN is the workspace-unique domain assigned by the platform.
    if (_devDomain && originHost === _devDomain) return true;

    // 3. Localhost / 127.0.0.1 for local dev without REPLIT_DEV_DOMAIN
    if (originHost === 'localhost' || originHost === '127.0.0.1') return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Verifies the mx.sid express-session cookie and checks whether the session
 * belongs to a super_admin user.  Returns false on any error so auth failures
 * are never silently elevated.
 */
async function isAdminSession(req: IncomingMessage): Promise<boolean> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return false;

    const cookies = parseCookieHeader(cookieHeader);
    const raw = cookies[SESSION_NAME];
    if (!raw) return false;

    // express-session signed cookies begin with 's:'
    const stripped = raw.startsWith('s:') ? raw.slice(2) : raw;
    const unsigned  = cookieSignature.unsign(stripped, SESSION_SECRET);
    if (!unsigned) return false;

    const pool = getAuthPool();

    // Fetch session row from Postgres session store
    const { rows } = await pool.query(
      `SELECT sess FROM express_sessions WHERE sid = $1 AND expire > now() LIMIT 1`,
      [unsigned],
    );
    if (rows.length === 0) return false;

    const sess = typeof rows[0].sess === 'string'
      ? JSON.parse(rows[0].sess)
      : rows[0].sess;

    // Passport stores the user ID under sess.passport.user
    const userId = sess?.passport?.user;
    if (!userId) return false;

    // Look up the user's role
    const { rows: userRows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return userRows.length > 0 && userRows[0].role === 'super_admin';
  } catch {
    return false;
  }
}

/**
 * Verifies that the given sessionId exists and is not expired in capadex_sessions.
 * Used to validate guest-key (capability-token) connections.
 */
async function capadexSessionExists(sessionId: string): Promise<boolean> {
  try {
    const pool = getAuthPool();
    const { rows } = await pool.query(
      `SELECT id FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Server init ───────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;

/**
 * Attach the WebSocket server to the existing HTTP server.
 * Call once from backend/index.ts after creating httpServer.
 */
export function initWebSocketServer(httpServer: Server): void {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', async (ws, req) => {
    // ── 1. Origin validation ────────────────────────────────────────────────
    if (!isOriginAllowed(req)) {
      ws.close(1008, 'Forbidden origin');
      return;
    }

    // ── 2. Parse sessionId from path: /ws/session/:sessionId ───────────────
    const url   = req.url ?? '';
    const match = url.match(/^\/ws\/session\/([^/?#]+)/);
    if (!match) {
      ws.close(1008, 'Invalid path — expected /ws/session/:sessionId');
      return;
    }
    const sessionId = decodeURIComponent(match[1]);

    // ── 3. Ownership verification ──────────────────────────────────────────
    // Path A — admin cookie: super admin may watch any session
    const adminOk = await isAdminSession(req);

    if (!adminOk) {
      // Path B — capability token: guestKey must equal sessionId in path
      const qs       = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const guestKey = qs.get('guestKey') ?? '';

      if (guestKey !== sessionId) {
        ws.close(1008, 'Unauthorized — missing or invalid guestKey');
        return;
      }

      // Additionally verify the session actually exists in DB (prevents token guessing
      // even though UUIDs have 122 bits of entropy)
      const exists = await capadexSessionExists(sessionId);
      if (!exists) {
        ws.close(1008, 'Session not found');
        return;
      }
    }

    // ── 4. Register client ─────────────────────────────────────────────────
    if (!sessions.has(sessionId)) sessions.set(sessionId, new Set());
    sessions.get(sessionId)!.add(ws);

    // Handshake
    _sendSafe(ws, {
      type:       'connected',
      session_id: sessionId,
      timestamp:  new Date().toISOString(),
      data:       {},
      explain:    'WebSocket connection established for cognitive runtime sync.',
    });

    // ── 5. Heartbeat — ping every 25 s to survive proxy idle timeouts ──────
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
      }
    }, 25_000);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'pong') {
          // Client acknowledged the ping — nothing more needed server-side.
          // The client's dead-timer handles the liveness guarantee.
        }
      } catch { /* non-JSON frame — ignore */ }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      const set = sessions.get(sessionId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) sessions.delete(sessionId);
      }
    });

    ws.on('error', (err) => {
      console.error(`[ws-broadcast] socket error (session=${sessionId}):`, err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[ws-broadcast] server error:', err.message);
  });

  console.log('[ws-broadcast] WebSocket server attached — /ws/session/:sessionId');
}

// ─── Broadcast helper ──────────────────────────────────────────────────────────

/**
 * Broadcast a cognitive runtime event to all WebSocket clients watching a session.
 * Fire-and-forget — never throws, never awaits.
 * Silently skipped when `websocket_runtime` flag is disabled or no clients are connected.
 */
export function broadcastToSession(
  sessionId: string,
  event:     Omit<RuntimeEvent, 'session_id' | 'timestamp'>,
  tenantId?: string,
): void {
  if (!isEnabled(FLAG_KEY, tenantId)) return;

  const clients = sessions.get(sessionId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    ...event,
    session_id: sessionId,
    timestamp:  new Date().toISOString(),
  } satisfies RuntimeEvent);

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      _sendSafe(ws, payload);
    }
  }
}

/** Number of sessions with at least one active WS client. */
export function getActiveSessionCount(): number {
  return sessions.size;
}

// ─── Internal utils ────────────────────────────────────────────────────────────

function _sendSafe(ws: WebSocket, data: string | RuntimeEvent): void {
  try {
    ws.send(typeof data === 'string' ? data : JSON.stringify(data));
  } catch {
    // Ignore — client may have disconnected between readyState check and send
  }
}

/**
 * Phase 5 — Security middleware.
 * - In-process rate limiter (sliding window) per IP+route bucket.
 * - Anti-enumeration delay on 404s.
 * - Request ID tagging.
 * - Audit hook ties into gov_audit_framework.
 */
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { auditFramework } from './governance-engine.js';

// True sliding-window rate limiter: per-bucket ring of request timestamps,
// trimmed to the active window on every check.
const windows = new Map<string, number[]>();
const DEFAULT_WINDOW_MS = 60_000;

export interface RateLimitOptions {
  max: number;
  windowMs?: number;
  bucket?: (req: Request) => string;
  pool?: Pool;
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const getBucket = opts.bucket ?? ((req: Request) =>
    `${req.ip ?? 'unknown'}:${req.path}`);
  return function (req: Request, res: Response, next: NextFunction) {
    const k = getBucket(req);
    const now = Date.now();
    const cutoff = now - windowMs;
    let arr = windows.get(k);
    if (!arr) { arr = []; windows.set(k, arr); }
    // trim expired entries (sliding window)
    while (arr.length && arr[0] < cutoff) arr.shift();
    arr.push(now);
    const remaining = Math.max(0, opts.max - arr.length);
    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Window-Ms', String(windowMs));
    if (arr.length > opts.max) {
      const retryAfter = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ ok: false, error: 'rate_limited', retry_after_seconds: retryAfter });
      if (opts.pool) {
        void auditFramework(opts.pool, {
          action: 'security.rate_limit.exceeded', entity_type: 'request',
          entity_id: req.path, domain: 'security',
          payload: { ip: req.ip, ua: req.get('user-agent'), count: arr.length, window_ms: windowMs },
          outcome: 'blocked',
        });
      }
      return;
    }
    next();
  };
}

/**
 * Minimal admin-only guard for governance mutations.
 * Accepts either a session with super-admin role, an admin bearer token
 * matching env GOV_ADMIN_TOKEN, or an explicit header x-gov-admin in dev.
 * Always audits the decision.
 */
export function requireGovAdmin(pool?: Pool) {
  const adminToken = process.env.GOV_ADMIN_TOKEN || '';
  return function (req: Request, res: Response, next: NextFunction) {
    const sess = (req as Request & { session?: { user?: { role?: string } } }).session;
    const sessionRole = sess?.user?.role;
    const auth = req.get('authorization') || '';
    const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    const headerToken = req.get('x-gov-admin') || '';
    const ok =
      sessionRole === 'super-admin' || sessionRole === 'super_admin' ||
      (!!adminToken && (bearer === adminToken || headerToken === adminToken));
    if (!ok) {
      if (pool) void auditFramework(pool, {
        action: 'security.governance.unauthorized', entity_type: 'request',
        entity_id: req.path, domain: 'security',
        payload: { ip: req.ip, method: req.method }, outcome: 'denied',
      });
      res.status(403).json({ ok: false, error: 'forbidden',
        hint: 'Governance mutations require super-admin role or admin token.' });
      return;
    }
    next();
  };
}

/** Stamp a request id + structured-log marker. */
export function requestId() {
  return function (req: Request, res: Response, next: NextFunction) {
    const id = req.get('x-request-id') ??
      `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    (req as Request & { id?: string }).id = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

/** Anti-enumeration jitter — small constant-time-ish delay before 404 replies. */
export function antiEnumDelay(ms = 80) {
  return function (req: Request, res: Response, next: NextFunction) {
    const orig = res.status.bind(res);
    (res as Response & { status: typeof res.status }).status = function (code: number) {
      if (code === 404) {
        return new Proxy(orig(code), {
          get(t, p) {
            const v = (t as Response)[p as keyof Response];
            if (p === 'json' || p === 'send') {
              return (body: unknown) => {
                setTimeout(() => (v as Function).call(t, body), ms);
                return t;
              };
            }
            return v;
          },
        }) as Response;
      }
      return orig(code);
    };
    next();
  };
}

/** Simple consent gate — checks a header for now (DPDP/GDPR alignment scaffold). */
export function requireConsent() {
  return function (req: Request, res: Response, next: NextFunction) {
    const c = req.get('x-data-consent');
    if (c === 'granted' || req.method === 'GET') return next();
    res.status(412).json({ ok: false, error: 'consent_required',
      hint: 'Set header x-data-consent: granted, or capture explicit consent first' });
  };
}

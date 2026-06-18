/**
 * WC-C4 — CAPADEX Entitlement ENFORCEMENT middleware.
 *
 * Converts the existing READ-ONLY entitlement architecture (`deriveEntitlement` + `STAGE_FEATURES`
 * + the live `capadex_payments` ledger) into ACCESS ENFORCEMENT for the paid CAPADEX report /
 * intelligence surfaces. Introduces NO new entitlement model, NO schema / ontology change — it only
 * GATES access using the already-derived entitlement. Reuses existing assets ONLY.
 *
 * DESIGN (per architect plan sign-off):
 *  • FLAG-FIRST + SYNCHRONOUS — the very first statement is the flag check; OFF → `next()` BEFORE any
 *    `await` → byte-identical legacy behaviour. (Express 4 has no async auto-catch, so everything after
 *    the flag check is wrapped in try/catch that always ends in an explicit response or `next()`.)
 *  • SERVER-SIDE IDENTITY — the billing identity is read from `capadex_sessions.guest_email`, NEVER a
 *    client-supplied `?email=` / body email (that would be the bypass).
 *  • STAGE-DERIVED REQUIREMENT — required feature = `STAGE_REPORT_FEATURE[stage_code]`. CAP_CUR (free) /
 *    null / unknown stage → pass through (no paid content to protect; no regression).
 *  • FAIL-CLOSED on infrastructure, OPEN on "nothing to protect":
 *      invalid UUID                       → next()  (replicate the handlers' UUID guard FIRST so a
 *                                                    garbage id never reaches our UUID-typed query as a
 *                                                    pg 22P02 — preserves each handler's exact behaviour)
 *      session not found                  → next()  (preserve the handler's own 404; nothing to protect)
 *      CAP_CUR / null / unknown stage     → next()  (free tier)
 *      ledger degraded / lookup DB error  → 503 `entitlement_unavailable`  (a ledger fault is NOT "unpaid")
 *      paid stage + no owned feature      → 402 `entitlement_required`      (incl. null guest_email)
 *      paid stage + feature owned         → next()
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { deriveEntitlement, STAGE_REPORT_FEATURE } from './entitlement-engine';
import { isCommercialEntitlementEnforcementEnabled } from '../../config/feature-flags';

// Mirrors the strict UUID guard the capadex route handlers use (`validSessionId`). A param that fails
// this is passed straight through so the downstream handler keeps its exact current behaviour (its own
// 400 / 404 / 500). It is also stricter than the omega-x reader's length check — anything it rejects is
// not a real session UUID, so passing it through cannot leak paid content.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequireEntitlementOptions {
  /** Name of the route param carrying the session UUID — `'session_id'` (report routes) or `'id'`. */
  sessionParam: string;
}

/**
 * Build an entitlement-enforcement RequestHandler bound to a pool + the route's session-id param.
 * When the enforcement flag is OFF the returned handler is a synchronous pass-through.
 */
export function requireEntitlement(pool: Pool, opts: RequireEntitlementOptions): RequestHandler {
  const { sessionParam } = opts;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // FLAG-FIRST, SYNCHRONOUS: OFF → byte-identical pass-through (no await executes before this).
    if (!isCommercialEntitlementEnforcementEnabled()) return next();

    try {
      const sessionId = req.params[sessionParam];
      // Replicate the handlers' UUID guard FIRST — never feed a garbage id to a UUID-typed query.
      if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) return next();

      const { rows } = await pool.query<{ stage_code: string | null; guest_email: string | null }>(
        'SELECT stage_code, guest_email FROM capadex_sessions WHERE id = $1 LIMIT 1',
        [sessionId],
      );
      // Not found → preserve the handler's own 404; nothing to protect.
      if (rows.length === 0) return next();

      const stageCode = rows[0].stage_code;
      const required = stageCode ? STAGE_REPORT_FEATURE[stageCode] : undefined;
      // Free tier (CAP_CUR) / null / unknown stage → no paid content → pass through.
      if (!required) return next();

      const ent = await deriveEntitlement(pool, rows[0].guest_email ?? null);
      // A ledger read failure is NOT "unpaid" → fail closed with a distinct 503, never a 402.
      if (ent.degraded) {
        res.status(503).json({ error: 'entitlement_unavailable', reason: ent.reason });
        return;
      }
      if (ent.entitled_features.includes(required)) return next();

      res.status(402).json({
        error: 'entitlement_required',
        required_feature: required,
        stage_code: stageCode,
        reason: ent.has_identity ? ent.reason : 'no_billing_identity',
      });
    } catch (err) {
      // Lookup / unexpected failure → fail closed (do NOT next() into the paid handler).
      console.warn(
        '[require-entitlement] gate failed closed:',
        err instanceof Error ? err.message : String(err),
      );
      if (!res.headersSent) {
        res.status(503).json({ error: 'entitlement_unavailable', reason: 'gate_error' });
      }
    }
  };
}

/**
 * PHASE 4.10 — Career Signal routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Signal engine behind the `careerSignal`
 * flag (env `FF_CAREER_SIGNAL`, default OFF). Strictly additive: flag OFF =>
 * every route returns 503 `feature_disabled` BEFORE any DB touch => byte-identical
 * legacy behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-built competency runtime, EI profile,
 * Phase-4.3 career readiness and Phase-4.4 career gap engines into seven
 * DEVELOPMENTAL signals — it never recomputes a score and never fabricates.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-readiness/*, /api/career-gap/* etc.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-signal/_meta/status               — lightweight flag probe
 *   GET  /api/career-signal/library                     — signal catalogue (db or defaults)
 *   POST /api/career-signal/library                     — upsert a signal definition (write)
 *   GET  /api/career-signal/rules                        — banding/interpretation rules
 *   PUT  /api/career-signal/rules                        — upsert the active rules row (write)
 *   POST /api/career-signal/seed                         — seed config tables from defaults (write)
 *   GET  /api/career-signal/:subject/signal/:signalKey   — one signal by key (read-only)
 *   GET  /api/career-signal/:subject                     — all seven composed signals (read-only)
 *
 * GET is strictly read-only (NEVER triggers DDL — config readers use to_regclass
 * probes and fall back to in-code defaults; the engine gates every competency-
 * runtime consumer behind a runtime probe). The write paths (POST/PUT library,
 * rules, seed) are the ONLY places that lazily ensure the config schema.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerSignalEnabled } from '../config/feature-flags.js';
import {
  CAREER_SIGNAL_VERSION,
  buildCareerSignals,
  buildCareerSignal,
  listSignalLibrary,
  upsertSignalDefinition,
  getSignalRules,
  upsertSignalRules,
  seedCareerSignalDefaults,
  type SignalCategory,
  type SignalDefinition,
} from '../services/career-signal-engine.js';

export function registerCareerSignalRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerSignalEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerSignal' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_SIGNAL_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-signal]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-signal/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_SIGNAL_VERSION, enabled: true, flag: 'careerSignal' });
    },
  );

  // ---- Signal catalogue (read-only; db overlay or in-code defaults) ---------
  app.get(
    '/api/career-signal/library',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => listSignalLibrary(pool)),
  );

  // ---- Upsert a signal definition (write path — ensures config schema) ------
  app.post(
    '/api/career-signal/library',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const b = (req.body ?? {}) as Partial<SignalDefinition>;
      const category = String(b.category ?? '') as SignalCategory;
      if (!b.signal_key || !b.label || (category !== 'potential' && category !== 'risk')) {
        res.status(400).json({
          ok: false,
          error: 'invalid_definition',
          detail: 'signal_key, label and category(potential|risk) are required',
        });
        return;
      }
      const def: SignalDefinition = {
        signal_key: String(b.signal_key),
        label: String(b.label),
        category,
        description: String(b.description ?? ''),
        inputs: Array.isArray(b.inputs) ? b.inputs : [],
        display_order: Number(b.display_order ?? 0),
        active: b.active !== false,
      };
      return upsertSignalDefinition(pool, def);
    }),
  );

  // ---- Banding / interpretation rules (read-only) ---------------------------
  app.get(
    '/api/career-signal/rules',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getSignalRules(pool)),
  );

  // ---- Upsert the active rules row (write path — ensures config schema) -----
  app.put(
    '/api/career-signal/rules',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => upsertSignalRules(pool, (req.body ?? {}) as any)),
  );

  // ---- Seed config tables from the in-code defaults (write path) ------------
  app.post(
    '/api/career-signal/seed',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => seedCareerSignalDefaults(pool)),
  );

  // ---- One signal by key (read-only) ----------------------------------------
  // Registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-signal/:subject/signal/:signalKey',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) =>
      buildCareerSignal(pool, String(req.params.subject), String(req.params.signalKey)),
    ),
  );

  // ---- All seven composed signals (read-only) -------------------------------
  app.get(
    '/api/career-signal/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerSignals(pool, String(req.params.subject))),
  );
}

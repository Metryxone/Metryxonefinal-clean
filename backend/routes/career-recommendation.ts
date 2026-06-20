/**
 * PHASE 4.7 — Career Recommendation routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Recommendation engine behind the
 * `careerRecommendation` flag (env `FF_CAREER_RECOMMENDATION`, default OFF).
 * Strictly additive: flag OFF => every route returns 503 `feature_disabled`
 * BEFORE any DB touch => byte-identical legacy behaviour (no schema, no read,
 * no write).
 *
 * The engine COMPOSES the already-built Career Development chain (Phase 4.6 → 4.5
 * → 4.4 → 4.3) together with the live `cg_roles` catalog into SIX recommendation
 * kinds (role / career / industry / function / future_role / alternative_career),
 * driven by a config-as-data library + rules (inline defaults, admin-editable
 * tables). It never recomputes a score and never fabricates a role/industry/
 * function/number. Naming is collision-free: the spec's `career_recommendation_
 * engine` / `recommendation_library` / `recommendation_rules` names already belong
 * to the CGI + Phase-3.9 subsystems, so this deliverable is namespaced into the
 * career-* chain (see the engine header).
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-development/* and /api/career-gap/*. The
 * admin library/rules CRUD is likewise super-admin gated.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET    /api/career-recommendation/_meta/status            — flag probe
 *   GET    /api/career-recommendation/admin/config            — library + rules (effective)
 *   POST   /api/career-recommendation/admin/seed              — seed defaults into tables
 *   PUT    /api/career-recommendation/admin/library           — upsert a library entry
 *   DELETE /api/career-recommendation/admin/library/:recKey   — delete a library entry
 *   PUT    /api/career-recommendation/admin/rules             — upsert a rule
 *   DELETE /api/career-recommendation/admin/rules/:ruleKey    — delete a rule
 *   GET    /api/career-recommendation/:subject/history        — append-only history (read-only)
 *   GET    /api/career-recommendation/:subject/:type          — one recommendation group
 *   POST   /api/career-recommendation/:subject/snapshot       — capture an append-only snapshot
 *   GET    /api/career-recommendation/:subject                — composed recommendation envelope
 *
 * GET is strictly read-only (NEVER triggers DDL — the composition delegates the
 * competency-runtime DDL-gating to the development chain; config/history use
 * to_regclass probes). The ONLY write paths are the explicit POST snapshot, the
 * admin seed, and the admin library/rules CRUD — all behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerRecommendationEnabled } from '../config/feature-flags.js';
import {
  CAREER_RECOMMENDATION_VERSION,
  RECOMMENDATION_TYPE_ORDER,
  type RecommendationType,
  buildCareerRecommendations,
  loadLibrary,
  loadRules,
  seedCareerRecommendationConfig,
  upsertLibraryEntry,
  deleteLibraryEntry,
  upsertRuleEntry,
  deleteRuleEntry,
  persistCareerRecommendationSnapshot,
  listCareerRecommendationHistory,
} from '../services/career-recommendation-aggregator.js';

const VALID_TYPES = new Set<string>(RECOMMENDATION_TYPE_ORDER);

export function registerCareerRecommendationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerRecommendationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerRecommendation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_RECOMMENDATION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-recommendation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  app.get(
    '/api/career-recommendation/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_RECOMMENDATION_VERSION, enabled: true, flag: 'careerRecommendation' });
    },
  );

  // ---- Admin: effective config (library + rules; db override or defaults) ----
  app.get(
    '/api/career-recommendation/admin/config',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => {
      const [lib, rules] = await Promise.all([loadLibrary(pool), loadRules(pool)]);
      return { library: lib, rules };
    }),
  );

  // ---- Admin: seed defaults into the editable tables (write) ----------------
  app.post(
    '/api/career-recommendation/admin/seed',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => seedCareerRecommendationConfig(pool)),
  );

  // ---- Admin: upsert / delete a library entry (write) -----------------------
  app.put(
    '/api/career-recommendation/admin/library',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const b = req.body ?? {};
      if (!b.rec_key || !b.rec_type || !VALID_TYPES.has(String(b.rec_type))) {
        throw new Error('rec_key and a valid rec_type are required');
      }
      return upsertLibraryEntry(pool, {
        rec_key: String(b.rec_key),
        rec_type: String(b.rec_type) as RecommendationType,
        title: String(b.title ?? ''),
        description: String(b.description ?? ''),
        action: String(b.action ?? ''),
        is_active: b.is_active !== false,
        sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0,
      });
    }),
  );

  app.delete(
    '/api/career-recommendation/admin/library/:recKey',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => ({ deleted: await deleteLibraryEntry(pool, String(req.params.recKey)) })),
  );

  // ---- Admin: upsert / delete a rule (write) --------------------------------
  app.put(
    '/api/career-recommendation/admin/rules',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const b = req.body ?? {};
      if (!b.rule_key || !b.rec_type || !VALID_TYPES.has(String(b.rec_type)) || !b.signal) {
        throw new Error('rule_key, a valid rec_type and signal are required');
      }
      return upsertRuleEntry(pool, {
        rule_key: String(b.rule_key),
        rec_type: String(b.rec_type) as RecommendationType,
        signal: b.signal,
        params: typeof b.params === 'object' && b.params ? b.params : {},
        base_priority: b.base_priority === 'high' || b.base_priority === 'low' ? b.base_priority : 'medium',
        is_active: b.is_active !== false,
      });
    }),
  );

  app.delete(
    '/api/career-recommendation/admin/rules/:ruleKey',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => ({ deleted: await deleteRuleEntry(pool, String(req.params.ruleKey)) })),
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) ----------
  // Registered BEFORE the `/:subject` param routes (literal-before-param).
  app.get(
    '/api/career-recommendation/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listCareerRecommendationHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- One recommendation group by type (read-only) -------------------------
  // `:type` is constrained to the six known types so it can't shadow other routes.
  app.get(
    '/api/career-recommendation/:subject/:type',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const type = String(req.params.type);
      if (!VALID_TYPES.has(type)) {
        res.status(400).json({ ok: false, error: 'invalid_type', valid: [...VALID_TYPES] });
        return undefined;
      }
      const env = await buildCareerRecommendations(pool, String(req.params.subject));
      return env.groups.find((g) => g.rec_type === (type as RecommendationType)) ?? null;
    }),
  );

  // ---- Capture an append-only snapshot (the ONLY subject write path) --------
  app.post(
    '/api/career-recommendation/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerRecommendations(pool, String(req.params.subject));
      const row = await persistCareerRecommendationSnapshot(pool, env);
      return { snapshot: row, envelope: env };
    }),
  );

  // ---- Composed career-recommendation envelope (read-only) ------------------
  app.get(
    '/api/career-recommendation/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerRecommendations(pool, String(req.params.subject))),
  );
}

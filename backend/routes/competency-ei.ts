/**
 * Phase 3 — Competency Employability Intelligence (CEI) routes.
 *
 * Exposes the competency-anchored Employability Intelligence engine behind the
 * `competencyEi` flag (env `FF_COMPETENCY_EI`, default OFF). Strictly additive:
 * flag OFF => every route returns 503 `feature_disabled` BEFORE any DB touch =>
 * byte-identical legacy behaviour (no schema, no read, no write).
 *
 * COMPOSES the Phase 2 competency-runtime outputs (never recomputes scores,
 * never fabricates). DISTINCT from the legacy profile-based /api/ei/* engine.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/competency-runtime/*.
 *
 * Routes (all requireAuth + requireSuperAdmin):
 *   GET  /api/competency-ei/intelligence/:subject          — compute (read-only)
 *   POST /api/competency-ei/intelligence/:subject/snapshot — compute + append snapshot
 *   GET  /api/competency-ei/intelligence/:subject/history  — snapshot history
 *   GET  /api/competency-ei/validation/:subject            — chain validation
 *   GET  /api/competency-ei/admin/overview                 — platform overview
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCompetencyEiEnabled } from '../config/feature-flags.js';
import {
  COMPETENCY_EI_VERSION,
  computeEmployabilityIntelligence,
  persistEmployabilitySnapshot,
  listSnapshotHistory,
  computeEiValidation,
  computeAdminOverview,
} from '../services/competency-employability-engine.js';
import {
  ensureEiDimensionSchema,
  seedEiDimensionDefaults,
  getDimensionConfig,
  computeEmployabilityDimensions,
} from '../services/competency-ei-dimensions.js';
import {
  computeEmployabilityScore,
  persistScoringRun,
  listScoringRuns,
  getScoringRun,
  ensureScoringRunSchema,
} from '../services/employability-scoring-engine.js';
import { buildEiProfile } from '../services/ei-profile-engine.js';
import {
  persistEiProfile,
  listEiProfileHistory,
  getEiProfileSnapshot,
} from '../services/ei-profile-history.js';
import { computeRoleReadinessV2 } from '../services/role-readiness-v2.js';
import {
  computeIndustryReadiness,
  listIndustryReadiness,
} from '../services/industry-readiness-engine.js';
import {
  computeFunctionReadiness,
  listFunctionReadiness,
} from '../services/function-readiness-engine.js';
import {
  computeEmployabilitySignals,
  getSignalCatalog,
} from '../services/employability-signal-engine.js';
import {
  computeEmployabilityRecommendations,
  getRecommendationCatalog,
} from '../services/ei-recommendation-engine.js';
import {
  buildEiDashboard,
  buildCandidateEiDashboard,
  buildAdminEiDashboard,
} from '../services/ei-dashboard-engine.js';
import { buildEiHistory } from '../services/ei-history-engine.js';
import { buildProgression } from '../services/progression-engine.js';
import { computeEiTrend } from '../services/trend-engine.js';

export function registerCompetencyEiRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCompetencyEiEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'competencyEi' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: COMPETENCY_EI_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[competency-ei]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Compute (read-only) ---------------------------------------------------
  // Literal sub-paths (/snapshot, /history) are registered as distinct routes;
  // both carry an extra segment so they never collide with the param route.
  app.get(
    '/api/competency-ei/intelligence/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEmployabilityIntelligence(pool, String(req.params.subject))),
  );

  // ---- Compute + append snapshot (explicit write path) -----------------------
  app.post(
    '/api/competency-ei/intelligence/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => persistEmployabilitySnapshot(pool, String(req.params.subject))),
  );

  // ---- Snapshot history ------------------------------------------------------
  app.get(
    '/api/competency-ei/intelligence/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listSnapshotHistory(pool, String(req.params.subject))),
  );

  // ---- Chain validation ------------------------------------------------------
  app.get(
    '/api/competency-ei/validation/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEiValidation(pool, String(req.params.subject))),
  );

  // ---- Admin overview --------------------------------------------------------
  app.get(
    '/api/competency-ei/admin/overview',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => computeAdminOverview(pool)),
  );

  // ==========================================================================
  // Phase 3.2 — Competency → EI dimension mapping
  // ==========================================================================

  // ---- Per-subject employability dimensions (read-only; degrades when unprovisioned)
  app.get(
    '/api/competency-ei/dimensions/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEmployabilityDimensions(pool, String(req.params.subject))),
  );

  // ---- Dimension mapping config (admin read; to_regclass probe + degrade) ----
  app.get(
    '/api/competency-ei/admin/dimensions',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getDimensionConfig(pool)),
  );

  // ---- Seed / re-sync the default mapping (explicit write path; idempotent) --
  app.post(
    '/api/competency-ei/dimensions/sync',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => {
      await ensureEiDimensionSchema(pool);
      return seedEiDimensionDefaults(pool);
    }),
  );

  // ==========================================================================
  // Phase 3.3 — Employability Scoring Engine
  //   chain: competency_scores → dimension_scores → ei_score (traced + audited)
  // ==========================================================================

  // ---- Compute the full scoring chain (read-only; never writes) -------------
  app.get(
    '/api/competency-ei/scoring/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEmployabilityScore(pool, String(req.params.subject))),
  );

  // ---- Compute + persist an audit run (explicit write path) ----------------
  app.post(
    '/api/competency-ei/scoring/:subject/run',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => persistScoringRun(pool, String(req.params.subject))),
  );

  // ---- Scoring run history for a subject (read-only; probe + degrade) -------
  app.get(
    '/api/competency-ei/scoring/:subject/runs',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listScoringRuns(pool, String(req.params.subject))),
  );

  // ---- Fetch one persisted run with full trace (admin; read-only) ----------
  app.get(
    '/api/competency-ei/admin/scoring/runs/:runId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => getScoringRun(pool, String(req.params.runId))),
  );

  // ==========================================================================
  // Phase 3.4 — EI Profile Engine (candidate Employability Profile + history)
  //   COMPOSES the 3.3 scoring artifact: Overall EI · Dimension Scores ·
  //   Strength Areas · Development Areas · Critical Risks · Growth Potential.
  // ==========================================================================

  // ---- Build the candidate profile (read-only; never writes) ---------------
  app.get(
    '/api/competency-ei/profile/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildEiProfile(pool, String(req.params.subject))),
  );

  // ---- Build + append a profile snapshot (explicit write path) -------------
  app.post(
    '/api/competency-ei/profile/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const profile = await buildEiProfile(pool, String(req.params.subject));
      const capturedBy = (req as any).user?.email ?? null;
      const snapshot = await persistEiProfile(pool, profile, capturedBy);
      return { snapshot, profile };
    }),
  );

  // ---- Profile snapshot history for a subject (read-only; probe + degrade) --
  app.get(
    '/api/competency-ei/profile/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listEiProfileHistory(pool, String(req.params.subject))),
  );

  // ---- Fetch one persisted profile snapshot (admin; read-only) -------------
  app.get(
    '/api/competency-ei/admin/profile/snapshots/:snapshotId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => getEiProfileSnapshot(pool, Number(req.params.snapshotId))),
  );

  // ==========================================================================
  // Phase 3.5 — Role Readiness Engine V2 (extends Phase 2 role readiness)
  //   Role Readiness · Role Match · Role Gap · Role Risk · Role Potential.
  // ==========================================================================

  // ---- Composed V2 role readiness view for a subject (read-only) ------------
  app.get(
    '/api/competency-ei/role-readiness-v2/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeRoleReadinessV2(pool, String(req.params.subject))),
  );

  // ==========================================================================
  // Phase 3.6 — Industry Readiness Engine (extends readiness to the industry)
  //   Industry Readiness · Industry Fit · Industry Gap. Requirements are
  //   derived by aggregating role competency profiles across the industry's
  //   roles (curated taxonomy); honest 'unavailable' when an industry is unseeded.
  // ==========================================================================

  // ---- Single industry for a subject (read-only). Two-segment param sits
  //      below the one-segment :subject route; no literal collision.
  app.get(
    '/api/competency-ei/industry-readiness/:subject/:industry',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeIndustryReadiness(pool, String(req.params.subject), String(req.params.industry))),
  );

  // ---- All seeded industries for a subject (read-only) ----------------------
  app.get(
    '/api/competency-ei/industry-readiness/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listIndustryReadiness(pool, String(req.params.subject))),
  );

  // ==========================================================================
  // Phase 3.7 — Function Readiness Engine (extends readiness to the function)
  //   Function Readiness · Function Fit · Function Gap. Requirements are
  //   derived by aggregating role competency profiles across the function's
  //   roles (curated taxonomy); honest 'unavailable' when a function is unseeded.
  // ==========================================================================

  // ---- Single function for a subject (read-only). Two-segment param sits
  //      below the one-segment :subject route; no literal collision.
  app.get(
    '/api/competency-ei/function-readiness/:subject/:function',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeFunctionReadiness(pool, String(req.params.subject), String(req.params.function))),
  );

  // ---- All seeded functions for a subject (read-only) -----------------------
  app.get(
    '/api/competency-ei/function-readiness/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listFunctionReadiness(pool, String(req.params.subject))),
  );

  // ==========================================================================
  // Phase 3.8 — Employability Signal Engine
  //   Composes measured competency strengths/weaknesses against a curated signal
  //   library (Leadership Potential, Innovation Potential, Career Risk Signal).
  //   Read-only; never fires on partial evidence (honest 'indeterminate').
  // ==========================================================================

  // ---- Curated catalog (read-only, no DB touch). Literal sub-path; sits below
  //      no param route at this base so there is no collision.
  app.get(
    '/api/competency-ei/signal-catalog',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getSignalCatalog()),
  );

  // ---- Employability signals for a subject (read-only) ----------------------
  app.get(
    '/api/competency-ei/employability-signals/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEmployabilitySignals(pool, String(req.params.subject))),
  );

  // ==========================================================================
  // Phase 3.9 — Employability Recommendation Engine
  //   Composes measured capability gaps/strengths + Phase-3.8 signals against a
  //   curated recommendation library (development / certification / project /
  //   experience / behavioral). Read-only; never recommends on unmeasured
  //   evidence (honest 'withheld'); measured-but-not-triggered -> 'not_applicable'.
  // ==========================================================================

  // ---- Curated catalog (read-only, no DB touch). Literal sub-path; no collision.
  app.get(
    '/api/competency-ei/recommendation-catalog',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getRecommendationCatalog()),
  );

  // ---- Recommendations for a subject (read-only) ----------------------------
  app.get(
    '/api/competency-ei/recommendations/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEmployabilityRecommendations(pool, String(req.params.subject))),
  );

  // ---------------------------------------------------------------------------
  // Phase 3.10 — EI Dashboard (consolidated; composes every prior engine once
  //   plus Trend Analysis, projected into candidate / admin audience views).
  //   Deliverables: ei_dashboard · candidate_ei_dashboard · admin_ei_dashboard.
  // ---------------------------------------------------------------------------

  // ---- Neutral / full composed dashboard for a subject (read-only) ----------
  app.get(
    '/api/competency-ei/dashboard/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildEiDashboard(pool, String(req.params.subject))),
  );

  // ---- Candidate-facing dashboard projection (read-only) --------------------
  app.get(
    '/api/competency-ei/candidate-dashboard/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCandidateEiDashboard(pool, String(req.params.subject))),
  );

  // ---- Admin dashboard projection (full + honesty diagnostics; read-only) ---
  app.get(
    '/api/competency-ei/admin-dashboard/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildAdminEiDashboard(pool, String(req.params.subject))),
  );

  // ---------------------------------------------------------------------------
  // Phase 3.11 — History & Progression (read-only; composes persisted history).
  //   Deliverables: ei_history · progression_engine · trend_engine.
  // ---------------------------------------------------------------------------

  // ---- Unified history: assessment runs + EI snapshots + dimension series ---
  app.get(
    '/api/competency-ei/history/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildEiHistory(pool, String(req.params.subject))),
  );

  // ---- Progression: overall + per-dimension growth / improvement / decline --
  app.get(
    '/api/competency-ei/progression/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildProgression(pool, String(req.params.subject))),
  );

  // ---- EI trend over captured snapshots (trend_engine; read-only) -----------
  app.get(
    '/api/competency-ei/trends/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const history = await listEiProfileHistory(pool, String(req.params.subject)).catch(() => []);
      return computeEiTrend(history);
    }),
  );

  // Auto-provision defaults at boot ONLY when the flag is ON — keeps flag-OFF
  // byte-identical (no DDL, no seed) while making the read endpoints usable
  // without a manual sync step in the activated environment.
  if (isCompetencyEiEnabled()) {
    ensureEiDimensionSchema(pool)
      .then(() => seedEiDimensionDefaults(pool))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[competency-ei] dimension seed failed:', err?.message ?? err);
      });
    ensureScoringRunSchema(pool).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[competency-ei] scoring-run schema ensure failed:', err?.message ?? err);
    });
  }
}

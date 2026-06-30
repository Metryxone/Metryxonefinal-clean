/**
 * CAPADEX 3.0 — Program 1 · Phase 1.5 Progression Engine Completion routes (read-only composer).
 *
 * Serves the ONE canonical Progression Engine model + measured coverage + classified gaps,
 * answering: "Is CAPADEX capable of measurable, continuous customer growth?"
 *   - GET /api/progression/enabled              flag probe (flag state isn't sensitive; 503 when OFF)
 *   - GET /api/admin/progression/model          canonical spine + invariants + promotion rules + personas + axes
 *   - GET /api/admin/progression/coverage       per-path status + evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/progression/personas       per-persona growth paths joined with measured coverage
 *   - GET /api/admin/progression/matrices       per-persona × 8-axis matrices (registry + coverage)
 *   - GET /api/admin/progression/gaps           OPEN engineering gaps + resolved_gaps (closed via reuse)
 *   - GET /api/admin/progression/summary        rollup + STRUCTURAL verdict
 *   - GET /api/admin/progression/loop-closure   the 4 close-the-loop invariants VERIFIED (mechanism-present)
 *   - GET /api/admin/progression/adoption       ADOPTION of the reuse-instrumented growth loop (Adoption⟂Coverage)
 *   - GET /api/admin/progression/outcomes/persona  persona⟂progression read-time-join linkage (k-anon suppressed)
 *
 * Strictly additive + reversible + flag-gated (`progressionEngineCompletion`,
 * FF_PROGRESSION_ENGINE_COMPLETION, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; reads via to_regclass probes / fs existence checks and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  PROGRESSION_MODEL,
  PROGRESSION_SPINE,
  LOOP_CLOSURE_INVARIANTS,
  LIFECYCLE_PROMOTION_RULES,
  PROGRESSION_AXES,
  PROGRESSION_DECISIONS,
} from '../config/progression-model';
import {
  composeCoverage,
  composeSummary,
  composeLoopClosure,
  composeProgressionAdoption,
  composePersonaProgressionLinkage,
  PROGRESSION_GAPS,
  RESOLVED_PROGRESSION_GAPS,
} from '../services/progression-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('progressionEngineCompletion')) {
    return res.status(503).json({ ok: false, error: 'progression_engine_completion_disabled' });
  }
  next();
}

export function registerProgressionRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive). flagGate first → 503 when OFF; res.ok=true only when ON.
  app.get('/api/progression/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical progression model (static registry — no DB read).
  app.get('/api/admin/progression/model', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        spine_frozen: true,
        axes: PROGRESSION_AXES,
        spine: PROGRESSION_SPINE,
        invariants: LOOP_CLOSURE_INVARIANTS,
        promotion_rules: LIFECYCLE_PROMOTION_RULES,
        paths: PROGRESSION_MODEL,
        decisions: PROGRESSION_DECISIONS,
      });
    } catch (err) {
      console.error('[progression] model error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-path coverage — evidence VERIFIED against the live filesystem + DB (SSoT for present/absent).
  app.get('/api/admin/progression/coverage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, coverage: await composeCoverage(pool) });
    } catch (err) {
      console.error('[progression] coverage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Classified gaps. `gaps` = OPEN engineering gaps + `resolved_gaps` = closed-via-reuse with closure+residual
  // traceability. Residual is ADOPTION (usage-driven, reported separately via /adoption), NEVER reclassified
  // as an engineering gap.
  app.get('/api/admin/progression/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        gaps: PROGRESSION_GAPS,
        open_gap_count: PROGRESSION_GAPS.length,
        resolved_gaps: RESOLVED_PROGRESSION_GAPS,
        resolved_gap_count: RESOLVED_PROGRESSION_GAPS.length,
      });
    } catch (err) {
      console.error('[progression] gaps error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Rollup + STRUCTURAL verdict.
  app.get('/api/admin/progression/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool) });
    } catch (err) {
      console.error('[progression] summary error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-persona growth paths joined with measured coverage status (persona progression matrix data).
  app.get('/api/admin/progression/personas', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await composeCoverage(pool);
      const covByKey: Record<string, any> = {};
      for (const c of coverage) covByKey[c.key] = c;
      const personas = PROGRESSION_MODEL.map((p) => ({
        key: p.key,
        label: p.label,
        persona: p.persona,
        personas: p.personas,
        status: p.status,
        statusNote: p.statusNote ?? null,
        spineReached: p.spineReached,
        coverage: covByKey[p.key] ?? null,
      }));
      res.json({ ok: true, personas });
    } catch (err) {
      console.error('[progression] personas error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Cross-axis matrices — each persona path × the 8 progression axes (Coverage-VERIFIED status per path).
  // Derived ONLY from the FROZEN registry + measured coverage (the same data the deliverable matrices render).
  app.get('/api/admin/progression/matrices', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await composeCoverage(pool);
      const covByKey: Record<string, any> = {};
      for (const c of coverage) covByKey[c.key] = c;
      const row = (p: typeof PROGRESSION_MODEL[number], axisValue: unknown) => ({
        key: p.key,
        label: p.label,
        status: p.status,
        evidence_verified: covByKey[p.key]?.status ?? null,
        value: axisValue,
      });
      res.json({
        ok: true,
        axes: PROGRESSION_AXES,
        matrices: {
          persona_progression: PROGRESSION_MODEL.map((p) => row(p, p.spineReached)),
          lifecycle: PROGRESSION_MODEL.map((p) => row(p, p.lifecycleStages)),
          assessment: PROGRESSION_MODEL.map((p) => row(p, p.assessments)),
          ai_recommendation: PROGRESSION_MODEL.map((p) => row(p, { aiInterpretation: p.aiInterpretation, recommendationRule: p.recommendationRule })),
          intervention_outcome: PROGRESSION_MODEL.map((p) => row(p, { interventionPath: p.interventionPath, learningPath: p.learningPath, outcomes: p.outcomes })),
          promotion_kpi: PROGRESSION_MODEL.map((p) => row(p, { promotionRule: p.promotionRule, reassessmentRule: p.reassessmentRule, successCriteria: p.successCriteria })),
        },
      });
    } catch (err) {
      console.error('[progression] matrices error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Loop-closure invariants — the 4 close-the-loop edges VERIFIED present (mechanism, not adoption).
  app.get('/api/admin/progression/loop-closure', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, loop_closure: await composeLoopClosure(pool) });
    } catch (err) {
      console.error('[progression] loop-closure error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Adoption — how much the reuse-instrumented continuous-growth loop is exercised by real volume (Adoption⟂Coverage).
  app.get('/api/admin/progression/adoption', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, adoption: await composeProgressionAdoption(pool) });
    } catch (err) {
      console.error('[progression] adoption error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Persona⟂Progression linkage — read-time join validation (k-anon suppressed), Coverage⟂Outcome kept separate.
  app.get('/api/admin/progression/outcomes/persona', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, persona_linkage: await composePersonaProgressionLinkage(pool) });
    } catch (err) {
      console.error('[progression] persona-linkage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}

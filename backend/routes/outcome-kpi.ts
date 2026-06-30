/**
 * CAPADEX 3.0 — Program 1 · Phase 1.6 Outcome Framework / KPI Engine routes (read-only composer).
 *
 * Serves the ONE canonical Outcome Framework + KPI model + measured coverage + classified gaps,
 * answering: "assessment → intervention → MEASURABLE OUTCOME → KPI."
 *   - GET /api/outcome-kpi/enabled               flag probe (flag state isn't sensitive; 503 when OFF)
 *   - GET /api/admin/outcome-kpi/model           canonical spine + outcome types + KPI families + lifecycle rules + personas + axes
 *   - GET /api/admin/outcome-kpi/coverage        per-path status + evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/outcome-kpi/outcomes        per-outcome-type coverage (substrate VERIFIED)
 *   - GET /api/admin/outcome-kpi/kpis            per-KPI-family coverage (substrate VERIFIED)
 *   - GET /api/admin/outcome-kpi/matrices        per-persona × 8-axis matrices (registry + coverage)
 *   - GET /api/admin/outcome-kpi/effectiveness   recommendation/intervention effectiveness (rate honest-null/abstained)
 *   - GET /api/admin/outcome-kpi/personas        per-persona outcome paths joined with measured coverage
 *   - GET /api/admin/outcome-kpi/gaps            OPEN engineering gaps + resolved_gaps (closed via reuse)
 *   - GET /api/admin/outcome-kpi/summary         rollup + STRUCTURAL verdict
 *   - GET /api/admin/outcome-kpi/outcomes/persona  persona⟂outcome read-time-join linkage (k-anon suppressed)
 *
 * Strictly additive + reversible + flag-gated (`outcomeFrameworkKpiEngine`,
 * FF_OUTCOME_FRAMEWORK_KPI_ENGINE, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; reads via to_regclass probes / fs existence checks and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 *   - Coverage⟂Confidence⟂Outcome⟂Adoption are NEVER composited; null≠0; never fabricate.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  OUTCOME_MODEL,
  OUTCOME_SPINE,
  OUTCOME_TYPES,
  KPI_FAMILIES,
  LIFECYCLE_OUTCOME_RULES,
  OUTCOME_KPI_AXES,
  OUTCOME_KPI_DECISIONS,
} from '../config/outcome-kpi-model';
import {
  composeCoverage,
  composeOutcomeTypeCoverage,
  composeKpiCoverage,
  composeEffectiveness,
  composeOutcomeAdoption,
  composePersonaOutcomeLinkage,
  composeSummary,
  OUTCOME_KPI_GAPS,
  RESOLVED_OUTCOME_KPI_GAPS,
} from '../services/outcome-kpi-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('outcomeFrameworkKpiEngine')) {
    return res.status(503).json({ ok: false, error: 'outcome_framework_kpi_engine_disabled' });
  }
  next();
}

export function registerOutcomeKpiRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive). flagGate first → 503 when OFF; res.ok=true only when ON.
  app.get('/api/outcome-kpi/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical outcome/KPI model (static registry — no DB read).
  app.get('/api/admin/outcome-kpi/model', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        spine_frozen: true,
        axes: OUTCOME_KPI_AXES,
        spine: OUTCOME_SPINE,
        outcome_types: OUTCOME_TYPES,
        kpi_families: KPI_FAMILIES,
        lifecycle_rules: LIFECYCLE_OUTCOME_RULES,
        paths: OUTCOME_MODEL,
        decisions: OUTCOME_KPI_DECISIONS,
      });
    } catch (err) {
      console.error('[outcome-kpi] model error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-path coverage — evidence VERIFIED against the live filesystem + DB (SSoT for present/absent).
  app.get('/api/admin/outcome-kpi/coverage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, coverage: await composeCoverage(pool) });
    } catch (err) {
      console.error('[outcome-kpi] coverage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-outcome-type coverage — outcome substrate VERIFIED present/absent (Coverage axis).
  app.get('/api/admin/outcome-kpi/outcomes', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, outcome_types: await composeOutcomeTypeCoverage(pool) });
    } catch (err) {
      console.error('[outcome-kpi] outcomes error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-KPI-family coverage — KPI substrate VERIFIED present/absent (Coverage axis).
  app.get('/api/admin/outcome-kpi/kpis', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, kpi_families: await composeKpiCoverage(pool) });
    } catch (err) {
      console.error('[outcome-kpi] kpis error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Cross-axis matrices — each persona outcome path × the 8 outcome/KPI axes (Coverage-VERIFIED status per path).
  // Derived ONLY from the FROZEN registry + measured coverage (the same data the deliverable matrices render).
  app.get('/api/admin/outcome-kpi/matrices', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await composeCoverage(pool);
      const covByKey: Record<string, any> = {};
      for (const c of coverage) covByKey[c.key] = c;
      const row = (p: typeof OUTCOME_MODEL[number], axisValue: unknown) => ({
        key: p.key,
        label: p.label,
        status: p.status,
        evidence_verified: covByKey[p.key]?.status ?? null,
        value: axisValue,
      });
      res.json({
        ok: true,
        axes: OUTCOME_KPI_AXES,
        matrices: {
          persona_outcome: OUTCOME_MODEL.map((p) => row(p, p.spineReached)),
          lifecycle: OUTCOME_MODEL.map((p) => row(p, p.lifecycleStages)),
          assessment: OUTCOME_MODEL.map((p) => row(p, p.assessments)),
          ai_recommendation: OUTCOME_MODEL.map((p) => row(p, { aiInterpretation: p.aiInterpretation, recommendationEffectiveness: p.recommendationEffectiveness })),
          intervention_outcome: OUTCOME_MODEL.map((p) => row(p, { interventionEffectiveness: p.interventionEffectiveness, outcomeTypes: p.outcomeTypes })),
          outcome_kpi: OUTCOME_MODEL.map((p) => row(p, { kpiFamilies: p.kpiFamilies, realizedOutcome: p.realizedOutcome, successMetrics: p.successMetrics })),
        },
      });
    } catch (err) {
      console.error('[outcome-kpi] matrices error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Effectiveness — recommendation/intervention substrate MEASURED; effectiveness_rate honest-null/abstained
  // (Confidence axis kept separate from Coverage — never composited).
  app.get('/api/admin/outcome-kpi/effectiveness', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, effectiveness: await composeEffectiveness(pool) });
    } catch (err) {
      console.error('[outcome-kpi] effectiveness error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-persona outcome paths joined with measured coverage status (persona outcome matrix data).
  app.get('/api/admin/outcome-kpi/personas', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await composeCoverage(pool);
      const covByKey: Record<string, any> = {};
      for (const c of coverage) covByKey[c.key] = c;
      const personas = OUTCOME_MODEL.map((p) => ({
        key: p.key,
        label: p.label,
        persona: p.persona,
        personas: p.personas,
        status: p.status,
        statusNote: p.statusNote ?? null,
        spineReached: p.spineReached,
        outcomeTypes: p.outcomeTypes,
        kpiFamilies: p.kpiFamilies,
        coverage: covByKey[p.key] ?? null,
      }));
      res.json({ ok: true, personas });
    } catch (err) {
      console.error('[outcome-kpi] personas error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Classified gaps. `gaps` = OPEN engineering gaps + `resolved_gaps` = closed-via-reuse with closure+residual
  // traceability. Residual is ADOPTION (usage-driven, reported separately via /summary adoption), NEVER
  // reclassified as an engineering gap.
  app.get('/api/admin/outcome-kpi/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        gaps: OUTCOME_KPI_GAPS,
        open_gap_count: OUTCOME_KPI_GAPS.length,
        resolved_gaps: RESOLVED_OUTCOME_KPI_GAPS,
        resolved_gap_count: RESOLVED_OUTCOME_KPI_GAPS.length,
      });
    } catch (err) {
      console.error('[outcome-kpi] gaps error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Rollup + STRUCTURAL verdict (+ adoption surfaced separately, never composited into the verdict).
  app.get('/api/admin/outcome-kpi/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool), adoption: await composeOutcomeAdoption(pool) });
    } catch (err) {
      console.error('[outcome-kpi] summary error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Persona⟂Outcome linkage — read-time join validation (k-anon suppressed), Coverage⟂Outcome kept separate.
  app.get('/api/admin/outcome-kpi/outcomes/persona', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, persona_linkage: await composePersonaOutcomeLinkage(pool) });
    } catch (err) {
      console.error('[outcome-kpi] persona-linkage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}

/**
 * CAPADEX 3.0 — Program 1 · Phase 1.7 AI Recommendation Report Orchestration routes (read-only composer).
 *
 * Serves the ONE canonical AI-orchestration model + measured coverage + classified gaps, answering:
 * "assessment → AI analysis → confidence → explainability → recommendation → intervention →
 * outcome-validation → report → KPI."
 *   - GET /api/ai-orchestration/enabled               flag probe — UNGATED, always 200 {enabled:bool} (only DATA/admin routes 503 when OFF)
 *   - GET /api/admin/ai-orchestration/model           canonical 12-step spine + capability inventory + criteria + sections + surfaces + personas + axes
 *   - GET /api/admin/ai-orchestration/coverage        per-path status + evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/ai-orchestration/capabilities    AI capability inventory coverage (evidence VERIFIED)
 *   - GET /api/admin/ai-orchestration/recommendations recommendation-completeness criteria coverage
 *   - GET /api/admin/ai-orchestration/explainability  explainability criteria coverage
 *   - GET /api/admin/ai-orchestration/reports         report-section validation coverage
 *   - GET /api/admin/ai-orchestration/dashboards      dashboard-surface validation coverage
 *   - GET /api/admin/ai-orchestration/matrices        per-persona × 8-axis matrices (registry + coverage)
 *   - GET /api/admin/ai-orchestration/effectiveness   recommendation/intervention effectiveness (rate honest-null/abstained)
 *   - GET /api/admin/ai-orchestration/personas        per-persona AI paths joined with measured coverage
 *   - GET /api/admin/ai-orchestration/gaps            OPEN engineering gaps + resolved_gaps (closed via reuse)
 *   - GET /api/admin/ai-orchestration/summary         rollup + STRUCTURAL verdict + adoption (separate axis)
 *   - GET /api/admin/ai-orchestration/personas/linkage  persona⟂AI-outcome read-time-join linkage (k-anon suppressed)
 *
 * Strictly additive + reversible + flag-gated (`aiRecommendationReportOrchestration`,
 * FF_AI_RECOMMENDATION_REPORT_ORCHESTRATION, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; reads via to_regclass probes / fs existence checks and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 *   - Engines are read by existence / persisted output — NEVER invoked.
 *   - Coverage⟂Confidence⟂Outcome⟂Adoption are NEVER composited; null≠0; never fabricate.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  AI_ORCHESTRATION_MODEL,
  AI_ORCHESTRATION_SPINE,
  AI_ORCHESTRATION_AXES,
  AI_CAPABILITIES,
  RECOMMENDATION_CRITERIA,
  EXPLAINABILITY_CRITERIA,
  REPORT_SECTIONS,
  DASHBOARD_SURFACES,
  AI_ORCHESTRATION_DECISIONS,
} from '../config/ai-orchestration-model';
import {
  composeCoverage,
  composeCapabilityInventory,
  composeRecommendationCompleteness,
  composeExplainability,
  composeReportValidation,
  composeDashboardValidation,
  composeEffectiveness,
  composeAdoption,
  composePersonaAiLinkage,
  composeSummary,
  AI_ORCHESTRATION_GAPS,
  RESOLVED_AI_ORCHESTRATION_GAPS,
} from '../services/ai-orchestration-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('aiRecommendationReportOrchestration')) {
    return res.status(503).json({ ok: false, error: 'ai_recommendation_report_orchestration_disabled' });
  }
  next();
}

const degraded = (res: Response) =>
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });

export function registerAiOrchestrationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive) — UNGATED so the frontend can detect flag state.
  // Always 200; `enabled` reflects the live flag. Only DATA/admin routes 503 when OFF.
  app.get('/api/ai-orchestration/enabled', async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: isFlagEnabled('aiRecommendationReportOrchestration') });
  });

  // Canonical AI-orchestration model (static registry — no DB read).
  app.get('/api/admin/ai-orchestration/model', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        spine_frozen: true,
        axes: AI_ORCHESTRATION_AXES,
        spine: AI_ORCHESTRATION_SPINE,
        capabilities: AI_CAPABILITIES,
        recommendation_criteria: RECOMMENDATION_CRITERIA,
        explainability_criteria: EXPLAINABILITY_CRITERIA,
        report_sections: REPORT_SECTIONS,
        dashboard_surfaces: DASHBOARD_SURFACES,
        paths: AI_ORCHESTRATION_MODEL,
        decisions: AI_ORCHESTRATION_DECISIONS,
      });
    } catch (err) {
      console.error('[ai-orchestration] model error:', err);
      degraded(res);
    }
  });

  // Per-path coverage — evidence VERIFIED against the live filesystem + DB (SSoT for present/absent).
  app.get('/api/admin/ai-orchestration/coverage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, coverage: await composeCoverage(pool) });
    } catch (err) {
      console.error('[ai-orchestration] coverage error:', err);
      degraded(res);
    }
  });

  // AI capability inventory — capability substrate VERIFIED present/absent (Coverage axis).
  app.get('/api/admin/ai-orchestration/capabilities', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, capabilities: await composeCapabilityInventory(pool) });
    } catch (err) {
      console.error('[ai-orchestration] capabilities error:', err);
      degraded(res);
    }
  });

  // Recommendation-completeness criteria coverage.
  app.get('/api/admin/ai-orchestration/recommendations', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, recommendation_criteria: await composeRecommendationCompleteness(pool) });
    } catch (err) {
      console.error('[ai-orchestration] recommendations error:', err);
      degraded(res);
    }
  });

  // Explainability criteria coverage.
  app.get('/api/admin/ai-orchestration/explainability', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, explainability_criteria: await composeExplainability(pool) });
    } catch (err) {
      console.error('[ai-orchestration] explainability error:', err);
      degraded(res);
    }
  });

  // Report-section validation coverage.
  app.get('/api/admin/ai-orchestration/reports', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, report_sections: await composeReportValidation(pool) });
    } catch (err) {
      console.error('[ai-orchestration] reports error:', err);
      degraded(res);
    }
  });

  // Dashboard-surface validation coverage.
  app.get('/api/admin/ai-orchestration/dashboards', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, dashboard_surfaces: await composeDashboardValidation(pool) });
    } catch (err) {
      console.error('[ai-orchestration] dashboards error:', err);
      degraded(res);
    }
  });

  // Cross-axis matrices — each persona AI path × the 8 AI axes (Coverage-VERIFIED status per path).
  // Derived ONLY from the FROZEN registry + measured coverage (the same data the deliverable matrices render).
  app.get('/api/admin/ai-orchestration/matrices', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await composeCoverage(pool);
      const covByKey: Record<string, any> = {};
      for (const c of coverage) covByKey[c.key] = c;
      const row = (p: typeof AI_ORCHESTRATION_MODEL[number], axisValue: unknown) => ({
        key: p.key,
        label: p.label,
        status: p.status,
        evidence_verified: covByKey[p.key]?.status ?? null,
        value: axisValue,
      });
      res.json({
        ok: true,
        axes: AI_ORCHESTRATION_AXES,
        matrices: {
          persona_ai: AI_ORCHESTRATION_MODEL.map((p) => row(p, p.spineReached)),
          lifecycle: AI_ORCHESTRATION_MODEL.map((p) => row(p, p.lifecycleStages)),
          assessment: AI_ORCHESTRATION_MODEL.map((p) => row(p, p.assessments)),
          ai_analysis: AI_ORCHESTRATION_MODEL.map((p) => row(p, { aiAnalysis: p.aiAnalysis, explainability: p.explainability })),
          recommendation: AI_ORCHESTRATION_MODEL.map((p) => row(p, { recommendation: p.recommendation, report: p.report })),
          report_kpi: AI_ORCHESTRATION_MODEL.map((p) => row(p, { report: p.report, kpiFamilies: p.kpiFamilies })),
        },
      });
    } catch (err) {
      console.error('[ai-orchestration] matrices error:', err);
      degraded(res);
    }
  });

  // Effectiveness — recommendation/intervention substrate MEASURED; effectiveness_rate honest-null/abstained
  // (Confidence axis kept separate from Coverage — never composited).
  app.get('/api/admin/ai-orchestration/effectiveness', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, effectiveness: await composeEffectiveness(pool) });
    } catch (err) {
      console.error('[ai-orchestration] effectiveness error:', err);
      degraded(res);
    }
  });

  // Per-persona AI paths joined with measured coverage status (persona AI matrix data).
  app.get('/api/admin/ai-orchestration/personas', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await composeCoverage(pool);
      const covByKey: Record<string, any> = {};
      for (const c of coverage) covByKey[c.key] = c;
      const personas = AI_ORCHESTRATION_MODEL.map((p) => ({
        key: p.key,
        label: p.label,
        persona: p.persona,
        personas: p.personas,
        status: p.status,
        statusNote: p.statusNote ?? null,
        spineReached: p.spineReached,
        kpiFamilies: p.kpiFamilies,
        coverage: covByKey[p.key] ?? null,
      }));
      res.json({ ok: true, personas });
    } catch (err) {
      console.error('[ai-orchestration] personas error:', err);
      degraded(res);
    }
  });

  // Classified gaps. `gaps` = OPEN engineering gaps + `resolved_gaps` = closed-via-reuse with closure+residual
  // traceability. Residual is ADOPTION/CONFIDENCE (usage/data-driven, reported separately), NEVER an engineering gap.
  app.get('/api/admin/ai-orchestration/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        gaps: AI_ORCHESTRATION_GAPS,
        open_gap_count: AI_ORCHESTRATION_GAPS.length,
        resolved_gaps: RESOLVED_AI_ORCHESTRATION_GAPS,
        resolved_gap_count: RESOLVED_AI_ORCHESTRATION_GAPS.length,
      });
    } catch (err) {
      console.error('[ai-orchestration] gaps error:', err);
      degraded(res);
    }
  });

  // Rollup + STRUCTURAL verdict (+ adoption surfaced separately, never composited into the verdict).
  app.get('/api/admin/ai-orchestration/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool), adoption: await composeAdoption(pool) });
    } catch (err) {
      console.error('[ai-orchestration] summary error:', err);
      degraded(res);
    }
  });

  // Adoption — real non-demo AI/recommendation/report/outcome/KPI volume. A SEPARATE axis (usage-driven),
  // never composited into Coverage/Confidence/Outcome and never reported as an engineering gap; null≠0.
  app.get('/api/admin/ai-orchestration/adoption', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, adoption: await composeAdoption(pool) });
    } catch (err) {
      console.error('[ai-orchestration] adoption error:', err);
      degraded(res);
    }
  });

  // Persona⟂AI-outcome linkage — read-time join validation (k-anon suppressed), Coverage⟂Outcome kept separate.
  app.get('/api/admin/ai-orchestration/personas/linkage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, persona_linkage: await composePersonaAiLinkage(pool) });
    } catch (err) {
      console.error('[ai-orchestration] persona-linkage error:', err);
      degraded(res);
    }
  });
}

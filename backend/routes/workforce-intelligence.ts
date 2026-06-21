/**
 * PHASE 5.12 — Workforce Intelligence Foundation (routes).
 *
 * Base: /api/workforce-intelligence/*  (ALL GET — pure read/compose layer; no POST, no DDL)
 *   meta      GET /_meta/status
 *   config    GET /config                                    (weights, bands, disclaimer)
 *   team      GET /employer/:employerId/team-competency      (Team Competency Profile, per role)
 *   dept      GET /employer/:employerId/department-readiness (Department Readiness)
 *   skills    GET /employer/:employerId/skill-inventory      (Skill Inventory, supply/demand)
 *   heatmap   GET /employer/:employerId/capability-heatmap   (Capability Heatmap, dept × competency)
 *   talent    GET /employer/:employerId/talent-distribution  (Talent Distribution)
 *   overview  GET /employer/:employerId/overview             (all five — ONE evidence load)
 *
 * Contract:
 *   - Flag-gated: `workforceIntelligence` (FF_WORKFORCE_INTELLIGENCE). OFF => every route 503
 *     BEFORE any auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe inside the engines
 *     (every read strictly scoped by employer_id; cross-employer rows never leak).
 *   - PURE READ: composes already-recorded operator evidence; runs NO DDL and writes NO rows.
 *   - Engines never throw; not-found => 404, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isWorkforceIntelligenceEnabled } from '../config/feature-flags';
import {
  type EngineResult,
  ok, bandFor,
  resolveWorkforceEvidence, workforceSummary,
  WORKFORCE_INTELLIGENCE_VERSION, WORKFORCE_INTELLIGENCE_DISCLAIMER, PROVENANCE,
} from '../services/workforce-intelligence-shared';
import {
  computeTeamCompetencyProfile, computeTeamCompetencyProfileFromEvidence,
  computeDepartmentReadiness, computeDepartmentReadinessFromEvidence,
  computeTalentDistribution, computeTalentDistributionFromEvidence,
} from '../services/workforce-intelligence-engine';
import {
  computeSkillInventory, computeSkillInventoryFromEvidence, loadSkillReference,
} from '../services/skill-inventory-engine';
import {
  computeCapabilityHeatmap, computeCapabilityHeatmapFromEvidence,
} from '../services/capability-mapping-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

// Combined overview — composes all FIVE outputs over a SINGLE evidence load + ONE skill ref load.
async function workforceOverview(pool: Pool, employerId: string): Promise<EngineResult> {
  const resolved = await resolveWorkforceEvidence(pool, employerId);
  if (!resolved.ok) return resolved;
  const ev = resolved.data;
  const ref = await loadSkillReference(pool);
  return ok({
    engine: 'workforce_intelligence_overview',
    version: WORKFORCE_INTELLIGENCE_VERSION,
    employer_id: ev.employer_id,
    team_competency_profile: computeTeamCompetencyProfileFromEvidence(ev),
    department_readiness: computeDepartmentReadinessFromEvidence(ev),
    skill_inventory: computeSkillInventoryFromEvidence(ev, ref),
    capability_heatmap: computeCapabilityHeatmapFromEvidence(ev),
    talent_distribution: computeTalentDistributionFromEvidence(ev),
    evidence: workforceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
  });
}

export function registerWorkforceIntelligenceEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isWorkforceIntelligenceEnabled()) {
      return res.status(503).json({
        error: 'Workforce Intelligence is not enabled',
        flag: 'workforceIntelligence',
        env: 'FF_WORKFORCE_INTELLIGENCE',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/workforce-intelligence';

  // ── meta + config (literal — first) ────────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'workforce-intelligence', version: WORKFORCE_INTELLIGENCE_VERSION, ok: true });
  });
  app.get(`${base}/config`, ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'workforce-intelligence',
      version: WORKFORCE_INTELLIGENCE_VERSION,
      outputs: {
        team_competency_profile: { engine: 'workforce_intelligence_engine', weights: { competency: 0.4, assessment: 0.3, ei: 0.2, rating: 0.1 } },
        department_readiness:    { engine: 'workforce_intelligence_engine', weights: { assessment: 0.35, competency: 0.30, match: 0.20, ei: 0.15 } },
        talent_distribution:     { engine: 'workforce_intelligence_engine', basis: 'per-candidate readiness index (department-readiness weights)' },
        skill_inventory:         { engine: 'skill_inventory', basis: 'supply (candidate skills) vs demand (job required skills), canonicalized against `skills` reference' },
        capability_heatmap:      { engine: 'capability_mapping', basis: 'department × competency mean proficiency; gap vs recorded targets when available' },
      },
      bands: { high: '>=75', moderate: '>=50', developing: '>=25', low: '<25', unmeasured: 'null (coverage 0)' },
      band_example: { '90': bandFor(90), '60': bandFor(60), '30': bandFor(30), '10': bandFor(10), 'null': bandFor(null) },
      provenance: PROVENANCE,
      disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
    });
  });

  // ── per-output employer aggregates (read-only) ─────────────────────────────
  app.get(`${base}/employer/:employerId/team-competency`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeTeamCompetencyProfile(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/department-readiness`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeDepartmentReadiness(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/skill-inventory`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeSkillInventory(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/capability-heatmap`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeCapabilityHeatmap(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/talent-distribution`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeTalentDistribution(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/overview`, ...guards, async (req: Request, res: Response) => {
    send(res, await workforceOverview(pool, req.params.employerId));
  });
}

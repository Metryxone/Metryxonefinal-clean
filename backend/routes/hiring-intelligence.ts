/**
 * PHASE 5.11 — Hiring Intelligence (routes).
 *
 * Base: /api/hiring-intelligence/*  (ALL GET — pure read/compose layer; no POST, no DDL)
 *   meta     GET /_meta/status
 *   config   GET /config                                              (weights, bands, lexicons, disclaimer)
 *   hiring   GET /job/:jobId/candidate/:candidateId/hiring           (Hiring Probability + Hiring Risk)
 *   success  GET /job/:jobId/candidate/:candidateId/success          (Success + Retention Potential)
 *   potential GET /job/:jobId/candidate/:candidateId/potential       (Leadership + Growth Potential)
 *   profile  GET /job/:jobId/candidate/:candidateId/profile          (all six — ONE evidence load)
 *
 * Contract:
 *   - Flag-gated: `hiringIntelligence` (FF_HIRING_INTELLIGENCE). OFF => every route 503 BEFORE
 *     any auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe inside the engines
 *     (candidate strictly job-scoped via resolveEvidence).
 *   - PURE READ: composes already-recorded operator evidence; runs NO DDL and writes NO rows.
 *   - Engines never throw; not-found => 404, IDOR/bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isHiringIntelligenceEnabled } from '../config/feature-flags';
import {
  type EngineResult,
  resolveEvidence, evidenceSummary, ok,
  HIRING_INTELLIGENCE_VERSION, HIRING_INTELLIGENCE_DISCLAIMER, PROVENANCE,
  bandFor, LEADERSHIP_TERMS, GROWTH_TERMS,
} from '../services/hiring-intelligence-shared';
import { computeHiringIntelligence, computeHiringIntelligenceFromEvidence } from '../services/hiring-intelligence-engine';
import { computeSuccessPrediction, computeSuccessPredictionFromEvidence } from '../services/success-prediction-engine';
import { computeTalentPotential, computeTalentPotentialFromEvidence } from '../services/talent-potential-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

// Combined profile — composes all THREE engines over a SINGLE evidence load (no recompute).
async function talentIntelligenceProfile(pool: Pool, jobId: string, candidateId: string): Promise<EngineResult> {
  const resolved = await resolveEvidence(pool, jobId, candidateId);
  if (!resolved.ok) return resolved;
  const ev = resolved.data;
  const hiring = computeHiringIntelligenceFromEvidence(ev);
  const success = computeSuccessPredictionFromEvidence(ev);
  const potential = computeTalentPotentialFromEvidence(ev);
  return ok({
    engine: 'hiring_intelligence_profile',
    version: HIRING_INTELLIGENCE_VERSION,
    job_id: ev.job_id,
    candidate_id: ev.candidate_id,
    indices: {
      hiring_probability: hiring.hiring_probability,
      hiring_risk: hiring.hiring_risk,
      success_potential: success.success_potential,
      retention_potential: success.retention_potential,
      leadership_potential: potential.leadership_potential,
      growth_potential: potential.growth_potential,
    },
    latest_decision: hiring.latest_decision,
    leadership_criteria_assessed: potential.leadership_criteria_assessed,
    growth_criteria_assessed: potential.growth_criteria_assessed,
    evidence: evidenceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: HIRING_INTELLIGENCE_DISCLAIMER,
  });
}

export function registerHiringIntelligenceEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isHiringIntelligenceEnabled()) {
      return res.status(503).json({
        error: 'Hiring Intelligence is not enabled',
        flag: 'hiringIntelligence',
        env: 'FF_HIRING_INTELLIGENCE',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/hiring-intelligence';

  // ── meta + config (literal — first) ────────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'hiring-intelligence', version: HIRING_INTELLIGENCE_VERSION, ok: true });
  });
  app.get(`${base}/config`, ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'hiring-intelligence',
      version: HIRING_INTELLIGENCE_VERSION,
      indices: {
        hiring_probability: { engine: 'hiring_intelligence_engine', weights: { panel_recommendation: 0.4, interview_evaluation: 0.35, decision_posture: 0.25 } },
        hiring_risk:        { engine: 'hiring_intelligence_engine', weights: { panel_negativity: 0.4, concern_density: 0.3, decision_risk: 0.3 } },
        success_potential:  { engine: 'success_prediction_engine', weights: { interview_evaluation: 0.45, match_score: 0.30, assessment_score: 0.25 } },
        retention_potential:{ engine: 'success_prediction_engine', weights: { operator_rating: 0.5, evaluation_consistency: 0.3, ei_signal: 0.2 } },
        leadership_potential:{ engine: 'talent_potential_engine', weights: { leadership_criteria: 0.7, leadership_strengths: 0.3 } },
        growth_potential:   { engine: 'talent_potential_engine', weights: { growth_criteria: 0.6, improvement_trajectory: 0.4 } },
      },
      bands: { high: '>=75', moderate: '>=50', developing: '>=25', low: '<25', unmeasured: 'null (coverage 0)' },
      band_example: { '90': bandFor(90), '60': bandFor(60), '30': bandFor(30), '10': bandFor(10), 'null': bandFor(null) },
      lexicons: { leadership: LEADERSHIP_TERMS, growth: GROWTH_TERMS },
      provenance: PROVENANCE,
      disclaimer: HIRING_INTELLIGENCE_DISCLAIMER,
    });
  });

  // ── per-engine candidate indices (read-only) ───────────────────────────────
  app.get(`${base}/job/:jobId/candidate/:candidateId/hiring`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeHiringIntelligence(pool, req.params.jobId, req.params.candidateId));
  });
  app.get(`${base}/job/:jobId/candidate/:candidateId/success`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeSuccessPrediction(pool, req.params.jobId, req.params.candidateId));
  });
  app.get(`${base}/job/:jobId/candidate/:candidateId/potential`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeTalentPotential(pool, req.params.jobId, req.params.candidateId));
  });
  app.get(`${base}/job/:jobId/candidate/:candidateId/profile`, ...guards, async (req: Request, res: Response) => {
    send(res, await talentIntelligenceProfile(pool, req.params.jobId, req.params.candidateId));
  });
}

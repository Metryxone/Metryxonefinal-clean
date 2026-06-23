/**
 * Competency → Skill Intelligence routes — 98X Gap Closure, Phase 5 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/competency-skill
 * Gating order: foundation -> competencySkillIntelligence -> auth.
 * Flag OFF (`competencySkillIntelligence`, env FF_COMPETENCY_SKILL_INTELLIGENCE) → every route
 * 503 BEFORE any auth/DB touch → byte-identical legacy behaviour (existing competency / career
 * graph / LIP routes are UNTOUCHED).
 *
 *   GET /chain/:competencyId  — read-only Competency→Skill→Learning→Cert→Role→Career chain
 *   GET /coverage             — % onto_competencies with ≥1 mapped skill (success metric)
 *   GET /feature-flag         — flag readback (also gated → 503 OFF)
 *   GET /_meta/versions       — version stamp (also gated → 503 OFF)
 *
 * All routes are READ-ONLY. The comp_skill_map crosswalk is populated by the offline seed
 * (scripts/seed-comp-skill-map.ts) — nothing here writes. No subject/user scope (reference
 * ontology data), so no IDOR surface; requireAuth still applies for consistency with the v2 family.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  COMPETENCY_SKILL_INTELLIGENCE_VERSION,
  getCompetencySkillCoverage,
  resolveCompetencySkillChain,
} from '../services/competency-skill-intelligence';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isCompetencySkillIntelligenceEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { COMPETENCY_SKILL_INTELLIGENCE_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['competency', 'skill', 'learning resource', 'certification', 'role', 'career path', 'developmental mapping'],
  disallowed: ['guaranteed job', 'hiring prediction', 'pass/fail verdict', 'salary guarantee'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    competencySkillIntelligence: isCompetencySkillIntelligenceEnabled(),
  };
}
function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return {
    status: code,
    body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() },
  };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireCsi(_req: Request, res: Response, next: NextFunction) {
  if (!isCompetencySkillIntelligenceEnabled()) {
    const e = errorEnvelope('competencySkillIntelligence disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

export function registerCompetencySkillIntelligenceRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route 503s before any work when OFF, including readback/meta.
  app.get('/api/v2/competency-skill/feature-flag', requireFoundation, requireCsi, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/competency-skill/_meta/versions', requireFoundation, requireCsi, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // GET /coverage — success metric (literal path BEFORE the /:competencyId param route).
  app.get(
    '/api/v2/competency-skill/coverage',
    requireFoundation, requireCsi, requireAuth,
    async (_req, res) => {
      try {
        const coverage = await getCompetencySkillCoverage(pool);
        return res.json(envelope({ coverage }));
      } catch (err) {
        const e = errorEnvelope('coverage_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  // GET /chain/:competencyId — read-only composed chain.
  app.get(
    '/api/v2/competency-skill/chain/:competencyId',
    requireFoundation, requireCsi, requireAuth,
    async (req, res) => {
      const competencyId = String(req.params.competencyId || '').trim();
      if (!competencyId) {
        const e = errorEnvelope('competencyId required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        const chain = await resolveCompetencySkillChain(pool, competencyId);
        return res.json(envelope({ chain }));
      } catch (err) {
        const e = errorEnvelope('chain_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );
}

/**
 * PHASE 5.5 — Competency Matching Engine (routes).
 *
 * Base: /api/talent-matching-engine/*
 *   - talent_matching_engine    : GET /candidate/:candidateId/role/:roleId (5-axis match),
 *                                 GET /candidate/:candidateId/roles (rank roles),
 *                                 GET /role/:roleId/candidates (rank candidates)
 *   - match_explanation_engine  : GET /candidate/:candidateId/role/:roleId/explain
 *   (fit_engine / gap_engine are composed inside the match result)
 *
 * Contract:
 *   - Flag-gated: `talentMatching` (FF_TALENT_MATCHING). OFF => every route 503
 *     BEFORE any auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe: no
 *     client-supplied identity is trusted (read-only over employer substrate).
 *   - GET-only / read-only: the engine composes getRoleReadiness and runs NO DDL
 *     (this phase adds zero tables).
 *   - Engine never throws; not-found => 404, bad input => 400.
 *   - Literal/more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isTalentMatchingEnabled } from '../config/feature-flags';
import {
  TALENT_MATCHING_ENGINE_VERSION as ENGINE_VERSION,
  matchCandidateToRole,
  rankCandidatesForRole,
  rankCandidatesForRoleTitle,
  rankCandidatesForJob,
  rankRolesForCandidate,
  type EngineResult,
} from '../services/talent-matching-engine';
import { resolveCuratedRoleByTitle } from '../services/role-title-crosswalk';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) {
    res.json(result.data);
    return;
  }
  const status = result.code === 'not_found' ? 404 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

// Parse an optional ?limit= query param. A missing OR malformed value yields
// undefined so the engine applies its own default (a NaN must never silently
// collapse the result set to empty).
function parseLimit(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function registerTalentMatchingEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isTalentMatchingEnabled()) {
      return res.status(503).json({
        error: 'Competency Matching Engine is not enabled',
        flag: 'talentMatching',
        env: 'FF_TALENT_MATCHING',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/talent-matching-engine';

  // ── meta (literal — registered first) ──────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'talent-matching-engine', version: ENGINE_VERSION, ok: true });
  });

  // ── role-title crosswalk preview (literal) ─────────────────────────────────
  // Crosswalk a free-text role title to a curated Role-DNA role (with Confidence
  // + an Estimated/abstain path) WITHOUT ranking — for job-creation-time preview.
  app.get(`${base}/resolve-role`, ...guards, async (req: Request, res: Response) => {
    const title = String(req.query.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'title query param is required', code: 'invalid_input' });
    const resolution = await resolveCuratedRoleByTitle(pool, title);
    res.json(resolution);
  });

  // ── rank candidates by free-text role title (literal — before param routes) ─
  app.get(`${base}/by-title/candidates`, ...guards, async (req: Request, res: Response) => {
    const title = String(req.query.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'title query param is required', code: 'invalid_input' });
    send(res, await rankCandidatesForRoleTitle(pool, title, { limit: parseLimit(req.query.limit) }));
  });

  // ── rank candidates for a normally-posted job (no hardcoded role id) ────────
  app.get(`${base}/job/:jobId/candidates`, ...guards, async (req: Request, res: Response) => {
    send(res, await rankCandidatesForJob(pool, req.params.jobId, { limit: parseLimit(req.query.limit) }));
  });

  // ── explain (more specific — before /candidate/:c/role/:r) ─────────────────
  app.get(`${base}/candidate/:candidateId/role/:roleId/explain`, ...guards, async (req: Request, res: Response) => {
    const result = await matchCandidateToRole(pool, req.params.candidateId, req.params.roleId);
    if (!result.ok) return send(res, result);
    const m = result.data;
    res.json({
      candidate_id: m.candidate_id,
      candidate_name: m.candidate_name,
      role_id: m.role_id,
      role_title: m.role_title,
      measurable: m.measurable,
      scores: {
        match_pct: m.match_pct, fit_pct: m.fit_pct, gap_pct: m.gap_pct,
        readiness_pct: m.readiness_pct, confidence_pct: m.confidence_pct,
      },
      fit_band: m.fit_band, fit_label: m.fit_label, capped_by_critical: m.capped_by_critical,
      blocking_gaps: m.blocking_gaps, evidence_mix: m.evidence_mix,
      breakdown: m.breakdown, notes: m.notes,
    });
  });

  // ── full match (candidate vs one role) ─────────────────────────────────────
  app.get(`${base}/candidate/:candidateId/role/:roleId`, ...guards, async (req: Request, res: Response) => {
    send(res, await matchCandidateToRole(pool, req.params.candidateId, req.params.roleId));
  });

  // ── rank roles for a candidate (literal 'roles' segment) ───────────────────
  app.get(`${base}/candidate/:candidateId/roles`, ...guards, async (req: Request, res: Response) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    send(res, await rankRolesForCandidate(pool, req.params.candidateId, { limit }));
  });

  // ── rank candidates for a role ─────────────────────────────────────────────
  app.get(`${base}/role/:roleId/candidates`, ...guards, async (req: Request, res: Response) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    send(res, await rankCandidatesForRole(pool, req.params.roleId, { limit }));
  });
}

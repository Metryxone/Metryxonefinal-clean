/**
 * GET /api/career/stage-guidance
 *
 * Aggregates Phase 1–4 intelligence into a single payload for the Career
 * Builder "Gap to next stage" panel. Read-only, never throws — on any
 * downstream failure, returns `static_fallback_used: true` and an empty
 * payload so the frontend can render its static fallback path.
 */

import type { Express } from 'express';
import type { Pool } from 'pg';
import { buildStageGuidance, suggestDefaultTargetRole,
         STAGE_GUIDANCE_VERSION,
         type StageGuidancePayload } from '../services/stage-guidance-orchestrator.js';
import { loadProfileSnapshot, type ProfileSnapshot } from '../services/role-requirements-engine.js';

export function registerCareerStageGuidanceRoutes({ app, pool }: { app: Express; pool: Pool }) {
  const handler = async (req: any, res: any) => {
    const t0 = Date.now();
    const session_id = String(req.query.session_id ?? `demo-${Date.now()}`);
    // Authorization guard: user_id is only honoured when the requester is the
    // owner of that user_id or is an admin. Otherwise it is silently ignored
    // (and profile is not loaded from DB) — prevents IDOR-style profile lookup.
    const reqUser = (req as any).user as { id?: string; role?: string } | undefined;
    const requestedUserId = typeof req.query.user_id === 'string' ? String(req.query.user_id) : undefined;
    const isAdmin = reqUser?.role === 'admin' || reqUser?.role === 'super_admin';
    const isOwner = !!reqUser?.id && !!requestedUserId && reqUser.id === requestedUserId;
    const user_id: string | undefined =
      requestedUserId && (isOwner || isAdmin) ? requestedUserId
      : reqUser?.id ?? undefined;
    let target_role_id = typeof req.query.target_role_id === 'string' ? String(req.query.target_role_id) : '';

    // Optional inline scores JSON: ?scores={"comp_id":78,...}
    let scores: Record<string, number> | undefined;
    if (typeof req.query.scores === 'string') {
      try { scores = JSON.parse(String(req.query.scores)); } catch { /* ignore */ }
    }
    const demo = req.query.demo === 'true' || req.query.demo === '1';

    // Optional profile snapshot (POST body) or load from DB by user_id
    let profile: ProfileSnapshot | null = null;
    if (req.body && typeof req.body === 'object' && req.body.profile && typeof req.body.profile === 'object') {
      profile = req.body.profile as ProfileSnapshot;
    } else if (user_id) {
      profile = await loadProfileSnapshot(pool, user_id);
    }

    const ctx = {
      industry_id:  typeof req.query.industry_id  === 'string' ? String(req.query.industry_id)  : undefined,
      function_id:  typeof req.query.function_id  === 'string' ? String(req.query.function_id)  : undefined,
      layer_id:     typeof req.query.layer_id     === 'string' ? String(req.query.layer_id)     : undefined,
      seniority:    typeof req.query.seniority    === 'string' ? String(req.query.seniority)    : undefined,
      org_maturity: typeof req.query.org_maturity === 'string' ? String(req.query.org_maturity) : undefined,
      team_scale:   typeof req.query.team_scale   === 'string' ? String(req.query.team_scale)   : undefined,
      geography:    typeof req.query.geography    === 'string' ? String(req.query.geography)    : undefined,
    } as Record<string, string | undefined>;

    try {
      if (!target_role_id) {
        const def = await suggestDefaultTargetRole(pool);
        if (!def) return res.status(200).json(fallbackEnvelope('no_roles_available'));
        target_role_id = def;
      }

      const payload: StageGuidancePayload = await buildStageGuidance(pool, {
        session_id, target_role_id, user_id, scores, demo, context: ctx as never, profile,
      });

      res.status(200).json({
        ok: true,
        version: STAGE_GUIDANCE_VERSION,
        elapsed_ms: Date.now() - t0,
        ...payload,
      });
    } catch (e) {
      const msg = (e as Error).message ?? 'unknown';
      // eslint-disable-next-line no-console
      console.warn('[stage-guidance] orchestrator failed:', msg);
      res.status(200).json(fallbackEnvelope(msg));
    }
  };

  app.get('/api/career/stage-guidance', handler);
  app.post('/api/career/stage-guidance', handler);
}

function fallbackEnvelope(reason: string) {
  return {
    ok: true,
    version: STAGE_GUIDANCE_VERSION,
    static_fallback_used: true,
    fallback_reason: reason,
    target_role: null,
    overall_gap: null,
    reliability: null,
    gap_decomposition: [],
    ranked_steps: [],
    adjacent_offramp: null,
    explainability: {
      methodology_version: STAGE_GUIDANCE_VERSION,
      data_sources: [],
      ranking_formula: '(projected_ei_lift / max(effort_h, 0.5)) × velocity_mult × confidence_mult',
      language_policy: {
        allowed:    ['developmental readiness', 'capability proximity',
                     'alignment indicator', 'development opportunity'],
        disallowed: ['hiring prediction', 'promotion guarantee',
                     'suitable candidate', 'likely to get hired'],
      },
      generated_at: new Date().toISOString(),
    },
  };
}

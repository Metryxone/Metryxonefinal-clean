/**
 * Competency Runtime V2 — additive routes (feature-flagged).
 *
 * Mount prefix: /api/v2/competency
 * All endpoints require auth. All write paths return 503 when the
 * `advancedCompetencyRuntimeV2` flag is disabled — read paths still
 * report the flag state so the UI can branch.
 *
 * Routes:
 *   POST /api/v2/competency/resolve-dna
 *   POST /api/v2/competency/runtime-context
 *   GET  /api/v2/competency/role-dna/:roleId
 *   GET  /api/v2/competency/runtime-weights/:userId
 *   GET  /api/v2/competency/contextual-expectations/:userId
 *   GET  /api/v2/competency/feature-flag
 *   GET  /api/v2/competency/_meta/versions
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  resolveCompetencyDNA,
  persistRuntimeContext,
  COMPETENCY_RESOLUTION_VERSION,
  type RuntimeContextInput,
} from '../services/competency-resolution-engine';
import { ROLE_DNA_GENERATOR_VERSION, generateRoleDNA } from '../services/role-dna-generator';
import { RUNTIME_EXPLAINABILITY_VERSION } from '../services/runtime-explainability-engine';
import { DYNAMIC_WEIGHT_VERSION } from '../services/dynamic-weight-engine';
import { isAdvancedRuntimeEnabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  COMPETENCY_RESOLUTION_VERSION,
  ROLE_DNA_GENERATOR_VERSION,
  RUNTIME_EXPLAINABILITY_VERSION,
  DYNAMIC_WEIGHT_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['developmental signal', 'capability indicator', 'readiness band'],
  disallowed: ['hiring decision', 'promotion prediction', 'candidate suitability'],
};

function envelope<T extends object>(payload: T) {
  return {
    ok: true,
    ...payload,
    methodology_versions: VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { advancedCompetencyRuntimeV2: isAdvancedRuntimeEnabled() },
  };
}

function requireFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isAdvancedRuntimeEnabled()) {
    return res.status(503).json({
      ok: false,
      error: 'advancedCompetencyRuntimeV2 disabled',
      feature_flag: { advancedCompetencyRuntimeV2: false },
    });
  }
  next();
}

function getReqUserId(req: Request): number | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  const n = typeof u.id === 'string' ? Number.parseInt(u.id, 10) : u.id;
  return Number.isFinite(n) ? (n as number) : null;
}

export function registerCompetencyRuntimeV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  // Feature-flag readback (no auth — UI uses this to decide whether to render V2 panel).
  app.get('/api/v2/competency/feature-flag', (_req, res) => {
    res.json(envelope({}));
  });

  app.get('/api/v2/competency/_meta/versions', (_req, res) => {
    res.json(envelope({}));
  });

  // POST /resolve-dna — full pipeline
  app.post('/api/v2/competency/resolve-dna', requireAuth, requireFlag, async (req, res) => {
    try {
      const uid = getReqUserId(req);
      if (uid == null) return res.status(401).json({ ok: false, error: 'unauthenticated' });
      const body = (req.body ?? {}) as Partial<RuntimeContextInput>;
      const ctx: RuntimeContextInput = {
        user_id: uid,
        industry_id: body.industry_id ?? null,
        function_id: body.function_id ?? null,
        sub_function_id: body.sub_function_id ?? null,
        role_id: body.role_id ?? null,
        layer_id: body.layer_id ?? null,
        complexity_model_id: body.complexity_model_id ?? null,
        geography: body.geography ?? null,
        org_maturity: body.org_maturity ?? null,
        team_scale: body.team_scale ?? null,
        seniority_band: body.seniority_band ?? null,
        assessment_mode: body.assessment_mode ?? null,
      };
      const result = await resolveCompetencyDNA(pool, ctx);
      res.json(envelope({ result }));
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /runtime-context — persist only (no DNA resolution)
  app.post('/api/v2/competency/runtime-context', requireAuth, requireFlag, async (req, res) => {
    try {
      const uid = getReqUserId(req);
      if (uid == null) return res.status(401).json({ ok: false, error: 'unauthenticated' });
      const body = (req.body ?? {}) as Partial<RuntimeContextInput>;
      const id = await persistRuntimeContext(pool, { ...(body as RuntimeContextInput), user_id: uid });
      res.json(envelope({ runtime_context_id: id }));
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // GET /role-dna/:roleId — fetch (or regenerate) DNA without persisting context
  app.get('/api/v2/competency/role-dna/:roleId', requireAuth, requireFlag, async (req, res) => {
    try {
      const { roleId } = req.params;
      const { layer_id, industry_id, complexity_model_id, org_maturity } = req.query as Record<string, string | undefined>;
      const dna = await generateRoleDNA(pool, {
        roleId,
        layerId: layer_id ?? null,
        industryId: industry_id ?? null,
        complexityModelId: complexity_model_id ?? null,
        orgMaturity: org_maturity ?? null,
      });
      res.json(envelope({ role_dna: dna }));
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // GET /runtime-weights/:userId — latest cached weights for the user's latest DNA
  app.get('/api/v2/competency/runtime-weights/:userId', requireAuth, requireFlag, async (req, res) => {
    try {
      const uid = getReqUserId(req);
      if (uid == null) return res.status(401).json({ ok: false, error: 'unauthenticated' });
      const pathUid = Number.parseInt(req.params.userId, 10);
      if (pathUid !== uid) return res.status(403).json({ ok: false, error: 'forbidden' });

      const r = await pool.query(
        `
        SELECT w.competency_code, w.importance_weight, w.expected_level,
               w.minimum_threshold, w.growth_priority, w.criticality,
               w.weighting_reason, w.weighting_context, w.created_at,
               h.resolved_role_dna_id
        FROM competency_resolution_history h
        JOIN competency_runtime_weights w ON w.role_dna_id = h.resolved_role_dna_id
        WHERE h.user_id = $1
        ORDER BY h.created_at DESC, w.created_at DESC
        LIMIT 50
        `,
        [uid],
      );
      res.json(envelope({ weights: r.rows }));
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // GET /profile/:userId — single source of truth: latest competency intelligence profile.
  // Reads competency_intelligence_profiles (Phase 4 orchestration table). Falls back to the
  // latest resolution_history row when no profile has been generated yet, so callers always
  // get a usable envelope.
  app.get('/api/v2/competency/profile/:userId', requireAuth, requireFlag, async (req, res) => {
    try {
      const uid = getReqUserId(req);
      if (uid == null) return res.status(401).json({ ok: false, error: 'unauthenticated' });
      const pathUid = Number.parseInt(req.params.userId, 10);
      if (pathUid !== uid) return res.status(403).json({ ok: false, error: 'forbidden' });

      const profile = await pool.query(
        `SELECT user_id, profile, lineage, version, computed_at
           FROM competency_intelligence_profiles
          WHERE user_id = $1
          ORDER BY computed_at DESC
          LIMIT 1`,
        [uid],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      const versions = await pool.query(
        `SELECT version_number, triggered_by, created_at
           FROM competency_profile_versions
          WHERE user_id = $1
          ORDER BY version_number DESC
          LIMIT 5`,
        [String(uid)],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      if (!profile.rows.length) {
        // Fallback: synthesise a thin profile from the latest resolution_history
        const h = await pool.query(
          `SELECT id, resolved_role_dna_id, resolution_inputs, resolution_outputs,
                  confidence_score, explainability, created_at
             FROM competency_resolution_history
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [uid],
        );
        if (!h.rows.length) {
          return res.json(envelope({ profile: null, version_history: [] }));
        }
        const row = h.rows[0];
        return res.json(envelope({
          profile: {
            source: 'resolution_history_fallback',
            user_id: uid,
            profile_snapshot: {
              role_dna_id: row.resolved_role_dna_id,
              inputs: row.resolution_inputs,
              outputs: row.resolution_outputs,
              explainability: row.explainability,
            },
            confidence_score: Number(row.confidence_score),
            last_updated_at: row.created_at,
          },
          version_history: versions.rows,
        }));
      }

      const p = profile.rows[0] as { user_id: number; profile: unknown; lineage: unknown; version: number; computed_at: string };
      return res.json(envelope({
        profile: {
          source: 'competency_intelligence_profiles',
          user_id: p.user_id,
          profile_snapshot: p.profile,
          lineage: p.lineage,
          profile_version: p.version,
          last_updated_at: p.computed_at,
        },
        version_history: versions.rows,
      }));
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // GET /contextual-expectations/:userId — latest resolved DNA + explainability for the user
  app.get('/api/v2/competency/contextual-expectations/:userId', requireAuth, requireFlag, async (req, res) => {
    try {
      const uid = getReqUserId(req);
      if (uid == null) return res.status(401).json({ ok: false, error: 'unauthenticated' });
      const pathUid = Number.parseInt(req.params.userId, 10);
      if (pathUid !== uid) return res.status(403).json({ ok: false, error: 'forbidden' });

      const h = await pool.query(
        `
        SELECT id, runtime_context_id, resolved_role_dna_id,
               resolution_inputs, resolution_outputs, confidence_score,
               explainability, created_at
        FROM competency_resolution_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [uid],
      );
      if (!h.rows.length) return res.json(envelope({ expectations: null }));
      const row = h.rows[0];
      const dna = await pool.query(
        `SELECT * FROM role_dna_profiles_v2 WHERE id = $1 LIMIT 1`,
        [row.resolved_role_dna_id],
      );
      res.json(envelope({
        expectations: {
          resolved_at: row.created_at,
          confidence_score: Number(row.confidence_score),
          context: row.resolution_inputs,
          outputs: row.resolution_outputs,
          explainability: row.explainability,
          role_dna: dna.rows[0] ?? null,
        },
      }));
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });
}

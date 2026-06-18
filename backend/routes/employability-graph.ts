/**
 * Employability Knowledge Graph — Phase 5 routes.
 *
 * User-facing:
 *   GET  /api/employability/occupations
 *   GET  /api/employability/occupations/:id
 *   GET  /api/employability/occupations/:id/pathways
 *   GET  /api/employability/market/:occupationId
 *   GET  /api/employability/skill-adjacency/:skillId
 *   POST /api/employability/role-fit
 *   POST /api/employability/role-matches
 *   POST /api/employability/trajectory
 *
 * Admin:
 *   GET  /api/admin/kg/edges            (filtered list)
 *   POST /api/admin/kg/edges            (upsert)
 *   DELETE /api/admin/kg/edges/:id      (deactivate)
 *   GET  /api/admin/occupations/:id/skills
 *   POST /api/admin/occupations/:id/skills
 *   GET  /api/admin/calibration/runs
 *   POST /api/admin/calibration/preview   (dry-run; deterministic stats only)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { listEdges, upsertEdge, deactivateEdge, type KGEntityType, type KGEdgeType } from '../services/knowledge-graph';
import { getAdjacentSkills } from '../services/skill-graph';
import { getMarketDemand, listMarketDemands } from '../services/market-intelligence';
import { computeRoleFit, findTopRoleMatches } from '../services/role-fit-engine';
import { forecastTrajectory } from '../services/trajectory-engine';
import { resolveProfile, type ResolverInput } from '../services/ei-resolver';
import { getActiveRuleset } from '../services/ei-rules-loader';
import { ensureOccupationGraphSeed } from '../services/occupation-graph-seed';
import { ensureOccupationGraphSeedP4 } from '../services/occupation-graph-seed-p4';
import { ensureOccupationGraphSeedP5, validateGraphIntegrity } from '../services/occupation-graph-seed-p5';
import { resolveCompetencyIntelligence } from '../services/competency-intelligence';
import { resolveLongitudinalIntelligence } from '../services/longitudinal-intelligence';
import { resolveComparativeIntelligence } from '../services/comparative-intelligence';

interface RegisterDeps {
  app: Express;
  pool: Pool;
  requireAuth: RequestHandler;
  requireSuperAdmin: RequestHandler;
}

function actor(req: Request) {
  const u = (req as any).user || {};
  return { id: u.id || u.userId || 'system', email: u.email || null };
}

export function registerEmployabilityGraphRoutes({ app, pool, requireAuth, requireSuperAdmin }: RegisterDeps) {
  const adminChain = [requireAuth, requireSuperAdmin];

  // ── P-R2: Idempotent occupation graph seed (runs once on startup) ───────
  ensureOccupationGraphSeed(pool)
    .then(({ skills, pathways }) => {
      if (skills + pathways > 0)
        console.log(`[occupation-graph-seed] inserted ${skills} skill mappings, ${pathways} pathway edges`);
    })
    .catch((e: Error) => console.warn('[occupation-graph-seed] seed skipped:', e.message));

  // ── P-R4: W6 expansion seed (runs once on startup, idempotent) ──────────
  ensureOccupationGraphSeedP4(pool)
    .then(({ skillsAdded, occupationsAdded, skillMappingsInserted, pathwaysInserted }) => {
      if (skillsAdded + occupationsAdded + skillMappingsInserted + pathwaysInserted > 0)
        console.log(`[occupation-graph-seed-p4] +${occupationsAdded} occ, +${skillsAdded} skills, +${skillMappingsInserted} mappings, +${pathwaysInserted} pathways`);
    })
    .catch((e: Error) => console.warn('[occupation-graph-seed-p4] seed skipped:', e.message));

  // ── P-R5: W5 expansion seed (runs once on startup, idempotent) ──────────
  ensureOccupationGraphSeedP5(pool)
    .then(({ skillsAdded, occupationsAdded, skillMappingsInserted, pathwaysInserted }) => {
      if (skillsAdded + occupationsAdded + skillMappingsInserted + pathwaysInserted > 0)
        console.log(`[occupation-graph-seed-p5] +${occupationsAdded} occ, +${skillsAdded} skills, +${skillMappingsInserted} mappings, +${pathwaysInserted} pathways`);
    })
    .catch((e: Error) => console.warn('[occupation-graph-seed-p5] seed skipped:', e.message));

  // ── User-facing ────────────────────────────────────────────────────────

  /**
   * GET /api/employability/role-skills?title=Senior+Product+Manager
   * Returns the occupation's canonical skills sorted by importance/weight.
   * No auth required — occupation skills are public reference data.
   * Used by the Career Brain to compute occupation-aware skill gaps client-side.
   */
  app.get('/api/employability/role-skills', async (req, res) => {
    try {
      const title = (req.query.title as string || '').trim();
      if (!title) return res.status(400).json({ ok: false, error: 'title required' });
      const occ = await pool.query(
        `SELECT id, canonical_title FROM occupations WHERE canonical_title ILIKE $1 AND is_active LIMIT 1`,
        [title],
      );
      if (!occ.rowCount) return res.json({ ok: true, occupation: null, skills: [] });
      const skills = await pool.query(
        `SELECT s.canonical_name, os.importance, os.proficiency_level, os.weight::float
           FROM occupation_skills os
           JOIN skills s ON s.id = os.skill_id
          WHERE os.occupation_id = $1
          ORDER BY (os.importance = 'essential') DESC, os.weight DESC`,
        [occ.rows[0].id],
      );
      res.json({ ok: true, occupation: occ.rows[0], skills: skills.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/employability/occupations', async (req, res) => {
    try {
      const family = req.query.family as string | undefined;
      const seniority = req.query.seniority as string | undefined;
      const q = req.query.q as string | undefined;
      const where: string[] = ['o.is_active'];
      const params: any[] = [];
      if (family)    { params.push(family);    where.push(`o.role_family = $${params.length}`); }
      if (seniority) { params.push(seniority); where.push(`o.seniority_level = $${params.length}`); }
      if (q)         { params.push(`%${q}%`);  where.push(`o.canonical_title ILIKE $${params.length}`); }
      const r = await pool.query(
        `SELECT o.id, o.canonical_title, o.role_family, o.seniority_level, o.esco_code, o.onet_code,
                (SELECT COUNT(*) FROM occupation_skills os WHERE os.occupation_id = o.id) AS skill_count
           FROM occupations o
          WHERE ${where.join(' AND ')}
          ORDER BY o.role_family NULLS LAST, o.canonical_title
          LIMIT 200`, params);
      res.json({ ok: true, occupations: r.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/employability/occupations/:id', async (req, res) => {
    try {
      const o = await pool.query(
        `SELECT o.*, array_agg(DISTINCT rf.code) AS role_family_codes
           FROM occupations o
           LEFT JOIN occupation_role_family orf ON orf.occupation_id = o.id
           LEFT JOIN role_families rf ON rf.id = orf.role_family_id
          WHERE o.id = $1 AND o.is_active
          GROUP BY o.id`, [req.params.id]);
      if (!o.rowCount) return res.status(404).json({ ok: false, error: 'not found' });
      const skills = await pool.query(
        `SELECT os.skill_id, s.canonical_name, os.importance, os.proficiency_level,
                os.weight::float, os.source, os.source_authority, os.evidence_ref, os.dataset_version
           FROM occupation_skills os
           JOIN skills s ON s.id = os.skill_id
          WHERE os.occupation_id = $1
          ORDER BY (os.importance='essential') DESC, os.weight DESC`, [req.params.id]);
      const market = await getMarketDemand(pool, req.params.id, (req.query.region as string) || 'IN');
      res.json({ ok: true, occupation: o.rows[0], skills: skills.rows, market });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/employability/occupations/:id/pathways', async (req, res) => {
    try {
      const out = await pool.query(
        `SELECT 'outgoing' AS direction, op.transition_type,
                op.typical_years_min::float, op.typical_years_max::float, op.common_gaps,
                op.source_authority, op.evidence_ref,
                t.id AS other_id, t.canonical_title AS other_title, t.seniority_level AS other_seniority
           FROM occupation_pathways op
           JOIN occupations t ON t.id = op.to_occupation_id
          WHERE op.is_active AND op.from_occupation_id = $1
         UNION ALL
         SELECT 'incoming', op.transition_type,
                op.typical_years_min::float, op.typical_years_max::float, op.common_gaps,
                op.source_authority, op.evidence_ref,
                f.id, f.canonical_title, f.seniority_level
           FROM occupation_pathways op
           JOIN occupations f ON f.id = op.from_occupation_id
          WHERE op.is_active AND op.to_occupation_id = $1
          ORDER BY 3 NULLS LAST`, [req.params.id]);
      res.json({ ok: true, pathways: out.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/employability/market/:occupationId', async (req, res) => {
    try {
      const region = (req.query.region as string) || 'IN';
      const m = await getMarketDemand(pool, req.params.occupationId, region);
      if (!m) return res.status(404).json({ ok: false, error: 'no market data for occupation/region' });
      res.json({ ok: true, market: m });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/employability/market', async (req, res) => {
    try {
      const region = (req.query.region as string) || 'IN';
      const rows = await listMarketDemands(pool, region);
      res.json({ ok: true, region, occupations: rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/employability/skill-adjacency/:skillId', async (req, res) => {
    try {
      const adj = await getAdjacentSkills(pool, req.params.skillId, 30);
      res.json({ ok: true, adjacent: adj });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  /**
   * POST /api/employability/role-fit
   * Body: { occupation_id, profile?: ResolverInput, experience_count?, region? }
   * Computes role-fit for the given profile against one occupation.
   */
  app.post('/api/employability/role-fit', async (req, res) => {
    try {
      const { occupation_id, profile, experience_count, region } = req.body || {};
      if (!occupation_id) return res.status(400).json({ ok: false, error: 'occupation_id required' });
      const ruleset = await getActiveRuleset(pool);
      const resolution = await resolveProfile(pool, (profile || {}) as ResolverInput);
      const userId = (req as any).user?.id || null;
      const fit = await computeRoleFit(pool, {
        occupation_id, resolution, experience_count,
        region: region || 'IN', user_id: userId,
        ruleset_version: ruleset.version,
      });
      res.json({
        ok: true, role_fit: fit, resolution,
        versions: {
          ei_version: '4.0', ruleset_version: ruleset.version,
          occupation_dataset_version: fit.occupation_dataset_version,
        },
      });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  /**
   * POST /api/employability/role-matches
   * Body: { profile?, experience_count?, region?, limit? }
   * Top-N best-fit occupations for the profile.
   */
  app.post('/api/employability/role-matches', async (req, res) => {
    try {
      const { profile, experience_count, region, limit } = req.body || {};
      const ruleset = await getActiveRuleset(pool);
      const resolution = await resolveProfile(pool, (profile || {}) as ResolverInput);
      const userId = (req as any).user?.id || null;
      const matches = await findTopRoleMatches(
        pool, resolution, experience_count || 0,
        Math.min(limit || 10, 25), region || 'IN', userId, ruleset.version,
      );
      res.json({
        ok: true, matches,
        versions: { ei_version: '4.0', ruleset_version: ruleset.version },
      });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  /**
   * POST /api/employability/trajectory
   * Body: { target_occupation_id, current_ei_score, profile?, experience_count?, time_horizon_months?, region? }
   */
  app.post('/api/employability/trajectory', async (req, res) => {
    try {
      const { target_occupation_id, current_ei_score, profile, experience_count, time_horizon_months, region } = req.body || {};
      const userId = (req as any).user?.id;
      if (!userId)                return res.status(401).json({ ok: false, error: 'authentication required' });
      if (!target_occupation_id)  return res.status(400).json({ ok: false, error: 'target_occupation_id required' });
      if (current_ei_score == null) return res.status(400).json({ ok: false, error: 'current_ei_score required' });
      const ruleset = await getActiveRuleset(pool);
      const resolution = await resolveProfile(pool, (profile || {}) as ResolverInput);
      const traj = await forecastTrajectory(pool, {
        user_id: userId,
        target_occupation_id,
        current_ei_score: Number(current_ei_score),
        resolution,
        experience_count,
        time_horizon_months: time_horizon_months || 12,
        region: region || 'IN',
        ruleset_version: ruleset.version,
      });
      res.json({
        ok: true, trajectory: traj,
        versions: {
          ei_version: '4.0', ruleset_version: ruleset.version,
          occupation_dataset_version: traj.occupation_dataset_version,
        },
      });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── W5 Explainability: GET /api/employability/explain/:userId ─────────
  /**
   * Returns a human-readable decomposition of a user's EI score:
   * dimension contributions, confidence assessment, and provenance chain.
   * Auth required — only the user themselves or a super-admin may query.
   */
  app.get('/api/employability/explain/:userId', requireAuth, async (req, res) => {
    try {
      const callerId = (req as any).user?.id || (req as any).user?.userId;
      const { userId } = req.params;
      if (callerId !== userId && !(req as any).user?.isSuperAdmin)
        return res.status(403).json({ ok: false, error: 'forbidden' });

      // Latest snapshot
      const snap = await pool.query(
        `SELECT capability_score, trusted_score, band, breakdown,
                profile_confidence_score, evidence_quality_score,
                uncertainty_flags, ruleset_version, ei_version,
                snapshot_date, source
           FROM ei_snapshot_versions
          WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 1`,
        [userId],
      ).catch(() => ({ rows: [] as any[] }));

      if (!snap.rows.length)
        return res.json({ ok: true, userId, explanation: null, message: 'No EI snapshot found for user. Score will be generated on next profile update.' });

      const s = snap.rows[0];
      const breakdown = (typeof s.breakdown === 'string' ? JSON.parse(s.breakdown) : s.breakdown) || {};
      const uncertaintyFlags = (typeof s.uncertainty_flags === 'string' ? JSON.parse(s.uncertainty_flags) : s.uncertainty_flags) || [];

      // Build per-dimension narrative
      const DIMENSION_DESCRIPTIONS: Record<string, string> = {
        assessment:          'Competency & assessment scores',
        experience:          'Work experience depth and relevance',
        education:           'Educational attainment and institution quality',
        technical_skills:    'Technical skills breadth and currency',
        certifications:      'Professional certifications',
        soft_skills:         'Soft skills and behavioural indicators',
        projects:            'Portfolio and project contributions',
        profile_completeness:'Profile completeness and data coverage',
      };

      const totalScore = Number(s.capability_score);
      const dimensions = Object.entries(breakdown).map(([key, value]) => {
        const score = Number(value) || 0;
        const pct = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
        return {
          dimension: key,
          score,
          contribution_pct: pct,
          description: DIMENSION_DESCRIPTIONS[key] || key.replace(/_/g, ' '),
          signal: score >= 15 ? 'strong' : score >= 8 ? 'developing' : 'needs_attention',
        };
      }).sort((a, b) => b.score - a.score);

      const confidenceScore = Number(s.profile_confidence_score) || 0;
      const evidenceQuality = Number(s.evidence_quality_score) || 0;

      res.json({
        ok: true,
        userId,
        explanation: {
          score: totalScore,
          trusted_score: s.trusted_score ? Number(s.trusted_score) : null,
          band: s.band,
          snapshot_date: s.snapshot_date,
          ei_version: s.ei_version,
          ruleset_version: s.ruleset_version,
          dimensions,
          confidence: {
            profile_confidence: confidenceScore,
            evidence_quality: evidenceQuality,
            grade: confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low',
            uncertainty_flags: uncertaintyFlags,
            interpretation: confidenceScore >= 75
              ? 'High-confidence score — sufficient verified data points across dimensions.'
              : confidenceScore >= 50
              ? 'Medium-confidence — some dimensions have limited evidence. Adding certifications or verified experience will improve confidence.'
              : 'Low-confidence — score is directional. Complete your profile and add verified credentials for a higher-confidence assessment.',
          },
          provenance: {
            source: s.source,
            ruleset_version: s.ruleset_version,
            generated_at: s.snapshot_date,
            note: 'Score is computed from your resolved profile against the active EI ruleset. No subjective judgment or hiring prediction is made.',
          },
          top_dimension: dimensions[0] || null,
          lowest_dimension: dimensions[dimensions.length - 1] || null,
          development_focus: dimensions.filter(d => d.signal === 'needs_attention').map(d => d.dimension),
        },
      });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Admin: KG edges ────────────────────────────────────────────────────
  app.get('/api/admin/kg/edges', ...adminChain, async (req, res) => {
    try {
      const filter = {
        from_type: req.query.from_type as KGEntityType | undefined,
        from_id:   req.query.from_id   as string | undefined,
        to_type:   req.query.to_type   as KGEntityType | undefined,
        to_id:     req.query.to_id     as string | undefined,
        edge_type: req.query.edge_type as KGEdgeType  | undefined,
        limit:     req.query.limit ? Number(req.query.limit) : undefined,
      };
      const edges = await listEdges(pool, filter);
      res.json({ ok: true, edges });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/admin/kg/edges', ...adminChain, async (req, res) => {
    try {
      const a = actor(req);
      const edge = req.body || {};
      const required = ['from_type', 'from_id', 'to_type', 'to_id', 'edge_type', 'weight', 'confidence'];
      for (const k of required) if (edge[k] == null) return res.status(400).json({ ok: false, error: `${k} required` });
      const saved = await upsertEdge(pool, {
        ...edge,
        source_authority: edge.source_authority || `admin:${a.email || a.id}`,
        evidence_ref: edge.evidence_ref || { upserted_by: a.id, upserted_at: new Date().toISOString() },
      });
      res.json({ ok: true, edge: saved });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/admin/kg/edges/:id', ...adminChain, async (req, res) => {
    try {
      const ok = await deactivateEdge(pool, req.params.id);
      if (!ok) return res.status(404).json({ ok: false, error: 'not found' });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Admin: occupation skills CRUD ──────────────────────────────────────
  app.get('/api/admin/occupations/:id/skills', ...adminChain, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT os.*, s.canonical_name FROM occupation_skills os
           JOIN skills s ON s.id = os.skill_id
          WHERE os.occupation_id = $1 ORDER BY (os.importance='essential') DESC, os.weight DESC`,
        [req.params.id]);
      res.json({ ok: true, occupation_skills: r.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/admin/occupations/:id/skills', ...adminChain, async (req, res) => {
    try {
      const a = actor(req);
      const { skill_id, importance, proficiency_level, weight, source, source_authority, evidence_ref, dataset_version } = req.body || {};
      if (!skill_id || !importance) return res.status(400).json({ ok: false, error: 'skill_id and importance required' });
      const r = await pool.query(
        `INSERT INTO occupation_skills
           (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority, evidence_ref, dataset_version)
         VALUES ($1,$2,$3, COALESCE($4,3), COALESCE($5,1.0), COALESCE($6,'curated'), $7, COALESCE($8::jsonb, '{}'::jsonb), COALESCE($9,'admin'))
         ON CONFLICT (occupation_id, skill_id) DO UPDATE SET
           importance = EXCLUDED.importance,
           proficiency_level = EXCLUDED.proficiency_level,
           weight = EXCLUDED.weight,
           source = EXCLUDED.source,
           source_authority = EXCLUDED.source_authority,
           evidence_ref = EXCLUDED.evidence_ref,
           dataset_version = EXCLUDED.dataset_version
         RETURNING *`,
        [
          req.params.id, skill_id, importance, proficiency_level, weight, source,
          source_authority || `admin:${a.email || a.id}`,
          JSON.stringify(evidence_ref || { upserted_by: a.id }),
          dataset_version,
        ]);
      res.json({ ok: true, occupation_skill: r.rows[0] });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Admin: calibration runs (storage + preview; never auto-applies) ────
  app.get('/api/admin/calibration/runs', ...adminChain, async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, ruleset_version, occupation_id, sample_size, optimization_method,
                applied, applied_at, applied_by, run_at, notes
           FROM weight_calibration_runs ORDER BY run_at DESC LIMIT 100`);
      res.json({ ok: true, runs: r.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  /**
   * Calibration preview — DETERMINISTIC ONLY. Computes summary statistics
   * (counts, conversion rates) from recruiter_interactions + interview_outcomes
   * + hiring_outcomes. Does NOT update any weights; does NOT call any ML.
   * Persists a `weight_calibration_runs` row marked `applied=false` so the
   * audit trail captures every preview.
   */
  app.post('/api/admin/calibration/preview', ...adminChain, async (req, res) => {
    try {
      const { occupation_id, notes } = req.body || {};
      const ruleset = await getActiveRuleset(pool);
      const stats = await pool.query(
        `SELECT
           COUNT(DISTINCT ri.user_id) FILTER (WHERE ri.occupation_id = $1)                       AS interaction_users,
           COUNT(*) FILTER (WHERE ri.interaction_type = 'shortlist' AND ri.occupation_id = $1)   AS shortlists,
           COUNT(*) FILTER (WHERE ri.interaction_type = 'interview_invite' AND ri.occupation_id = $1) AS interview_invites,
           (SELECT COUNT(*) FROM interview_outcomes io WHERE io.occupation_id = $1 AND io.outcome = 'offered') AS offers,
           (SELECT COUNT(*) FROM hiring_outcomes ho WHERE ho.occupation_id = $1)                 AS hires
           FROM recruiter_interactions ri`,
        [occupation_id || null]);
      const sample = Number(stats.rows[0].interaction_users || 0) + Number(stats.rows[0].hires || 0);
      const ins = await pool.query(
        `INSERT INTO weight_calibration_runs
           (ruleset_version, occupation_id, sample_size, optimization_method,
            before_weights, proposed_weights, validation_metrics, applied, notes)
         VALUES ($1, $2, $3, 'deterministic_grid', '{}'::jsonb, '{}'::jsonb, $4::jsonb, FALSE, $5)
         RETURNING *`,
        [ruleset.version, occupation_id || null, sample, JSON.stringify(stats.rows[0]), notes || null]);
      res.json({ ok: true, preview: ins.rows[0], stats: stats.rows[0] });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W1: GET /api/employability/competency-intelligence/:userId ───────
  /**
   * Returns a full competency intelligence profile for a user:
   * strengths, gaps, readiness, progression, trends, rec-mapping, pathway-mapping, trajectory-mapping.
   * Auth required — user themselves or super-admin.
   * Query: ?target=<occupation title> to compute gaps against a target role.
   */
  app.get('/api/employability/competency-intelligence/:userId', requireAuth, async (req, res) => {
    try {
      const callerId = (req as any).user?.id || (req as any).user?.userId;
      const { userId } = req.params;
      if (callerId !== userId && !(req as any).user?.isSuperAdmin)
        return res.status(403).json({ ok: false, error: 'forbidden' });

      const targetTitle = (req.query.target as string | undefined)?.trim() || undefined;
      const profile = await resolveCompetencyIntelligence(pool, userId, targetTitle);
      res.json({ ok: true, profile });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W3: GET /api/employability/longitudinal/:userId ──────────────────
  /**
   * Returns the longitudinal intelligence profile for a user:
   * EI progression deltas, competency trends, growth momentum, trajectory alignment,
   * trend narrative, comparative intelligence (k-anonymity: cohort < 30 → suppressed).
   * Auth required — user themselves or super-admin.
   */
  app.get('/api/employability/longitudinal/:userId', requireAuth, async (req, res) => {
    try {
      const callerId = (req as any).user?.id || (req as any).user?.userId;
      const { userId } = req.params;
      if (callerId !== userId && !(req as any).user?.isSuperAdmin)
        return res.status(403).json({ ok: false, error: 'forbidden' });

      const longitudinal = await resolveLongitudinalIntelligence(pool, userId);
      res.json({ ok: true, longitudinal });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W3: GET /api/employability/comparative/:userId ──────────────────
  /**
   * Returns the comparative intelligence profile for a user:
   * peer comparison, percentile rank, cohort/occupation/competency/readiness benchmarking.
   * k-anonymity: all outputs suppressed when cohort < k_min (30).
   * Auth required — user themselves or super-admin.
   */
  app.get('/api/employability/comparative/:userId', requireAuth, async (req, res) => {
    try {
      const callerId = (req as any).user?.id || (req as any).user?.userId;
      const { userId } = req.params;
      if (callerId !== userId && !(req as any).user?.isSuperAdmin)
        return res.status(403).json({ ok: false, error: 'forbidden' });

      const comparative = await resolveComparativeIntelligence(pool, userId);
      res.json({ ok: true, comparative });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W5: GET /api/employability/graph-integrity ─────────────────────
  /**
   * Returns graph integrity report: orphan occupations/skills, broken pathways,
   * avg skills per occupation, confidence scoring.
   * Super-admin only.
   */
  app.get('/api/employability/graph-integrity', ...adminChain, async (req, res) => {
    try {
      const report = await validateGraphIntegrity(pool);
      res.json({ ok: true, report });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

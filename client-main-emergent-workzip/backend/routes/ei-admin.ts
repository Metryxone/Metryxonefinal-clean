/**
 * EI Admin Routes — P-R3A
 *
 * Provides SuperAdmin intelligence into the Employability Index system state:
 *
 *   GET  /api/admin/ei/health           — occupation/skill/pathway/snapshot/UCIP health
 *   GET  /api/admin/ei/events/summary   — analytics summary of EI product usage
 *   POST /api/ei/events                 — log an EI product usage event (user-facing, auth required)
 *   GET  /api/admin/ei/data-quality     — orphan occupations, unlinked skills, missing pathways
 *
 * All admin routes: requireAuth + requireSuperAdmin, 60s cache, ?refresh=1 busts.
 * Event schema is lazily created on first POST.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';

export const EI_ADMIN_VERSION = '2.0.0';

let schemaEnsured = false;
async function ensureEIEventsSchema(pool: Pool) {
  if (schemaEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ei_events (
      id          BIGSERIAL PRIMARY KEY,
      user_id     TEXT,
      event_type  TEXT NOT NULL,
      entity_type TEXT,
      entity_id   TEXT,
      meta        JSONB DEFAULT '{}',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ei_events_type_ts ON ei_events (event_type, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ei_events_user ON ei_events (user_id, created_at DESC) WHERE user_id IS NOT NULL`);
  schemaEnsured = true;
}

interface RegisterDeps {
  app: Express;
  pool: Pool;
  requireAuth: RequestHandler;
  requireSuperAdmin: RequestHandler;
}

const CACHE: Map<string, { data: unknown; ts: number }> = new Map();
const TTL = 60_000;
function cached(key: string, bust: boolean, fn: () => Promise<unknown>) {
  if (!bust && CACHE.has(key) && Date.now() - CACHE.get(key)!.ts < TTL)
    return Promise.resolve(CACHE.get(key)!.data);
  return fn().then(d => { CACHE.set(key, { data: d, ts: Date.now() }); return d; });
}

export function registerEIAdminRoutes({ app, pool, requireAuth, requireSuperAdmin }: RegisterDeps) {
  const adminChain = [requireAuth, requireSuperAdmin];

  // ── POST /api/ei/events — user-facing event logging ────────────────────────
  app.post('/api/ei/events', requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureEIEventsSchema(pool);
      const userId = (req as any).user?.id || (req as any).user?.userId || null;
      const { event_type, entity_type, entity_id, meta } = req.body || {};
      if (!event_type || typeof event_type !== 'string')
        return res.status(400).json({ ok: false, error: 'event_type required' });

      const ALLOWED_EVENTS = new Set([
        'report_viewed', 'recommendation_viewed', 'recommendation_clicked',
        'occupation_explored', 'pathway_explored', 'competency_explored',
        'action_completed', 'trajectory_opened', 'snapshot_taken',
        'skill_gap_viewed', 'role_fit_computed', 'passport_shared',
      ]);
      if (!ALLOWED_EVENTS.has(event_type))
        return res.status(400).json({ ok: false, error: `unknown event_type: ${event_type}` });

      await pool.query(
        `INSERT INTO ei_events (user_id, event_type, entity_type, entity_id, meta)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, event_type, entity_type || null, entity_id || null, JSON.stringify(meta || {})],
      );
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── GET /api/admin/ei/health ────────────────────────────────────────────────
  app.get('/api/admin/ei/health', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:health', bust, async () => {
        const [occ, skills, pathways, snapshots, ucip, events] = await Promise.all([
          pool.query(`
            SELECT
              COUNT(*)::int  AS total,
              COUNT(*) FILTER (WHERE is_active)::int AS active,
              COUNT(DISTINCT role_family)::int AS families,
              COUNT(DISTINCT seniority_level)::int AS seniority_bands,
              COUNT(*) FILTER (WHERE esco_code IS NOT NULL)::int AS esco_linked,
              COUNT(*) FILTER (WHERE onet_code  IS NOT NULL)::int AS onet_linked
            FROM occupations`
          ),
          pool.query(`
            SELECT
              COUNT(*)::int AS total_skills,
              COUNT(DISTINCT os.skill_id)::int AS skills_in_use,
              COUNT(*)::int AS total_mappings,
              ROUND(AVG(cnt),1) AS avg_skills_per_occ
            FROM occupation_skills os,
                 LATERAL (SELECT COUNT(*) AS cnt FROM occupation_skills WHERE occupation_id = os.occupation_id) sc,
                 (SELECT 1) x
            LIMIT 1`
          ).catch(() => pool.query(`
            SELECT
              (SELECT COUNT(*)::int FROM skills WHERE is_active) AS total_skills,
              (SELECT COUNT(DISTINCT skill_id)::int FROM occupation_skills) AS skills_in_use,
              (SELECT COUNT(*)::int FROM occupation_skills) AS total_mappings,
              (SELECT ROUND(AVG(cnt),1) FROM (SELECT COUNT(*)::int cnt FROM occupation_skills GROUP BY occupation_id) t) AS avg_skills_per_occ`
          )),
          pool.query(`
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE is_active)::int AS active,
              COUNT(DISTINCT from_occupation_id)::int AS origins,
              COUNT(DISTINCT to_occupation_id)::int AS destinations,
              COUNT(*) FILTER (WHERE transition_type='progression')::int AS progressions,
              COUNT(*) FILTER (WHERE transition_type='lateral')::int AS laterals,
              COUNT(*) FILTER (WHERE transition_type='pivot')::int AS pivots
            FROM occupation_pathways`
          ),
          pool.query(`
            SELECT
              COUNT(*)::int AS total,
              COUNT(DISTINCT user_id)::int AS users_covered,
              MAX(created_at) AS latest,
              MIN(created_at) AS earliest
            FROM ei_snapshot_versions`
          ).catch(() => ({ rows: [{ total: 0, users_covered: 0, latest: null, earliest: null }] })),
          pool.query(`
            SELECT COUNT(*)::int AS total, COUNT(DISTINCT user_id)::int AS users_covered
            FROM ucip_profiles`
          ).catch(() => ({ rows: [{ total: 0, users_covered: 0 }] })),
          ensureEIEventsSchema(pool).then(() => pool.query(`
            SELECT COUNT(*)::int AS total_events,
                   COUNT(DISTINCT user_id)::int AS active_users,
                   COUNT(*) FILTER (WHERE event_type='report_viewed')::int AS reports_viewed,
                   COUNT(*) FILTER (WHERE event_type='recommendation_viewed')::int AS recs_viewed,
                   COUNT(*) FILTER (WHERE event_type='occupation_explored')::int AS occs_explored
            FROM ei_events WHERE created_at >= NOW() - INTERVAL '30 days'`
          )).catch(() => ({ rows: [{ total_events: 0, active_users: 0, reports_viewed: 0, recs_viewed: 0, occs_explored: 0 }] })),
        ]);

        const occupationRow = occ.rows[0];
        const skillRow = skills.rows[0];
        const pathRow = pathways.rows[0];
        const snapRow = snapshots.rows[0];
        const ucipRow = ucip.rows[0];
        const evtRow = events.rows[0];

        // W9 target checks (honest — targets are aspirational data goals)
        const W9_TARGETS = { occupations: 300, skills: 1000, pathways: 200 };
        const dataReadiness = {
          occupations: {
            current: occupationRow.active,
            target: W9_TARGETS.occupations,
            pct: Math.round((occupationRow.active / W9_TARGETS.occupations) * 100),
            status: occupationRow.active >= W9_TARGETS.occupations ? 'PASS' : 'GAP',
          },
          skills: {
            current: skillRow.total_skills,
            target: W9_TARGETS.skills,
            pct: Math.round((skillRow.total_skills / W9_TARGETS.skills) * 100),
            status: skillRow.total_skills >= W9_TARGETS.skills ? 'PASS' : 'GAP',
          },
          pathways: {
            current: pathRow.active,
            target: W9_TARGETS.pathways,
            pct: Math.round((pathRow.active / W9_TARGETS.pathways) * 100),
            status: pathRow.active >= W9_TARGETS.pathways ? 'PASS' : 'GAP',
          },
        };

        return {
          version: EI_ADMIN_VERSION,
          generated_at: new Date().toISOString(),
          occupation_graph: occupationRow,
          skills: skillRow,
          pathways: pathRow,
          snapshots: snapRow,
          ucip_profiles: ucipRow,
          events_30d: evtRow,
          data_readiness: dataReadiness,
          overall_data_readiness_pct: Math.round(
            (dataReadiness.occupations.pct + dataReadiness.skills.pct + dataReadiness.pathways.pct) / 3,
          ),
        };
      });
      res.json({ ok: true, health: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── GET /api/admin/ei/events/summary ───────────────────────────────────────
  app.get('/api/admin/ei/events/summary', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:events:summary', bust, async () => {
        await ensureEIEventsSchema(pool);
        const [daily, byType, topUsers] = await Promise.all([
          pool.query(`
            SELECT
              DATE_TRUNC('day', created_at)::date AS day,
              COUNT(*)::int AS events,
              COUNT(DISTINCT user_id)::int AS users
            FROM ei_events
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY 1 ORDER BY 1 ASC`
          ),
          pool.query(`
            SELECT event_type, COUNT(*)::int AS count
            FROM ei_events
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY event_type ORDER BY count DESC`
          ),
          pool.query(`
            SELECT user_id, COUNT(*)::int AS events
            FROM ei_events
            WHERE created_at >= NOW() - INTERVAL '30 days' AND user_id IS NOT NULL
            GROUP BY user_id ORDER BY events DESC LIMIT 10`
          ),
        ]);
        return {
          period: '30 days',
          daily_activity: daily.rows,
          by_event_type: byType.rows,
          top_users: topUsers.rows.map(r => ({ user_id: r.user_id.slice(0, 8) + '…', events: r.events })),
        };
      });
      res.json({ ok: true, summary: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── GET /api/admin/ei/data-quality ─────────────────────────────────────────
  app.get('/api/admin/ei/data-quality', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:data-quality', bust, async () => {
        const [orphanOcc, orphanSkills, noPath, multiPath] = await Promise.all([
          // Occupations with zero skill mappings
          pool.query(`
            SELECT o.canonical_title, o.role_family, o.seniority_level
            FROM occupations o
            LEFT JOIN occupation_skills os ON os.occupation_id = o.id
            WHERE o.is_active AND os.id IS NULL
            ORDER BY o.canonical_title LIMIT 50`
          ),
          // Skills not linked to any occupation
          pool.query(`
            SELECT s.canonical_name, s.domain
            FROM skills s
            LEFT JOIN occupation_skills os ON os.skill_id = s.id
            WHERE s.is_active AND os.id IS NULL
            ORDER BY s.canonical_name LIMIT 50`
          ),
          // Occupations with no outbound pathway
          pool.query(`
            SELECT o.canonical_title, o.role_family, o.seniority_level
            FROM occupations o
            LEFT JOIN occupation_pathways op ON op.from_occupation_id = o.id AND op.is_active
            WHERE o.is_active AND op.id IS NULL
            ORDER BY o.canonical_title LIMIT 50`
          ),
          // Occupations with 5+ outbound pathways (unusual density)
          pool.query(`
            SELECT o.canonical_title, COUNT(*)::int AS pathway_count
            FROM occupations o
            JOIN occupation_pathways op ON op.from_occupation_id = o.id AND op.is_active
            WHERE o.is_active
            GROUP BY o.id, o.canonical_title HAVING COUNT(*) >= 5
            ORDER BY pathway_count DESC LIMIT 20`
          ),
        ]);
        return {
          orphan_occupations: orphanOcc.rows,
          unlinked_skills: orphanSkills.rows,
          no_outbound_pathway: noPath.rows,
          high_density_pathways: multiPath.rows,
          summary: {
            orphan_occ_count: orphanOcc.rowCount,
            unlinked_skill_count: orphanSkills.rowCount,
            no_outbound_count: noPath.rowCount,
          },
        };
      });
      res.json({ ok: true, quality: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W7: GET /api/admin/ei/competency-analytics ──────────────────────
  app.get('/api/admin/ei/competency-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:competency-analytics', bust, async () => {
        const [coverage, topCompetencies, gapDist, scoreDist] = await Promise.all([
          // Coverage: how many users have competency scores
          pool.query(`
            SELECT
              COUNT(DISTINCT user_id)::int AS users_with_scores,
              COUNT(DISTINCT competency_id)::int AS competencies_assessed,
              AVG(score)::float AS avg_score,
              AVG(confidence)::float AS avg_confidence
            FROM user_competency_scores`
          ).catch(() => ({ rows: [{ users_with_scores: 0, competencies_assessed: 0, avg_score: null, avg_confidence: null }] })),
          // Top competencies by coverage
          pool.query(`
            SELECT cl.canonical_name, COUNT(ucs.user_id)::int AS user_count,
                   AVG(ucs.score)::float AS avg_score,
                   COALESCE(cc.cluster_name,'general') AS cluster
            FROM user_competency_scores ucs
            JOIN competency_library cl ON cl.id = ucs.competency_id
            LEFT JOIN competency_clusters cc ON cc.id = cl.cluster_id
            GROUP BY cl.canonical_name, cc.cluster_name
            ORDER BY user_count DESC LIMIT 10`
          ).catch(() => ({ rows: [] })),
          // Gap distribution from mobility_competency_gaps
          pool.query(`
            SELECT
              CASE WHEN (user_score - target_score) < -30 THEN 'critical'
                   WHEN (user_score - target_score) < -20 THEN 'significant'
                   WHEN (user_score - target_score) < -10 THEN 'moderate'
                   ELSE 'minor' END AS severity,
              COUNT(*)::int AS count
            FROM mobility_competency_gaps
            GROUP BY 1 ORDER BY count DESC`
          ).catch(() => ({ rows: [] })),
          // Score distribution (decile buckets)
          pool.query(`
            SELECT
              (FLOOR(score / 10) * 10)::int AS score_bucket,
              COUNT(*)::int AS count
            FROM user_competency_scores
            GROUP BY 1 ORDER BY 1`
          ).catch(() => ({ rows: [] })),
        ]);
        return {
          coverage: coverage.rows[0],
          top_competencies: topCompetencies.rows.map(r => ({
            ...r, avg_score: r.avg_score !== null ? Math.round(r.avg_score) : null,
          })),
          gap_distribution: gapDist.rows,
          score_distribution: scoreDist.rows,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W7: GET /api/admin/ei/recommendation-analytics ──────────────────
  app.get('/api/admin/ei/recommendation-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:rec-analytics', bust, async () => {
        const [snapshots, mobilityDist, pathwayCoverage] = await Promise.all([
          pool.query(`
            SELECT
              COUNT(*)::int AS total_snapshots,
              COUNT(DISTINCT user_id)::int AS users_with_snapshots,
              AVG(ei_score)::float AS avg_ei_score,
              MIN(ei_score)::float AS min_ei_score,
              MAX(ei_score)::float AS max_ei_score
            FROM ei_snapshot_versions`
          ).catch(() => ({ rows: [{}] })),
          // EI band distribution
          pool.query(`
            SELECT band, COUNT(*)::int AS count
            FROM (
              SELECT DISTINCT ON (user_id) user_id, band
              FROM ei_snapshot_versions ORDER BY user_id, created_at DESC
            ) latest
            GROUP BY band ORDER BY count DESC`
          ).catch(() => ({ rows: [] })),
          // Pathway coverage
          pool.query(`
            SELECT
              COUNT(*)::int AS total_pathways,
              COUNT(*) FILTER (WHERE is_active)::int AS active_pathways,
              COUNT(DISTINCT from_occupation_id)::int AS origin_occupations
            FROM occupation_pathways`
          ).catch(() => ({ rows: [{}] })),
        ]);
        return {
          ei_snapshot_summary: snapshots.rows[0],
          ei_band_distribution: mobilityDist.rows,
          pathway_coverage: pathwayCoverage.rows[0],
          version: EI_ADMIN_VERSION,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W7: GET /api/admin/ei/trajectory-analytics ──────────────────────
  app.get('/api/admin/ei/trajectory-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:trajectory-analytics', bust, async () => {
        const [longitudinal, forecasts, snapCoverage] = await Promise.all([
          pool.query(`
            SELECT
              COUNT(DISTINCT user_id)::int AS users_with_longitudinal,
              COUNT(*)::int AS total_snapshots,
              AVG(snapshot_count)::float AS avg_snapshots_per_user
            FROM (
              SELECT user_id, COUNT(*) AS snapshot_count
              FROM ei_snapshot_versions GROUP BY user_id
            ) sub`
          ).catch(() => ({ rows: [{}] })),
          pool.query(`
            SELECT COUNT(DISTINCT user_id)::int AS users_with_forecasts,
                   COUNT(*)::int AS total_forecasts
            FROM competency_forecasts`
          ).catch(() => ({ rows: [{}] })),
          // Repeat snapshots (users with 2+ assessments = longitudinal capable)
          pool.query(`
            SELECT
              SUM(CASE WHEN cnt >= 3 THEN 1 ELSE 0 END)::int AS users_3plus_snapshots,
              SUM(CASE WHEN cnt = 2 THEN 1 ELSE 0 END)::int AS users_2_snapshots,
              SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END)::int AS users_1_snapshot
            FROM (SELECT user_id, COUNT(*) AS cnt FROM ei_snapshot_versions GROUP BY user_id) s`
          ).catch(() => ({ rows: [{}] })),
        ]);
        return {
          longitudinal_summary: longitudinal.rows[0],
          forecast_summary: forecasts.rows[0],
          snapshot_coverage: snapCoverage.rows[0],
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W7: GET /api/admin/ei/resolver-analytics ───────────────────────
  app.get('/api/admin/ei/resolver-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:resolver-analytics', bust, async () => {
        const [occStats, skillStats, familyDist, seniorityDist] = await Promise.all([
          pool.query(`
            SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active,
                   COUNT(DISTINCT role_family)::int AS families,
                   COUNT(DISTINCT seniority_level)::int AS seniority_bands,
                   COUNT(*) FILTER (WHERE esco_code IS NOT NULL)::int AS esco_linked,
                   COUNT(*) FILTER (WHERE onet_code IS NOT NULL)::int AS onet_linked
            FROM occupations`
          ).catch(() => ({ rows: [{}] })),
          pool.query(`
            SELECT COUNT(*)::int AS total_skills,
                   COUNT(DISTINCT skill_category)::int AS categories,
                   AVG(market_demand_score)::float AS avg_demand,
                   AVG(future_relevance_score)::float AS avg_future
            FROM skills WHERE is_active`
          ).catch(() => ({ rows: [{}] })),
          pool.query(`
            SELECT role_family, COUNT(*)::int AS count
            FROM occupations WHERE is_active GROUP BY role_family ORDER BY count DESC`
          ).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT seniority_level, COUNT(*)::int AS count
            FROM occupations WHERE is_active GROUP BY seniority_level ORDER BY count DESC`
          ).catch(() => ({ rows: [] })),
        ]);
        return {
          occupation_stats: occStats.rows[0],
          skill_stats: skillStats.rows[0],
          family_distribution: familyDist.rows,
          seniority_distribution: seniorityDist.rows,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R4 W5: GET /api/admin/ei/consistency-check ─────────────────────────
  /**
   * Validates internal consistency across EI components:
   * - EI snapshots vs competency scores alignment
   * - Pathway chain integrity (from-to occupation existence)
   * - Skill mapping completeness per occupation
   * - Recommendation provenance completeness
   */
  app.get('/api/admin/ei/consistency-check', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:consistency-check', bust, async () => {
        const [
          snapshotVsScore, pathwayIntegrity, skillGaps,
          unclaimedScores, orphanPaths,
        ] = await Promise.all([
          // Users with EI snapshots but no competency scores (layer gap)
          pool.query(`
            SELECT COUNT(DISTINCT esv.user_id)::int AS ei_only_no_competency
            FROM ei_snapshot_versions esv
            LEFT JOIN user_competency_scores ucs ON ucs.user_id = esv.user_id
            WHERE ucs.user_id IS NULL`
          ).catch(() => ({ rows: [{ ei_only_no_competency: 0 }] })),
          // Pathways referencing non-existent occupations
          pool.query(`
            SELECT COUNT(*)::int AS broken_pathways
            FROM occupation_pathways op
            WHERE NOT EXISTS (SELECT 1 FROM occupations f WHERE f.id = op.from_occupation_id)
               OR NOT EXISTS (SELECT 1 FROM occupations t WHERE t.id = op.to_occupation_id)`
          ).catch(() => ({ rows: [{ broken_pathways: 0 }] })),
          // Occupations with < 3 skill mappings (likely under-configured)
          pool.query(`
            SELECT COUNT(*)::int AS under_mapped_occupations
            FROM occupations o
            WHERE o.is_active AND (
              SELECT COUNT(*) FROM occupation_skills os WHERE os.occupation_id = o.id
            ) < 3`
          ).catch(() => ({ rows: [{ under_mapped_occupations: 0 }] })),
          // Users with competency scores but no EI snapshot (score-only, no composite)
          pool.query(`
            SELECT COUNT(DISTINCT ucs.user_id)::int AS score_only_no_snapshot
            FROM user_competency_scores ucs
            LEFT JOIN ei_snapshot_versions esv ON esv.user_id = ucs.user_id
            WHERE esv.user_id IS NULL`
          ).catch(() => ({ rows: [{ score_only_no_snapshot: 0 }] })),
          // Self-referential pathways (from = to)
          pool.query(`
            SELECT COUNT(*)::int AS self_referential_pathways
            FROM occupation_pathways
            WHERE from_occupation_id = to_occupation_id`
          ).catch(() => ({ rows: [{ self_referential_pathways: 0 }] })),
        ]);

        const checks = {
          ei_snapshots_without_competency_scores: snapshotVsScore.rows[0].ei_only_no_competency,
          broken_pathway_references: pathwayIntegrity.rows[0].broken_pathways,
          under_mapped_occupations: skillGaps.rows[0].under_mapped_occupations,
          scores_without_ei_snapshot: unclaimedScores.rows[0].score_only_no_snapshot,
          self_referential_pathways: orphanPaths.rows[0].self_referential_pathways,
        };

        const totalIssues = Object.values(checks).reduce((s, v) => s + Number(v), 0);
        const status: 'clean' | 'warnings' | 'issues' =
          totalIssues === 0 ? 'clean'
          : totalIssues <= 5 ? 'warnings'
          : 'issues';

        return {
          status,
          total_issues: totalIssues,
          checks,
          interpretation: {
            ei_snapshots_without_competency_scores: 'Users who have an EI composite but no underlying competency evidence — score relies on other dimensions only.',
            broken_pathway_references: 'Pathway rows referencing occupations that no longer exist — should be 0.',
            under_mapped_occupations: 'Active occupations with fewer than 3 skills mapped — may produce poor role-fit results.',
            scores_without_ei_snapshot: 'Users with raw competency scores but no EI composite yet — will resolve on next EI recalculation.',
            self_referential_pathways: 'Pathways pointing to themselves — data error, should be 0.',
          },
          generated_at: new Date().toISOString(),
          version: EI_ADMIN_VERSION,
        };
      });
      res.json({ ok: true, consistency: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W7: GET /api/admin/ei/trend-analytics ───────────────────────────
  app.get('/api/admin/ei/trend-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:trend-analytics', bust, async () => {
        const [weekly, monthly, bandDist, growth] = await Promise.all([
          pool.query(`
            SELECT DATE_TRUNC('week', created_at) AS week,
                   COUNT(DISTINCT user_id)::int AS users,
                   AVG(ei_score)::float AS avg_score,
                   MIN(ei_score)::float AS min_score,
                   MAX(ei_score)::float AS max_score
            FROM ei_snapshot_versions
            WHERE created_at >= NOW() - INTERVAL '12 weeks'
            GROUP BY 1 ORDER BY 1 DESC LIMIT 12
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT DATE_TRUNC('month', created_at) AS month,
                   COUNT(DISTINCT user_id)::int AS users,
                   AVG(ei_score)::float AS avg_score,
                   COUNT(*)::int AS snapshots
            FROM ei_snapshot_versions
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY 1 ORDER BY 1 DESC LIMIT 6
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT band, COUNT(DISTINCT user_id)::int AS users
            FROM (
              SELECT DISTINCT ON (user_id) user_id, band
              FROM ei_snapshot_versions ORDER BY user_id, created_at DESC
            ) latest
            GROUP BY band ORDER BY users DESC
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT COUNT(*)::int AS improving_users
            FROM (
              SELECT user_id,
                MAX(ei_score) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS recent,
                MAX(ei_score) FILTER (WHERE created_at < NOW()-INTERVAL '30 days') AS older
              FROM ei_snapshot_versions GROUP BY user_id
              HAVING MAX(ei_score) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days')
                   > MAX(ei_score) FILTER (WHERE created_at < NOW()-INTERVAL '30 days')
            ) g
          `).catch(() => ({ rows: [{ improving_users: 0 }] })),
        ]);
        return {
          weekly_trend: weekly.rows,
          monthly_trend: monthly.rows,
          band_distribution: bandDist.rows,
          improving_users_30d: growth.rows[0]?.improving_users ?? 0,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W7: GET /api/admin/ei/cohort-analytics ──────────────────────────
  app.get('/api/admin/ei/cohort-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:cohort-analytics', bust, async () => {
        const [bySeniority, byDomain, byBand, topOcc] = await Promise.all([
          pool.query(`
            SELECT COALESCE(csp.data->>'seniority_level','unknown') AS seniority,
                   COUNT(DISTINCT esv.user_id)::int AS users,
                   AVG(esv.ei_score)::float AS avg_ei
            FROM (
              SELECT DISTINCT ON (user_id) user_id, ei_score
              FROM ei_snapshot_versions ORDER BY user_id, created_at DESC
            ) esv
            LEFT JOIN career_seeker_profiles csp ON csp.user_id = esv.user_id
            GROUP BY 1 ORDER BY users DESC LIMIT 10
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT COALESCE(csp.data->>'target_domain', csp.data->>'domain','unknown') AS domain,
                   COUNT(DISTINCT esv.user_id)::int AS users,
                   AVG(esv.ei_score)::float AS avg_ei
            FROM (
              SELECT DISTINCT ON (user_id) user_id, ei_score
              FROM ei_snapshot_versions ORDER BY user_id, created_at DESC
            ) esv
            LEFT JOIN career_seeker_profiles csp ON csp.user_id = esv.user_id
            GROUP BY 1 ORDER BY users DESC LIMIT 10
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT band, COUNT(*)::int AS users, AVG(ei_score)::float AS avg_score
            FROM (
              SELECT DISTINCT ON (user_id) user_id, ei_score, band
              FROM ei_snapshot_versions ORDER BY user_id, created_at DESC
            ) l GROUP BY band ORDER BY avg_score DESC
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT COALESCE(csp.data->>'target_occupation', csp.data->>'target_role','unknown') AS occupation,
                   COUNT(DISTINCT esv.user_id)::int AS users
            FROM (
              SELECT DISTINCT ON (user_id) user_id, ei_score
              FROM ei_snapshot_versions ORDER BY user_id, created_at DESC
            ) esv
            LEFT JOIN career_seeker_profiles csp ON csp.user_id = esv.user_id
            GROUP BY 1 ORDER BY users DESC LIMIT 10
          `).catch(() => ({ rows: [] })),
        ]);
        return {
          by_seniority: bySeniority.rows,
          by_domain: byDomain.rows,
          by_band: byBand.rows,
          top_target_occupations: topOcc.rows,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W7: GET /api/admin/ei/pathway-analytics ─────────────────────────
  app.get('/api/admin/ei/pathway-analytics', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:pathway-analytics', bust, async () => {
        const [coverage, topPaths, domainStats, diffDist] = await Promise.all([
          pool.query(`
            SELECT COUNT(*)::int AS total_pathways,
                   COUNT(*) FILTER (WHERE is_active)::int AS active_pathways,
                   COUNT(DISTINCT from_occupation_id)::int AS origin_occupations,
                   COUNT(DISTINCT to_occupation_id)::int AS destination_occupations,
                   AVG(difficulty_score)::float AS avg_difficulty,
                   AVG(estimated_timeframe_months)::float AS avg_timeframe_months
            FROM occupation_pathways
          `).catch(() => ({ rows: [{}] })),
          pool.query(`
            SELECT o_from.canonical_title AS from_role, o_to.canonical_title AS to_role,
                   op.pathway_type, op.difficulty_score::int, op.estimated_timeframe_months::int
            FROM occupation_pathways op
            JOIN occupations o_from ON o_from.id = op.from_occupation_id
            JOIN occupations o_to ON o_to.id = op.to_occupation_id
            WHERE op.is_active ORDER BY op.difficulty_score ASC LIMIT 20
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT o_from.role_family AS domain,
                   COUNT(*)::int AS pathway_count,
                   AVG(op.difficulty_score)::float AS avg_difficulty
            FROM occupation_pathways op
            JOIN occupations o_from ON o_from.id = op.from_occupation_id
            WHERE op.is_active GROUP BY 1 ORDER BY pathway_count DESC LIMIT 10
          `).catch(() => ({ rows: [] })),
          pool.query(`
            SELECT difficulty_score::int AS difficulty, COUNT(*)::int AS count
            FROM occupation_pathways WHERE is_active GROUP BY 1 ORDER BY 1
          `).catch(() => ({ rows: [] })),
        ]);
        return {
          coverage: coverage.rows[0],
          top_pathways: topPaths.rows,
          by_domain: domainStats.rows,
          difficulty_distribution: diffDist.rows,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, analytics: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W7: GET /api/admin/ei/intelligence-health ───────────────────────
  app.get('/api/admin/ei/intelligence-health', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:intelligence-health', bust, async () => {
        const [compHealth, longHealth, recHealth, comparativeHealth] = await Promise.all([
          pool.query(`
            SELECT COUNT(DISTINCT user_id)::int AS users_with_scores,
                   AVG(score)::float AS avg_score, MAX(updated_at)::text AS last_updated
            FROM user_competency_scores
          `).catch(() => ({ rows: [{}] })),
          pool.query(`
            SELECT COUNT(DISTINCT user_id)::int AS users_tracked,
                   AVG(score)::float AS avg_progress
            FROM p4_competency_history
          `).catch(() => ({ rows: [{}] })),
          pool.query(`
            SELECT COUNT(*)::int AS total_events,
                   COUNT(DISTINCT user_id)::int AS users_with_recs
            FROM ei_events WHERE event_type LIKE '%recommendation%'
              AND created_at >= NOW() - INTERVAL '30 days'
          `).catch(() => ({ rows: [{ total_events: 0, users_with_recs: 0 }] })),
          pool.query(`
            SELECT COUNT(DISTINCT user_id)::int AS users_in_ei,
                   COUNT(*) FILTER (WHERE COUNT > 1)::int AS multi_snapshot_users
            FROM (
              SELECT user_id, COUNT(*)::int AS count
              FROM ei_snapshot_versions GROUP BY user_id
            ) s
          `).catch(() => ({ rows: [{}] })),
        ]);

        const checks = {
          competency_intelligence: {
            status: (compHealth.rows[0]?.users_with_scores ?? 0) > 0 ? 'active' : 'no_data',
            users_with_scores: compHealth.rows[0]?.users_with_scores ?? 0,
            avg_score: compHealth.rows[0]?.avg_score ?? null,
            last_updated: compHealth.rows[0]?.last_updated ?? null,
            version: '2.0.0',
          },
          longitudinal_intelligence: {
            status: (longHealth.rows[0]?.users_tracked ?? 0) > 0 ? 'active' : 'no_data',
            users_tracked: longHealth.rows[0]?.users_tracked ?? 0,
            version: '2.0.0',
          },
          recommendation_intelligence: {
            status: (recHealth.rows[0]?.total_events ?? 0) > 0 ? 'active' : 'no_data',
            events_30d: recHealth.rows[0]?.total_events ?? 0,
            users_with_recs: recHealth.rows[0]?.users_with_recs ?? 0,
            version: '5.0.0',
          },
          comparative_intelligence: {
            status: 'active',
            k_min: 30,
            users_in_pool: comparativeHealth.rows[0]?.users_in_ei ?? 0,
            version: '1.0.0',
          },
        };
        return {
          checks,
          overall_health: Object.values(checks).every(c => c.status === 'active') ? 'healthy'
            : Object.values(checks).some(c => c.status === 'active') ? 'partial' : 'initialising',
          generated_at: new Date().toISOString(),
          version: EI_ADMIN_VERSION,
        };
      });
      res.json({ ok: true, health: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R6: GET /api/admin/ei/intelligence-v2 — Admin Intelligence v2 ───────
  // Aggregates health of all 7 world-class intelligence layers across users.
  app.get('/api/admin/ei/intelligence-v2', ...adminChain, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await cached('ei:intelligence-v2', bust, async () => {
        const [
          forecastHealth,
          comparativeHealth,
          trajectoryHealth,
          interventionHealth,
          eiPoolHealth,
          reportHealth,
        ] = await Promise.all([
          // Forecast layer: users who have CAPADEX sessions (WCL2 eligible)
          pool.query(`
            SELECT
              COUNT(DISTINCT u.id)::int   AS users_with_email,
              COUNT(DISTINCT cs.guest_email)::int AS capadex_users,
              COUNT(DISTINCT CASE WHEN sess_count >= 2 THEN cs.guest_email END)::int AS wcl2_eligible
            FROM users u
            LEFT JOIN (
              SELECT guest_email, COUNT(*) AS sess_count
              FROM capadex_sessions
              WHERE status = 'completed' AND guest_email IS NOT NULL
              GROUP BY guest_email
            ) cs ON lower(cs.guest_email) = lower(COALESCE(NULLIF(TRIM(u.email),''), u.username))
          `).catch(() => ({ rows: [{}] })),

          // Comparative layer: users in EI snapshot pool
          pool.query(`
            SELECT
              COUNT(DISTINCT user_id)::int AS users_in_pool,
              COUNT(*)::int AS total_snapshots,
              COUNT(DISTINCT CASE WHEN cnt >= 2 THEN user_id END)::int AS multi_snapshot_users
            FROM (
              SELECT user_id, COUNT(*) AS cnt
              FROM ei_snapshot_versions GROUP BY user_id
            ) s
          `).catch(() => ({ rows: [{}] })),

          // Trajectory layer: users with ≥2 EI snapshots (trajectory eligible)
          pool.query(`
            SELECT
              COUNT(DISTINCT user_id)::int AS trajectory_eligible,
              AVG(snap_count)::float       AS avg_snapshots_per_user
            FROM (
              SELECT user_id, COUNT(*) AS snap_count
              FROM ei_snapshot_versions GROUP BY user_id HAVING COUNT(*) >= 2
            ) t
          `).catch(() => ({ rows: [{}] })),

          // Intervention layer: structural readiness (onto_competencies + learn_interventions)
          pool.query(`
            SELECT
              (SELECT COUNT(*)::int FROM learn_recommendations)                        AS persisted_recs,
              (SELECT COUNT(*)::int FROM onto_competencies)                            AS competencies_available,
              (SELECT COUNT(*)::int FROM learn_interventions WHERE active = true)      AS interventions_available,
              (SELECT COUNT(DISTINCT user_id)::int FROM learn_recommendations)         AS users_with_recs
          `).catch(() => ({ rows: [{ persisted_recs: 0, competencies_available: 0, interventions_available: 0, users_with_recs: 0 }] })),

          // EI engine pool health — proxy via ei_snapshot_versions (real user rows only)
          pool.query(`
            SELECT
              COUNT(*)::int                AS total_calc_logs,
              COUNT(DISTINCT user_id)::int AS users_computed,
              MAX(snapshot_date)::text     AS last_computed,
              AVG(computation_ms)::float   AS avg_ms
            FROM ei_snapshot_versions
            WHERE user_id NOT LIKE 'demo-cohort-%'
          `).catch(() => ({ rows: [{}] })),

          // Report Intelligence v2 — RF templates + generated reports
          pool.query(`
            SELECT
              COUNT(*) FILTER (WHERE is_active)::int       AS templates_active,
              (SELECT COUNT(*)::int FROM rf_generated_reports) AS reports_generated
            FROM rf_templates
          `).catch(() => ({ rows: [{ templates_active: 0, reports_generated: 0 }] })),
        ]);

        const fh = forecastHealth.rows[0]    ?? {};
        const ch = comparativeHealth.rows[0] ?? {};
        const th = trajectoryHealth.rows[0]  ?? {};
        const ih = interventionHealth.rows[0]?? {};
        const eh = eiPoolHealth.rows[0]       ?? {};
        const rh = reportHealth.rows[0]       ?? {};

        const layers = {
          forecast: {
            label:       'Forecast (WCL2)',
            status:      Number(fh.wcl2_eligible ?? 0) > 0 ? 'active' : 'no_data',
            description: 'WCL2 horizon forecasts via shared horizon-forecast service',
            metrics: {
              users_with_email:  Number(fh.users_with_email  ?? 0),
              capadex_users:     Number(fh.capadex_users     ?? 0),
              wcl2_eligible:     Number(fh.wcl2_eligible     ?? 0),
            },
          },
          outcomes: {
            label:       'Outcomes (WCL3)',
            status:      Number(fh.wcl2_eligible ?? 0) > 0 ? 'active' : 'no_data',
            description: 'WCL3 risk/growth/outcome derivation via shared wcl-projections service',
            metrics: { wcl3_eligible: Number(fh.wcl2_eligible ?? 0) },
          },
          comparative: {
            label:       'Comparative + Benchmark + Cohort',
            status:      Number(ch.users_in_pool ?? 0) >= 30 ? 'active' : Number(ch.users_in_pool ?? 0) >= 1 ? 'partial' : 'no_data',
            description: 'Peer position, percentile rank, cohort benchmarks (k-min=30)',
            metrics: {
              users_in_pool:       Number(ch.users_in_pool      ?? 0),
              total_snapshots:     Number(ch.total_snapshots    ?? 0),
              multi_snapshot:      Number(ch.multi_snapshot_users ?? 0),
              k_anonymity_met:     Number(ch.users_in_pool ?? 0) >= 30,
            },
          },
          trajectory: {
            label:       'Trajectory',
            status:      Number(th.trajectory_eligible ?? 0) > 0 ? 'active' : 'no_data',
            description: 'EI score trend projection using WCL2 linear-extrapolation math',
            metrics: {
              trajectory_eligible:    Number(th.trajectory_eligible    ?? 0),
              avg_snapshots_per_user: Math.round((Number(th.avg_snapshots_per_user ?? 0)) * 10) / 10,
            },
          },
          interventions: {
            // Structural: engine is active when competency + intervention catalogue is populated
            label:       'Interventions',
            status:      Number(ih.competencies_available ?? 0) > 0 && Number(ih.interventions_available ?? 0) > 0
                           ? 'active' : 'no_data',
            description: 'Top-5 causal recommendations via shared causal-recommendation-engine',
            metrics: {
              competencies_available:    Number(ih.competencies_available    ?? 0),
              interventions_available:   Number(ih.interventions_available   ?? 0),
              persisted_recs:            Number(ih.persisted_recs            ?? 0),
              users_with_persisted_recs: Number(ih.users_with_recs           ?? 0),
            },
          },
          ei_engine: {
            label:       'EI Compute Engine',
            // Active when any real-user snapshots exist (ei_snapshot_versions = engine output)
            status:      Number(eh.users_computed ?? 0) > 0 ? 'active' : 'no_data',
            description: 'Official EI resolution + snapshot auto-capture',
            metrics: {
              snapshots_total:   Number(eh.total_calc_logs  ?? 0),
              users_computed:    Number(eh.users_computed   ?? 0),
              last_snapshot:     eh.last_computed ?? null,
              avg_compute_ms:    Math.round((Number(eh.avg_ms ?? 0)) * 10) / 10,
            },
          },
          report_intelligence: {
            label:       'Report Intelligence v2',
            status:      Number(rh.templates_active ?? 0) > 0 ? 'active' : 'no_data',
            description: 'Report Factory narrative reports (GET /api/ei/intelligence/report-summary)',
            metrics: {
              templates_active:   Number(rh.templates_active   ?? 0),
              reports_generated:  Number(rh.reports_generated  ?? 0),
            },
          },
        };

        const active = Object.values(layers).filter(l => l.status === 'active').length;
        const total  = Object.keys(layers).length;

        return {
          layers,
          summary: {
            active_layers:  active,
            total_layers:   total,
            readiness_pct:  Math.round((active / total) * 100),
            overall:        active === total ? 'world_class' : active >= Math.ceil(total * 0.8) ? 'high' : active >= Math.ceil(total * 0.5) ? 'partial' : 'initialising',
          },
          version:      EI_ADMIN_VERSION,
          generated_at: new Date().toISOString(),
        };
      });
      res.json({ ok: true, intelligence_v2: data });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── P-R5 W7: GET /api/admin/ei/graph-integrity ───────────────────────────
  app.get('/api/admin/ei/graph-integrity', ...adminChain, async (req: Request, res: Response) => {
    try {
      const [occStats, skillStats, pathStats, orphanOcc, orphanSkill, brokenPaths] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM occupations`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM skills`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM occupation_pathways`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS n FROM occupations o WHERE is_active AND NOT EXISTS (SELECT 1 FROM occupation_skills os WHERE os.occupation_id = o.id)`).catch(() => ({ rows: [{ n: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS n FROM skills s WHERE is_active AND NOT EXISTS (SELECT 1 FROM occupation_skills os WHERE os.skill_id = s.id)`).catch(() => ({ rows: [{ n: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS n FROM occupation_pathways op WHERE is_active AND (NOT EXISTS (SELECT 1 FROM occupations f WHERE f.id = op.from_occupation_id) OR NOT EXISTS (SELECT 1 FROM occupations t WHERE t.id = op.to_occupation_id))`).catch(() => ({ rows: [{ n: 0 }] })),
      ]);
      const totalIssues = orphanOcc.rows[0].n + orphanSkill.rows[0].n + brokenPaths.rows[0].n;
      res.json({ ok: true, integrity: {
        occupation_count: occStats.rows[0].active,
        skill_count: skillStats.rows[0].active,
        pathway_count: pathStats.rows[0].active,
        orphan_occupations: orphanOcc.rows[0].n,
        orphan_skills: orphanSkill.rows[0].n,
        broken_pathways: brokenPaths.rows[0].n,
        total_issues: totalIssues,
        status: totalIssues === 0 ? 'healthy' : totalIssues <= 5 ? 'warning' : 'critical',
        generated_at: new Date().toISOString(),
      }});
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

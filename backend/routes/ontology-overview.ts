/**
 * Ontology Overview Routes
 *
 * GET  /api/ontology/overview/stats   — entity counts + mapping coverage + governance health
 * POST /api/ontology/overview/seed    — run starter seed (idempotent, admin only)
 * POST /api/ontology/overview/import-onet — import full O*NET role/skill library (idempotent, admin only)
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { runOntologySeed } from '../services/ontology-seed.js';
import { runOnetImport } from '../services/onet-import.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

export function registerOntologyOverviewRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
): void {

  app.get('/api/ontology/overview/stats', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const { rows: [s] } = await pool.query(`
        SELECT
          -- Taxonomy
          (SELECT COUNT(*)::int FROM ont_industries              WHERE is_active=true)  AS industries,
          (SELECT COUNT(*)::int FROM ont_functions               WHERE is_active=true)  AS functions,
          (SELECT COUNT(*)::int FROM ont_departments             WHERE is_active=true)  AS departments,
          (SELECT COUNT(*)::int FROM ont_role_families           WHERE is_active=true)  AS role_families,
          (SELECT COUNT(*)::int FROM ont_roles                   WHERE is_active=true)  AS roles,
          -- Competency core
          (SELECT COUNT(*)::int FROM ont_layers                  WHERE is_active=true)  AS layers,
          (SELECT COUNT(*)::int FROM ont_competency_clusters     WHERE is_active=true)  AS clusters,
          (SELECT COUNT(*)::int FROM ont_competencies            WHERE is_active=true)  AS competencies,
          (SELECT COUNT(*)::int FROM ont_micro_competencies      WHERE is_active=true)  AS micro_competencies,
          -- Behavioral
          (SELECT COUNT(*)::int FROM ont_concerns                WHERE is_active=true)  AS concerns,
          (SELECT COUNT(*)::int FROM ont_indicators              WHERE is_active=true)  AS indicators,
          (SELECT COUNT(*)::int FROM ont_assessment_questions    WHERE is_active=true)  AS assessment_questions,
          -- Supplementary
          (SELECT COUNT(*)::int FROM ont_competency_level_anchors WHERE is_active=true) AS competency_levels,
          (SELECT COUNT(*)::int FROM ont_benchmarks              WHERE is_active=true)  AS benchmarks,
          (SELECT COUNT(*)::int FROM ont_career_tracks           WHERE is_active=true)  AS career_tracks,
          (SELECT COUNT(*)::int FROM ont_career_paths            WHERE is_active=true)  AS career_paths,
          (SELECT COUNT(*)::int FROM ont_learning_paths          WHERE is_active=true)  AS learning_paths,
          (SELECT COUNT(*)::int FROM ont_future_skills           WHERE is_active=true)  AS future_skills,
          -- Mapping tables
          (SELECT COUNT(*)::int FROM map_industry_function       WHERE is_active=true)  AS map_ind_fn,
          (SELECT COUNT(*)::int FROM map_role_layer              WHERE is_active=true)  AS map_role_layer,
          (SELECT COUNT(*)::int FROM map_layer_cluster           WHERE is_active=true)  AS map_layer_cluster,
          (SELECT COUNT(*)::int FROM map_cluster_competency      WHERE is_active=true)  AS map_cluster_comp,
          (SELECT COUNT(*)::int FROM map_role_competency         WHERE is_active=true)  AS map_role_comp,
          (SELECT COUNT(*)::int FROM map_micro_concern           WHERE is_active=true)  AS map_micro_concern,
          (SELECT COUNT(*)::int FROM map_concern_indicator       WHERE is_active=true)  AS map_concern_ind,
          (SELECT COUNT(*)::int FROM map_indicator_question      WHERE is_active=true)  AS map_ind_q,
          (SELECT COUNT(*)::int FROM map_micro_question          WHERE is_active=true)  AS map_micro_q,
          (SELECT COUNT(*)::int FROM map_competency_future_skill WHERE is_active=true)  AS map_comp_fs,
          -- Reference
          (SELECT COUNT(*)::int FROM ref_seniority_levels        WHERE is_active=true)  AS ref_seniority,
          (SELECT COUNT(*)::int FROM ref_proficiency_levels      WHERE is_active=true)  AS ref_proficiency,
          (SELECT COUNT(*)::int FROM ref_competency_categories   WHERE is_active=true)  AS ref_categories,
          (SELECT COUNT(*)::int FROM ref_assessment_types        WHERE is_active=true)  AS ref_assessment_types,
          (SELECT COUNT(*)::int FROM ref_lifecycle_transitions)                         AS ref_lifecycle,
          -- Governance
          (SELECT COUNT(*)::int FROM gov_review_schedules        WHERE is_active=true)  AS gov_schedules,
          (SELECT COUNT(*)::int FROM gov_quality_gate_rules      WHERE is_active=true)  AS gov_quality_rules,
          (SELECT COUNT(*)::int FROM gov_review_instances WHERE completed_at IS NULL)   AS pending_reviews,
          -- Version control
          (SELECT COUNT(*)::int FROM ver_entity_snapshots)                              AS snapshots,
          (SELECT COUNT(*)::int FROM ver_change_history)                                AS changes,
          (SELECT COUNT(*)::int FROM lfc_status_events)                                 AS lifecycle_events,
          -- Status breakdown for core entities
          (SELECT COUNT(*)::int FROM ont_competencies WHERE status='published')         AS comp_published,
          (SELECT COUNT(*)::int FROM ont_competencies WHERE status='draft')             AS comp_draft,
          (SELECT COUNT(*)::int FROM ont_competencies WHERE status='in_review')         AS comp_in_review
      `);

      return res.json({ stats: s });
    } catch (err) {
      console.error('[ontology-overview] stats error:', err);
      return res.status(500).json({ error: 'Failed to fetch ontology stats' });
    }
  });

  app.post('/api/ontology/overview/seed', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await runOntologySeed(pool);
      return res.json(result);
    } catch (err: any) {
      console.error('[ontology-overview] seed error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? 'Seed failed' });
    }
  });

  // POST /api/ontology/overview/import-onet — import the full O*NET role/skill
  // library into ont_roles / ont_competencies / map_role_competency. Idempotent
  // (every write is ON CONFLICT DO UPDATE / DO NOTHING) and additive — starter
  // seed rows use disjoint code namespaces and are untouched. Source files are
  // downloaded on demand unless { download:false } is passed.
  app.post('/api/ontology/overview/import-onet', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const download = req.body?.download !== false;
      const importanceThreshold = typeof req.body?.importanceThreshold === 'number'
        ? req.body.importanceThreshold
        : undefined;
      const result = await runOnetImport(pool, { download, importanceThreshold });
      return res.status(result.ok ? 200 : 500).json(result);
    } catch (err: any) {
      console.error('[ontology-overview] import-onet error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? 'O*NET import failed' });
    }
  });
}

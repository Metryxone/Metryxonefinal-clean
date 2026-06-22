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
import { bridgeOnetDerivedWeights } from '../services/onet-onto-weight-bridge.js';

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
          (SELECT COUNT(*)::int FROM map_role_competency         WHERE is_active=true AND source='onet_derived') AS map_role_comp_derived,
          (SELECT COUNT(*)::int FROM map_role_competency         WHERE is_active=true AND source<>'onet_derived') AS map_role_comp_native,
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

  // GET /api/ontology/overview/entity/:id — read-only row listing for a single
  // hierarchy entity, so the overview cards can drill into their backing table.
  // Table name is resolved from a fixed whitelist (never client input) → safe to
  // interpolate. Capped at 200 rows; absent table degrades to an empty result.
  const ENTITY_TABLES: Record<string, string> = {
    industries:           'ont_industries',
    functions:            'ont_functions',
    departments:          'ont_departments',
    role_families:        'ont_role_families',
    roles:                'ont_roles',
    layers:               'ont_layers',
    clusters:             'ont_competency_clusters',
    competencies:         'ont_competencies',
    micro_competencies:   'ont_micro_competencies',
    concerns:             'ont_concerns',
    indicators:           'ont_indicators',
    assessment_questions: 'ont_assessment_questions',
  };

  app.get('/api/ontology/overview/entity/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const table = ENTITY_TABLES[id];
    if (!table) {
      return res.status(404).json({ error: 'Unknown entity', rows: [], columns: [], total: 0 });
    }
    try {
      const reg = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
      if (!reg.rows[0]?.t) {
        return res.json({ rows: [], columns: [], total: 0, note: 'table absent' });
      }
      const { rows } = await pool.query(`SELECT * FROM ${table} WHERE is_active = true ORDER BY 1 LIMIT 200`);
      const columns = rows.length ? Object.keys(rows[0]) : [];
      return res.json({ table, rows, columns, total: rows.length });
    } catch (err) {
      console.error('[ontology-overview] entity error:', err);
      return res.status(500).json({ error: 'Failed to fetch entity rows', rows: [], columns: [], total: 0 });
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
      // Bridge the freshly-derived O*NET weights into the user-facing Role-DNA
      // table so the "Estimated / inherited" badge reflects real data. Additive
      // and never throws — a bridge failure must not fail the import itself.
      const bridge = result.ok ? await bridgeOnetDerivedWeights(pool) : { linksBridged: 0, ok: false };
      return res.status(result.ok ? 200 : 500).json({ ...result, weight_bridge: bridge });
    } catch (err: any) {
      console.error('[ontology-overview] import-onet error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? 'O*NET import failed' });
    }
  });

  // POST /api/ontology/overview/bridge-onet-weights — rebuild only the
  // onet_derived rows in onto_role_weights from the already-imported O*NET
  // library, without re-running the (slow) O*NET import. Idempotent + additive;
  // curated Role-DNA weights are never touched.
  app.post('/api/ontology/overview/bridge-onet-weights', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const bridge = await bridgeOnetDerivedWeights(pool);
      return res.status(bridge.ok ? 200 : 500).json(bridge);
    } catch (err: any) {
      console.error('[ontology-overview] bridge-onet-weights error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? 'weight bridge failed' });
    }
  });
}

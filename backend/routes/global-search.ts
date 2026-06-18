/**
 * Global Search — universal admin search across business entities.
 *
 * READ-ONLY. NEVER-THROWS. NO DATA DUPLICATION.
 * Each entity type is queried independently with a guarded ILIKE; a missing
 * table/column degrades that one type to an empty group rather than a 500.
 *
 * Every result carries a uniform shape so the Command Palette can render it:
 *   { id, entity, type, type_label, health, location:{tab,label}, actions:[] }
 * - health is an HONEST score in [0,100] ONLY when the source row carries a real
 *   numeric basis; otherwise it is null (rendered as "—"). Never fabricated.
 * - location.tab is a REAL admin tab id so a click can setActiveTab() to it.
 *
 * GET /api/admin/search?q=<term>&limit=<perType>&types=a,b   (60s cache)
 * GET /api/admin/search/types                                (catalogue)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const TTL_MS = 60_000;
const CACHE = new Map<string, { at: number; data: any }>();

async function safeRows(pool: Pool, sql: string, params: any[]): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}

const clampHealth = (v: any): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
};

interface EntityResult {
  id: string;
  entity: string;
  subtitle: string | null;
  type: string;
  type_label: string;
  health: number | null;
  location: { tab: string; label: string };
  actions: { key: string; label: string; tab: string }[];
}

interface EntityDef {
  type: string;
  label: string;
  tab: string;
  tabLabel: string;
  /** builds the SQL given a positional param index for the ILIKE term */
  run: (pool: Pool, like: string, limit: number) => Promise<EntityResult[]>;
}

// ── helpers to assemble the uniform result shape ────────────────────────────
function mk(def: EntityDef, id: any, entity: string, subtitle: string | null, health: number | null): EntityResult {
  return {
    id: `${def.type}:${id}`,
    entity: entity || '(untitled)',
    subtitle: subtitle || null,
    type: def.type,
    type_label: def.label,
    health,
    location: { tab: def.tab, label: def.tabLabel },
    actions: [{ key: 'open', label: `Open in ${def.tabLabel}`, tab: def.tab }],
  };
}

// Every table/column below was verified to exist. All queries are guarded.
const ENTITIES: EntityDef[] = [
  {
    type: 'user', label: 'User', tab: 'usermgmt', tabLabel: 'User Management',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id, full_name, username, email, role, account_type
        FROM users
        WHERE full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1 OR role ILIKE $1
        ORDER BY full_name NULLS LAST LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.full_name || x.username || x.email,
        [x.role, x.account_type].filter(Boolean).join(' · ') || x.email, null));
    },
  },
  {
    type: 'candidate', label: 'Candidate', tab: 'cc-career', tabLabel: 'Career Builder Command Center',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT p.user_id, p.current_role_label, p.target_role_label, p.industry, p.career_stage,
               (SELECT round(avg(raw_score)) FROM cra_scores s WHERE s.user_id = p.user_id) AS avg_score
        FROM cra_profiles p
        WHERE p.current_role_label ILIKE $1 OR p.target_role_label ILIKE $1
           OR p.industry ILIKE $1 OR p.user_id ILIKE $1
        ORDER BY p.updated_at DESC NULLS LAST LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.user_id,
        x.current_role_label || x.target_role_label || x.user_id,
        [x.industry, x.career_stage].filter(Boolean).join(' · ') || null,
        clampHealth(x.avg_score)));
    },
  },
  {
    type: 'employer', label: 'Employer', tab: 'employer-onboarding', tabLabel: 'Employer Onboarding',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id, name, domain, plan, verified
        FROM employer_organizations
        WHERE name ILIKE $1 OR domain ILIKE $1 OR plan ILIKE $1
        ORDER BY created_at DESC NULLS LAST LIMIT $2`, [like, limit]);
      // `verified` is a boolean flag, NOT a numeric health metric — surface it as
      // a subtitle fact, never a synthesized pseudo-score. health stays null.
      return (r || []).map(x => mk(this, x.id, x.name,
        [x.domain, x.plan, x.verified === true ? 'verified' : x.verified === false ? 'unverified' : null]
          .filter(Boolean).join(' · ') || null,
        null));
    },
  },
  {
    type: 'institution', label: 'Institution', tab: 'institutions', tabLabel: 'Institutions',
    async run(pool, like, limit) {
      // No dedicated institutions table — surface user accounts flagged as institutions.
      const r = await safeRows(pool, `
        SELECT id, full_name, email, account_type
        FROM users
        WHERE (account_type ILIKE '%institut%' OR role ILIKE '%institut%')
          AND (full_name ILIKE $1 OR email ILIKE $1)
        ORDER BY full_name NULLS LAST LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.full_name || x.email, x.email, null));
    },
  },
  {
    type: 'assessment', label: 'Assessment', tab: 'reports', tabLabel: 'Reports',
    async run(pool, like, limit) {
      const a = await safeRows(pool, `
        SELECT id::text AS id, assessment_type AS title, user_email AS sub, score, completion_status
        FROM ti_fact_assessments
        WHERE assessment_type ILIKE $1 OR assessment_key ILIKE $1 OR user_email ILIKE $1
        ORDER BY completed_at DESC NULLS LAST LIMIT $2`, [like, limit]) || [];
      const h = await safeRows(pool, `
        SELECT id::text AS id, candidate_name AS title, candidate_id AS sub, fit_score AS score
        FROM ep98_hiring_assessments
        WHERE candidate_name ILIKE $1 OR candidate_id ILIKE $1
        ORDER BY computed_at DESC NULLS LAST LIMIT $2`, [like, limit]) || [];
      return [
        ...a.map(x => mk(this, x.id, x.title || 'Assessment', x.sub, clampHealth(x.score))),
        ...h.map(x => mk(this, x.id, x.title || 'Hiring Assessment', x.sub, clampHealth(x.score))),
      ].slice(0, limit);
    },
  },
  {
    type: 'question', label: 'Question', tab: 'questionbank', tabLabel: 'Question Bank',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id::text AS id, question_text, question_code, subject, domain_name
        FROM question_bank
        WHERE question_text ILIKE $1 OR question_code ILIKE $1 OR subject ILIKE $1 OR domain_name ILIKE $1
        ORDER BY updated_at DESC NULLS LAST LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id,
        (x.question_text || x.question_code || 'Question').slice(0, 90),
        [x.subject, x.domain_name].filter(Boolean).join(' · ') || x.question_code, null));
    },
  },
  {
    type: 'signal', label: 'Signal', tab: 'talent-signal-master', tabLabel: 'Talent Signal Master',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id::text AS id, signal_name, signal_code, category, subcategory, future_relevance
        FROM ti_signal_master
        WHERE signal_name ILIKE $1 OR signal_code ILIKE $1 OR category ILIKE $1 OR subcategory ILIKE $1
        ORDER BY signal_name LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.signal_name || x.signal_code,
        [x.category, x.subcategory].filter(Boolean).join(' · ') || null,
        clampHealth(x.future_relevance)));
    },
  },
  {
    type: 'competency', label: 'Competency', tab: 'cc-competency', tabLabel: 'Competency Command Center',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id::text AS id, competency_name, competency_code, blueprint_key
        FROM competency_dna_master
        WHERE competency_name ILIKE $1 OR competency_code ILIKE $1 OR blueprint_key ILIKE $1
        ORDER BY competency_name LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.competency_name || x.competency_code,
        x.competency_code || x.blueprint_key, null));
    },
  },
  {
    type: 'report', label: 'Report', tab: 'report-factory-admin', tabLabel: 'Report Factory',
    async run(pool, like, limit) {
      const rf = await safeRows(pool, `
        SELECT id::text AS id, name, description FROM rf_master
        WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY name LIMIT $2`, [like, limit]) || [];
      const lbi = await safeRows(pool, `
        SELECT id::text AS id, label AS name, description FROM lbi_report_types
        WHERE label ILIKE $1 OR code ILIKE $1 OR description ILIKE $1 ORDER BY label LIMIT $2`, [like, limit]) || [];
      return [
        ...rf.map(x => mk(this, x.id, x.name, x.description, null)),
        ...lbi.map(x => ({ ...mk(this, x.id, x.name, x.description, null),
          location: { tab: 'reports', label: 'Reports' },
          actions: [{ key: 'open', label: 'Open in Reports', tab: 'reports' }] })),
      ].slice(0, limit);
    },
  },
  {
    type: 'job', label: 'Job / Role', tab: 'cc-career', tabLabel: 'Career Builder Command Center',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id::text AS id, title, function_area, seniority, demand_score
        FROM cg_roles
        WHERE title ILIKE $1 OR function_area ILIKE $1 OR role_key ILIKE $1
        ORDER BY demand_score DESC NULLS LAST LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.title,
        [x.seniority, x.function_area].filter(Boolean).join(' · ') || null,
        clampHealth(x.demand_score != null ? Number(x.demand_score) * (Number(x.demand_score) <= 1 ? 100 : 1) : null)));
    },
  },
  {
    type: 'skill', label: 'Skill', tab: 'cc-employability', tabLabel: 'Employability Intelligence',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT id::text AS id, name, skill_code, domain, cluster, durability_score
        FROM frp_skill_library
        WHERE name ILIKE $1 OR skill_code ILIKE $1 OR domain ILIKE $1 OR cluster ILIKE $1
        ORDER BY durability_score DESC NULLS LAST LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.name || x.skill_code,
        [x.domain, x.cluster].filter(Boolean).join(' · ') || null,
        clampHealth(x.durability_score)));
    },
  },
  {
    type: 'subscription', label: 'Subscription / Plan', tab: 'pricing', tabLabel: 'Pricing & Packages',
    async run(pool, like, limit) {
      const r = await safeRows(pool, `
        SELECT stage_code AS id, stage_name, price, tag, is_active
        FROM capadex_stage_pricing
        WHERE stage_name ILIKE $1 OR stage_code ILIKE $1 OR tag ILIKE $1 OR description ILIKE $1
        ORDER BY stage_name LIMIT $2`, [like, limit]);
      return (r || []).map(x => mk(this, x.id, x.stage_name || x.id,
        [x.price, x.tag].filter(Boolean).join(' · ') || null, null));
    },
  },
];

async function runSearch(pool: Pool, q: string, perType: number, only: Set<string> | null) {
  const like = `%${q.replace(/[%_]/g, m => '\\' + m)}%`;
  const defs = only ? ENTITIES.filter(e => only.has(e.type)) : ENTITIES;
  const groups: { type: string; label: string; tab: string; count: number; results: EntityResult[] }[] = [];
  let total = 0;
  for (const def of defs) {
    const results = await def.run(pool, like, perType);
    total += results.length;
    groups.push({ type: def.type, label: def.label, tab: def.tab, count: results.length, results });
  }
  return { query: q, total, groups: groups.filter(g => g.count > 0), generated_at: new Date().toISOString() };
}

export function registerGlobalSearchRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
) {
  const guards = [requireAuth, requireSuperAdmin];

  // Catalogue of searchable entity types.
  app.get('/api/admin/search/types', guards, (_req: Request, res: Response) => {
    res.json({
      types: ENTITIES.map(e => ({ type: e.type, label: e.label, tab: e.tab, tab_label: e.tabLabel })),
    });
  });

  // Universal search.
  app.get('/api/admin/search', guards, async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    const perType = Math.max(1, Math.min(20, Number(req.query.limit) || 6));
    const typesParam = String(req.query.types || '').trim();
    const only = typesParam ? new Set(typesParam.split(',').map(s => s.trim()).filter(Boolean)) : null;
    if (q.length < 2) {
      return res.json({ query: q, total: 0, groups: [], note: 'min_query_length_2', generated_at: new Date().toISOString() });
    }
    const cacheKey = `${q.toLowerCase()}|${perType}|${typesParam}`;
    const now = Date.now();
    const hit = CACHE.get(cacheKey);
    if (req.query.refresh !== '1' && hit && now - hit.at < TTL_MS) return res.json(hit.data);
    try {
      const data = await runSearch(pool, q, perType, only);
      CACHE.set(cacheKey, { at: now, data });
      res.json(data);
    } catch (e: any) {
      res.status(200).json({ query: q, total: 0, groups: [], status: 'error', error: String(e?.message || e) });
    }
  });
}

/**
 * Product Command Centers — per-product executive aggregator.
 *
 * READ-ONLY. NEVER-THROWS. NO DATA DUPLICATION.
 * Composes already-computed data from the live database into a single executive
 * payload per product. Every metric is independently guarded: a missing
 * table/column yields `available:false` rather than a 500.
 *
 * Reports FOUR executive indicator groups, with two ORTHOGONAL honesty axes
 * (never composited — same discipline as Mission Control):
 *   - Health    : coverage  = fraction of ALL declared sources materialized (rows>0)
 *   - Readiness : activation = fraction of RUNTIME sources with live data
 *   - Trend     : 30-day vs prior-30-day direction over a real timestamp column
 *                 (honestly `available:false` when the product has no time basis)
 *   - Usage     : raw user-facing volume counts
 * Reference/seed data can be fully covered while activation is 0 — that is honest,
 * not a bug, and is surfaced as such.
 *
 * GET /api/admin/product/:key            — full executive payload (60s cache)
 * GET /api/admin/product/:key/health     — Product Health API
 * GET /api/admin/product/:key/readiness  — Product Readiness API
 * (?refresh=1 busts the cache on any of them)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const TTL_MS = 60_000;
const CACHE = new Map<string, { at: number; data: any }>();

// ── guarded primitives (never throw) ────────────────────────────────────────
async function rows(pool: Pool, sql: string, params: any[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
async function count(pool: Pool, table: string, where?: string): Promise<number | null> {
  const r = await rows(pool, `SELECT count(*)::int AS n FROM ${table}${where ? ' WHERE ' + where : ''}`);
  return r ? Number(r[0].n) : null;
}
const fmtN = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-IN'));

// ── source / product model ──────────────────────────────────────────────────
type Kind = 'reference' | 'runtime';
interface SrcDef { label: string; table: string; where?: string; kind: Kind; usage?: boolean }
interface TrendDef { label: string; table: string; tsCol: string; where?: string }
interface ProductDef {
  key: string;
  name: string;
  tagline: string;
  /** sidebar tab id this command center surfaces under (informational) */
  tab: string;
  sources: SrcDef[];
  trend?: TrendDef;
}

// Every table below was verified to exist in this database. Counts are guarded,
// so a future schema change degrades a single indicator to "unavailable" rather
// than breaking the endpoint.
const PRODUCTS: Record<string, ProductDef> = {
  capadex: {
    key: 'capadex',
    name: 'CAPADEX',
    tagline: 'Behavioural concern assessment & runtime intelligence',
    tab: 'cc-capadex',
    sources: [
      { label: 'Clarity Questions',     table: 'capadex_clarity_questions',  kind: 'reference' },
      { label: 'Question Registry',     table: 'capadex_question_registry',  kind: 'reference' },
      { label: 'Signal Profiles',       table: 'capadex_signal_profiles',    kind: 'reference' },
      { label: 'Linguistic Signals',    table: 'capadex_linguistic_signals', kind: 'reference' },
      { label: 'Stage Pricing',         table: 'capadex_stage_pricing',      kind: 'reference' },
      { label: 'Runtime Sessions',      table: 'capadex_session_telemetry',  kind: 'runtime', usage: true },
      { label: 'Captured Signals',      table: 'capadex_session_signals',    kind: 'runtime', usage: true },
    ],
    trend: { label: 'Runtime sessions', table: 'capadex_session_telemetry', tsCol: 'created_at' },
  },
  competency: {
    key: 'competency',
    name: 'Competency Intelligence',
    tagline: 'Competency DNA, scoring science & outcome prediction',
    tab: 'cc-competency',
    sources: [
      { label: 'Competency DNA Master', table: 'competency_dna_master',  kind: 'reference' },
      { label: 'Signal Master',         table: 'ti_signal_master',       kind: 'reference' },
      { label: 'Scoring Formulas',      table: 'ti_scoring_formulas',    kind: 'reference' },
      { label: 'Score Bands',           table: 'ti_score_bands',         kind: 'reference' },
      { label: 'Competency Weights',    table: 'ti_competency_weights',  kind: 'reference' },
      { label: 'Assessments',           table: 'ti_fact_assessments',    kind: 'runtime', usage: true },
      { label: 'Readiness Facts',       table: 'ti_fact_readiness',      kind: 'runtime' },
      { label: 'Outcome Predictions',   table: 'ti_outcome_predictions', kind: 'runtime', usage: true },
    ],
    trend: { label: 'Readiness facts', table: 'ti_fact_readiness', tsCol: 'snapshot_at' },
  },
  lbi: {
    key: 'lbi',
    name: 'LBI',
    tagline: 'Life Balance Index assessment & longitudinal scoring',
    tab: 'cc-lbi',
    sources: [
      { label: 'Report Types',  table: 'lbi_report_types',  kind: 'reference' },
      { label: 'Score History', table: 'lbi_score_history', kind: 'runtime', usage: true },
    ],
    // lbi_score_history has no timestamp column → trend is honestly unavailable.
  },
  employability: {
    key: 'employability',
    name: 'Employability Intelligence',
    tagline: 'Future-readiness, AI-impact & skill-evolution forecasting',
    tab: 'cc-employability',
    sources: [
      { label: 'Skill Taxonomy',       table: 'frp_skill_taxonomy',        kind: 'reference' },
      { label: 'Skill Library',        table: 'frp_skill_library',         kind: 'reference' },
      { label: 'Benchmarks',           table: 'frp_benchmarks',            kind: 'reference' },
      { label: 'Future Competency Map', table: 'frp_future_competency_map', kind: 'reference' },
      { label: 'User Readiness',       table: 'frp_user_readiness',        kind: 'runtime', usage: true },
      { label: 'User Skill Profiles',  table: 'frp_user_skill_profile',    kind: 'runtime' },
      { label: 'Role Evolution',       table: 'frp_role_evolution',        kind: 'runtime' },
    ],
    trend: { label: 'User readiness', table: 'frp_user_readiness', tsCol: 'computed_at' },
  },
  career: {
    key: 'career',
    name: 'Career Builder',
    tagline: 'Career graph, readiness, recommendations & pathways',
    tab: 'cc-career',
    sources: [
      { label: 'Roles',             table: 'cg_roles',               kind: 'reference' },
      { label: 'Tracks',            table: 'cg_tracks',              kind: 'reference' },
      { label: 'Skill Requirements', table: 'cg_skill_requirements', kind: 'reference' },
      { label: 'Role Edges',        table: 'cg_role_edges',          kind: 'reference' },
      { label: 'Readiness Weights', table: 'cg_readiness_weights',   kind: 'reference' },
      { label: 'User Readiness',    table: 'cg_user_role_readiness',  kind: 'runtime', usage: true },
      { label: 'Recommendations',   table: 'cg_user_recommendations', kind: 'runtime', usage: true },
      { label: 'Skill Gaps',        table: 'cg_user_skill_gaps',     kind: 'runtime' },
      { label: 'Career Paths',      table: 'cg_user_career_path',    kind: 'runtime' },
    ],
    trend: { label: 'User readiness', table: 'cg_user_role_readiness', tsCol: 'computed_at' },
  },
  employer: {
    key: 'employer',
    name: 'Employer Intelligence OS',
    tagline: 'Hiring, workforce planning & talent intelligence graph',
    tab: 'cc-employer',
    sources: [
      { label: 'Competency Roles (Employer)', table: 'employer_competency_roles', kind: 'reference' },
      { label: 'Competency Roles (EIOS)',     table: 'eios_competency_roles',     kind: 'reference' },
      { label: 'TIG Clusters',                table: 'tig_clusters',              kind: 'reference' },
      { label: 'Organizations',               table: 'employer_organizations',    kind: 'runtime', usage: true },
      { label: 'Members',                     table: 'employer_members',          kind: 'runtime' },
      { label: 'Campaigns',                   table: 'eios_campaigns',            kind: 'runtime', usage: true },
      { label: 'Employee Profiles',           table: 'eios_employee_profiles',    kind: 'runtime', usage: true },
      { label: 'Talent Graph Nodes',          table: 'tig_nodes',                 kind: 'runtime' },
    ],
    trend: { label: 'Campaigns', table: 'eios_campaigns', tsCol: 'created_at' },
  },
};

// ── axis math (orthogonal; never composited) ────────────────────────────────
const withData = (n: number | null) => n != null && n > 0;

function bandFromPct(pct: number): 'healthy' | 'warning' | 'idle' {
  if (pct >= 50) return 'healthy';
  if (pct > 0) return 'warning';
  return 'idle';
}

async function buildHealth(pool: Pool, p: ProductDef) {
  const indicators = [];
  for (const s of p.sources) {
    const n = await count(pool, s.table, s.where);
    indicators.push({ label: s.label, table: s.table, kind: s.kind, value: fmtN(n), n, materialized: withData(n) });
  }
  const present = indicators.filter(i => i.n != null).length;
  const materialized = indicators.filter(i => i.materialized).length;
  const coverage = indicators.length ? Math.round(materialized / indicators.length * 100) : 0;
  return {
    coverage,
    status: coverage >= 50 ? 'healthy' : coverage > 0 ? 'partial' : 'empty',
    sources_present: present,
    sources_total: indicators.length,
    materialized_count: materialized,
    indicators,
    _byTable: Object.fromEntries(indicators.map(i => [i.table, i])),
  };
}

function buildReadiness(health: Awaited<ReturnType<typeof buildHealth>>, p: ProductDef) {
  const runtime = p.sources.filter(s => s.kind === 'runtime');
  const indicators = runtime.map(s => {
    const h = (health._byTable as any)[s.table];
    return { label: s.label, table: s.table, value: h?.value ?? '—', n: h?.n ?? null, live: !!h?.materialized };
  });
  const live = indicators.filter(i => i.live).length;
  const activation = indicators.length ? Math.round(live / indicators.length * 100) : 0;
  return {
    activation,
    status: indicators.length === 0 ? 'reference' : bandFromPct(activation),
    runtime_present: indicators.filter(i => i.n != null).length,
    runtime_total: indicators.length,
    live_count: live,
    indicators,
  };
}

async function buildTrend(pool: Pool, p: ProductDef) {
  if (!p.trend) {
    return { available: false, reason: 'no_time_basis', label: null, direction: 'none', current: 0, previous: 0, delta_pct: null, window_days: 30, series: [] };
  }
  const t = p.trend;
  const w = t.where ? ` AND (${t.where})` : '';
  const main = await rows(pool, `
    SELECT
      count(*) FILTER (WHERE ${t.tsCol} >= now() - interval '30 days')::int AS cur,
      count(*) FILTER (WHERE ${t.tsCol} >= now() - interval '60 days' AND ${t.tsCol} < now() - interval '30 days')::int AS prev
    FROM ${t.table} WHERE ${t.tsCol} IS NOT NULL${w}`);
  if (!main) {
    return { available: false, reason: 'query_failed', label: t.label, direction: 'none', current: 0, previous: 0, delta_pct: null, window_days: 30, series: [] };
  }
  const cur = Number(main[0].cur), prev = Number(main[0].prev);
  const seriesRows = await rows(pool, `
    SELECT to_char(date_trunc('week', ${t.tsCol}), 'YYYY-MM-DD') AS wk, count(*)::int AS n
    FROM ${t.table}
    WHERE ${t.tsCol} >= now() - interval '8 weeks' AND ${t.tsCol} IS NOT NULL${w}
    GROUP BY 1 ORDER BY 1`) || [];
  const delta_pct = prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
  const direction = cur > prev ? 'up' : cur < prev ? 'down' : 'flat';
  return {
    available: true,
    label: t.label,
    direction,
    current: cur,
    previous: prev,
    delta_pct,
    window_days: 30,
    series: seriesRows.map((r: any) => ({ week: r.wk, n: Number(r.n) })),
  };
}

function buildUsage(health: Awaited<ReturnType<typeof buildHealth>>, p: ProductDef) {
  const usageSrc = p.sources.filter(s => s.usage);
  const indicators = usageSrc.map(s => {
    const h = (health._byTable as any)[s.table];
    return { label: s.label, table: s.table, value: h?.value ?? '—', n: h?.n ?? null };
  });
  const total = indicators.reduce((a, i) => a + (i.n || 0), 0);
  const anyAvailable = indicators.some(i => i.n != null);
  return { total: anyAvailable ? total : null, total_label: anyAvailable ? fmtN(total) : '—', indicators };
}

function overallStatus(healthCov: number, readinessAct: number, hasRuntime: boolean): string {
  if (healthCov === 0) return 'empty';
  if (!hasRuntime) return 'reference';
  if (readinessAct === 0) return 'idle';
  if (readinessAct < 50 || healthCov < 50) return 'warning';
  return 'healthy';
}

async function buildProduct(pool: Pool, p: ProductDef) {
  const health = await buildHealth(pool, p);
  const readiness = buildReadiness(health, p);
  const trend = await buildTrend(pool, p);
  const usage = buildUsage(health, p);
  const { _byTable, ...healthPublic } = health as any;
  return {
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    tab: p.tab,
    status: overallStatus(health.coverage, readiness.activation, readiness.runtime_total > 0),
    health: healthPublic,
    readiness,
    trend,
    usage,
    generated_at: new Date().toISOString(),
  };
}

async function cached(pool: Pool, p: ProductDef, refresh: boolean) {
  const now = Date.now();
  const hit = CACHE.get(p.key);
  if (!refresh && hit && now - hit.at < TTL_MS) return hit.data;
  const data = await buildProduct(pool, p);
  CACHE.set(p.key, { at: now, data });
  return data;
}

export function registerProductCommandCenterRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
) {
  const guards = [requireAuth, requireSuperAdmin];

  // Catalogue of available product command centers.
  app.get('/api/admin/products', guards, (_req: Request, res: Response) => {
    res.json({
      products: Object.values(PRODUCTS).map(p => ({ key: p.key, name: p.name, tagline: p.tagline, tab: p.tab })),
    });
  });

  const resolve = (req: Request, res: Response): ProductDef | null => {
    const p = PRODUCTS[String(req.params.key || '').toLowerCase()];
    if (!p) { res.status(404).json({ error: 'unknown_product', key: req.params.key }); return null; }
    return p;
  };

  // Full executive payload (Health + Readiness + Trend + Usage).
  app.get('/api/admin/product/:key', guards, async (req: Request, res: Response) => {
    const p = resolve(req, res); if (!p) return;
    try {
      const data = await cached(pool, p, req.query.refresh === '1');
      res.json(data);
    } catch (e: any) {
      res.status(200).json({ key: p.key, name: p.name, status: 'error', error: String(e?.message || e) });
    }
  });

  // Product Health API.
  app.get('/api/admin/product/:key/health', guards, async (req: Request, res: Response) => {
    const p = resolve(req, res); if (!p) return;
    try {
      const data = await cached(pool, p, req.query.refresh === '1');
      res.json({ key: p.key, name: p.name, generated_at: data.generated_at, health: data.health });
    } catch (e: any) {
      res.status(200).json({ key: p.key, status: 'error', error: String(e?.message || e) });
    }
  });

  // Product Readiness API.
  app.get('/api/admin/product/:key/readiness', guards, async (req: Request, res: Response) => {
    const p = resolve(req, res); if (!p) return;
    try {
      const data = await cached(pool, p, req.query.refresh === '1');
      res.json({ key: p.key, name: p.name, generated_at: data.generated_at, readiness: data.readiness, trend: data.trend });
    } catch (e: any) {
      res.status(200).json({ key: p.key, status: 'error', error: String(e?.message || e) });
    }
  });
}

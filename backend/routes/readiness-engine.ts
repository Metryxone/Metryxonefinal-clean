/**
 * Readiness Engine — per-product readiness dashboards across 8 dimensions.
 *
 * READ-ONLY for measurement. NEVER-THROWS. NO DATA DUPLICATION.
 * Measures readiness for 7 products across 8 ORTHOGONAL dimensions:
 *   Structural · Activation · Data · Intelligence · Commercial ·
 *   Operations · Security · Governance
 *
 * HONESTY MODEL (matches platform convention — axes never composited / inflated):
 *  - Each dimension declares a set of REAL signals (a guarded count over a table
 *    that was verified to exist). A signal is "met" when its data is materialized
 *    (count > 0) — i.e. the capability has actually been exercised.
 *  - Dimension score = round(met / declared signals * 100).
 *  - A product that declares NO real signal for a dimension reports
 *    `available:false` ("not measurable for this product") — it is NEVER scored 0
 *    or fabricated, and is EXCLUDED from the overall mean.
 *  - Overall readiness = mean of AVAILABLE dimension scores only.
 * Empty (early-stage) products therefore read low but HONESTLY — that is a true
 * finding, not a bug; do not seed fake rows to lift a score.
 *
 * TREND + HISTORY are derived from explicitly-captured snapshots
 * (`readiness_snapshots`). A GET never writes. Capture is an explicit POST.
 * With < 2 snapshots, trend is honestly `available:false` (insufficient history).
 *
 * GET  /api/admin/readiness                 — all products summary (live compute)
 * GET  /api/admin/readiness/dimensions      — dimension catalogue
 * GET  /api/admin/readiness/:key            — full product (gauge + dims + trend + history)
 * GET  /api/admin/readiness/:key/history    — snapshot time series
 * POST /api/admin/readiness/snapshot        — capture snapshots for ALL products
 * (?refresh=1 busts the 60s cache on GETs)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const TTL_MS = 60_000;
const CACHE = new Map<string, { at: number; data: any }>();

async function rows(pool: Pool, sql: string, params: any[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
async function count(pool: Pool, table: string, where?: string): Promise<number | null> {
  const r = await rows(pool, `SELECT count(*)::int AS n FROM ${table}${where ? ' WHERE ' + where : ''}`);
  return r ? Number(r[0].n) : null;
}

// ── dimension catalogue (the 8 measured axes) ───────────────────────────────
type DimKey =
  | 'structural' | 'activation' | 'data' | 'intelligence'
  | 'commercial' | 'operations' | 'security' | 'governance';

const DIMENSIONS: { key: DimKey; label: string; description: string }[] = [
  { key: 'structural',   label: 'Structural',   description: 'Config / reference schema materialized' },
  { key: 'activation',   label: 'Activation',   description: 'Runtime is switched on with live data' },
  { key: 'data',         label: 'Data',         description: 'User-facing data corpus exists' },
  { key: 'intelligence', label: 'Intelligence', description: 'Derived / computed outputs exist' },
  { key: 'commercial',   label: 'Commercial',   description: 'Monetization surface materialized' },
  { key: 'operations',   label: 'Operations',   description: 'Operational mechanisms exercised' },
  { key: 'security',     label: 'Security',      description: 'Security controls exercised' },
  { key: 'governance',   label: 'Governance',   description: 'Governance controls exercised' },
];

// ── product / signal model ──────────────────────────────────────────────────
interface Signal { label: string; table: string; where?: string }
interface ProductDef {
  key: string;
  name: string;
  tagline: string;
  tab: string;
  /** partial: a missing dimension is honestly `available:false` for this product */
  dims: Partial<Record<DimKey, Signal[]>>;
}

// Every table referenced below was verified to exist in this database. Signals
// are intentionally sparse where no real source exists — those dimensions report
// available:false rather than a fabricated score.
const PRODUCTS: Record<string, ProductDef> = {
  capadex: {
    key: 'capadex', name: 'CAPADEX', tab: 'cc-capadex',
    tagline: 'Behavioural concern assessment & runtime intelligence',
    dims: {
      // Structural = config/reference only. Signal profiles + linguistic signals
      // are per-session RUNTIME captures, so they belong in Data/Intelligence — not here.
      structural: [
        { label: 'Clarity Questions', table: 'capadex_clarity_questions' },
        { label: 'Question Registry', table: 'capadex_question_registry' },
      ],
      activation: [{ label: 'Runtime Sessions', table: 'capadex_session_telemetry' }],
      data: [
        { label: 'Session Telemetry', table: 'capadex_session_telemetry' },
        { label: 'Linguistic Signals', table: 'capadex_linguistic_signals' },
      ],
      intelligence: [
        { label: 'Captured Signals', table: 'capadex_session_signals' },
        { label: 'Signal Profiles', table: 'capadex_signal_profiles' },
      ],
      commercial: [{ label: 'Stage Pricing', table: 'capadex_stage_pricing' }],
      // operations/security/governance: no CAPADEX-specific source → not measurable.
    },
  },
  competency: {
    key: 'competency', name: 'Competency Intelligence', tab: 'cc-competency',
    tagline: 'Competency DNA, scoring science & outcome prediction',
    dims: {
      structural: [
        { label: 'Competency DNA Master', table: 'competency_dna_master' },
        { label: 'Signal Master', table: 'ti_signal_master' },
        { label: 'Scoring Formulas', table: 'ti_scoring_formulas' },
        { label: 'Score Bands', table: 'ti_score_bands' },
      ],
      activation: [{ label: 'Assessments', table: 'ti_fact_assessments' }],
      data: [{ label: 'Assessments', table: 'ti_fact_assessments' }],
      intelligence: [
        { label: 'Readiness Facts', table: 'ti_fact_readiness' },
        { label: 'Outcome Predictions', table: 'ti_outcome_predictions' },
      ],
    },
  },
  lbi: {
    key: 'lbi', name: 'LBI', tab: 'cc-lbi',
    tagline: 'Life Balance Index assessment & longitudinal scoring',
    dims: {
      structural: [{ label: 'Report Types', table: 'lbi_report_types' }],
      activation: [{ label: 'Score History', table: 'lbi_score_history' }],
      data: [{ label: 'Score History', table: 'lbi_score_history' }],
      intelligence: [{ label: 'Score History', table: 'lbi_score_history' }],
    },
  },
  ei: {
    key: 'ei', name: 'Employability Intelligence', tab: 'cc-employability',
    tagline: 'Future-readiness, AI-impact & skill-evolution forecasting',
    dims: {
      structural: [
        { label: 'Skill Taxonomy', table: 'frp_skill_taxonomy' },
        { label: 'Skill Library', table: 'frp_skill_library' },
        { label: 'Benchmarks', table: 'frp_benchmarks' },
        { label: 'Future Competency Map', table: 'frp_future_competency_map' },
      ],
      activation: [{ label: 'User Readiness', table: 'frp_user_readiness' }],
      data: [{ label: 'User Skill Profiles', table: 'frp_user_skill_profile' }],
      intelligence: [
        { label: 'User Readiness', table: 'frp_user_readiness' },
        { label: 'Role Evolution', table: 'frp_role_evolution' },
      ],
    },
  },
  career: {
    key: 'career', name: 'Career Builder', tab: 'cc-career',
    tagline: 'Career graph, readiness, recommendations & pathways',
    dims: {
      structural: [
        { label: 'Roles', table: 'cg_roles' },
        { label: 'Tracks', table: 'cg_tracks' },
        { label: 'Skill Requirements', table: 'cg_skill_requirements' },
        { label: 'Role Edges', table: 'cg_role_edges' },
      ],
      activation: [{ label: 'User Readiness', table: 'cg_user_role_readiness' }],
      data: [{ label: 'User Readiness', table: 'cg_user_role_readiness' }],
      intelligence: [
        { label: 'Recommendations', table: 'cg_user_recommendations' },
        { label: 'Skill Gaps', table: 'cg_user_skill_gaps' },
        { label: 'Career Paths', table: 'cg_user_career_path' },
      ],
    },
  },
  employer: {
    key: 'employer', name: 'Employer Intelligence OS', tab: 'cc-employer',
    tagline: 'Hiring, workforce planning & talent intelligence graph',
    dims: {
      // Structural = config/reference only (role libraries). TIG clusters are a
      // DERIVED talent-graph artifact → Intelligence, not Structural.
      structural: [
        { label: 'Competency Roles (Employer)', table: 'employer_competency_roles' },
        { label: 'Competency Roles (EIOS)', table: 'eios_competency_roles' },
      ],
      activation: [{ label: 'Organizations', table: 'employer_organizations' }],
      data: [
        { label: 'Members', table: 'employer_members' },
        { label: 'Employee Profiles', table: 'eios_employee_profiles' },
      ],
      intelligence: [
        { label: 'Hiring Assessments', table: 'ep98_hiring_assessments' },
        { label: 'Talent Graph Nodes', table: 'tig_nodes' },
        { label: 'Workforce Plans', table: 'eios_workforce_plans' },
        { label: 'TIG Clusters', table: 'tig_clusters' },
      ],
      commercial: [{ label: 'Organizations', table: 'employer_organizations', where: 'verified IS TRUE' }],
      operations: [{ label: 'Campaigns', table: 'eios_campaigns' }],
      security: [{ label: 'Risk Events Monitored', table: 'employer_risk_events' }],
    },
  },
  platform: {
    key: 'platform', name: 'Platform', tab: 'mission-control',
    tagline: 'Cross-cutting platform: identity, governance, security & ops',
    dims: {
      structural: [{ label: 'Feature Flags', table: 'feature_flags' }],
      activation: [{ label: 'Active Sessions', table: 'express_sessions' }],
      data: [
        { label: 'Users', table: 'users' },
        { label: 'Candidate Profiles', table: 'cra_profiles' },
        { label: 'Question Bank', table: 'question_bank' },
      ],
      intelligence: [{ label: 'Generated Reports', table: 'rf_master' }],
      commercial: [{ label: 'Stage Pricing', table: 'capadex_stage_pricing' }],
      operations: [{ label: 'Bulk Upload Jobs', table: 'bulk_upload_jobs' }],
      security: [
        { label: 'MFA Codes Issued', table: 'mfa_codes' },
        { label: 'Crisis Escalations', table: 'rie_escalations' },
      ],
      governance: [
        { label: 'Governance Policies', table: 'aig_governance_policies' },
        { label: 'Alert Rules', table: 'aig_alerts' },
        { label: 'Hallucination Monitoring', table: 'aig_hallucination_flags' },
        { label: 'Workflow Runs', table: 'aig_workflow_runs' },
      ],
    },
  },
};

// ── readiness math ──────────────────────────────────────────────────────────
function band(score: number): 'ready' | 'partial' | 'early' | 'idle' {
  if (score >= 75) return 'ready';
  if (score >= 40) return 'partial';
  if (score > 0) return 'early';
  return 'idle';
}

async function buildDimension(pool: Pool, dimKey: DimKey, signals: Signal[] | undefined) {
  const meta = DIMENSIONS.find(d => d.key === dimKey)!;
  if (!signals || signals.length === 0) {
    return {
      key: dimKey, label: meta.label, description: meta.description,
      available: false, reason: 'not_measurable_for_product',
      score: null as number | null, band: 'unavailable', met: 0, total: 0, signals: [],
    };
  }
  const detail = [];
  let met = 0;
  for (const s of signals) {
    const n = await count(pool, s.table, s.where);
    const ok = n != null && n > 0;
    if (ok) met++;
    detail.push({ label: s.label, table: s.table, n, met: ok, queryable: n != null });
  }
  const score = Math.round(met / signals.length * 100);
  return {
    key: dimKey, label: meta.label, description: meta.description,
    available: true, score, band: band(score), met, total: signals.length, signals: detail,
  };
}

async function buildProduct(pool: Pool, p: ProductDef) {
  const dims = [];
  for (const d of DIMENSIONS) {
    dims.push(await buildDimension(pool, d.key, p.dims[d.key]));
  }
  const measured = dims.filter(d => d.available && d.score != null);
  const overall = measured.length
    ? Math.round(measured.reduce((a, d) => a + (d.score || 0), 0) / measured.length)
    : null;
  return {
    key: p.key, name: p.name, tagline: p.tagline, tab: p.tab,
    overall_score: overall,
    overall_band: overall == null ? 'unavailable' : band(overall),
    measured_dimensions: measured.length,
    total_dimensions: DIMENSIONS.length,
    dimensions: dims,
    generated_at: new Date().toISOString(),
  };
}

async function cachedProduct(pool: Pool, p: ProductDef, refresh: boolean) {
  const now = Date.now();
  const hit = CACHE.get(p.key);
  if (!refresh && hit && now - hit.at < TTL_MS) return hit.data;
  const data = await buildProduct(pool, p);
  CACHE.set(p.key, { at: now, data });
  return data;
}

// ── snapshot persistence (history + trend basis) ────────────────────────────
let schemaReady: Promise<void> | null = null;
function ensureSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS readiness_snapshots (
          id BIGSERIAL PRIMARY KEY,
          product_key TEXT NOT NULL,
          overall_score INTEGER,
          measured_dimensions INTEGER,
          dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
          captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_key_time
        ON readiness_snapshots (product_key, captured_at DESC)`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

async function buildHistory(pool: Pool, key: string, limit = 30) {
  const r = await rows(pool, `
    SELECT overall_score, measured_dimensions, dimensions,
           to_char(captured_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS captured_at
    FROM readiness_snapshots
    WHERE product_key = $1
    ORDER BY captured_at DESC LIMIT $2`, [key, limit]);
  if (r == null) return [];
  return r.map(x => ({
    overall_score: x.overall_score == null ? null : Number(x.overall_score),
    measured_dimensions: x.measured_dimensions == null ? null : Number(x.measured_dimensions),
    dimensions: x.dimensions || {},
    captured_at: x.captured_at,
  })).reverse(); // chronological for charting
}

function buildTrend(history: { overall_score: number | null; captured_at: string }[]) {
  const pts = history.filter(h => h.overall_score != null);
  if (pts.length < 2) {
    return { available: false, reason: 'insufficient_history', direction: 'none', current: null, previous: null, delta: null };
  }
  const current = pts[pts.length - 1].overall_score!;
  const previous = pts[pts.length - 2].overall_score!;
  const delta = current - previous;
  return {
    available: true,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    current, previous, delta,
    from: pts[pts.length - 2].captured_at, to: pts[pts.length - 1].captured_at,
  };
}

export function registerReadinessEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
) {
  const guards = [requireAuth, requireSuperAdmin];
  // Prepare the snapshot table once at registration (not on the request path).
  ensureSchema(pool).catch(() => { /* honest: history simply stays empty if DDL fails */ });

  const resolve = (req: Request, res: Response): ProductDef | null => {
    const p = PRODUCTS[String(req.params.key || '').toLowerCase()];
    if (!p) { res.status(404).json({ error: 'unknown_product', key: req.params.key }); return null; }
    return p;
  };

  // Dimension catalogue.
  app.get('/api/admin/readiness/dimensions', guards, (_req: Request, res: Response) => {
    res.json({ dimensions: DIMENSIONS });
  });

  // All-products summary (live compute, no snapshot).
  app.get('/api/admin/readiness', guards, async (req: Request, res: Response) => {
    try {
      const refresh = req.query.refresh === '1';
      const products = [];
      for (const p of Object.values(PRODUCTS)) {
        const d = await cachedProduct(pool, p, refresh);
        products.push({
          key: d.key, name: d.name, tagline: d.tagline, tab: d.tab,
          overall_score: d.overall_score, overall_band: d.overall_band,
          measured_dimensions: d.measured_dimensions, total_dimensions: d.total_dimensions,
          dimensions: d.dimensions.map((x: any) => ({ key: x.key, label: x.label, available: x.available, score: x.score, band: x.band })),
        });
      }
      res.json({ generated_at: new Date().toISOString(), products });
    } catch (e: any) {
      res.status(200).json({ products: [], status: 'error', error: String(e?.message || e) });
    }
  });

  // Snapshot history for a product (literal sub-path BEFORE the :key catch-all).
  app.get('/api/admin/readiness/:key/history', guards, async (req: Request, res: Response) => {
    const p = resolve(req, res); if (!p) return;
    try {
      await ensureSchema(pool);
      const limit = Math.max(1, Math.min(180, Number(req.query.limit) || 30));
      const history = await buildHistory(pool, p.key, limit);
      res.json({ key: p.key, name: p.name, count: history.length, history });
    } catch (e: any) {
      res.status(200).json({ key: p.key, count: 0, history: [], status: 'error', error: String(e?.message || e) });
    }
  });

  // Full product readiness (gauge + dimensions + trend + history).
  app.get('/api/admin/readiness/:key', guards, async (req: Request, res: Response) => {
    const p = resolve(req, res); if (!p) return;
    try {
      const data = await cachedProduct(pool, p, req.query.refresh === '1');
      let history: any[] = [];
      try { await ensureSchema(pool); history = await buildHistory(pool, p.key, 30); } catch { history = []; }
      const trend = buildTrend(history as any);
      res.json({ ...data, trend, history });
    } catch (e: any) {
      res.status(200).json({ key: p.key, name: p.name, overall_score: null, status: 'error', error: String(e?.message || e) });
    }
  });

  // Explicit snapshot capture for ALL products (the ONLY write path).
  app.post('/api/admin/readiness/snapshot', guards, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const captured = [];
      for (const p of Object.values(PRODUCTS)) {
        const data = await buildProduct(pool, p);
        const dimMap: Record<string, number | null> = {};
        for (const d of data.dimensions) dimMap[d.key] = d.available ? d.score : null;
        await pool.query(
          `INSERT INTO readiness_snapshots (product_key, overall_score, measured_dimensions, dimensions)
           VALUES ($1, $2, $3, $4)`,
          [p.key, data.overall_score, data.measured_dimensions, JSON.stringify(dimMap)]
        );
        captured.push({ key: p.key, overall_score: data.overall_score });
      }
      res.json({ captured_at: new Date().toISOString(), captured });
    } catch (e: any) {
      res.status(200).json({ captured: [], status: 'error', error: String(e?.message || e) });
    }
  });
}

/**
 * Health Aggregator — real-time platform health across 6 domains.
 *
 * READ-ONLY for measurement. NEVER-THROWS. NO DATA DUPLICATION.
 * Domains: Platform · Data · Assessment · API · DB · Security.
 *
 * HONESTY MODEL (matches platform convention — never fabricated / inflated):
 *  - Each domain runs a set of REAL checks. A check reports a status:
 *      ok | warn | fail   → contributes to the domain score (100 / 50 / 0)
 *      info               → displayed, but NOT scored (a fact, not a verdict)
 *      unknown            → the check could not be measured here (no source) and
 *                           is EXCLUDED from the score, never scored 0.
 *  - Domain status = fail if any check fails, else warn if any warns, else ok if
 *    any ok, else unknown (nothing measurable).
 *  - Domain score = mean of ok/warn/fail checks only. No scoring checks → null.
 * Empty / early-stage environments therefore read honestly — a low or unknown
 * score is a true finding, not a bug; do not seed rows to lift it.
 *
 * TREND + HISTORY come from explicitly-captured snapshots (`health_snapshots`).
 * A GET never writes; capture is an explicit POST. With < 2 snapshots trend is
 * honestly `available:false` (insufficient history). The live GETs power the
 * real-time widgets; the snapshot series powers the trend charts.
 *
 * GET  /api/admin/health               — all domains (live compute, 15s cache)
 * GET  /api/admin/health/:key/history  — snapshot time series for a domain
 * GET  /api/admin/health/:key          — full domain (checks + metrics + trend)
 * POST /api/admin/health/snapshot      — capture scores for ALL domains
 * (?refresh=1 busts the cache on GETs)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const TTL_MS = 15_000; // shorter than the 60s aggregators — this is "real-time"
const CACHE = new Map<string, { at: number; data: any }>();

async function safeRows(pool: Pool, sql: string, params: any[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
async function count(pool: Pool, table: string, where?: string): Promise<number | null> {
  const r = await safeRows(pool, `SELECT count(*)::int AS n FROM ${table}${where ? ' WHERE ' + where : ''}`);
  return r ? Number(r[0].n) : null;
}
/** time a trivial round-trip to the DB; null if it fails */
async function pingMs(pool: Pool): Promise<number | null> {
  const t0 = Date.now();
  try { await pool.query('SELECT 1'); return Date.now() - t0; } catch { return null; }
}

type CheckStatus = 'ok' | 'warn' | 'fail' | 'info' | 'unknown';
interface Check {
  label: string;
  status: CheckStatus;
  value: string | null;   // human-readable measured value
  detail: string | null;
}
const ok = (label: string, value: string | null, detail: string | null = null): Check => ({ label, status: 'ok', value, detail });
const warn = (label: string, value: string | null, detail: string | null = null): Check => ({ label, status: 'warn', value, detail });
const fail = (label: string, value: string | null, detail: string | null = null): Check => ({ label, status: 'fail', value, detail });
const info = (label: string, value: string | null, detail: string | null = null): Check => ({ label, status: 'info', value, detail });
const unknown = (label: string, detail: string | null = null): Check => ({ label, status: 'unknown', value: null, detail: detail || 'not measurable in this environment' });

/** ok above hi, warn above mid, else fail — for "lower is better" latency-style metrics */
function gradeLatency(label: string, ms: number | null, warnAt: number, failAt: number, unit = 'ms'): Check {
  if (ms == null) return fail(label, null, 'no response');
  const v = `${ms}${unit}`;
  if (ms >= failAt) return fail(label, v, `slower than ${failAt}${unit}`);
  if (ms >= warnAt) return warn(label, v, `slower than ${warnAt}${unit}`);
  return ok(label, v);
}
/** met/total populated → ok if all, warn if some, fail if none */
function gradeCoverage(label: string, met: number, total: number): Check {
  const v = `${met}/${total}`;
  if (total === 0) return unknown(label);
  if (met === total) return ok(label, v, 'all populated');
  if (met === 0) return fail(label, v, 'none populated');
  return warn(label, v, `${total - met} empty`);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1; let v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(1)} ${u[i]}`;
}
function fmtDuration(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

interface DomainDef {
  key: string;
  label: string;
  description: string;
  build: (pool: Pool) => Promise<Check[]>;
}

const DOMAINS: DomainDef[] = [
  // ── Platform Health ─────────────────────────────────────────────────────────
  {
    key: 'platform', label: 'Platform Health',
    description: 'Backend process, runtime & feature surface',
    async build(pool) {
      const checks: Check[] = [];
      // We are responding, so the process is up — report uptime + memory honestly.
      checks.push(ok('Backend process', 'online', `uptime ${fmtDuration(process.uptime())}`));
      const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
      checks.push(rssMb > 1536 ? warn('Process memory (RSS)', `${rssMb} MB`, 'elevated') : ok('Process memory (RSS)', `${rssMb} MB`));
      checks.push(info('Node runtime', process.version));
      const flags = await count(pool, 'feature_flags');
      checks.push(flags == null ? unknown('Feature flags registry') : flags > 0 ? ok('Feature flags registry', `${flags} flags`) : warn('Feature flags registry', '0 flags', 'no flags loaded'));
      const sess = await count(pool, 'express_sessions');
      checks.push(sess == null ? unknown('Session store') : ok('Session store', `${sess} active`, 'postgres-backed'));
      return checks;
    },
  },
  // ── Data Health ─────────────────────────────────────────────────────────────
  {
    key: 'data', label: 'Data Health',
    description: 'Reference corpus integrity & population',
    async build(pool) {
      const reference: { label: string; table: string }[] = [
        { label: 'Competency DNA', table: 'competency_dna_master' },
        { label: 'Signal Master', table: 'ti_signal_master' },
        { label: 'Clarity Questions', table: 'capadex_clarity_questions' },
        { label: 'Career Roles', table: 'cg_roles' },
        { label: 'Skill Library', table: 'frp_skill_library' },
        { label: 'Stage Pricing', table: 'capadex_stage_pricing' },
      ];
      let met = 0, total = 0;
      const detail: Check[] = [];
      for (const r of reference) {
        const n = await count(pool, r.table);
        if (n == null) { detail.push(unknown(`${r.label} table`)); continue; }
        total++; if (n > 0) met++;
        detail.push(n > 0 ? ok(`${r.label}`, `${n} rows`) : fail(`${r.label}`, '0 rows', 'empty reference table'));
      }
      const checks: Check[] = [gradeCoverage('Reference corpus populated', met, total), ...detail];
      // user-facing data presence (honest: empty in a fresh env)
      const users = await count(pool, 'users');
      checks.push(users == null ? unknown('User records') : users > 0 ? info('User records', `${users}`) : info('User records', '0', 'no users yet'));
      return checks;
    },
  },
  // ── Assessment Health ───────────────────────────────────────────────────────
  {
    key: 'assessment', label: 'Assessment Health',
    description: 'Assessment pipeline throughput & completion',
    async build(pool) {
      const checks: Check[] = [];
      const total = await count(pool, 'ti_fact_assessments');
      if (total == null) {
        checks.push(unknown('Assessment records'));
      } else if (total === 0) {
        checks.push(info('Assessment records', '0', 'no assessments run yet'));
      } else {
        checks.push(info('Assessment records', `${total}`));
        const done = await count(pool, 'ti_fact_assessments',
          "completion_status IS NOT NULL AND lower(completion_status) IN ('completed','complete','done','finished')");
        if (done != null) {
          const rate = Math.round((done / total) * 100);
          checks.push(rate >= 70 ? ok('Completion rate', `${rate}%`, `${done}/${total}`)
            : rate >= 40 ? warn('Completion rate', `${rate}%`, `${done}/${total}`)
            : fail('Completion rate', `${rate}%`, `${done}/${total}`));
        }
        const recent = await count(pool, 'ti_fact_assessments', "loaded_at > now() - interval '30 days'");
        if (recent != null) checks.push(recent > 0 ? ok('Recent activity (30d)', `${recent}`) : warn('Recent activity (30d)', '0', 'no recent assessments'));
      }
      const runtime = await count(pool, 'capadex_session_telemetry');
      checks.push(runtime == null ? unknown('CAPADEX runtime sessions') : runtime > 0 ? info('CAPADEX runtime sessions', `${runtime}`) : info('CAPADEX runtime sessions', '0', 'no runtime sessions yet'));
      return checks;
    },
  },
  // ── API Health ──────────────────────────────────────────────────────────────
  {
    key: 'api', label: 'API Health',
    description: 'Request-path responsiveness',
    async build(pool) {
      const checks: Check[] = [];
      // We are inside a successfully-served API request right now.
      checks.push(ok('API reachable', 'serving', 'this request succeeded'));
      const ms = await pingMs(pool);
      checks.push(gradeLatency('Data round-trip latency', ms, 150, 750));
      // No request/error log table exists → HTTP error rate is honestly unmeasurable.
      checks.push(unknown('HTTP error rate', 'no request-log table in this environment'));
      return checks;
    },
  },
  // ── DB Health ─────────────────────────────────────────────────────────────--
  {
    key: 'db', label: 'DB Health',
    description: 'Database connectivity, latency & pool',
    async build(pool) {
      const checks: Check[] = [];
      const ms = await pingMs(pool);
      checks.push(ms == null ? fail('Connectivity', null, 'SELECT 1 failed') : ok('Connectivity', 'connected'));
      checks.push(gradeLatency('Query latency', ms, 150, 750));
      // pg pool internals (best-effort; not all drivers expose these)
      const anyPool = pool as any;
      if (typeof anyPool.totalCount === 'number') {
        const totalC = anyPool.totalCount, idle = anyPool.idleCount ?? 0, waiting = anyPool.waitingCount ?? 0;
        checks.push(waiting > 0 ? warn('Connection pool', `${totalC} open / ${idle} idle`, `${waiting} waiting`) : ok('Connection pool', `${totalC} open / ${idle} idle`));
      } else {
        checks.push(unknown('Connection pool'));
      }
      const act = await safeRows(pool, `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`);
      if (act) checks.push(info('Active connections', `${Number(act[0].n)}`));
      const size = await safeRows(pool, `SELECT pg_database_size(current_database())::bigint AS b`);
      if (size) checks.push(info('Database size', fmtBytes(Number(size[0].b))));
      return checks;
    },
  },
  // ── Security Health ───────────────────────────────────────────────────────--
  {
    key: 'security', label: 'Security Health',
    description: 'Access controls, MFA & open risk',
    async build(pool) {
      const checks: Check[] = [];
      const su = await count(pool, 'users', "role = 'super_admin'");
      checks.push(su == null ? unknown('Super-admin account') : su > 0 ? ok('Super-admin account', `${su}`, 'privileged account present') : fail('Super-admin account', '0', 'no super-admin'));
      const mfa = await count(pool, 'mfa_codes');
      checks.push(mfa == null ? unknown('MFA mechanism') : ok('MFA mechanism', 'armed', `${mfa} codes issued`));
      const sess = await count(pool, 'express_sessions');
      checks.push(sess == null ? unknown('Active sessions') : info('Active sessions', `${sess}`));
      const esc = await count(pool, 'rie_escalations', "status IS NULL OR lower(status) NOT IN ('resolved','closed','dismissed')");
      if (esc != null) checks.push(esc > 0 ? warn('Open crisis escalations', `${esc}`, 'require attention') : ok('Open crisis escalations', '0'));
      const risk = await count(pool, 'employer_risk_events', 'resolved IS NOT TRUE');
      if (risk != null) checks.push(risk > 0 ? warn('Unresolved risk events', `${risk}`) : ok('Unresolved risk events', '0'));
      const gov = await count(pool, 'aig_governance_policies');
      checks.push(gov == null ? unknown('Governance policies') : gov > 0 ? ok('Governance policies', `${gov}`) : warn('Governance policies', '0', 'no policies defined'));
      return checks;
    },
  },
];

type DomainStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
function scoreOf(c: Check): number | null {
  if (c.status === 'ok') return 100;
  if (c.status === 'warn') return 50;
  if (c.status === 'fail') return 0;
  return null; // info / unknown excluded
}
function rollup(checks: Check[]): { status: DomainStatus; score: number | null; counts: Record<string, number> } {
  const counts = { ok: 0, warn: 0, fail: 0, info: 0, unknown: 0 } as Record<string, number>;
  for (const c of checks) counts[c.status]++;
  const scored = checks.map(scoreOf).filter((s): s is number => s != null);
  const score = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  let status: DomainStatus;
  if (counts.fail > 0) status = 'down';
  else if (counts.warn > 0) status = 'degraded';
  else if (counts.ok > 0) status = 'healthy';
  else status = 'unknown';
  return { status, score, counts };
}

async function buildDomain(pool: Pool, d: DomainDef) {
  let checks: Check[] = [];
  try { checks = await d.build(pool); } catch { checks = [unknown('Domain checks', 'measurement error')]; }
  const { status, score, counts } = rollup(checks);
  return {
    key: d.key, label: d.label, description: d.description,
    status, score, counts, checks,
    generated_at: new Date().toISOString(),
  };
}

async function cachedDomain(pool: Pool, d: DomainDef, refresh: boolean) {
  const now = Date.now();
  const hit = CACHE.get(d.key);
  if (!refresh && hit && now - hit.at < TTL_MS) return hit.data;
  const data = await buildDomain(pool, d);
  CACHE.set(d.key, { at: now, data });
  return data;
}

// ── snapshot persistence (trend basis) ────────────────────────────────────────
let schemaReady: Promise<void> | null = null;
function ensureSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS health_snapshots (
          id BIGSERIAL PRIMARY KEY,
          domain_key TEXT NOT NULL,
          score INTEGER,
          status TEXT,
          captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_health_snapshots_key_time
        ON health_snapshots (domain_key, captured_at DESC)`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

async function buildHistory(pool: Pool, key: string, limit = 60) {
  const r = await safeRows(pool, `
    SELECT score, status, to_char(captured_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS captured_at
    FROM health_snapshots WHERE domain_key = $1
    ORDER BY captured_at DESC LIMIT $2`, [key, limit]);
  if (r == null) return [];
  return r.map(x => ({
    score: x.score == null ? null : Number(x.score),
    status: x.status || null,
    captured_at: x.captured_at,
  })).reverse();
}

function buildTrend(history: { score: number | null }[]) {
  const pts = history.filter(h => h.score != null);
  if (pts.length < 2) return { available: false, reason: 'insufficient_history', direction: 'none', current: null, previous: null, delta: null };
  const current = pts[pts.length - 1].score!;
  const previous = pts[pts.length - 2].score!;
  const delta = current - previous;
  return { available: true, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', current, previous, delta };
}

export function registerHealthAggregatorRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
) {
  const guards = [requireAuth, requireSuperAdmin];
  ensureSchema(pool).catch(() => { /* honest: history stays empty if DDL fails */ });

  const resolve = (req: Request, res: Response): DomainDef | null => {
    const d = DOMAINS.find(x => x.key === String(req.params.key || '').toLowerCase());
    if (!d) { res.status(404).json({ error: 'unknown_domain', key: req.params.key }); return null; }
    return d;
  };

  // All-domains summary (live compute powering the real-time widgets).
  app.get('/api/admin/health', guards, async (req: Request, res: Response) => {
    try {
      const refresh = req.query.refresh === '1';
      const domains = [];
      for (const d of DOMAINS) domains.push(await cachedDomain(pool, d, refresh));
      const scored = domains.map(d => d.score).filter((s): s is number => s != null);
      const overall = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
      const anyDown = domains.some(d => d.status === 'down');
      const anyDegraded = domains.some(d => d.status === 'degraded');
      const overallStatus: DomainStatus = anyDown ? 'down' : anyDegraded ? 'degraded' : scored.length ? 'healthy' : 'unknown';
      res.json({ generated_at: new Date().toISOString(), overall_score: overall, overall_status: overallStatus, domains });
    } catch (e: any) {
      res.status(200).json({ domains: [], overall_score: null, overall_status: 'unknown', status: 'error', error: String(e?.message || e) });
    }
  });

  // Snapshot history (literal sub-path BEFORE the :key catch-all).
  app.get('/api/admin/health/:key/history', guards, async (req: Request, res: Response) => {
    const d = resolve(req, res); if (!d) return;
    try {
      await ensureSchema(pool);
      const limit = Math.max(1, Math.min(360, Number(req.query.limit) || 60));
      const history = await buildHistory(pool, d.key, limit);
      res.json({ key: d.key, label: d.label, count: history.length, history });
    } catch (e: any) {
      res.status(200).json({ key: d.key, count: 0, history: [], status: 'error', error: String(e?.message || e) });
    }
  });

  // Full domain detail (checks + metrics + trend + history).
  app.get('/api/admin/health/:key', guards, async (req: Request, res: Response) => {
    const d = resolve(req, res); if (!d) return;
    try {
      const data = await cachedDomain(pool, d, req.query.refresh === '1');
      let history: any[] = [];
      try { await ensureSchema(pool); history = await buildHistory(pool, d.key, 60); } catch { history = []; }
      const trend = buildTrend(history as any);
      res.json({ ...data, trend, history });
    } catch (e: any) {
      res.status(200).json({ key: d.key, label: d.label, score: null, status: 'unknown', error: String(e?.message || e) });
    }
  });

  // Explicit snapshot capture for ALL domains (the ONLY write path).
  app.post('/api/admin/health/snapshot', guards, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const captured = [];
      for (const d of DOMAINS) {
        const data = await buildDomain(pool, d);
        await pool.query(`INSERT INTO health_snapshots (domain_key, score, status) VALUES ($1, $2, $3)`,
          [d.key, data.score, data.status]);
        captured.push({ key: d.key, score: data.score, status: data.status });
      }
      res.json({ captured_at: new Date().toISOString(), captured });
    } catch (e: any) {
      res.status(200).json({ captured: [], status: 'error', error: String(e?.message || e) });
    }
  });
}

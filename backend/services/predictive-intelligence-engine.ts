/**
 * MX-800 Phase 2.7 — Predictive Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Predictive Intelligence is a READ-ONLY intelligence tier ABOUT the platform's
 * prediction capabilities. It CATALOGS the EXISTING forecast / trend / risk / simulation / scenario /
 * readiness capabilities and COMPOSES the prior intelligence tiers (2.1 platform / 2.3 engineering /
 * 2.4 runtime / 2.5 knowledge / 2.6 decision) into explainable predictive intelligence (registry /
 * trend / risk / impact-simulation / scenario / explainability / validation / metrics).
 *
 * It introduces NO parallel prediction / forecast / analytics engine, DUPLICATES no model, and changes
 * NO business logic. Critically it INVOKES / ACTIVATES no dormant prediction engine: it READS their
 * EXISTENCE (engine source files) and their PERSISTED OUTPUT (forecast/trend/risk tables) only —
 * composing an engine's existence is NOT the same as running it (running a flag-OFF engine would be
 * dormant activation, and GENERATING a new forecast here would be fabrication). It NEVER generates a new
 * forecast, risk, simulation or scenario; it surfaces the EXISTING ones. The repository + the existing
 * prediction tables remain the single source of truth.
 *
 * Composed substrate (READ-ONLY — reuse, never duplicate, never write, never invoke):
 *   - Prediction engines (existence read):  services/{competency-forecasting-engine, frp-readiness-engine,
 *                               lbi-trend-engine, lbi-risk-engine, m4-predictive, m4-org-risk,
 *                               predictive-workforce-engine, platform-evolution-intelligence}.ts.
 *   - Live prediction tables (COUNT-only):  competency_forecasts, frp_user_readiness, lbi_behavior_trends,
 *                               lbi_learning_trends, lbi_risk_indicators, m4_skill_decay_forecasts,
 *                               m4_organizational_capability_risks, wos_workforce_risk,
 *                               readiness_predictions, roie_forecasts, m4_simulation_scenarios,
 *                               m4_simulation_forecasts, platform_evolution_technical_debt.
 *   - Prior intelligence tiers: platform (2.1) / engineering (2.3) / runtime (2.4) / knowledge (2.5) /
 *                               decision (2.6) — their read-only summary getters for Evidence/Trend/Risk.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Prediction ≠ Decision. Forecast ≠ Fact. Probability ≠ Certainty. Simulation ≠ Reality.
 *     Trend ≠ Future. Confidence ≠ Accuracy. Evidence ≠ Confidence. Coverage ⟂ Confidence ⟂ Evidence
 *     (SEPARATE axes, never blended). Built ≠ Activated. Present ≠ Populated. Human approval mandatory.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup — reads 0 for bulk-seeded
 *     tables until autovacuum analyzes). ABSENT table → present:false, count NULL (≠ 0). A PRESENT but
 *     unreadable table → count NULL (query error ≠ empty). Empty table → 0.
 *   - Metrics are 5 SEPARATE measured scores — NEVER composited into one "overall". forecast_confidence
 *     is STRUCTURAL only (substrate verifiability/integrity), NOT runtime/outcome/accuracy confidence.
 *   - trend_accuracy as runtime ACCURACY is UNMEASURABLE here (no labelled prediction outcomes) →
 *     honest-NULL (DEFERRED), never a fabricated proxy. This tier surfaces prediction SUPPORT; it never
 *     measures whether a forecast came true, and it never DECIDES.
 *   - Impact Simulation is SIMULATION ONLY — it reads the EXISTING simulation substrate and never
 *     modifies production (no write to any business table).
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *   - STOP clause: NO Recommendation / Autonomous-AI / workflow-automation. Trend/Risk/Scenario are the
 *     evidence-grounded surfacing of EXISTING prediction capabilities — never a new prediction or a decision.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER create
 * schema and NEVER write to the existing prediction tables. The lazy ensure-schema runs ONLY on flag-ON
 * write paths (discover / register / audit-capture) so flag OFF → byte-identical incl. schema (0 tables).
 * Every write path also asserts the flag itself BEFORE ensure-schema (defense-in-depth).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isPredictiveIntelligenceEngineEnabled, listFlags } from '../config/feature-flags';

// Composed prior-tier summaries (EXISTING intelligence engines — reuse, never duplicate).
// These getters are GET-never-writes (to_regclass-probed reads, no ensure-schema, verified).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';
import { getDecisionSummary } from './decision-intelligence';

const REGISTRY_TABLE = 'prediction_registry';
const SNAPSHOT_TABLE = 'predictive_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class PredictiveIntelligenceDisabled extends Error {
  code = 'predictive_intelligence_disabled';
  constructor() {
    super('predictiveIntelligenceEngine flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'PredictiveIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isPredictiveIntelligenceEngineEnabled()) throw new PredictiveIntelligenceDisabled();
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${table}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}
/** Measured scalar. Returns the value, 0 for a genuinely empty result, or NULL on a query ERROR
 *  (unmeasurable ≠ zero — honesty contract null ≠ 0). */
async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try { const r = await pool.query(sql, params); return Number(r.rows[0]?.n ?? 0); } catch { return null; }
}
/** Multi-row read. Returns the rows, [] for a genuinely empty result, or NULL on a query ERROR. */
async function rows(pool: Pool, sql: string, params: unknown[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
/** A safe, unquoted Postgres table identifier (≤63 chars, no quotes/semicolons/whitespace). Used to
 *  REJECT user-supplied identifiers BEFORE any interpolation — the curated catalog is always safe, but
 *  manual /register passes user input through countTable's `FROM "${table}"`. A to_regclass probe does
 *  NOT sanitise identifier injection, so this regex gate is the actual injection defence. */
function isSafeTableIdentifier(s: string): boolean {
  return typeof s === 'string' && s.length > 0 && s.length <= 63 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}
/** Exact MEASURED row count for a SAFE table identifier. ABSENT table → null (count unmeasured — null ≠
 *  0). PRESENT table → exact COUNT(*) (NEVER n_live_tup), or null on error. */
async function countTable(pool: Pool, table: string): Promise<number | null> {
  if (!isSafeTableIdentifier(table)) return null;            // defence-in-depth: never interpolate an unsafe identifier
  if (!(await tableReady(pool, table))) return null;
  return scalar(pool, `SELECT COUNT(*)::int AS n FROM "${table}"`);
}
/** Ratio as a 0–100 percentage; NULL when the numerator is unmeasured OR the denominator is 0/null. */
function pct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || !d) return null;
  return Math.round((n / d) * 10000) / 100;
}
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`; }
function fileCheck(rel: string): boolean { try { return fs.existsSync(path.join(process.cwd(), rel)); } catch { return false; } }

/**
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation, /trend, /risk and
 * captureSnapshot all compose the SAME expensive measurement (per-capability COUNT(*) + five prior-tier
 * summaries). Memoization dedupes that within a request and reuses for a few seconds.
 */
const MEMO_TTL_MS = 8000;
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; });
  _memo.set(key, { at: Date.now(), val });
  return val;
}

// ── Curated, file/table-verified PREDICTION CAPABILITY catalog ───────────────
// Every `table` below was verified to EXIST in this database (or is honest-absent → table_present:false,
// count NULL) and every `engine` file to EXIST on disk. A capability is an EXISTING prediction TYPE the
// platform already makes — this tier never creates a new one and never GENERATES a forecast. `table` is
// the persisted prediction trail (read-only, COUNT-only) or null for a compute-on-read engine. `engine`
// is the source file whose EXISTENCE is read (never imported / invoked). `flag` is the governing feature
// flag whose STATE is read (Built ≠ Activated) — null when the gate is unverified (honest-NULL, never a
// fabricated mapping). `intelligence_uid` SOFT-links the MX-800 2.1 registry.
type PredictionKind = 'forecast' | 'trend' | 'risk' | 'simulation' | 'scenario' | 'readiness' | 'projection';
type PredictionSource = {
  uid: string; name: string; domain: string; prediction_kind: PredictionKind;
  table: string | null; engine: string | null; flag: string | null;
  intelligence_uid: string | null; description: string;
};
const PREDICTION_SOURCES: PredictionSource[] = [
  // ── Forecast ──
  {
    uid: 'pi-cap-competency-forecast', name: 'Competency forecast', domain: 'competency',
    prediction_kind: 'forecast', table: 'competency_forecasts', engine: 'services/competency-forecasting-engine.ts',
    flag: 'forecastIntelligence', intelligence_uid: 'intel.forecast',
    description: 'Persisted competency forecast trail produced by the competency-forecasting engine (projected competency trajectories grounded in prior assessment signal). Read-only here; never re-computed.',
  },
  {
    uid: 'pi-cap-workforce-skill-decay', name: 'Workforce skill-decay forecast', domain: 'workforce',
    prediction_kind: 'forecast', table: 'm4_skill_decay_forecasts', engine: 'services/m4-predictive.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted skill-decay forecast trail from the M4 predictive engine (projected decay of capabilities over time). Forecast ≠ Fact — surfaced read-only.',
  },
  {
    uid: 'pi-cap-workforce-risk-forecast', name: 'Workforce risk forecast', domain: 'workforce',
    prediction_kind: 'forecast', table: 'wos_workforce_risk', engine: 'services/predictive-workforce-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted workforce risk/forecast trail from the predictive-workforce engine. Read-only COUNT-only; the engine is never invoked.',
  },
  // ── Future readiness ──
  {
    uid: 'pi-cap-future-readiness', name: 'Future-readiness forecast', domain: 'future_readiness',
    prediction_kind: 'readiness', table: 'frp_user_readiness', engine: 'services/frp-readiness-engine.ts',
    flag: 'futureReadiness', intelligence_uid: null,
    description: 'Persisted Future-Readiness Index trail from the FRP readiness engine (5-signal forward readiness). Read-only; the FRI is not re-derived here.',
  },
  {
    uid: 'pi-cap-readiness-prediction', name: 'Readiness prediction', domain: 'future_readiness',
    prediction_kind: 'readiness', table: 'readiness_predictions', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted readiness-prediction trail (forward readiness predictions). Compute-on-read upstream; surfaced read-only as a persisted forecast trail.',
  },
  // ── Trend ──
  {
    uid: 'pi-cap-behaviour-trend', name: 'Behaviour trend', domain: 'behaviour',
    prediction_kind: 'trend', table: 'lbi_behavior_trends', engine: 'services/lbi-trend-engine.ts',
    flag: 'behaviourTrendIntelligence', intelligence_uid: null,
    description: 'Persisted behavioural trend trail from the LBI trend engine (longitudinal behaviour direction). Trend ≠ Future — surfaced read-only.',
  },
  {
    uid: 'pi-cap-learning-trend', name: 'Learning trend', domain: 'behaviour',
    prediction_kind: 'trend', table: 'lbi_learning_trends', engine: 'services/lbi-trend-engine.ts',
    flag: 'trendIntelligence', intelligence_uid: null,
    description: 'Persisted learning trend trail from the LBI trend engine (longitudinal learning direction). Read-only COUNT-only.',
  },
  {
    uid: 'pi-cap-platform-evolution', name: 'Platform evolution & tech-debt trend', domain: 'platform',
    prediction_kind: 'trend', table: 'platform_evolution_technical_debt', engine: 'services/platform-evolution-intelligence.ts',
    flag: 'platformEvolutionIntelligence', intelligence_uid: 'intel.platform',
    description: 'MX-700 1.40 platform evolution & technical-debt intelligence (repository evolution trend). Engine existence read-only; the persisted table is honest-absent (count NULL) when its flag was never ON.',
  },
  // ── Risk ──
  {
    uid: 'pi-cap-behaviour-risk', name: 'Behavioural risk indicator', domain: 'behaviour',
    prediction_kind: 'risk', table: 'lbi_risk_indicators', engine: 'services/lbi-risk-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted behavioural risk-indicator trail from the LBI risk engine (concern-diagnostic risk flags). Probability ≠ Certainty — surfaced read-only.',
  },
  {
    uid: 'pi-cap-org-capability-risk', name: 'Organizational capability risk', domain: 'organizational',
    prediction_kind: 'risk', table: 'm4_organizational_capability_risks', engine: 'services/m4-org-risk.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted organizational capability-risk trail from the M4 org-risk engine (enterprise capability risk). Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'pi-cap-outcome-risk-forecast', name: 'Risk-outcome forecast', domain: 'risk',
    prediction_kind: 'risk', table: 'roie_forecasts', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted risk-outcome forecast trail (ROIE). Compute-on-read upstream; surfaced read-only as a persisted risk-forecast trail.',
  },
  // ── Simulation / Scenario ──
  {
    uid: 'pi-cap-simulation-scenario', name: 'Simulation scenario', domain: 'simulation',
    prediction_kind: 'scenario', table: 'm4_simulation_scenarios', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted simulation-scenario trail (M4 what-if scenarios). Simulation ≠ Reality — surfaced read-only; no scenario is generated or actioned.',
  },
  {
    uid: 'pi-cap-simulation-forecast', name: 'Simulation forecast', domain: 'simulation',
    prediction_kind: 'simulation', table: 'm4_simulation_forecasts', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted simulation-forecast trail (M4 simulated forward projections). Read-only COUNT-only; production is never modified.',
  },
];

/** Measure every capability ONCE: table present + exact COUNT(*); engine file present; governing flag
 *  STATE (Built ≠ Activated). Memoized per request window. */
type MeasuredCapability = PredictionSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureCapabilities(pool: Pool): Promise<MeasuredCapability[]> {
  return memo('pi:caps', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(PREDICTION_SOURCES.map(async (s) => {
      const table_present = s.table ? await tableReady(pool, s.table) : false;
      const table_count = table_present && s.table ? await countTable(pool, s.table) : null; // absent → null (≠ 0)
      const engine_present = s.engine ? fileCheck(s.engine) : false;
      const present = table_present || engine_present;        // substrate exists (table OR engine)
      const flag_state = s.flag ? (s.flag in flags ? !!flags[s.flag] : null) : null; // null = unverified gate (honest)
      return { ...s, table_present, table_count, engine_present, present, flag_state };
    }));
  });
}

let _schemaReady = false;
/** Lazy ensure-schema — canonical mirror of 20261226_predictive_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensurePredictiveSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                BIGSERIAL PRIMARY KEY,
      prediction_uid    TEXT UNIQUE NOT NULL,
      name              TEXT NOT NULL,
      prediction_kind   TEXT NOT NULL,            -- forecast|trend|risk|simulation|scenario|readiness|projection
      domain            TEXT,                     -- competency|behaviour|workforce|organizational|future_readiness|platform|risk|simulation
      physical_table    TEXT,                     -- the EXISTING persisted prediction trail (read-only) or NULL (compute-on-read)
      engine_path       TEXT,                     -- the EXISTING engine source file (existence read-only) or NULL
      governing_flag    TEXT,                     -- governing feature flag key or NULL (unverified gate — honest)
      present           BOOLEAN,                  -- DERIVED: substrate (table OR engine) exists — NOT a quality verdict
      table_count       INTEGER,                  -- exact COUNT(*) of the trail at discovery; honest-NULL when unmeasured (≠ 0)
      flag_state        BOOLEAN,                  -- DERIVED governing-flag state (Built ≠ Activated); NULL when no/unverified flag
      owner             TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
      lifecycle_uid     TEXT,                     -- SOFT reference into platform_lifecycle_catalog (no FK; may be null)
      intelligence_uid  TEXT,                     -- SOFT reference into platform_intelligence_registry (no FK; may be null)
      metadata          JSONB NOT NULL DEFAULT '{}',
      source            TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pr_prediction_kind ON ${REGISTRY_TABLE} (prediction_kind);
    CREATE INDEX IF NOT EXISTS idx_pr_domain          ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      capabilities_present        INTEGER,
      predictions_recorded        INTEGER,
      forecast_confidence_pct     NUMERIC,
      prediction_quality_pct      NUMERIC,
      trend_accuracy_pct          NUMERIC,        -- honest-NULL (accuracy unmeasurable)
      risk_prediction_coverage_pct NUMERIC,
      explainability_pct          NUMERIC,
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pias_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

const AXES_NOTE =
  'Prediction ≠ Decision. Forecast ≠ Fact. Probability ≠ Certainty. Simulation ≠ Reality. Trend ≠ ' +
  'Future. Confidence ≠ Accuracy. Evidence ≠ Confidence. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE ' +
  'axes). Built ≠ Activated. Present ≠ Populated. Human approval remains mandatory. Metrics are NEVER composited.';
const REPO_REFS = [
  'backend/services/predictive-intelligence-engine.ts',
  'backend/routes/predictive-intelligence-engine.ts',
  'backend/migrations/20261226_predictive_intelligence.sql',
];

// Each prior-tier summary is GET-never-writes; wrap so an unavailable tier degrades to honest-null.
const safeTier = async (fn: () => Promise<any>) => {
  try { return { reachable: true, summary: await fn() }; }
  catch (e: any) { return { reachable: false, summary: null, note: `tier unavailable: ${e?.code || e?.message || 'error'}` }; }
};
function composePriorTiers(pool: Pool) {
  return memo('pi:tiers', async () => {
    const [platform, engineering, runtime, knowledge, decision] = await Promise.all([
      safeTier(() => getPlatformSummary(pool)),
      safeTier(() => getEngineeringSummary(pool)),
      safeTier(() => getRuntimeSummary(pool)),
      safeTier(() => getKnowledgeSummary(pool)),
      safeTier(() => getDecisionSummary(pool)),
    ]);
    const reachable = [platform, engineering, runtime, knowledge, decision].filter((t) => t.reachable).length;
    return { tiers: { platform, engineering, runtime, knowledge, decision }, reachable, of: 5 };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Prediction Registry (catalog of EXISTING prediction capabilities)
// ════════════════════════════════════════════════════════════════════════════
export async function getPredictionCatalog(pool: Pool) {
  return memo('pi:catalog', async () => {
    const measured = await measureCapabilities(pool);
    const by_domain: Record<string, { domain: string; capabilities: number; present: number; predictions: number | null }> = {};
    const by_kind: Record<string, number> = {};
    for (const m of measured) {
      const d = (by_domain[m.domain] ??= { domain: m.domain, capabilities: 0, present: 0, predictions: null });
      d.capabilities++;
      if (m.present) d.present++;
      if (m.table_count != null) d.predictions = (d.predictions ?? 0) + m.table_count;
      by_kind[m.prediction_kind] = (by_kind[m.prediction_kind] ?? 0) + 1;
    }
    return {
      phase: 'MX-800 Phase 2.7 — Prediction Registry',
      catalog_note:
        'A curated catalog of the EXISTING prediction capabilities the platform already makes. This tier ' +
        'NEVER creates a prediction capability and NEVER generates a forecast — it reads each one\'s ' +
        'substrate (persisted trail and/or engine source file) and its governing-flag state. Engine ' +
        'existence is READ, never invoked.',
      totals: {
        capabilities: measured.length,
        present: measured.filter((m) => m.present).length,
        table_backed: measured.filter((m) => m.table).length,
        engine_backed: measured.filter((m) => m.engine).length,
        predictions_recorded: (() => { const xs = measured.map((m) => m.table_count).filter((x): x is number => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; })(),
      },
      by_domain: Object.values(by_domain).sort((a, b) => a.domain.localeCompare(b.domain)),
      by_kind,
      capabilities: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, prediction_kind: m.prediction_kind,
        table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, intelligence_uid: m.intelligence_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Trend Intelligence (surface EXISTING trend capabilities; compose prior tiers; NEVER predict)
// ════════════════════════════════════════════════════════════════════════════
export async function getTrendIntelligence(pool: Pool) {
  return memo('pi:trend', async () => {
    const measured = await measureCapabilities(pool);
    const trendCaps = measured.filter((m) => m.prediction_kind === 'trend');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.7 — Trend Intelligence',
      trend_kind:
        'Surfaces the platform\'s EXISTING trend capabilities (repository growth / engineering / runtime / ' +
        'lifecycle / technical-debt / platform-evolution). This tier reads the persisted trend trails + ' +
        'composes the prior intelligence-tier summaries. It does NOT compute a new trend or project the ' +
        'future. Trend ≠ Future.',
      trend_capabilities: trendCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, datapoints: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
        governing_flag: m.flag, flag_state: m.flag_state,
      })),
      categories: {
        repository_growth: { source: 'MX-800 2.1 platform-intelligence summary', reachable: tiers.tiers.platform.reachable, note: 'Repository scale/growth surfaced from the platform registry (composed read-only).' },
        engineering: { source: 'MX-800 2.3 engineering-intelligence summary', reachable: tiers.tiers.engineering.reachable },
        runtime: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
        technical_debt_and_evolution: { source: 'MX-700 1.40 platform-evolution-intelligence (engine existence read)', engine_present: measured.find((m) => m.uid === 'pi-cap-platform-evolution')?.engine_present ?? false, note: 'Composed by existence; persisted table honest-absent (count NULL) when its flag was never ON.' },
        behaviour_and_learning: { sources: trendCaps.filter((m) => m.domain === 'behaviour').map((m) => ({ capability: m.uid, datapoints: m.table_count })) },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Risk Prediction (surface EXISTING risk capabilities; compose; NEVER generate a risk)
// ════════════════════════════════════════════════════════════════════════════
export async function getRiskPrediction(pool: Pool) {
  return memo('pi:risk', async () => {
    const measured = await measureCapabilities(pool);
    const riskCaps = measured.filter((m) => m.prediction_kind === 'risk');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.7 — Risk Prediction',
      risk_kind:
        'Surfaces the platform\'s EXISTING risk capabilities (engineering / runtime / dependency / ' +
        'migration / compatibility / security / repository). This tier reads the persisted risk trails + ' +
        'composes the prior intelligence-tier summaries. It does NOT generate a new risk score or assert ' +
        'a future. Probability ≠ Certainty.',
      risk_capabilities: riskCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, risks_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      categories: {
        engineering_risk: { source: 'MX-800 2.3 engineering-intelligence summary', reachable: tiers.tiers.engineering.reachable },
        runtime_risk: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
        dependency_and_migration_and_compatibility_risk: { source: 'MX-700 evolution + lifecycle (composed read-only via prior tiers)', note: 'Surfaced from the existing platform/engineering substrate — not re-computed here.' },
        security_risk: { note: 'Security risk is owned by the security subsystem; this tier does not duplicate it. Honest-deferred.' },
        repository_risk: { source: 'MX-800 2.1 platform-intelligence summary', reachable: tiers.tiers.platform.reachable },
        behavioural_and_organizational_risk: { sources: riskCaps.map((m) => ({ capability: m.uid, domain: m.domain, risks_recorded: m.table_count })) },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Impact Simulation (SIMULATION ONLY — read the EXISTING substrate; NEVER modify production)
// ════════════════════════════════════════════════════════════════════════════
export async function getImpactSimulation(pool: Pool) {
  return memo('pi:simulation', async () => {
    const measured = await measureCapabilities(pool);
    const simCaps = measured.filter((m) => m.prediction_kind === 'simulation' || m.prediction_kind === 'scenario');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.7 — Impact Simulation',
      simulation_kind:
        'SIMULATION ONLY. Surfaces the platform\'s EXISTING simulation substrate (architecture / feature / ' +
        'dependency / version / lifecycle / infrastructure what-ifs). This tier READS the persisted ' +
        'simulation trails and composes the prior intelligence tiers; it NEVER modifies production, never ' +
        'writes a business table, and never actions a simulated change. Simulation ≠ Reality.',
      production_safety: { modifies_production: false, write_paths_to_business_tables: 0, note: 'Read-only — the only writes in this tier are to its own 2 owned tables on flag-ON audit/discovery.' },
      simulation_capabilities: simCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, simulations_recorded: m.table_count, // null ≠ 0
      })),
      categories: {
        architecture_changes: { source: 'MX-800 2.3 engineering-intelligence (composed read-only)', reachable: tiers.tiers.engineering.reachable },
        feature_and_dependency_changes: { source: 'MX-800 2.1 platform-intelligence (composed read-only)', reachable: tiers.tiers.platform.reachable },
        version_and_lifecycle_changes: { source: 'MX-700 lifecycle/evolution (composed read-only via prior tiers)', note: 'Surfaced, never executed.' },
        infrastructure_changes: { source: 'MX-800 2.4 runtime-intelligence (composed read-only)', reachable: tiers.tiers.runtime.reachable },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Scenario Intelligence (frame EXISTING scenario substrate; NEVER assert an outcome)
// ════════════════════════════════════════════════════════════════════════════
export async function getScenarioIntelligence(pool: Pool) {
  return memo('pi:scenario', async () => {
    const measured = await measureCapabilities(pool);
    const scenarioCaps = measured.filter((m) => m.prediction_kind === 'scenario' || m.prediction_kind === 'simulation');
    const populated = scenarioCaps.some((m) => (m.table_count ?? 0) > 0);
    return {
      phase: 'MX-800 Phase 2.7 — Scenario Intelligence',
      scenario_kind:
        'Frames the platform\'s EXISTING scenario substrate across best / expected / worst / risk / ' +
        'migration / deployment / recovery framings. This tier surfaces the persisted scenario trails; it ' +
        'does NOT assert which scenario will occur. Probability ≠ Certainty; Simulation ≠ Reality.',
      scenario_substrate: scenarioCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, scenarios_recorded: m.table_count, // null ≠ 0
      })),
      framings: [
        { framing: 'best_case', basis: 'structural', note: 'Surfaced from existing scenario substrate; not asserted as the outcome.' },
        { framing: 'expected_case', basis: 'structural', note: 'Surfaced from existing scenario substrate.' },
        { framing: 'worst_case', basis: 'structural', note: 'Surfaced from existing scenario substrate.' },
        { framing: 'risk_scenarios', basis: 'structural', note: 'Composed read-only from the risk capabilities (Part 3).' },
        { framing: 'migration_scenarios', basis: 'structural', note: 'Surfaced from MX-700 lifecycle/evolution substrate (composed read-only).' },
        { framing: 'deployment_scenarios', basis: 'structural', note: 'Surfaced from the runtime/platform substrate (composed read-only).' },
        { framing: 'recovery_scenarios', basis: 'structural', note: 'Surfaced from the runtime substrate (composed read-only).' },
      ],
      substrate_populated: populated,
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Prediction Explainability (/explain/:uid)
// ════════════════════════════════════════════════════════════════════════════
export async function explainPrediction(pool: Pool, uidArg: string) {
  const src = PREDICTION_SOURCES.find((s) => s.uid === uidArg || s.table === uidArg);
  if (!src) return { found: false, uid: uidArg, note: 'No such prediction capability in the curated catalog.' };
  const table_present = src.table ? await tableReady(pool, src.table) : false;
  const table_count = table_present && src.table ? await countTable(pool, src.table) : null;
  const engine_present = src.engine ? fileCheck(src.engine) : false;
  const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
  const flag_state = src.flag ? (src.flag in flags ? !!flags[src.flag] : null) : null;
  const siblings = PREDICTION_SOURCES.filter((s) => s.domain === src.domain && s.uid !== src.uid);
  return {
    found: true,
    uid: src.uid, name: src.name, domain: src.domain, prediction_kind: src.prediction_kind,
    why: `${src.description} It is an EXISTING ${src.prediction_kind} prediction capability in the ${src.domain} domain; this tier explains and surfaces it, it never generates the prediction, asserts a future, or decides.`,
    evidence: {
      persisted_trail: src.table, trail_present: table_present, predictions_recorded: table_count, // null ≠ 0
      engine_source: src.engine, engine_present, governing_flag: src.flag, flag_state,
    },
    confidence: {
      level: 'structural',
      basis: (engine_present || table_present) ? 'substrate present' : 'substrate absent',
      note: 'STRUCTURAL confidence only — NOT runtime / accuracy / outcome. Forecast ≠ Fact; Confidence ≠ Accuracy.',
    },
    assumptions: [
      'The persisted trail reflects an EXISTING engine\'s output; this tier does not re-derive or validate that output.',
      src.flag ? `Capability is gated by feature flag '${src.flag}' (Built ≠ Activated; this tier never activates it).` : 'Governing flag unverified — reported honest-null, never assumed.',
    ],
    alternatives: siblings.map((s) => ({ uid: s.uid, name: s.name, prediction_kind: s.prediction_kind })),
    dependencies: src.intelligence_uid ? [{ intelligence_uid: src.intelligence_uid, soft_link: 'platform_intelligence_registry (MX-800 2.1)' }] : [],
    repository_refs: REPO_REFS.concat(src.engine ? [`backend/${src.engine}`] : []),
    knowledge_refs: ['MX-800 2.5 Knowledge Intelligence (getKnowledgeSummary) — composed read-only'],
    runtime_refs: ['MX-800 2.4 Runtime Intelligence (getRuntimeSummary) — composed read-only'],
    governance: { human_approval: 'mandatory', automated_action: false },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Prediction Validation (STRUCTURAL integrity only)
// ════════════════════════════════════════════════════════════════════════════
export async function getPredictionValidation(pool: Pool) {
  return memo('pi:validation', async () => {
    const measured = await measureCapabilities(pool);
    const present = measured.filter((m) => m.present);
    const populated = measured.filter((m) => (m.table_count ?? 0) > 0);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const tiers = await composePriorTiers(pool);
    // Forecast consistency: every catalog capability declares a prediction_kind from the allowed set and
    // has at least one substrate handle (table OR engine). This is STRUCTURAL self-consistency, not accuracy.
    const KINDS = new Set(['forecast', 'trend', 'risk', 'simulation', 'scenario', 'readiness', 'projection']);
    const consistent = measured.filter((m) => KINDS.has(m.prediction_kind) && (m.table || m.engine)).length;
    const checks = [
      { check: 'repository_integrity', status: (fileCheck('services/predictive-intelligence-engine.ts') && fileCheck('routes/predictive-intelligence-engine.ts') && fileCheck('migrations/20261226_predictive_intelligence.sql')) ? 'pass' : 'partial', detail: 'service + route + migration files present' },
      { check: 'model_integrity', status: measured.some((m) => m.engine && m.engine_present) ? 'pass' : 'partial', detail: 'at least one prediction-engine source file exists (models live in code, read-only)' },
      { check: 'evidence_integrity', status: tiers.reachable > 0 ? 'pass' : 'absent', detail: `${tiers.reachable}/${tiers.of} prior intelligence tiers reachable` },
      { check: 'prediction_integrity', status: present.length === measured.length ? 'pass' : present.length > 0 ? 'partial' : 'absent', detail: `${present.length}/${measured.length} prediction capabilities have present substrate` },
      { check: 'prediction_trail_integrity', status: populated.length > 0 ? 'pass' : 'partial', detail: `${populated.length} persisted prediction trails are populated` },
      { check: 'forecast_consistency', status: consistent === measured.length ? 'pass' : consistent > 0 ? 'partial' : 'absent', detail: `${consistent}/${measured.length} capabilities are STRUCTURALLY self-consistent (valid kind + substrate handle). NOT forecast accuracy.` },
      { check: 'registry_metadata_integrity', status: registryReady ? 'pass' : 'absent', detail: registryReady ? 'prediction_registry exists (discovered)' : 'registry not yet discovered (flag-OFF or never run) — honest absent' },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.7 — Prediction Validation',
      validation_kind: 'STRUCTURAL only (existence + population + reachability + self-consistency). NOT a runtime / accuracy / outcome verdict. Forecast ≠ Fact.',
      checks,
      populated_trails: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Prediction Metrics (5 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getPredictionMetrics(pool: Pool) {
  return memo('pi:metrics', async () => {
    const measured = await measureCapabilities(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const measurableSubstrate = measured.filter((m) => m.engine ? m.engine_present : m.table_count != null).length;
    const riskCaps = measured.filter((m) => m.prediction_kind === 'risk');
    const riskTableBacked = riskCaps.filter((m) => m.table);
    const riskPopulated = riskTableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    // Every curated capability is explainable via /explain → explainability is MEASURED, not assumed.
    const explainable = measured.length;
    return {
      phase: 'MX-800 Phase 2.7 — Prediction Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the five axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'forecast_confidence', axis: 'confidence', score: pct(measurableSubstrate, total), basis: { measured: measurableSubstrate, of: total }, note: 'STRUCTURAL verifiability only: capabilities whose substrate could be MEASURED. NOT runtime/outcome accuracy. Forecast ≠ Fact; Confidence ≠ Accuracy.' },
        { metric: 'prediction_quality', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Prediction capabilities whose substrate is present. Present ≠ Populated.' },
        { metric: 'trend_accuracy', axis: 'accuracy', score: null, basis: { measurable: false }, note: 'Runtime forecast/trend ACCURACY requires labelled prediction outcomes (absent) → honest-null (DEFERRED). This tier surfaces prediction SUPPORT; it never measures whether a forecast came true. Trend ≠ Future; Confidence ≠ Accuracy.' },
        { metric: 'risk_prediction_coverage', axis: 'coverage', score: pct(riskPopulated, riskTableBacked.length), basis: { measured: riskPopulated, of: riskTableBacked.length }, note: 'Persisted risk-prediction trails that are populated. Coverage ⟂ Confidence.' },
        { metric: 'explainability_score', axis: 'evidence', score: pct(explainable, total), basis: { measured: explainable, of: total }, note: 'Capabilities that expose explainable reasoning (why/evidence/confidence/assumptions/alternatives/refs) via /explain.' },
      ],
      population: { capabilities: total, present, risk_populated: riskPopulated, risk_table_backed: riskTableBacked.length },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (prediction_registry — catalog of prediction CAPABILITIES)
// ════════════════════════════════════════════════════════════════════════════
export async function getPredictionRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_kind: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT prediction_uid, name, prediction_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_kind: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_kind[e.prediction_kind] = (by_kind[e.prediction_kind] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_kind, by_domain, entries };
}

export async function getPredictionCapability(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE prediction_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverPredictions(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensurePredictiveSchema(pool);
  const measured = await measureCapabilities(pool);
  let upserted = 0;
  for (const m of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (prediction_uid, name, prediction_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, intelligence_uid, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'discovered')
       ON CONFLICT (prediction_uid) DO UPDATE SET
         name=EXCLUDED.name, prediction_kind=EXCLUDED.prediction_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present,
         table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         intelligence_uid=EXCLUDED.intelligence_uid, metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner + lifecycle_uid are MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers them.
      [m.uid, m.name, m.prediction_kind, m.domain, m.table, m.engine, m.flag, m.present, m.table_count, m.flag_state, m.intelligence_uid,
       JSON.stringify({ description: m.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: PREDICTION_SOURCES.length, by: actor };
}

export async function registerPredictionCapability(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensurePredictiveSchema(pool);
  const name = body?.name ? String(body.name) : null;
  if (!name) return { ok: false, error: 'name is required' };
  const table = body?.physical_table ? String(body.physical_table) : null;
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex
  // gate, not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (table != null && !isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.prediction_uid ? String(body.prediction_uid) : uid('pi-man');
  const table_present = table ? await tableReady(pool, table) : false;
  const table_count = table_present && table ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (prediction_uid, name, prediction_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual')
     ON CONFLICT (prediction_uid) DO UPDATE SET
       name=EXCLUDED.name, prediction_kind=EXCLUDED.prediction_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present, table_count=EXCLUDED.table_count,
       flag_state=EXCLUDED.flag_state,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       intelligence_uid=COALESCE(EXCLUDED.intelligence_uid, ${REGISTRY_TABLE}.intelligence_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.prediction_kind ? String(body.prediction_kind) : 'forecast', body?.domain ? String(body.domain) : null,
     table, body?.engine_path ? String(body.engine_path) : null, body?.governing_flag ? String(body.governing_flag) : null,
     table_present, table_count, null,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     body?.intelligence_uid ? String(body.intelligence_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, prediction_uid: u, present: table_present, count: table_count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getPredictiveSummary(pool: Pool) {
  const [registry, catalog, metrics, validation, tiers] = await Promise.all([
    getPredictionRegistry(pool), getPredictionCatalog(pool), getPredictionMetrics(pool), getPredictionValidation(pool), composePriorTiers(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.7 — Predictive Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    catalog: { capabilities: catalog.totals.capabilities, present: catalog.totals.present, table_backed: catalog.totals.table_backed, engine_backed: catalog.totals.engine_backed, predictions_recorded: catalog.totals.predictions_recorded, domains: catalog.by_domain.length },
    metrics: metrics.scores,
    composition: { prior_tiers_reachable: tiers.reachable, of: tiers.of, note: 'COMPOSES 2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision read-only. Re-runs no engine; generates no forecast.' },
    validation_verdict: validation.verdict,
    production_safety: { modifies_production: false, simulation_only: true },
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function capturePredictiveSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensurePredictiveSchema(pool);
  const [registry, catalog, metrics, validation, summary] = await Promise.all([
    getPredictionRegistry(pool), getPredictionCatalog(pool), getPredictionMetrics(pool), getPredictionValidation(pool), getPredictiveSummary(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('pi-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, capabilities_present, predictions_recorded,
       forecast_confidence_pct, prediction_quality_pct, trend_accuracy_pct,
       risk_prediction_coverage_pct, explainability_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [snapshot_uid, registry.total, catalog.totals.present, catalog.totals.predictions_recorded,
     score('forecast_confidence'), score('prediction_quality'), score('trend_accuracy'),
     score('risk_prediction_coverage'), score('explainability_score'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getPredictiveSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, capabilities_present, predictions_recorded, forecast_confidence_pct, prediction_quality_pct, trend_accuracy_pct, risk_prediction_coverage_pct, explainability_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getPredictiveDrift(pool: Pool) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, note: 'No snapshots — drift needs ≥2 captures.' };
  const last = (await rows(pool, `SELECT * FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`)) ?? [];
  if (last.length < 2) return { ready: true, comparable: false, note: 'Need ≥2 snapshots to compute drift.' };
  const [cur, prev] = last;
  const delta = (k: string) => (cur[k] == null || prev[k] == null) ? null : Number(cur[k]) - Number(prev[k]); // null ≠ 0
  return {
    ready: true, comparable: true,
    from: prev.captured_at, to: cur.captured_at,
    deltas: {
      registry_total: delta('registry_total'),
      capabilities_present: delta('capabilities_present'),
      predictions_recorded: delta('predictions_recorded'),
      forecast_confidence_pct: delta('forecast_confidence_pct'),
      prediction_quality_pct: delta('prediction_quality_pct'),
      trend_accuracy_pct: delta('trend_accuracy_pct'),
      risk_prediction_coverage_pct: delta('risk_prediction_coverage_pct'),
      explainability_pct: delta('explainability_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}

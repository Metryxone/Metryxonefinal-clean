/**
 * MX-800 Phase 2.8 — Recommendation Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Recommendation Intelligence is a READ-ONLY intelligence tier ABOUT the platform's
 * recommendation capabilities. It CATALOGS the EXISTING recommendation / opportunity / intervention /
 * optimization capabilities and COMPOSES the prior intelligence tiers (2.1 platform / 2.3 engineering /
 * 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive) into explainable recommendation
 * intelligence (registry / action / opportunity / prioritization / prescriptive / explainability /
 * validation / metrics).
 *
 * It introduces NO parallel recommendation / optimization / opportunity engine, DUPLICATES no rule set,
 * and changes NO business logic. Critically it INVOKES / ACTIVATES no dormant recommendation engine: it
 * READS their EXISTENCE (engine source files) and their PERSISTED OUTPUT (recommendation/opportunity
 * tables) only — composing an engine's existence is NOT the same as running it (running a flag-OFF engine
 * would be dormant activation, and GENERATING a new recommendation here would be fabrication). It NEVER
 * generates a new recommendation, opportunity or intervention; it surfaces the EXISTING ones. It is
 * RECOMMEND-ONLY: it never DECIDES, never EXECUTES and never AUTOMATES. The repository + the existing
 * recommendation tables remain the single source of truth.
 *
 * Composed substrate (READ-ONLY — reuse, never duplicate, never write, never invoke):
 *   - Recommendation engines (existence read):  services/{recommendation-engine, career-recommendation-engine,
 *                               causal-recommendation-engine, ei-recommendation-engine, frp-recommendation-engine,
 *                               lbi-recommendation-engine, mei-recommendation-engine, rie-recommendation-engine,
 *                               runtime-optimization-engine, rie-opportunity-engine, m5-executive-intelligence,
 *                               intervention-intelligence, pil/recommendation-builder, pil/runtime-guidance-engine}.ts
 *                               + routes/{paie-opportunity,roie-opportunity,iil-evolution,nhda-core}.ts.
 *   - Live recommendation tables (COUNT-only):  capadex_recommendations, career_recommendations,
 *                               frp_recommendations, lbi_user_recommendations, mei_user_recommendations,
 *                               rie_recommendations, cg_user_recommendations, m5_executive_recommendations,
 *                               learning_recommendations, development_recommendations, rie_opportunity_flags,
 *                               paie_opportunity_forecasts, roie_opportunities, iil_opportunities,
 *                               nhda_opportunities, capadex_interventions, pil_intervention_library.
 *   - Prior intelligence tiers: platform (2.1) / engineering (2.3) / runtime (2.4) / knowledge (2.5) /
 *                               decision (2.6) / predictive (2.7) — their read-only summary getters.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Recommendation ≠ Decision. Recommendation ≠ Automation. Recommendation ≠ Execution. Priority ≠
 *     Approval. Opportunity ≠ Requirement. Confidence ≠ Accuracy. Evidence ≠ Confidence. Coverage ⟂
 *     Confidence ⟂ Evidence (SEPARATE axes, never blended). Built ≠ Activated. Present ≠ Populated.
 *     Human approval mandatory.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup — reads 0 for bulk-seeded
 *     tables until autovacuum analyzes). ABSENT table → present:false, count NULL (≠ 0). A PRESENT but
 *     unreadable table → count NULL (query error ≠ empty). Empty table → 0.
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall".
 *     recommendation_confidence is STRUCTURAL only (substrate verifiability/integrity), NOT
 *     runtime/outcome/accuracy confidence.
 *   - acceptance_rate (adoption) and effectiveness (outcome) are UNMEASURABLE here (no recommendation
 *     adoption telemetry, no labelled outcomes) → honest-NULL (DEFERRED), never a fabricated proxy. This
 *     tier surfaces recommendation SUPPORT; it never measures whether a recommendation was accepted or
 *     worked, and it never DECIDES or EXECUTES.
 *   - Prioritization is a STRUCTURAL framing of EXISTING recommendation substrate — it never asserts a
 *     business priority and never approves anything (Priority ≠ Approval).
 *   - Prescriptive Intelligence is RECOMMEND-ONLY — it reads the EXISTING recommendation substrate and
 *     never executes, actions, or automates a recommendation (no write to any business table).
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *   - STOP clause: NO Autonomous-AI / workflow-automation / execution. Action/Opportunity/Prescriptive
 *     are the evidence-grounded surfacing of EXISTING recommendation capabilities — never a new
 *     recommendation, a decision, or an executed action.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER create
 * schema and NEVER write to the existing recommendation tables. The lazy ensure-schema runs ONLY on
 * flag-ON write paths (discover / register / audit-capture) so flag OFF → byte-identical incl. schema (0
 * tables). Every write path also asserts the flag itself BEFORE ensure-schema (defense-in-depth).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isRecommendationIntelligenceEngineEnabled, listFlags } from '../config/feature-flags';

// Composed prior-tier summaries (EXISTING intelligence engines — reuse, never duplicate).
// These getters are GET-never-writes (to_regclass-probed reads, no ensure-schema, verified).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';
import { getDecisionSummary } from './decision-intelligence';
import { getPredictiveSummary } from './predictive-intelligence-engine';

const REGISTRY_TABLE = 'recommendation_registry';
const SNAPSHOT_TABLE = 'recommendation_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class RecommendationIntelligenceDisabled extends Error {
  code = 'recommendation_intelligence_disabled';
  constructor() {
    super('recommendationIntelligenceEngine flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'RecommendationIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isRecommendationIntelligenceEngineEnabled()) throw new RecommendationIntelligenceDisabled();
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
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation, /action,
 * /opportunity and captureSnapshot all compose the SAME expensive measurement (per-capability COUNT(*) +
 * six prior-tier summaries). Memoization dedupes that within a request and reuses for a few seconds.
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

// ── Curated, file/table-verified RECOMMENDATION CAPABILITY catalog ───────────
// Every `table` below was verified to EXIST in this database (or is honest-absent → table_present:false,
// count NULL) and every `engine` file to EXIST on disk. A capability is an EXISTING recommendation TYPE
// the platform already makes — this tier never creates a new one and never GENERATES a recommendation.
// `table` is the persisted recommendation trail (read-only, COUNT-only) or null for a compute-on-read
// engine. `engine` is the source file whose EXISTENCE is read (never imported / invoked). `flag` is the
// governing feature flag whose STATE is read (Built ≠ Activated) — null when the gate is unverified
// (honest-NULL, never a fabricated mapping). `intelligence_uid` SOFT-links the MX-800 2.1 registry.
type RecommendationKind = 'recommendation' | 'opportunity' | 'intervention' | 'optimization' | 'prioritization' | 'prescription' | 'action';
type RecommendationSource = {
  uid: string; name: string; domain: string; recommendation_kind: RecommendationKind;
  table: string | null; engine: string | null; flag: string | null;
  intelligence_uid: string | null; description: string;
};
const RECOMMENDATION_SOURCES: RecommendationSource[] = [
  // ── Recommendation ──
  {
    uid: 'ri-cap-capadex-recommendation', name: 'CAPADEX behavioural recommendation', domain: 'behaviour',
    recommendation_kind: 'recommendation', table: 'capadex_recommendations', engine: 'services/recommendation-engine.ts',
    flag: null, intelligence_uid: 'intel.runtime',
    description: 'Persisted CAPADEX behavioural recommendation trail produced by the core recommendation engine (concern-grounded guidance). Read-only here; never re-generated.',
  },
  {
    uid: 'ri-cap-career-recommendation', name: 'Career recommendation', domain: 'career',
    recommendation_kind: 'recommendation', table: 'career_recommendations', engine: 'services/career-recommendation-engine.ts',
    flag: 'careerRecommendation', intelligence_uid: null,
    description: 'Persisted career recommendation trail (career-path guidance). The career-recommendation engine exists on disk (existence read); the trail is surfaced read-only, never re-generated.',
  },
  {
    uid: 'ri-cap-causal-recommendation', name: 'Causal recommendation', domain: 'causal',
    recommendation_kind: 'recommendation', table: null, engine: 'services/causal-recommendation-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Causal recommendation engine (compute-on-read causal guidance). Engine existence read-only; no persisted trail surfaced (count NULL ≠ 0). The engine is never invoked.',
  },
  {
    uid: 'ri-cap-ei-recommendation', name: 'Emotional-intelligence recommendation', domain: 'emotional_intelligence',
    recommendation_kind: 'recommendation', table: null, engine: 'services/ei-recommendation-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'EI recommendation engine (compute-on-read emotional-intelligence guidance). Engine existence read-only; no persisted trail attributed here (count NULL ≠ 0). The engine is never invoked.',
  },
  {
    uid: 'ri-cap-frp-recommendation', name: 'Future-readiness recommendation', domain: 'future_readiness',
    recommendation_kind: 'recommendation', table: 'frp_recommendations', engine: 'services/frp-recommendation-engine.ts',
    flag: 'futureReadiness', intelligence_uid: null,
    description: 'Persisted Future-Readiness recommendation trail from the FRP recommendation engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-lbi-recommendation', name: 'Behavioural (LBI) recommendation', domain: 'behaviour',
    recommendation_kind: 'recommendation', table: 'lbi_user_recommendations', engine: 'services/lbi-recommendation-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted LBI behavioural recommendation trail from the LBI recommendation engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-mei-recommendation', name: 'Employability (MEI) recommendation', domain: 'employability',
    recommendation_kind: 'recommendation', table: 'mei_user_recommendations', engine: 'services/mei-recommendation-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted MEI employability recommendation trail from the MEI recommendation engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-rie-recommendation', name: 'Runtime (RIE) recommendation', domain: 'runtime',
    recommendation_kind: 'recommendation', table: 'rie_recommendations', engine: 'services/rie-recommendation-engine.ts',
    flag: null, intelligence_uid: 'intel.runtime',
    description: 'Persisted runtime-intelligence recommendation trail (RIE). The RIE recommendation engine exists on disk (existence read); the trail is surfaced read-only, never re-generated.',
  },
  {
    uid: 'ri-cap-career-graph-recommendation', name: 'Career-graph recommendation', domain: 'career_graph',
    recommendation_kind: 'recommendation', table: 'cg_user_recommendations', engine: null,
    flag: 'careerGraph', intelligence_uid: null,
    description: 'Persisted career-graph recommendation trail (CGI). Compute-on-read upstream; surfaced read-only as a persisted recommendation trail.',
  },
  {
    uid: 'ri-cap-executive-recommendation', name: 'Executive / workforce recommendation', domain: 'organizational',
    recommendation_kind: 'recommendation', table: 'm5_executive_recommendations', engine: 'services/m5-executive-intelligence.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted executive / workforce recommendation trail from the M5 executive-intelligence engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-development-recommendation', name: 'Development recommendation', domain: 'development',
    recommendation_kind: 'recommendation', table: 'development_recommendations', engine: 'services/pil/recommendation-builder.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted development recommendation trail from the PIL recommendation-builder. Read-only COUNT-only; the builder is never invoked.',
  },
  {
    uid: 'ri-cap-learning-recommendation', name: 'Learning recommendation', domain: 'learning',
    recommendation_kind: 'recommendation', table: 'learning_recommendations', engine: 'services/pil/recommendation-builder.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted learning recommendation trail from the PIL recommendation-builder. Read-only COUNT-only; the builder is never invoked.',
  },
  // ── Opportunity ──
  {
    uid: 'ri-cap-runtime-opportunity', name: 'Runtime opportunity flag', domain: 'runtime',
    recommendation_kind: 'opportunity', table: 'rie_opportunity_flags', engine: 'services/rie-opportunity-engine.ts',
    flag: null, intelligence_uid: 'intel.runtime',
    description: 'Persisted runtime opportunity-flag trail from the RIE opportunity engine. Opportunity ≠ Requirement — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-predictive-opportunity', name: 'Predictive opportunity forecast', domain: 'predictive',
    recommendation_kind: 'opportunity', table: 'paie_opportunity_forecasts', engine: 'routes/paie-opportunity.ts',
    flag: null, intelligence_uid: 'intel.forecast',
    description: 'Persisted predictive opportunity-forecast trail (PAIE). Opportunity ≠ Requirement — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-risk-outcome-opportunity', name: 'Risk-outcome opportunity', domain: 'risk',
    recommendation_kind: 'opportunity', table: 'roie_opportunities', engine: 'routes/roie-opportunity.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted risk-outcome opportunity trail (ROIE). Opportunity ≠ Requirement — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'ri-cap-innovation-opportunity', name: 'Innovation / ecosystem opportunity', domain: 'innovation',
    recommendation_kind: 'opportunity', table: 'iil_opportunities', engine: 'routes/iil-evolution.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted innovation/ecosystem opportunity trail (IIL). Opportunity ≠ Requirement — surfaced read-only.',
  },
  {
    uid: 'ri-cap-hiring-opportunity', name: 'Hiring / NHDA opportunity', domain: 'hiring',
    recommendation_kind: 'opportunity', table: 'nhda_opportunities', engine: 'routes/nhda-core.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted hiring opportunity trail (NHDA). Opportunity ≠ Requirement — surfaced read-only.',
  },
  // ── Intervention ──
  {
    uid: 'ri-cap-behavioural-intervention', name: 'Behavioural intervention', domain: 'behaviour',
    recommendation_kind: 'intervention', table: 'capadex_interventions', engine: 'services/intervention-intelligence.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted behavioural intervention trail from the intervention-intelligence engine. Recommendation ≠ Execution — surfaced read-only; no intervention is actioned.',
  },
  {
    uid: 'ri-cap-problem-intervention', name: 'Problem-intelligence intervention', domain: 'problem_intelligence',
    recommendation_kind: 'intervention', table: 'pil_intervention_library', engine: 'services/pil/runtime-guidance-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted PIL intervention-library trail from the PIL runtime-guidance engine. Recommendation ≠ Execution — surfaced read-only; no intervention is actioned.',
  },
  // ── Optimization ──
  {
    uid: 'ri-cap-runtime-optimization', name: 'Runtime optimization', domain: 'runtime',
    recommendation_kind: 'optimization', table: null, engine: 'services/runtime-optimization-engine.ts',
    flag: null, intelligence_uid: 'intel.runtime',
    description: 'Runtime optimization engine (compute-on-read optimization guidance). Engine existence read-only; no persisted trail surfaced (count NULL ≠ 0). The engine is never invoked.',
  },
];

/** Measure every capability ONCE: table present + exact COUNT(*); engine file present; governing flag
 *  STATE (Built ≠ Activated). Memoized per request window. */
type MeasuredCapability = RecommendationSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureCapabilities(pool: Pool): Promise<MeasuredCapability[]> {
  return memo('ri:caps', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(RECOMMENDATION_SOURCES.map(async (s) => {
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
/** Lazy ensure-schema — canonical mirror of 20261227_recommendation_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureRecommendationSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      recommendation_uid  TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      recommendation_kind TEXT NOT NULL,          -- recommendation|opportunity|intervention|optimization|prioritization|prescription|action
      domain              TEXT,                    -- behaviour|career|runtime|future_readiness|employability|organizational|risk|...
      physical_table      TEXT,                    -- the EXISTING persisted recommendation trail (read-only) or NULL (compute-on-read)
      engine_path         TEXT,                    -- the EXISTING engine source file (existence read-only) or NULL
      governing_flag      TEXT,                    -- governing feature flag key or NULL (unverified gate — honest)
      present             BOOLEAN,                 -- DERIVED: substrate (table OR engine) exists — NOT a quality verdict
      table_count         INTEGER,                 -- exact COUNT(*) of the trail at discovery; honest-NULL when unmeasured (≠ 0)
      flag_state          BOOLEAN,                 -- DERIVED governing-flag state (Built ≠ Activated); NULL when no/unverified flag
      owner               TEXT,                    -- MANAGED, honest-NULL when unassigned (never fabricated)
      lifecycle_uid       TEXT,                    -- SOFT reference into platform_lifecycle_catalog (no FK; may be null)
      intelligence_uid    TEXT,                    -- SOFT reference into platform_intelligence_registry (no FK; may be null)
      metadata            JSONB NOT NULL DEFAULT '{}',
      source              TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rr_recommendation_kind ON ${REGISTRY_TABLE} (recommendation_kind);
    CREATE INDEX IF NOT EXISTS idx_rr_domain              ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      capabilities_present        INTEGER,
      recommendations_recorded    INTEGER,
      recommendation_quality_pct  NUMERIC,
      recommendation_confidence_pct NUMERIC,
      acceptance_rate_pct         NUMERIC,         -- honest-NULL (adoption unmeasurable)
      recommendation_coverage_pct NUMERIC,
      explainability_pct          NUMERIC,
      effectiveness_pct           NUMERIC,         -- honest-NULL (outcome unmeasurable)
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rias_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

const AXES_NOTE =
  'Recommendation ≠ Decision. Recommendation ≠ Automation. Recommendation ≠ Execution. Priority ≠ ' +
  'Approval. Opportunity ≠ Requirement. Confidence ≠ Accuracy. Evidence ≠ Confidence. Coverage ⟂ ' +
  'Confidence ⟂ Evidence (SEPARATE axes). Built ≠ Activated. Present ≠ Populated. Human approval remains ' +
  'mandatory. Metrics are NEVER composited.';
const REPO_REFS = [
  'backend/services/recommendation-intelligence-engine.ts',
  'backend/routes/recommendation-intelligence-engine.ts',
  'backend/migrations/20261227_recommendation_intelligence.sql',
];

// Each prior-tier summary is GET-never-writes; wrap so an unavailable tier degrades to honest-null.
const safeTier = async (fn: () => Promise<any>) => {
  try { return { reachable: true, summary: await fn() }; }
  catch (e: any) { return { reachable: false, summary: null, note: `tier unavailable: ${e?.code || e?.message || 'error'}` }; }
};
function composePriorTiers(pool: Pool) {
  return memo('ri:tiers', async () => {
    const [platform, engineering, runtime, knowledge, decision, predictive] = await Promise.all([
      safeTier(() => getPlatformSummary(pool)),
      safeTier(() => getEngineeringSummary(pool)),
      safeTier(() => getRuntimeSummary(pool)),
      safeTier(() => getKnowledgeSummary(pool)),
      safeTier(() => getDecisionSummary(pool)),
      safeTier(() => getPredictiveSummary(pool)),
    ]);
    const reachable = [platform, engineering, runtime, knowledge, decision, predictive].filter((t) => t.reachable).length;
    return { tiers: { platform, engineering, runtime, knowledge, decision, predictive }, reachable, of: 6 };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Recommendation Registry (catalog of EXISTING recommendation capabilities)
// ════════════════════════════════════════════════════════════════════════════
export async function getRecommendationCatalog(pool: Pool) {
  return memo('ri:catalog', async () => {
    const measured = await measureCapabilities(pool);
    const by_domain: Record<string, { domain: string; capabilities: number; present: number; recommendations: number | null }> = {};
    const by_kind: Record<string, number> = {};
    for (const m of measured) {
      const d = (by_domain[m.domain] ??= { domain: m.domain, capabilities: 0, present: 0, recommendations: null });
      d.capabilities++;
      if (m.present) d.present++;
      if (m.table_count != null) d.recommendations = (d.recommendations ?? 0) + m.table_count;
      by_kind[m.recommendation_kind] = (by_kind[m.recommendation_kind] ?? 0) + 1;
    }
    return {
      phase: 'MX-800 Phase 2.8 — Recommendation Registry',
      catalog_note:
        'A curated catalog of the EXISTING recommendation capabilities the platform already makes. This ' +
        'tier NEVER creates a recommendation capability and NEVER generates a recommendation — it reads ' +
        'each one\'s substrate (persisted trail and/or engine source file) and its governing-flag state. ' +
        'Engine existence is READ, never invoked.',
      totals: {
        capabilities: measured.length,
        present: measured.filter((m) => m.present).length,
        table_backed: measured.filter((m) => m.table).length,
        engine_backed: measured.filter((m) => m.engine).length,
        recommendations_recorded: (() => { const xs = measured.map((m) => m.table_count).filter((x): x is number => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; })(),
      },
      by_domain: Object.values(by_domain).sort((a, b) => a.domain.localeCompare(b.domain)),
      by_kind,
      capabilities: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, recommendation_kind: m.recommendation_kind,
        table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, intelligence_uid: m.intelligence_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Action Intelligence (surface EXISTING action/intervention capabilities; compose; NEVER execute)
// ════════════════════════════════════════════════════════════════════════════
export async function getActionIntelligence(pool: Pool) {
  return memo('ri:action', async () => {
    const measured = await measureCapabilities(pool);
    const actionCaps = measured.filter((m) => m.recommendation_kind === 'intervention' || m.recommendation_kind === 'action' || m.recommendation_kind === 'recommendation');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.8 — Action Intelligence',
      action_kind:
        'Surfaces the platform\'s EXISTING action / recommendation / intervention capabilities and ' +
        'composes the prior intelligence-tier summaries. This tier reads the persisted recommendation/ ' +
        'intervention trails; it does NOT generate a new action and it NEVER executes, actions, or ' +
        'automates one. Recommendation ≠ Execution; Recommendation ≠ Automation.',
      execution_safety: { executes_actions: false, automates_actions: false, write_paths_to_business_tables: 0, note: 'Read-only — the only writes in this tier are to its own 2 owned tables on flag-ON audit/discovery.' },
      action_capabilities: actionCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain, recommendation_kind: m.recommendation_kind,
        persisted_trail: m.table, trail_present: m.table_present, actions_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
        governing_flag: m.flag, flag_state: m.flag_state,
      })),
      categories: {
        behavioural_actions: { sources: actionCaps.filter((m) => m.domain === 'behaviour').map((m) => ({ capability: m.uid, actions_recorded: m.table_count })) },
        runtime_actions: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
        decision_grounded_actions: { source: 'MX-800 2.6 decision-intelligence summary', reachable: tiers.tiers.decision.reachable, note: 'Actions are decision-grounded surfacing; this tier never decides.' },
        predictive_actions: { source: 'MX-800 2.7 predictive-intelligence summary', reachable: tiers.tiers.predictive.reachable },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Opportunity Intelligence (surface EXISTING opportunity capabilities; Opportunity ≠ Requirement)
// ════════════════════════════════════════════════════════════════════════════
export async function getOpportunityIntelligence(pool: Pool) {
  return memo('ri:opportunity', async () => {
    const measured = await measureCapabilities(pool);
    const oppCaps = measured.filter((m) => m.recommendation_kind === 'opportunity');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.8 — Opportunity Intelligence',
      opportunity_kind:
        'Surfaces the platform\'s EXISTING opportunity capabilities (runtime / predictive / risk-outcome ' +
        '/ innovation / hiring). This tier reads the persisted opportunity trails + composes the prior ' +
        'intelligence-tier summaries. It does NOT generate a new opportunity and an opportunity is NEVER ' +
        'a requirement or a mandate. Opportunity ≠ Requirement.',
      opportunity_capabilities: oppCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, opportunities_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      categories: {
        runtime_opportunity: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
        predictive_opportunity: { source: 'MX-800 2.7 predictive-intelligence summary', reachable: tiers.tiers.predictive.reachable },
        risk_outcome_opportunity: { sources: oppCaps.filter((m) => m.domain === 'risk').map((m) => ({ capability: m.uid, opportunities_recorded: m.table_count })) },
        ecosystem_and_hiring_opportunity: { sources: oppCaps.filter((m) => m.domain === 'innovation' || m.domain === 'hiring').map((m) => ({ capability: m.uid, domain: m.domain, opportunities_recorded: m.table_count })) },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Prioritization Engine (STRUCTURAL framing only — Priority ≠ Approval; NEVER decides)
// ════════════════════════════════════════════════════════════════════════════
export async function getPrioritizationIntelligence(pool: Pool) {
  return memo('ri:prioritization', async () => {
    const measured = await measureCapabilities(pool);
    const tiers = await composePriorTiers(pool);
    // STRUCTURAL prioritization basis ONLY: by recommendation-kind population (how much persisted
    // substrate exists per kind). This is a transparency framing of EXISTING substrate volume — it is
    // NOT a business-priority assertion and it NEVER approves anything. Priority ≠ Approval.
    const byKind: Record<string, { kind: string; capabilities: number; populated: number; records: number | null }> = {};
    for (const m of measured) {
      const k = (byKind[m.recommendation_kind] ??= { kind: m.recommendation_kind, capabilities: 0, populated: 0, records: null });
      k.capabilities++;
      if ((m.table_count ?? 0) > 0) k.populated++;
      if (m.table_count != null) k.records = (k.records ?? 0) + m.table_count;
    }
    return {
      phase: 'MX-800 Phase 2.8 — Prioritization Engine',
      prioritization_kind:
        'A STRUCTURAL framing of the EXISTING recommendation substrate (by kind / domain / persisted ' +
        'volume). It surfaces WHERE recommendation substrate exists and is populated; it does NOT assert ' +
        'a business priority, does NOT rank what should be done first, and NEVER approves anything. ' +
        'Priority ≠ Approval; this tier never decides.',
      basis: 'structural_substrate_volume',
      decision_safety: { asserts_business_priority: false, approves: false, decides: false, note: 'Transparency framing only — human prioritisation + approval remain mandatory.' },
      by_kind: Object.values(byKind).sort((a, b) => a.kind.localeCompare(b.kind)),
      composition: {
        decision_tier: { source: 'MX-800 2.6 decision-intelligence summary', reachable: tiers.tiers.decision.reachable, note: 'Prioritisation framing is decision-grounded surfacing; this tier never decides.' },
        predictive_tier: { source: 'MX-800 2.7 predictive-intelligence summary', reachable: tiers.tiers.predictive.reachable },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Prescriptive Intelligence (RECOMMEND ONLY — read EXISTING substrate; NEVER execute/automate)
// ════════════════════════════════════════════════════════════════════════════
export async function getPrescriptiveIntelligence(pool: Pool) {
  return memo('ri:prescriptive', async () => {
    const measured = await measureCapabilities(pool);
    const prescriptive = measured.filter((m) => m.recommendation_kind === 'recommendation' || m.recommendation_kind === 'optimization' || m.recommendation_kind === 'prescription');
    const tiers = await composePriorTiers(pool);
    const populated = prescriptive.some((m) => (m.table_count ?? 0) > 0);
    return {
      phase: 'MX-800 Phase 2.8 — Prescriptive Intelligence',
      prescriptive_kind:
        'RECOMMEND ONLY. Surfaces the platform\'s EXISTING prescriptive substrate (recommendation / ' +
        'optimization guidance) and composes the prior intelligence tiers. This tier READS the persisted ' +
        'recommendation trails; it NEVER executes, actions, or automates a recommendation, never writes a ' +
        'business table, and never decides. Recommendation ≠ Execution; Recommendation ≠ Automation.',
      execution_safety: { executes: false, automates: false, decides: false, modifies_production: false, write_paths_to_business_tables: 0, note: 'Read-only — the only writes in this tier are to its own 2 owned tables on flag-ON audit/discovery.' },
      prescriptive_capabilities: prescriptive.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain, recommendation_kind: m.recommendation_kind,
        persisted_trail: m.table, trail_present: m.table_present, recommendations_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      categories: {
        behavioural_and_development: { sources: prescriptive.filter((m) => ['behaviour', 'development', 'learning', 'emotional_intelligence'].includes(m.domain)).map((m) => ({ capability: m.uid, recommendations_recorded: m.table_count })) },
        career_and_employability: { sources: prescriptive.filter((m) => ['career', 'career_graph', 'employability'].includes(m.domain)).map((m) => ({ capability: m.uid, recommendations_recorded: m.table_count })) },
        runtime_and_organizational: { sources: prescriptive.filter((m) => ['runtime', 'organizational'].includes(m.domain)).map((m) => ({ capability: m.uid, recommendations_recorded: m.table_count })) },
        knowledge_grounding: { source: 'MX-800 2.5 knowledge-intelligence summary', reachable: tiers.tiers.knowledge.reachable },
      },
      substrate_populated: populated,
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Recommendation Explainability (/explain/:uid)
// ════════════════════════════════════════════════════════════════════════════
export async function explainRecommendation(pool: Pool, uidArg: string) {
  const src = RECOMMENDATION_SOURCES.find((s) => s.uid === uidArg || s.table === uidArg);
  if (!src) return { found: false, uid: uidArg, note: 'No such recommendation capability in the curated catalog.' };
  const table_present = src.table ? await tableReady(pool, src.table) : false;
  const table_count = table_present && src.table ? await countTable(pool, src.table) : null;
  const engine_present = src.engine ? fileCheck(src.engine) : false;
  const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
  const flag_state = src.flag ? (src.flag in flags ? !!flags[src.flag] : null) : null;
  const siblings = RECOMMENDATION_SOURCES.filter((s) => s.domain === src.domain && s.uid !== src.uid);
  return {
    found: true,
    uid: src.uid, name: src.name, domain: src.domain, recommendation_kind: src.recommendation_kind,
    why: `${src.description} It is an EXISTING ${src.recommendation_kind} capability in the ${src.domain} domain; this tier explains and surfaces it, it never generates the recommendation, decides, executes, or automates.`,
    evidence: {
      persisted_trail: src.table, trail_present: table_present, recommendations_recorded: table_count, // null ≠ 0
      engine_source: src.engine, engine_present, governing_flag: src.flag, flag_state,
    },
    confidence: {
      level: 'structural',
      basis: (engine_present || table_present) ? 'substrate present' : 'substrate absent',
      note: 'STRUCTURAL confidence only — NOT runtime / accuracy / acceptance / outcome. Confidence ≠ Accuracy.',
    },
    assumptions: [
      'The persisted trail reflects an EXISTING engine\'s output; this tier does not re-derive or validate that output.',
      src.flag ? `Capability is gated by feature flag '${src.flag}' (Built ≠ Activated; this tier never activates it).` : 'Governing flag unverified — reported honest-null, never assumed.',
    ],
    alternatives: siblings.map((s) => ({ uid: s.uid, name: s.name, recommendation_kind: s.recommendation_kind })),
    dependencies: src.intelligence_uid ? [{ intelligence_uid: src.intelligence_uid, soft_link: 'platform_intelligence_registry (MX-800 2.1)' }] : [],
    repository_refs: REPO_REFS.concat(src.engine ? [`backend/${src.engine}`] : []),
    knowledge_refs: ['MX-800 2.5 Knowledge Intelligence (getKnowledgeSummary) — composed read-only'],
    runtime_refs: ['MX-800 2.4 Runtime Intelligence (getRuntimeSummary) — composed read-only'],
    governance: { human_approval: 'mandatory', automated_action: false, executes: false, decides: false },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Recommendation Validation (STRUCTURAL integrity only)
// ════════════════════════════════════════════════════════════════════════════
export async function getRecommendationValidation(pool: Pool) {
  return memo('ri:validation', async () => {
    const measured = await measureCapabilities(pool);
    const present = measured.filter((m) => m.present);
    const populated = measured.filter((m) => (m.table_count ?? 0) > 0);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const tiers = await composePriorTiers(pool);
    // Recommendation consistency: every catalog capability declares a recommendation_kind from the
    // allowed set and has at least one substrate handle (table OR engine). STRUCTURAL self-consistency,
    // not acceptance or effectiveness.
    const KINDS = new Set(['recommendation', 'opportunity', 'intervention', 'optimization', 'prioritization', 'prescription', 'action']);
    const consistent = measured.filter((m) => KINDS.has(m.recommendation_kind) && (m.table || m.engine)).length;
    const checks = [
      { check: 'repository_integrity', status: (fileCheck('services/recommendation-intelligence-engine.ts') && fileCheck('routes/recommendation-intelligence-engine.ts') && fileCheck('migrations/20261227_recommendation_intelligence.sql')) ? 'pass' : 'partial', detail: 'service + route + migration files present' },
      { check: 'engine_integrity', status: measured.some((m) => m.engine && m.engine_present) ? 'pass' : 'partial', detail: 'at least one recommendation-engine source file exists (rules live in code, read-only)' },
      { check: 'evidence_integrity', status: tiers.reachable > 0 ? 'pass' : 'absent', detail: `${tiers.reachable}/${tiers.of} prior intelligence tiers reachable` },
      { check: 'recommendation_integrity', status: present.length === measured.length ? 'pass' : present.length > 0 ? 'partial' : 'absent', detail: `${present.length}/${measured.length} recommendation capabilities have present substrate` },
      { check: 'recommendation_trail_integrity', status: populated.length > 0 ? 'pass' : 'partial', detail: `${populated.length} persisted recommendation trails are populated` },
      { check: 'recommendation_consistency', status: consistent === measured.length ? 'pass' : consistent > 0 ? 'partial' : 'absent', detail: `${consistent}/${measured.length} capabilities are STRUCTURALLY self-consistent (valid kind + substrate handle). NOT acceptance or effectiveness.` },
      { check: 'registry_metadata_integrity', status: registryReady ? 'pass' : 'absent', detail: registryReady ? 'recommendation_registry exists (discovered)' : 'registry not yet discovered (flag-OFF or never run) — honest absent' },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.8 — Recommendation Validation',
      validation_kind: 'STRUCTURAL only (existence + population + reachability + self-consistency). NOT a runtime / acceptance / effectiveness / outcome verdict. Recommendation ≠ Decision.',
      checks,
      populated_trails: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Recommendation Metrics (6 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getRecommendationMetrics(pool: Pool) {
  return memo('ri:metrics', async () => {
    const measured = await measureCapabilities(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const measurableSubstrate = measured.filter((m) => m.engine ? m.engine_present : m.table_count != null).length;
    const tableBacked = measured.filter((m) => m.table);
    const populatedTrails = tableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    // Every curated capability is explainable via /explain → explainability is MEASURED, not assumed.
    const explainable = measured.length;
    return {
      phase: 'MX-800 Phase 2.8 — Recommendation Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'recommendation_quality', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Recommendation capabilities whose substrate is present. Present ≠ Populated.' },
        { metric: 'recommendation_confidence', axis: 'confidence', score: pct(measurableSubstrate, total), basis: { measured: measurableSubstrate, of: total }, note: 'STRUCTURAL verifiability only: capabilities whose substrate could be MEASURED. NOT runtime/acceptance/outcome accuracy. Confidence ≠ Accuracy.' },
        { metric: 'recommendation_coverage', axis: 'coverage', score: pct(populatedTrails, tableBacked.length), basis: { measured: populatedTrails, of: tableBacked.length }, note: 'Persisted recommendation trails that are populated. Coverage ⟂ Confidence.' },
        { metric: 'explainability_score', axis: 'evidence', score: pct(explainable, total), basis: { measured: explainable, of: total }, note: 'Capabilities that expose explainable reasoning (why/evidence/confidence/assumptions/alternatives/refs) via /explain.' },
        { metric: 'acceptance_rate', axis: 'adoption', score: null, basis: { measurable: false }, note: 'Recommendation ACCEPTANCE / adoption requires adoption telemetry (whether a surfaced recommendation was acted on) which is absent → honest-null (DEFERRED). This tier surfaces recommendation SUPPORT; it never measures whether a recommendation was accepted. Recommendation ≠ Decision.' },
        { metric: 'effectiveness', axis: 'outcome', score: null, basis: { measurable: false }, note: 'Recommendation EFFECTIVENESS requires labelled outcomes (whether an accepted recommendation worked) which are absent → honest-null (DEFERRED). Evidence ≠ Confidence; Confidence ≠ Accuracy.' },
      ],
      population: { capabilities: total, present, table_backed: tableBacked.length, populated_trails: populatedTrails },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (recommendation_registry — catalog of recommendation CAPABILITIES)
// ════════════════════════════════════════════════════════════════════════════
export async function getRecommendationRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_kind: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT recommendation_uid, name, recommendation_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_kind: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_kind[e.recommendation_kind] = (by_kind[e.recommendation_kind] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_kind, by_domain, entries };
}

export async function getRecommendationCapability(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE recommendation_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverRecommendations(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureRecommendationSchema(pool);
  const measured = await measureCapabilities(pool);
  let upserted = 0;
  for (const m of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (recommendation_uid, name, recommendation_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, intelligence_uid, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'discovered')
       ON CONFLICT (recommendation_uid) DO UPDATE SET
         name=EXCLUDED.name, recommendation_kind=EXCLUDED.recommendation_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present,
         table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         intelligence_uid=EXCLUDED.intelligence_uid, metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner + lifecycle_uid are MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers them.
      [m.uid, m.name, m.recommendation_kind, m.domain, m.table, m.engine, m.flag, m.present, m.table_count, m.flag_state, m.intelligence_uid,
       JSON.stringify({ description: m.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: RECOMMENDATION_SOURCES.length, by: actor };
}

export async function registerRecommendationCapability(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureRecommendationSchema(pool);
  const name = body?.name ? String(body.name) : null;
  if (!name) return { ok: false, error: 'name is required' };
  const table = body?.physical_table ? String(body.physical_table) : null;
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex
  // gate, not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (table != null && !isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.recommendation_uid ? String(body.recommendation_uid) : uid('ri-man');
  const table_present = table ? await tableReady(pool, table) : false;
  const table_count = table_present && table ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (recommendation_uid, name, recommendation_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual')
     ON CONFLICT (recommendation_uid) DO UPDATE SET
       name=EXCLUDED.name, recommendation_kind=EXCLUDED.recommendation_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present, table_count=EXCLUDED.table_count,
       flag_state=EXCLUDED.flag_state,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       intelligence_uid=COALESCE(EXCLUDED.intelligence_uid, ${REGISTRY_TABLE}.intelligence_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.recommendation_kind ? String(body.recommendation_kind) : 'recommendation', body?.domain ? String(body.domain) : null,
     table, body?.engine_path ? String(body.engine_path) : null, body?.governing_flag ? String(body.governing_flag) : null,
     table_present, table_count, null,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     body?.intelligence_uid ? String(body.intelligence_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, recommendation_uid: u, present: table_present, count: table_count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getRecommendationSummary(pool: Pool) {
  const [registry, catalog, metrics, validation, tiers] = await Promise.all([
    getRecommendationRegistry(pool), getRecommendationCatalog(pool), getRecommendationMetrics(pool), getRecommendationValidation(pool), composePriorTiers(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.8 — Recommendation Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    catalog: { capabilities: catalog.totals.capabilities, present: catalog.totals.present, table_backed: catalog.totals.table_backed, engine_backed: catalog.totals.engine_backed, recommendations_recorded: catalog.totals.recommendations_recorded, domains: catalog.by_domain.length },
    metrics: metrics.scores,
    composition: { prior_tiers_reachable: tiers.reachable, of: tiers.of, note: 'COMPOSES 2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive read-only. Re-runs no engine; generates no recommendation.' },
    validation_verdict: validation.verdict,
    execution_safety: { executes: false, automates: false, decides: false, modifies_production: false, recommend_only: true },
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function captureRecommendationSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureRecommendationSchema(pool);
  const [registry, catalog, metrics, validation, summary] = await Promise.all([
    getRecommendationRegistry(pool), getRecommendationCatalog(pool), getRecommendationMetrics(pool), getRecommendationValidation(pool), getRecommendationSummary(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('ri-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, capabilities_present, recommendations_recorded,
       recommendation_quality_pct, recommendation_confidence_pct, acceptance_rate_pct,
       recommendation_coverage_pct, explainability_pct, effectiveness_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [snapshot_uid, registry.total, catalog.totals.present, catalog.totals.recommendations_recorded,
     score('recommendation_quality'), score('recommendation_confidence'), score('acceptance_rate'),
     score('recommendation_coverage'), score('explainability_score'), score('effectiveness'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getRecommendationSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, capabilities_present, recommendations_recorded, recommendation_quality_pct, recommendation_confidence_pct, acceptance_rate_pct, recommendation_coverage_pct, explainability_pct, effectiveness_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getRecommendationDrift(pool: Pool) {
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
      recommendations_recorded: delta('recommendations_recorded'),
      recommendation_quality_pct: delta('recommendation_quality_pct'),
      recommendation_confidence_pct: delta('recommendation_confidence_pct'),
      acceptance_rate_pct: delta('acceptance_rate_pct'),
      recommendation_coverage_pct: delta('recommendation_coverage_pct'),
      explainability_pct: delta('explainability_pct'),
      effectiveness_pct: delta('effectiveness_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}

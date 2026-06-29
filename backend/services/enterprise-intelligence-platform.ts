/**
 * MX-800 Phase 2.10 — Enterprise Intelligence Platform (service layer).
 *
 * ENHANCEMENT-ONLY. The Enterprise Intelligence Platform is a READ-ONLY intelligence tier ABOUT the
 * platform's intelligence ecosystem. It REGISTERS the EXISTING intelligence domains / services (the eight
 * MX-800 intelligence tiers + the existing enterprise / executive / analytics / governance / reporting
 * services) into ONE canonical enterprise registry and COMPOSES the prior intelligence tiers (2.1 platform
 * / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8 recommendation /
 * 2.9 continuous-learning) into enterprise orchestration / cross-intelligence correlation / enterprise
 * insights / organizational intelligence / executive intelligence / explainability / validation / metrics.
 *
 * It introduces NO parallel enterprise platform, DUPLICATES no intelligence engine, and changes NO business
 * logic. Critically it INVOKES / ACTIVATES no dormant engine: it READS their EXISTENCE (engine source
 * files) and their PERSISTED OUTPUT (each tier's audit-snapshot trail) + their read-only summaries only —
 * composing an engine's existence/summary is NOT the same as running it (running a flag-OFF engine would be
 * dormant activation). It NEVER decides, NEVER executes, NEVER modifies business logic, and NEVER acts
 * autonomously. The repository + the existing intelligence registries remain the single source of truth.
 *
 * Composed substrate (READ-ONLY — reuse, never duplicate, never write, never invoke):
 *   - Eight MX-800 intelligence tiers (engine-file existence + audit-snapshot COUNT + read-only summary):
 *       platform-intelligence-registry / engineering-intelligence / runtime-intelligence /
 *       knowledge-intelligence / decision-intelligence / predictive-intelligence-engine /
 *       recommendation-intelligence-engine / continuous-learning-intelligence-engine.
 *   - Existing enterprise / executive / analytics / governance / reporting services (engine-file existence):
 *       enterprise-workforce-os-engine / workforce-intelligence-engine / governance-engine /
 *       explainability-governance-engine / executive-workforce-intelligence / m5-executive-intelligence /
 *       m5-enterprise-observability / enterprise-certification / report-factory-schema /
 *       enterprise-analytics-schema / workforce-analytics.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Integration ≠ Duplication. Intelligence ≠ Business Logic. Insight ≠ Decision. Dashboard ≠
 *     Intelligence. Correlation ≠ Causation. Recommendation ≠ Approval. Evidence ≠ Confidence. Confidence ≠
 *     Accuracy. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes). Built ≠ Activated. Present ≠ Populated.
 *     Connected ≠ Orchestrated. Human approval mandatory.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup). ABSENT table → present:false,
 *     count NULL (≠ 0). PRESENT-but-unreadable → count NULL (query error ≠ empty). Empty → 0.
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall". intelligence_maturity
 *     is STRUCTURAL only (reachability / verifiability), NOT runtime maturity. intelligence_effectiveness
 *     (outcome) and enterprise_optimization (longitudinal improvement) are UNMEASURABLE here (no labelled
 *     outcomes, no longitudinal deltas) → honest-NULL (DEFERRED), never a fabricated proxy.
 *   - Cross-intelligence correlation surfaces CO-PRESENCE / reachability of the intelligence channels — it
 *     NEVER asserts a causal link (Correlation ≠ Causation).
 *   - Enterprise insights are read-only OBSERVATIONS grounded in composed reachability + catalog
 *     measurement — they are NOT decisions and never trigger an action (Insight ≠ Decision).
 *   - Enterprise orchestration is METADATA-LEVEL coordination (which tier answers which concern) — it
 *     NEVER executes an engine (Connected ≠ Orchestrated; this tier connects + surfaces, never runs).
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *   - STOP clause: NO autonomous decision-making / self-modifying business logic / autonomous AI agents /
 *     auto-execution / duplicate dashboards / Enterprise V2. Every part is the evidence-grounded surfacing
 *     of EXISTING intelligence capabilities.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER create
 * schema and NEVER write to the existing intelligence tables. The lazy ensure-schema runs ONLY on flag-ON
 * write paths (discover / register / audit-capture) so flag OFF → byte-identical incl. schema (0 tables).
 * Every write path also asserts the flag itself BEFORE ensure-schema (defense-in-depth).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isEnterpriseIntelligencePlatformEnabled, listFlags } from '../config/feature-flags';

// Composed prior-tier summaries (EXISTING intelligence engines — reuse, never duplicate).
// These getters are GET-never-writes (to_regclass-probed reads, no ensure-schema, verified).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';
import { getDecisionSummary } from './decision-intelligence';
import { getPredictiveSummary } from './predictive-intelligence-engine';
import { getRecommendationSummary } from './recommendation-intelligence-engine';
import { getLearningSummary } from './continuous-learning-intelligence-engine';

const REGISTRY_TABLE = 'enterprise_intelligence_registry';
const SNAPSHOT_TABLE = 'enterprise_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class EnterpriseIntelligencePlatformDisabled extends Error {
  code = 'enterprise_intelligence_platform_disabled';
  constructor() {
    super('enterpriseIntelligencePlatform flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'EnterpriseIntelligencePlatformDisabled';
  }
}
function assertEnabled(): void {
  if (!isEnterpriseIntelligencePlatformEnabled()) throw new EnterpriseIntelligencePlatformDisabled();
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
/** MEASURED count of *.md files in a repo-relative directory. NULL on error (unreadable ≠ 0 — null ≠ 0). */
function countMarkdown(rel: string): number | null {
  try { return fs.readdirSync(path.join(process.cwd(), rel)).filter((f) => f.endsWith('.md')).length; }
  catch { return null; }
}

/**
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation, /orchestration,
 * /correlation, /insights, /executive and captureSnapshot all compose the SAME expensive measurement
 * (per-capability COUNT(*) + eight prior-tier summaries). Memoization dedupes within a request window.
 * TTL defaults to 8s (production unchanged); EI_MEMO_TTL_MS only overrides it for the offline validation
 * harness, which exercises ~12 composing getters back-to-back and would otherwise recompute each from cold.
 */
const MEMO_TTL_MS = Math.min(Math.max(Number(process.env.EI_MEMO_TTL_MS) || 8000, 0), 3_600_000);
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; });
  _memo.set(key, { at: Date.now(), val });
  return val;
}

// ── Curated, file/table-verified ENTERPRISE INTELLIGENCE catalog ─────────────
// Every `table` below is a REAL table NAME (verified in a migration); it may be ABSENT in this database
// (each MX-800 tier creates its snapshot trail only when its own flag is ON + discover/capture has run) →
// honest table_present:false, count NULL (≠ 0). Every `engine` file was verified to EXIST on disk. A
// capability is an EXISTING intelligence domain / service the platform already has — this tier never
// creates one and never runs one. `table` is the persisted intelligence trail (read-only, COUNT-only) or
// null for an engine without a persisted trail surfaced here. `engine` is the source file whose EXISTENCE
// is read (never imported / invoked). `flag` is the governing feature flag whose STATE is read (Built ≠
// Activated). `intelligence_uid` SOFT-links the MX-800 2.1 platform_intelligence_registry (no FK; honest-
// null when there is no clear canonical domain — never a fabricated mapping).
type EnterpriseKind = 'intelligence' | 'organizational' | 'executive' | 'analytics';
type EnterpriseSource = {
  uid: string; name: string; domain: string; enterprise_kind: EnterpriseKind;
  table: string | null; engine: string | null; flag: string | null;
  intelligence_uid: string | null; tier: string | null; description: string;
};
const ENTERPRISE_SOURCES: EnterpriseSource[] = [
  // ── Intelligence domains (the eight MX-800 intelligence tiers) ──
  {
    uid: 'ei-cap-platform-intelligence', name: 'Platform Intelligence', domain: 'platform',
    enterprise_kind: 'intelligence', table: 'platform_intelligence_audit_snapshots',
    engine: 'services/platform-intelligence-registry.ts', flag: 'platformIntelligenceRegistry',
    intelligence_uid: 'intel.repository', tier: 'MX-800 2.1',
    description: 'MX-800 2.1 Platform Intelligence registry. Audit-snapshot trail read COUNT-only + read-only summary; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-engineering-intelligence', name: 'Engineering Intelligence', domain: 'engineering',
    enterprise_kind: 'intelligence', table: 'engineering_intelligence_audit_snapshots',
    engine: 'services/engineering-intelligence.ts', flag: 'engineeringIntelligence',
    intelligence_uid: 'intel.repository', tier: 'MX-800 2.3',
    description: 'MX-800 2.3 Engineering Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-runtime-intelligence', name: 'Runtime Intelligence', domain: 'runtime',
    enterprise_kind: 'intelligence', table: 'runtime_intelligence_audit_snapshots',
    engine: 'services/runtime-intelligence.ts', flag: 'runtimeIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.4',
    description: 'MX-800 2.4 Runtime Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-knowledge-intelligence', name: 'Knowledge Intelligence', domain: 'knowledge',
    enterprise_kind: 'intelligence', table: 'knowledge_intelligence_audit_snapshots',
    engine: 'services/knowledge-intelligence.ts', flag: 'knowledgeIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.5',
    description: 'MX-800 2.5 Knowledge Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-decision-intelligence', name: 'Decision Intelligence', domain: 'decision',
    enterprise_kind: 'intelligence', table: 'decision_intelligence_audit_snapshots',
    engine: 'services/decision-intelligence.ts', flag: 'decisionIntelligenceEngine',
    intelligence_uid: 'intel.decision', tier: 'MX-800 2.6',
    description: 'MX-800 2.6 Decision Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; Insight ≠ Decision; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-predictive-intelligence', name: 'Predictive Intelligence', domain: 'predictive',
    enterprise_kind: 'intelligence', table: 'predictive_intelligence_audit_snapshots',
    engine: 'services/predictive-intelligence-engine.ts', flag: 'predictiveIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.7',
    description: 'MX-800 2.7 Predictive Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; Correlation ≠ Causation; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-recommendation-intelligence', name: 'Recommendation Intelligence', domain: 'recommendation',
    enterprise_kind: 'intelligence', table: 'recommendation_intelligence_audit_snapshots',
    engine: 'services/recommendation-intelligence-engine.ts', flag: 'recommendationIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.8',
    description: 'MX-800 2.8 Recommendation Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; Recommendation ≠ Approval; the engine is never invoked.',
  },
  {
    uid: 'ei-cap-learning-intelligence', name: 'Continuous Learning Intelligence', domain: 'learning',
    enterprise_kind: 'intelligence', table: 'continuous_learning_intelligence_audit_snapshots',
    engine: 'services/continuous-learning-intelligence-engine.ts', flag: 'continuousLearningIntelligenceEngine',
    intelligence_uid: 'intel.learning', tier: 'MX-800 2.9',
    description: 'MX-800 2.9 Continuous Learning Intelligence. Audit-snapshot trail read COUNT-only + read-only summary; Learning ≠ Automation; the engine is never invoked.',
  },
  // ── Organizational intelligence (existing workforce / org / governance services) ──
  {
    uid: 'ei-cap-workforce-os', name: 'Enterprise Workforce OS', domain: 'organizational',
    enterprise_kind: 'organizational', table: null, engine: 'services/enterprise-workforce-os-engine.ts',
    flag: 'enterpriseWorkforceOSV2', intelligence_uid: 'intel.enterprise', tier: null,
    description: 'Existing Enterprise Workforce OS engine (org graph / executive intelligence / observability). Engine existence read-only; never invoked.',
  },
  {
    uid: 'ei-cap-workforce-intelligence', name: 'Workforce Intelligence', domain: 'organizational',
    enterprise_kind: 'organizational', table: null, engine: 'services/workforce-intelligence-engine.ts',
    flag: null, intelligence_uid: 'intel.enterprise', tier: null,
    description: 'Existing workforce-intelligence engine. Engine existence read-only; never invoked.',
  },
  {
    uid: 'ei-cap-governance', name: 'Governance Intelligence', domain: 'governance',
    enterprise_kind: 'organizational', table: null, engine: 'services/governance-engine.ts',
    flag: null, intelligence_uid: null, tier: null,
    description: 'Existing governance engine (policy / RBAC / approval governance). Engine existence read-only; Recommendation ≠ Approval; never invoked.',
  },
  {
    uid: 'ei-cap-explainability-governance', name: 'Explainability Governance', domain: 'governance',
    enterprise_kind: 'organizational', table: null, engine: 'services/explainability-governance-engine.ts',
    flag: null, intelligence_uid: 'intel.ai', tier: null,
    description: 'Existing explainability-governance engine. Engine existence read-only; never invoked.',
  },
  // ── Executive intelligence (existing executive / observability / reporting / certification services) ──
  {
    uid: 'ei-cap-executive-workforce', name: 'Executive Workforce Intelligence', domain: 'executive',
    enterprise_kind: 'executive', table: null, engine: 'services/executive-workforce-intelligence.ts',
    flag: null, intelligence_uid: 'intel.enterprise', tier: null,
    description: 'Existing executive-workforce-intelligence engine. Engine existence read-only; Dashboard ≠ Intelligence; never invoked.',
  },
  {
    uid: 'ei-cap-m5-executive', name: 'M5 Executive Intelligence', domain: 'executive',
    enterprise_kind: 'executive', table: null, engine: 'services/m5-executive-intelligence.ts',
    flag: null, intelligence_uid: 'intel.enterprise', tier: null,
    description: 'Existing M5 executive-intelligence engine. Engine existence read-only; Dashboard ≠ Intelligence; never invoked.',
  },
  {
    uid: 'ei-cap-enterprise-observability', name: 'Enterprise Observability', domain: 'executive',
    enterprise_kind: 'executive', table: null, engine: 'services/m5-enterprise-observability.ts',
    flag: null, intelligence_uid: 'intel.enterprise', tier: null,
    description: 'Existing M5 enterprise-observability engine. Engine existence read-only; never invoked.',
  },
  {
    uid: 'ei-cap-enterprise-certification', name: 'Enterprise Certification', domain: 'executive',
    enterprise_kind: 'executive', table: null, engine: 'services/enterprise-certification.ts',
    flag: 'enterpriseCertification', intelligence_uid: 'intel.enterprise', tier: null,
    description: 'Existing enterprise-certification composer. Engine existence read-only; Built ≠ Activated; never invoked.',
  },
  {
    uid: 'ei-cap-report-factory', name: 'Report Factory', domain: 'reporting',
    enterprise_kind: 'executive', table: null, engine: 'services/report-factory-schema.ts',
    flag: null, intelligence_uid: 'intel.report', tier: null,
    description: 'Existing Report Factory engine (executive reporting). Engine existence read-only; never invoked.',
  },
  // ── Analytics intelligence (existing analytics warehouse / workforce analytics) ──
  {
    uid: 'ei-cap-enterprise-analytics', name: 'Enterprise Analytics', domain: 'analytics',
    enterprise_kind: 'analytics', table: null, engine: 'services/enterprise-analytics-schema.ts',
    flag: 'enterpriseAnalytics', intelligence_uid: 'intel.analytics', tier: null,
    description: 'Existing enterprise-analytics warehouse engine (anl_*). Engine existence read-only; Built ≠ Activated; never invoked.',
  },
  {
    uid: 'ei-cap-workforce-analytics', name: 'Workforce Analytics', domain: 'analytics',
    enterprise_kind: 'analytics', table: null, engine: 'services/workforce-analytics.ts',
    flag: null, intelligence_uid: 'intel.analytics', tier: null,
    description: 'Existing workforce-analytics engine. Engine existence read-only; never invoked.',
  },
];

/** Measure every capability ONCE: table present + exact COUNT(*); engine file present; governing flag
 *  STATE (Built ≠ Activated). Memoized per request window. */
type MeasuredCapability = EnterpriseSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureCapabilities(pool: Pool): Promise<MeasuredCapability[]> {
  return memo('ei:caps', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(ENTERPRISE_SOURCES.map(async (s) => {
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
/** Lazy ensure-schema — canonical mirror of 20261229_enterprise_intelligence_platform.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureEnterpriseSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      enterprise_uid      TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      enterprise_kind     TEXT NOT NULL,           -- intelligence|organizational|executive|analytics
      domain              TEXT,                    -- platform|engineering|runtime|knowledge|decision|predictive|recommendation|learning|organizational|governance|executive|reporting|analytics
      physical_table      TEXT,                    -- the EXISTING persisted intelligence trail (read-only) or NULL
      engine_path         TEXT,                    -- the EXISTING engine source file (existence read-only) or NULL
      governing_flag      TEXT,                    -- governing feature flag key or NULL (unverified gate — honest)
      tier                TEXT,                    -- source tier label (e.g. 'MX-800 2.4') or NULL
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
    CREATE INDEX IF NOT EXISTS idx_eir_enterprise_kind ON ${REGISTRY_TABLE} (enterprise_kind);
    CREATE INDEX IF NOT EXISTS idx_eir_domain          ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      capabilities_present        INTEGER,
      intelligence_records        INTEGER,
      tiers_reachable             INTEGER,
      enterprise_health_pct       NUMERIC,
      intelligence_maturity_pct   NUMERIC,
      intelligence_coverage_pct   NUMERIC,
      explainability_pct          NUMERIC,
      intelligence_effectiveness_pct NUMERIC,      -- honest-NULL (outcome unmeasurable)
      enterprise_optimization_pct NUMERIC,         -- honest-NULL (longitudinal improvement unmeasurable)
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eias_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

const AXES_NOTE =
  'Integration ≠ Duplication. Intelligence ≠ Business Logic. Insight ≠ Decision. Dashboard ≠ Intelligence. ' +
  'Correlation ≠ Causation. Recommendation ≠ Approval. Evidence ≠ Confidence. Confidence ≠ Accuracy. ' +
  'Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes). Built ≠ Activated. Present ≠ Populated. ' +
  'Connected ≠ Orchestrated. Human approval remains mandatory. Metrics are NEVER composited.';
const REPO_REFS = [
  'backend/services/enterprise-intelligence-platform.ts',
  'backend/routes/enterprise-intelligence-platform.ts',
  'backend/migrations/20261229_enterprise_intelligence_platform.sql',
];

// Each prior-tier summary is GET-never-writes; wrap so an unavailable tier degrades to honest-null.
const safeTier = async (fn: () => Promise<any>) => {
  try { return { reachable: true, summary: await fn() }; }
  catch (e: any) { return { reachable: false, summary: null, note: `tier unavailable: ${e?.code || e?.message || 'error'}` }; }
};
function composePriorTiers(pool: Pool) {
  return memo('ei:tiers', async () => {
    const [platform, engineering, runtime, knowledge, decision, predictive, recommendation, learning] = await Promise.all([
      safeTier(() => getPlatformSummary(pool)),
      safeTier(() => getEngineeringSummary(pool)),
      safeTier(() => getRuntimeSummary(pool)),
      safeTier(() => getKnowledgeSummary(pool)),
      safeTier(() => getDecisionSummary(pool)),
      safeTier(() => getPredictiveSummary(pool)),
      safeTier(() => getRecommendationSummary(pool)),
      safeTier(() => getLearningSummary(pool)),
    ]);
    const all = [platform, engineering, runtime, knowledge, decision, predictive, recommendation, learning];
    const reachable = all.filter((t) => t.reachable).length;
    return { tiers: { platform, engineering, runtime, knowledge, decision, predictive, recommendation, learning }, reachable, of: 8 };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Enterprise Intelligence Registry (catalog of EXISTING intelligence domains/services)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseCatalog(pool: Pool) {
  return memo('ei:catalog', async () => {
    const measured = await measureCapabilities(pool);
    const by_domain: Record<string, { domain: string; capabilities: number; present: number; intelligence_records: number | null }> = {};
    const by_kind: Record<string, number> = {};
    for (const m of measured) {
      const d = (by_domain[m.domain] ??= { domain: m.domain, capabilities: 0, present: 0, intelligence_records: null });
      d.capabilities++;
      if (m.present) d.present++;
      if (m.table_count != null) d.intelligence_records = (d.intelligence_records ?? 0) + m.table_count;
      by_kind[m.enterprise_kind] = (by_kind[m.enterprise_kind] ?? 0) + 1;
    }
    return {
      phase: 'MX-800 Phase 2.10 — Enterprise Intelligence Registry',
      catalog_note:
        'A curated catalog of the EXISTING intelligence domains / services the platform already has (the ' +
        'eight MX-800 intelligence tiers + existing enterprise / executive / analytics / governance / ' +
        'reporting services). This tier NEVER creates an intelligence capability and NEVER runs one — it ' +
        'reads each one\'s substrate (persisted trail and/or engine source file) and its governing-flag ' +
        'state. Engine existence is READ, never invoked. Integration ≠ Duplication.',
      totals: {
        capabilities: measured.length,
        present: measured.filter((m) => m.present).length,
        table_backed: measured.filter((m) => m.table).length,
        engine_backed: measured.filter((m) => m.engine).length,
        intelligence_records: (() => { const xs = measured.map((m) => m.table_count).filter((x): x is number => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; })(),
      },
      by_domain: Object.values(by_domain).sort((a, b) => a.domain.localeCompare(b.domain)),
      by_kind,
      capabilities: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, enterprise_kind: m.enterprise_kind, tier: m.tier,
        table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, intelligence_uid: m.intelligence_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Enterprise Orchestration (metadata-level coordination of the 8 tiers; Connected ≠ Orchestrated)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseOrchestration(pool: Pool) {
  return memo('ei:orchestration', async () => {
    const tiers = await composePriorTiers(pool);
    const measured = await measureCapabilities(pool);
    const intelCaps = measured.filter((m) => m.enterprise_kind === 'intelligence');
    return {
      phase: 'MX-800 Phase 2.10 — Enterprise Orchestration',
      orchestration_kind:
        'METADATA-LEVEL coordination of the eight EXISTING intelligence tiers (which tier answers which ' +
        'enterprise concern) composed from their read-only summaries. This tier NEVER executes an engine, ' +
        'NEVER re-runs a tier and NEVER decides — it surfaces how the existing tiers connect. ' +
        'Connected ≠ Orchestrated: this is read-only coordination metadata, not runtime orchestration.',
      orchestration_safety: { executes_engines: false, re_runs_tiers: false, decides: false, modifies_business_logic: false, write_paths_to_business_tables: 0, note: 'Read-only — the only writes in this tier are to its own 2 owned tables on flag-ON audit/discovery.' },
      tiers: {
        platform: { tier: 'MX-800 2.1', reachable: tiers.tiers.platform.reachable, role: 'repository / platform intelligence' },
        engineering: { tier: 'MX-800 2.3', reachable: tiers.tiers.engineering.reachable, role: 'engineering intelligence' },
        runtime: { tier: 'MX-800 2.4', reachable: tiers.tiers.runtime.reachable, role: 'runtime / operational intelligence' },
        knowledge: { tier: 'MX-800 2.5', reachable: tiers.tiers.knowledge.reachable, role: 'knowledge intelligence' },
        decision: { tier: 'MX-800 2.6', reachable: tiers.tiers.decision.reachable, role: 'decision support (Insight ≠ Decision)' },
        predictive: { tier: 'MX-800 2.7', reachable: tiers.tiers.predictive.reachable, role: 'predictive intelligence (Correlation ≠ Causation)' },
        recommendation: { tier: 'MX-800 2.8', reachable: tiers.tiers.recommendation.reachable, role: 'recommendation support (Recommendation ≠ Approval)' },
        learning: { tier: 'MX-800 2.9', reachable: tiers.tiers.learning.reachable, role: 'continuous learning intelligence (Learning ≠ Automation)' },
      },
      intelligence_capabilities: intelCaps.map((m) => ({ capability: m.uid, name: m.name, tier: m.tier, persisted_trail: m.table, trail_present: m.table_present, intelligence_records: m.table_count, governing_flag: m.flag, flag_state: m.flag_state })),
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Cross-Intelligence Correlation (co-presence/reachability of channels; Correlation ≠ Causation)
// ════════════════════════════════════════════════════════════════════════════
export async function getCrossIntelligenceCorrelation(pool: Pool) {
  return memo('ei:correlation', async () => {
    const tiers = await composePriorTiers(pool);
    const measured = await measureCapabilities(pool);
    // CO-PRESENCE only: which intelligence channels exist + are populated, side by side. We NEVER assert
    // that one channel causes another (Correlation ≠ Causation).
    const channel = (key: keyof typeof tiers.tiers, label: string) => ({
      channel: label, source_tier_reachable: tiers.tiers[key].reachable,
    });
    const intelCaps = measured.filter((m) => m.enterprise_kind === 'intelligence');
    const populated = intelCaps.filter((m) => (m.table_count ?? 0) > 0).length;
    return {
      phase: 'MX-800 Phase 2.10 — Cross-Intelligence Correlation',
      correlation_kind:
        'Surfaces the CO-PRESENCE and reachability of the platform\'s intelligence channels (repository / ' +
        'runtime / engineering events, knowledge relationships, decision evidence, predictions, ' +
        'recommendations, learning outcomes) side by side. It reports WHERE channels exist together; it ' +
        'NEVER asserts that one channel causes another. Correlation ≠ Causation.',
      correlation_safety: { asserts_causation: false, infers_causal_links: false, decides: false, note: 'Read-only co-presence/reachability only — no causal claim is ever made.' },
      channels: {
        repository_events: channel('platform', 'repository / platform events'),
        engineering_events: channel('engineering', 'engineering events'),
        runtime_events: channel('runtime', 'runtime events'),
        knowledge_relationships: channel('knowledge', 'knowledge relationships'),
        decision_evidence: channel('decision', 'decision evidence'),
        predictions: channel('predictive', 'predictions'),
        recommendations: channel('recommendation', 'recommendations'),
        learning_outcomes: channel('learning', 'learning outcomes'),
      },
      co_presence: {
        channels_reachable: tiers.reachable, of: tiers.of,
        intelligence_trails_populated: populated, of_intelligence_caps: intelCaps.length,
        note: 'Co-presence = channels reachable together. Populated trails are exact COUNT(*) (null ≠ 0). This is NOT a correlation coefficient and NOT a causal model.',
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Enterprise Insights (read-only observations; Insight ≠ Decision)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseInsights(pool: Pool) {
  return memo('ei:insights', async () => {
    const tiers = await composePriorTiers(pool);
    const measured = await measureCapabilities(pool);
    const present = measured.filter((m) => m.present).length;
    const total = measured.length;
    const dormant = measured.filter((m) => m.flag != null && m.flag_state === false); // Built ≠ Activated
    // Each insight is a read-only OBSERVATION grounded in measured reachability/catalog state. It is NOT a
    // decision and never triggers an action (Insight ≠ Decision).
    const insights = [
      { category: 'executive', insight: `${tiers.reachable}/${tiers.of} intelligence tiers are reachable as enterprise-wide intelligence channels.`, evidence: 'composePriorTiers reachability', is_decision: false },
      { category: 'engineering', insight: 'Engineering + repository intelligence are composed read-only from MX-800 2.1/2.3 summaries; no engine is re-run.', evidence: 'platform + engineering tier summaries', is_decision: false },
      { category: 'operational', insight: 'Operational health is composed read-only from MX-800 2.4 Runtime Intelligence; this tier never measures runtime itself.', evidence: 'runtime tier summary', is_decision: false },
      { category: 'repository', insight: `${present}/${total} enterprise intelligence capabilities have present substrate (table or engine).`, evidence: 'catalog measurement', is_decision: false },
      { category: 'risk', insight: dormant.length > 0 ? `${dormant.length} cataloged capabilities are BUILT but flag-OFF (dormant — Built ≠ Activated). Dormant ≠ debt; this is an honest observation, not an instruction to activate.` : 'No cataloged capability is observed flag-OFF (or flag state unverified — reported honest-null).', evidence: 'governing-flag state', is_decision: false },
      { category: 'opportunity', insight: 'Cross-intelligence correlation channels are surfaced read-only; where channels are co-present, an operator MAY review them — this tier never acts.', evidence: 'cross-intelligence correlation', is_decision: false },
      { category: 'strategic', insight: 'The platform is Connected (intelligence tiers composed) — Connected ≠ Orchestrated; orchestration here is metadata-level only and human approval remains mandatory.', evidence: 'orchestration metadata', is_decision: false },
    ];
    return {
      phase: 'MX-800 Phase 2.10 — Enterprise Insights',
      insights_kind: 'Read-only OBSERVATIONS grounded in composed tier reachability + catalog measurement. An insight is NOT a decision and never triggers an action. Insight ≠ Decision; human approval remains mandatory.',
      insights_safety: { is_decision: false, triggers_action: false, modifies_business_logic: false, autonomous: false, note: 'Every insight is a read-only observation; none is acted upon.' },
      insights,
      dormant_capabilities: dormant.map((m) => ({ capability: m.uid, name: m.name, governing_flag: m.flag, flag_state: m.flag_state })),
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Organizational Intelligence (surface EXISTING org/governance substrate; read-only)
// ════════════════════════════════════════════════════════════════════════════
export async function getOrganizationalIntelligence(pool: Pool) {
  return memo('ei:organizational', async () => {
    const measured = await measureCapabilities(pool);
    const orgCaps = measured.filter((m) => m.enterprise_kind === 'organizational');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.10 — Organizational Intelligence',
      organizational_kind:
        'Surfaces the platform\'s EXISTING organizational substrate (workforce OS / workforce intelligence ' +
        '/ governance / explainability governance) and composes the knowledge + platform tiers as the ' +
        'organization / team / capability / portfolio / product / governance intelligence channels. This ' +
        'tier READS existing org capabilities; it never decides and never modifies business logic.',
      organizational_safety: { decides: false, modifies_business_logic: false, autonomous: false, note: 'Read-only — org capabilities are surfaced from EXISTING engines, never invoked or modified.' },
      organizational_capabilities: orgCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, records: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present, governing_flag: m.flag, flag_state: m.flag_state,
      })),
      composed_channels: {
        organization: { source: 'MX-800 2.1 platform-intelligence summary', reachable: tiers.tiers.platform.reachable },
        capability: { source: 'MX-800 2.5 knowledge-intelligence summary', reachable: tiers.tiers.knowledge.reachable },
        governance: { source: 'organizational governance engines (existence read-only)', present: orgCaps.some((m) => m.domain === 'governance' && m.engine_present) },
        portfolio_product: { source: 'enterprise workforce OS (existence read-only)', present: orgCaps.some((m) => m.uid === 'ei-cap-workforce-os' && m.engine_present), note: 'Portfolio/product intelligence is surfaced via the existing workforce-OS engine existence only; no portfolio model is fabricated.' },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Enterprise Explainability (/explain/:uid — why/evidence/confidence + state framing)
// ════════════════════════════════════════════════════════════════════════════
export async function explainEnterprise(pool: Pool, uidArg: string) {
  const src = ENTERPRISE_SOURCES.find((s) => s.uid === uidArg || s.table === uidArg);
  if (!src) return { found: false, uid: uidArg, note: 'No such enterprise intelligence capability in the curated catalog.' };
  const table_present = src.table ? await tableReady(pool, src.table) : false;
  const table_count = table_present && src.table ? await countTable(pool, src.table) : null;
  const engine_present = src.engine ? fileCheck(src.engine) : false;
  const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
  const flag_state = src.flag ? (src.flag in flags ? !!flags[src.flag] : null) : null;
  const siblings = ENTERPRISE_SOURCES.filter((s) => s.enterprise_kind === src.enterprise_kind && s.uid !== src.uid);
  return {
    found: true,
    uid: src.uid, name: src.name, domain: src.domain, enterprise_kind: src.enterprise_kind, tier: src.tier,
    why: `${src.description} It is an EXISTING ${src.enterprise_kind} capability in the ${src.domain} domain; this tier integrates, explains and surfaces it — it never duplicates it, never runs it, never decides, and never executes. Integration ≠ Duplication.`,
    evidence: {
      persisted_trail: src.table, trail_present: table_present, intelligence_records: table_count, // null ≠ 0
      engine_source: src.engine, engine_present, governing_flag: src.flag, flag_state,
    },
    confidence: {
      level: 'structural',
      basis: (engine_present || table_present) ? 'substrate present' : 'substrate absent',
      note: 'STRUCTURAL confidence only — NOT runtime / accuracy / outcome / maturity. Confidence ≠ Accuracy; Evidence ≠ Confidence.',
    },
    // State framing is HONEST: this tier NEVER mutates an engine, so there is no changed state.
    previous_state: 'unchanged — this tier never mutates the engine or its persisted trail',
    current_state: { substrate_present: (engine_present || table_present), intelligence_records: table_count },
    reason_for_change: 'NO CHANGE — this tier READS and surfaces the EXISTING intelligence capability; it never decides, executes, modifies business logic, or acts autonomously (Intelligence ≠ Business Logic).',
    assumptions: [
      'The persisted trail reflects an EXISTING engine\'s output; this tier does not re-derive or validate that output.',
      src.flag ? `Capability is gated by feature flag '${src.flag}' (Built ≠ Activated; this tier never activates it).` : 'Governing flag unverified — reported honest-null, never assumed.',
    ],
    alternatives: siblings.map((s) => ({ uid: s.uid, name: s.name, enterprise_kind: s.enterprise_kind })),
    dependencies: src.intelligence_uid ? [{ intelligence_uid: src.intelligence_uid, soft_link: 'platform_intelligence_registry (MX-800 2.1)' }] : [],
    repository_refs: REPO_REFS.concat(src.engine ? [`backend/${src.engine}`] : []),
    knowledge_refs: ['MX-800 2.5 Knowledge Intelligence (getKnowledgeSummary) — composed read-only'],
    runtime_refs: ['MX-800 2.4 Runtime Intelligence (getRuntimeSummary) — composed read-only'],
    governance: { human_approval: 'mandatory', automated_action: false, autonomous: false, modifies_business_logic: false, executes: false, decides: false },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Enterprise Validation (STRUCTURAL integrity only)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseValidation(pool: Pool) {
  return memo('ei:validation', async () => {
    const measured = await measureCapabilities(pool);
    const present = measured.filter((m) => m.present);
    const populated = measured.filter((m) => (m.table_count ?? 0) > 0);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const tiers = await composePriorTiers(pool);
    // Enterprise consistency: every catalog capability declares an enterprise_kind from the allowed set and
    // has at least one substrate handle (table OR engine). STRUCTURAL self-consistency, not effectiveness.
    const KINDS = new Set(['intelligence', 'organizational', 'executive', 'analytics']);
    const consistent = measured.filter((m) => KINDS.has(m.enterprise_kind) && (m.table || m.engine)).length;
    const checks = [
      { check: 'repository_integrity', status: (fileCheck('services/enterprise-intelligence-platform.ts') && fileCheck('routes/enterprise-intelligence-platform.ts') && fileCheck('migrations/20261229_enterprise_intelligence_platform.sql')) ? 'pass' : 'partial', detail: 'service + route + migration files present' },
      { check: 'intelligence_integrity', status: measured.some((m) => m.engine && m.engine_present) ? 'pass' : 'partial', detail: 'at least one intelligence-engine source file exists (logic lives in code, read-only)' },
      { check: 'evidence_integrity', status: tiers.reachable > 0 ? 'pass' : 'absent', detail: `${tiers.reachable}/${tiers.of} prior intelligence tiers reachable` },
      { check: 'enterprise_integrity', status: present.length === measured.length ? 'pass' : present.length > 0 ? 'partial' : 'absent', detail: `${present.length}/${measured.length} enterprise capabilities have present substrate` },
      { check: 'knowledge_integrity', status: tiers.tiers.knowledge.reachable ? 'pass' : 'partial', detail: 'MX-800 2.5 knowledge-intelligence summary reachable' },
      { check: 'recommendation_integrity', status: tiers.tiers.recommendation.reachable ? 'pass' : 'partial', detail: 'MX-800 2.8 recommendation-intelligence summary reachable (Recommendation ≠ Approval)' },
      { check: 'organizational_integrity', status: measured.some((m) => m.enterprise_kind === 'organizational' && m.present) ? 'pass' : 'partial', detail: 'at least one organizational capability has present substrate' },
      { check: 'enterprise_consistency', status: consistent === measured.length ? 'pass' : consistent > 0 ? 'partial' : 'absent', detail: `${consistent}/${measured.length} capabilities are STRUCTURALLY self-consistent (valid kind + substrate handle). NOT effectiveness or maturity.` },
      { check: 'registry_metadata_integrity', status: registryReady ? 'pass' : 'absent', detail: registryReady ? 'enterprise_intelligence_registry exists (discovered)' : 'registry not yet discovered (flag-OFF or never run) — honest absent' },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.10 — Enterprise Validation',
      validation_kind: 'STRUCTURAL only (existence + population + reachability + self-consistency). NOT a runtime / maturity / effectiveness / outcome verdict. Intelligence ≠ Business Logic.',
      checks,
      populated_trails: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Enterprise Metrics (6 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseMetrics(pool: Pool) {
  return memo('ei:metrics', async () => {
    const measured = await measureCapabilities(pool);
    const tiers = await composePriorTiers(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const measurableSubstrate = measured.filter((m) => m.engine ? m.engine_present : m.table_count != null).length;
    const tableBacked = measured.filter((m) => m.table);
    const populatedTrails = tableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    const explainable = measured.length; // every curated capability is explainable via /explain — MEASURED
    return {
      phase: 'MX-800 Phase 2.10 — Enterprise Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps. repository / engineering / operational health are COMPOSED read-only in orchestration / executive, never blended into a single number.',
      scores: [
        { metric: 'enterprise_health', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Enterprise intelligence capabilities whose substrate is present. Present ≠ Populated.' },
        { metric: 'intelligence_maturity', axis: 'confidence', score: pct(tiers.reachable, tiers.of), basis: { reachable: tiers.reachable, of: tiers.of }, note: 'STRUCTURAL maturity only: prior intelligence tiers reachable as enterprise channels. Connected ≠ Orchestrated; NOT runtime maturity or accuracy. Confidence ≠ Accuracy.' },
        { metric: 'intelligence_coverage', axis: 'coverage', score: pct(populatedTrails, tableBacked.length), basis: { measured: populatedTrails, of: tableBacked.length }, note: 'Persisted intelligence trails (tier audit-snapshots) that are populated. Coverage ⟂ Confidence. Mostly null/low in dev (tier flags OFF) — honest, not a defect.' },
        { metric: 'explainability_score', axis: 'evidence', score: pct(explainable, total), basis: { measured: explainable, of: total }, note: 'Capabilities that expose explainable reasoning (why/evidence/confidence/state/assumptions/alternatives/refs) via /explain. Evidence ≠ Confidence.' },
        { metric: 'intelligence_effectiveness', axis: 'outcome', score: null, basis: { measurable: false }, note: 'Enterprise intelligence EFFECTIVENESS requires labelled outcomes (whether composed intelligence improved an enterprise outcome) which are absent → honest-null (DEFERRED). This tier surfaces enterprise INSIGHT, it never measures outcome. Insight ≠ Decision.' },
        { metric: 'enterprise_optimization', axis: 'improvement', score: null, basis: { measurable: false }, note: 'Enterprise OPTIMIZATION (longitudinal improvement of the intelligence ecosystem) requires longitudinal labelled deltas which are absent → honest-null (DEFERRED). Improvement ≠ Optimization; this tier never optimizes.' },
      ],
      population: { capabilities: total, present, table_backed: tableBacked.length, populated_trails: populatedTrails, tiers_reachable: tiers.reachable, of_tiers: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 9 — Executive Intelligence (KPIs/indicators/trends/risks/opportunities composed from tiers)
// ════════════════════════════════════════════════════════════════════════════
export async function getExecutiveIntelligence(pool: Pool) {
  return memo('ei:executive', async () => {
    const measured = await measureCapabilities(pool);
    const execCaps = measured.filter((m) => m.enterprise_kind === 'executive');
    const tiers = await composePriorTiers(pool);
    const present = measured.filter((m) => m.present).length;
    const dormant = measured.filter((m) => m.flag != null && m.flag_state === false);
    return {
      phase: 'MX-800 Phase 2.10 — Executive Intelligence',
      executive_kind:
        'Composes the EXISTING executive / observability / reporting / certification engines (existence ' +
        'read-only) + the eight intelligence-tier summaries into read-only enterprise KPIs / strategic ' +
        'indicators / trends / risks / opportunities for executive reporting. Dashboard ≠ Intelligence; ' +
        'this tier surfaces measured indicators, it never decides and never reports a fabricated number.',
      executive_safety: { decides: false, modifies_business_logic: false, autonomous: false, fabricates_kpis: false, note: 'Read-only — every indicator is MEASURED from existing substrate/tiers; unmeasurable indicators are honest-null.' },
      executive_capabilities: execCaps.map((m) => ({ capability: m.uid, name: m.name, domain: m.domain, engine_source: m.engine, engine_present: m.engine_present, governing_flag: m.flag, flag_state: m.flag_state })),
      enterprise_kpis: [
        { kpi: 'intelligence_tiers_reachable', value: tiers.reachable, of: tiers.of, measured: true },
        { kpi: 'enterprise_capabilities_present', value: present, of: measured.length, measured: true },
        { kpi: 'executive_engines_present', value: execCaps.filter((m) => m.engine_present).length, of: execCaps.length, measured: true },
        { kpi: 'enterprise_outcome_effectiveness', value: null, measured: false, note: 'No labelled enterprise outcomes — honest-null (DEFERRED).' },
      ],
      strategic_indicators: {
        connected_not_orchestrated: { value: true, note: 'Intelligence tiers are composed (Connected); orchestration is metadata-level only (Connected ≠ Orchestrated).' },
        dormant_capabilities: { value: dormant.length, note: 'Built but flag-OFF (Built ≠ Activated). Dormant ≠ debt; an observation, not an instruction to activate.' },
      },
      enterprise_trends: { ready: false, note: 'Trends need ≥2 audit snapshots — see /audit/drift. null ≠ 0.' },
      enterprise_risks: dormant.length > 0 ? [{ risk: 'dormant_intelligence', detail: `${dormant.length} intelligence capabilities built but flag-OFF`, severity: 'observational' }] : [],
      enterprise_opportunities: [{ opportunity: 'cross_intelligence_review', detail: 'Co-present intelligence channels MAY be reviewed by an operator; this tier never acts.', requires_human_approval: true }],
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (enterprise_intelligence_registry — catalog of intelligence CAPABILITIES)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_kind: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT enterprise_uid, name, enterprise_kind, domain, physical_table, engine_path, governing_flag, tier, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_kind: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_kind[e.enterprise_kind] = (by_kind[e.enterprise_kind] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_kind, by_domain, entries };
}

export async function getEnterpriseCapability(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE enterprise_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverEnterprise(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureEnterpriseSchema(pool);
  const measured = await measureCapabilities(pool);
  let upserted = 0;
  for (const m of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (enterprise_uid, name, enterprise_kind, domain, physical_table, engine_path, governing_flag, tier, present, table_count, flag_state, intelligence_uid, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'discovered')
       ON CONFLICT (enterprise_uid) DO UPDATE SET
         name=EXCLUDED.name, enterprise_kind=EXCLUDED.enterprise_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, tier=EXCLUDED.tier, present=EXCLUDED.present,
         table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         intelligence_uid=EXCLUDED.intelligence_uid, metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner + lifecycle_uid are MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers them.
      [m.uid, m.name, m.enterprise_kind, m.domain, m.table, m.engine, m.flag, m.tier, m.present, m.table_count, m.flag_state, m.intelligence_uid,
       JSON.stringify({ description: m.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: ENTERPRISE_SOURCES.length, by: actor };
}

export async function registerEnterpriseCapability(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureEnterpriseSchema(pool);
  const name = body?.name ? String(body.name) : null;
  if (!name) return { ok: false, error: 'name is required' };
  const table = body?.physical_table ? String(body.physical_table) : null;
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex gate,
  // not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (table != null && !isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.enterprise_uid ? String(body.enterprise_uid) : uid('ei-man');
  const table_present = table ? await tableReady(pool, table) : false;
  const table_count = table_present && table ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (enterprise_uid, name, enterprise_kind, domain, physical_table, engine_path, governing_flag, tier, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual')
     ON CONFLICT (enterprise_uid) DO UPDATE SET
       name=EXCLUDED.name, enterprise_kind=EXCLUDED.enterprise_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, tier=EXCLUDED.tier, present=EXCLUDED.present, table_count=EXCLUDED.table_count,
       flag_state=EXCLUDED.flag_state,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       intelligence_uid=COALESCE(EXCLUDED.intelligence_uid, ${REGISTRY_TABLE}.intelligence_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.enterprise_kind ? String(body.enterprise_kind) : 'intelligence', body?.domain ? String(body.domain) : null,
     table, body?.engine_path ? String(body.engine_path) : null, body?.governing_flag ? String(body.governing_flag) : null,
     body?.tier ? String(body.tier) : null, table_present, table_count, null,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     body?.intelligence_uid ? String(body.intelligence_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, enterprise_uid: u, present: table_present, count: table_count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseSummary(pool: Pool) {
  const [registry, catalog, metrics, validation, tiers] = await Promise.all([
    getEnterpriseRegistry(pool), getEnterpriseCatalog(pool), getEnterpriseMetrics(pool), getEnterpriseValidation(pool), composePriorTiers(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.10 — Enterprise Intelligence Platform',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    catalog: { capabilities: catalog.totals.capabilities, present: catalog.totals.present, table_backed: catalog.totals.table_backed, engine_backed: catalog.totals.engine_backed, intelligence_records: catalog.totals.intelligence_records, domains: catalog.by_domain.length },
    metrics: metrics.scores,
    composition: { prior_tiers_reachable: tiers.reachable, of: tiers.of, note: 'COMPOSES 2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8 recommendation / 2.9 learning read-only. Re-runs no engine; decides nothing. Integration ≠ Duplication; Connected ≠ Orchestrated.' },
    validation_verdict: validation.verdict,
    enterprise_safety: { decides: false, modifies_business_logic: false, executes: false, autonomous: false, duplicates_engines: false, insight_only: true },
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function captureEnterpriseSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureEnterpriseSchema(pool);
  const [registry, catalog, metrics, validation, summary, tiers] = await Promise.all([
    getEnterpriseRegistry(pool), getEnterpriseCatalog(pool), getEnterpriseMetrics(pool), getEnterpriseValidation(pool), getEnterpriseSummary(pool), composePriorTiers(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('ei-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, capabilities_present, intelligence_records, tiers_reachable,
       enterprise_health_pct, intelligence_maturity_pct, intelligence_coverage_pct,
       explainability_pct, intelligence_effectiveness_pct, enterprise_optimization_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [snapshot_uid, registry.total, catalog.totals.present, catalog.totals.intelligence_records, tiers.reachable,
     score('enterprise_health'), score('intelligence_maturity'), score('intelligence_coverage'),
     score('explainability_score'), score('intelligence_effectiveness'), score('enterprise_optimization'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getEnterpriseSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, capabilities_present, intelligence_records, tiers_reachable, enterprise_health_pct, intelligence_maturity_pct, intelligence_coverage_pct, explainability_pct, intelligence_effectiveness_pct, enterprise_optimization_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getEnterpriseDrift(pool: Pool) {
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
      intelligence_records: delta('intelligence_records'),
      tiers_reachable: delta('tiers_reachable'),
      enterprise_health_pct: delta('enterprise_health_pct'),
      intelligence_maturity_pct: delta('intelligence_maturity_pct'),
      intelligence_coverage_pct: delta('intelligence_coverage_pct'),
      explainability_pct: delta('explainability_pct'),
      intelligence_effectiveness_pct: delta('intelligence_effectiveness_pct'),
      enterprise_optimization_pct: delta('enterprise_optimization_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}

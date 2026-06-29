/**
 * MX-800 Phase 2.13 — Enterprise Intelligence Integration Platform (service layer).
 *
 * ENHANCEMENT-ONLY. A READ-ONLY tier ABOUT the platform's intelligence ecosystem. It REGISTERS the EXISTING
 * MX-800 intelligence/enterprise tiers (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6
 * decision / 2.7 predictive / 2.8 recommendation / 2.9 learning / 2.10 enterprise / 2.12 automation-
 * governance) + the MX-700 platform tiers (1.41 lifecycle-automation, 1.37 lifecycle-foundation) + the
 * workflow engine + the report factory into ONE canonical enterprise INTEGRATION registry and COMPOSES their
 * read-only summaries into:
 *   - Part 1 Enterprise Integration Registry (curated, file/table-verified catalog of EXISTING services)
 *   - Part 2 Cross-Intelligence Integration (the 9 governed intelligence channels, reachability composed)
 *   - Part 3 Enterprise Service Composition (all integrated services grouped by kind, reachability composed)
 *   - Part 4 Platform Interoperability (DESCRIPTIVE contract conformance — standards READ, never enforced)
 *   - Part 5 Enterprise Coordination (METADATA-level routing of which service answers which concern)
 *   - Part 6 Enterprise Explainability (why/evidence/deps/confidence for ONE service; unknown → found:false)
 *   - Part 7 Integration Validation (STRUCTURAL only — existence + population + reachability)
 *   - Part 8 Enterprise Metrics (6 SEPARATE measured scores — NEVER composited)
 *
 * It introduces NO parallel platform, DUPLICATES no engine, and changes NO business logic. Critically it
 * INVOKES / ACTIVATES no dormant engine: it READS engine-file EXISTENCE + each service's PERSISTED OUTPUT
 * (audit/registry trail COUNT-only) + each tier's read-only SUMMARY getter only. It NEVER emits an event,
 * NEVER starts a scheduler, NEVER executes a workflow, NEVER decides / approves, and NEVER acts autonomously.
 * The 2.12 automation-governance service is itself a composition of the 9 intelligence tiers; this tier
 * integrates it at the REGISTRY/reachability level via its LIGHT catalog getter (getAutomationGovernanceCatalog
 * — measured COUNT + file checks, no DDL) and integrates the 9 tiers DIRECTLY as cross-intelligence channels
 * — an intentional dual-lens integration, NOT duplication of business logic. The repository + the existing
 * intelligence subsystems remain the single source of truth.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Integrated ≠ Unified. Unified ≠ Operational. Connected ≠ Orchestrated. Composition ≠ Duplication.
 *     Dashboard ≠ Platform. Insight ≠ Decision. Standardized ≠ Enforced. Built ≠ Activated. Present ≠
 *     Populated. Evidence ≠ Confidence. Confidence ≠ Accuracy. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE
 *     axes). Human approval mandatory.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup). ABSENT table → present:false,
 *     count NULL (≠ 0). PRESENT-but-unreadable → count NULL (query error ≠ empty). Empty → 0.
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall". enterprise_readiness
 *     (outcome) is UNMEASURABLE here (Integrated ≠ Operational — no runtime + outcome evidence) → honest-NULL
 *     (DEFERRED), never a fabricated proxy. workflow_health is STRUCTURAL reachability, not runtime throughput.
 *   - owner + lifecycle_state are MANAGED (human) and honest-NULL/preserved; re-discovery NEVER overwrites
 *     them. Interoperability contracts are DESCRIPTIVE standards this tier READS against — NOT enforced.
 *   - STOP clause: NO autonomous decision-making / self-modifying business logic / auto-execution / duplicate
 *     dashboards / Integration V2. Every part is the evidence-grounded surfacing of EXISTING capabilities.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER create
 * schema and NEVER write to existing tables. The lazy ensure-schema runs ONLY on flag-ON write paths
 * (discover / register / audit-capture) so flag OFF → byte-identical incl. schema (0 tables). Every write
 * path also asserts the flag itself BEFORE ensure-schema (defense-in-depth).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isEnterpriseIntelligenceIntegrationEnabled, listFlags } from '../config/feature-flags';

// ── Composed prior MX-800 intelligence-tier summaries (governed intelligence channels — read-only) ──
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';
import { getDecisionSummary } from './decision-intelligence';
import { getPredictiveSummary } from './predictive-intelligence-engine';
import { getRecommendationSummary } from './recommendation-intelligence-engine';
import { getLearningSummary } from './continuous-learning-intelligence-engine';
import { getEnterpriseSummary } from './enterprise-intelligence-platform';
// MX-800 2.12 automation-governance — integrated at the registry/reachability level via its LIGHT catalog
// getter (measured COUNT + file checks, GET-never-writes, no DDL). Its full summary is NOT recomposed here:
// it internally re-runs the 9 tier summaries this tier already composes directly (Composition ≠ Duplication).
import { getAutomationGovernanceCatalog } from './intelligence-automation-governance';
// MX-700 1.41 lifecycle-automation summary (GET-never-writes — no ensure-schema on the read path).
import { getAutomationSummary as getLifecycleAutomationSummary } from './platform-lifecycle-automation';
// Workflow-engine read-only overview (tableExists + SELECT only; advances / executes nothing).
import { buildWorkflowOverview } from './automation/workflow-engine';

const REGISTRY_TABLE = 'enterprise_integration_registry';
const SNAPSHOT_TABLE = 'enterprise_integration_audit_snapshots';

const AXES_NOTE =
  'Integrated ≠ Unified · Unified ≠ Operational · Connected ≠ Orchestrated · Composition ≠ Duplication · ' +
  'Dashboard ≠ Platform · Standardized ≠ Enforced · Built ≠ Activated · Present ≠ Populated · ' +
  'Coverage ⟂ Confidence ⟂ Evidence · null ≠ 0. Human approval mandatory; this tier never decides / ' +
  'executes / invokes a dormant engine — it composes existence + each tier\'s read-only summary only.';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class EnterpriseIntelligenceIntegrationDisabled extends Error {
  code = 'enterprise_intelligence_integration_disabled';
  constructor() {
    super('enterpriseIntelligenceIntegration flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'EnterpriseIntelligenceIntegrationDisabled';
  }
}
function assertEnabled(): void {
  if (!isEnterpriseIntelligenceIntegrationEnabled()) throw new EnterpriseIntelligenceIntegrationDisabled();
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
/** A safe, unquoted Postgres table identifier. REJECTS user-supplied identifiers BEFORE any interpolation —
 *  the curated catalog is always safe, but manual /register passes user input through countTable's
 *  `FROM "${table}"`. A to_regclass probe does NOT sanitise identifier injection, so this regex gate is the
 *  actual injection defence. */
export function isSafeTableIdentifier(s: string): boolean {
  return typeof s === 'string' && s.length > 0 && s.length <= 63 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}
/** Exact MEASURED row count for a SAFE table identifier. ABSENT table → null (count unmeasured — null ≠ 0).
 *  PRESENT table → exact COUNT(*) (NEVER n_live_tup), or null on error. */
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
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation and every part-getter
 * compose the SAME expensive measurement (per-service COUNT(*) + the composed read-only summaries).
 * Memoization dedupes within a request window. TTL defaults to 8s (production unchanged); EII_MEMO_TTL_MS
 * only overrides it for the offline validation harness, which exercises ~10 composing getters back-to-back
 * and would otherwise recompute each from cold.
 */
const MEMO_TTL_MS = Math.min(Math.max(Number(process.env.EII_MEMO_TTL_MS) || 8000, 0), 3_600_000);
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; });
  _memo.set(key, { at: Date.now(), val });
  return val;
}

// ── Curated, file/table-verified ENTERPRISE INTEGRATION SERVICE catalog ──────
// Every `table` below is a REAL table NAME (verified in a migration); it may be ABSENT in this database →
// honest table_present:false, count NULL (≠ 0). Every `engine` file was verified to EXIST on disk. A service
// is an EXISTING intelligence/enterprise/platform/automation/reporting domain the platform already has — this
// tier never creates one and never runs one. `engine` is the source file whose EXISTENCE is read (never
// imported for invocation). `flag` is the governing feature flag whose STATE is read (Built ≠ Activated).
// `summary_key` selects which read-only summary getter this tier composes (null = honest non-getter,
// registered by existence only). `intelligence_uid` SOFT-links the MX-800 2.1 registry; `lifecycle_uid`
// SOFT-links the MX-700 1.37 lifecycle catalog (no FK; honest-null when no clear canonical mapping).
type ServiceKind = 'intelligence' | 'enterprise' | 'platform' | 'automation' | 'reporting';
type SummaryKey =
  | 'platform' | 'engineering' | 'runtime' | 'knowledge' | 'decision' | 'predictive'
  | 'recommendation' | 'learning' | 'enterprise' | 'automationGovernance' | 'lifecycleAutomation' | 'workflow';
type IntegrationSource = {
  uid: string; name: string; domain: string; service_kind: ServiceKind;
  table: string | null; engine: string | null; flag: string | null;
  summary_key: SummaryKey | null; intelligence_uid: string | null; lifecycle_uid: string | null;
  tier: string | null; description: string;
};
const INTEGRATION_SERVICES: IntegrationSource[] = [
  // ── Cross-intelligence channels (MX-800 governed intelligence tiers) ──
  {
    uid: 'eii-svc-platform-intelligence', name: 'Platform Intelligence', domain: 'repository',
    service_kind: 'intelligence', table: 'platform_intelligence_audit_snapshots',
    engine: 'services/platform-intelligence-registry.ts', flag: 'platformIntelligenceRegistry',
    summary_key: 'platform', intelligence_uid: 'intel.repository', lifecycle_uid: null, tier: 'MX-800 2.1',
    description: 'MX-800 2.1 Platform Intelligence registry — a governed intelligence channel. Read-only summary composed + audit trail read COUNT-only; engine never invoked. Integrated ≠ Unified.',
  },
  {
    uid: 'eii-svc-engineering-intelligence', name: 'Engineering Intelligence', domain: 'repository',
    service_kind: 'intelligence', table: 'engineering_intelligence_audit_snapshots',
    engine: 'services/engineering-intelligence.ts', flag: 'engineeringIntelligence',
    summary_key: 'engineering', intelligence_uid: 'intel.repository', lifecycle_uid: null, tier: 'MX-800 2.3',
    description: 'MX-800 2.3 Engineering Intelligence — a governed intelligence channel. Read-only summary composed + audit trail read COUNT-only; engine never invoked.',
  },
  {
    uid: 'eii-svc-runtime-intelligence', name: 'Runtime Intelligence', domain: 'runtime',
    service_kind: 'intelligence', table: 'runtime_intelligence_audit_snapshots',
    engine: 'services/runtime-intelligence.ts', flag: 'runtimeIntelligenceEngine',
    summary_key: 'runtime', intelligence_uid: null, lifecycle_uid: null, tier: 'MX-800 2.4',
    description: 'MX-800 2.4 Runtime Intelligence — a governed intelligence channel. Read-only summary composed + audit trail read COUNT-only; engine never invoked.',
  },
  {
    uid: 'eii-svc-knowledge-intelligence', name: 'Knowledge Intelligence', domain: 'knowledge',
    service_kind: 'intelligence', table: 'knowledge_intelligence_audit_snapshots',
    engine: 'services/knowledge-intelligence.ts', flag: 'knowledgeIntelligenceEngine',
    summary_key: 'knowledge', intelligence_uid: null, lifecycle_uid: null, tier: 'MX-800 2.5',
    description: 'MX-800 2.5 Knowledge Intelligence — a governed intelligence channel. Read-only summary composed + audit trail read COUNT-only; engine never invoked.',
  },
  {
    uid: 'eii-svc-decision-intelligence', name: 'Decision Intelligence', domain: 'decision',
    service_kind: 'intelligence', table: 'decision_intelligence_audit_snapshots',
    engine: 'services/decision-intelligence.ts', flag: 'decisionIntelligenceEngine',
    summary_key: 'decision', intelligence_uid: 'intel.decision', lifecycle_uid: null, tier: 'MX-800 2.6',
    description: 'MX-800 2.6 Decision Intelligence — a governed intelligence channel. Read-only summary composed; Insight ≠ Decision; engine never invoked.',
  },
  {
    uid: 'eii-svc-predictive-intelligence', name: 'Predictive Intelligence', domain: 'predictive',
    service_kind: 'intelligence', table: 'predictive_intelligence_audit_snapshots',
    engine: 'services/predictive-intelligence-engine.ts', flag: 'predictiveIntelligenceEngine',
    summary_key: 'predictive', intelligence_uid: null, lifecycle_uid: null, tier: 'MX-800 2.7',
    description: 'MX-800 2.7 Predictive Intelligence — a governed intelligence channel. Read-only summary composed; Correlation ≠ Causation; engine never invoked.',
  },
  {
    uid: 'eii-svc-recommendation-intelligence', name: 'Recommendation Intelligence', domain: 'recommendation',
    service_kind: 'intelligence', table: 'recommendation_intelligence_audit_snapshots',
    engine: 'services/recommendation-intelligence-engine.ts', flag: 'recommendationIntelligenceEngine',
    summary_key: 'recommendation', intelligence_uid: null, lifecycle_uid: null, tier: 'MX-800 2.8',
    description: 'MX-800 2.8 Recommendation Intelligence — a governed intelligence channel. Read-only summary composed; Recommendation ≠ Approval; engine never invoked.',
  },
  {
    uid: 'eii-svc-learning-intelligence', name: 'Continuous Learning Intelligence', domain: 'learning',
    service_kind: 'intelligence', table: 'continuous_learning_intelligence_audit_snapshots',
    engine: 'services/continuous-learning-intelligence-engine.ts', flag: 'continuousLearningIntelligenceEngine',
    summary_key: 'learning', intelligence_uid: 'intel.learning', lifecycle_uid: null, tier: 'MX-800 2.9',
    description: 'MX-800 2.9 Continuous Learning Intelligence — a governed intelligence channel. Read-only summary composed; Learning ≠ Automation; engine never invoked.',
  },
  {
    uid: 'eii-svc-enterprise-intelligence', name: 'Enterprise Intelligence Platform', domain: 'enterprise',
    service_kind: 'intelligence', table: 'enterprise_intelligence_audit_snapshots',
    engine: 'services/enterprise-intelligence-platform.ts', flag: 'enterpriseIntelligencePlatform',
    summary_key: 'enterprise', intelligence_uid: 'intel.enterprise', lifecycle_uid: null, tier: 'MX-800 2.10',
    description: 'MX-800 2.10 Enterprise Intelligence Platform — a governed intelligence channel. Read-only summary composed + audit trail read COUNT-only; engine never invoked.',
  },
  // ── Enterprise governance/automation orchestration service (MX-800 2.12 — integrated at registry level) ──
  {
    uid: 'eii-svc-automation-governance', name: 'Intelligence Automation & Governance', domain: 'governance',
    service_kind: 'enterprise', table: 'automation_governance_audit_snapshots',
    engine: 'services/intelligence-automation-governance.ts', flag: 'intelligenceAutomationGovernance',
    summary_key: 'automationGovernance', intelligence_uid: null, lifecycle_uid: null, tier: 'MX-800 2.12',
    description: 'MX-800 2.12 Automation & Governance Orchestration — integrated at the REGISTRY/reachability level via its LIGHT catalog getter (no DDL). Its full summary recomposes the 9 tiers this tier already composes directly → not recomposed (Composition ≠ Duplication).',
  },
  // ── Platform tiers (MX-700) ──
  {
    uid: 'eii-svc-lifecycle-automation', name: 'Platform Lifecycle Automation', domain: 'automation',
    service_kind: 'automation', table: 'platform_governance_audit_snapshots',
    engine: 'services/platform-lifecycle-automation.ts', flag: 'platformLifecycleAutomation',
    summary_key: 'lifecycleAutomation', intelligence_uid: null, lifecycle_uid: null, tier: 'MX-700 1.41',
    description: 'MX-700 1.41 lifecycle-automation engine. Read-only summary composed; continuous governance / quality-gates surfaced — engine never invoked beyond its GET-never-writes readers. Automation ≠ Autonomy.',
  },
  {
    uid: 'eii-svc-lifecycle-foundation', name: 'Platform Lifecycle Foundation', domain: 'lifecycle',
    service_kind: 'platform', table: 'platform_lifecycle_catalog',
    engine: 'routes/platform-lifecycle.ts', flag: 'platformLifecycleFoundation',
    summary_key: null, intelligence_uid: null, lifecycle_uid: null, tier: 'MX-700 1.37',
    description: 'MX-700 1.37 Lifecycle Foundation registry (capability catalog). Registered by table + route EXISTENCE only — it exposes no single summary getter (honest non-getter, not a failure). Built ≠ Activated.',
  },
  {
    uid: 'eii-svc-operations-center', name: 'Platform Intelligence Operations Center', domain: 'operations',
    service_kind: 'platform', table: null,
    engine: 'routes/platform-intelligence-operations.ts', flag: 'platformIntelligenceOperations',
    summary_key: null, intelligence_uid: null, lifecycle_uid: null, tier: 'MX-800 2.11',
    description: 'MX-800 2.11 Operations Center — a FRONTEND-exposure phase composing prior tiers client-side. Registered by route EXISTENCE only; no backend summary getter by design (honest non-getter). Dashboard ≠ Platform.',
  },
  // ── Reporting service (existing) ──
  {
    uid: 'eii-svc-report-factory', name: 'Report Factory', domain: 'reporting',
    service_kind: 'reporting', table: null,
    engine: 'services/report-factory-schema.ts', flag: 'reportFactory',
    summary_key: null, intelligence_uid: null, lifecycle_uid: null, tier: null,
    description: 'Existing report-factory reporting service. Engine EXISTENCE read-only; no read-only summary getter composed (registered by existence). Report ≠ Decision.',
  },
];

/** Measure every service ONCE: table present + exact COUNT(*); engine file present; governing flag STATE
 *  (Built ≠ Activated). Memoized per request window. */
type MeasuredService = IntegrationSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureServices(pool: Pool): Promise<MeasuredService[]> {
  return memo('eii:services', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(INTEGRATION_SERVICES.map(async (s) => {
      const table_present = s.table ? await tableReady(pool, s.table) : false;
      const table_count = table_present && s.table ? await countTable(pool, s.table) : null; // absent → null (≠ 0)
      const engine_present = s.engine ? fileCheck(s.engine) : false;
      const present = table_present || engine_present;        // substrate exists (table OR engine)
      const flag_state = s.flag ? (s.flag in flags ? !!flags[s.flag] : null) : null; // null = unverified gate (honest)
      return { ...s, table_present, table_count, engine_present, present, flag_state };
    }));
  });
}

/** Each summary getter is wrapped so one failing reader degrades to { reachable:false } instead of throwing —
 *  Connected ≠ Orchestrated, and an unreachable channel is honest, never fabricated. */
type ComposedChannel = { reachable: boolean; note?: string };
async function safeChannel(label: string, fn: () => Promise<any>): Promise<ComposedChannel> {
  try { await fn(); return { reachable: true }; }
  catch (e: any) { return { reachable: false, note: `${label} unreachable: ${e?.message ?? 'error'}` }; }
}

const SUMMARY_GETTERS: Record<SummaryKey, (pool: Pool) => Promise<any>> = {
  platform: (p) => getPlatformSummary(p),
  engineering: (p) => getEngineeringSummary(p),
  runtime: (p) => getRuntimeSummary(p),
  knowledge: (p) => getKnowledgeSummary(p),
  decision: (p) => getDecisionSummary(p),
  predictive: (p) => getPredictiveSummary(p),
  recommendation: (p) => getRecommendationSummary(p),
  learning: (p) => getLearningSummary(p),
  enterprise: (p) => getEnterpriseSummary(p),
  // 2.12 integrated via its LIGHT catalog getter (no DDL, no 9-tier recompute — Composition ≠ Duplication).
  automationGovernance: (p) => getAutomationGovernanceCatalog(p),
  lifecycleAutomation: (p) => getLifecycleAutomationSummary(p),
  // Workflow engine read-only overview (auxiliary substrate signal for workflow_health).
  workflow: (p) => buildWorkflowOverview(p),
};

/** Compose every read-only summary getter ONCE (gather-once), concurrently, each wrapped by safeChannel.
 *  Returns per-service reachability keyed by summary_key + the auxiliary workflow channel. This is the SINGLE
 *  expensive composition pass that Parts 2/3/5/8/summary all reuse. */
type ServiceComposition = {
  reachability: Record<string, ComposedChannel>;     // keyed by summary_key
  reachable: number; of: number;                      // over services WITH a summary_key
  workflow: ComposedChannel;                          // auxiliary (not a registry service-count member)
  workflowOverview: any | null;
};
function composeServices(pool: Pool): Promise<ServiceComposition> {
  return memo('eii:composition', async () => {
    const keyed = INTEGRATION_SERVICES.filter((s) => s.summary_key && s.summary_key !== 'workflow') as (IntegrationSource & { summary_key: SummaryKey })[];
    const results = await Promise.all(keyed.map(async (s) => {
      const ch = await safeChannel(s.summary_key, () => SUMMARY_GETTERS[s.summary_key](pool));
      return [s.summary_key, ch] as const;
    }));
    const reachability: Record<string, ComposedChannel> = {};
    for (const [k, ch] of results) reachability[k] = ch;
    // Auxiliary workflow channel composed separately (workflow_health) — NOT counted as a registry service.
    let workflowOverview: any | null = null;
    const workflow = await (async (): Promise<ComposedChannel> => {
      try { workflowOverview = await buildWorkflowOverview(pool); return { reachable: true }; }
      catch (e: any) { return { reachable: false, note: `workflow unreachable: ${e?.message ?? 'error'}` }; }
    })();
    const of = keyed.length;
    const reachable = Object.values(reachability).filter((c) => c.reachable).length;
    return { reachability, reachable, of, workflow, workflowOverview };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Enterprise Integration Registry (catalog of EXISTING integrated services)
// ════════════════════════════════════════════════════════════════════════════
export async function getIntegrationCatalog(pool: Pool) {
  return memo('eii:catalog', async () => {
    const measured = await measureServices(pool);
    const by_domain_map: Record<string, { domain: string; services: number; present: number }> = {};
    const by_kind: Record<string, number> = {};
    let table_backed = 0, engine_backed = 0, present = 0, integration_records = 0, getter_backed = 0;
    for (const m of measured) {
      by_kind[m.service_kind] = (by_kind[m.service_kind] ?? 0) + 1;
      const d = (by_domain_map[m.domain] ??= { domain: m.domain, services: 0, present: 0 });
      d.services++;
      if (m.present) { d.present++; present++; }
      if (m.table) table_backed++;
      if (m.engine) engine_backed++;
      if (m.summary_key) getter_backed++;
      if ((m.table_count ?? 0) > 0) integration_records += m.table_count ?? 0;
    }
    return {
      phase: 'MX-800 Phase 2.13 — Enterprise Integration Registry',
      catalog_kind:
        'A curated, file/table-verified registry of the EXISTING MX-800 intelligence/enterprise tiers + ' +
        'MX-700 platform tiers + workflow / report services. Engine files are read for EXISTENCE only; ' +
        'persisted trails are read COUNT-only; read-only summaries are composed (never the engine itself). ' +
        'This tier registers + integrates them — it never creates, runs, or activates one (Built ≠ Activated; ' +
        'Integrated ≠ Unified).',
      totals: { services: measured.length, present, table_backed, engine_backed, getter_backed, integration_records },
      by_kind,
      by_domain: Object.values(by_domain_map).sort((a, b) => a.domain.localeCompare(b.domain)),
      services: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, service_kind: m.service_kind,
        physical_table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine_path: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, summary_key: m.summary_key,
        tier: m.tier, intelligence_uid: m.intelligence_uid, lifecycle_uid: m.lifecycle_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Cross-Intelligence Integration (the 9 governed intelligence channels)
// ════════════════════════════════════════════════════════════════════════════
export async function getCrossIntelligenceIntegration(pool: Pool) {
  return memo('eii:cross-intelligence', async () => {
    const measured = await measureServices(pool);
    const comp = await composeServices(pool);
    const intel = measured.filter((m) => m.service_kind === 'intelligence');
    const channels = intel.map((m) => ({
      uid: m.uid, name: m.name, domain: m.domain, tier: m.tier,
      summary_key: m.summary_key,
      reachable: m.summary_key ? (comp.reachability[m.summary_key]?.reachable ?? false) : false,
      note: m.summary_key ? comp.reachability[m.summary_key]?.note : 'no summary getter',
      flag_state: m.flag_state,
    }));
    const reachable = channels.filter((c) => c.reachable).length;
    return {
      phase: 'MX-800 Phase 2.13 — Cross-Intelligence Integration',
      integration_kind:
        'Read-only integration of the 9 governed intelligence channels (2.1 / 2.3–2.10). Each channel\'s ' +
        'canonical read-only summary is composed for reachability — the engine is NEVER invoked, no cross- ' +
        'channel inference is computed, nothing is decided. Connected ≠ Orchestrated; Insight ≠ Decision.',
      integration_safety: { invokes_engine: false, cross_infers: false, decides: false, autonomous: false },
      channels,
      reachability: { reachable, of: channels.length },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Enterprise Service Composition (all integrated services grouped by kind)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseServiceComposition(pool: Pool) {
  return memo('eii:service-composition', async () => {
    const measured = await measureServices(pool);
    const comp = await composeServices(pool);
    const groups: Record<string, { service_kind: string; services: any[]; reachable: number; of_getters: number }> = {};
    for (const m of measured) {
      const g = (groups[m.service_kind] ??= { service_kind: m.service_kind, services: [], reachable: 0, of_getters: 0 });
      const reachable = m.summary_key ? (comp.reachability[m.summary_key]?.reachable ?? false) : null;
      if (m.summary_key) { g.of_getters++; if (reachable) g.reachable++; }
      g.services.push({ uid: m.uid, name: m.name, tier: m.tier, present: m.present, summary_key: m.summary_key, reachable });
    }
    return {
      phase: 'MX-800 Phase 2.13 — Enterprise Service Composition',
      composition_kind:
        'Read-only composition of ALL integrated services grouped by kind (intelligence / enterprise / ' +
        'platform / automation / reporting). Each service exposing a read-only summary getter is composed ' +
        'for reachability; non-getter services are surfaced honestly (reachable:null, registered by ' +
        'existence). Composition ≠ Duplication; this tier composes — it never re-implements a service.',
      composition_safety: { reimplements: false, duplicates: false, decides: false, autonomous: false },
      groups: Object.values(groups).sort((a, b) => a.service_kind.localeCompare(b.service_kind)),
      totals: { services: measured.length, getter_backed: comp.of, getters_reachable: comp.reachable },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Platform Interoperability (DESCRIPTIVE contract conformance — never enforced)
// ════════════════════════════════════════════════════════════════════════════
export async function getPlatformInteroperability(pool: Pool) {
  return memo('eii:interoperability', async () => {
    const measured = await measureServices(pool);
    const total = measured.length;
    const flagged = measured.filter((m) => m.flag != null).length;
    const getterBacked = measured.filter((m) => m.summary_key).length;
    const tableBacked = measured.filter((m) => m.table).length;
    const softLinked = measured.filter((m) => m.intelligence_uid != null || m.lifecycle_uid != null).length;
    return {
      phase: 'MX-800 Phase 2.13 — Platform Interoperability',
      interoperability_kind:
        'DESCRIPTIVE contract conformance the integration READS the services against. These are STANDARDS, ' +
        'NOT runtime-enforced gates — this tier verifies that each service conforms to the platform\'s ' +
        'integration conventions, it does NOT enforce them. Standardized ≠ Enforced; Connected ≠ Orchestrated.',
      interoperability_safety: { enforces: false, mutates_contract: false, autonomous: false },
      contracts: [
        { contract: 'feature_flag_contract', conforming: flagged, of: total, basis: 'service exposes a governing feature flag (gated /enabled + /feature-flag pattern)', measured: true },
        { contract: 'read_summary_contract', conforming: getterBacked, of: total, basis: 'service exposes a read-only summary getter composed by this tier', measured: true },
        { contract: 'audit_trail_contract', conforming: tableBacked, of: total, basis: 'service persists an audit/registry trail (table-backed)', measured: true },
        { contract: 'registry_linkage_contract', conforming: softLinked, of: total, basis: 'service soft-links the 2.1 intelligence and/or 1.37 lifecycle registry', measured: true },
      ],
      contract_note: 'Conformance is MEASURED over the curated registry; it is a structural conformance count, NOT proof the contract is enforced at runtime.',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Enterprise Coordination (METADATA-level routing — never executes)
// ════════════════════════════════════════════════════════════════════════════
export async function getEnterpriseCoordination(pool: Pool) {
  return memo('eii:coordination', async () => {
    const measured = await measureServices(pool);
    const comp = await composeServices(pool);
    const routes = measured.map((m) => ({
      concern_domain: m.domain, service: m.name, uid: m.uid, service_kind: m.service_kind, tier: m.tier,
      reachable: m.summary_key ? (comp.reachability[m.summary_key]?.reachable ?? false) : null,
    }));
    return {
      phase: 'MX-800 Phase 2.13 — Enterprise Coordination',
      coordination_kind:
        'METADATA-LEVEL coordination of which EXISTING service answers which enterprise concern domain. It ' +
        'NEVER executes a service, NEVER decides, NEVER approves — it surfaces the routing map only. ' +
        'Connected ≠ Orchestrated; Orchestration ≠ Decision.',
      coordination_safety: { executes: false, decides: false, approves: false, autonomous: false },
      coordination_routes: routes,
      by_kind: Object.entries(routes.reduce((acc: Record<string, number>, r) => { acc[r.service_kind] = (acc[r.service_kind] ?? 0) + 1; return acc; }, {})).map(([service_kind, services]) => ({ service_kind, services })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Enterprise Explainability — why/evidence/deps for ONE service (unknown → found:false)
// ════════════════════════════════════════════════════════════════════════════
export async function explainIntegration(pool: Pool, uidArg: string) {
  const measured = await measureServices(pool);
  const m = measured.find((x) => x.uid === uidArg);
  if (!m) return { found: false, uid: uidArg, note: 'Unknown service uid. null ≠ 0; not fabricated.' };
  const comp = await composeServices(pool);
  const reachable = m.summary_key ? (comp.reachability[m.summary_key]?.reachable ?? false) : null;
  const alternatives = measured.filter((x) => x.service_kind === m.service_kind && x.uid !== m.uid).map((x) => ({ uid: x.uid, name: x.name }));
  return {
    found: true,
    service: { uid: m.uid, name: m.name, domain: m.domain, service_kind: m.service_kind, tier: m.tier },
    why: m.description,
    evidence: {
      engine_path: m.engine, engine_present: m.engine_present,
      physical_table: m.table, table_present: m.table_present, table_count: m.table_count,
      summary_key: m.summary_key, summary_reachable: reachable,
    },
    dependencies: { intelligence_uid: m.intelligence_uid, lifecycle_uid: m.lifecycle_uid, note: 'SOFT registry links (no FK); honest-null when no clear canonical mapping.' },
    confidence: { axis: 'structural', value: null, note: 'Explainability confidence is STRUCTURAL only (existence + reachability). Runtime/outcome confidence is honest-null — Evidence ≠ Confidence; Integrated ≠ Operational.' },
    state: { present: m.present, governing_flag: m.flag, flag_state: m.flag_state, note: 'flag_state is the governing flag STATE — Built ≠ Activated; null when no/unverified flag.' },
    composition_note: 'This service is READ for existence + a composed read-only summary only. It is never invoked, never executed, never activated by this tier.',
    alternatives,
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Integration Validation (STRUCTURAL only — existence + population + reachability)
// ════════════════════════════════════════════════════════════════════════════
export async function getIntegrationValidation(pool: Pool) {
  return memo('eii:validation', async () => {
    const measured = await measureServices(pool);
    const comp = await composeServices(pool);
    const enginesDeclared = measured.filter((m) => m.engine).length;
    const enginesPresent = measured.filter((m) => m.engine_present).length;
    const intel = measured.filter((m) => m.service_kind === 'intelligence');
    const intelReachable = intel.filter((m) => m.summary_key && comp.reachability[m.summary_key]?.reachable).length;
    const tableBacked = measured.filter((m) => m.table);
    const populated = tableBacked.filter((m) => (m.table_count ?? 0) > 0);
    const checks = [
      { check: 'registry_catalog_non_empty', status: measured.length > 0 ? 'pass' : 'fail', detail: `${measured.length} curated services` },
      { check: 'engines_present', status: enginesPresent === enginesDeclared ? 'pass' : 'partial', detail: `${enginesPresent}/${enginesDeclared} engine files present` },
      { check: 'integration_services_reachable', status: comp.reachable > 0 ? 'pass' : 'fail', detail: `${comp.reachable}/${comp.of} composed summary getters reachable` },
      { check: 'cross_intelligence_reachable', status: intelReachable > 0 ? 'pass' : 'fail', detail: `${intelReachable}/${intel.length} intelligence channels reachable` },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.13 — Integration Validation',
      validation_kind:
        'STRUCTURAL only (existence + population + reachability + self-consistency). NOT a runtime / unified / ' +
        'operational / outcome verdict. Integrated ≠ Unified; Unified ≠ Operational. enterprise_readiness is ' +
        'deliberately WITHHELD (outcome null) — there is no runtime + outcome evidence to certify operation.',
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
  return memo('eii:metrics', async () => {
    const measured = await measureServices(pool);
    const comp = await composeServices(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const tableBacked = measured.filter((m) => m.table);
    const populatedTrails = tableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    const intel = measured.filter((m) => m.service_kind === 'intelligence');
    const intelReachable = intel.filter((m) => m.summary_key && comp.reachability[m.summary_key]?.reachable).length;
    // workflow_health: STRUCTURAL reachability of the workflow substrate (NOT runtime throughput).
    const wf = comp.workflowOverview;
    const workflow_health = comp.workflow.reachable ? (wf?.degraded ? 50 : 100) : null;
    return {
      phase: 'MX-800 Phase 2.13 — Enterprise Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'platform_integration_health', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Integrated services whose code/table substrate is present. Present ≠ Populated.' },
        { metric: 'enterprise_service_health', axis: 'confidence', score: pct(comp.reachable, comp.of), basis: { reachable: comp.reachable, of: comp.of }, note: 'Composed read-only summary getters reachable. Connected ≠ Orchestrated; Confidence ≠ Accuracy.' },
        { metric: 'api_health', axis: 'coverage', score: pct(populatedTrails, tableBacked.length), basis: { measured: populatedTrails, of: tableBacked.length }, note: 'Persisted integration/audit trails that are populated. Coverage ⟂ Confidence. Mostly null/low in dev (flags OFF) — honest, not a defect.' },
        { metric: 'workflow_health', axis: 'confidence', score: workflow_health, basis: { reachable: comp.workflow.reachable, degraded: wf?.degraded ?? null }, note: 'STRUCTURAL reachability of the workflow substrate (buildWorkflowOverview) — NOT runtime throughput. null when unreachable (null ≠ 0).' },
        { metric: 'intelligence_integration_coverage', axis: 'coverage', score: pct(intelReachable, intel.length), basis: { measured: intelReachable, of: intel.length }, note: 'Governed intelligence channels whose summary is reachable. Coverage ⟂ Confidence.' },
        { metric: 'enterprise_readiness', axis: 'outcome', score: null, basis: { measurable: false }, note: 'Enterprise OPERATIONAL readiness requires runtime + outcome evidence (whether the integrated platform actually operates as one) which is absent → honest-null (DEFERRED). Integrated ≠ Unified; Unified ≠ Operational.' },
      ],
      population: { services: total, present, table_backed: tableBacked.length, populated_trails: populatedTrails, getters_reachable: comp.reachable, of_getters: comp.of, intel_reachable: intelReachable, of_intel: intel.length },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Summary — composes all parts (gather-once)
// ════════════════════════════════════════════════════════════════════════════
export async function getIntegrationSummary(pool: Pool) {
  const [catalog, cross, composition, interop, coordination, validation, metrics] = await Promise.all([
    getIntegrationCatalog(pool), getCrossIntelligenceIntegration(pool), getEnterpriseServiceComposition(pool),
    getPlatformInteroperability(pool), getEnterpriseCoordination(pool), getIntegrationValidation(pool),
    getEnterpriseMetrics(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.13 — Enterprise Intelligence Integration Platform',
    summary_kind:
      'A READ-ONLY composition of the EXISTING MX-800 + MX-700 intelligence/enterprise/platform services into ' +
      'ONE integration view. It registers + composes — it never creates, runs, unifies-at-runtime, or ' +
      'activates a service. Integrated ≠ Unified; Unified ≠ Operational; human approval mandatory.',
    totals: catalog.totals,
    cross_intelligence: cross.reachability,
    service_composition: composition.totals,
    interoperability: { contracts: interop.contracts.length },
    coordination: { routes: coordination.coordination_routes.length },
    validation: { verdict: validation.verdict, populated_trails: validation.populated_trails },
    metrics: metrics.scores,
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Registry persistence + audit (the ONLY write paths — lazy ensure-schema inside)
// ════════════════════════════════════════════════════════════════════════════
async function ensureSchema(pool: Pool): Promise<void> {
  assertEnabled(); // defense-in-depth: never create schema when the flag is OFF
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id               SERIAL PRIMARY KEY,
      integration_uid  TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      service_kind     TEXT NOT NULL,
      domain           TEXT,
      physical_table   TEXT,
      engine_path      TEXT,
      governing_flag   TEXT,
      summary_key      TEXT,
      tier             TEXT,
      intelligence_uid TEXT,
      lifecycle_uid    TEXT,
      present          BOOLEAN,
      table_count      INTEGER,
      flag_state       BOOLEAN,
      lifecycle_state  TEXT NOT NULL DEFAULT 'registered',
      owner            TEXT,
      metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
      source           TEXT NOT NULL DEFAULT 'curated',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_eii_registry_kind   ON ${REGISTRY_TABLE} (service_kind)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_eii_registry_domain ON ${REGISTRY_TABLE} (domain)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_eii_registry_tier   ON ${REGISTRY_TABLE} (tier)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                                    SERIAL PRIMARY KEY,
      snapshot_uid                          TEXT NOT NULL UNIQUE,
      registry_total                        INTEGER,
      services_present                      INTEGER,
      integration_records                   INTEGER,
      services_reachable                    INTEGER,
      platform_integration_health_pct       NUMERIC,
      enterprise_service_health_pct         NUMERIC,
      api_health_pct                        NUMERIC,
      workflow_health_pct                   NUMERIC,
      intelligence_integration_coverage_pct NUMERIC,
      enterprise_readiness_pct              NUMERIC,
      metrics                               JSONB,
      validation                            JSONB,
      summary                               JSONB,
      captured_by                           TEXT,
      captured_at                           TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_eii_snapshots_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC)`);
}

/** POST /discover — populate/refresh the registry from the curated catalog. lifecycle_state + owner are
 *  MANAGED (human) and PRESERVED across re-discovery; present/table_count/flag_state are DERIVED and
 *  refreshed. */
export async function discoverIntegration(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureSchema(pool);
  const measured = await measureServices(pool);
  let inserted = 0, updated = 0;
  for (const m of measured) {
    const r = await pool.query(
      `INSERT INTO ${REGISTRY_TABLE}
         (integration_uid, name, service_kind, domain, physical_table, engine_path, governing_flag,
          summary_key, tier, intelligence_uid, lifecycle_uid, present, table_count, flag_state, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'discovered')
       ON CONFLICT (integration_uid) DO UPDATE SET
         name=EXCLUDED.name, service_kind=EXCLUDED.service_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, summary_key=EXCLUDED.summary_key, tier=EXCLUDED.tier,
         intelligence_uid=EXCLUDED.intelligence_uid, lifecycle_uid=EXCLUDED.lifecycle_uid,
         present=EXCLUDED.present, table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         updated_at=now()
       RETURNING (xmax = 0) AS inserted`,
      [m.uid, m.name, m.service_kind, m.domain, m.table, m.engine, m.flag, m.summary_key, m.tier,
       m.intelligence_uid, m.lifecycle_uid, m.present, m.table_count, m.flag_state],
    );
    if (r.rows[0]?.inserted) inserted++; else updated++;
  }
  return {
    ok: true, discovered: measured.length, inserted, updated, actor,
    note: 'lifecycle_state + owner are MANAGED (human) and preserved across re-discovery; present/table_count/flag_state are DERIVED and refreshed. Integrated ≠ Unified.',
    axes_note: AXES_NOTE,
  };
}

/** POST /register — manually register a NON-catalog service (source='manual'). Identifier is gated before
 *  any interpolation (isSafeTableIdentifier). owner/lifecycle_state MANAGED. */
export async function registerIntegrationService(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureSchema(pool);
  const integration_uid = String(body?.integration_uid ?? body?.uid ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const service_kind = String(body?.service_kind ?? '').trim();
  if (!integration_uid || !name || !service_kind) {
    return { ok: false, error: 'integration_uid, name and service_kind are required.' };
  }
  const physical_table = body?.physical_table ? String(body.physical_table).trim() : null;
  if (physical_table && !isSafeTableIdentifier(physical_table)) {
    return { ok: false, error: 'physical_table is not a safe Postgres identifier.' };
  }
  const table_count = physical_table ? await countTable(pool, physical_table) : null;
  const present = !!(physical_table && table_count != null) || !!body?.engine_path;
  const r = await pool.query(
    `INSERT INTO ${REGISTRY_TABLE}
       (integration_uid, name, service_kind, domain, physical_table, engine_path, governing_flag,
        summary_key, tier, intelligence_uid, lifecycle_uid, present, table_count, owner, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual')
     ON CONFLICT (integration_uid) DO UPDATE SET
       name=EXCLUDED.name, service_kind=EXCLUDED.service_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, summary_key=EXCLUDED.summary_key, tier=EXCLUDED.tier,
       intelligence_uid=EXCLUDED.intelligence_uid, lifecycle_uid=EXCLUDED.lifecycle_uid,
       present=EXCLUDED.present, table_count=EXCLUDED.table_count, metadata=EXCLUDED.metadata, updated_at=now()
     RETURNING *`,
    [integration_uid, name, service_kind, body?.domain ?? null, physical_table, body?.engine_path ?? null,
     body?.governing_flag ?? null, body?.summary_key ?? null, body?.tier ?? null,
     body?.intelligence_uid ?? null, body?.lifecycle_uid ?? null, present, table_count,
     body?.owner ?? null, body?.metadata ?? {}],
  );
  return { ok: true, service: r.rows[0], actor, axes_note: AXES_NOTE };
}

/** GET /registry — persisted registry rows (null when the table is absent → not yet discovered). */
export async function getRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { present: false, registry: null, note: 'Registry table absent — run POST /discover to populate (flag-ON). null ≠ 0.' };
  }
  const r = await pool.query(`SELECT * FROM ${REGISTRY_TABLE} ORDER BY service_kind, name`);
  return { present: true, count: r.rowCount, registry: r.rows, axes_note: AXES_NOTE };
}

/** GET /registry/:uid — one persisted registry row (found:false when absent). */
export async function getRegistryEntry(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry table absent — run POST /discover.' };
  const r = await pool.query(`SELECT * FROM ${REGISTRY_TABLE} WHERE integration_uid=$1`, [uidArg]);
  if (!r.rows[0]) return { found: false, uid: uidArg, note: 'Unknown integration_uid in the persisted registry.' };
  return { found: true, service: r.rows[0], axes_note: AXES_NOTE };
}

/** POST /audit/capture — append-only point-in-time integration metrics snapshot (drift source). */
export async function captureIntegrationSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureSchema(pool);
  const [catalog, metrics, validation, summary] = await Promise.all([
    getIntegrationCatalog(pool), getEnterpriseMetrics(pool), getIntegrationValidation(pool), getIntegrationSummary(pool),
  ]);
  const scoreOf = (k: string) => metrics.scores.find((s: any) => s.metric === k)?.score ?? null;
  const comp = await composeServices(pool);
  const snapshot_uid = uid('eii-snap');
  const r = await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, registry_total, services_present, integration_records, services_reachable,
        platform_integration_health_pct, enterprise_service_health_pct, api_health_pct, workflow_health_pct,
        intelligence_integration_coverage_pct, enterprise_readiness_pct, metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING snapshot_uid, captured_at`,
    [snapshot_uid, catalog.totals.services, catalog.totals.present, catalog.totals.integration_records, comp.reachable,
     scoreOf('platform_integration_health'), scoreOf('enterprise_service_health'), scoreOf('api_health'),
     scoreOf('workflow_health'), scoreOf('intelligence_integration_coverage'), scoreOf('enterprise_readiness'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot: r.rows[0], actor, axes_note: AXES_NOTE };
}

/** GET /audit/snapshots — recent snapshots (null when the table is absent). */
export async function getIntegrationSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) {
    return { present: false, snapshots: null, note: 'Snapshot table absent — run POST /audit/capture (flag-ON). null ≠ 0.' };
  }
  const limit = Number.isFinite(opts.limit as number) && (opts.limit as number) > 0 ? Math.min(opts.limit as number, 200) : 50;
  const r = await pool.query(`SELECT * FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT $1`, [limit]);
  return { present: true, count: r.rowCount, snapshots: r.rows, axes_note: AXES_NOTE };
}

/** GET /audit/drift — delta between the two most-recent snapshots (per-metric; null when <2 snapshots). */
export async function getIntegrationDrift(pool: Pool) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) {
    return { present: false, drift: null, note: 'Snapshot table absent — run POST /audit/capture twice (flag-ON). null ≠ 0.' };
  }
  const r = await pool.query(
    `SELECT snapshot_uid, captured_at, platform_integration_health_pct, enterprise_service_health_pct,
            api_health_pct, workflow_health_pct, intelligence_integration_coverage_pct, enterprise_readiness_pct,
            registry_total, services_present, services_reachable
     FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`);
  if ((r.rowCount ?? 0) < 2) {
    return { present: true, ready: false, snapshots: r.rowCount, note: 'Drift needs ≥2 snapshots. null ≠ 0.' };
  }
  const [curr, prev] = r.rows;
  const delta = (a: any, b: any) => (a == null || b == null ? null : Math.round((Number(a) - Number(b)) * 100) / 100);
  const fields = ['platform_integration_health_pct', 'enterprise_service_health_pct', 'api_health_pct',
    'workflow_health_pct', 'intelligence_integration_coverage_pct', 'enterprise_readiness_pct',
    'registry_total', 'services_present', 'services_reachable'];
  const drift: Record<string, any> = {};
  for (const f of fields) drift[f] = { current: curr[f] ?? null, previous: prev[f] ?? null, delta: delta(curr[f], prev[f]) };
  return {
    present: true, ready: true,
    from: { snapshot_uid: prev.snapshot_uid, captured_at: prev.captured_at },
    to: { snapshot_uid: curr.snapshot_uid, captured_at: curr.captured_at },
    drift,
    note: 'Per-metric delta between the two most-recent snapshots. Each axis drifts independently (never composited). null ≠ 0; enterprise_readiness stays null (DEFERRED).',
    axes_note: AXES_NOTE,
  };
}

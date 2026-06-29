/**
 * MX-800 Phase 2.12 — Intelligence Automation & Governance Orchestration Platform (service layer).
 *
 * ENHANCEMENT-ONLY. A READ-ONLY tier ABOUT the platform's automation & governance ecosystem. It
 * REGISTERS the EXISTING automation / governance / workflow / policy / event / approval capabilities
 * into ONE canonical automation registry and COMPOSES:
 *   - MX-700 1.41 platform-lifecycle-automation getters (getContinuousGovernance / getLifecycleAutomation /
 *     getOrchestration / getPolicyDefinitions / evaluateCompliance / getContinuousValidation /
 *     getQualityGates / getAutomationMetrics / getAutomationSummary — ALL GET-never-writes, verified to
 *     run NO ensure-schema / DDL on the read path);
 *   - the workflow-engine read-only overview (buildWorkflowOverview — tableExists + SELECT only, advances /
 *     executes NOTHING);
 *   - the prior MX-800 intelligence-tier read-only summaries (2.1 platform / 2.3 engineering / 2.4 runtime /
 *     2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8 recommendation / 2.9 learning / 2.10 enterprise)
 * into governance orchestration / workflow orchestration / policy orchestration / validation automation /
 * event orchestration / approval workflows / automation observability / validation / metrics.
 *
 * It introduces NO parallel automation platform, DUPLICATES no engine, and changes NO business logic.
 * Critically it INVOKES / ACTIVATES no dormant engine: it READS engine-file EXISTENCE + each capability's
 * PERSISTED OUTPUT (audit/registry trail COUNT-only) + the prior tiers' read-only summaries only. It NEVER
 * emits an adaptive event, NEVER starts the AI-governance scheduler, NEVER executes a workflow, NEVER
 * decides / approves, and NEVER acts autonomously. The approval channel (Part 7) is surfaced by reading the
 * rbac_approval_requests trail COUNT-only — it deliberately does NOT call listApprovals() because that
 * helper runs ensureGovernanceSchema (DDL), which would violate GET-never-writes. The repository + the
 * existing automation/governance subsystems remain the single source of truth.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Automation ≠ Autonomy. Orchestration ≠ Decision. Approval ≠ Execution. Workflow ≠ Business-Logic.
 *     Recommendation ≠ Approval. Policy-Exists ≠ Compliant. Gate-Pass ≠ Production-Ready. Integration ≠
 *     Duplication. Insight ≠ Decision. Dashboard ≠ Intelligence. Evidence ≠ Confidence. Confidence ≠
 *     Accuracy. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes). Built ≠ Activated. Present ≠ Populated.
 *     Connected ≠ Orchestrated. Human approval mandatory.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup). ABSENT table → present:false,
 *     count NULL (≠ 0). PRESENT-but-unreadable → count NULL (query error ≠ empty). Empty → 0.
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall". governance_maturity is
 *     STRUCTURAL only (reachability / verifiability), NOT runtime maturity. automation_effectiveness
 *     (outcome) and governance_optimization (longitudinal improvement) are UNMEASURABLE here (no labelled
 *     outcomes, no longitudinal deltas) → honest-NULL (DEFERRED), never a fabricated proxy.
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *   - STOP clause: NO autonomous decision-making / self-modifying business logic / autonomous AI agents /
 *     auto-execution / duplicate dashboards / Automation V2. Every part is the evidence-grounded surfacing
 *     of EXISTING automation/governance capabilities.
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
import { isIntelligenceAutomationGovernanceEnabled, listFlags } from '../config/feature-flags';

// ── Composed automation/governance substrate (MX-700 1.41 — reuse, never duplicate) ──
// These getters are GET-never-writes (verified: no ensureAutomationSchema / DDL on the read path; only
// registerPolicy / setPolicyEnabled / captureGovernanceSnapshot run DDL — none are imported here).
import {
  getContinuousGovernance,
  getLifecycleAutomation,
  getOrchestration as getLifecycleOrchestration,
  getPolicyDefinitions,
  evaluateCompliance,
  getContinuousValidation,
  getQualityGates,
  getAutomationMetrics as getLifecycleAutomationMetrics,
  getAutomationSummary as getLifecycleAutomationSummary,
} from './platform-lifecycle-automation';
// Workflow-engine read-only overview (tableExists + SELECT only; advances / executes nothing).
import { buildWorkflowOverview } from './automation/workflow-engine';
// Adaptive event-bus EVENT-TYPE CATALOG (a const map of event names — metadata only). on/emit/initEventBus
// are DELIBERATELY NOT imported: this tier never subscribes, never emits, never initialises the bus.
import { ADAPTIVE_EVENTS } from './adaptive-event-bus';

// Composed prior MX-800 intelligence-tier summaries (governed intelligence channels — read-only).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';
import { getDecisionSummary } from './decision-intelligence';
import { getPredictiveSummary } from './predictive-intelligence-engine';
import { getRecommendationSummary } from './recommendation-intelligence-engine';
import { getLearningSummary } from './continuous-learning-intelligence-engine';
import { getEnterpriseSummary } from './enterprise-intelligence-platform';

const REGISTRY_TABLE = 'automation_governance_registry';
const SNAPSHOT_TABLE = 'automation_governance_audit_snapshots';

const AXES_NOTE =
  'Automation ≠ Autonomy · Orchestration ≠ Decision · Approval ≠ Execution · Workflow ≠ Business-Logic · ' +
  'Recommendation ≠ Approval · Built ≠ Activated · Present ≠ Populated · Connected ≠ Orchestrated · ' +
  'Coverage ⟂ Confidence ⟂ Evidence · null ≠ 0. Human approval mandatory; this tier never decides / ' +
  'executes / invokes a dormant engine — it composes existence + persisted output read-only.';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class IntelligenceAutomationGovernanceDisabled extends Error {
  code = 'intelligence_automation_governance_disabled';
  constructor() {
    super('intelligenceAutomationGovernance flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'IntelligenceAutomationGovernanceDisabled';
  }
}
function assertEnabled(): void {
  if (!isIntelligenceAutomationGovernanceEnabled()) throw new IntelligenceAutomationGovernanceDisabled();
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
/** A safe, unquoted Postgres table identifier. REJECTS user-supplied identifiers BEFORE any interpolation
 *  — the curated catalog is always safe, but manual /register passes user input through countTable's
 *  `FROM "${table}"`. A to_regclass probe does NOT sanitise identifier injection, so this regex gate is
 *  the actual injection defence. */
export function isSafeTableIdentifier(s: string): boolean {
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
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation and every
 * orchestration getter compose the SAME expensive measurement (per-capability COUNT(*) + the 1.41
 * automation getters + the prior-tier summaries). Memoization dedupes within a request window. TTL
 * defaults to 8s (production unchanged); IAG_MEMO_TTL_MS only overrides it for the offline validation
 * harness, which exercises ~12 composing getters back-to-back and would otherwise recompute each from cold.
 */
const MEMO_TTL_MS = Math.min(Math.max(Number(process.env.IAG_MEMO_TTL_MS) || 8000, 0), 3_600_000);
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; });
  _memo.set(key, { at: Date.now(), val });
  return val;
}

// ── Curated, file/table-verified AUTOMATION & GOVERNANCE catalog ─────────────
// Every `table` below is a REAL table NAME (verified in a migration); it may be ABSENT in this database →
// honest table_present:false, count NULL (≠ 0). Every `engine` file was verified to EXIST on disk. A
// capability is an EXISTING automation/governance/workflow/event/intelligence domain the platform already
// has — this tier never creates one and never runs one. `engine` is the source file whose EXISTENCE is
// read (never imported for invocation). `flag` is the governing feature flag whose STATE is read (Built ≠
// Activated). `intelligence_uid` SOFT-links the MX-800 2.1 registry (no FK; honest-null when there is no
// clear canonical domain — never a fabricated mapping).
type AutomationKind = 'automation' | 'governance' | 'workflow' | 'event' | 'intelligence';
type AutomationSource = {
  uid: string; name: string; domain: string; automation_kind: AutomationKind;
  table: string | null; engine: string | null; flag: string | null;
  intelligence_uid: string | null; tier: string | null; description: string;
};
const AUTOMATION_SOURCES: AutomationSource[] = [
  // ── Automation & governance core (MX-700 1.41 platform-lifecycle-automation) ──
  {
    uid: 'iag-cap-lifecycle-automation', name: 'Platform Lifecycle Automation', domain: 'automation',
    automation_kind: 'automation', table: 'platform_governance_audit_snapshots',
    engine: 'services/platform-lifecycle-automation.ts', flag: 'platformLifecycleAutomation',
    intelligence_uid: null, tier: 'MX-700 1.41',
    description: 'MX-700 1.41 lifecycle-automation engine (continuous governance / orchestration / validation / quality-gates / metrics). Read-only getters composed; engine never invoked beyond its GET-never-writes readers. Automation ≠ Autonomy.',
  },
  {
    uid: 'iag-cap-governance-policies', name: 'Governance Policy Registry', domain: 'policy',
    automation_kind: 'governance', table: 'platform_governance_policies',
    engine: 'services/platform-lifecycle-automation.ts', flag: 'platformLifecycleAutomation',
    intelligence_uid: null, tier: 'MX-700 1.41',
    description: 'MX-700 1.41 policy registry (built-in + custom policies). Trail read COUNT-only; getPolicyDefinitions composed read-only. Policy-Exists ≠ Compliant; Recommendation ≠ Approval.',
  },
  // ── Workflow engine (existing) ──
  {
    uid: 'iag-cap-workflow-engine', name: 'Workflow Engine', domain: 'workflow',
    automation_kind: 'workflow', table: 'workflow_definitions',
    engine: 'services/automation/workflow-engine.ts', flag: null,
    intelligence_uid: null, tier: null,
    description: 'Existing workflow engine (definitions + instances). buildWorkflowOverview composed read-only — nothing is advanced or executed by this tier. Workflow ≠ Business-Logic.',
  },
  {
    uid: 'iag-cap-workflow-instances', name: 'Workflow Instances', domain: 'workflow',
    automation_kind: 'workflow', table: 'workflow_instances',
    engine: 'services/automation/workflow-engine.ts', flag: null,
    intelligence_uid: null, tier: null,
    description: 'Existing workflow instance store. Trail read COUNT-only + status counts surfaced via buildWorkflowOverview; never advanced. Automation executes only APPROVED workflows — this tier executes none.',
  },
  // ── Event orchestration (existing — metadata/existence only) ──
  {
    uid: 'iag-cap-event-bus', name: 'Adaptive Event Bus', domain: 'event',
    automation_kind: 'event', table: null, engine: 'services/adaptive-event-bus.ts', flag: null,
    intelligence_uid: null, tier: null,
    description: 'Existing adaptive event bus. ONLY its event-type catalog (a const map) + file existence are read — this tier NEVER subscribes, NEVER emits, NEVER initialises the bus. Orchestration ≠ Decision.',
  },
  {
    uid: 'iag-cap-governance-scheduler', name: 'AI Governance Scheduler', domain: 'governance',
    automation_kind: 'governance', table: null, engine: 'services/ai-governance-scheduler.ts', flag: null,
    intelligence_uid: 'intel.ai', tier: null,
    description: 'Existing AI-governance scheduler. Engine EXISTENCE read-only — startAiGovernanceScheduler is NEVER called (starting it would be dormant activation). Built ≠ Activated.',
  },
  {
    uid: 'iag-cap-notification-engine', name: 'Notification Engine', domain: 'event',
    automation_kind: 'event', table: null, engine: 'services/notification-engine.ts', flag: null,
    intelligence_uid: null, tier: null,
    description: 'Existing notification engine. Engine EXISTENCE read-only; compute* functions are never invoked. Notification ≠ Action.',
  },
  // ── Approval workflows (existing governance subsystem) ──
  {
    uid: 'iag-cap-approval-engine', name: 'Approval Workflows', domain: 'approval',
    automation_kind: 'governance', table: 'rbac_approval_requests',
    engine: 'services/governance/approval-engine.ts', flag: 'governanceRbacV2',
    intelligence_uid: null, tier: null,
    description: 'Existing governance approval engine. Trail (rbac_approval_requests) read COUNT-only — listApprovals is DELIBERATELY NOT called (it runs ensureGovernanceSchema DDL). Approval ≠ Execution; human approval mandatory.',
  },
  {
    uid: 'iag-cap-governance-engine', name: 'Governance Engine', domain: 'governance',
    automation_kind: 'governance', table: null, engine: 'services/governance-engine.ts', flag: null,
    intelligence_uid: null, tier: null,
    description: 'Existing governance engine (policy / RBAC / approval governance). Engine EXISTENCE read-only; never invoked. Recommendation ≠ Approval.',
  },
  // ── Governed intelligence channels (prior MX-800 intelligence tiers — composed read-only) ──
  {
    uid: 'iag-cap-platform-intelligence', name: 'Platform Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'platform_intelligence_audit_snapshots',
    engine: 'services/platform-intelligence-registry.ts', flag: 'platformIntelligenceRegistry',
    intelligence_uid: 'intel.repository', tier: 'MX-800 2.1',
    description: 'MX-800 2.1 Platform Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; engine never invoked.',
  },
  {
    uid: 'iag-cap-engineering-intelligence', name: 'Engineering Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'engineering_intelligence_audit_snapshots',
    engine: 'services/engineering-intelligence.ts', flag: 'engineeringIntelligence',
    intelligence_uid: 'intel.repository', tier: 'MX-800 2.3',
    description: 'MX-800 2.3 Engineering Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; engine never invoked.',
  },
  {
    uid: 'iag-cap-runtime-intelligence', name: 'Runtime Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'runtime_intelligence_audit_snapshots',
    engine: 'services/runtime-intelligence.ts', flag: 'runtimeIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.4',
    description: 'MX-800 2.4 Runtime Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; engine never invoked.',
  },
  {
    uid: 'iag-cap-knowledge-intelligence', name: 'Knowledge Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'knowledge_intelligence_audit_snapshots',
    engine: 'services/knowledge-intelligence.ts', flag: 'knowledgeIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.5',
    description: 'MX-800 2.5 Knowledge Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; engine never invoked.',
  },
  {
    uid: 'iag-cap-decision-intelligence', name: 'Decision Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'decision_intelligence_audit_snapshots',
    engine: 'services/decision-intelligence.ts', flag: 'decisionIntelligenceEngine',
    intelligence_uid: 'intel.decision', tier: 'MX-800 2.6',
    description: 'MX-800 2.6 Decision Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; Insight ≠ Decision; engine never invoked.',
  },
  {
    uid: 'iag-cap-predictive-intelligence', name: 'Predictive Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'predictive_intelligence_audit_snapshots',
    engine: 'services/predictive-intelligence-engine.ts', flag: 'predictiveIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.7',
    description: 'MX-800 2.7 Predictive Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; Correlation ≠ Causation; engine never invoked.',
  },
  {
    uid: 'iag-cap-recommendation-intelligence', name: 'Recommendation Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'recommendation_intelligence_audit_snapshots',
    engine: 'services/recommendation-intelligence-engine.ts', flag: 'recommendationIntelligenceEngine',
    intelligence_uid: null, tier: 'MX-800 2.8',
    description: 'MX-800 2.8 Recommendation Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; Recommendation ≠ Approval; engine never invoked.',
  },
  {
    uid: 'iag-cap-learning-intelligence', name: 'Continuous Learning Intelligence', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'continuous_learning_intelligence_audit_snapshots',
    engine: 'services/continuous-learning-intelligence-engine.ts', flag: 'continuousLearningIntelligenceEngine',
    intelligence_uid: 'intel.learning', tier: 'MX-800 2.9',
    description: 'MX-800 2.9 Continuous Learning Intelligence — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; Learning ≠ Automation; engine never invoked.',
  },
  {
    uid: 'iag-cap-enterprise-intelligence', name: 'Enterprise Intelligence Platform', domain: 'intelligence',
    automation_kind: 'intelligence', table: 'enterprise_intelligence_audit_snapshots',
    engine: 'services/enterprise-intelligence-platform.ts', flag: 'enterpriseIntelligencePlatform',
    intelligence_uid: 'intel.enterprise', tier: 'MX-800 2.10',
    description: 'MX-800 2.10 Enterprise Intelligence Platform — a governed intelligence channel. Audit trail read COUNT-only + read-only summary; engine never invoked.',
  },
];

/** Measure every capability ONCE: table present + exact COUNT(*); engine file present; governing flag
 *  STATE (Built ≠ Activated). Memoized per request window. */
type MeasuredCapability = AutomationSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureCapabilities(pool: Pool): Promise<MeasuredCapability[]> {
  return memo('iag:caps', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(AUTOMATION_SOURCES.map(async (s) => {
      const table_present = s.table ? await tableReady(pool, s.table) : false;
      const table_count = table_present && s.table ? await countTable(pool, s.table) : null; // absent → null (≠ 0)
      const engine_present = s.engine ? fileCheck(s.engine) : false;
      const present = table_present || engine_present;        // substrate exists (table OR engine)
      const flag_state = s.flag ? (s.flag in flags ? !!flags[s.flag] : null) : null; // null = unverified gate (honest)
      return { ...s, table_present, table_count, engine_present, present, flag_state };
    }));
  });
}

/** Compose the MX-700 1.41 automation/governance read-only substrate ONCE (gather-once). Each getter is
 *  wrapped so one failing reader degrades to { reachable:false } instead of throwing — Connected ≠
 *  Orchestrated, and an unreachable channel is honest, never fabricated. */
type ComposedChannel = { reachable: boolean; summary: any | null; note?: string };
async function safeChannel(label: string, fn: () => Promise<any>): Promise<ComposedChannel> {
  try { const summary = await fn(); return { reachable: true, summary }; }
  catch (e: any) { return { reachable: false, summary: null, note: `${label} unreachable: ${e?.message ?? 'error'}` }; }
}
function composeAutomationSubstrate(pool: Pool) {
  return memo('iag:substrate', async () => {
    const [governance, lifecycleAutomation, orchestration, policies, compliance, validation, qualityGates, automationMetrics, automationSummary, workflows] =
      await Promise.all([
        safeChannel('continuous_governance', () => getContinuousGovernance(pool)),
        safeChannel('lifecycle_automation', () => getLifecycleAutomation(pool)),
        safeChannel('lifecycle_orchestration', () => getLifecycleOrchestration(pool)),
        safeChannel('policy_definitions', () => getPolicyDefinitions(pool)),
        safeChannel('compliance', () => evaluateCompliance(pool)),
        safeChannel('continuous_validation', () => getContinuousValidation(pool)),
        safeChannel('quality_gates', () => getQualityGates(pool)),
        safeChannel('automation_metrics', () => getLifecycleAutomationMetrics(pool)),
        safeChannel('automation_summary', () => getLifecycleAutomationSummary(pool)),
        safeChannel('workflow_overview', () => buildWorkflowOverview(pool)),
      ]);
    const channels = { governance, lifecycleAutomation, orchestration, policies, compliance, validation, qualityGates, automationMetrics, automationSummary, workflows };
    const of = Object.keys(channels).length;
    const reachable = Object.values(channels).filter((c) => c.reachable).length;
    return { channels, reachable, of };
  });
}

/** Compose the prior MX-800 intelligence-tier read-only summaries ONCE (governed intelligence channels).
 *  Mirrors the 2.10 composePriorTiers pattern. 2.11 (Operations Center) is a FRONTEND-exposure phase with
 *  no backend service getter → honestly reported as non-getter (not a failure, not fabricated). */
async function composeGovernedTiers(pool: Pool) {
  return memo('iag:tiers', async () => {
    const tiers = [
      { tier: 'MX-800 2.1', name: 'Platform Intelligence', get: () => getPlatformSummary(pool) },
      { tier: 'MX-800 2.3', name: 'Engineering Intelligence', get: () => getEngineeringSummary(pool) },
      { tier: 'MX-800 2.4', name: 'Runtime Intelligence', get: () => getRuntimeSummary(pool) },
      { tier: 'MX-800 2.5', name: 'Knowledge Intelligence', get: () => getKnowledgeSummary(pool) },
      { tier: 'MX-800 2.6', name: 'Decision Intelligence', get: () => getDecisionSummary(pool) },
      { tier: 'MX-800 2.7', name: 'Predictive Intelligence', get: () => getPredictiveSummary(pool) },
      { tier: 'MX-800 2.8', name: 'Recommendation Intelligence', get: () => getRecommendationSummary(pool) },
      { tier: 'MX-800 2.9', name: 'Continuous Learning Intelligence', get: () => getLearningSummary(pool) },
      { tier: 'MX-800 2.10', name: 'Enterprise Intelligence', get: () => getEnterpriseSummary(pool) },
    ];
    const results = await Promise.all(tiers.map(async (t) => {
      const c = await safeChannel(t.tier, t.get);
      return { tier: t.tier, name: t.name, reachable: c.reachable, note: c.note };
    }));
    const of = results.length;
    const reachable = results.filter((r) => r.reachable).length;
    return {
      tiers: results, reachable, of,
      non_getter_tiers: [{ tier: 'MX-800 2.11', name: 'Platform Intelligence Operations Center', note: 'Frontend-exposure phase — no backend service getter by design (composes client-side). Reported honest-absent, not a failure.' }],
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Automation Catalog (registry of EXISTING automation/governance capabilities)
// ════════════════════════════════════════════════════════════════════════════
export async function getAutomationGovernanceCatalog(pool: Pool) {
  return memo('iag:catalog', async () => {
    const measured = await measureCapabilities(pool);
    const by_domain_map: Record<string, { domain: string; capabilities: number; present: number }> = {};
    const by_kind: Record<string, number> = {};
    let table_backed = 0, engine_backed = 0, present = 0, automation_records = 0;
    for (const m of measured) {
      by_kind[m.automation_kind] = (by_kind[m.automation_kind] ?? 0) + 1;
      const d = (by_domain_map[m.domain] ??= { domain: m.domain, capabilities: 0, present: 0 });
      d.capabilities++;
      if (m.present) { d.present++; present++; }
      if (m.table) table_backed++;
      if (m.engine) engine_backed++;
      if ((m.table_count ?? 0) > 0) automation_records += m.table_count ?? 0;
    }
    return {
      phase: 'MX-800 Phase 2.12 — Automation & Governance Catalog',
      catalog_kind:
        'A curated, file/table-verified catalog of the EXISTING automation / governance / workflow / event / ' +
        'approval / governed-intelligence capabilities. Engine files are read for EXISTENCE only; persisted ' +
        'trails are read COUNT-only. This tier registers + surfaces them — it never creates, runs, or ' +
        'activates one (Built ≠ Activated; Automation ≠ Autonomy).',
      totals: { capabilities: measured.length, present, table_backed, engine_backed, automation_records },
      by_kind,
      by_domain: Object.values(by_domain_map).sort((a, b) => a.domain.localeCompare(b.domain)),
      capabilities: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, automation_kind: m.automation_kind,
        physical_table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine_path: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, tier: m.tier, intelligence_uid: m.intelligence_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Governance Orchestration (composes 1.41 continuous-governance + orchestration + tiers)
// ════════════════════════════════════════════════════════════════════════════
export async function getGovernanceOrchestration(pool: Pool) {
  return memo('iag:governance-orchestration', async () => {
    const sub = await composeAutomationSubstrate(pool);
    const tiers = await composeGovernedTiers(pool);
    return {
      phase: 'MX-800 Phase 2.12 — Governance Orchestration',
      orchestration_kind:
        'METADATA-LEVEL coordination of the EXISTING governance substrate (which governance channel answers ' +
        'which concern). It NEVER executes a governance engine, NEVER decides, NEVER approves. Connected ≠ ' +
        'Orchestrated; Orchestration ≠ Decision; Recommendation ≠ Approval.',
      orchestration_safety: { decides: false, approves: false, executes: false, autonomous: false },
      governance: { reachable: sub.channels.governance.reachable, note: sub.channels.governance.note },
      lifecycle_orchestration: { reachable: sub.channels.orchestration.reachable, note: sub.channels.orchestration.note },
      governed_intelligence_tiers: { reachable: tiers.reachable, of: tiers.of, tiers: tiers.tiers, non_getter_tiers: tiers.non_getter_tiers },
      substrate_reachability: { reachable: sub.reachable, of: sub.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Workflow Orchestration (composes workflow-engine overview + 1.41 lifecycle-automation)
// ════════════════════════════════════════════════════════════════════════════
export async function getWorkflowOrchestration(pool: Pool) {
  return memo('iag:workflow-orchestration', async () => {
    const sub = await composeAutomationSubstrate(pool);
    const wf = sub.channels.workflows.summary;
    return {
      phase: 'MX-800 Phase 2.12 — Workflow Orchestration',
      workflow_kind:
        'Read-only surfacing of the EXISTING workflow engine (definitions + instances). It surfaces ' +
        'provisioning + status counts via buildWorkflowOverview — it NEVER advances a step, NEVER executes a ' +
        'workflow, and NEVER mutates business logic. Automation executes only APPROVED workflows — this tier ' +
        'executes none. Workflow ≠ Business-Logic.',
      workflow_safety: { advances_steps: false, executes_workflows: false, modifies_business_logic: false },
      workflow_overview: sub.channels.workflows.reachable ? {
        provisioned: wf?.provisioned ?? null, degraded: wf?.degraded ?? null,
        definitions: Array.isArray(wf?.definitions) ? wf.definitions.length : null,
        notes: wf?.notes ?? null,
      } : { reachable: false, note: sub.channels.workflows.note },
      lifecycle_automation: { reachable: sub.channels.lifecycleAutomation.reachable, note: sub.channels.lifecycleAutomation.note },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Policy Orchestration (composes 1.41 policy-definitions + compliance)
// ════════════════════════════════════════════════════════════════════════════
export async function getPolicyOrchestration(pool: Pool) {
  return memo('iag:policy-orchestration', async () => {
    const sub = await composeAutomationSubstrate(pool);
    return {
      phase: 'MX-800 Phase 2.12 — Policy Orchestration',
      policy_kind:
        'Read-only surfacing of the EXISTING 1.41 policy registry + on-demand compliance evaluation. A ' +
        'registered policy is NOT a guarantee of compliance, and compliance results are NOT persisted by ' +
        'this tier. Policy-Exists ≠ Compliant; Recommendation ≠ Approval; Compliance ≠ RuntimeUsage.',
      policy_safety: { registers_policy: false, enforces: false, persists_compliance: false },
      policies: { reachable: sub.channels.policies.reachable, note: sub.channels.policies.note },
      compliance: { reachable: sub.channels.compliance.reachable, note: sub.channels.compliance.note },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Validation Automation (composes 1.41 continuous-validation + quality-gates)
// ════════════════════════════════════════════════════════════════════════════
export async function getValidationAutomation(pool: Pool) {
  return memo('iag:validation-automation', async () => {
    const sub = await composeAutomationSubstrate(pool);
    return {
      phase: 'MX-800 Phase 2.12 — Validation Automation',
      validation_kind:
        'Read-only surfacing of the EXISTING 1.41 continuous-validation + automated quality-gates. ' +
        'Validation ≠ Modification; a passing gate is STRUCTURAL, not a production-readiness verdict ' +
        '(Gate-Pass ≠ Production-Ready). This tier re-runs no validation engine — it composes their output.',
      validation_safety: { modifies: false, gates_production: false, autonomous: false },
      continuous_validation: { reachable: sub.channels.validation.reachable, note: sub.channels.validation.note },
      quality_gates: { reachable: sub.channels.qualityGates.reachable, note: sub.channels.qualityGates.note },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Event Orchestration (adaptive event-bus catalog + scheduler/notification existence)
// ════════════════════════════════════════════════════════════════════════════
export async function getEventOrchestration(pool: Pool) {
  return memo('iag:event-orchestration', async () => {
    const measured = await measureCapabilities(pool);
    const eventCaps = measured.filter((m) => m.automation_kind === 'event' || m.uid === 'iag-cap-governance-scheduler');
    const eventTypes = (() => { try { return Object.keys(ADAPTIVE_EVENTS as Record<string, unknown>); } catch { return []; } })();
    return {
      phase: 'MX-800 Phase 2.12 — Event Orchestration',
      event_kind:
        'Read-only surfacing of the EXISTING event substrate (adaptive event bus + AI-governance scheduler + ' +
        'notification engine). ONLY the event-type CATALOG (a const map) + engine-file EXISTENCE are read — ' +
        'this tier NEVER emits an event, NEVER starts the scheduler, NEVER fires a notification. ' +
        'Orchestration ≠ Decision; Built ≠ Activated.',
      event_safety: { emits_events: false, starts_scheduler: false, sends_notifications: false, subscribes: false },
      event_type_catalog: { count: eventTypes.length, types: eventTypes },
      event_capabilities: eventCaps.map((m) => ({ uid: m.uid, name: m.name, engine_path: m.engine, engine_present: m.engine_present, table: m.table, table_count: m.table_count })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Approval Workflows (read the rbac_approval_requests trail COUNT-only — NEVER listApprovals)
// ════════════════════════════════════════════════════════════════════════════
export async function getApprovalWorkflows(pool: Pool) {
  return memo('iag:approval-workflows', async () => {
    const measured = await measureCapabilities(pool);
    const approval = measured.find((m) => m.uid === 'iag-cap-approval-engine');
    // Read by-status COUNT directly (GET-never-writes). listApprovals() is DELIBERATELY avoided because it
    // runs ensureGovernanceSchema (DDL). null when the trail is absent/unreadable (null ≠ 0).
    let by_status: any[] | null = null;
    if (approval?.table_present) {
      by_status = await rows(pool, `SELECT status, COUNT(*)::int AS count FROM rbac_approval_requests GROUP BY status ORDER BY count DESC`);
    }
    return {
      phase: 'MX-800 Phase 2.12 — Approval Workflows',
      approval_kind:
        'Read-only surfacing of the EXISTING governance approval trail (rbac_approval_requests). The trail is ' +
        'read COUNT-only — listApprovals() is DELIBERATELY NOT called because it runs ensureGovernanceSchema ' +
        '(DDL), which would violate GET-never-writes. This tier NEVER creates, approves, rejects, or executes ' +
        'an approval. Approval ≠ Execution; human approval mandatory.',
      approval_safety: { creates_request: false, approves: false, rejects: false, executes: false, runs_ddl: false },
      approval_engine_present: approval?.engine_present ?? false,
      trail_present: approval?.table_present ?? false,
      total_requests: approval?.table_count ?? null,
      by_status,
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Automation Observability (KPIs/indicators composed from catalog + substrate + tiers)
// ════════════════════════════════════════════════════════════════════════════
export async function getAutomationObservability(pool: Pool) {
  return memo('iag:observability', async () => {
    const measured = await measureCapabilities(pool);
    const sub = await composeAutomationSubstrate(pool);
    const tiers = await composeGovernedTiers(pool);
    const present = measured.filter((m) => m.present).length;
    const dormant = measured.filter((m) => m.flag != null && m.flag_state === false);
    return {
      phase: 'MX-800 Phase 2.12 — Automation Observability',
      observability_kind:
        'Composes the EXISTING automation/governance substrate + governed intelligence tiers into read-only ' +
        'automation KPIs / strategic indicators / risks / opportunities. Dashboard ≠ Intelligence; this tier ' +
        'surfaces MEASURED indicators, it never decides and never reports a fabricated number.',
      observability_safety: { decides: false, modifies_business_logic: false, autonomous: false, fabricates_kpis: false },
      automation_kpis: [
        { kpi: 'automation_substrate_reachable', value: sub.reachable, of: sub.of, measured: true },
        { kpi: 'governed_intelligence_tiers_reachable', value: tiers.reachable, of: tiers.of, measured: true },
        { kpi: 'capabilities_present', value: present, of: measured.length, measured: true },
        { kpi: 'automation_outcome_effectiveness', value: null, measured: false, note: 'No labelled automation outcomes — honest-null (DEFERRED).' },
      ],
      strategic_indicators: {
        connected_not_orchestrated: { value: true, note: 'Substrate is composed (Connected); orchestration is metadata-level only (Connected ≠ Orchestrated).' },
        dormant_capabilities: { value: dormant.length, note: 'Built but flag-OFF (Built ≠ Activated). Dormant ≠ debt; an observation, not an instruction to activate.' },
      },
      automation_trends: { ready: false, note: 'Trends need ≥2 audit snapshots — see /audit/drift. null ≠ 0.' },
      automation_risks: dormant.length > 0 ? [{ risk: 'dormant_automation', detail: `${dormant.length} automation/governance capabilities built but flag-OFF`, severity: 'observational' }] : [],
      automation_opportunities: [{ opportunity: 'governance_review', detail: 'Co-present governance channels MAY be reviewed by an operator; this tier never acts.', requires_human_approval: true }],
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 9 — Automation Validation (STRUCTURAL only — existence + population + reachability)
// ════════════════════════════════════════════════════════════════════════════
export async function getAutomationGovernanceValidation(pool: Pool) {
  return memo('iag:validation', async () => {
    const measured = await measureCapabilities(pool);
    const sub = await composeAutomationSubstrate(pool);
    const tiers = await composeGovernedTiers(pool);
    const enginesPresent = measured.filter((m) => m.engine_present).length;
    const tableBacked = measured.filter((m) => m.table);
    const populated = tableBacked.filter((m) => (m.table_count ?? 0) > 0);
    const checks = [
      { check: 'catalog_non_empty', status: measured.length > 0 ? 'pass' : 'fail', detail: `${measured.length} curated capabilities` },
      { check: 'engines_present', status: enginesPresent === measured.filter((m) => m.engine).length ? 'pass' : 'partial', detail: `${enginesPresent}/${measured.filter((m) => m.engine).length} engine files present` },
      { check: 'automation_substrate_reachable', status: sub.reachable > 0 ? 'pass' : 'fail', detail: `${sub.reachable}/${sub.of} 1.41/workflow channels reachable` },
      { check: 'governed_tiers_reachable', status: tiers.reachable > 0 ? 'pass' : 'fail', detail: `${tiers.reachable}/${tiers.of} prior MX-800 tiers reachable` },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.12 — Automation Validation',
      validation_kind: 'STRUCTURAL only (existence + population + reachability + self-consistency). NOT a runtime / maturity / effectiveness / outcome verdict. Automation ≠ Business Logic.',
      checks,
      populated_trails: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 10 — Automation Metrics (6 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getAutomationGovernanceMetrics(pool: Pool) {
  return memo('iag:metrics', async () => {
    const measured = await measureCapabilities(pool);
    const sub = await composeAutomationSubstrate(pool);
    const tiers = await composeGovernedTiers(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const tableBacked = measured.filter((m) => m.table);
    const populatedTrails = tableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    const explainable = measured.length; // every curated capability is explainable via /explain — MEASURED
    return {
      phase: 'MX-800 Phase 2.12 — Automation Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'automation_health', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Automation/governance capabilities whose substrate is present. Present ≠ Populated.' },
        { metric: 'governance_maturity', axis: 'confidence', score: pct(sub.reachable, sub.of), basis: { reachable: sub.reachable, of: sub.of }, note: 'STRUCTURAL maturity only: 1.41/workflow governance channels reachable. Connected ≠ Orchestrated; NOT runtime maturity. Confidence ≠ Accuracy.' },
        { metric: 'automation_coverage', axis: 'coverage', score: pct(populatedTrails, tableBacked.length), basis: { measured: populatedTrails, of: tableBacked.length }, note: 'Persisted automation/governance trails that are populated. Coverage ⟂ Confidence. Mostly null/low in dev (flags OFF) — honest, not a defect.' },
        { metric: 'explainability_score', axis: 'evidence', score: pct(explainable, total), basis: { measured: explainable, of: total }, note: 'Capabilities that expose explainable reasoning via /explain. Evidence ≠ Confidence.' },
        { metric: 'automation_effectiveness', axis: 'outcome', score: null, basis: { measurable: false }, note: 'Automation EFFECTIVENESS requires labelled outcomes (whether automation improved an outcome) which are absent → honest-null (DEFERRED). Automation ≠ Autonomy; this tier never measures outcome.' },
        { metric: 'governance_optimization', axis: 'improvement', score: null, basis: { measurable: false }, note: 'Governance OPTIMIZATION (longitudinal improvement) requires longitudinal labelled deltas which are absent → honest-null (DEFERRED). Improvement ≠ Optimization; this tier never optimizes.' },
      ],
      population: { capabilities: total, present, table_backed: tableBacked.length, populated_trails: populatedTrails, substrate_reachable: sub.reachable, of_substrate: sub.of, tiers_reachable: tiers.reachable, of_tiers: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Explainability — why/evidence/state/refs for ONE capability (unknown → found:false)
// ════════════════════════════════════════════════════════════════════════════
export async function explainAutomationGovernance(pool: Pool, uidArg: string) {
  const measured = await measureCapabilities(pool);
  const m = measured.find((x) => x.uid === uidArg);
  if (!m) return { found: false, uid: uidArg, note: 'Unknown capability uid. null ≠ 0; not fabricated.' };
  return {
    found: true,
    capability: { uid: m.uid, name: m.name, domain: m.domain, automation_kind: m.automation_kind, tier: m.tier },
    why: m.description,
    evidence: {
      engine_path: m.engine, engine_present: m.engine_present,
      physical_table: m.table, table_present: m.table_present, table_count: m.table_count,
    },
    state: { present: m.present, governing_flag: m.flag, flag_state: m.flag_state, note: 'flag_state is the governing flag STATE — Built ≠ Activated; null when no/unverified flag.' },
    composition_note: 'This capability is READ for existence + persisted output only. It is never invoked, never executed, never activated by this tier.',
    intelligence_uid: m.intelligence_uid,
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (automation_governance_registry — catalog of automation CAPABILITIES)
// ════════════════════════════════════════════════════════════════════════════
export async function getAutomationGovernanceRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_kind: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT automation_uid, name, automation_kind, domain, physical_table, engine_path, governing_flag, tier, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_kind: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_kind[e.automation_kind] = (by_kind[e.automation_kind] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_kind, by_domain, entries };
}

export async function getAutomationGovernanceCapability(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE automation_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverAutomationGovernance(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureAutomationGovernanceSchema(pool);
  const measured = await measureCapabilities(pool);
  let upserted = 0;
  for (const m of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (automation_uid, name, automation_kind, domain, physical_table, engine_path, governing_flag, tier, present, table_count, flag_state, intelligence_uid, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'discovered')
       ON CONFLICT (automation_uid) DO UPDATE SET
         name=EXCLUDED.name, automation_kind=EXCLUDED.automation_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, tier=EXCLUDED.tier, present=EXCLUDED.present,
         table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         intelligence_uid=EXCLUDED.intelligence_uid, metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner + lifecycle_uid are MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers them.
      [m.uid, m.name, m.automation_kind, m.domain, m.table, m.engine, m.flag, m.tier, m.present, m.table_count, m.flag_state, m.intelligence_uid,
       JSON.stringify({ description: m.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: AUTOMATION_SOURCES.length, by: actor };
}

export async function registerAutomationGovernanceCapability(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureAutomationGovernanceSchema(pool);
  const name = body?.name ? String(body.name) : null;
  if (!name) return { ok: false, error: 'name is required' };
  const table = body?.physical_table ? String(body.physical_table) : null;
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex gate,
  // not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (table != null && !isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.automation_uid ? String(body.automation_uid) : uid('iag-man');
  const table_present = table ? await tableReady(pool, table) : false;
  const table_count = table_present && table ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (automation_uid, name, automation_kind, domain, physical_table, engine_path, governing_flag, tier, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual')
     ON CONFLICT (automation_uid) DO UPDATE SET
       name=EXCLUDED.name, automation_kind=EXCLUDED.automation_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, tier=EXCLUDED.tier, present=EXCLUDED.present, table_count=EXCLUDED.table_count,
       flag_state=EXCLUDED.flag_state,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       intelligence_uid=COALESCE(EXCLUDED.intelligence_uid, ${REGISTRY_TABLE}.intelligence_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.automation_kind ? String(body.automation_kind) : 'automation', body?.domain ? String(body.domain) : null,
     table, body?.engine_path ? String(body.engine_path) : null, body?.governing_flag ? String(body.governing_flag) : null,
     body?.tier ? String(body.tier) : null, table_present, table_count, null,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     body?.intelligence_uid ? String(body.intelligence_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, automation_uid: u, present: table_present, count: table_count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getAutomationGovernanceSummary(pool: Pool) {
  const [registry, catalog, metrics, validation, sub, tiers] = await Promise.all([
    getAutomationGovernanceRegistry(pool), getAutomationGovernanceCatalog(pool), getAutomationGovernanceMetrics(pool), getAutomationGovernanceValidation(pool), composeAutomationSubstrate(pool), composeGovernedTiers(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.12 — Intelligence Automation & Governance Orchestration Platform',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    catalog: { capabilities: catalog.totals.capabilities, present: catalog.totals.present, table_backed: catalog.totals.table_backed, engine_backed: catalog.totals.engine_backed, automation_records: catalog.totals.automation_records, domains: catalog.by_domain.length },
    metrics: metrics.scores,
    composition: { automation_substrate_reachable: sub.reachable, of_substrate: sub.of, governed_tiers_reachable: tiers.reachable, of_tiers: tiers.of, note: 'COMPOSES MX-700 1.41 platform-lifecycle-automation (governance/policies/quality-gates/compliance/orchestration/validation/metrics) + workflow-engine overview + the prior MX-800 intelligence-tier summaries read-only. Re-runs no engine; decides nothing. Integration ≠ Duplication; Connected ≠ Orchestrated.' },
    validation_verdict: validation.verdict,
    automation_safety: { decides: false, approves: false, executes: false, autonomous: false, emits_events: false, starts_scheduler: false, duplicates_engines: false, insight_only: true },
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Lazy ensure-schema — canonical mirror of 20261230_intelligence_automation_governance.sql.
// ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical.
// ════════════════════════════════════════════════════════════════════════════
let _schemaReady = false;
export async function ensureAutomationGovernanceSchema(pool: Pool): Promise<void> {
  // Defense-in-depth: assert the flag HERE too (not only in the write callers), so a direct/tooling caller
  // can never create schema while the feature is OFF — flag-OFF stays byte-identical incl. schema.
  assertEnabled();
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      automation_uid      TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      automation_kind     TEXT NOT NULL,
      domain              TEXT,
      physical_table      TEXT,
      engine_path         TEXT,
      governing_flag      TEXT,
      tier                TEXT,
      present             BOOLEAN,
      table_count         INTEGER,
      flag_state          BOOLEAN,
      owner               TEXT,
      lifecycle_uid       TEXT,
      intelligence_uid    TEXT,
      metadata            JSONB NOT NULL DEFAULT '{}',
      source              TEXT NOT NULL DEFAULT 'discovered',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_agr_automation_kind ON ${REGISTRY_TABLE} (automation_kind);
    CREATE INDEX IF NOT EXISTS idx_agr_domain          ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      capabilities_present        INTEGER,
      automation_records          INTEGER,
      tiers_reachable             INTEGER,
      automation_health_pct       NUMERIC,
      governance_maturity_pct     NUMERIC,
      automation_coverage_pct     NUMERIC,
      explainability_pct          NUMERIC,
      automation_effectiveness_pct NUMERIC,
      governance_optimization_pct NUMERIC,
      metrics                     JSONB,
      validation                  JSONB,
      summary                     JSONB,
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_agas_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function captureAutomationGovernanceSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureAutomationGovernanceSchema(pool);
  const [registry, catalog, metrics, validation, summary, sub, tiers] = await Promise.all([
    getAutomationGovernanceRegistry(pool), getAutomationGovernanceCatalog(pool), getAutomationGovernanceMetrics(pool), getAutomationGovernanceValidation(pool), getAutomationGovernanceSummary(pool), composeAutomationSubstrate(pool), composeGovernedTiers(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('iag-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, capabilities_present, automation_records, tiers_reachable,
       automation_health_pct, governance_maturity_pct, automation_coverage_pct,
       explainability_pct, automation_effectiveness_pct, governance_optimization_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [snapshot_uid, registry.total, catalog.totals.present, catalog.totals.automation_records, tiers.reachable,
     score('automation_health'), score('governance_maturity'), score('automation_coverage'),
     score('explainability_score'), score('automation_effectiveness'), score('governance_optimization'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getAutomationGovernanceSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, capabilities_present, automation_records, tiers_reachable, automation_health_pct, governance_maturity_pct, automation_coverage_pct, explainability_pct, automation_effectiveness_pct, governance_optimization_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getAutomationGovernanceDrift(pool: Pool) {
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
      automation_records: delta('automation_records'),
      tiers_reachable: delta('tiers_reachable'),
      automation_health_pct: delta('automation_health_pct'),
      governance_maturity_pct: delta('governance_maturity_pct'),
      automation_coverage_pct: delta('automation_coverage_pct'),
      explainability_pct: delta('explainability_pct'),
      automation_effectiveness_pct: delta('automation_effectiveness_pct'),
      governance_optimization_pct: delta('governance_optimization_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}

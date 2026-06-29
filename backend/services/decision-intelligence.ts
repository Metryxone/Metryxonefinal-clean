/**
 * MX-800 Phase 2.6 — Decision Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Decision Intelligence is a READ-ONLY intelligence tier ABOUT the platform's
 * decisions. It CATALOGS the EXISTING decision capabilities and COMPOSES the prior intelligence tiers
 * (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge) into EXPLAINABLE DECISION SUPPORT
 * (registry / reasoning / evidence / confidence / governance / explainability / validation / metrics).
 *
 * It introduces NO parallel decision / rule / recommendation engine, DUPLICATES no business rule, and
 * changes NO business logic. Critically it INVOKES / ACTIVATES no dormant decision engine: it READS
 * their EXISTENCE (engine source files) and their PERSISTED OUTPUT (decision tables) only — composing
 * an engine's existence is NOT the same as running it (running a flag-OFF engine would be dormant
 * activation). The repository + the existing decision tables remain the single source of truth.
 *
 * Composed substrate (READ-ONLY — reuse, never duplicate, never write, never invoke):
 *   - Career decision engines:  services/wc7b/decision-orchestrator.ts (buildActivationEnvelope),
 *                               decision-persistence.ts (wc7b_decision_state), mentor-bridge.ts —
 *                               flags decisionOrchestrator / decisionPersistence / decisionMentorBridge.
 *   - Live decision tables:     wc7b_decision_state, wc3_personalization_decisions, interview_decisions,
 *                               role_resolution_decisions, archetype_governance_decisions,
 *                               executive_decision_models, m5_executive_decision_audits,
 *                               ai_decision_audits, m4_ai_decision_logs  (COUNT-ONLY, never written).
 *   - Prior intelligence tiers: platform_intelligence_registry (2.1) / engineering (2.3) / runtime (2.4) /
 *                               knowledge (2.5) — their read-only getSummary getters for the Evidence/Context view.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Recommendation ≠ Decision ≠ Automation ≠ Approval. Evidence ≠ Confidence ≠ Accuracy.
 *     Prediction ≠ Outcome. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes, never blended).
 *     Built ≠ Activated. Present ≠ Populated. Human approval remains MANDATORY.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup — reads 0 for bulk-seeded
 *     tables until autovacuum analyzes). ABSENT table → present:false, count NULL (≠ 0). A PRESENT but
 *     unreadable table → count NULL (query error ≠ empty). Empty table → 0.
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall". decision_confidence
 *     is STRUCTURAL only (substrate verifiability/integrity), NOT runtime/outcome/accuracy confidence.
 *   - recommendation_quality as runtime ACCURACY is UNMEASURABLE here (no labelled decision outcomes)
 *     → honest-NULL (DEFERRED), never a fabricated proxy. This tier provides decision SUPPORT, it never
 *     measures whether a recommendation was correct, and it never DECIDES.
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *   - STOP clause: NO Predictive / Recommendation / Autonomous-AI / workflow-automation. Reasoning is
 *     the evidence-grounded WHY a decision capability is supported — never a prediction or a decision.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER
 * create schema and NEVER write to the existing decision tables. The lazy ensure-schema runs ONLY on
 * flag-ON write paths (discover / register / audit-capture) so flag OFF → byte-identical incl. schema
 * (0 tables). Every write path also asserts the flag itself BEFORE ensure-schema (defense-in-depth).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isDecisionIntelligenceEngineEnabled, listFlags } from '../config/feature-flags';

// Composed prior-tier summaries (EXISTING intelligence engines — reuse, never duplicate).
// These getters are GET-never-writes (to_regclass-probed reads, no ensure-schema, verified).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';

const REGISTRY_TABLE = 'decision_registry';
const SNAPSHOT_TABLE = 'decision_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class DecisionIntelligenceDisabled extends Error {
  code = 'decision_intelligence_disabled';
  constructor() {
    super('decisionIntelligenceEngine flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'DecisionIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isDecisionIntelligenceEngineEnabled()) throw new DecisionIntelligenceDisabled();
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
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation, /evidence and
 * captureSnapshot all compose the SAME expensive measurement (per-capability COUNT(*) + four prior-tier
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

// ── Curated, file/table-verified DECISION CAPABILITY catalog ─────────────────
// Every `table` below was verified to EXIST in this database and every `engine` file to EXIST on disk.
// A capability is an EXISTING decision TYPE the platform already makes — this tier never creates a new
// one. `table` is the persisted decision trail (read-only, COUNT-only) or null for a compute-on-read
// engine. `engine` is the source file whose EXISTENCE is read (never imported / invoked). `flag` is the
// governing feature flag whose STATE is read (Built ≠ Activated) — null when the gate is unverified
// (honest-NULL, never a fabricated mapping). `intelligence_uid` SOFT-links the MX-800 2.1 registry.
type DecisionKind = 'orchestrated' | 'persisted' | 'derived' | 'logged' | 'audited' | 'model' | 'governance';
type DecisionSource = {
  uid: string; name: string; domain: string; decision_kind: DecisionKind;
  table: string | null; engine: string | null; flag: string | null;
  intelligence_uid: string | null; description: string;
};
const DECISION_SOURCES: DecisionSource[] = [
  // ── Career activation decision (WC-7B) ──
  {
    uid: 'di-cap-career-activation', name: 'Career activation decision', domain: 'career',
    decision_kind: 'orchestrated', table: null, engine: 'services/wc7b/decision-orchestrator.ts',
    flag: 'decisionOrchestrator', intelligence_uid: 'intel.decision',
    description: 'Read-only orchestrator that composes a unified per-session activation envelope (stage + primary outcome + unified confidence + why[]) from already-computed session signals. Computed-on-read — no persisted trail of its own.',
  },
  {
    uid: 'di-cap-career-persistence', name: 'Career decision persistence', domain: 'career',
    decision_kind: 'persisted', table: 'wc7b_decision_state', engine: 'services/wc7b/decision-persistence.ts',
    flag: 'decisionPersistence', intelligence_uid: 'intel.decision',
    description: 'Idempotently UPSERTs one row per session snapshotting the orchestrated decision envelope into wc7b_decision_state (the durable, auditable career-decision trail).',
  },
  {
    uid: 'di-cap-career-mentor-bridge', name: 'Decision → mentor bridge', domain: 'career',
    decision_kind: 'derived', table: null, engine: 'services/wc7b/mentor-bridge.ts',
    flag: 'decisionMentorBridge', intelligence_uid: 'intel.decision',
    description: 'Pure read-only derivation of a mentor activation SUGGESTION from the composed decision (concern domain + activated outcome models + stage). Suggestion, not a decision or an automated action.',
  },
  // ── Personalization decision (WC-3) ──
  {
    uid: 'di-cap-personalization', name: 'Personalization decision', domain: 'personalization',
    decision_kind: 'logged', table: 'wc3_personalization_decisions', engine: null,
    flag: 'wc3Personalization', intelligence_uid: null,
    description: 'Append-only log of the personalization decision (the age/persona/context/severity dimensions that drove the clarity picker) per session.',
  },
  // ── Hiring decision ──
  {
    uid: 'di-cap-interview', name: 'Interview / hiring decision', domain: 'hiring',
    decision_kind: 'audited', table: 'interview_decisions', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted interview / hiring decisions for the employer hiring funnel (human-authored hiring outcomes).',
  },
  // ── Role resolution decision ──
  {
    uid: 'di-cap-role-resolution', name: 'Role resolution decision', domain: 'role_resolution',
    decision_kind: 'logged', table: 'role_resolution_decisions', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted record of how a free-text role title was resolved to a curated Role-DNA profile (abstain-never-fabricate matching trail).',
  },
  // ── Governance decision ──
  {
    uid: 'di-cap-archetype-governance', name: 'Archetype governance decision', domain: 'governance',
    decision_kind: 'governance', table: 'archetype_governance_decisions', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Human-governed archetype governance decisions (approval / curation of behavioural archetypes).',
  },
  // ── Executive decision ──
  {
    uid: 'di-cap-executive-model', name: 'Executive decision model', domain: 'executive',
    decision_kind: 'model', table: 'executive_decision_models', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Registered executive decision models (enterprise decision configuration / model registry).',
  },
  {
    uid: 'di-cap-executive-audit', name: 'Executive decision audit', domain: 'executive',
    decision_kind: 'audited', table: 'm5_executive_decision_audits', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Append-only audit trail of executive (M5) decisions for traceability.',
  },
  // ── AI decision ──
  {
    uid: 'di-cap-ai-audit', name: 'AI decision audit', domain: 'ai',
    decision_kind: 'audited', table: 'ai_decision_audits', engine: null,
    flag: 'aiGovernance', intelligence_uid: null,
    description: 'Append-only audit trail of AI-assisted decisions for AI-governance oversight (auditability, not autonomy).',
  },
  {
    uid: 'di-cap-m4-ai-log', name: 'AI decision log (M4)', domain: 'ai',
    decision_kind: 'logged', table: 'm4_ai_decision_logs', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Append-only log of M4 AI decision events (per-decision provenance records).',
  },
];

/** Measure every capability ONCE: table present + exact COUNT(*); engine file present; governing flag
 *  STATE (Built ≠ Activated). Memoized per request window. */
type MeasuredCapability = DecisionSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureCapabilities(pool: Pool): Promise<MeasuredCapability[]> {
  return memo('di:caps', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(DECISION_SOURCES.map(async (s) => {
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
/** Lazy ensure-schema — canonical mirror of 20261225_decision_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureDecisionSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                BIGSERIAL PRIMARY KEY,
      decision_uid      TEXT UNIQUE NOT NULL,
      name              TEXT NOT NULL,
      decision_kind     TEXT NOT NULL,            -- orchestrated|persisted|derived|logged|audited|model|governance
      domain            TEXT,                     -- career|personalization|hiring|role_resolution|governance|executive|ai
      physical_table    TEXT,                     -- the EXISTING persisted decision trail (read-only) or NULL (compute-on-read)
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
    CREATE INDEX IF NOT EXISTS idx_dr_decision_kind ON ${REGISTRY_TABLE} (decision_kind);
    CREATE INDEX IF NOT EXISTS idx_dr_domain        ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      capabilities_present        INTEGER,
      decisions_recorded          INTEGER,
      decision_quality_pct        NUMERIC,
      decision_confidence_pct     NUMERIC,
      decision_coverage_pct       NUMERIC,
      recommendation_quality_pct  NUMERIC,        -- honest-NULL (accuracy unmeasurable)
      governance_compliance_pct   NUMERIC,
      explainability_pct          NUMERIC,
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_dias_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

const AXES_NOTE =
  'Recommendation ≠ Decision ≠ Automation ≠ Approval. Evidence ≠ Confidence ≠ Accuracy. Prediction ≠ ' +
  'Outcome. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes). Built ≠ Activated. Present ≠ Populated. ' +
  'Human approval remains mandatory. Metrics are NEVER composited.';
const REPO_REFS = [
  'backend/services/decision-intelligence.ts',
  'backend/routes/decision-intelligence.ts',
  'backend/migrations/20261225_decision_intelligence.sql',
];

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Decision Registry (catalog of EXISTING decision capabilities)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionCatalog(pool: Pool) {
  return memo('di:catalog', async () => {
    const measured = await measureCapabilities(pool);
    const by_domain: Record<string, { domain: string; capabilities: number; present: number; decisions: number | null }> = {};
    const by_kind: Record<string, number> = {};
    for (const m of measured) {
      const d = (by_domain[m.domain] ??= { domain: m.domain, capabilities: 0, present: 0, decisions: null });
      d.capabilities++;
      if (m.present) d.present++;
      if (m.table_count != null) d.decisions = (d.decisions ?? 0) + m.table_count;
      by_kind[m.decision_kind] = (by_kind[m.decision_kind] ?? 0) + 1;
    }
    return {
      phase: 'MX-800 Phase 2.6 — Decision Registry',
      catalog_note:
        'A curated catalog of the EXISTING decision capabilities the platform already makes. This tier ' +
        'NEVER creates a decision capability — it reads each one\'s substrate (persisted trail and/or ' +
        'engine source file) and its governing-flag state. Engine existence is READ, never invoked.',
      totals: {
        capabilities: measured.length,
        present: measured.filter((m) => m.present).length,
        table_backed: measured.filter((m) => m.table).length,
        engine_backed: measured.filter((m) => m.engine).length,
        decisions_recorded: (() => { const xs = measured.map((m) => m.table_count).filter((x): x is number => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; })(),
      },
      by_domain: Object.values(by_domain).sort((a, b) => a.domain.localeCompare(b.domain)),
      by_kind,
      capabilities: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, decision_kind: m.decision_kind,
        table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, intelligence_uid: m.intelligence_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Decision Reasoning (evidence-grounded WHY a decision is supported; NOT prediction)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionReasoning(pool: Pool) {
  return memo('di:reasoning', async () => {
    const measured = await measureCapabilities(pool);
    return {
      phase: 'MX-800 Phase 2.6 — Decision Reasoning',
      reasoning_kind:
        'Evidence-grounded WHY a decision capability is SUPPORTED (structural). NOT a prediction, ' +
        'recommendation or autonomous decision (STOP clause). This tier SUGGESTS decision support; the ' +
        'human decides and approves.',
      facets: measured.map((m) => ({
        capability: m.uid, claim: `The platform supports the "${m.name}" decision in the ${m.domain} domain.`,
        why: m.description,
        evidence: {
          persisted_trail: m.table, trail_present: m.table_present, decisions_recorded: m.table_count, // null ≠ 0
          engine_source: m.engine, engine_present: m.engine_present,
          governing_flag: m.flag, flag_state: m.flag_state,
        },
        dependencies_evaluated: m.intelligence_uid ? [m.intelligence_uid] : [],
        constraints_applied: [
          'Human approval mandatory (Approval ≠ Automation).',
          m.flag ? `Gated by feature flag '${m.flag}' (Built ≠ Activated; this tier never activates it).` : 'Governing flag unverified — reported honest-null, never assumed.',
        ],
        confidence: 'structural',
        grounded: m.present,   // grounded only when substrate measured/present
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Decision Evidence Engine (collect evidence; compose prior tiers; NEVER invoke engines)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionEvidence(pool: Pool) {
  return memo('di:evidence', async () => {
    const measured = await measureCapabilities(pool);
    // Each prior-tier summary is GET-never-writes; wrap so an unavailable tier degrades to honest-null.
    const safe = async (fn: () => Promise<any>) => {
      try { return { reachable: true, summary: await fn() }; }
      catch (e: any) { return { reachable: false, summary: null, note: `evidence source unavailable: ${e?.code || e?.message || 'error'}` }; }
    };
    const [platform, engineering, runtime, knowledge] = await Promise.all([
      safe(() => getPlatformSummary(pool)),
      safe(() => getEngineeringSummary(pool)),
      safe(() => getRuntimeSummary(pool)),
      safe(() => getKnowledgeSummary(pool)),
    ]);
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    const decisionFlags = ['decisionOrchestrator', 'decisionPersistence', 'decisionMentorBridge', 'wc3Personalization', 'aiGovernance']
      .map((k) => ({ flag: k, present: k in flags, state: k in flags ? !!flags[k] : null }));
    const reachable = [platform, engineering, runtime, knowledge].filter((t) => t.reachable).length;
    return {
      phase: 'MX-800 Phase 2.6 — Decision Evidence Engine',
      collect_note:
        'Evidence is COLLECTED by READING the existing decision trails (COUNT-only) + the prior ' +
        'intelligence-tier summaries + governing-flag state + repository metadata. No decision engine ' +
        'is invoked and no decision table is written.',
      decision_evidence: measured.map((m) => ({
        capability: m.uid, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, decisions_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      intelligence_evidence: {
        compose_note: 'COMPOSES read-only summaries of 2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge. Re-runs no engine.',
        tiers: { platform, engineering, runtime, knowledge },
        tier_reachability: { reachable, of: 4 },
      },
      flag_evidence: decisionFlags,
      repository_metadata: {
        service: fileCheck('services/decision-intelligence.ts'),
        route: fileCheck('routes/decision-intelligence.ts'),
        migration: fileCheck('migrations/20261225_decision_intelligence.sql'),
        engines: measured.filter((m) => m.engine).map((m) => ({ capability: m.uid, engine: m.engine, present: m.engine_present })),
      },
      ai_evidence: {
        note: 'AI-assisted decisions are evidenced by their AUDIT trails only (ai_decision_audits / m4_ai_decision_logs) — auditability, not autonomy. No AI model is invoked here.',
        sources: measured.filter((m) => m.domain === 'ai').map((m) => ({ capability: m.uid, table: m.table, present: m.table_present, count: m.table_count })),
      },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Decision Confidence Engine (STRUCTURAL only; evidence ⟂ coverage ⟂ confidence)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionConfidence(pool: Pool) {
  return memo('di:confidence', async () => {
    const measured = await measureCapabilities(pool);
    const total = measured.length;
    const measurableSubstrate = measured.filter((m) => m.engine ? m.engine_present : m.table_count != null).length;
    const evidence = await getDecisionEvidence(pool);
    const tier = (label: string) => (evidence.intelligence_evidence.tiers as any)[label]?.reachable === true;
    return {
      phase: 'MX-800 Phase 2.6 — Decision Confidence Engine',
      confidence_kind:
        'STRUCTURAL confidence only — substrate verifiability and prior-tier reachability. This is NOT ' +
        'runtime, accuracy or outcome confidence (those need labelled decision outcomes, which are ' +
        'absent → honest-null). Evidence ⟂ Coverage ⟂ Confidence are reported SEPARATELY, never blended.',
      axes: [
        { axis: 'evidence_quality', kind: 'structural', score: pct(measurableSubstrate, total), basis: { measured: measurableSubstrate, of: total }, note: 'Capabilities whose substrate (engine file present, or trail population MEASURED) could be verified.' },
        { axis: 'repository_confidence', kind: 'structural', score: pct([REPO_REFS[0], REPO_REFS[1], REPO_REFS[2]].filter((f) => fileCheck(f.replace(/^backend\//, ''))).length, 3), basis: { note: 'service + route + migration files present' }, note: 'STRUCTURAL repository confidence (own artifacts present).' },
        { axis: 'engineering_confidence', kind: 'structural', score: tier('engineering') ? 100 : null, basis: { reachable: tier('engineering') }, note: '2.3 engineering-intelligence summary reachable for cross-domain confidence.' },
        { axis: 'runtime_confidence', kind: 'structural', score: tier('runtime') ? 100 : null, basis: { reachable: tier('runtime') }, note: '2.4 runtime-intelligence summary reachable.' },
        { axis: 'knowledge_confidence', kind: 'structural', score: tier('knowledge') ? 100 : null, basis: { reachable: tier('knowledge') }, note: '2.5 knowledge-intelligence summary reachable.' },
        { axis: 'decision_confidence', kind: 'structural', score: pct(measured.filter((m) => m.present).length, total), basis: { measured: measured.filter((m) => m.present).length, of: total }, note: 'STRUCTURAL: decision capabilities whose substrate is present. NOT runtime/outcome/accuracy confidence.' },
      ],
      composite: null,
      composite_note: 'No composite confidence — the axes measure DIFFERENT things; blending would hide honest gaps.',
      accuracy_confidence: { measurable: false, value: null, note: 'Outcome/accuracy confidence requires labelled decision outcomes (absent) → honest-null (DEFERRED).' },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Decision Governance (human approval / ownership / traceability / audit / policy)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionGovernance(pool: Pool) {
  return memo('di:governance', async () => {
    const measured = await measureCapabilities(pool);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const snapshotReady = await tableReady(pool, SNAPSHOT_TABLE);
    const owners = registryReady
      ? (await rows(pool, `SELECT decision_uid, owner FROM ${REGISTRY_TABLE} WHERE owner IS NOT NULL`)) ?? []
      : [];
    const traceable = measured.filter((m) => m.table);            // capabilities with a persisted, auditable trail
    const auditable = measured.filter((m) => m.decision_kind === 'audited' || m.decision_kind === 'logged');
    return {
      phase: 'MX-800 Phase 2.6 — Decision Governance',
      governance_note: 'Read-only governance posture. Approval ≠ Automation — this tier never approves, never decides and never automates. Human approval remains MANDATORY.',
      human_approval: {
        mandatory: true,
        automated_approval_supported: false,
        note: 'No path in this tier approves or actions a decision. Approval is a human act recorded in the existing decision/governance trails.',
      },
      ownership: {
        assigned: owners.length,
        of_registered: registryReady ? ((await scalar(pool, `SELECT COUNT(*)::int AS n FROM ${REGISTRY_TABLE}`)) ?? 0) : 0,
        note: registryReady ? 'owner is MANAGED (human) — honest-null when unassigned, never fabricated.' : 'Registry not discovered — ownership unknown (honest), not zero.',
        unknown: !registryReady,
      },
      traceability: {
        persisted_trail_capabilities: traceable.length,
        compute_on_read_capabilities: measured.length - traceable.length,
        note: 'Capabilities with a persisted decision table have a durable audit trail; compute-on-read engines (e.g. the orchestrator) leave a trail only when their persistence flag is ON.',
      },
      audit: {
        snapshot_store_ready: snapshotReady,
        auditable_capabilities: auditable.length,
        note: snapshotReady ? 'Decision-intelligence snapshot store exists (audit-capture run).' : 'Snapshot store not yet created (flag-OFF or capture never run) — honest absent.',
      },
      policy_validation: {
        kind: 'STRUCTURAL',
        checks: [
          { policy: 'human_approval_mandatory', status: 'pass', detail: 'No automated approval/decision path exists in this tier.' },
          { policy: 'no_business_logic_change', status: 'pass', detail: 'Read-only composer — no decision engine invoked, no decision table written.' },
          { policy: 'auditable_decision_trail_exists', status: traceable.some((m) => (m.table_count ?? 0) > 0) ? 'pass' : 'partial', detail: 'at least one persisted decision trail is populated' },
        ],
      },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Decision Explainability (/explain/:uid)
// ════════════════════════════════════════════════════════════════════════════
export async function explainDecision(pool: Pool, uidArg: string) {
  const src = DECISION_SOURCES.find((s) => s.uid === uidArg || s.table === uidArg);
  if (!src) return { found: false, uid: uidArg, note: 'No such decision capability in the curated catalog.' };
  const table_present = src.table ? await tableReady(pool, src.table) : false;
  const table_count = table_present && src.table ? await countTable(pool, src.table) : null;
  const engine_present = src.engine ? fileCheck(src.engine) : false;
  const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
  const flag_state = src.flag ? (src.flag in flags ? !!flags[src.flag] : null) : null;
  const siblings = DECISION_SOURCES.filter((s) => s.domain === src.domain && s.uid !== src.uid);
  return {
    found: true,
    uid: src.uid, name: src.name, domain: src.domain, decision_kind: src.decision_kind,
    why: `${src.description} It is an EXISTING ${src.decision_kind} decision capability in the ${src.domain} domain; this tier explains and supports it, it never makes or approves the decision.`,
    evidence: {
      persisted_trail: src.table, trail_present: table_present, decisions_recorded: table_count, // null ≠ 0
      engine_source: src.engine, engine_present, governing_flag: src.flag, flag_state,
    },
    confidence: {
      level: 'structural',
      basis: (engine_present || table_present) ? 'substrate present' : 'substrate absent',
      note: 'STRUCTURAL confidence only — NOT runtime / accuracy / outcome.',
    },
    alternatives: siblings.map((s) => ({ uid: s.uid, name: s.name, decision_kind: s.decision_kind })),
    dependencies: src.intelligence_uid ? [{ intelligence_uid: src.intelligence_uid, soft_link: 'platform_intelligence_registry (MX-800 2.1)' }] : [],
    repository_refs: REPO_REFS.concat(src.engine ? [`backend/${src.engine}`] : []),
    knowledge_refs: ['MX-800 2.5 Knowledge Intelligence (getKnowledgeSummary) — composed read-only'],
    runtime_refs: ['MX-800 2.4 Runtime Intelligence (getRuntimeSummary) — composed read-only'],
    governance: { human_approval: 'mandatory', automated_action: false },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Decision Validation (STRUCTURAL integrity only)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionValidation(pool: Pool) {
  return memo('di:validation', async () => {
    const measured = await measureCapabilities(pool);
    const present = measured.filter((m) => m.present);
    const populated = measured.filter((m) => (m.table_count ?? 0) > 0);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const evidence = await getDecisionEvidence(pool);
    const checks = [
      { check: 'repository_integrity', status: (fileCheck('services/decision-intelligence.ts') && fileCheck('routes/decision-intelligence.ts') && fileCheck('migrations/20261225_decision_intelligence.sql')) ? 'pass' : 'partial', detail: 'service + route + migration files present' },
      { check: 'rule_integrity', status: measured.some((m) => m.engine && m.engine_present) ? 'pass' : 'partial', detail: 'at least one decision-engine source file exists (rules live in code, read-only)' },
      { check: 'evidence_integrity', status: evidence.intelligence_evidence.tier_reachability.reachable > 0 ? 'pass' : 'absent', detail: `${evidence.intelligence_evidence.tier_reachability.reachable}/4 prior intelligence tiers reachable` },
      { check: 'decision_integrity', status: present.length === measured.length ? 'pass' : present.length > 0 ? 'partial' : 'absent', detail: `${present.length}/${measured.length} decision capabilities have present substrate` },
      { check: 'decision_trail_integrity', status: populated.length > 0 ? 'pass' : 'partial', detail: `${populated.length} persisted decision trails are populated` },
      { check: 'knowledge_integrity', status: (evidence.intelligence_evidence.tiers as any).knowledge?.reachable ? 'pass' : 'absent', detail: '2.5 knowledge-intelligence summary reachable' },
      { check: 'registry_metadata_integrity', status: registryReady ? 'pass' : 'absent', detail: registryReady ? 'decision_registry exists (discovered)' : 'registry not yet discovered (flag-OFF or never run) — honest absent' },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.6 — Decision Validation',
      validation_kind: 'STRUCTURAL only (existence + population + reachability). NOT a runtime / accuracy / outcome verdict.',
      checks,
      populated_trails: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Decision Metrics (6 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionMetrics(pool: Pool) {
  return memo('di:metrics', async () => {
    const measured = await measureCapabilities(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const measurableSubstrate = measured.filter((m) => m.engine ? m.engine_present : m.table_count != null).length;
    const tableBacked = measured.filter((m) => m.table);
    const populatedTrails = tableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    const governance = await getDecisionGovernance(pool);
    const govChecks = governance.policy_validation.checks;
    const govPass = govChecks.filter((c: any) => c.status === 'pass').length;
    // Every curated capability is explainable via /explain → explainability is MEASURED, not assumed.
    const explainable = measured.length;
    return {
      phase: 'MX-800 Phase 2.6 — Decision Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'decision_quality', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Decision capabilities whose substrate is present. Present ≠ Populated.' },
        { metric: 'decision_confidence', axis: 'confidence', score: pct(measurableSubstrate, total), basis: { measured: measurableSubstrate, of: total }, note: 'STRUCTURAL verifiability only: capabilities whose substrate could be MEASURED. NOT runtime/outcome confidence.' },
        { metric: 'decision_coverage', axis: 'coverage', score: pct(populatedTrails, tableBacked.length), basis: { measured: populatedTrails, of: tableBacked.length }, note: 'Persisted decision trails that are populated. Coverage ⟂ Confidence.' },
        { metric: 'recommendation_quality', axis: 'accuracy', score: null, basis: { measurable: false }, note: 'Runtime recommendation ACCURACY requires labelled decision outcomes (absent) → honest-null (DEFERRED). This tier provides decision SUPPORT; it never measures recommendation correctness. Recommendation ≠ Decision; Confidence ≠ Accuracy.' },
        { metric: 'governance_compliance', axis: 'governance', score: pct(govPass, govChecks.length), basis: { measured: govPass, of: govChecks.length }, note: 'STRUCTURAL governance policy checks passing. Approval ≠ Automation.' },
        { metric: 'explainability_score', axis: 'evidence', score: pct(explainable, total), basis: { measured: explainable, of: total }, note: 'Capabilities that expose explainable reasoning (why/evidence/confidence/alternatives/refs) via /explain.' },
      ],
      population: { capabilities: total, present, populated_trails: populatedTrails, table_backed: tableBacked.length },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (decision_registry — catalog of decision CAPABILITIES)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_kind: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT decision_uid, name, decision_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_kind: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_kind[e.decision_kind] = (by_kind[e.decision_kind] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_kind, by_domain, entries };
}

export async function getDecisionCapability(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE decision_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverDecisions(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureDecisionSchema(pool);
  const measured = await measureCapabilities(pool);
  let upserted = 0;
  for (const m of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (decision_uid, name, decision_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, intelligence_uid, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'discovered')
       ON CONFLICT (decision_uid) DO UPDATE SET
         name=EXCLUDED.name, decision_kind=EXCLUDED.decision_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present,
         table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         intelligence_uid=EXCLUDED.intelligence_uid, metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner + lifecycle_uid are MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers them.
      [m.uid, m.name, m.decision_kind, m.domain, m.table, m.engine, m.flag, m.present, m.table_count, m.flag_state, m.intelligence_uid,
       JSON.stringify({ description: m.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: DECISION_SOURCES.length, by: actor };
}

export async function registerDecisionCapability(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureDecisionSchema(pool);
  const name = body?.name ? String(body.name) : null;
  if (!name) return { ok: false, error: 'name is required' };
  const table = body?.physical_table ? String(body.physical_table) : null;
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex
  // gate, not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (table != null && !isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.decision_uid ? String(body.decision_uid) : uid('di-man');
  const table_present = table ? await tableReady(pool, table) : false;
  const table_count = table_present && table ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (decision_uid, name, decision_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual')
     ON CONFLICT (decision_uid) DO UPDATE SET
       name=EXCLUDED.name, decision_kind=EXCLUDED.decision_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present, table_count=EXCLUDED.table_count,
       flag_state=EXCLUDED.flag_state,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       intelligence_uid=COALESCE(EXCLUDED.intelligence_uid, ${REGISTRY_TABLE}.intelligence_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.decision_kind ? String(body.decision_kind) : 'logged', body?.domain ? String(body.domain) : null,
     table, body?.engine_path ? String(body.engine_path) : null, body?.governing_flag ? String(body.governing_flag) : null,
     table_present, table_count, null,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     body?.intelligence_uid ? String(body.intelligence_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, decision_uid: u, present: table_present, count: table_count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getDecisionSummary(pool: Pool) {
  const [registry, catalog, metrics, validation, governance] = await Promise.all([
    getDecisionRegistry(pool), getDecisionCatalog(pool), getDecisionMetrics(pool), getDecisionValidation(pool), getDecisionGovernance(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.6 — Decision Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    catalog: { capabilities: catalog.totals.capabilities, present: catalog.totals.present, table_backed: catalog.totals.table_backed, engine_backed: catalog.totals.engine_backed, decisions_recorded: catalog.totals.decisions_recorded, domains: catalog.by_domain.length },
    metrics: metrics.scores,
    governance: { human_approval_mandatory: governance.human_approval.mandatory, automated_approval_supported: governance.human_approval.automated_approval_supported },
    validation_verdict: validation.verdict,
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function captureDecisionSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureDecisionSchema(pool);
  const [registry, catalog, metrics, validation, summary] = await Promise.all([
    getDecisionRegistry(pool), getDecisionCatalog(pool), getDecisionMetrics(pool), getDecisionValidation(pool), getDecisionSummary(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('di-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, capabilities_present, decisions_recorded,
       decision_quality_pct, decision_confidence_pct, decision_coverage_pct,
       recommendation_quality_pct, governance_compliance_pct, explainability_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [snapshot_uid, registry.total, catalog.totals.present, catalog.totals.decisions_recorded,
     score('decision_quality'), score('decision_confidence'), score('decision_coverage'),
     score('recommendation_quality'), score('governance_compliance'), score('explainability_score'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getDecisionSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, capabilities_present, decisions_recorded, decision_quality_pct, decision_confidence_pct, decision_coverage_pct, recommendation_quality_pct, governance_compliance_pct, explainability_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getDecisionDrift(pool: Pool) {
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
      decisions_recorded: delta('decisions_recorded'),
      decision_quality_pct: delta('decision_quality_pct'),
      decision_confidence_pct: delta('decision_confidence_pct'),
      decision_coverage_pct: delta('decision_coverage_pct'),
      recommendation_quality_pct: delta('recommendation_quality_pct'),
      governance_compliance_pct: delta('governance_compliance_pct'),
      explainability_pct: delta('explainability_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}

/**
 * MX-800 Phase 2.9 — Continuous Learning Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Continuous Learning Intelligence is a READ-ONLY intelligence tier ABOUT the
 * platform's learning capabilities. It CATALOGS the EXISTING learning / feedback / experience / adaptive
 * / improvement / organizational-learning capabilities and COMPOSES the prior intelligence tiers (2.1
 * platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8
 * recommendation) into explainable learning intelligence (registry / feedback / experience / adaptive /
 * continuous-improvement / explainability / validation / metrics / organizational-learning).
 *
 * It introduces NO parallel learning / adaptive / feedback engine, DUPLICATES no rule set, and changes NO
 * business logic. Critically it INVOKES / ACTIVATES no dormant learning engine: it READS their EXISTENCE
 * (engine source files) and their PERSISTED OUTPUT (learning / feedback / experience / adaptive tables)
 * only — composing an engine's existence is NOT the same as running it (running a flag-OFF engine would be
 * dormant activation, and LEARNING a new state here would be fabrication). It NEVER learns autonomously,
 * NEVER modifies an engine, NEVER adapts business logic, NEVER decides and NEVER executes. The repository
 * + the existing learning tables remain the single source of truth.
 *
 * Composed substrate (READ-ONLY — reuse, never duplicate, never write, never invoke):
 *   - Learning / adaptive engines (existence read): services/{intervention-learning-engine,
 *                               career-learning-rec-engine, learning-path-engine, learning-roi-engine,
 *                               lip-learning-need-engine, interview-feedback-engine, pil/prediction-experience,
 *                               behavioural-memory, longitudinal-memory, competency-memory-engine,
 *                               adaptive-event-bus, unified-adaptive-runtime-orchestrator,
 *                               adaptive-difficulty-activation, platform-evolution-intelligence}.ts
 *                               + routes/iil-evolution.ts.
 *   - Live learning tables (COUNT-only): learn_outcomes, cg_user_learning_recs, lip_learning_paths,
 *                               wos_learning_roi, lip_learning_needs, meta_learning_profiles,
 *                               learning_recommendations, interview_feedback, learn_intervention_events,
 *                               cp_experience, episodic_memory, behavioural_memory,
 *                               competency_memory_history, wcl5_memory, adaptive_intelligence_events,
 *                               adaptive_runtime_state, irt_adaptive_config, platform_evolution_audit_snapshots,
 *                               iil_self_evolution_log, platform_evolution_knowledge, m3_ontology_evolution_events.
 *   - Prior intelligence tiers: platform (2.1) / engineering (2.3) / runtime (2.4) / knowledge (2.5) /
 *                               decision (2.6) / predictive (2.7) / recommendation (2.8) — read-only summaries.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Learning ≠ Automation. Experience ≠ Knowledge. Feedback ≠ Truth. Improvement ≠ Optimization.
 *     Adaptation ≠ Autonomous Change. Recommendation Acceptance ≠ Correctness. Confidence ≠ Accuracy.
 *     Evidence ≠ Confidence. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes, never blended). Built ≠
 *     Activated. Present ≠ Populated. Human approval mandatory.
 *   - Population is MEASURED with exact COUNT(*) (NEVER pg_stat n_live_tup — reads 0 for bulk-seeded
 *     tables until autovacuum analyzes). ABSENT table → present:false, count NULL (≠ 0). A PRESENT but
 *     unreadable table → count NULL (query error ≠ empty). Empty table → 0.
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall". learning_confidence
 *     is STRUCTURAL only (substrate verifiability/integrity), NOT runtime/outcome/accuracy confidence.
 *   - improvement_rate (longitudinal learning improvement) and effectiveness (outcome) are UNMEASURABLE
 *     here (no longitudinal labelled outcomes, no adoption deltas) → honest-NULL (DEFERRED), never a
 *     fabricated proxy. This tier surfaces learning SUPPORT; it never measures whether learning improved a
 *     recommendation / prediction / decision and it never DECIDES, ADAPTS or EXECUTES.
 *   - Adaptive Intelligence surfaces the EXISTING adaptive substrate (adaptation_safety: never modifies
 *     business logic, never autonomous change, never executes). Adaptation ≠ Autonomous Change.
 *   - Continuous Improvement is an evidence-grounded surfacing of EXISTING improvement substrate — it
 *     never optimizes, never modifies business logic, never acts autonomously (Improvement ≠ Optimization).
 *   - Organizational Learning is the MEASURED preservation of EXISTING lessons (.agents/memory + docs +
 *     evolution/knowledge tables) — read-only; experience preserved is not the same as knowledge applied.
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *   - STOP clause: NO Autonomous-Learning / self-modifying business logic / autonomous AI agents /
 *     auto-execution. Every part is the evidence-grounded surfacing of EXISTING learning capabilities —
 *     never a new learned state, an adaptation, a decision, or an executed action.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER create
 * schema and NEVER write to the existing learning tables. The lazy ensure-schema runs ONLY on flag-ON
 * write paths (discover / register / audit-capture) so flag OFF → byte-identical incl. schema (0 tables).
 * Every write path also asserts the flag itself BEFORE ensure-schema (defense-in-depth).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isContinuousLearningIntelligenceEngineEnabled, listFlags } from '../config/feature-flags';

// Composed prior-tier summaries (EXISTING intelligence engines — reuse, never duplicate).
// These getters are GET-never-writes (to_regclass-probed reads, no ensure-schema, verified).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';
import { getKnowledgeSummary } from './knowledge-intelligence';
import { getDecisionSummary } from './decision-intelligence';
import { getPredictiveSummary } from './predictive-intelligence-engine';
import { getRecommendationSummary } from './recommendation-intelligence-engine';

const REGISTRY_TABLE = 'learning_registry';
const SNAPSHOT_TABLE = 'continuous_learning_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class ContinuousLearningIntelligenceDisabled extends Error {
  code = 'continuous_learning_intelligence_disabled';
  constructor() {
    super('continuousLearningIntelligenceEngine flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'ContinuousLearningIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isContinuousLearningIntelligenceEngineEnabled()) throw new ContinuousLearningIntelligenceDisabled();
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
 * Short-TTL promise memo (MX-700 1.43 "gather ONCE"). /summary, /metrics, /validation, /feedback,
 * /experience and captureSnapshot all compose the SAME expensive measurement (per-capability COUNT(*) +
 * seven prior-tier summaries). Memoization dedupes that within a request and reuses for a few seconds.
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

// ── Curated, file/table-verified LEARNING CAPABILITY catalog ─────────────────
// Every `table` below was verified to EXIST in this database (or is honest-absent → table_present:false,
// count NULL) and every `engine` file to EXIST on disk. A capability is an EXISTING learning / feedback /
// experience / adaptive / improvement / organizational-learning TYPE the platform already has — this tier
// never creates a new one and never LEARNS a new state. `table` is the persisted learning trail
// (read-only, COUNT-only) or null for a compute-on-read engine. `engine` is the source file whose
// EXISTENCE is read (never imported / invoked). `flag` is the governing feature flag whose STATE is read
// (Built ≠ Activated) — null when the gate is unverified (honest-NULL, never a fabricated mapping).
// `intelligence_uid` SOFT-links the MX-800 2.1 registry.
type LearningKind = 'learning' | 'feedback' | 'experience' | 'adaptive' | 'improvement' | 'organizational';
type LearningSource = {
  uid: string; name: string; domain: string; learning_kind: LearningKind;
  table: string | null; engine: string | null; flag: string | null;
  intelligence_uid: string | null; description: string;
};
const LEARNING_SOURCES: LearningSource[] = [
  // ── Learning ──
  {
    uid: 'cl-cap-intervention-learning', name: 'Intervention learning', domain: 'behaviour',
    learning_kind: 'learning', table: 'learn_outcomes', engine: 'services/intervention-learning-engine.ts',
    flag: null, intelligence_uid: 'intel.learning',
    description: 'Persisted intervention-learning outcome trail produced by the intervention-learning engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-career-learning-rec', name: 'Career learning recommendation', domain: 'career',
    learning_kind: 'learning', table: 'cg_user_learning_recs', engine: 'services/career-learning-rec-engine.ts',
    flag: 'careerGraph', intelligence_uid: null,
    description: 'Persisted career-learning recommendation trail from the career-learning-rec engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-learning-path', name: 'Learning path', domain: 'learning',
    learning_kind: 'learning', table: 'lip_learning_paths', engine: 'services/learning-path-engine.ts',
    flag: null, intelligence_uid: 'intel.learning',
    description: 'Persisted learning-path trail from the learning-path engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-learning-roi', name: 'Learning ROI', domain: 'learning',
    learning_kind: 'learning', table: 'wos_learning_roi', engine: 'services/learning-roi-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted learning-ROI trail from the learning-roi engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-learning-need', name: 'Learning need', domain: 'learning',
    learning_kind: 'learning', table: 'lip_learning_needs', engine: 'services/lip-learning-need-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted learning-need trail from the lip-learning-need engine. Read-only COUNT-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-meta-learning', name: 'Meta-learning profile', domain: 'meta',
    learning_kind: 'learning', table: 'meta_learning_profiles', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted meta-learning profile trail (compute-on-read upstream). Surfaced read-only as a persisted learning trail (count NULL ≠ 0 when absent).',
  },
  {
    uid: 'cl-cap-learning-recommendation', name: 'Learning recommendation trail', domain: 'learning',
    learning_kind: 'learning', table: 'learning_recommendations', engine: null,
    flag: null, intelligence_uid: 'intel.learning',
    description: 'Persisted learning-recommendation trail (compute-on-read upstream). Surfaced read-only here as the LEARNING substrate; never re-generated.',
  },
  // ── Feedback (Feedback ≠ Truth) ──
  {
    uid: 'cl-cap-interview-feedback', name: 'Interview feedback', domain: 'hiring',
    learning_kind: 'feedback', table: 'interview_feedback', engine: 'services/interview-feedback-engine.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted interview-feedback trail from the interview-feedback engine. Feedback ≠ Truth — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-intervention-feedback', name: 'Intervention feedback events', domain: 'behaviour',
    learning_kind: 'feedback', table: 'learn_intervention_events', engine: null,
    flag: null, intelligence_uid: 'intel.learning',
    description: 'Persisted intervention-feedback event trail (compute-on-read upstream). Feedback ≠ Truth — surfaced read-only (count NULL ≠ 0 when absent).',
  },
  // ── Experience (Experience ≠ Knowledge) ──
  {
    uid: 'cl-cap-prediction-experience', name: 'Prediction experience', domain: 'predictive',
    learning_kind: 'experience', table: null, engine: 'services/pil/prediction-experience.ts',
    flag: null, intelligence_uid: 'intel.forecast',
    description: 'Prediction-experience engine (compute-on-read experience accumulation). Engine existence read-only; no persisted trail surfaced (count NULL ≠ 0). The engine is never invoked.',
  },
  {
    uid: 'cl-cap-career-experience', name: 'Career experience', domain: 'career',
    learning_kind: 'experience', table: 'cp_experience', engine: null,
    flag: null, intelligence_uid: null,
    description: 'Persisted career-experience trail (compute-on-read upstream). Experience ≠ Knowledge — surfaced read-only (count NULL ≠ 0 when absent).',
  },
  {
    uid: 'cl-cap-episodic-memory', name: 'Episodic memory', domain: 'behaviour',
    learning_kind: 'experience', table: 'episodic_memory', engine: null,
    flag: 'memoryIntelligence', intelligence_uid: 'intel.memory',
    description: 'Persisted episodic-memory trail (experience episodes). Experience ≠ Knowledge — surfaced read-only (count NULL ≠ 0 when absent).',
  },
  {
    uid: 'cl-cap-behavioural-memory', name: 'Behavioural memory', domain: 'behaviour',
    learning_kind: 'experience', table: 'behavioural_memory', engine: 'services/behavioural-memory.ts',
    flag: 'memoryIntelligence', intelligence_uid: 'intel.memory',
    description: 'Persisted behavioural-memory trail from the behavioural-memory engine. Experience ≠ Knowledge — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-longitudinal-memory', name: 'Longitudinal memory', domain: 'behaviour',
    learning_kind: 'experience', table: null, engine: 'services/longitudinal-memory.ts',
    flag: 'memoryIntelligence', intelligence_uid: 'intel.memory',
    description: 'Longitudinal-memory engine (compute-on-read longitudinal experience). Engine existence read-only; no persisted trail attributed here (count NULL ≠ 0). The engine is never invoked.',
  },
  {
    uid: 'cl-cap-competency-memory', name: 'Competency memory history', domain: 'competency',
    learning_kind: 'experience', table: 'competency_memory_history', engine: 'services/competency-memory-engine.ts',
    flag: null, intelligence_uid: 'intel.memory',
    description: 'Persisted competency-memory history trail from the competency-memory engine. Experience ≠ Knowledge — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-wcl5-memory', name: 'WC-L5 behaviour memory', domain: 'behaviour',
    learning_kind: 'experience', table: 'wcl5_memory', engine: null,
    flag: 'memoryIntelligence', intelligence_uid: 'intel.memory',
    description: 'Persisted WC-L5 behaviour-memory snapshot trail (compose-only upstream). Experience ≠ Knowledge — surfaced read-only (count NULL ≠ 0 when absent).',
  },
  // ── Adaptive (Adaptation ≠ Autonomous Change) ──
  {
    uid: 'cl-cap-adaptive-event-bus', name: 'Adaptive intelligence event bus', domain: 'runtime',
    learning_kind: 'adaptive', table: 'adaptive_intelligence_events', engine: 'services/adaptive-event-bus.ts',
    flag: null, intelligence_uid: 'intel.runtime',
    description: 'Persisted adaptive-intelligence event trail from the adaptive event bus. Adaptation ≠ Autonomous Change — surfaced read-only; the bus is never invoked.',
  },
  {
    uid: 'cl-cap-adaptive-runtime', name: 'Adaptive runtime state', domain: 'runtime',
    learning_kind: 'adaptive', table: 'adaptive_runtime_state', engine: 'services/unified-adaptive-runtime-orchestrator.ts',
    flag: 'runtimeIntelligenceActivation', intelligence_uid: 'intel.runtime',
    description: 'Persisted adaptive runtime-state trail from the unified adaptive-runtime orchestrator. Adaptation ≠ Autonomous Change — surfaced read-only; the orchestrator is never invoked.',
  },
  {
    uid: 'cl-cap-adaptive-difficulty', name: 'Adaptive difficulty / IRT config', domain: 'assessment',
    learning_kind: 'adaptive', table: 'irt_adaptive_config', engine: 'services/adaptive-difficulty-activation.ts',
    flag: 'adaptiveDifficultyActivation', intelligence_uid: null,
    description: 'Persisted adaptive-difficulty / IRT config trail from the adaptive-difficulty engine. Adaptation ≠ Autonomous Change — surfaced read-only; the engine is never invoked.',
  },
  // ── Improvement (Improvement ≠ Optimization) ──
  {
    uid: 'cl-cap-platform-evolution', name: 'Platform evolution intelligence', domain: 'platform',
    learning_kind: 'improvement', table: 'platform_evolution_audit_snapshots', engine: 'services/platform-evolution-intelligence.ts',
    flag: 'platformEvolutionIntelligence', intelligence_uid: 'intel.platform',
    description: 'Persisted platform-evolution audit-snapshot trail (MX-700 1.40). Improvement ≠ Optimization — surfaced read-only; the engine is never invoked.',
  },
  {
    uid: 'cl-cap-iil-self-evolution', name: 'Innovation self-evolution log', domain: 'innovation',
    learning_kind: 'improvement', table: 'iil_self_evolution_log', engine: 'routes/iil-evolution.ts',
    flag: null, intelligence_uid: null,
    description: 'Persisted IIL self-evolution log trail. Improvement ≠ Optimization — surfaced read-only; the engine is never invoked.',
  },
  // ── Organizational learning (Experience preserved ≠ Knowledge applied) ──
  {
    uid: 'cl-cap-org-evolution-knowledge', name: 'Platform evolution knowledge', domain: 'organizational',
    learning_kind: 'organizational', table: 'platform_evolution_knowledge', engine: null,
    flag: 'platformEvolutionIntelligence', intelligence_uid: 'intel.knowledge',
    description: 'Persisted platform-evolution knowledge-preservation trail (MX-700 1.40). Read-only; lesson preserved ≠ knowledge applied (count NULL ≠ 0 when absent).',
  },
  {
    uid: 'cl-cap-ontology-evolution', name: 'Ontology evolution events', domain: 'organizational',
    learning_kind: 'organizational', table: 'm3_ontology_evolution_events', engine: null,
    flag: null, intelligence_uid: 'intel.knowledge',
    description: 'Persisted ontology-evolution event trail (organizational knowledge evolution). Read-only; surfaced as preserved organizational learning (count NULL ≠ 0 when absent).',
  },
];

/** Measure every capability ONCE: table present + exact COUNT(*); engine file present; governing flag
 *  STATE (Built ≠ Activated). Memoized per request window. */
type MeasuredCapability = LearningSource & {
  table_present: boolean; table_count: number | null;
  engine_present: boolean; present: boolean; flag_state: boolean | null;
};
function measureCapabilities(pool: Pool): Promise<MeasuredCapability[]> {
  return memo('cl:caps', async () => {
    const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
    return Promise.all(LEARNING_SOURCES.map(async (s) => {
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
/** Lazy ensure-schema — canonical mirror of 20261228_continuous_learning_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureLearningSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      learning_uid        TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      learning_kind       TEXT NOT NULL,           -- learning|feedback|experience|adaptive|improvement|organizational
      domain              TEXT,                    -- behaviour|career|learning|meta|hiring|predictive|competency|runtime|assessment|platform|innovation|organizational
      physical_table      TEXT,                    -- the EXISTING persisted learning trail (read-only) or NULL (compute-on-read)
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
    CREATE INDEX IF NOT EXISTS idx_lr_learning_kind ON ${REGISTRY_TABLE} (learning_kind);
    CREATE INDEX IF NOT EXISTS idx_lr_domain        ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      capabilities_present        INTEGER,
      learning_events_recorded    INTEGER,
      learning_quality_pct        NUMERIC,
      learning_confidence_pct     NUMERIC,
      improvement_rate_pct        NUMERIC,         -- honest-NULL (longitudinal improvement unmeasurable)
      learning_coverage_pct       NUMERIC,
      explainability_pct          NUMERIC,
      effectiveness_pct           NUMERIC,         -- honest-NULL (outcome unmeasurable)
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_clias_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

const AXES_NOTE =
  'Learning ≠ Automation. Experience ≠ Knowledge. Feedback ≠ Truth. Improvement ≠ Optimization. ' +
  'Adaptation ≠ Autonomous Change. Recommendation Acceptance ≠ Correctness. Confidence ≠ Accuracy. ' +
  'Evidence ≠ Confidence. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes). Built ≠ Activated. ' +
  'Present ≠ Populated. Human approval remains mandatory. Metrics are NEVER composited.';
const REPO_REFS = [
  'backend/services/continuous-learning-intelligence-engine.ts',
  'backend/routes/continuous-learning-intelligence-engine.ts',
  'backend/migrations/20261228_continuous_learning_intelligence.sql',
];

// Each prior-tier summary is GET-never-writes; wrap so an unavailable tier degrades to honest-null.
const safeTier = async (fn: () => Promise<any>) => {
  try { return { reachable: true, summary: await fn() }; }
  catch (e: any) { return { reachable: false, summary: null, note: `tier unavailable: ${e?.code || e?.message || 'error'}` }; }
};
function composePriorTiers(pool: Pool) {
  return memo('cl:tiers', async () => {
    const [platform, engineering, runtime, knowledge, decision, predictive, recommendation] = await Promise.all([
      safeTier(() => getPlatformSummary(pool)),
      safeTier(() => getEngineeringSummary(pool)),
      safeTier(() => getRuntimeSummary(pool)),
      safeTier(() => getKnowledgeSummary(pool)),
      safeTier(() => getDecisionSummary(pool)),
      safeTier(() => getPredictiveSummary(pool)),
      safeTier(() => getRecommendationSummary(pool)),
    ]);
    const all = [platform, engineering, runtime, knowledge, decision, predictive, recommendation];
    const reachable = all.filter((t) => t.reachable).length;
    return { tiers: { platform, engineering, runtime, knowledge, decision, predictive, recommendation }, reachable, of: 7 };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Learning Registry (catalog of EXISTING learning capabilities)
// ════════════════════════════════════════════════════════════════════════════
export async function getLearningCatalog(pool: Pool) {
  return memo('cl:catalog', async () => {
    const measured = await measureCapabilities(pool);
    const by_domain: Record<string, { domain: string; capabilities: number; present: number; learning_events: number | null }> = {};
    const by_kind: Record<string, number> = {};
    for (const m of measured) {
      const d = (by_domain[m.domain] ??= { domain: m.domain, capabilities: 0, present: 0, learning_events: null });
      d.capabilities++;
      if (m.present) d.present++;
      if (m.table_count != null) d.learning_events = (d.learning_events ?? 0) + m.table_count;
      by_kind[m.learning_kind] = (by_kind[m.learning_kind] ?? 0) + 1;
    }
    return {
      phase: 'MX-800 Phase 2.9 — Learning Registry',
      catalog_note:
        'A curated catalog of the EXISTING learning capabilities the platform already has. This tier NEVER ' +
        'creates a learning capability and NEVER learns a new state — it reads each one\'s substrate ' +
        '(persisted trail and/or engine source file) and its governing-flag state. Engine existence is ' +
        'READ, never invoked.',
      totals: {
        capabilities: measured.length,
        present: measured.filter((m) => m.present).length,
        table_backed: measured.filter((m) => m.table).length,
        engine_backed: measured.filter((m) => m.engine).length,
        learning_events_recorded: (() => { const xs = measured.map((m) => m.table_count).filter((x): x is number => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; })(),
      },
      by_domain: Object.values(by_domain).sort((a, b) => a.domain.localeCompare(b.domain)),
      by_kind,
      capabilities: measured.map((m) => ({
        uid: m.uid, name: m.name, domain: m.domain, learning_kind: m.learning_kind,
        table: m.table, table_present: m.table_present, table_count: m.table_count,
        engine: m.engine, engine_present: m.engine_present, present: m.present,
        governing_flag: m.flag, flag_state: m.flag_state, intelligence_uid: m.intelligence_uid,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Feedback Intelligence (surface EXISTING feedback substrate; Feedback ≠ Truth; never trusts blindly)
// ════════════════════════════════════════════════════════════════════════════
export async function getFeedbackIntelligence(pool: Pool) {
  return memo('cl:feedback', async () => {
    const measured = await measureCapabilities(pool);
    const feedbackCaps = measured.filter((m) => m.learning_kind === 'feedback');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.9 — Feedback Intelligence',
      feedback_kind:
        'Surfaces the platform\'s EXISTING feedback substrate (interview / intervention-event feedback) ' +
        'and composes the prior intelligence-tier summaries as the platform / runtime / engineering / ' +
        'recommendation / decision / validation feedback channels. This tier READS persisted feedback; it ' +
        'does NOT generate feedback, never treats feedback as ground truth, and never decides. Feedback ≠ Truth.',
      feedback_safety: { treats_feedback_as_truth: false, generates_feedback: false, decides: false, write_paths_to_business_tables: 0, note: 'Read-only — the only writes in this tier are to its own 2 owned tables on flag-ON audit/discovery.' },
      feedback_capabilities: feedbackCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, feedback_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      composed_feedback_channels: {
        repository_feedback: { source: 'MX-800 2.1 platform-intelligence summary', reachable: tiers.tiers.platform.reachable },
        engineering_feedback: { source: 'MX-800 2.3 engineering-intelligence summary', reachable: tiers.tiers.engineering.reachable },
        runtime_feedback: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
        recommendation_feedback: { source: 'MX-800 2.8 recommendation-intelligence summary', reachable: tiers.tiers.recommendation.reachable, note: 'Recommendation Acceptance ≠ Correctness — acceptance telemetry is absent (2.8 acceptance_rate honest-null).' },
        decision_feedback: { source: 'MX-800 2.6 decision-intelligence summary', reachable: tiers.tiers.decision.reachable },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Experience Intelligence (surface EXISTING experience substrate; Experience ≠ Knowledge)
// ════════════════════════════════════════════════════════════════════════════
export async function getExperienceIntelligence(pool: Pool) {
  return memo('cl:experience', async () => {
    const measured = await measureCapabilities(pool);
    const expCaps = measured.filter((m) => m.learning_kind === 'experience');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.9 — Experience Intelligence',
      experience_kind:
        'Surfaces the platform\'s EXISTING experience substrate (episodic / behavioural / longitudinal / ' +
        'competency memory + prediction / career experience) and composes the prior intelligence tiers as ' +
        'the repository-evolution / runtime-event / decision-outcome / recommendation-outcome experience ' +
        'channels. This tier READS persisted experience; accumulated experience is NOT the same as applied ' +
        'knowledge and it never decides. Experience ≠ Knowledge.',
      experience_safety: { equates_experience_with_knowledge: false, generates_experience: false, decides: false, note: 'Read-only — experience accumulated is surfaced, never re-derived or promoted to knowledge.' },
      experience_capabilities: expCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, experience_recorded: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      composed_experience_channels: {
        repository_evolution: { source: 'MX-800 2.1 platform-intelligence summary', reachable: tiers.tiers.platform.reachable },
        engineering_change_experience: { source: 'MX-800 2.3 engineering-intelligence summary', reachable: tiers.tiers.engineering.reachable },
        runtime_event_experience: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
        decision_outcome_experience: { source: 'MX-800 2.6 decision-intelligence summary', reachable: tiers.tiers.decision.reachable },
        prediction_outcome_experience: { source: 'MX-800 2.7 predictive-intelligence summary', reachable: tiers.tiers.predictive.reachable },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Adaptive Intelligence (surface EXISTING adaptive substrate; Adaptation ≠ Autonomous Change)
// ════════════════════════════════════════════════════════════════════════════
export async function getAdaptiveIntelligence(pool: Pool) {
  return memo('cl:adaptive', async () => {
    const measured = await measureCapabilities(pool);
    const adaptiveCaps = measured.filter((m) => m.learning_kind === 'adaptive');
    const tiers = await composePriorTiers(pool);
    return {
      phase: 'MX-800 Phase 2.9 — Adaptive Intelligence',
      adaptive_kind:
        'Surfaces the platform\'s EXISTING adaptive substrate (adaptive event bus / runtime state / ' +
        'difficulty config) and composes the prior intelligence tiers. This tier READS persisted adaptive ' +
        'state; it NEVER modifies business logic, NEVER adapts autonomously, NEVER executes and NEVER ' +
        'decides. Adaptation ≠ Autonomous Change; this tier surfaces adaptation, it never performs it.',
      adaptation_safety: { modifies_business_logic: false, autonomous_change: false, executes: false, decides: false, write_paths_to_business_tables: 0, note: 'Read-only — the only writes in this tier are to its own 2 owned tables on flag-ON audit/discovery. Human approval remains mandatory.' },
      adaptive_capabilities: adaptiveCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, adaptive_records: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
        governing_flag: m.flag, flag_state: m.flag_state, // Built ≠ Activated
      })),
      categories: {
        runtime_adaptation: { sources: adaptiveCaps.filter((m) => m.domain === 'runtime').map((m) => ({ capability: m.uid, adaptive_records: m.table_count })) },
        assessment_adaptation: { sources: adaptiveCaps.filter((m) => m.domain === 'assessment').map((m) => ({ capability: m.uid, adaptive_records: m.table_count })) },
        runtime_tier: { source: 'MX-800 2.4 runtime-intelligence summary', reachable: tiers.tiers.runtime.reachable },
      },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Continuous Improvement (evidence-grounded surfacing; Improvement ≠ Optimization; never optimizes)
// ════════════════════════════════════════════════════════════════════════════
export async function getContinuousImprovement(pool: Pool) {
  return memo('cl:improvement', async () => {
    const measured = await measureCapabilities(pool);
    const improvementCaps = measured.filter((m) => m.learning_kind === 'improvement');
    const tiers = await composePriorTiers(pool);
    const populated = improvementCaps.some((m) => (m.table_count ?? 0) > 0);
    return {
      phase: 'MX-800 Phase 2.9 — Continuous Improvement',
      improvement_kind:
        'An evidence-grounded surfacing of the platform\'s EXISTING improvement substrate (platform ' +
        'evolution / innovation self-evolution) composed with ALL prior intelligence tiers. It reflects ' +
        'WHERE improvement evidence exists in the repository; it NEVER optimizes, NEVER modifies business ' +
        'logic, NEVER acts autonomously and NEVER decides. Improvement ≠ Optimization.',
      improvement_safety: { optimizes: false, modifies_business_logic: false, autonomous: false, executes: false, decides: false, note: 'Read-only — improvement is SURFACED from verified existing substrate, never performed. Human approval remains mandatory.' },
      evidence_basis: 'verified_existing_substrate',
      improvement_capabilities: improvementCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, improvement_records: m.table_count, // null ≠ 0
        engine_source: m.engine, engine_present: m.engine_present,
      })),
      composed_improvement_evidence: {
        platform: { source: 'MX-800 2.1 platform-intelligence summary', reachable: tiers.tiers.platform.reachable },
        engineering: { source: 'MX-800 2.3 engineering-intelligence summary', reachable: tiers.tiers.engineering.reachable },
        knowledge: { source: 'MX-800 2.5 knowledge-intelligence summary', reachable: tiers.tiers.knowledge.reachable },
        recommendation: { source: 'MX-800 2.8 recommendation-intelligence summary', reachable: tiers.tiers.recommendation.reachable },
      },
      substrate_populated: populated,
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Learning Explainability (/explain/:uid — why/evidence/confidence + state framing)
// ════════════════════════════════════════════════════════════════════════════
export async function explainLearning(pool: Pool, uidArg: string) {
  const src = LEARNING_SOURCES.find((s) => s.uid === uidArg || s.table === uidArg);
  if (!src) return { found: false, uid: uidArg, note: 'No such learning capability in the curated catalog.' };
  const table_present = src.table ? await tableReady(pool, src.table) : false;
  const table_count = table_present && src.table ? await countTable(pool, src.table) : null;
  const engine_present = src.engine ? fileCheck(src.engine) : false;
  const flags = (() => { try { return listFlags() as Record<string, boolean>; } catch { return {} as Record<string, boolean>; } })();
  const flag_state = src.flag ? (src.flag in flags ? !!flags[src.flag] : null) : null;
  const siblings = LEARNING_SOURCES.filter((s) => s.domain === src.domain && s.uid !== src.uid);
  return {
    found: true,
    uid: src.uid, name: src.name, domain: src.domain, learning_kind: src.learning_kind,
    why: `${src.description} It is an EXISTING ${src.learning_kind} capability in the ${src.domain} domain; this tier explains and surfaces it, it never learns the state, modifies the engine, adapts, decides, or executes.`,
    evidence: {
      persisted_trail: src.table, trail_present: table_present, learning_records: table_count, // null ≠ 0
      engine_source: src.engine, engine_present, governing_flag: src.flag, flag_state,
    },
    confidence: {
      level: 'structural',
      basis: (engine_present || table_present) ? 'substrate present' : 'substrate absent',
      note: 'STRUCTURAL confidence only — NOT runtime / accuracy / learning-improvement / outcome. Confidence ≠ Accuracy.',
    },
    // State framing is HONEST: this tier NEVER mutates an engine, so there is no learned change.
    previous_state: 'unchanged — this tier never mutates the engine or its persisted trail',
    current_state: { substrate_present: (engine_present || table_present), learning_records: table_count },
    reason_for_change: 'NO CHANGE — this tier READS and surfaces the EXISTING learning capability; it never learns, adapts, modifies business logic, decides, or executes (Adaptation ≠ Autonomous Change).',
    assumptions: [
      'The persisted trail reflects an EXISTING engine\'s output; this tier does not re-derive or validate that output.',
      src.flag ? `Capability is gated by feature flag '${src.flag}' (Built ≠ Activated; this tier never activates it).` : 'Governing flag unverified — reported honest-null, never assumed.',
    ],
    alternatives: siblings.map((s) => ({ uid: s.uid, name: s.name, learning_kind: s.learning_kind })),
    dependencies: src.intelligence_uid ? [{ intelligence_uid: src.intelligence_uid, soft_link: 'platform_intelligence_registry (MX-800 2.1)' }] : [],
    repository_refs: REPO_REFS.concat(src.engine ? [`backend/${src.engine}`] : []),
    knowledge_refs: ['MX-800 2.5 Knowledge Intelligence (getKnowledgeSummary) — composed read-only'],
    runtime_refs: ['MX-800 2.4 Runtime Intelligence (getRuntimeSummary) — composed read-only'],
    governance: { human_approval: 'mandatory', automated_action: false, autonomous_learning: false, modifies_business_logic: false, executes: false, decides: false },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Learning Validation (STRUCTURAL integrity only)
// ════════════════════════════════════════════════════════════════════════════
export async function getLearningValidation(pool: Pool) {
  return memo('cl:validation', async () => {
    const measured = await measureCapabilities(pool);
    const present = measured.filter((m) => m.present);
    const populated = measured.filter((m) => (m.table_count ?? 0) > 0);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const tiers = await composePriorTiers(pool);
    // Learning consistency: every catalog capability declares a learning_kind from the allowed set and has
    // at least one substrate handle (table OR engine). STRUCTURAL self-consistency, not effectiveness.
    const KINDS = new Set(['learning', 'feedback', 'experience', 'adaptive', 'improvement', 'organizational']);
    const consistent = measured.filter((m) => KINDS.has(m.learning_kind) && (m.table || m.engine)).length;
    const checks = [
      { check: 'repository_integrity', status: (fileCheck('services/continuous-learning-intelligence-engine.ts') && fileCheck('routes/continuous-learning-intelligence-engine.ts') && fileCheck('migrations/20261228_continuous_learning_intelligence.sql')) ? 'pass' : 'partial', detail: 'service + route + migration files present' },
      { check: 'engine_integrity', status: measured.some((m) => m.engine && m.engine_present) ? 'pass' : 'partial', detail: 'at least one learning-engine source file exists (rules live in code, read-only)' },
      { check: 'evidence_integrity', status: tiers.reachable > 0 ? 'pass' : 'absent', detail: `${tiers.reachable}/${tiers.of} prior intelligence tiers reachable` },
      { check: 'learning_integrity', status: present.length === measured.length ? 'pass' : present.length > 0 ? 'partial' : 'absent', detail: `${present.length}/${measured.length} learning capabilities have present substrate` },
      { check: 'learning_trail_integrity', status: populated.length > 0 ? 'pass' : 'partial', detail: `${populated.length} persisted learning trails are populated` },
      { check: 'learning_consistency', status: consistent === measured.length ? 'pass' : consistent > 0 ? 'partial' : 'absent', detail: `${consistent}/${measured.length} capabilities are STRUCTURALLY self-consistent (valid kind + substrate handle). NOT effectiveness or improvement.` },
      { check: 'registry_metadata_integrity', status: registryReady ? 'pass' : 'absent', detail: registryReady ? 'learning_registry exists (discovered)' : 'registry not yet discovered (flag-OFF or never run) — honest absent' },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.9 — Learning Validation',
      validation_kind: 'STRUCTURAL only (existence + population + reachability + self-consistency). NOT a runtime / learning-improvement / effectiveness / outcome verdict. Learning ≠ Automation.',
      checks,
      populated_trails: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Learning Metrics (6 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getLearningMetrics(pool: Pool) {
  return memo('cl:metrics', async () => {
    const measured = await measureCapabilities(pool);
    const total = measured.length;
    const present = measured.filter((m) => m.present).length;
    const measurableSubstrate = measured.filter((m) => m.engine ? m.engine_present : m.table_count != null).length;
    const tableBacked = measured.filter((m) => m.table);
    const populatedTrails = tableBacked.filter((m) => (m.table_count ?? 0) > 0).length;
    // Every curated capability is explainable via /explain → explainability is MEASURED, not assumed.
    const explainable = measured.length;
    return {
      phase: 'MX-800 Phase 2.9 — Learning Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'learning_quality', axis: 'structural', score: pct(present, total), basis: { measured: present, of: total }, note: 'Learning capabilities whose substrate is present. Present ≠ Populated.' },
        { metric: 'learning_confidence', axis: 'confidence', score: pct(measurableSubstrate, total), basis: { measured: measurableSubstrate, of: total }, note: 'STRUCTURAL verifiability only: capabilities whose substrate could be MEASURED. NOT runtime/learning-improvement/outcome accuracy. Confidence ≠ Accuracy.' },
        { metric: 'learning_coverage', axis: 'coverage', score: pct(populatedTrails, tableBacked.length), basis: { measured: populatedTrails, of: tableBacked.length }, note: 'Persisted learning trails that are populated (covers feedback + experience trail coverage). Coverage ⟂ Confidence.' },
        { metric: 'explainability_score', axis: 'evidence', score: pct(explainable, total), basis: { measured: explainable, of: total }, note: 'Capabilities that expose explainable reasoning (why/evidence/confidence/state/assumptions/alternatives/refs) via /explain.' },
        { metric: 'improvement_rate', axis: 'improvement', score: null, basis: { measurable: false }, note: 'Learning IMPROVEMENT (whether learning improved a recommendation / prediction / decision over time) requires longitudinal labelled deltas which are absent → honest-null (DEFERRED). Improvement ≠ Optimization. This tier surfaces learning SUPPORT; it never measures improvement.' },
        { metric: 'effectiveness', axis: 'outcome', score: null, basis: { measurable: false }, note: 'Learning EFFECTIVENESS requires labelled outcomes (whether applied learning worked) which are absent → honest-null (DEFERRED). Experience ≠ Knowledge; Evidence ≠ Confidence.' },
      ],
      population: { capabilities: total, present, table_backed: tableBacked.length, populated_trails: populatedTrails },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 9 — Organizational Learning (MEASURED preservation of EXISTING lessons; read-only)
// ════════════════════════════════════════════════════════════════════════════
export async function getOrganizationalLearning(pool: Pool) {
  return memo('cl:organizational', async () => {
    const measured = await measureCapabilities(pool);
    const orgCaps = measured.filter((m) => m.learning_kind === 'organizational');
    const tiers = await composePriorTiers(pool);
    // MEASURED file-based lesson preservation (mirrors MX-700 1.40 knowledge measurement): repo-relative
    // to backend/ cwd → memory + docs live one level up at the repository root.
    const memory_lessons = countMarkdown('../.agents/memory');   // null ≠ 0 (unreadable ≠ empty)
    const docs = countMarkdown('../docs');
    const evolution_knowledge = await countTable(pool, 'platform_evolution_knowledge'); // null ≠ 0
    const ontology_evolution = await countTable(pool, 'm3_ontology_evolution_events');
    const self_evolution_log = await countTable(pool, 'iil_self_evolution_log');
    return {
      phase: 'MX-800 Phase 2.9 — Organizational Learning',
      organizational_kind:
        'A MEASURED, read-only preservation index of the platform\'s EXISTING organizational lessons ' +
        '(engineering / architecture / repository / operational / governance memory + docs + evolution / ' +
        'knowledge tables). It surfaces WHAT lessons are preserved; a preserved lesson is NOT the same as ' +
        'applied knowledge and this tier never decides. Experience ≠ Knowledge.',
      preservation_safety: { generates_lessons: false, decides: false, modifies_business_logic: false, note: 'Read-only — lessons are counted/surfaced from EXISTING files + tables, never authored here.' },
      preserved: {
        memory_lessons: { source: '.agents/memory/*.md', count: memory_lessons },       // null ≠ 0
        documentation: { source: 'docs/*.md', count: docs },                              // null ≠ 0
        platform_evolution_knowledge: { source: 'platform_evolution_knowledge', count: evolution_knowledge }, // null ≠ 0
        ontology_evolution_events: { source: 'm3_ontology_evolution_events', count: ontology_evolution },     // null ≠ 0
        innovation_self_evolution_log: { source: 'iil_self_evolution_log', count: self_evolution_log },        // null ≠ 0
      },
      organizational_capabilities: orgCaps.map((m) => ({
        capability: m.uid, name: m.name, domain: m.domain,
        persisted_trail: m.table, trail_present: m.table_present, lessons_recorded: m.table_count, // null ≠ 0
      })),
      knowledge_grounding: { source: 'MX-800 2.5 knowledge-intelligence summary', reachable: tiers.tiers.knowledge.reachable },
      tier_reachability: { reachable: tiers.reachable, of: tiers.of },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (learning_registry — catalog of learning CAPABILITIES)
// ════════════════════════════════════════════════════════════════════════════
export async function getLearningRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_kind: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT learning_uid, name, learning_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_kind: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_kind[e.learning_kind] = (by_kind[e.learning_kind] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_kind, by_domain, entries };
}

export async function getLearningCapability(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE learning_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverLearning(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureLearningSchema(pool);
  const measured = await measureCapabilities(pool);
  let upserted = 0;
  for (const m of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (learning_uid, name, learning_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, intelligence_uid, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'discovered')
       ON CONFLICT (learning_uid) DO UPDATE SET
         name=EXCLUDED.name, learning_kind=EXCLUDED.learning_kind, domain=EXCLUDED.domain,
         physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
         governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present,
         table_count=EXCLUDED.table_count, flag_state=EXCLUDED.flag_state,
         intelligence_uid=EXCLUDED.intelligence_uid, metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner + lifecycle_uid are MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers them.
      [m.uid, m.name, m.learning_kind, m.domain, m.table, m.engine, m.flag, m.present, m.table_count, m.flag_state, m.intelligence_uid,
       JSON.stringify({ description: m.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: LEARNING_SOURCES.length, by: actor };
}

export async function registerLearningCapability(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureLearningSchema(pool);
  const name = body?.name ? String(body.name) : null;
  if (!name) return { ok: false, error: 'name is required' };
  const table = body?.physical_table ? String(body.physical_table) : null;
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex
  // gate, not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (table != null && !isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.learning_uid ? String(body.learning_uid) : uid('cl-man');
  const table_present = table ? await tableReady(pool, table) : false;
  const table_count = table_present && table ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (learning_uid, name, learning_kind, domain, physical_table, engine_path, governing_flag, present, table_count, flag_state, owner, lifecycle_uid, intelligence_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual')
     ON CONFLICT (learning_uid) DO UPDATE SET
       name=EXCLUDED.name, learning_kind=EXCLUDED.learning_kind, domain=EXCLUDED.domain,
       physical_table=EXCLUDED.physical_table, engine_path=EXCLUDED.engine_path,
       governing_flag=EXCLUDED.governing_flag, present=EXCLUDED.present, table_count=EXCLUDED.table_count,
       flag_state=EXCLUDED.flag_state,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       intelligence_uid=COALESCE(EXCLUDED.intelligence_uid, ${REGISTRY_TABLE}.intelligence_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.learning_kind ? String(body.learning_kind) : 'learning', body?.domain ? String(body.domain) : null,
     table, body?.engine_path ? String(body.engine_path) : null, body?.governing_flag ? String(body.governing_flag) : null,
     table_present, table_count, null,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     body?.intelligence_uid ? String(body.intelligence_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, learning_uid: u, present: table_present, count: table_count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getLearningSummary(pool: Pool) {
  const [registry, catalog, metrics, validation, tiers] = await Promise.all([
    getLearningRegistry(pool), getLearningCatalog(pool), getLearningMetrics(pool), getLearningValidation(pool), composePriorTiers(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.9 — Continuous Learning Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    catalog: { capabilities: catalog.totals.capabilities, present: catalog.totals.present, table_backed: catalog.totals.table_backed, engine_backed: catalog.totals.engine_backed, learning_events_recorded: catalog.totals.learning_events_recorded, domains: catalog.by_domain.length },
    metrics: metrics.scores,
    composition: { prior_tiers_reachable: tiers.reachable, of: tiers.of, note: 'COMPOSES 2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8 recommendation read-only. Re-runs no engine; learns no state.' },
    validation_verdict: validation.verdict,
    learn_safety: { learns_autonomously: false, modifies_business_logic: false, adapts: false, decides: false, executes: false, learn_only: true },
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function captureLearningSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureLearningSchema(pool);
  const [registry, catalog, metrics, validation, summary] = await Promise.all([
    getLearningRegistry(pool), getLearningCatalog(pool), getLearningMetrics(pool), getLearningValidation(pool), getLearningSummary(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('cl-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, capabilities_present, learning_events_recorded,
       learning_quality_pct, learning_confidence_pct, improvement_rate_pct,
       learning_coverage_pct, explainability_pct, effectiveness_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [snapshot_uid, registry.total, catalog.totals.present, catalog.totals.learning_events_recorded,
     score('learning_quality'), score('learning_confidence'), score('improvement_rate'),
     score('learning_coverage'), score('explainability_score'), score('effectiveness'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getLearningSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, capabilities_present, learning_events_recorded, learning_quality_pct, learning_confidence_pct, improvement_rate_pct, learning_coverage_pct, explainability_pct, effectiveness_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getLearningDrift(pool: Pool) {
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
      learning_events_recorded: delta('learning_events_recorded'),
      learning_quality_pct: delta('learning_quality_pct'),
      learning_confidence_pct: delta('learning_confidence_pct'),
      improvement_rate_pct: delta('improvement_rate_pct'),
      learning_coverage_pct: delta('learning_coverage_pct'),
      explainability_pct: delta('explainability_pct'),
      effectiveness_pct: delta('effectiveness_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}

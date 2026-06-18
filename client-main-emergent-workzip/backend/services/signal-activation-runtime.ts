/**
 * CAPADEX Signal Activation Runtime (Phase 2 — Part B).
 *
 * Consumes the evidence objects emitted by `evidence-engine.ts` and runs the
 * deterministic activation pipeline:
 *
 *     Evidence
 *        ↓  (1) Signal Activation       — accumulate evidence per signal
 *        ↓  (2) Relationship Propagation — spread strength along ontology edges
 *        ↓  (3) Contradiction Dampening  — suppress conflicting signals
 *        ↓  (4) Confidence Update        — finalise confidence + lifecycle
 *     capadex_session_signals  (async persistence)
 *
 * Signal lifecycle:  inactive → candidate → active → dominant  (+ suppressed)
 *
 * Per-signal state stored: strength, confidence, activation_count,
 * evidence_count, last_activated_at, lifecycle_state.
 *
 * Design notes:
 *   - The "ontology slice" loaded into memory is the *relationship + contradiction*
 *     layer only (adaptive_ontology_edges + capadex_signals contradiction tokens) —
 *     a few dozen rows. We deliberately NEVER load the 15,972-row atomic catalogue,
 *     keeping memory and latency bounded. The slice is cached process-wide with a
 *     short TTL so repeated /respond calls execute the in-memory pipeline well
 *     under the 50ms target.
 *   - Relationship propagation uses an adjacency list built from approved edges
 *     (weight ≥ 0.60, matching the `pickQuestionsFromDB` convention). Concern-bucket
 *     signals (e.g. STRESS_MANAGEMENT) share the edge namespace, so propagation
 *     genuinely fires (STRESS_MANAGEMENT → EMOTIONAL_REGULATION).
 *   - Contradiction rules combine deterministic behavioural pairs (which fire on
 *     current data) with ontology-loaded contradiction tokens (applied generically
 *     wherever active signal keys intersect).
 *   - Idempotency: the runtime recomputes signal state from the *complete*
 *     evidence set for the session on every invocation (evidence itself is
 *     upserted per logical event), then persists absolute values. Replaying the
 *     same `/respond` payload therefore converges to the same signal state rather
 *     than inflating strength/counts.
 */
import type { Pool } from 'pg';
import {
  ensureEvidenceRuntimeSchema,
  extractEvidence,
  loadEvidence,
  persistEvidence,
  type Db,
  type EvidenceInput,
  type EvidenceObject,
} from './evidence-engine';
import {
  detectComposites,
  ensureCompositeSchema,
  loadCompositeRuntime,
  persistComposites,
  type ActiveSignal,
  type CompositeRuntime,
} from './composite-signal-engine';
import {
  ensurePatternSchema,
  loadEvidenceRefs,
  loadTelemetryAgg,
  persistPatterns,
  synthesizePatterns,
} from './pattern-engine';
import {
  ensureInterventionSchema,
  generateInterventions,
  loadInterventionRuntime,
  persistInterventions,
  type InterventionRuntime,
} from './capadex-intervention-engine';
import { buildSeedSignals, loadConcernSeedDefs, resolveSeedConcernPk, type ConcernSeedDef } from './concern-signal-seeding';
import { isSignalGroundingRuntimeEnabled } from '../config/feature-flags';
import { resolveBridgeTagForConcernPk, loadGroundedSeedDefs, GROUNDED_SEED_CAP } from './signal-grounding-runtime';

// ── Tunables ────────────────────────────────────────────────────────────────
const CANDIDATE_MIN = 0.2;
const ACTIVE_MIN = 0.5;
const DOMINANT_MIN = 0.78;
const DOMINANT_CONF = 0.7;
const EDGE_MIN_WEIGHT = 0.6;
const PROPAGATION_FACTOR = 0.5;
const DAMPEN_FACTOR = 0.5;
const MAX_STRENGTH = 1.0;
const SLICE_TTL_MS = 60_000;
const RUNTIME_BUDGET_MS = 50;

export type SignalLifecycle = 'inactive' | 'candidate' | 'active' | 'dominant' | 'suppressed';

export interface SignalState {
  signal_key: string;
  lifecycle: SignalLifecycle;
  strength: number;
  confidence: number;
  activation_count: number;
  evidence_count: number;
  /** Whether the signal received direct evidence, propagation, or both. */
  source: 'direct' | 'propagated' | 'mixed';
  contributing_evidence_keys: string[];
  metadata: Record<string, unknown>;
}

export interface OntologySlice {
  /** source_bucket → list of approved outbound edges. */
  adjacency: Map<string, { target: string; weight: number }[]>;
  /** signal/state key → set of keys it contradicts (ontology-derived). */
  contradictions: Map<string, Set<string>>;
}

export interface ActivationResult {
  signals: SignalState[];
  timing_ms: number;
  evidence_count: number;
}

/**
 * A concern→signal mapping seed (Task #17). Injected as a direct activation
 * toward a curated Tier-3 signal so the Signal → Composite → Pattern →
 * Intervention spine fires for concerns whose bucket token is not itself a
 * Tier-3 token. Strength is pre-scaled by the caller to the user's measured
 * answer intensity × mapping confidence (never fabricated).
 */
export interface SeedSignal {
  /** Tier-3 signal token (e.g. `career_confusion`). */
  signal_key: string;
  /** Pre-scaled 0..1 strength contribution. */
  strength: number;
  /** Mapping confidence 0..1. */
  confidence: number;
  match_method?: string;
  signal_ref?: string;
}

// ── Deterministic behavioural contradiction rules (fire on current data) ─────
const BEHAVIOURAL_CONTRADICTIONS: [string, string][] = [
  ['rapid_response', 'answer_volatility'],   // fast yet constantly changing ⇒ unreliable
  ['rapid_response', 'response_hesitation'], // can't be both impulsive and hesitant
];

// ── Ontology slice loading (cached) ──────────────────────────────────────────
let sliceCache: { slice: OntologySlice; loadedAt: number } | null = null;

function normaliseToken(t: unknown): string {
  return String(t ?? '').trim().toLowerCase();
}

/**
 * Load the relationship + contradiction slice into memory. Cached process-wide
 * with a short TTL. Both source tables are tiny (≤ a few dozen rows), so this is
 * cheap; the cache exists purely to keep the hot path allocation-free.
 */
export async function loadOntologySlice(pool: Pool, force = false): Promise<OntologySlice> {
  const now = Date.now();
  if (!force && sliceCache && now - sliceCache.loadedAt < SLICE_TTL_MS) {
    return sliceCache.slice;
  }

  const adjacency = new Map<string, { target: string; weight: number }[]>();
  const contradictions = new Map<string, Set<string>>();

  try {
    const edges = await pool.query(
      `SELECT source_bucket, target_bucket, weight
         FROM adaptive_ontology_edges
        WHERE status = 'approved' AND weight >= $1`,
      [EDGE_MIN_WEIGHT],
    );
    for (const e of edges.rows as { source_bucket: string; target_bucket: string; weight: string | number }[]) {
      const list = adjacency.get(e.source_bucket) ?? [];
      list.push({ target: e.target_bucket, weight: Number(e.weight) });
      adjacency.set(e.source_bucket, list);
    }
  } catch (err) {
    console.error('[signal-activation] edge load failed (continuing without propagation):', err);
  }

  try {
    const sig = await pool.query(
      `SELECT signal_name, contradiction_links FROM capadex_signals`,
    );
    for (const s of sig.rows as { signal_name: string; contradiction_links: string }[]) {
      const key = normaliseToken(s.signal_name);
      const tokens = String(s.contradiction_links ?? '')
        .split(/[,;|]/)
        .map(normaliseToken)
        .filter(Boolean);
      if (!key || tokens.length === 0) continue;
      const set = contradictions.get(key) ?? new Set<string>();
      for (const t of tokens) set.add(t);
      contradictions.set(key, set);
    }
  } catch (err) {
    console.error('[signal-activation] contradiction load failed (continuing without ontology dampening):', err);
  }

  const slice: OntologySlice = { adjacency, contradictions };
  sliceCache = { slice, loadedAt: now };
  return slice;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
function initSignal(key: string, source: SignalState['source']): SignalState {
  return {
    signal_key: key,
    lifecycle: 'inactive',
    strength: 0,
    confidence: 0,
    activation_count: 0,
    evidence_count: 0,
    source,
    contributing_evidence_keys: [],
    metadata: {},
  };
}

/** Saturating accumulation: each contribution moves strength toward 1 without overshoot. */
function saturate(current: number, add: number): number {
  const next = current + add * (1 - current);
  return next > MAX_STRENGTH ? MAX_STRENGTH : next;
}

function lifecycleFor(strength: number, confidence: number): SignalLifecycle {
  if (strength >= DOMINANT_MIN && confidence >= DOMINANT_CONF) return 'dominant';
  if (strength >= ACTIVE_MIN) return 'active';
  if (strength >= CANDIDATE_MIN) return 'candidate';
  return 'inactive';
}

/**
 * Run the full deterministic activation pipeline in memory. Pure (no I/O), so it
 * is trivially fast; `timing_ms` is measured and a breach of the 50ms budget is
 * logged (it should never happen given the bounded slice).
 */
export function runActivation(
  slice: OntologySlice,
  evidence: EvidenceObject[],
  seeds: SeedSignal[] = [],
): ActivationResult {
  const start = Date.now();
  const signals = new Map<string, SignalState>();
  const suppressed = new Set<string>();
  const confidenceAccum = new Map<string, { sum: number; n: number }>();

  // ── (1) Signal Activation ──────────────────────────────────────────────────
  for (const ev of evidence) {
    const key = ev.evidence_key;
    if (!key) continue;
    const s = signals.get(key) ?? initSignal(key, 'direct');
    s.strength = saturate(s.strength, ev.strength);
    s.evidence_count += 1;
    s.activation_count += 1;
    if (!s.contributing_evidence_keys.includes(ev.source_type)) {
      s.contributing_evidence_keys.push(ev.source_type);
    }
    signals.set(key, s);
    const acc = confidenceAccum.get(key) ?? { sum: 0, n: 0 };
    acc.sum += ev.confidence;
    acc.n += 1;
    confidenceAccum.set(key, acc);
  }

  // Base confidence from evidence agreement (more concurring evidence ⇒ higher).
  for (const [key, s] of Array.from(signals.entries())) {
    const acc = confidenceAccum.get(key);
    const avg = acc && acc.n > 0 ? acc.sum / acc.n : 0.5;
    s.confidence = Math.min(0.95, avg + 0.05 * Math.max(0, s.evidence_count - 1));
  }

  // ── (1b) Concern→signal seed bias (Task #17) ────────────────────────────────
  // Inject curated Tier-3 mappings for the session's concern as direct
  // activations so the composite/pattern/intervention spine fires for concerns
  // whose bucket token is not itself a Tier-3 token. Strength is pre-scaled by
  // the caller (answer intensity × mapping confidence); an empty seed set leaves
  // the pipeline byte-identical to the pre-seeding behaviour.
  for (const seed of seeds) {
    const key = seed.signal_key;
    if (!key || !(seed.strength > 0)) continue;
    const s = signals.get(key) ?? initSignal(key, 'direct');
    s.strength = saturate(s.strength, seed.strength);
    s.activation_count += 1;
    s.source = s.evidence_count > 0 ? 'mixed' : 'direct';
    if (!s.contributing_evidence_keys.includes('concern_seed')) {
      s.contributing_evidence_keys.push('concern_seed');
    }
    s.metadata.seeded_from_concern = true;
    if (seed.match_method) s.metadata.seed_method = seed.match_method;
    if (seed.signal_ref) s.metadata.seed_signal_ref = seed.signal_ref;
    // Confidence is bounded by the mapping confidence; blend with any
    // evidence-derived confidence rather than overwrite it.
    s.confidence = s.evidence_count > 0
      ? Math.min(0.95, Math.max(s.confidence, (s.confidence + seed.confidence) / 2))
      : Math.min(0.95, Math.max(s.confidence, seed.confidence));
    signals.set(key, s);
  }

  // ── (2) Relationship Propagation (single hop, deterministic) ────────────────
  const directKeys = Array.from(signals.values())
    .filter((s) => s.source === 'direct' && s.strength >= CANDIDATE_MIN)
    .map((s) => s.signal_key);

  for (const srcKey of directKeys) {
    const src = signals.get(srcKey);
    if (!src) continue;
    const edges = slice.adjacency.get(srcKey);
    if (!edges) continue;
    for (const edge of edges) {
      const propStrength = src.strength * edge.weight * PROPAGATION_FACTOR;
      if (propStrength <= 0) continue;
      const t = signals.get(edge.target) ?? initSignal(edge.target, 'propagated');
      t.strength = saturate(t.strength, propStrength);
      t.source = t.evidence_count > 0 ? 'mixed' : 'propagated';
      if (!t.contributing_evidence_keys.includes(`propagated:${srcKey}`)) {
        t.contributing_evidence_keys.push(`propagated:${srcKey}`);
      }
      // Propagated-only signals inherit a discounted confidence from their source.
      if (t.evidence_count === 0) {
        t.confidence = Math.max(t.confidence, Math.min(0.9, src.confidence * edge.weight * 0.8));
      }
      signals.set(edge.target, t);
    }
  }

  // ── (3) Contradiction Dampening ─────────────────────────────────────────────
  const dampen = (a: string, b: string) => {
    const sa = signals.get(a);
    const sb = signals.get(b);
    if (!sa || !sb) return;
    if (sa.strength < CANDIDATE_MIN || sb.strength < CANDIDATE_MIN) return;
    // Dampen the weaker of the two conflicting signals.
    const weaker = sa.strength <= sb.strength ? sa : sb;
    weaker.strength *= DAMPEN_FACTOR;
    weaker.confidence *= DAMPEN_FACTOR;
    suppressed.add(weaker.signal_key);
    weaker.metadata.suppressed_by = weaker.signal_key === sa.signal_key ? b : a;
  };

  for (const [x, y] of BEHAVIOURAL_CONTRADICTIONS) dampen(x, y);

  // Ontology-derived contradictions: apply wherever active signal keys intersect.
  for (const [key, s] of Array.from(signals.entries())) {
    if (s.strength < CANDIDATE_MIN) continue;
    const conflicts = slice.contradictions.get(normaliseToken(key));
    if (!conflicts) continue;
    for (const other of Array.from(signals.keys())) {
      if (other === key) continue;
      if (conflicts.has(normaliseToken(other))) dampen(key, other);
    }
  }

  // ── (4) Confidence Update + lifecycle finalisation ──────────────────────────
  for (const [key, s] of Array.from(signals.entries())) {
    if (suppressed.has(key)) {
      s.lifecycle = 'suppressed';
    } else {
      s.lifecycle = lifecycleFor(s.strength, s.confidence);
    }
    s.strength = Math.round(s.strength * 10_000) / 10_000;
    s.confidence = Math.round(s.confidence * 10_000) / 10_000;
  }

  const timing_ms = Date.now() - start;
  if (timing_ms > RUNTIME_BUDGET_MS) {
    console.warn(`[signal-activation] runtime ${timing_ms}ms exceeded ${RUNTIME_BUDGET_MS}ms budget`);
  }

  return {
    signals: Array.from(signals.values()),
    timing_ms,
    evidence_count: evidence.length,
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────
const SEVERITY_BY_LIFECYCLE: Record<SignalLifecycle, string> = {
  inactive: 'minimal',
  candidate: 'low',
  active: 'moderate',
  dominant: 'high',
  suppressed: 'minimal',
};

/**
 * Upsert activated signals into `capadex_session_signals` with **absolute**
 * values. Only non-inactive signals are persisted (inactive ones carry no
 * information). Because the caller recomputes the full activation from the entire
 * session evidence set each invocation, the persisted row is overwritten with the
 * freshly computed state rather than accumulated — replays converge instead of
 * inflating. `last_activated_at` advances on every (re)activation.
 */
export async function persistSignals(
  pool: Db,
  sessionId: string,
  signals: SignalState[],
): Promise<number> {
  const persistable = signals.filter((s) => s.lifecycle !== 'inactive');

  // Set-reconciliation: drop previously-activated rows for this session that the
  // current full-set recompute no longer qualifies (e.g. a signal that fell below
  // threshold or is no longer suppressed). Keeps persisted state == recomputed
  // state. Only touches activation rows (lifecycle_state IS NOT NULL); classifier
  // rows are untouched. An empty keep-set clears all activation rows.
  const keep = persistable.map((s) => s.signal_key);
  await pool.query(
    `DELETE FROM capadex_session_signals
       WHERE session_id = $1 AND lifecycle_state IS NOT NULL
         AND signal_key <> ALL($2::text[])`,
    [sessionId, keep],
  );

  if (persistable.length === 0) return 0;

  let written = 0;
  for (const s of persistable) {
    const severity = SEVERITY_BY_LIFECYCLE[s.lifecycle] ?? 'minimal';
    const weight = Math.min(99.99, s.strength);
    const signalValue = JSON.stringify({
      source: s.source,
      contributing_evidence: s.contributing_evidence_keys,
      ...s.metadata,
    });
    const res = await pool.query(
      `INSERT INTO capadex_session_signals
         (session_id, item_id, signal_type, signal_key, signal_value, weight, severity, confidence,
          description, lifecycle_state, strength, activation_count, evidence_count, last_activated_at)
       VALUES ($1, NULL, 'activated', $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (session_id, signal_key) WHERE lifecycle_state IS NOT NULL
       DO UPDATE SET
         strength          = EXCLUDED.strength,
         confidence        = EXCLUDED.confidence,
         weight            = EXCLUDED.weight,
         activation_count  = EXCLUDED.activation_count,
         evidence_count    = EXCLUDED.evidence_count,
         signal_value      = EXCLUDED.signal_value,
         lifecycle_state   = EXCLUDED.lifecycle_state,
         severity          = EXCLUDED.severity,
         last_activated_at = NOW()`,
      [
        sessionId,
        s.signal_key,
        signalValue,
        weight,
        severity,
        s.confidence,
        `Activation runtime: ${s.lifecycle} (${s.source})`,
        s.lifecycle,
        s.strength,
        s.activation_count,
        s.evidence_count,
      ],
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

/**
 * Orchestrator invoked (fire-and-forget) by the respond handler.
 * Answers → Evidence → Signals, with async persistence of both.
 *
 * Fully defensive: never throws. A failure in any stage is logged and the
 * request flow is unaffected (it has already responded by the time this runs).
 */
export async function runEvidenceRuntime(
  pool: Pool,
  session: { id?: string; primary_construct_key?: string | null; concern_name?: string | null; master_concern_pk?: number | null },
  inputs: EvidenceInput[],
): Promise<ActivationResult | null> {
  const sessionId = String(session?.id ?? '');
  if (!sessionId || !Array.isArray(inputs) || inputs.length === 0) return null;

  const batchEvidence = extractEvidence(session, inputs);
  if (batchEvidence.length === 0) return null;

  try {
    // DDL bootstrap outside the txn (idempotent, cached after first call). All
    // four tiers (evidence, signals, composites, patterns) are ensured up front.
    await ensureEvidenceRuntimeSchema(pool);
    await ensureCompositeSchema(pool);
    await ensurePatternSchema(pool);
    await ensureInterventionSchema(pool);

    // Read-only + cached slices loaded before the txn to keep the lock window
    // minimal: the relationship/contradiction slice (Phase 2), the ontology-
    // derived composite definitions + signal metadata (Phase 3), and the
    // intervention ontology+library runtime (Phase 4).
    const slice = await loadOntologySlice(pool);
    const compositeRuntime = await loadCompositeRuntime(pool);
    const interventionRuntime = await loadInterventionRuntime(pool);
    const persona = await loadSessionPersona(pool, sessionId);

    // Concern→signal seed definitions (Task #17): the curated Tier-3 mappings for
    // this session's concern, loaded read-only + cached before the txn. Empty when
    // the concern has no strong/moderate mapping → activation stays unchanged.
    let seedDefs = await loadConcernSeedDefs(pool, session?.concern_name ?? null, session?.master_concern_pk ?? null);

    // WC-1B-R Phase 2 — grounded-signal seeds (flag-gated, additive, gap-fill).
    // When the resolved concern's bridge tag is grounded (WC-1B), contribute a
    // capped, ranked, confidence-penalised set of grounded signals as ADDITIONAL
    // activation seeds — but only to FILL THE GAP left by curated Tier-3 seeds
    // (never displacing them) and never exceeding GROUNDED_SEED_CAP. Reuses the
    // exact buildSeedSignals → runActivation path below (no duplicate logic).
    // Flag OFF / no grounding / no concern → seedDefs is unchanged → byte-identical.
    if (isSignalGroundingRuntimeEnabled()) {
      try {
        let pk: number | null =
          typeof session?.master_concern_pk === 'number' && Number.isFinite(session.master_concern_pk)
            ? session.master_concern_pk
            : null;
        if (pk === null) pk = await resolveSeedConcernPk(pool, session?.concern_name ?? null);
        const bridgeTag = await resolveBridgeTagForConcernPk(pool, pk);
        if (bridgeTag) {
          const curatedKeys = new Set(seedDefs.map((d) => d.signal_key));
          const groundedDefs = (await loadGroundedSeedDefs(pool, bridgeTag, GROUNDED_SEED_CAP))
            .filter((d: ConcernSeedDef) => !curatedKeys.has(d.signal_key))
            .slice(0, GROUNDED_SEED_CAP);
          if (groundedDefs.length > 0) seedDefs = seedDefs.concat(groundedDefs);
        }
      } catch (gErr) {
        console.error('[signal-activation] grounded seed augmentation failed (continuing with curated only):', gErr);
      }
    }

    // Serialise per-session writes. Two overlapping /respond calls for the same
    // session would otherwise interleave (upsert → reload → recompute → write)
    // and a stale snapshot could clobber a fresher one (absolute, last-writer-
    // wins). A transaction-scoped advisory lock makes the upsert+reload+recompute
    // +write sequence atomic per session; concurrent calls run one after another,
    // each recomputing from the latest committed evidence.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [sessionId]);

      // 1) This batch's answers → evidence, upserted per logical event.
      await persistEvidence(client, sessionId, batchEvidence);

      // 2) Recompute activation from the COMPLETE (now-committed-in-txn) evidence
      //    set — deterministic & idempotent — then persist absolute signal state.
      //    Concern→signal seeds are scaled against this same full evidence set
      //    (answer intensity × mapping confidence), so they converge on replay too.
      const fullEvidence = await loadEvidence(client, sessionId);
      const seeds = buildSeedSignals(seedDefs, fullEvidence);
      const result = runActivation(slice, fullEvidence, seeds);
      await persistSignals(client, sessionId, result.signals);

      // 3) Higher-order synthesis (Phase 3): Signals → Composites → Patterns.
      //    Runs inside the same advisory-locked txn so the whole spine is atomic
      //    and idempotent — composites/patterns are recomputed from the freshly
      //    persisted active-signal set and reconciled, never accumulated.
      await runHigherOrderRuntime(client, sessionId, result.signals, compositeRuntime, interventionRuntime, persona);

      await client.query('COMMIT');
      return result;
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[evidence-runtime] failed:', err);
    return null;
  }
}

/**
 * Phase 3 higher-order stage, executed within the Phase 2 transaction.
 *
 *     active signals → composites → patterns
 *
 * Reads the just-persisted active signals, detects ontology-defined composites,
 * pulls the contradiction (suppressed signals), telemetry and evidence-ref
 * inputs, synthesises behavioural patterns, and persists both tiers with the
 * same absolute-upsert + set-reconciliation invariants used for signals.
 */
async function runHigherOrderRuntime(
  client: Db,
  sessionId: string,
  signals: SignalState[],
  runtime: CompositeRuntime,
  interventionRuntime: InterventionRuntime,
  persona: string | null,
): Promise<void> {
  // The active atomic signals are exactly the persisted (non-inactive) rows.
  const active: ActiveSignal[] = signals
    .filter((s) => s.lifecycle !== 'inactive')
    .map((s) => ({
      signal_key: s.signal_key,
      strength: s.strength,
      confidence: s.confidence,
      lifecycle: s.lifecycle,
    }));

  // Part A — Composites.
  const composites = detectComposites(runtime.definitions, active);
  await persistComposites(client, sessionId, composites);

  // Part B — Patterns (atomic signals + composites + contradictions + telemetry).
  const [telemetry, evidenceByToken] = await Promise.all([
    loadTelemetryAgg(client, sessionId),
    loadEvidenceRefs(client, sessionId),
  ]);
  const patterns = synthesizePatterns({
    active,
    composites,
    signalMeta: runtime.signalMeta,
    telemetry,
    evidenceByToken,
  });
  await persistPatterns(client, sessionId, patterns);

  // Part C — Interventions (Phase 4): patterns + signals → ranked, library-backed
  // interventions. Same absolute-upsert + reconciliation invariants; emits nothing
  // for signals with no ontology→library mapping (never a generic recommendation).
  const interventions = generateInterventions({
    active,
    patterns,
    runtime: interventionRuntime,
    persona,
  });
  await persistInterventions(client, sessionId, interventions);
}

/** Best-effort persona read for intervention-library persona selection. */
async function loadSessionPersona(pool: Pool, sessionId: string): Promise<string | null> {
  try {
    const res = await pool.query(
      `SELECT persona FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    return (res.rows[0]?.persona as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * CAPADEX Composite Signal Engine (Phase 3 — Part A).
 *
 * Synthesises higher-order **composite signals** from the active atomic signals
 * produced by the Phase 2 activation runtime. Extends the same architectural
 * spine:
 *
 *     Answers → Evidence → Signals → Composites → Patterns
 *
 * A composite is a combination of atomic signals that, when enough of them are
 * co-active at sufficient strength, denotes a higher-order behavioural construct.
 * The canonical example:
 *
 *     fear_of_failure + avoidance_behavior + overthinking  ⇒  (a hidden pattern)
 *
 * Composite definitions are **generated dynamically from the ontology**
 * (`capadex_signals`) — never hardcoded. Each `hidden_pattern_contribution`
 * cluster declared in the ontology becomes a composite whose required signals are
 * the cluster's anchor(s) expanded by their `related_signals`. Because the
 * definitions are read from the DB, new ontology rows automatically yield new
 * composites with no code change.
 *
 * Each composite definition carries (as the task requires):
 *   - required_signals     — the atomic signals it is built from
 *   - minimum_count        — how many must be co-active
 *   - minimum_strength     — the per-signal strength floor
 *   - weighting_method     — how matched strengths combine
 *   - confidence_formula   — how composite confidence is derived
 *
 * Persisted to `capadex_session_composites`. Idempotent: recomputed from the full
 * active-signal set each invocation, upserted with absolute values, and stale
 * rows reconciled away — mirroring the Phase 2 persistence invariants.
 */
import type { Pool } from 'pg';
import type { Db } from './evidence-engine';

// ── Tunables ────────────────────────────────────────────────────────────────
const RUNTIME_TTL_MS = 60_000;
/** Per-signal strength floor for a signal to count toward a composite. */
const DEFAULT_MIN_STRENGTH = 0.4;
/** A composite always needs at least this many co-active signals. */
const ABSOLUTE_MIN_COUNT = 2;

// ── Types ────────────────────────────────────────────────────────────────────
/** Ontology metadata for one atomic signal, keyed by its normalised core token. */
export interface SignalMeta {
  signal_name: string;
  domain: string;
  severity: number;
  confidence: number;
}

export interface CompositeDefinition {
  composite_key: string;
  label: string;
  required_signals: string[];
  minimum_count: number;
  minimum_strength: number;
  weighting_method: 'severity_weighted_mean';
  confidence_formula: 'coverage_x_mean_confidence';
  /** core-token → ontology severity weight, for the weighting method. */
  weights: Record<string, number>;
}

export interface CompositeRuntime {
  definitions: CompositeDefinition[];
  /** core-token → ontology metadata, reused by the pattern engine. */
  signalMeta: Map<string, SignalMeta>;
}

/** One atomic signal currently active for a session (Phase 2 output row). */
export interface ActiveSignal {
  signal_key: string;
  strength: number;
  confidence: number;
  lifecycle: string;
}

export interface CompositeSignal {
  composite_key: string;
  label: string;
  strength: number;
  confidence: number;
  required_signals: string[];
  /** The atomic signal_keys that actually matched (the explainable refs). */
  signal_refs: string[];
  matched_count: number;
  minimum_count: number;
  minimum_strength: number;
  weighting_method: string;
  confidence_formula: string;
}

// ── Normalisation ────────────────────────────────────────────────────────────
/**
 * Reduce a signal name/key to a comparable core token: lower-case, non-alnum →
 * underscore, and strip common descriptive suffixes so that, e.g.,
 * `overthinking` and `overthinking_pattern` collapse to the same token. This is
 * how active atomic signals (concern/behavioural vocabulary) are matched against
 * the ontology's signal vocabulary without a hardcoded crosswalk.
 */
export function coreToken(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_(patterns?|behaviou?rs?|indicators?|loops?|tendency|cluster)$/g, '');
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Sentence-case a snake/cluster key for display ("hidden_paralysis_cluster"). */
function humanise(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ── Dynamic definition build (cached) ────────────────────────────────────────
let runtimeCache: { runtime: CompositeRuntime; loadedAt: number } | null = null;

interface OntologyRow {
  signal_name: string;
  domain: string | null;
  related_signals: string | null;
  hidden_pattern_contribution: string | null;
  severity_weight: string | number | null;
  confidence_weight: string | number | null;
}

/**
 * Build composite definitions + the signal-metadata index from the ontology.
 * Cached process-wide with a short TTL (the ontology is tiny — 20 rows). Both
 * the composite engine and the pattern engine consume the returned runtime.
 */
export async function loadCompositeRuntime(pool: Pool, force = false): Promise<CompositeRuntime> {
  const now = Date.now();
  if (!force && runtimeCache && now - runtimeCache.loadedAt < RUNTIME_TTL_MS) {
    return runtimeCache.runtime;
  }

  const signalMeta = new Map<string, SignalMeta>();
  const definitions: CompositeDefinition[] = [];

  try {
    const res = await pool.query<OntologyRow>(
      `SELECT signal_name, domain, related_signals, hidden_pattern_contribution,
              severity_weight, confidence_weight
         FROM capadex_signals`,
    );
    const rows = res.rows;

    // Index every ontology signal by its core token (for matching + weighting).
    for (const r of rows) {
      const token = coreToken(r.signal_name);
      if (!token) continue;
      signalMeta.set(token, {
        signal_name: r.signal_name,
        domain: (r.domain || 'general').toLowerCase(),
        severity: Number(r.severity_weight) || 0.5,
        confidence: Number(r.confidence_weight) || 0.5,
      });
    }

    // Group by hidden_pattern_contribution cluster → one composite per cluster.
    const clusters = new Map<string, Set<string>>(); // cluster → core tokens
    for (const r of rows) {
      const cluster = String(r.hidden_pattern_contribution ?? '').trim();
      if (!cluster) continue;
      const set = clusters.get(cluster) ?? new Set<string>();
      // Anchor signal …
      const anchor = coreToken(r.signal_name);
      if (anchor) set.add(anchor);
      // … expanded by its related signals (so single-anchor clusters still yield
      // multi-signal composites, matching the worked example's shape).
      for (const rel of String(r.related_signals ?? '').split(/[,;|]/)) {
        const t = coreToken(rel);
        if (t) set.add(t);
      }
      clusters.set(cluster, set);
    }

    for (const [cluster, tokenSet] of Array.from(clusters.entries())) {
      const required = Array.from(tokenSet);
      if (required.length < ABSOLUTE_MIN_COUNT) continue;
      const weights: Record<string, number> = {};
      for (const t of required) weights[t] = signalMeta.get(t)?.severity ?? 0.5;
      definitions.push({
        composite_key: cluster,
        label: humanise(cluster),
        required_signals: required,
        // Need at least half the cluster (and never fewer than the absolute floor).
        minimum_count: Math.max(ABSOLUTE_MIN_COUNT, Math.ceil(required.length * 0.5)),
        minimum_strength: DEFAULT_MIN_STRENGTH,
        weighting_method: 'severity_weighted_mean',
        confidence_formula: 'coverage_x_mean_confidence',
        weights,
      });
    }
  } catch (err) {
    console.error('[composite-engine] ontology load failed (no composites this run):', err);
  }

  const runtime: CompositeRuntime = { definitions, signalMeta };
  runtimeCache = { runtime, loadedAt: now };
  return runtime;
}

// ── Detection ────────────────────────────────────────────────────────────────
/**
 * Evaluate every composite definition against the active atomic signals. A
 * composite forms when at least `minimum_count` of its required signals are
 * co-active at or above `minimum_strength`.
 *
 * Pure (no I/O) and explainable — each emitted composite carries the exact
 * atomic `signal_refs` that satisfied it.
 */
export function detectComposites(
  definitions: CompositeDefinition[],
  active: ActiveSignal[],
): CompositeSignal[] {
  if (definitions.length === 0 || active.length === 0) return [];

  // Index active signals by core token; keep the strongest if duplicates collapse.
  const activeByToken = new Map<string, ActiveSignal>();
  for (const a of active) {
    const t = coreToken(a.signal_key);
    if (!t) continue;
    const prev = activeByToken.get(t);
    if (!prev || a.strength > prev.strength) activeByToken.set(t, a);
  }

  const out: CompositeSignal[] = [];
  for (const def of definitions) {
    const matched: { token: string; sig: ActiveSignal }[] = [];
    for (const req of def.required_signals) {
      const sig = activeByToken.get(req);
      if (sig && sig.strength >= def.minimum_strength) matched.push({ token: req, sig });
    }
    if (matched.length < def.minimum_count) continue;

    // weighting_method = severity_weighted_mean.
    let wsum = 0;
    let wstrength = 0;
    let confSum = 0;
    for (const m of matched) {
      const w = def.weights[m.token] ?? 0.5;
      wsum += w;
      wstrength += m.sig.strength * w;
      confSum += m.sig.confidence;
    }
    const strength = wsum > 0 ? wstrength / wsum : 0;

    // confidence_formula = coverage_x_mean_confidence.
    const coverage = matched.length / def.required_signals.length;
    const meanConf = matched.length > 0 ? confSum / matched.length : 0;
    const confidence = coverage * meanConf;

    out.push({
      composite_key: def.composite_key,
      label: def.label,
      strength: round4(clamp01(strength)),
      confidence: round4(clamp01(confidence)),
      required_signals: def.required_signals,
      signal_refs: matched.map((m) => m.sig.signal_key),
      matched_count: matched.length,
      minimum_count: def.minimum_count,
      minimum_strength: def.minimum_strength,
      weighting_method: def.weighting_method,
      confidence_formula: def.confidence_formula,
    });
  }
  return out;
}

// ── Schema bootstrap (idempotent, lazy) ─────────────────────────────────────
let schemaPromise: Promise<void> | null = null;

/** Ensure `capadex_session_composites` exists (mirrors the canonical migration). */
export function ensureCompositeSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS capadex_session_composites (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id        UUID NOT NULL,
        composite_key     VARCHAR(120) NOT NULL,
        label             TEXT,
        strength          NUMERIC(5,4) NOT NULL DEFAULT 0,
        confidence        NUMERIC(5,4) NOT NULL DEFAULT 0,
        required_signals  JSONB NOT NULL DEFAULT '[]',
        signal_refs       JSONB NOT NULL DEFAULT '[]',
        matched_count     INTEGER NOT NULL DEFAULT 0,
        minimum_count     INTEGER NOT NULL DEFAULT 0,
        minimum_strength  NUMERIC(5,4) NOT NULL DEFAULT 0,
        weighting_method  VARCHAR(60),
        confidence_formula VARCHAR(60),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_capadex_composites_session ON capadex_session_composites (session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_composites_session_key
        ON capadex_session_composites (session_id, composite_key);
    `)
    .then(() => undefined)
    .catch((err) => {
      schemaPromise = null;
      throw err;
    });
  return schemaPromise;
}

// ── Persistence ──────────────────────────────────────────────────────────────
/**
 * Upsert composites for a session with absolute values, and reconcile away any
 * previously-persisted composite the current recompute no longer forms. Replays
 * converge instead of accumulating (same invariant as the Phase 2 signals).
 */
/**
 * Gap 3 — Read endpoint support.
 * Returns the persisted composites for a session, ordered by confidence desc.
 * Safe to call before the pipeline runs — returns [] when the table has no rows.
 */
export async function getSessionComposites(
  pool: Pool,
  sessionId: string,
): Promise<CompositeSignal[]> {
  try {
    const { rows } = await pool.query<{
      composite_key: string;
      label: string;
      strength: string;
      confidence: string;
      required_signals: string[];
      signal_refs: string[];
      matched_count: string;
      minimum_count: string;
      minimum_strength: string;
      weighting_method: string;
      confidence_formula: string;
    }>(
      `SELECT composite_key, label, strength, confidence, required_signals,
              signal_refs, matched_count, minimum_count, minimum_strength,
              weighting_method, confidence_formula
         FROM capadex_session_composites
        WHERE session_id = $1
        ORDER BY confidence DESC`,
      [sessionId],
    );
    return rows.map((r) => ({
      composite_key:     r.composite_key,
      label:             r.label,
      strength:          Number(r.strength),
      confidence:        Number(r.confidence),
      required_signals:  Array.isArray(r.required_signals) ? r.required_signals : [],
      signal_refs:       Array.isArray(r.signal_refs) ? r.signal_refs : [],
      matched_count:     Number(r.matched_count),
      minimum_count:     Number(r.minimum_count),
      minimum_strength:  Number(r.minimum_strength),
      weighting_method:  r.weighting_method,
      confidence_formula: r.confidence_formula,
    }));
  } catch {
    return [];
  }
}

export async function persistComposites(
  pool: Db,
  sessionId: string,
  composites: CompositeSignal[],
): Promise<number> {
  const keep = composites.map((c) => c.composite_key);
  await pool.query(
    `DELETE FROM capadex_session_composites
       WHERE session_id = $1 AND composite_key <> ALL($2::text[])`,
    [sessionId, keep],
  );

  if (composites.length === 0) return 0;

  let written = 0;
  for (const c of composites) {
    const res = await pool.query(
      `INSERT INTO capadex_session_composites
         (session_id, composite_key, label, strength, confidence, required_signals,
          signal_refs, matched_count, minimum_count, minimum_strength,
          weighting_method, confidence_formula, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (session_id, composite_key) DO UPDATE SET
         label              = EXCLUDED.label,
         strength           = EXCLUDED.strength,
         confidence         = EXCLUDED.confidence,
         required_signals   = EXCLUDED.required_signals,
         signal_refs        = EXCLUDED.signal_refs,
         matched_count      = EXCLUDED.matched_count,
         minimum_count      = EXCLUDED.minimum_count,
         minimum_strength   = EXCLUDED.minimum_strength,
         weighting_method   = EXCLUDED.weighting_method,
         confidence_formula = EXCLUDED.confidence_formula,
         updated_at         = NOW()`,
      [
        sessionId,
        c.composite_key,
        c.label,
        c.strength,
        c.confidence,
        JSON.stringify(c.required_signals),
        JSON.stringify(c.signal_refs),
        c.matched_count,
        c.minimum_count,
        c.minimum_strength,
        c.weighting_method,
        c.confidence_formula,
      ],
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

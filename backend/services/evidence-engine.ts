/**
 * CAPADEX Evidence Engine (Phase 2 — Part A).
 *
 * Converts raw assessment activity arriving at
 * `POST /api/capadex/session/:id/respond` into normalised **evidence objects**
 * and persists them to `capadex_evidence`.
 *
 * Architectural rule (do not violate):
 *
 *     Answers  →  Evidence  →  Signals
 *
 * Signals may NEVER activate directly from an answer. This module only produces
 * evidence; activation is a separate stage owned by
 * `signal-activation-runtime.ts`, which consumes the evidence emitted here.
 *
 * Evidence sources converted:
 *   - assessment / short-assessment answers   → concern-bucket evidence
 *   - answer_changed mutations                → `answer_volatility` evidence
 *   - response-time anomalies (telemetry)     → `rapid_response` / `response_hesitation`
 *
 * The schema (table + the additive lifecycle columns the activation runtime
 * needs on `capadex_session_signals`) is bootstrapped idempotently the first
 * time the engine runs, mirroring the lazy `CREATE TABLE IF NOT EXISTS` pattern
 * already used by `routes/signal-capture.ts` (this repo has no migration runner;
 * the canonical DDL also lives in `migrations/20261025_evidence_signal_runtime.sql`).
 */
import type { Pool, PoolClient } from 'pg';
import { classifyDimensionSignal } from './behavioral-dimension-signals';
import { isRichBehavioralSignalsEnabled } from '../config/feature-flags';

/** Either the pool or a checked-out client (so callers can run inside a txn). */
export type Db = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

// ── Tunables ────────────────────────────────────────────────────────────────
/** Likert ceiling used to normalise an answer value into a 0..1 strength. */
const LIKERT_MAX = 5;
/** A response faster than this is treated as an impulsive / low-engagement anomaly. */
const RAPID_MS = 1500;
/** A response slower than this is treated as a hesitation / difficulty anomaly. */
const SLOW_MS = 25_000;

/** Canonical evidence source types persisted to `capadex_evidence.source_type`. */
export type EvidenceSource =
  | 'assessment'
  | 'short_assessment'
  | 'clarity'
  | 'mutation'
  | 'telemetry';

/** A normalised evidence object — the only thing the activation runtime consumes. */
export interface EvidenceObject {
  source_type: EvidenceSource;
  source_id: string | null;
  answer_value: string | null;
  /** The signal key this evidence supports (a concern bucket or a behavioural key). */
  evidence_key: string;
  /** Normalised 0..1 contribution this evidence makes toward its signal. */
  strength: number;
  /** Normalised 0..1 detection certainty for this single piece of evidence. */
  confidence: number;
  metadata: Record<string, unknown>;
}

/**
 * One response item, enriched by the respond handler with the server-resolved
 * `bucket` (the canonical concern construct key) and the matched item `kind`.
 * Kept deliberately thin so the respond handler can build it inside its existing
 * per-item loop without re-querying.
 */
export interface EvidenceInput {
  item_id: string;
  response_value: number;
  response_time_ms?: number | null;
  answer_changed?: boolean;
  bucket: string | null;
  kind: 'assessment' | 'short_assessment' | 'clarity' | 'unknown';
  /**
   * Authored per-item behavioural facet from `sdi_items` (Task #22). Used to
   * emit an ADDITIONAL genuine concern signal keyed on the facet, so a session
   * yields ≥2 distinct co-active signals. Optional — absent (legacy / no
   * metadata) → no dimension signal emitted (byte-identical legacy).
   */
  dimension?: string | null;
  subdomain?: string | null;
  polarity?: string | null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Map a raw answer value onto a bounded 0..1 strength. */
function answerStrength(value: number): number {
  return clamp01(value / LIKERT_MAX);
}

function answerSource(kind: EvidenceInput['kind']): EvidenceSource {
  if (kind === 'short_assessment') return 'short_assessment';
  if (kind === 'clarity') return 'clarity';
  return 'assessment';
}

/**
 * Pure conversion: response items → evidence objects.
 *
 * Never throws; an empty or malformed item simply yields no evidence. Each item
 * can emit up to three evidence objects (answer, mutation, timing anomaly).
 */
export function extractEvidence(
  session: { primary_construct_key?: string | null },
  inputs: EvidenceInput[],
): EvidenceObject[] {
  const anchor = session?.primary_construct_key || 'GENERAL_CONCERN';
  const out: EvidenceObject[] = [];
  // Task #22 — read once. Flag OFF → the dimension-signal branch is skipped
  // entirely, so the emitted evidence set is byte-identical to legacy.
  const richSignalsOn = isRichBehavioralSignalsEnabled();

  for (const it of inputs) {
    if (!it || it.item_id == null || it.response_value == null) continue;
    const sourceId = String(it.item_id);
    const value = Number(it.response_value);
    const bucket = (it.bucket || anchor) as string;

    // 1) Answer evidence → supports the item's concern-bucket signal.
    out.push({
      source_type: answerSource(it.kind),
      source_id: sourceId,
      answer_value: String(it.response_value),
      evidence_key: bucket,
      strength: answerStrength(value),
      confidence: 0.6,
      metadata: { kind: it.kind, raw_value: value, bucket },
    });

    // 1b) Dimension evidence (Task #22, flag-gated) → an ADDITIONAL genuine
    // concern signal keyed on the item's authored behavioural facet. This is the
    // second co-active signal the composite engine needs (ABSOLUTE_MIN_COUNT=2).
    // Flag OFF, or no faithful classification, or below-candidate distress →
    // nothing emitted (byte-identical legacy). The facet is real authored
    // metadata; its polarity-adjusted distress is the honest, concern-diagnostic
    // strength — never fabricated, never derived from raw signal magnitude.
    if (richSignalsOn) {
      const dim = classifyDimensionSignal({
        dimension: it.dimension,
        subdomain: it.subdomain,
        polarity: it.polarity,
        value,
      });
      if (dim) {
        out.push({
          source_type: answerSource(it.kind),
          source_id: sourceId,
          answer_value: String(it.response_value),
          evidence_key: dim.token,
          strength: clamp01(dim.strength),
          confidence: 0.55,
          metadata: {
            source: 'dimension_signal',
            dimension: it.dimension ?? null,
            subdomain: it.subdomain ?? null,
            polarity: it.polarity ?? null,
            distress: round4(dim.strength),
            bucket,
          },
        });
      }
    }

    // 2) Answer-changed mutation → behavioural volatility evidence.
    if (it.answer_changed) {
      out.push({
        source_type: 'mutation',
        source_id: sourceId,
        answer_value: String(it.response_value),
        evidence_key: 'answer_volatility',
        strength: 0.5,
        confidence: 0.55,
        metadata: { item_id: sourceId, bucket },
      });
    }

    // 3) Response-time anomaly → behavioural telemetry evidence.
    const rt = it.response_time_ms;
    if (rt != null && Number.isFinite(Number(rt)) && Number(rt) > 0) {
      const ms = Number(rt);
      if (ms < RAPID_MS) {
        out.push({
          source_type: 'telemetry',
          source_id: sourceId,
          answer_value: null,
          evidence_key: 'rapid_response',
          // Faster than the floor ⇒ stronger anomaly.
          strength: clamp01(0.4 + (RAPID_MS - ms) / RAPID_MS * 0.5),
          confidence: 0.5,
          metadata: { item_id: sourceId, response_time_ms: ms, bucket },
        });
      } else if (ms > SLOW_MS) {
        out.push({
          source_type: 'telemetry',
          source_id: sourceId,
          answer_value: null,
          evidence_key: 'response_hesitation',
          strength: clamp01(0.4 + Math.min(ms - SLOW_MS, SLOW_MS) / SLOW_MS * 0.4),
          confidence: 0.5,
          metadata: { item_id: sourceId, response_time_ms: ms, bucket },
        });
      }
    }
  }

  return out;
}

// ── Schema bootstrap (idempotent, lazy) ─────────────────────────────────────
let schemaPromise: Promise<void> | null = null;

/**
 * Ensure `capadex_evidence` and the additive lifecycle columns on
 * `capadex_session_signals` exist. Cached so the DDL runs at most once per
 * process. Mirrors the lazy-bootstrap convention in `routes/signal-capture.ts`.
 */
export function ensureEvidenceRuntimeSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS capadex_evidence (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id   UUID NOT NULL,
        source_type  VARCHAR(40)  NOT NULL,
        source_id    VARCHAR(255),
        answer_value TEXT,
        evidence_key VARCHAR(120) NOT NULL,
        strength     NUMERIC(5,4) NOT NULL DEFAULT 0,
        confidence   NUMERIC(5,4) NOT NULL DEFAULT 0,
        metadata     JSONB        NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_capadex_evidence_session ON capadex_evidence (session_id);
      CREATE INDEX IF NOT EXISTS idx_capadex_evidence_key     ON capadex_evidence (evidence_key);

      -- Idempotency key: one evidence row per logical event
      -- (session × item × source × signal). Because /respond is upsert-based and
      -- may be retried/replayed with identical payloads, evidence is upserted on
      -- this key rather than appended, so replays refresh-in-place instead of
      -- inflating evidence volume.
      CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_evidence_event
        ON capadex_evidence (session_id, source_id, source_type, evidence_key);

      ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS lifecycle_state   VARCHAR(20);
      ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS strength          NUMERIC(5,4);
      ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS activation_count  INTEGER DEFAULT 0;
      ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS evidence_count    INTEGER DEFAULT 0;
      ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS last_activated_at TIMESTAMPTZ;

      -- Activation-runtime rows (lifecycle_state set) upsert by (session_id, signal_key).
      -- Classifier rows leave lifecycle_state NULL and are unaffected — they may
      -- legitimately repeat per detection, so the index is partial.
      CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_session_signals_activation
        ON capadex_session_signals (session_id, signal_key)
        WHERE lifecycle_state IS NOT NULL;
    `)
    .then(() => undefined)
    .catch((err) => {
      // Reset so a transient failure can be retried on the next request.
      schemaPromise = null;
      throw err;
    });
  return schemaPromise;
}

const INSERT_CHUNK = 100;

/**
 * Persist evidence objects to `capadex_evidence`, upserting on the logical-event
 * key (session × item × source × signal). Replays of the same `/respond` payload
 * refresh the existing row in place rather than appending, so evidence volume
 * stays a function of distinct user activity — not of retry count.
 *
 * Caller is responsible for invoking off the request path (async persistence).
 */
export async function persistEvidence(
  pool: Db,
  sessionId: string,
  evidence: EvidenceObject[],
): Promise<number> {
  if (evidence.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < evidence.length; i += INSERT_CHUNK) {
    const batch = evidence.slice(i, i + INSERT_CHUNK);
    const cols = 8;
    const values: unknown[] = [];
    const tuples = batch.map((e, idx) => {
      const b = idx * cols;
      values.push(
        sessionId,
        e.source_type,
        e.source_id,
        e.answer_value,
        e.evidence_key,
        e.strength,
        e.confidence,
        JSON.stringify(e.metadata ?? {}),
      );
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::jsonb)`;
    });
    const res = await pool.query(
      `INSERT INTO capadex_evidence
         (session_id, source_type, source_id, answer_value, evidence_key, strength, confidence, metadata)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (session_id, source_id, source_type, evidence_key) DO UPDATE SET
         answer_value = EXCLUDED.answer_value,
         strength     = EXCLUDED.strength,
         confidence   = EXCLUDED.confidence,
         metadata     = EXCLUDED.metadata,
         created_at   = NOW()`,
      values,
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

/**
 * Load the full evidence set for a session as evidence objects. The activation
 * runtime recomputes signal state from this complete set on every invocation,
 * which makes the persisted signal state a deterministic function of all evidence
 * (idempotent under replays) rather than an accumulation of per-batch increments.
 */
export async function loadEvidence(pool: Db, sessionId: string): Promise<EvidenceObject[]> {
  const res = await pool.query(
    `SELECT source_type, source_id, answer_value, evidence_key, strength, confidence, metadata
       FROM capadex_evidence
      WHERE session_id = $1
      ORDER BY created_at`,
    [sessionId],
  );
  return (res.rows as Array<{
    source_type: string;
    source_id: string | null;
    answer_value: string | null;
    evidence_key: string;
    strength: string | number;
    confidence: string | number;
    metadata: Record<string, unknown> | null;
  }>).map((r) => ({
    source_type: r.source_type as EvidenceSource,
    source_id: r.source_id,
    answer_value: r.answer_value,
    evidence_key: r.evidence_key,
    strength: Number(r.strength),
    confidence: Number(r.confidence),
    metadata: r.metadata ?? {},
  }));
}

/**
 * CAPADEX Pattern Synthesis Engine (Phase 3 — Part B).
 *
 * The top tier of the behavioural spine:
 *
 *     Answers → Evidence → Signals → Composites → Patterns
 *
 * Synthesises explainable, confidence-scored **behavioural patterns** from four
 * inputs (as the task requires):
 *   - atomic signals     (Phase 2 `capadex_session_signals`)
 *   - composite signals  (Phase 3 Part A)
 *   - contradictions     (atomic signals dampened to `suppressed` by Phase 2)
 *   - telemetry          (aggregated `capadex_session_telemetry`)
 *
 * Patterns are **generated dynamically** — never a hardcoded list. They emerge
 * from the data structure itself:
 *   1. Composite-derived patterns — every formed composite (a hidden-pattern
 *      cluster declared by the ontology) becomes a pattern.
 *   2. Domain-concentration patterns — when several atomic signals from the same
 *      ontology domain (cognitive / emotional / behavioural / …) are co-active,
 *      a `<domain>_concentration` pattern emerges.
 * Confidence is then modulated by contradictions (a penalty when contributing
 * signals were dampened) and telemetry (a boost when hesitation/backtracking
 * corroborates a cognitive/emotional pattern).
 *
 * Each pattern stores `confidence`, `signal_refs`, `composite_refs`,
 * `evidence_refs` and a human-readable `explanation`. Persisted to
 * `capadex_session_patterns` with the same idempotent recompute-and-reconcile
 * invariants as the rest of the runtime.
 */
import type { Pool } from 'pg';
import type { Db } from './evidence-engine';
import { coreToken, type ActiveSignal, type CompositeSignal, type SignalMeta } from './composite-signal-engine';

// ── Tunables ────────────────────────────────────────────────────────────────
/** Min co-active atomic signals in one domain to raise a concentration pattern. */
const DOMAIN_MIN_SIGNALS = 2;
/** Telemetry thresholds mirror the OMEGA-X F1/F2 calibration (docs/CAPADEX.md §15.4). */
const HESITATION_MS = 8_000;
const BACKTRACK_MIN = 3;
const TELEMETRY_BOOST = 0.1;
/** Confidence multiplier applied when a contributing signal was contradicted. */
const CONTRADICTION_PENALTY = 0.85;
/** Domains whose patterns telemetry (hesitation/backtracks) can corroborate. */
const TELEMETRY_DOMAINS = new Set(['cognitive', 'emotional']);

export interface TelemetryAgg {
  avg_hesitation_ms: number;
  total_backtracks: number;
  rows: number;
}

export interface BehaviouralPattern {
  pattern_key: string;
  label: string;
  confidence: number;
  signal_refs: string[];
  composite_refs: string[];
  evidence_refs: string[];
  explanation: string;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
function humanise(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Synthesise behavioural patterns. Pure (no I/O) and fully explainable — every
 * pattern carries the atomic, composite and evidence refs it was built from plus
 * a prose explanation of why it fired and how its confidence was modulated.
 *
 * @param evidenceByToken core-token → evidence ids backing that atomic signal,
 *        used to populate `evidence_refs` (genuine provenance back to evidence).
 */
export function synthesizePatterns(args: {
  active: ActiveSignal[];
  composites: CompositeSignal[];
  signalMeta: Map<string, SignalMeta>;
  telemetry: TelemetryAgg;
  evidenceByToken: Map<string, string[]>;
}): BehaviouralPattern[] {
  const { active, composites, signalMeta, telemetry, evidenceByToken } = args;
  const patterns: BehaviouralPattern[] = [];

  // Contradiction set: atomic signals Phase 2 dampened to 'suppressed'.
  const suppressed = new Set<string>();
  for (const a of active) if (a.lifecycle === 'suppressed') suppressed.add(coreToken(a.signal_key));

  const telemetryActive = telemetry.avg_hesitation_ms > HESITATION_MS || telemetry.total_backtracks >= BACKTRACK_MIN;

  const evidenceFor = (tokens: string[]): string[] => {
    const ids = new Set<string>();
    for (const t of tokens) for (const id of evidenceByToken.get(t) ?? []) ids.add(id);
    return Array.from(ids);
  };

  // ── (1) Composite-derived patterns ─────────────────────────────────────────
  // Each formed composite is a hidden-pattern cluster declared by the ontology.
  for (const c of composites) {
    const tokens = c.signal_refs.map(coreToken);
    const domains = new Set(tokens.map((t) => signalMeta.get(t)?.domain).filter(Boolean) as string[]);
    let confidence = c.confidence;
    const notes: string[] = [`composite ${c.composite_key} (${c.matched_count}/${c.required_signals.length} signals)`];

    const contradicted = tokens.filter((t) => suppressed.has(t));
    if (contradicted.length > 0) {
      confidence *= CONTRADICTION_PENALTY;
      notes.push(`dampened by contradiction on ${contradicted.length} signal(s)`);
    }
    if (telemetryActive && Array.from(domains).some((d) => TELEMETRY_DOMAINS.has(d))) {
      confidence = clamp01(confidence + TELEMETRY_BOOST);
      notes.push('corroborated by response telemetry');
    }

    patterns.push({
      pattern_key: c.composite_key,
      label: c.label,
      confidence: round4(clamp01(confidence)),
      signal_refs: c.signal_refs,
      composite_refs: [c.composite_key],
      evidence_refs: evidenceFor(tokens),
      explanation: `Pattern synthesised from ${notes.join('; ')}.`,
    });
  }

  // ── (2) Domain-concentration patterns ───────────────────────────────────────
  // Group co-active atomic signals by ontology domain.
  const byDomain = new Map<string, ActiveSignal[]>();
  for (const a of active) {
    if (a.lifecycle === 'suppressed' || a.lifecycle === 'inactive') continue;
    const meta = signalMeta.get(coreToken(a.signal_key));
    if (!meta) continue; // only signals known to the ontology carry a domain
    const list = byDomain.get(meta.domain) ?? [];
    list.push(a);
    byDomain.set(meta.domain, list);
  }

  for (const [domain, sigs] of Array.from(byDomain.entries())) {
    if (sigs.length < DOMAIN_MIN_SIGNALS) continue;
    const patternKey = `${domain}_concentration`;
    // Don't duplicate a composite that already covers this exact ground.
    if (patterns.some((p) => p.pattern_key === patternKey)) continue;

    const tokens = sigs.map((s) => coreToken(s.signal_key));
    const meanStrength = sigs.reduce((acc, s) => acc + s.strength, 0) / sigs.length;
    const coverage = Math.min(1, sigs.length / 3);
    let confidence = meanStrength * (0.5 + 0.5 * coverage);
    const notes: string[] = [`${sigs.length} co-active ${domain} signals`];

    const contradicted = tokens.filter((t) => suppressed.has(t));
    if (contradicted.length > 0) {
      confidence *= CONTRADICTION_PENALTY;
      notes.push(`dampened by contradiction on ${contradicted.length} signal(s)`);
    }
    if (telemetryActive && TELEMETRY_DOMAINS.has(domain)) {
      confidence = clamp01(confidence + TELEMETRY_BOOST);
      notes.push('corroborated by response telemetry');
    }

    patterns.push({
      pattern_key: patternKey,
      label: `High ${domain} load`,
      confidence: round4(clamp01(confidence)),
      signal_refs: sigs.map((s) => s.signal_key),
      composite_refs: [],
      evidence_refs: evidenceFor(tokens),
      explanation: `Pattern synthesised from ${notes.join('; ')}.`,
    });
  }

  return patterns;
}

// ── Schema bootstrap (idempotent, lazy) ─────────────────────────────────────
let schemaPromise: Promise<void> | null = null;

/** Ensure `capadex_session_patterns` exists (mirrors the canonical migration). */
export function ensurePatternSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS capadex_session_patterns (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id    UUID NOT NULL,
        pattern_key   VARCHAR(120) NOT NULL,
        label         TEXT,
        confidence    NUMERIC(5,4) NOT NULL DEFAULT 0,
        signal_refs   JSONB NOT NULL DEFAULT '[]',
        composite_refs JSONB NOT NULL DEFAULT '[]',
        evidence_refs JSONB NOT NULL DEFAULT '[]',
        explanation   TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_capadex_patterns_session ON capadex_session_patterns (session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_patterns_session_key
        ON capadex_session_patterns (session_id, pattern_key);
    `)
    .then(() => undefined)
    .catch((err) => {
      schemaPromise = null;
      throw err;
    });
  return schemaPromise;
}

// ── Telemetry load ───────────────────────────────────────────────────────────
/** Aggregate per-session telemetry (best-effort; zeros when absent). */
export async function loadTelemetryAgg(pool: Db, sessionId: string): Promise<TelemetryAgg> {
  try {
    const res = await pool.query(
      `SELECT COALESCE(AVG(hesitation_ms), 0)   AS avg_hesitation_ms,
              COALESCE(SUM(backtrack_count), 0) AS total_backtracks,
              COUNT(*)                          AS rows
         FROM capadex_session_telemetry
        WHERE session_id = $1`,
      [sessionId],
    );
    const r = res.rows[0] ?? {};
    return {
      avg_hesitation_ms: Number(r.avg_hesitation_ms) || 0,
      total_backtracks: Number(r.total_backtracks) || 0,
      rows: Number(r.rows) || 0,
    };
  } catch {
    return { avg_hesitation_ms: 0, total_backtracks: 0, rows: 0 };
  }
}

/**
 * Build core-token → evidence-id index for a session, so patterns can carry real
 * `evidence_refs` tracing back to the rows in `capadex_evidence`.
 */
export async function loadEvidenceRefs(pool: Db, sessionId: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  try {
    const res = await pool.query(
      `SELECT id, evidence_key FROM capadex_evidence WHERE session_id = $1`,
      [sessionId],
    );
    for (const row of res.rows as { id: string; evidence_key: string }[]) {
      const t = coreToken(row.evidence_key);
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(String(row.id));
      map.set(t, list);
    }
  } catch (err) {
    console.error('[pattern-engine] evidence-ref load failed (refs omitted):', err);
  }
  return map;
}

// ── Persistence ──────────────────────────────────────────────────────────────
/**
 * Upsert patterns with absolute values and reconcile away patterns the current
 * recompute no longer produces. Idempotent under replay.
 */
// ── Gap 4 — Longitudinal pattern tracking ─────────────────────────────────────

export interface LongitudinalPattern {
  pattern_key:     string;
  label:           string;
  session_count:   number;
  avg_confidence:  number;
  first_seen:      string | null;
  last_seen:       string | null;
  sessions:        string[];
}

/**
 * Aggregate patterns across all completed sessions for a given guest email.
 * Ordered by session_count DESC so the most-recurring patterns surface first.
 * Returns [] when the table doesn't exist yet or the email has no sessions.
 */
export async function getLongitudinalPatterns(
  pool: Db,
  guestEmail: string,
): Promise<LongitudinalPattern[]> {
  try {
    const { rows } = await pool.query<{
      pattern_key:    string;
      label:          string;
      session_count:  string;
      avg_confidence: string;
      first_seen:     string | null;
      last_seen:      string | null;
      sessions:       string[];
    }>(
      `SELECT p.pattern_key,
              p.label,
              COUNT(DISTINCT p.session_id)::text     AS session_count,
              ROUND(AVG(p.confidence)::numeric, 3)::text AS avg_confidence,
              MIN(s.created_at)::text                AS first_seen,
              MAX(s.updated_at)::text                AS last_seen,
              array_agg(DISTINCT p.session_id)       AS sessions
         FROM capadex_session_patterns p
         JOIN capadex_sessions s ON s.id::text = p.session_id
        WHERE LOWER(s.guest_email) = LOWER($1)
          AND s.status = 'completed'
        GROUP BY p.pattern_key, p.label
        ORDER BY COUNT(DISTINCT p.session_id) DESC,
                 AVG(p.confidence) DESC`,
      [guestEmail],
    );
    return rows.map((r) => ({
      pattern_key:    r.pattern_key,
      label:          r.label,
      session_count:  Number(r.session_count),
      avg_confidence: Number(r.avg_confidence),
      first_seen:     r.first_seen,
      last_seen:      r.last_seen,
      sessions:       Array.isArray(r.sessions) ? r.sessions : [],
    }));
  } catch {
    return [];
  }
}

export async function persistPatterns(
  pool: Db,
  sessionId: string,
  patterns: BehaviouralPattern[],
): Promise<number> {
  const keep = patterns.map((p) => p.pattern_key);
  await pool.query(
    `DELETE FROM capadex_session_patterns
       WHERE session_id = $1 AND pattern_key <> ALL($2::text[])`,
    [sessionId, keep],
  );

  if (patterns.length === 0) return 0;

  let written = 0;
  for (const p of patterns) {
    const res = await pool.query(
      `INSERT INTO capadex_session_patterns
         (session_id, pattern_key, label, confidence, signal_refs, composite_refs,
          evidence_refs, explanation, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, NOW())
       ON CONFLICT (session_id, pattern_key) DO UPDATE SET
         label          = EXCLUDED.label,
         confidence     = EXCLUDED.confidence,
         signal_refs    = EXCLUDED.signal_refs,
         composite_refs = EXCLUDED.composite_refs,
         evidence_refs  = EXCLUDED.evidence_refs,
         explanation    = EXCLUDED.explanation,
         updated_at     = NOW()`,
      [
        sessionId,
        p.pattern_key,
        p.label,
        p.confidence,
        JSON.stringify(p.signal_refs),
        JSON.stringify(p.composite_refs),
        JSON.stringify(p.evidence_refs),
        p.explanation,
      ],
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

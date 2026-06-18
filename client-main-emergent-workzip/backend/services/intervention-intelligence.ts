/**
 * CAPADEX Intervention Intelligence Engine (Phase 2 — Best Next Actions).
 *
 * Generates the TOP 5 Best Next Actions per session. It does NOT invent generic
 * advice — every candidate comes from the existing library-backed
 * `generateInterventions` engine (ontology signal → construct → `intervention_library`
 * copy; emits nothing when there is no real library match). This layer RE-RANKS
 * those candidates using the CAPADEX intelligence graph:
 *
 *     ranking = severity · signal frequency · pattern strength · historical effectiveness
 *
 * Inputs (per the task): signals, patterns, risk flags, CSI, Pragati outcomes —
 * all sourced from the Unified Behavior Graph (`behavior-graph-service.ts`) plus
 * the raw per-session signal/pattern tables and the per-user effectiveness history.
 *
 * Output per action: { intervention, reason, expectedImpact, confidence, reviewWindow }.
 * Persisted (one set per session, absolute upsert + reconciliation) into
 * `capadex_intervention_recommendations`.
 *
 * Every external read is best-effort/wrapped — a missing subsystem degrades the
 * ranking gracefully and NEVER throws to the caller (wired non-blocking on
 * session completion).
 */
import type { Pool } from 'pg';
import {
  generateInterventions,
  loadInterventionRuntime,
  type RankedIntervention,
} from './capadex-intervention-engine';
import type { ActiveSignal } from './composite-signal-engine';
import type { BehaviouralPattern } from './pattern-engine';
import { getBehaviorGraph, buildBehaviorGraph, type BehaviorGraph } from './behavior-graph-service';

// ── Ranking weights (sum = 1) ─────────────────────────────────────────────────
const W_SEVERITY = 0.30;
const W_FREQUENCY = 0.25;
const W_PATTERN = 0.25;
const W_HISTORICAL = 0.20;
const TOP_N = 5;
const ACTIONABLE = new Set(['active', 'dominant']);

// ── Output shape ──────────────────────────────────────────────────────────────
export interface BestNextAction {
  intervention: string;
  reason: string;
  expectedImpact: number;
  confidence: number;
  reviewWindow: string;
  // ── traceability (persisted; not part of the minimal contract) ──
  intervention_key: string;
  construct_key: string;
  description: string;
  severity: number;
  signalFrequency: number;
  patternStrength: number;
  historicalEffectiveness: number;
  score: number;
  rank: number;
  signal_refs: string[];
  pattern_refs: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function pct(n: number): string {
  return `${Math.round(clamp01(n) * 100)}%`;
}
function severityBand(n: number): string {
  return n >= 0.75 ? 'critical' : n >= 0.5 ? 'high' : n >= 0.25 ? 'moderate' : 'low';
}
/** Risk-flag severity string → 0..1. */
function riskSeverityScore(sev: string): number {
  switch (String(sev).toLowerCase()) {
    case 'critical': return 1;
    case 'high': return 0.75;
    case 'medium': return 0.5;
    case 'low': return 0.25;
    default: return 0.5;
  }
}
/** Outcome score may be stored 0..5 or 0..100 — normalise defensively to 0..1. */
function normOutcome(v: number): number {
  if (v <= 0) return 0;
  return v <= 5 ? clamp01(v / 5) : clamp01(v / 100);
}

// ── Lazy schema (mirrors 20260530_intervention_recommendations.sql) ────────────
let schemaReady = false;
export async function ensureInterventionRecommendationsSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_intervention_recommendations (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id                UUID NOT NULL,
      intervention_key          TEXT NOT NULL,
      construct_key             TEXT,
      intervention              TEXT NOT NULL,
      description               TEXT,
      reason                    TEXT NOT NULL,
      expected_impact           NUMERIC(6,4) NOT NULL DEFAULT 0,
      confidence                NUMERIC(6,4) NOT NULL DEFAULT 0,
      review_window             TEXT,
      severity                  NUMERIC(6,4) NOT NULL DEFAULT 0,
      signal_frequency          NUMERIC(6,4) NOT NULL DEFAULT 0,
      pattern_strength          NUMERIC(6,4) NOT NULL DEFAULT 0,
      historical_effectiveness  NUMERIC(6,4) NOT NULL DEFAULT 0,
      score                     NUMERIC(7,4) NOT NULL DEFAULT 0,
      rank                      INTEGER NOT NULL DEFAULT 0,
      signal_refs               JSONB NOT NULL DEFAULT '[]',
      pattern_refs              JSONB NOT NULL DEFAULT '[]',
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, intervention_key)
    )`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_cir_session ON capadex_intervention_recommendations (session_id, rank)`,
  );
  schemaReady = true;
}

// ── Source loaders (best-effort) ──────────────────────────────────────────────

/** Raw active signals — carries activation_count (frequency) + severity for ranking. */
async function loadSignalRows(
  pool: Pool,
  sessionId: string,
): Promise<Map<string, { strength: number; confidence: number; lifecycle: string; activation: number; severity: number }>> {
  const map = new Map<string, { strength: number; confidence: number; lifecycle: string; activation: number; severity: number }>();
  try {
    const { rows } = await pool.query(
      `SELECT signal_key, strength, confidence, lifecycle_state, activation_count, severity
         FROM capadex_session_signals
        WHERE session_id = $1 AND lifecycle_state IS NOT NULL`,
      [sessionId],
    );
    for (const r of rows) {
      map.set(String(r.signal_key), {
        strength: num(r.strength),
        confidence: num(r.confidence),
        lifecycle: String(r.lifecycle_state ?? ''),
        activation: num(r.activation_count),
        severity: num(r.severity),
      });
    }
  } catch {
    /* signal spine absent — empty map */
  }
  return map;
}

/** Behavioural patterns for the session. */
async function loadPatternRows(pool: Pool, sessionId: string): Promise<BehaviouralPattern[]> {
  try {
    const { rows } = await pool.query(
      `SELECT pattern_key, label, confidence, signal_refs, composite_refs, evidence_refs, explanation
         FROM capadex_session_patterns WHERE session_id = $1`,
      [sessionId],
    );
    return rows.map((r) => ({
      pattern_key: String(r.pattern_key),
      label: String(r.label ?? ''),
      confidence: num(r.confidence),
      signal_refs: Array.isArray(r.signal_refs) ? r.signal_refs.map(String) : [],
      composite_refs: Array.isArray(r.composite_refs) ? r.composite_refs.map(String) : [],
      evidence_refs: Array.isArray(r.evidence_refs) ? r.evidence_refs.map(String) : [],
      explanation: String(r.explanation ?? ''),
    }));
  } catch {
    return [];
  }
}

/** Best-effort persona + email for intervention-library copy selection / history lookup. */
async function loadPersona(
  pool: Pool,
  sessionId: string,
): Promise<{ persona: string | null; email: string | null }> {
  try {
    const { rows } = await pool.query(
      `SELECT persona, guest_email FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    return {
      persona: (rows[0]?.persona as string) ?? null,
      email: rows[0]?.guest_email ? String(rows[0].guest_email).toLowerCase() : null,
    };
  } catch {
    return { persona: null, email: null };
  }
}

/** Per-user historical effectiveness from completed enterprise interventions (0..1, neutral 0.5). */
async function loadHistoricalEffectiveness(pool: Pool, email: string | null): Promise<number> {
  if (!email) return 0.5;
  try {
    const { rows } = await pool.query(
      `SELECT AVG(ci.outcome_score) AS avg_out, COUNT(ci.outcome_score) AS n
         FROM capadex_interventions ci
         JOIN capadex_users u ON ci.user_id = u.id
        WHERE LOWER(u.email) = $1 AND ci.outcome_score IS NOT NULL`,
      [email],
    );
    const n = num(rows[0]?.n);
    if (n <= 0) return 0.5;
    return normOutcome(num(rows[0]?.avg_out));
  } catch {
    return 0.5;
  }
}

/**
 * Pragati outcomes — drift/escalation nudge historical-effectiveness + severity.
 * Read directly from `pragati_sessions` (best-effort): the Unified Behavior Graph
 * lists Pragati only as a contributor and does NOT persist drift_direction, so the
 * raw table is the authoritative source for this signal.
 */
async function loadPragatiOutcome(
  pool: Pool,
  sessionId: string,
): Promise<{ histDelta: number; severityDelta: number }> {
  try {
    const { rows } = await pool.query(
      `SELECT drift_direction, escalation_flagged FROM pragati_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows.length) return { histDelta: 0, severityDelta: 0 };
    const drift = String(rows[0].drift_direction ?? '').toLowerCase();
    const escalated = rows[0].escalation_flagged === true;
    let histDelta = 0;
    let severityDelta = 0;
    if (drift.includes('improv') || drift.includes('recover')) histDelta += 0.1;
    if (drift.includes('declin') || drift.includes('worsen')) severityDelta += 0.1;
    if (escalated) severityDelta += 0.15;
    return { histDelta, severityDelta };
  } catch {
    return { histDelta: 0, severityDelta: 0 };
  }
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Generate, rank and persist the Top-5 Best Next Actions for a session.
 * Returns the ranked actions (empty array when no library-backed candidate maps —
 * never a generic recommendation).
 */
export async function generateInterventionIntelligence(
  pool: Pool,
  sessionId: string,
): Promise<BestNextAction[]> {
  // The CAPADEX intelligence graph is the orchestrating input (build if missing).
  let graph: BehaviorGraph | null = await getBehaviorGraph(pool, sessionId);
  if (!graph) {
    graph = await buildBehaviorGraph(pool, sessionId).catch(() => null);
  }

  const [signalMap, patterns, personaInfo, pragati, runtime] = await Promise.all([
    loadSignalRows(pool, sessionId),
    loadPatternRows(pool, sessionId),
    loadPersona(pool, sessionId),
    loadPragatiOutcome(pool, sessionId),
    loadInterventionRuntime(pool).catch(() => null),
  ]);

  const persona: string | null = personaInfo.persona;
  const email: string | null = personaInfo.email;
  const baseHistorical = await loadHistoricalEffectiveness(pool, email);

  // No runtime (library) → nothing library-backed can be produced; honour "never generic".
  if (!runtime) {
    await persistRecommendations(pool, sessionId, []);
    return [];
  }

  // Library-backed candidates from the existing engine (active/dominant signals only).
  const active: ActiveSignal[] = [];
  for (const [signal_key, s] of signalMap.entries()) {
    if (ACTIONABLE.has(s.lifecycle)) {
      active.push({ signal_key, strength: s.strength, confidence: s.confidence, lifecycle: s.lifecycle });
    }
  }
  const candidates: RankedIntervention[] = generateInterventions({ active, patterns, runtime, persona });
  if (!candidates.length) {
    await persistRecommendations(pool, sessionId, []);
    return [];
  }

  // ── Graph-derived ranking context ──
  const riskBoost = graph && graph.risks.length
    ? Math.max(...graph.risks.map((r) => riskSeverityScore(r.severity)))
    : 0;
  const csiContribution = graph?.csiFactors.find((f) => f.kind === 'contribution');
  const csiScore = csiContribution?.value ?? null;
  const headroom = csiScore == null ? 0.5 : clamp01((100 - Math.max(0, Math.min(100, csiScore))) / 100);
  const capacityFactor = 0.85 + 0.3 * headroom; // lower CSI → more headroom → higher reachable impact

  const maxActivation = Math.max(1, ...Array.from(signalMap.values()).map((s) => s.activation));
  const historical = clamp01(baseHistorical + pragati.histDelta);

  const scored: BestNextAction[] = candidates.map((c) => {
    const refs = c.signal_refs ?? [];
    const refRows = refs.map((k) => signalMap.get(k)).filter(Boolean) as Array<{ confidence: number; activation: number }>;

    // severity — candidate ontology severity, lifted by session risk flags + Pragati.
    const severity = clamp01(c.severity * 0.75 + riskBoost * 0.15 + pragati.severityDelta);

    // signal frequency — mean normalised activation_count of contributing signals.
    const signalFrequency = refRows.length
      ? clamp01(mean(refRows.map((r) => r.activation)) / maxActivation)
      : 0;

    // pattern strength — max confidence among patterns that reference these signals.
    const linkedPatterns = patterns.filter((p) => p.signal_refs.some((r) => refs.includes(r)));
    const patternStrength = linkedPatterns.length
      ? clamp01(Math.max(...linkedPatterns.map((p) => p.confidence)))
      : 0;

    const score = round4(
      W_SEVERITY * severity +
      W_FREQUENCY * signalFrequency +
      W_PATTERN * patternStrength +
      W_HISTORICAL * historical,
    );

    const expectedImpact = clamp01(round4(c.expected_impact * (0.75 + 0.5 * historical) * capacityFactor));
    const avgRefConf = refRows.length ? mean(refRows.map((r) => r.confidence)) : c.confidence;
    const confidence = clamp01(round4(0.6 * c.confidence + 0.4 * avgRefConf));

    // Non-generic reason — grounded in the actual contributing signals / pattern / history.
    const topSignals = [...refs]
      .sort((a, b) => num(signalMap.get(b)?.activation) - num(signalMap.get(a)?.activation))
      .slice(0, 2)
      .join(', ');
    const patternClause = linkedPatterns.length
      ? ` and the '${linkedPatterns[0].label || linkedPatterns[0].pattern_key}' pattern (strength ${pct(patternStrength)})`
      : '';
    const reason =
      `Targets ${c.construct_key} — driven by ${refs.length} active signal(s)` +
      (topSignals ? ` (${topSignals})` : '') +
      patternClause +
      `; severity ${severityBand(severity)}, ${pct(historical)} historical effectiveness.`;

    return {
      intervention: c.title || c.construct_key,
      reason,
      expectedImpact,
      confidence,
      reviewWindow: c.review_window || '2 weeks',
      intervention_key: c.intervention_key,
      construct_key: c.construct_key,
      description: c.description || '',
      severity: round4(severity),
      signalFrequency: round4(signalFrequency),
      patternStrength: round4(patternStrength),
      historicalEffectiveness: round4(historical),
      score,
      rank: 0,
      signal_refs: refs,
      pattern_refs: c.pattern_refs ?? [],
    };
  });

  scored.sort((a, b) => b.score - a.score || b.expectedImpact - a.expectedImpact);
  const top = scored.slice(0, TOP_N).map((a, i) => ({ ...a, rank: i + 1 }));

  await persistRecommendations(pool, sessionId, top);
  return top;
}

/** Absolute upsert + reconciliation — exactly the Top-N set per session. */
export async function persistRecommendations(
  pool: Pool,
  sessionId: string,
  actions: BestNextAction[],
): Promise<void> {
  await ensureInterventionRecommendationsSchema(pool);
  try {
    const keep = actions.map((a) => a.intervention_key);
    // Reconcile: drop any prior recommendation for this session no longer in the set.
    if (keep.length) {
      await pool.query(
        `DELETE FROM capadex_intervention_recommendations
           WHERE session_id = $1 AND intervention_key <> ALL($2::text[])`,
        [sessionId, keep],
      );
    } else {
      await pool.query(`DELETE FROM capadex_intervention_recommendations WHERE session_id = $1`, [sessionId]);
    }
    for (const a of actions) {
      await pool.query(
        `INSERT INTO capadex_intervention_recommendations (
            session_id, intervention_key, construct_key, intervention, description, reason,
            expected_impact, confidence, review_window, severity, signal_frequency,
            pattern_strength, historical_effectiveness, score, rank, signal_refs, pattern_refs, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NOW())
         ON CONFLICT (session_id, intervention_key) DO UPDATE SET
            construct_key            = EXCLUDED.construct_key,
            intervention             = EXCLUDED.intervention,
            description              = EXCLUDED.description,
            reason                   = EXCLUDED.reason,
            expected_impact          = EXCLUDED.expected_impact,
            confidence               = EXCLUDED.confidence,
            review_window            = EXCLUDED.review_window,
            severity                 = EXCLUDED.severity,
            signal_frequency         = EXCLUDED.signal_frequency,
            pattern_strength         = EXCLUDED.pattern_strength,
            historical_effectiveness = EXCLUDED.historical_effectiveness,
            score                    = EXCLUDED.score,
            rank                     = EXCLUDED.rank,
            signal_refs              = EXCLUDED.signal_refs,
            pattern_refs             = EXCLUDED.pattern_refs,
            updated_at               = NOW()`,
        [
          sessionId,
          a.intervention_key,
          a.construct_key,
          a.intervention,
          a.description,
          a.reason,
          a.expectedImpact,
          a.confidence,
          a.reviewWindow,
          a.severity,
          a.signalFrequency,
          a.patternStrength,
          a.historicalEffectiveness,
          a.score,
          a.rank,
          JSON.stringify(a.signal_refs),
          JSON.stringify(a.pattern_refs),
        ],
      );
    }
  } catch {
    /* persistence best-effort — never breaks the caller */
  }
}

/** Read the persisted Best Next Actions for a session (ranked). */
export async function getInterventionRecommendations(
  pool: Pool,
  sessionId: string,
): Promise<BestNextAction[]> {
  try {
    await ensureInterventionRecommendationsSchema(pool);
    const { rows } = await pool.query(
      `SELECT * FROM capadex_intervention_recommendations WHERE session_id = $1 ORDER BY rank ASC`,
      [sessionId],
    );
    return rows.map((r) => ({
      intervention: String(r.intervention),
      reason: String(r.reason),
      expectedImpact: num(r.expected_impact),
      confidence: num(r.confidence),
      reviewWindow: String(r.review_window ?? ''),
      intervention_key: String(r.intervention_key),
      construct_key: String(r.construct_key ?? ''),
      description: String(r.description ?? ''),
      severity: num(r.severity),
      signalFrequency: num(r.signal_frequency),
      patternStrength: num(r.pattern_strength),
      historicalEffectiveness: num(r.historical_effectiveness),
      score: num(r.score),
      rank: num(r.rank),
      signal_refs: Array.isArray(r.signal_refs) ? r.signal_refs.map(String) : [],
      pattern_refs: Array.isArray(r.pattern_refs) ? r.pattern_refs.map(String) : [],
    }));
  } catch {
    return [];
  }
}

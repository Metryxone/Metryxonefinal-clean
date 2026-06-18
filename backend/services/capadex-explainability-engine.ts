/**
 * CAPADEX Explainability Engine (Phase 4 — Part A).
 *
 * Read-only assembly of the full behavioural lineage:
 *
 *     Evidence → Signal → Composite → Pattern → Intervention
 *
 * Every higher-order conclusion the runtime persists (a pattern, an intervention)
 * is fully traceable back through the composites and atomic signals that formed it,
 * down to the raw evidence rows. This module performs NO computation and NO writes —
 * it only reads the persisted spine tables and stitches them into an explainable
 * graph for the three Phase-4 endpoints:
 *
 *   GET /api/capadex/session/:id/signals   → active atomic signals
 *   GET /api/capadex/session/:id/patterns  → synthesised behavioural patterns
 *   GET /api/capadex/session/:id/explain   → per-pattern lineage (the full chain)
 *
 * NB: distinct from `explainability-engine.ts` (Phase 5 composite-score
 * decomposition / `wrap()` envelopes) — this one is the CAPADEX behavioural spine.
 */
import type { Db } from './evidence-engine';

// ── Row shapes ────────────────────────────────────────────────────────────────
export interface SignalRow {
  signal_key: string;
  lifecycle_state: string | null;
  strength: number;
  confidence: number;
  activation_count: number;
  evidence_count: number;
}

export interface CompositeRow {
  composite_key: string;
  label: string | null;
  strength: number;
  confidence: number;
  matched_count: number;
  required_signals: string[];
  signal_refs: string[];
}

export interface PatternRow {
  pattern_key: string;
  label: string | null;
  confidence: number;
  signal_refs: string[];
  composite_refs: string[];
  evidence_refs: string[];
  explanation: string | null;
}

export interface EvidenceRow {
  id: string;
  evidence_key: string;
  source_type: string;
  answer_value: string | null;
  strength: number;
  confidence: number;
}

export interface InterventionRow {
  intervention_key: string;
  construct_key: string;
  title: string | null;
  description: string | null;
  rationale: string | null;
  effort: string | null;
  duration: string | null;
  expected_impact: number;
  confidence: number;
  review_window: string | null;
  safety_level: string | null;
  severity: number;
  signal_refs: string[];
  pattern_refs: string[];
  rank: number;
}

/** One node of the explainability graph — a pattern and everything it traces to. */
export interface PatternLineage {
  pattern: string;
  label: string | null;
  confidence: number;
  explanation: string | null;
  contributing_signals: SignalRow[];
  contributing_composites: CompositeRow[];
  evidence: EvidenceRow[];
  interventions: InterventionRow[];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

// ── Loaders (read-only) ──────────────────────────────────────────────────────
/** Active atomic signals for a session (activation-runtime rows only). */
export async function getSessionSignals(db: Db, sessionId: string): Promise<SignalRow[]> {
  const res = await db.query(
    `SELECT signal_key, lifecycle_state, strength, confidence, activation_count, evidence_count
       FROM capadex_session_signals
      WHERE session_id = $1 AND lifecycle_state IS NOT NULL
      ORDER BY strength DESC, confidence DESC`,
    [sessionId],
  );
  return (res.rows as any[]).map((r) => ({
    signal_key: r.signal_key,
    lifecycle_state: r.lifecycle_state,
    strength: num(r.strength),
    confidence: num(r.confidence),
    activation_count: num(r.activation_count),
    evidence_count: num(r.evidence_count),
  }));
}

export async function getSessionComposites(db: Db, sessionId: string): Promise<CompositeRow[]> {
  try {
    const res = await db.query(
      `SELECT composite_key, label, strength, confidence, matched_count, required_signals, signal_refs
         FROM capadex_session_composites
        WHERE session_id = $1
        ORDER BY confidence DESC`,
      [sessionId],
    );
    return (res.rows as any[]).map((r) => ({
      composite_key: r.composite_key,
      label: r.label,
      strength: num(r.strength),
      confidence: num(r.confidence),
      matched_count: num(r.matched_count),
      required_signals: arr(r.required_signals),
      signal_refs: arr(r.signal_refs),
    }));
  } catch {
    return [];
  }
}

export async function getSessionPatterns(db: Db, sessionId: string): Promise<PatternRow[]> {
  const res = await db.query(
    `SELECT pattern_key, label, confidence, signal_refs, composite_refs, evidence_refs, explanation
       FROM capadex_session_patterns
      WHERE session_id = $1
      ORDER BY confidence DESC`,
    [sessionId],
  );
  return (res.rows as any[]).map((r) => ({
    pattern_key: r.pattern_key,
    label: r.label,
    confidence: num(r.confidence),
    signal_refs: arr(r.signal_refs),
    composite_refs: arr(r.composite_refs),
    evidence_refs: arr(r.evidence_refs),
    explanation: r.explanation,
  }));
}

export async function getSessionInterventions(db: Db, sessionId: string): Promise<InterventionRow[]> {
  try {
    const res = await db.query(
      `SELECT intervention_key, construct_key, title, description, rationale, effort, duration,
              expected_impact, confidence, review_window, safety_level, severity,
              signal_refs, pattern_refs, rank
         FROM capadex_session_interventions
        WHERE session_id = $1
        ORDER BY rank ASC`,
      [sessionId],
    );
    return (res.rows as any[]).map((r) => ({
      intervention_key: r.intervention_key,
      construct_key: r.construct_key,
      title: r.title,
      description: r.description,
      rationale: r.rationale,
      effort: r.effort,
      duration: r.duration,
      expected_impact: num(r.expected_impact),
      confidence: num(r.confidence),
      review_window: r.review_window,
      safety_level: r.safety_level,
      severity: num(r.severity),
      signal_refs: arr(r.signal_refs),
      pattern_refs: arr(r.pattern_refs),
      rank: num(r.rank),
    }));
  } catch {
    return [];
  }
}

async function getEvidenceByIds(db: Db, sessionId: string, ids: string[]): Promise<Map<string, EvidenceRow>> {
  const map = new Map<string, EvidenceRow>();
  if (ids.length === 0) return map;
  try {
    const res = await db.query(
      `SELECT id, evidence_key, source_type, answer_value, strength, confidence
         FROM capadex_evidence
        WHERE session_id = $1 AND id = ANY($2::uuid[])`,
      [sessionId, ids],
    );
    for (const r of res.rows as any[]) {
      map.set(String(r.id), {
        id: String(r.id),
        evidence_key: r.evidence_key,
        source_type: r.source_type,
        answer_value: r.answer_value,
        strength: num(r.strength),
        confidence: num(r.confidence),
      });
    }
  } catch {
    /* evidence refs may be empty / table absent — lineage degrades gracefully */
  }
  return map;
}

// ── Lineage assembly ──────────────────────────────────────────────────────────
/**
 * Build the full per-pattern lineage for a session. Each pattern is resolved into
 * the atomic signals, composites, evidence rows and interventions it traces to —
 * the complete, explainable Evidence→Signal→Composite→Pattern→Intervention chain.
 */
export async function getSessionExplanation(db: Db, sessionId: string): Promise<{
  session_id: string;
  generated_at: string;
  lineage: PatternLineage[];
}> {
  const [signals, composites, patterns, interventions] = await Promise.all([
    getSessionSignals(db, sessionId),
    getSessionComposites(db, sessionId),
    getSessionPatterns(db, sessionId),
    getSessionInterventions(db, sessionId),
  ]);

  const signalByKey = new Map(signals.map((s) => [s.signal_key, s]));
  const compositeByKey = new Map(composites.map((c) => [c.composite_key, c]));

  // Resolve all evidence ids referenced by any pattern in one query.
  const allEvidenceIds = Array.from(new Set(patterns.flatMap((p) => p.evidence_refs)));
  const evidenceById = await getEvidenceByIds(db, sessionId, allEvidenceIds);

  const lineage: PatternLineage[] = patterns.map((p) => ({
    pattern: p.pattern_key,
    label: p.label,
    confidence: p.confidence,
    explanation: p.explanation,
    contributing_signals: p.signal_refs
      .map((k) => signalByKey.get(k))
      .filter((x): x is SignalRow => Boolean(x)),
    contributing_composites: p.composite_refs
      .map((k) => compositeByKey.get(k))
      .filter((x): x is CompositeRow => Boolean(x)),
    evidence: p.evidence_refs
      .map((id) => evidenceById.get(id))
      .filter((x): x is EvidenceRow => Boolean(x)),
    interventions: interventions.filter((it) => it.pattern_refs.includes(p.pattern_key)),
  }));

  return {
    session_id: sessionId,
    generated_at: new Date().toISOString(),
    lineage,
  };
}

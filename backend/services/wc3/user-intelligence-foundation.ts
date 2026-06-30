/**
 * CAPADEX WC-L0 — User Intelligence Foundation (Persistence Layer).
 *
 * Foundation for Longitudinal Intelligence, Personalization, Commercial Intelligence and Future
 * Readiness. It does NOT introduce any new intelligence engine — it PERSISTS the outputs of EXISTING
 * intelligence into ONE durable row per completed session (`wcl0_user_intelligence`):
 *
 *   Lever 1 — Persona Intelligence : persona + age-band segment + context. Persona reuses the
 *             existing detection logic (free-text keyword classifier mirrored from
 *             `detectPersona` in routes/capadex-concern-intelligence.ts) and the existing canonical
 *             normalisation; every value is PROVENANCE-STAMPED `selected | runtime | derived_text |
 *             derived_default` with a confidence so accuracy stays honest (legacy sessions that
 *             never selected a persona are DERIVED, never presented as user-selected).
 *
 *   Lever 2 — Behaviour Intelligence : the 6 dimensions (motivation, confidence, risk, engagement,
 *             learning_style, adaptability) PROJECTED from the already-built Unified Behavior Graph
 *             (`getBehaviorGraph`). A dimension is filled ONLY when a real graph signal/risk speaks
 *             to it; otherwise it stays NULL. Behaviour is NEVER fabricated from score — sessions
 *             with no captured behavioural signals honestly carry no behaviour dimensions.
 *
 *   Lever 3 — Longitudinal Snapshot : delegates to the existing `captureLongitudinalSnapshot`
 *             (history capture only) so every completed assessment gets one snapshot.
 *
 * Lazy ensure-schema (idempotent CREATE TABLE IF NOT EXISTS), mirroring the WC-3 pattern. Gated by
 * `isUserIntelligenceFoundationEnabled()` at the call site. NON-BLOCKING + NEVER-THROWS — any
 * failure logs and returns null so it can never break session completion. Flag OFF → no schema, no
 * write → byte-identical legacy behaviour.
 */
import type { Pool } from 'pg';
import { getBehaviorGraph, type BehaviorGraph } from '../behavior-graph-service';
import { captureLongitudinalSnapshot } from './longitudinal-foundation';
import { canonicalStageFor } from './stage-intelligence';
import { isBehaviourNamespaceAlignmentEnabled } from '../../config/feature-flags';

let schemaReady = false;

/** Lazy, idempotent schema for the persisted user-intelligence foundation. Mirrors WC-3. */
export async function ensureUserIntelligenceSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wcl0_user_intelligence (
      session_id            text PRIMARY KEY,
      user_email            text,
      -- Lever 1: persona intelligence
      persona               text,
      persona_segment       text,
      persona_context       text,
      persona_source        text,
      persona_confidence    numeric,
      -- Lever 2: behaviour intelligence (NULL when no real behavioural signals)
      motivation            numeric,
      confidence            numeric,
      risk                  numeric,
      engagement            numeric,
      learning_style        text,
      adaptability          numeric,
      behaviour_source      text NOT NULL DEFAULT 'absent',
      behaviour_dims_present integer NOT NULL DEFAULT 0,
      -- Lever 3: longitudinal snapshot linkage
      snapshot_captured     boolean NOT NULL DEFAULT false,
      -- provenance + audit
      provenance            jsonb NOT NULL DEFAULT '{}'::jsonb,
      resolved_at           timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wcl0_ui_email   ON wcl0_user_intelligence(user_email);
    CREATE INDEX IF NOT EXISTS idx_wcl0_ui_persona ON wcl0_user_intelligence(persona);
  `);
  schemaReady = true;
}

// ── Lever 1 helpers — persona/segment/context (reuse existing classifier) ─────────────────────

/**
 * Mirrors `detectPersona` in routes/capadex-concern-intelligence.ts (the canonical free-text
 * persona classifier). Kept in lockstep here so the service stays dependency-light and avoids
 * pulling the ~13k-line route graph into the post-completion hook / offline scripts. Returns
 * `{ persona, derivedFromText }` so we can distinguish a real keyword hit from the default fall-through.
 */
function detectPersonaFromText(text: string): { persona: string; derivedFromText: boolean } {
  const t = text || '';
  if (/my child|my son|my daughter|my kid|my ward|for my child/i.test(t)) return { persona: 'parent', derivedFromText: true };
  if (/my students|my classroom|my class|my pupils|as a teacher/i.test(t)) return { persona: 'teacher', derivedFromText: true };
  if (/my employees|my staff|my team|my workers|at workplace|my organisation/i.test(t)) return { persona: 'hr', derivedFromText: true };
  if (/career|job|interview|workplace|professional/i.test(t)) return { persona: 'professional', derivedFromText: true };
  return { persona: 'student', derivedFromText: false };
}

/** Proxy personas assess on behalf of someone else → context is relational, not self-directed. */
function isProxyPersona(persona: string): boolean {
  return persona === 'parent' || persona === 'teacher' || persona === 'hr' || persona === 'counselor';
}

interface PersonaResolution {
  persona: string | null;
  segment: string | null;
  context: string | null;
  source: 'selected' | 'runtime' | 'derived_text' | 'derived_default' | 'absent';
  confidence: number;
}

/**
 * Resolve persona/segment/context from EXISTING stored intelligence, in priority order:
 *   1. capadex_sessions.persona (user-selected)        → confidence 1.0
 *   2. capadex_runtime_sessions.actor_persona (runtime) → confidence 0.9
 *   3. detectPersona(concern_name) keyword hit          → confidence 0.5 (derived_text)
 *   4. detectPersona default fall-through               → confidence 0.3 (derived_default)
 * Segment = the stored age_band (the 5-bucket cohort model). Context = self-directed vs relational
 * (from proxy persona). Honest: NOTHING here invents a persona the data can't support.
 */
async function resolvePersona(
  pool: Pool,
  sessionId: string,
  storedPersona: string | null,
  ageBand: string | null,
  concernName: string | null,
): Promise<PersonaResolution> {
  let persona: string | null = null;
  let source: PersonaResolution['source'] = 'absent';
  let confidence = 0;

  if (storedPersona && storedPersona !== 'null' && storedPersona.trim() !== '') {
    persona = storedPersona;
    source = 'selected';
    confidence = 1.0;
  } else {
    // runtime context (best-effort; table may have no row)
    try {
      const { rows } = await pool.query(
        `SELECT actor_persona FROM capadex_runtime_sessions WHERE session_id::text = $1 LIMIT 1`,
        [sessionId],
      );
      const actor = rows[0]?.actor_persona;
      if (actor && String(actor).trim() !== '') {
        persona = String(actor);
        source = 'runtime';
        confidence = 0.9;
      }
    } catch { /* table absent / no row — honest skip */ }

    if (persona === null) {
      const det = detectPersonaFromText(concernName ?? '');
      persona = det.persona;
      source = det.derivedFromText ? 'derived_text' : 'derived_default';
      confidence = det.derivedFromText ? 0.5 : 0.3;
    }
  }

  const segment = ageBand && ageBand.trim() !== '' ? ageBand : null;
  const context = persona
    ? (isProxyPersona(persona.toLowerCase().trim()) ? 'relational_proxy' : 'self_directed')
    : null;
  return { persona, segment, context, source, confidence };
}

// ── Lever 2 helpers — behaviour dimensions projected from the Unified Behavior Graph ──────────

const SEVERITY_SCORE: Record<string, number> = { critical: 90, high: 75, medium: 50, low: 25 };

// ── WC-L0D — Behaviour Namespace Alignment (flag-gated, additive, deficits-only) ─────────────
//
// WC-L0C established that the runtime emits ONLY concern-diagnostic signal keys, which never match
// the positive-construct regexes used by the legacy projection — so motivation/confidence/engagement/
// adaptability are structurally NULL. This map ROUTES the EXISTING concern signal keys to the
// EXISTING construct dimensions as a POLARITY-AWARE DEFICIT: a present concern signal lowers the
// construct (value = min(50, 100 − strength) — capped at neutral so a concern can never assert a
// strength). It introduces NO new construct / dimension / ontology / scoring model — only a routing of
// already-emitted signals to already-existing dims.

/** The construct dimensions a concern signal can DEFICIT-code (never strengthen). */
export type ConstructDim = 'motivation' | 'confidence' | 'engagement' | 'adaptability';

/**
 * Curated 1:1 deficit map over the signal keys the activation runtime actually emits WITH a readable
 * strength. Deliberately UNMAPPED (mapping them would fabricate a dimension):
 *   - `GENERAL_CONCERN`                                  → non-specific catch-all (no single construct).
 *   - `rapid_answer` / `rapid_answer_pattern` / `prolonged_hesitation`
 *                                                        → latency telemetry emitted with NULL strength
 *                                                          (no deficit magnitude to inverse-code);
 *                                                          left as future curated candidates.
 */
export const SIGNAL_DEFICIT_MAP: Record<string, ConstructDim> = {
  avoidance_pattern:  'motivation',
  career_confusion:   'motivation',
  social_withdrawal:  'confidence',
  placement_anxiety:  'confidence',
  cognitive_blocking: 'adaptability',
  emotional_overload: 'engagement',
};

/**
 * Strongest readable mapped concern signal for `dim` → LOW construct level (deficit), or null when no
 * mapped signal with a positive strength exists. DEFICITS ONLY: value = min(50, round(100 − strength)).
 * The neutral cap (50) is the canon guard: a concern signal can mark a construct as impaired
 * (≤ neutral) but can NEVER assert an above-neutral STRENGTH. For a genuine deficit (strength ≥ 0.5)
 * this is the exact inverse (100 − strength); a weak concern (strength < 0.5) is floored at neutral 50
 * rather than producing a high value that could be misread as a strength (strengths come ONLY from
 * positive sources, never from concern-signal magnitude). A NULL / ≤0 strength is "no readable deficit
 * magnitude" → contributes nothing (never coerced to 0).
 */
function deficitByDim(graph: BehaviorGraph, dim: ConstructDim): number | null {
  let maxStrength = 0;
  for (const s of graph.signals ?? []) {
    if (SIGNAL_DEFICIT_MAP[s.signal_key] !== dim) continue;
    const v = Number(s.strength);
    if (!Number.isFinite(v) || v <= 0) continue;
    const scaled = v <= 1 ? v * 100 : v;
    if (scaled > maxStrength) maxStrength = scaled;
  }
  if (maxStrength <= 0) return null;
  return Math.min(50, Math.round(100 - maxStrength));
}

/** Max strength (0..100) among graph signals whose key matches `re`, or null when none match. */
function strengthByKey(graph: BehaviorGraph, re: RegExp): number | null {
  const hits = (graph.signals ?? []).filter((s) => re.test(s.signal_key));
  if (hits.length === 0) return null;
  const max = Math.max(...hits.map((s) => {
    const v = Number(s.strength);
    return Number.isFinite(v) ? (v <= 1 ? v * 100 : v) : 0;
  }));
  return Math.round(max);
}

export interface ProjectBehaviourOptions {
  /**
   * WC-L0D — when true, fill the construct dims (motivation / confidence / engagement / adaptability)
   * that the positive-construct regex path left NULL with a polarity-aware DEFICIT inferred from the
   * mapped concern signals. Default false → byte-identical legacy projection (construct dims NULL).
   */
  namespaceAlignment?: boolean;
}

export interface BehaviourProjection {
  motivation: number | null;
  confidence: number | null;
  risk: number | null;
  engagement: number | null;
  learning_style: string | null;
  adaptability: number | null;
  source: 'behavior_graph' | 'absent';
  dimsPresent: number;
  /** WC-L0D — construct dims whose value came from the deficit map (not the positive regex path). */
  deficitDims: ConstructDim[];
}

/**
 * Project the 6 behaviour dimensions from the ALREADY-BUILT Unified Behavior Graph. This reads
 * existing graph fields only (signal strengths, risk severities, pattern labels) — it computes no
 * new scores. A dimension is filled ONLY when the graph actually speaks to it; otherwise NULL.
 * No graph → every dimension NULL and source 'absent' (behaviour was never captured — honest).
 *
 * WC-L0D (opts.namespaceAlignment): when enabled, the four construct dims the positive-construct regex
 * path left NULL are additionally filled with a polarity-aware DEFICIT from the mapped concern signals
 * (deficits only — positive evidence from the regex path is NEVER overwritten). Flag OFF → the deficit
 * block is skipped → the projection is byte-identical to legacy.
 */
export function projectBehaviour(graph: BehaviorGraph | null, opts: ProjectBehaviourOptions = {}): BehaviourProjection {
  if (!graph) {
    return { motivation: null, confidence: null, risk: null, engagement: null, learning_style: null, adaptability: null, source: 'absent', dimsPresent: 0, deficitDims: [] };
  }

  // Legacy positive-construct projection (unchanged): matches positive / self_* signal keys.
  let motivation = strengthByKey(graph, /motiv|drive|goal|ambition|persist/i);
  let confidence = strengthByKey(graph, /confidence|self_doubt|self_efficacy|reliab|assur/i);
  let engagement = strengthByKey(graph, /engag|effort|considered|attention|focus/i);
  let adaptability = strengthByKey(graph, /adapt|reframing|flexib|composure|resilien/i);

  // WC-L0D Behaviour Namespace Alignment (additive, deficits-only). Fill ONLY the construct dims the
  // positive path left NULL with an inverse-coded deficit from mapped concern signals. Positive
  // evidence (a non-null regex hit) always wins and is never overwritten.
  const deficitDims: ConstructDim[] = [];
  if (opts.namespaceAlignment) {
    const fillDeficit = (current: number | null, dim: ConstructDim): number | null => {
      if (current !== null) return current;
      const d = deficitByDim(graph, dim);
      if (d !== null) deficitDims.push(dim);
      return d;
    };
    motivation = fillDeficit(motivation, 'motivation');
    confidence = fillDeficit(confidence, 'confidence');
    engagement = fillDeficit(engagement, 'engagement');
    adaptability = fillDeficit(adaptability, 'adaptability');
  }

  // risk: take the strongest of (graph risk severities, risk-typed signals).
  const riskFromRisks = (graph.risks ?? [])
    .map((r) => SEVERITY_SCORE[String(r.severity).toLowerCase()] ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const riskFromSignals = strengthByKey(graph, /risk|burnout|overwhelm|crisis|distress/i) ?? 0;
  const riskRaw = Math.max(riskFromRisks, riskFromSignals);
  const risk = riskRaw > 0 ? riskRaw : null;

  // learning_style: dominant pattern label (existing text), else null. A label, not a fabricated score.
  const learning_style = (graph.patterns ?? [])
    .map((p) => p.label)
    .filter((l): l is string => !!l && l.trim() !== '')[0] ?? null;

  const dims = [motivation, confidence, risk, engagement, adaptability];
  const dimsPresent = dims.filter((d) => d !== null).length + (learning_style ? 1 : 0);
  const source: BehaviourProjection['source'] = dimsPresent > 0 ? 'behavior_graph' : 'absent';
  return { motivation, confidence, risk, engagement, learning_style, adaptability, source, dimsPresent, deficitDims };
}

// ── Public API ───────────────────────────────────────────────────────────────────────────────

export interface UserIntelligenceRow {
  session_id: string;
  persona: string | null;
  persona_segment: string | null;
  persona_context: string | null;
  persona_source: string;
  persona_confidence: number;
  behaviour_dims_present: number;
  behaviour_source: string;
  snapshot_captured: boolean;
}

/**
 * Persist the user-intelligence foundation for one completed session. Reads EXISTING intelligence
 * (session row, runtime context, behavior graph), persists persona/segment/context + behaviour
 * dimensions, and delegates the longitudinal snapshot to the existing capture fn. UPSERTs ONE row.
 * Returns the row summary on success, null on any failure (non-blocking). NEVER throws.
 */
export async function persistUserIntelligence(pool: Pool, sessionId: string): Promise<UserIntelligenceRow | null> {
  try {
    await ensureUserIntelligenceSchema(pool);

    const { rows: sRows } = await pool.query(
      `SELECT id, guest_email, persona, age_band, concern_name, stage_code, score
         FROM capadex_sessions WHERE id::text = $1 LIMIT 1`,
      [sessionId],
    );
    if (sRows.length === 0) return null; // unknown session — nothing to persist
    const s = sRows[0];
    const email: string | null = s.guest_email ? String(s.guest_email).toLowerCase() : null;
    const score: number | null = s.score == null ? null : Number(s.score);

    // Lever 1 — persona / segment / context (existing classifier + stored age_band)
    const p = await resolvePersona(pool, sessionId, s.persona ?? null, s.age_band ?? null, s.concern_name ?? null);

    // Lever 2 — behaviour dimensions projected from the existing Unified Behavior Graph.
    // WC-L0D: when the namespace-alignment flag is ON, construct dims the positive path leaves NULL
    // are additionally filled with deficit-coded values from mapped concern signals. Flag OFF →
    // byte-identical legacy projection.
    const graph = await getBehaviorGraph(pool, sessionId);
    const namespaceAlignment = isBehaviourNamespaceAlignmentEnabled();
    const b = projectBehaviour(graph, { namespaceAlignment });

    // Lever 3 — ENSURE AT LEAST ONE longitudinal snapshot exists for this session (idempotent for
    // sequential runs). The existing `captureLongitudinalSnapshot` is append-only with no unique
    // constraint, and other hooks may also write one, so we only capture when none exists yet — this
    // keeps backfill re-runnable and avoids duplicates on the normal sequential path (a concurrent
    // double-complete could still append two; presence is guaranteed, strict uniqueness is not).
    let snapshotCaptured = false;
    try {
      const { rows: snapRows } = await pool.query(
        `SELECT 1 FROM wc3_longitudinal_snapshots WHERE session_id::text = $1 LIMIT 1`,
        [sessionId],
      );
      snapshotCaptured = snapRows.length > 0;
    } catch { /* table may not exist yet — capture below will create it */ }
    if (!snapshotCaptured) {
      snapshotCaptured = await captureLongitudinalSnapshot(pool, {
        sessionId,
        userEmail: email,
        concernName: s.concern_name ?? null,
        stageCode: s.stage_code ?? null,
        canonicalStage: canonicalStageFor(s.stage_code ?? null),
        score,
        scoreLevel: null,
      });
    }

    const provenance = {
      persona: { source: p.source, confidence: p.confidence, segment_from: 'age_band', context_from: 'persona_proxy' },
      behaviour: { source: b.source, dims_present: b.dimsPresent, from: 'unified_behavior_graph', graph_present: graph !== null, namespace_alignment: namespaceAlignment, deficit_dims: b.deficitDims },
      snapshot: { captured: snapshotCaptured, via: 'captureLongitudinalSnapshot' },
      generated_at: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO wcl0_user_intelligence (
         session_id, user_email,
         persona, persona_segment, persona_context, persona_source, persona_confidence,
         motivation, confidence, risk, engagement, learning_style, adaptability,
         behaviour_source, behaviour_dims_present,
         snapshot_captured, provenance, resolved_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now(), now()
       )
       ON CONFLICT (session_id) DO UPDATE SET
         user_email             = EXCLUDED.user_email,
         persona                = EXCLUDED.persona,
         persona_segment        = EXCLUDED.persona_segment,
         persona_context        = EXCLUDED.persona_context,
         persona_source         = EXCLUDED.persona_source,
         persona_confidence     = EXCLUDED.persona_confidence,
         motivation             = EXCLUDED.motivation,
         confidence             = EXCLUDED.confidence,
         risk                   = EXCLUDED.risk,
         engagement             = EXCLUDED.engagement,
         learning_style         = EXCLUDED.learning_style,
         adaptability           = EXCLUDED.adaptability,
         behaviour_source       = EXCLUDED.behaviour_source,
         behaviour_dims_present = EXCLUDED.behaviour_dims_present,
         snapshot_captured      = EXCLUDED.snapshot_captured,
         provenance             = EXCLUDED.provenance,
         updated_at             = now()`,
      [
        sessionId, email,
        p.persona, p.segment, p.context, p.source, p.confidence,
        b.motivation, b.confidence, b.risk, b.engagement, b.learning_style, b.adaptability,
        b.source, b.dimsPresent,
        snapshotCaptured, JSON.stringify(provenance),
      ],
    );

    return {
      session_id: sessionId,
      persona: p.persona,
      persona_segment: p.segment,
      persona_context: p.context,
      persona_source: p.source,
      persona_confidence: p.confidence,
      behaviour_dims_present: b.dimsPresent,
      behaviour_source: b.source,
      snapshot_captured: snapshotCaptured,
    };
  } catch (err) {
    console.warn(
      '[wcl0-user-intelligence] persist failed (non-blocking):',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Read-only fetch of the persisted user-intelligence row for a session (null when absent / error). */
export async function getUserIntelligence(pool: Pool, sessionId: string): Promise<Record<string, unknown> | null> {
  try {
    await ensureUserIntelligenceSchema(pool);
    const { rows } = await pool.query(`SELECT * FROM wcl0_user_intelligence WHERE session_id = $1 LIMIT 1`, [sessionId]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

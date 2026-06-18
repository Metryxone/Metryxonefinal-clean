/**
 * Intervention Engine — Phase 1 S10
 *
 * Generates persona-adaptive, emotionally-safe intervention recommendations
 * by combining:
 *   1. Behavioural hypotheses (S3)
 *   2. S4 confidence traces — effective confidence per hypothesis
 *   3. Cognitive load (S6) — composite_load from cognitive_load_snapshots
 *   4. Signal profile — emotional_load from capadex_signal_profiles
 *   5. Longitudinal memory context (S8, if available)
 *
 * Feature-flag: `interventions` — callers should check isEnabled before invoking.
 */

import type { Pool } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SafetyLevel       = 'informational' | 'supportive' | 'referral';
export type ConfidenceBand    = 'high' | 'moderate' | 'low';
export type EmotionalLoadBand = 'high' | 'moderate' | 'low';
export type Persona           = 'student' | 'parent' | 'teacher' | 'counsellor';

export interface GeneratedIntervention {
  construct_key:        string;
  hypothesis_label:     string;
  text:                 string;
  rationale:            string;
  safety_level:         SafetyLevel;
  confidence:           number;
  confidence_band:      ConfidenceBand;
  emotional_load_band:  EmotionalLoadBand;
  why_selected:         string;
  override_allowed:     true;
  pending_human_review: boolean;   // true when safety_level === 'referral'
}

// ─── Typed DB row shapes ──────────────────────────────────────────────────────

interface HypothesisRow {
  id:            string;
  construct_key: string;
  label:         string;
  confidence:    string;
}

interface TraceRow {
  hypothesis_id:    string;
  confidence_after: string;
}

interface LibraryRow {
  id:                string;
  intervention_text: string;
  rationale:         string;
  safety_level:      SafetyLevel;
}

interface SessionRow {
  persona: string | null;
}

interface CognitiveLoadRow {
  avg_composite: string;
}

interface SignalProfileRow {
  emotional_load:   string | null;
  engagement_score: string | null;
}

interface MemoryRow {
  longitudinal_memory: {
    session_count?:        number;
    recurring_constructs?: string[];
    behavioural_drift?:    string;
  } | null;
}

// ─── Band helpers ─────────────────────────────────────────────────────────────

function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.65) return 'high';
  if (score >= 0.35) return 'moderate';
  return 'low';
}

function emotionalLoadBand(load: number): EmotionalLoadBand {
  if (load >= 65) return 'high';
  if (load >= 35) return 'moderate';
  return 'low';
}

const VALID_PERSONAS: Persona[] = ['student', 'parent', 'teacher', 'counsellor'];

function resolvePersona(raw: string | null | undefined): Persona {
  if (raw && VALID_PERSONAS.includes(raw as Persona)) return raw as Persona;
  return 'student';
}

// ─── Core generation ──────────────────────────────────────────────────────────

export async function generateInterventions(
  pool: Pool,
  sessionId: string,
): Promise<GeneratedIntervention[]> {
  // 1. Load session persona
  const { rows: sessionRows } = await pool.query<SessionRow>(
    `SELECT persona FROM capadex_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  const persona = resolvePersona(sessionRows[0]?.persona);

  // 2. Load active hypotheses
  const { rows: hypotheses } = await pool.query<HypothesisRow>(
    `SELECT id, construct_key, label, confidence::numeric
     FROM behavioural_hypotheses
     WHERE session_id = $1 AND lifecycle_state = 'active'
     ORDER BY confidence DESC`,
    [sessionId]
  );
  if (hypotheses.length === 0) return [];

  // 3. Load latest S4 confidence traces per hypothesis
  const hypothesisIds = hypotheses.map(h => h.id);
  const { rows: traceRows } = await pool.query<TraceRow>(
    `SELECT DISTINCT ON (hypothesis_id)
       hypothesis_id, confidence_after
     FROM confidence_traces
     WHERE hypothesis_id = ANY($1::uuid[])
     ORDER BY hypothesis_id, created_at DESC`,
    [hypothesisIds]
  );
  const traceMap: Record<string, number> = {};
  for (const t of traceRows) {
    traceMap[t.hypothesis_id] = parseFloat(t.confidence_after);
  }

  // 4. Compute effective confidence from S4 trace, fallback to base
  interface EnrichedHypothesis extends HypothesisRow {
    effective_confidence: number;
  }
  const enriched: EnrichedHypothesis[] = hypotheses.map(h => ({
    ...h,
    effective_confidence: traceMap[h.id] ?? parseFloat(h.confidence),
  }));
  enriched.sort((a, b) => b.effective_confidence - a.effective_confidence);

  // 5. Load cognitive load (average composite for session)
  const { rows: clRows } = await pool.query<CognitiveLoadRow>(
    `SELECT AVG(composite_load)::numeric AS avg_composite
     FROM cognitive_load_snapshots
     WHERE session_id = $1`,
    [sessionId]
  );
  const cognitiveLoadRaw = parseFloat(clRows[0]?.avg_composite ?? '0') || 0;

  // 6. Load signal profile: emotional load + engagement quality (S2 BIOS)
  const { rows: spRows } = await pool.query<SignalProfileRow>(
    `SELECT emotional_load, engagement_score FROM capadex_signal_profiles
     WHERE session_id = $1 ORDER BY id DESC LIMIT 1`,
    [sessionId]
  );
  // cognitive_load_snapshots uses 0–1 scale; signal profiles use 0–100
  // Normalise cognitive load to 0-100 for the band check
  const cogLoad100 = cognitiveLoadRaw > 1 ? cognitiveLoadRaw : cognitiveLoadRaw * 100;
  const emotionalLoadRaw  = parseFloat(spRows[0]?.emotional_load   ?? '0') || 0;
  const engagementQuality = parseFloat(spRows[0]?.engagement_score ?? '50') || 50;

  // Combined emotional load: weighted average of emotional signal + cognitive load proxy
  const combinedLoad = emotionalLoadRaw * 0.7 + cogLoad100 * 0.3;
  const elBand = emotionalLoadBand(combinedLoad);

  // Engagement quality band: high(>65) → stronger, low(<35) → may need extra support
  const engagementContext = engagementQuality >= 65
    ? 'high engagement quality — individual is actively engaged'
    : engagementQuality >= 35
    ? 'moderate engagement quality — partial engagement'
    : 'low engagement quality — disengaged or fatigued';

  // 7. Load S8 longitudinal memory context (non-blocking; null if not yet built)
  // Written by hook #10 into cognitive_runtime_state.state->'longitudinal_memory'
  let recurringConstructs: Set<string> = new Set();
  let behaviouralDrift = 'unknown';
  let memorySessionCount = 0;
  try {
    const { rows: memRows } = await pool.query<MemoryRow>(
      `SELECT state->'longitudinal_memory' AS longitudinal_memory
       FROM cognitive_runtime_state
       WHERE session_id = $1::uuid
       LIMIT 1`,
      [sessionId]
    );
    const mem = memRows[0]?.longitudinal_memory;
    if (mem) {
      recurringConstructs = new Set(mem.recurring_constructs ?? []);
      behaviouralDrift    = mem.behavioural_drift ?? 'unknown';
      memorySessionCount  = mem.session_count     ?? 0;
    }
  } catch { /* S8 not yet available for this session — proceed without */ }

  // Re-sort enriched hypotheses to promote constructs that match S8 recurring patterns
  // (persistent constructs are higher priority for intervention)
  enriched.sort((a, b) => {
    const aRecurring = recurringConstructs.has(a.construct_key) ? 1 : 0;
    const bRecurring = recurringConstructs.has(b.construct_key) ? 1 : 0;
    if (bRecurring !== aRecurring) return bRecurring - aRecurring; // recurring first
    return b.effective_confidence - a.effective_confidence;       // then by confidence
  });

  // 8. Select best library entry per hypothesis
  const interventions: GeneratedIntervention[] = [];
  const seenConstructs = new Set<string>();

  for (const h of enriched.slice(0, 8)) {
    if (seenConstructs.has(h.construct_key)) continue;
    if (interventions.length >= 3) break;

    const cBand = confidenceBand(h.effective_confidence);
    const isRecurring = recurringConstructs.has(h.construct_key);

    // Primary: exact match on construct/confidence/load/persona
    // Fallback 1: any load band for same construct/confidence/persona
    // Fallback 2: student persona fallback
    // Fallback 3: any confidence band, any persona
    const { rows: candidates } = await pool.query<LibraryRow>(
      `SELECT id, intervention_text, rationale, safety_level
       FROM intervention_library
       WHERE construct_key = $1
         AND confidence_band = $2
         AND is_active = true
       ORDER BY
         CASE WHEN emotional_load_band = $3 THEN 0 ELSE 1 END,
         CASE WHEN persona = $4 THEN 0 WHEN persona = 'student' THEN 1 ELSE 2 END,
         id
       LIMIT 1`,
      [h.construct_key, cBand, elBand, persona]
    );

    if (!candidates[0]) {
      // Broader fallback: any confidence band
      const { rows: fallback } = await pool.query<LibraryRow>(
        `SELECT id, intervention_text, rationale, safety_level
         FROM intervention_library
         WHERE construct_key = $1 AND is_active = true
         ORDER BY
           CASE WHEN persona = $2 THEN 0 WHEN persona = 'student' THEN 1 ELSE 2 END,
           id
         LIMIT 1`,
        [h.construct_key, persona]
      );
      if (!fallback[0]) continue;
      candidates.push(fallback[0]);
    }

    const lib = candidates[0];
    const isPendingReview = lib.safety_level === 'referral';

    // Build why_selected: incorporates confidence (S4), emotional load,
    // engagement quality, and S8 longitudinal memory context
    const whyParts: string[] = [
      `Hypothesis "${h.label}" active at ${(h.effective_confidence * 100).toFixed(0)}% effective confidence (S4 trace)`,
      `Emotional load: ${combinedLoad.toFixed(0)}/100 → ${elBand} band`,
      `Engagement quality: ${engagementQuality.toFixed(0)}/100 — ${engagementContext}`,
      `Persona: ${persona}`,
    ];
    if (isRecurring && memorySessionCount > 1) {
      whyParts.push(`S8 longitudinal memory: recurring construct across ${memorySessionCount} sessions — prioritised for persistent pattern intervention`);
    }
    if (behaviouralDrift !== 'unknown' && behaviouralDrift !== 'stable') {
      whyParts.push(`Behavioural drift: ${behaviouralDrift}`);
    }
    if (isPendingReview) {
      whyParts.push('SAFETY FLAG: referral-level — requires human counsellor review before delivery');
    }

    interventions.push({
      construct_key:        h.construct_key,
      hypothesis_label:     h.label,
      text:                 lib.intervention_text,
      rationale:            lib.rationale,
      safety_level:         lib.safety_level,
      confidence:           h.effective_confidence,
      confidence_band:      cBand,
      emotional_load_band:  elBand,
      why_selected:         whyParts.join('. '),
      override_allowed:     true,
      pending_human_review: isPendingReview,
    });

    seenConstructs.add(h.construct_key);
  }

  return interventions;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistInterventions(
  pool:          Pool,
  sessionId:     string,
  userId:        string | null,
  interventions: GeneratedIntervention[],
): Promise<void> {
  for (const iv of interventions) {
    const status = iv.pending_human_review ? 'pending_review' : 'active';
    await pool.query(
      `INSERT INTO capadex_recommendations
         (session_id, user_id, concern_name, stage_code, score, score_level,
          category, title, description, action_items, priority, reasoning, source, status)
       SELECT
         cs.id,
         $2,
         cs.concern_name,
         cs.stage_code,
         cs.score,
         cs.score_level,
         $3,
         $4,
         $5,
         '[]'::jsonb,
         1,
         $6,
         'intervention_engine',
         $7
       FROM capadex_sessions cs
       WHERE cs.id = $1
       LIMIT 1
       ON CONFLICT DO NOTHING`,
      [
        sessionId,
        userId,
        iv.construct_key,
        iv.hypothesis_label,
        iv.text,
        iv.why_selected,
        status,
      ]
    );
  }
}

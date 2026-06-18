/**
 * Contradiction Intelligence Engine — Phase 1 S5
 *
 * Detects logically or emotionally inconsistent response patterns within a
 * CAPADEX assessment session. When contradictions are found the engine:
 *   1. Writes a `contradiction_events` row.
 *   2. Calls the S4 confidence engine to reduce confidence on affected hypotheses.
 *   3. Updates `contradiction_state` in cognitive_runtime_state via S1.
 *
 * All contradiction events are internal intelligence signals only — they are
 * never surfaced directly to the user in any user-facing copy.
 *
 * Contradiction types detected:
 *   score_reversal        — high then low (or vice versa) on the same subdomain
 *   emotional_masking     — extreme positive response immediately after extreme negative
 *   self_perception_bias  — maximum self-rating amidst a pattern of low scores
 *   defensive_answering   — rapid run of 5+ consecutive maximum responses
 *
 * Public API contract (matches task spec):
 *   `detectContradictions(pool, sessionId, newAnswer, tenantId?)`
 *   — Single-answer form called once per submitted item. The caller iterates
 *     over the response batch and invokes this for each answer non-blockingly.
 *   — All session-wide rules are evaluated against the full response history
 *     (including the just-saved `newAnswer`). `newAnswer` specifically scopes
 *     the emotional_masking rule to the triggering item and provides the
 *     response_value context for defensive_answering rapidity classification.
 *   — At most one new event is written per contradiction type within a 60-second
 *     window; this prevents duplicate writes when the same batch triggers the
 *     same rule on consecutive items while preserving history across the session.
 *
 * Hypothesis targeting:
 *   Subdomain-level contradictions (score_reversal, self_perception_bias) target
 *   only hypotheses whose construct_key matches the affected subdomain (normalised
 *   word-overlap). Falls back to all active hypotheses when no match is found.
 *   Session-wide contradictions (emotional_masking, defensive_answering) always
 *   target all active hypotheses.
 */

import type { Pool } from 'pg';
import { isEnabled }             from './feature-flags';
import { isAdaptiveQuestioningEnabled } from '../config/feature-flags';
import { onContradictionDetected } from './confidence-engine';
import { updateState }           from './cognitive-state';
import { broadcastToSession }    from './ws-broadcast';
import { buildTraitMap, type PriorAnswer } from './adaptive/trait-inference';
import { detectTraitContradictions } from './adaptive/contradiction-pairs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContradictionType =
  | 'score_reversal'
  | 'emotional_masking'
  | 'self_perception_bias'
  | 'defensive_answering'
  // Phase B (T8) adaptive cross-trait pairs — only written when the
  // `adaptiveQuestioning` flag is ON (and the matching migration is applied).
  | 'confidence_avoidance'
  | 'perfectionism_rapid_execution'
  | 'confidence_performance_gap';

export type ContradictionSeverity = 'low' | 'medium' | 'high';

/** New-answer descriptor passed to detectContradictions — matches task spec. */
export interface NewAnswer {
  item_id:        string;
  response_value: number;
}

export interface ContradictionReport {
  contradiction_type:      ContradictionType;
  severity:                ContradictionSeverity;
  affected_hypothesis_ids: string[];
  response_ids:            string[];
  description:             string;
  recommended_action:      string;
  contradiction_score:     number;   // 0–1 passed to S4 confidence engine
  /** Subdomains involved; undefined means session-wide signal */
  affected_subdomains?:    string[];
}

interface ResponseRow {
  item_id:        string;
  response_value: number;
  raw_score:      number;
  subdomain_code: string | null;
  polarity:       string;
  created_at:     string;
  /** Item stem text — used only by the adaptive trait-pair rule (Phase B). */
  question:       string | null;
}

interface HypothesisRow {
  id:            string;
  construct_key: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGH_SCORE_THRESHOLD   = 0.66;  // raw_score above this → high
const LOW_SCORE_THRESHOLD    = 0.33;  // raw_score below this → low
const EXTREME_HIGH_RESPONSE  = 4;     // response_value ≥ this → extreme positive
const EXTREME_LOW_RAW        = 0.25;  // raw_score ≤ this → extreme distress
const REVERSAL_MIN_RESPONSES = 3;     // min responses per subdomain to trigger score_reversal
const DEFENSIVE_RUN_LENGTH   = 5;     // consecutive max responses to flag defensive_answering
const RAPID_WINDOW_MS        = 30_000; // 30 s — run submitted within this window is "rapid"
const DEDUP_WINDOW_SECONDS   = 60;    // suppress duplicate type within this many seconds

const CONTRADICTION_SCORES: Record<ContradictionType, number> = {
  score_reversal:       0.70,
  emotional_masking:    0.60,
  self_perception_bias: 0.50,
  defensive_answering:  0.40,
  // Cross-trait pairs carry a moderate-to-high confidence penalty: they reflect
  // a genuine self-report tension worth resolving, not mere response noise.
  confidence_avoidance:          0.55,
  perfectionism_rapid_execution: 0.50,
  confidence_performance_gap:    0.55,
};

// ─── Rule: score_reversal ─────────────────────────────────────────────────────

/**
 * Within the same subdomain, high-scoring and low-scoring responses coexist.
 * Indicates genuine volatility or inconsistent self-reporting across items
 * that measure the same construct.
 */
function detectScoreReversal(
  responses: ResponseRow[],
): ContradictionReport | null {
  const bySubdomain = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    if (!r.subdomain_code) continue;
    const bucket = bySubdomain.get(r.subdomain_code) ?? [];
    bucket.push(r);
    bySubdomain.set(r.subdomain_code, bucket);
  }

  for (const [subdomain, rows] of bySubdomain) {
    if (rows.length < REVERSAL_MIN_RESPONSES) continue;

    const highs = rows.filter(r => r.raw_score >= HIGH_SCORE_THRESHOLD);
    const lows  = rows.filter(r => r.raw_score <= LOW_SCORE_THRESHOLD);

    if (highs.length === 0 || lows.length === 0) continue;

    const highAvg = highs.reduce((s, r) => s + r.raw_score, 0) / highs.length;
    const lowAvg  = lows.reduce((s, r) => s + r.raw_score, 0) / lows.length;
    const gap     = highAvg - lowAvg;

    const severity: ContradictionSeverity =
      gap >= 0.55 ? 'high' : gap >= 0.40 ? 'medium' : 'low';

    return {
      contradiction_type:      'score_reversal',
      severity,
      affected_hypothesis_ids: [],
      response_ids:            rows.map(r => r.item_id),
      affected_subdomains:     [subdomain],
      description:
        `Score reversal detected in subdomain "${subdomain}": ` +
        `high-scoring responses (avg ${highAvg.toFixed(2)}) ` +
        `coexist with low-scoring responses (avg ${lowAvg.toFixed(2)}), ` +
        `gap = ${gap.toFixed(2)}.`,
      recommended_action:
        'Review response consistency for this construct. ' +
        'Consider presenting verification questions to clarify the pattern.',
      contradiction_score: CONTRADICTION_SCORES.score_reversal,
    };
  }

  return null;
}

// ─── Rule: emotional_masking ──────────────────────────────────────────────────

/**
 * The triggering new answer is an extreme positive response (response_value ≥ 4)
 * that temporally follows at least one prior extreme-distress response (raw_score
 * ≤ 0.25). Strict temporal ordering is enforced via `created_at` comparison so
 * the distress must precede the masking response — not merely coexist.
 */
function detectEmotionalMasking(
  responses:    ResponseRow[],
  newAnswer:    NewAnswer,
): ContradictionReport | null {
  // Only relevant when the triggering answer is extreme positive
  if (newAnswer.response_value < EXTREME_HIGH_RESPONSE) return null;

  const newRow = responses.find(r => r.item_id === newAnswer.item_id);
  const newTs  = newRow ? new Date(newRow.created_at).getTime() : Date.now();

  // Must find a prior distress item with a STRICTLY earlier timestamp
  const priorDistress = responses.filter(r =>
    r.item_id !== newAnswer.item_id &&
    r.raw_score <= EXTREME_LOW_RAW &&
    new Date(r.created_at).getTime() < newTs
  );

  if (priorDistress.length === 0) return null;

  return {
    contradiction_type:      'emotional_masking',
    severity:                'medium',
    affected_hypothesis_ids: [],
    response_ids:            [
      ...priorDistress.map(r => r.item_id),
      newAnswer.item_id,
    ],
    description:
      `Emotional masking pattern detected: ${priorDistress.length} ` +
      `prior extreme-distress response(s) followed by an extreme-positive ` +
      `response on item "${newAnswer.item_id}".`,
    recommended_action:
      'Potential emotional masking detected. Proceed with empathy. ' +
      'Consider presenting a wellbeing check before continuing.',
    contradiction_score: CONTRADICTION_SCORES.emotional_masking,
  };
}

// ─── Rule: self_perception_bias ───────────────────────────────────────────────

/**
 * Within a subdomain with a low average score, the respondent gives at least
 * one maximum-value response. Indicates a gap between self-perceived and
 * assessed capability.
 */
function detectSelfPerceptionBias(
  responses: ResponseRow[],
): ContradictionReport | null {
  const bySubdomain = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    if (!r.subdomain_code) continue;
    const bucket = bySubdomain.get(r.subdomain_code) ?? [];
    bucket.push(r);
    bySubdomain.set(r.subdomain_code, bucket);
  }

  for (const [subdomain, rows] of bySubdomain) {
    if (rows.length < REVERSAL_MIN_RESPONSES) continue;

    const avgScore    = rows.reduce((s, r) => s + r.raw_score, 0) / rows.length;
    const maxResponse = Math.max(...rows.map(r => r.response_value));

    if (avgScore < LOW_SCORE_THRESHOLD && maxResponse >= EXTREME_HIGH_RESPONSE) {
      return {
        contradiction_type:      'self_perception_bias',
        severity:                'medium',
        affected_hypothesis_ids: [],
        response_ids:            rows.map(r => r.item_id),
        affected_subdomains:     [subdomain],
        description:
          `Self-perception bias detected in subdomain "${subdomain}": ` +
          `average score is ${avgScore.toFixed(2)} (low) but ` +
          `maximum response given was ${maxResponse} (high).`,
        recommended_action:
          'Self-perception gap detected. Consider presenting reflective ' +
          'prompts to help the respondent reconcile their self-rating.',
        contradiction_score: CONTRADICTION_SCORES.self_perception_bias,
      };
    }
  }

  return null;
}

// ─── Rule: defensive_answering ────────────────────────────────────────────────

/**
 * Five or more consecutive maximum-value responses. Rapidity is assessed via
 * the `created_at` timestamps on the run items: if all were submitted within
 * 30 seconds, the run is classified as "rapid" (severity = high), which better
 * matches "rapid uniform positive responses" semantics. Slower runs are still
 * flagged (severity = medium) as they may still indicate uniform defensiveness.
 *
 * Note: fine-grained per-question timing (ms-level) is captured by the
 * signal-capture service (/api/signals/ingest) and stored in
 * `capadex_session_signals`. The 30-second window here uses session-response
 * `created_at`, which is a coarser but available proxy for submission speed.
 */
function detectDefensiveAnswering(
  responses: ResponseRow[],
  newAnswer:  NewAnswer,
): ContradictionReport | null {
  // Only worth evaluating when the triggering answer is max-value
  if (newAnswer.response_value < EXTREME_HIGH_RESPONSE) return null;

  const sorted = [...responses].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let runStart = -1;
  let runLen   = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].response_value >= EXTREME_HIGH_RESPONSE) {
      if (runLen === 0) runStart = i;
      runLen++;
      if (runLen >= DEFENSIVE_RUN_LENGTH) {
        const runItems = sorted.slice(runStart, runStart + runLen);

        // Rapidity classification via created_at span
        const times   = runItems.map(r => new Date(r.created_at).getTime());
        const span    = Math.max(...times) - Math.min(...times);
        const isRapid = span <= RAPID_WINDOW_MS;

        const severity: ContradictionSeverity = isRapid ? 'high' : 'medium';

        return {
          contradiction_type:      'defensive_answering',
          severity,
          affected_hypothesis_ids: [],
          response_ids:            runItems.map(r => r.item_id),
          description:
            `Defensive answering pattern detected: ${runLen} consecutive ` +
            `maximum-value responses` +
            (isRapid
              ? ` submitted rapidly within ${Math.round(span / 1000)}s`
              : ` starting at response ${runStart + 1}`) +
            `.`,
          recommended_action:
            'Defensive response pattern detected. Ensure psychological ' +
            'safety has been established. Consider a reframing prompt.',
          contradiction_score: CONTRADICTION_SCORES.defensive_answering,
        };
      }
    } else {
      runLen   = 0;
      runStart = -1;
    }
  }

  return null;
}

// ─── Helpers: DB access ───────────────────────────────────────────────────────

// NOTE: pg returns `numeric` columns as strings; we cast to float8 in SQL and
// additionally coerce with Number() at the JS boundary to guarantee arithmetic
// operations work correctly in all rule functions.

interface ResponseRowRaw {
  item_id:        string;
  response_value: string | number;
  raw_score:      string | number;
  subdomain_code: string | null;
  polarity:       string;
  created_at:     string;
  question:       string | null;
}

async function loadSessionResponses(
  pool:      Pool,
  sessionId: string,
): Promise<ResponseRow[]> {
  const { rows } = await pool.query<ResponseRowRaw>(
    `SELECT
       cr.item_id,
       cr.response_value::float8                               AS response_value,
       COALESCE(cr.raw_score::float8, 0)                      AS raw_score,
       COALESCE(si.subdomain_code, saq.dimension)             AS subdomain_code,
       COALESCE(si.polarity, saq.polarity, '(+)')             AS polarity,
       COALESCE(si.question, saq.question_text)               AS question,
       cr.created_at
     FROM capadex_responses cr
     LEFT JOIN sdi_items si
       ON si.id::text = cr.item_id AND cr.item_id !~ '^[0-9]+$'
     LEFT JOIN short_assessment_questions saq
       ON saq.id::text = cr.item_id AND cr.item_id ~ '^[0-9]+$'
     WHERE cr.session_id = $1
     ORDER BY cr.created_at ASC`,
    [sessionId]
  );
  return rows.map(r => ({
    item_id:        r.item_id,
    response_value: Number(r.response_value),
    raw_score:      Number(r.raw_score),
    subdomain_code: r.subdomain_code,
    polarity:       r.polarity,
    created_at:     r.created_at,
    question:       r.question,
  }));
}

// ─── Rule: adaptive cross-trait contradiction pairs (Phase B, T8) ─────────────

/**
 * Detects the three named cross-trait contradictions (confidence+avoidance,
 * perfectionism+rapid-execution, low-confidence+strong-performance) over the
 * session's answered items, reusing the SAME pure rule the adaptive selection
 * pipeline uses so detection never drifts between selection-time and
 * persistence-time.
 *
 * Distress-intensity normalisation: the pure trait engine models each answer as
 * a distress intensity in 0..1. We derive that from the raw `response_value`
 * scaled by the largest value observed this session (min scale 4 → 5-point
 * Likert) and flip polarity so a high answer on a positively-worded `(+)` item
 * counts as LOW distress. Items with no stem text are skipped (the trait
 * vocabulary is keyword-based).
 *
 * Returns at most one report PER pair type (highest-severity instance).
 */
function detectTraitPairContradictions(
  responses: ResponseRow[],
): ContradictionReport[] {
  const scored = responses.filter(r => r.question && Number.isFinite(r.response_value));
  if (scored.length < 2) return [];

  const scaleMax = Math.max(4, ...scored.map(r => r.response_value));
  const priorAnswers: PriorAnswer[] = scored.map((r) => {
    const norm = scaleMax > 0 ? r.response_value / scaleMax : 0;
    // '(-)' (distress-worded) → high answer = high distress; '(+)' inverts.
    const distress = r.polarity === '(+)' ? 1 - norm : norm;
    return {
      id: r.item_id,
      question: r.question as string,
      response_value: distress < 0 ? 0 : distress > 1 ? 1 : distress,
    };
  });

  const found = detectTraitContradictions(buildTraitMap(priorAnswers));
  if (found.length === 0) return [];

  return found.map((c): ContradictionReport => ({
    contradiction_type:      c.type,
    severity:                c.severity,
    affected_hypothesis_ids: [],
    response_ids:            scored.map(r => r.item_id),
    description:             c.description,
    recommended_action:
      'Cross-trait tension detected. Prioritise probing ' +
      `${c.probe_traits.join(' & ')} to resolve the inconsistency before scoring.`,
    contradiction_score:     CONTRADICTION_SCORES[c.type],
  }));
}

async function loadActiveHypotheses(
  pool:      Pool,
  sessionId: string,
): Promise<HypothesisRow[]> {
  const { rows } = await pool.query<HypothesisRow>(
    `SELECT id, construct_key
     FROM behavioural_hypotheses
     WHERE session_id = $1 AND lifecycle_state IN ('active','reactivated')`,
    [sessionId]
  );
  return rows;
}

/**
 * Atomically inserts a contradiction_events row ONLY IF no event of the same
 * type was written for this session within DEDUP_WINDOW_SECONDS. The check and
 * insert are a single SQL statement, so concurrent calls from the per-response
 * loop cannot both pass the guard and create duplicate events or double-apply
 * confidence penalties.
 *
 * Returns the new row's id, or null when the dedup window is still active.
 */
async function writeContradictionEventAtomic(
  pool:      Pool,
  sessionId: string,
  report:    ContradictionReport,
): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO contradiction_events
       (session_id, contradiction_type, severity,
        affected_hypothesis_ids, response_ids,
        description, recommended_action)
     SELECT $1,$2,$3,$4,$5,$6,$7
     WHERE NOT EXISTS (
       SELECT 1 FROM contradiction_events
       WHERE session_id        = $1
         AND contradiction_type = $2
         AND created_at        > NOW() - ($8 || ' seconds')::interval
     )
     RETURNING id`,
    [
      sessionId,
      report.contradiction_type,
      report.severity,
      JSON.stringify(report.affected_hypothesis_ids),
      JSON.stringify(report.response_ids),
      report.description,
      report.recommended_action,
      DEDUP_WINDOW_SECONDS,
    ]
  );
  return rows[0]?.id ?? null;
}

// ─── Helper: cognitive_runtime_state sync ────────────────────────────────────

/**
 * Queries the CUMULATIVE contradiction record for this session from the DB and
 * writes the aggregate totals into `cognitive_runtime_state.contradiction_state`.
 * Doing this from the DB (not from the in-call `reports`) ensures the state
 * reflects all unresolved events across the session, not just the current call.
 */
async function syncContradictionState(
  pool:            Pool,
  sessionId:       string,
  newlyWrittenTypes: ContradictionType[],
  hypotheses:      HypothesisRow[],
): Promise<void> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(sessionId)) return;

  interface SessionTotals {
    total_unresolved: string;
    all_hypothesis_ids: string | null;
  }

  // LEFT JOIN LATERAL so events with empty affected_hypothesis_ids arrays are
  // still counted — an implicit cross-join would silently drop them and produce
  // total_unresolved = 0 when all events have empty arrays.
  // COUNT(DISTINCT ce.id) counts events, not the unnested hypothesis-ID rows.
  const { rows } = await pool.query<SessionTotals>(
    `SELECT
       COUNT(DISTINCT ce.id)                AS total_unresolved,
       string_agg(DISTINCT elem.value, ',') AS all_hypothesis_ids
     FROM contradiction_events ce
     LEFT JOIN LATERAL jsonb_array_elements_text(ce.affected_hypothesis_ids) AS elem(value)
       ON TRUE
     WHERE ce.session_id = $1 AND ce.resolved = FALSE`,
    [sessionId]
  );

  const totalUnresolved = parseInt(rows[0]?.total_unresolved ?? '0', 10);
  const rawHypIds       = rows[0]?.all_hypothesis_ids ?? '';
  const allHypIds       = rawHypIds ? rawHypIds.split(',').filter(Boolean) : [];

  const hypById = new Map<string, string>(hypotheses.map(h => [h.id, h.construct_key]));
  const affectedConstructs = [...new Set(allHypIds.map(id => hypById.get(id)).filter((k): k is string => k !== undefined))];

  await updateState(pool, sessionId, {
    contradiction_state: {
      detected:            totalUnresolved > 0,
      event_count:         totalUnresolved,
      affected_constructs: affectedConstructs,
      last_detected_at:    new Date().toISOString(),
    },
  }, `contradiction_detected:${newlyWrittenTypes.join(',')}`);
}

// ─── Helper: hypothesis targeting by subdomain ────────────────────────────────

/**
 * Returns IDs of hypotheses whose construct_key word-overlaps with any of the
 * affected subdomains. Falls back to all active hypothesis IDs when no match is
 * found — prevents silent no-ops where no confidence penalty is applied.
 *
 * Normalisation: lowercase → strip non-alphanumeric → split → match on words ≥4 chars.
 * Example: "screen_distraction" ↔ "Screen_Distraction" → match
 *          "work_stress"         ↔ "Micro-Practice"     → no match → fallback to all
 */
function targetHypothesesBySubdomain(
  hypotheses:         HypothesisRow[],
  affectedSubdomains: string[],
): string[] {
  if (hypotheses.length === 0 || affectedSubdomains.length === 0) {
    return hypotheses.map(h => h.id);
  }

  function words(s: string): Set<string> {
    return new Set(
      s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
    );
  }

  const subdomainWordSets = affectedSubdomains.map(words);

  function overlaps(constructKey: string): boolean {
    const ckWords = words(constructKey);
    for (const swSet of subdomainWordSets) {
      for (const w of ckWords) {
        if (swSet.has(w) && w.length >= 4) return true;
      }
    }
    return false;
  }

  const matched = hypotheses.filter(h => overlaps(h.construct_key)).map(h => h.id);
  return matched.length > 0 ? matched : hypotheses.map(h => h.id);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Contradiction detection entry point — single-answer form (task spec contract).
 *
 * Called non-blockingly from the CAPADEX respond endpoint once per submitted
 * response item. All session-wide detection rules are evaluated against the
 * full response history including the just-saved answer. Each call may write
 * at most one new event per contradiction type (60-second dedup window).
 *
 * @param pool      — PG pool
 * @param sessionId — CAPADEX session ID
 * @param newAnswer — the specific answer that triggered this evaluation
 * @param tenantId  — optional tenant for feature-flag resolution
 * @returns         — contradiction reports written during this call
 */
export async function detectContradictions(
  pool:      Pool,
  sessionId: string,
  newAnswer: NewAnswer,
  tenantId?: string,
): Promise<ContradictionReport[]> {
  if (!isEnabled('contradiction_detection', tenantId)) return [];

  const [responses, hypotheses] = await Promise.all([
    loadSessionResponses(pool, sessionId),
    loadActiveHypotheses(pool, sessionId),
  ]);

  // No global minimum-response guard here — each rule applies its own threshold.
  // emotional_masking triggers on as few as 2 responses (1 prior distress + newAnswer),
  // while score_reversal and self_perception_bias each require REVERSAL_MIN_RESPONSES,
  // and defensive_answering requires DEFENSIVE_RUN_LENGTH consecutive max values.
  if (responses.length === 0) return [];

  const allHypothesisIds = hypotheses.map(h => h.id);
  const candidates: ContradictionReport[] = [];

  const reversal = detectScoreReversal(responses);
  if (reversal) {
    candidates.push({
      ...reversal,
      affected_hypothesis_ids: targetHypothesesBySubdomain(
        hypotheses, reversal.affected_subdomains ?? []
      ),
    });
  }

  const masking = detectEmotionalMasking(responses, newAnswer);
  if (masking) {
    candidates.push({ ...masking, affected_hypothesis_ids: allHypothesisIds });
  }

  const spBias = detectSelfPerceptionBias(responses);
  if (spBias) {
    candidates.push({
      ...spBias,
      affected_hypothesis_ids: targetHypothesesBySubdomain(
        hypotheses, spBias.affected_subdomains ?? []
      ),
    });
  }

  const defensive = detectDefensiveAnswering(responses, newAnswer);
  if (defensive) {
    candidates.push({ ...defensive, affected_hypothesis_ids: allHypothesisIds });
  }

  // Phase B (T8): adaptive cross-trait contradiction pairs. Strictly additive —
  // gated behind the `adaptiveQuestioning` flag so flag-off runtimes write only
  // the original four types and never depend on the trait-pair CHECK migration.
  if (isAdaptiveQuestioningEnabled()) {
    for (const pair of detectTraitPairContradictions(responses)) {
      candidates.push({ ...pair, affected_hypothesis_ids: allHypothesisIds });
    }
  }

  if (candidates.length === 0) return [];

  const written: ContradictionReport[] = [];

  for (const report of candidates) {
    // writeContradictionEventAtomic combines the dedup check and the INSERT into
    // a single SQL statement — concurrent calls from the per-response loop cannot
    // both pass the guard and create duplicate events or double confidence penalties.
    const eventId = await writeContradictionEventAtomic(pool, sessionId, report);
    if (!eventId) continue;   // dedup window active — nothing written

    written.push(report);

    for (const hypId of report.affected_hypothesis_ids) {
      onContradictionDetected(
        pool, hypId, sessionId,
        report.contradiction_score,
        report.contradiction_type,
        tenantId,
      ).catch(err =>
        console.error(`[contradiction-engine] confidence update error for ${hypId}:`, err)
      );
    }
  }

  if (written.length > 0) {
    const writtenTypes = written.map(r => r.contradiction_type);
    syncContradictionState(pool, sessionId, writtenTypes, hypotheses)
      .catch(err => console.error('[contradiction-engine] state sync error:', err));

    // Broadcast contradiction detection — fire-and-forget, flag-gated
    broadcastToSession(sessionId, {
      type: 'contradiction_detected',
      data: {
        count:    written.length,
        types:    writtenTypes,
        severity: written.map(r => r.severity),
      },
      explain: `${written.length} contradiction(s) detected: ${writtenTypes.join(', ')}`,
    }, tenantId);
  }

  return written;
}

/**
 * CAPADEX WC-3 L2 — Outcome Intelligence (Phase B).
 *
 * COMPOSE-ONLY. After a session completes, this resolves a set of per-session
 * OUTCOME MODELS (Career Clarity, Learning Effectiveness, Employability Readiness,
 * Exam Readiness, Confidence Stability, Decision Quality) from already-computed
 * data. It NEVER recomputes scores and NEVER touches ontology / signals / concerns.
 *
 * Composition (all anchored on L1 Stage Intelligence — the PRIMARY dependency):
 *   • current   = the session's canonical behavioural stage (from L1).
 *   • desired   = the next stage target up the canonical ladder.
 *   • gap       = ladder distance current → desired (0 at Mastery).
 *   • actions   = LIBRARY-BACKED interventions ONLY (intervention_library, matched
 *                 by construct_key for the constructs that activated the model).
 *                 Never generic / fabricated.
 *
 * A model ACTIVATES for a session only when the session's active behavioural
 * constructs overlap that model's construct vocabulary. When the behavioural spine
 * is empty (no constructs) or the stage cannot be resolved, this emits NOTHING and
 * reports an honest UNCLASSIFIED state — it never fabricates an outcome.
 *
 * Strictly additive + never-throws: the caller is gated on `isWc3OutcomeEnabled()`.
 */
import type { Pool } from 'pg';
import { ensureWc3OutcomeSchema } from './wc3-schema';
import { getSessionStage, WC3_PROGRESSION_ORDER, type StageState } from './stage-intelligence';
import { toCanonicalStoredStage } from '../../lib/lifecycle';
import { resolveConstructForBridgeTag } from '../../data/bridge-tag-construct-crosswalk';
import { isWc3OutcomeCrosswalkEnabled } from '../../config/feature-flags';

const MAX_ACTIONS_PER_MODEL = 5;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface OutcomeAction {
  intervention_id: string;
  construct_key: string;
  intervention_text: string;
  rationale: string;
  safety_level: string | null;
  rank: number;
}

export interface OutcomeModelResult {
  model_key: string;
  display_label: string;
  gated: boolean;
  current_stage: string;
  current_order: number;
  desired_stage: string;
  desired_order: number;
  gap: number;
  gap_normalized: number;
  confidence: number;
  explainable: boolean;
  matched_constructs: string[];
  actions: OutcomeAction[];
  status: 'resolved';
}

export interface OutcomeSummary {
  session_id: string;
  unclassified: boolean;
  reason?: string;
  models: OutcomeModelResult[];
  explainability: number; // % of resolved models with full lineage (≥1 library action)
  actionability: number;  // % of resolved models with ≥1 library-backed action
}

interface ModelRow {
  model_key: string;
  display_label: string;
  construct_keys: string[];
  gated: boolean;
}

interface ResolveInput {
  sessionId: string;
  userEmail?: string | null;
  userId?: string | null;
  /** When L1 is also enabled in the same hook, pass the freshly-resolved stage to
   *  avoid a redundant read. Otherwise the resolver reads L1 stage itself. */
  stageState?: StageState | null;
}

/** Map a raw session persona to the intervention_library persona enum. */
function resolvePersona(raw: string | null | undefined): string {
  const p = (raw ?? '').toLowerCase();
  if (p.includes('parent')) return 'parent';
  if (p.includes('teacher')) return 'teacher';
  if (p.includes('counsel')) return 'counsellor';
  return 'student';
}

/** Read the session's ACTIVE behavioural constructs (never throws → []). */
async function loadSessionConstructs(pool: Pool, sessionId: string): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT construct_key FROM behavioural_hypotheses
       WHERE session_id = $1 AND lifecycle_state = 'active' AND construct_key IS NOT NULL`,
      [sessionId],
    );
    let keys = rows.map((r) => String(r.construct_key));
    if (keys.length === 0) {
      // Tier 2 — pattern spine. Isolated in its own try/catch: this query degrades
      // honestly to [] on any failure (e.g. a schema where capadex_session_patterns
      // carries no construct_key) WITHOUT aborting the function, so the flag-gated
      // tier-3 crosswalk fallback below can still run. Behaviour is unchanged when
      // tier 2 yields nothing — which is its effective result today.
      try {
        const { rows: pat } = await pool.query(
          `SELECT DISTINCT construct_key FROM capadex_session_patterns
           WHERE session_id = $1 AND construct_key IS NOT NULL`,
          [sessionId],
        );
        keys = pat.map((r) => String(r.construct_key));
      } catch {
        keys = [];
      }
    }
    // WC-10 Lever 1 — clarity-bank crosswalk tier (flag-gated). ONLY when the
    // behavioural spine yielded nothing: traverse the L5C bridge-tag→construct
    // crosswalk for the session's concern so an empty-spine session that still
    // carries a real concern can reach an outcome. Sessions WITH a spine are
    // untouched (byte-identical) in either flag state.
    if (keys.length === 0 && isWc3OutcomeCrosswalkEnabled()) {
      keys = await resolveConstructsFromClarityBank(pool, sessionId);
    }
    return Array.from(new Set(keys));
  } catch {
    return [];
  }
}

/**
 * WC-10 Lever 1 — resolve a session's constructs from the clarity bank via the L5C
 * crosswalk (never throws → []). Anchors on ALREADY-COMPUTED session data only:
 *   • the session's concern bridge tag (`master_concern_pk` →
 *     `capadex_concerns_master.relational_bridge_tag`) → `resolveConstructForBridgeTag`
 *     → HIGH construct, or all REVIEW candidates (mirrors `projectOutcome` semantics);
 *   • UNIONed with the session's already-resolved `primary_construct_key`.
 * Never fabricates: UNMAPPED / absent tags with no primary construct yield [].
 */
async function resolveConstructsFromClarityBank(pool: Pool, sessionId: string): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT s.primary_construct_key, m.relational_bridge_tag
         FROM capadex_sessions s
         LEFT JOIN capadex_concerns_master m ON m.id = s.master_concern_pk
        WHERE s.id = $1
        LIMIT 1`,
      [sessionId],
    );
    if (rows.length === 0) return [];
    const out = new Set<string>();
    const pck = rows[0].primary_construct_key;
    if (pck != null && String(pck).trim() !== '') out.add(String(pck));
    const entry = resolveConstructForBridgeTag(rows[0].relational_bridge_tag);
    if (entry) {
      if (entry.status === 'HIGH_CONFIDENCE' && entry.construct) {
        out.add(entry.construct);
      } else if (entry.status === 'REVIEW_REQUIRED' && Array.isArray(entry.candidates)) {
        for (const c of entry.candidates) out.add(c);
      }
    }
    return Array.from(out);
  } catch {
    return [];
  }
}

async function loadPersona(pool: Pool, sessionId: string): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT persona FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    return resolvePersona(rows[0]?.persona);
  } catch {
    return 'student';
  }
}

async function loadModels(pool: Pool): Promise<ModelRow[]> {
  const { rows } = await pool.query(
    `SELECT model_key, display_label, construct_keys, gated FROM wc3_outcome_models ORDER BY model_key`,
  );
  return rows.map((r) => ({
    model_key: r.model_key,
    display_label: r.display_label,
    construct_keys: Array.isArray(r.construct_keys) ? r.construct_keys.map(String) : [],
    gated: !!r.gated,
  }));
}

/** Best LIBRARY-BACKED action per construct (DISTINCT ON), persona-preferred. */
async function loadLibraryActions(
  pool: Pool,
  constructs: string[],
  persona: string,
): Promise<OutcomeAction[]> {
  if (constructs.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (construct_key)
       id, construct_key, intervention_text, rationale, safety_level
     FROM intervention_library
     WHERE construct_key = ANY($1::text[]) AND is_active = true
     ORDER BY construct_key,
       CASE WHEN persona = $2 THEN 0 WHEN persona = 'student' THEN 1 ELSE 2 END,
       id`,
    [constructs, persona],
  );
  return rows
    .map((r, i) => ({
      intervention_id: String(r.id),
      construct_key: String(r.construct_key),
      intervention_text: r.intervention_text,
      rationale: r.rationale,
      safety_level: r.safety_level ?? null,
      rank: i,
    }))
    .slice(0, MAX_ACTIONS_PER_MODEL)
    .map((a, i) => ({ ...a, rank: i }));
}

/**
 * Pure compute (NO writes): build the activated outcome models for a session from
 * already-computed data. Returns an honest UNCLASSIFIED summary when the spine is
 * empty or the stage cannot be resolved.
 */
async function buildOutcomes(
  pool: Pool,
  input: ResolveInput,
): Promise<OutcomeSummary> {
  const sessionId = input.sessionId;
  const constructs = await loadSessionConstructs(pool, sessionId);
  if (constructs.length === 0) {
    return { session_id: sessionId, unclassified: true, reason: 'no_constructs', models: [], explainability: 0, actionability: 0 };
  }

  const stage = input.stageState ?? (await getSessionStage(pool, sessionId));
  if (!stage) {
    return { session_id: sessionId, unclassified: true, reason: 'no_stage', models: [], explainability: 0, actionability: 0 };
  }

  const models = await loadModels(pool);
  const persona = await loadPersona(pool, sessionId);

  const currentOrder = stage.stage_order_index;
  // `current_stage` is read from the persisted L1 stage (always canon) but route it through the
  // canonical guard so this outcome-model insert can never persist a non-canonical casing/whitespace
  // value; `desired_stage` is sourced directly from STORED_STAGE_ORDER (canon by construction).
  // STRICT: if the persisted L1 value is unrecognizable (corrupt upstream), persist NULL rather than
  // leaking junk into current_stage, and log loudly — null≠a fabricated stage.
  const currentStage = toCanonicalStoredStage(stage.canonical_stage);
  if (stage.canonical_stage != null && String(stage.canonical_stage).trim() !== '' && currentStage === null) {
    console.error(
      `[wc3-outcome] unrecognizable L1 canonical_stage, persisting NULL current_stage: ${JSON.stringify(stage.canonical_stage)} (session ${sessionId})`,
    );
  }
  const lastOrder = WC3_PROGRESSION_ORDER.length - 1; // Mastery
  const desiredOrder = Math.min(currentOrder + 1, lastOrder);
  const desiredStage = WC3_PROGRESSION_ORDER[desiredOrder];
  const gap = desiredOrder - currentOrder;
  const gapNorm = r2(gap / lastOrder);

  const results: OutcomeModelResult[] = [];
  for (const m of models) {
    const overlap = m.construct_keys.filter((k) => constructs.includes(k));
    if (overlap.length === 0) continue;
    const actions = await loadLibraryActions(pool, overlap, persona);
    // Confidence (WC-3 calibration R1): L1 stage confidence is the spine (0.5); the
    // presence of ≥1 library-backed action corroborates actionability (0.3); and an
    // OVERLAP-DEPTH term (0.2) rewards how many of the session's constructs matched
    // this model (saturating at 3) so a single-construct coincidence can no longer
    // tie a strongly-evidenced multi-construct activation. Bounded [0,1].
    const overlapDepth = Math.min(1, overlap.length / 3);
    const confidence = r2(
      stage.confidence * 0.5 + (actions.length > 0 ? 0.3 : 0) + overlapDepth * 0.2,
    );
    const explainable = actions.length > 0; // full lineage: stage → model → library action
    results.push({
      model_key: m.model_key,
      display_label: m.display_label,
      gated: m.gated,
      current_stage: currentStage,
      current_order: currentOrder,
      desired_stage: desiredStage,
      desired_order: desiredOrder,
      gap,
      gap_normalized: gapNorm,
      confidence,
      explainable,
      matched_constructs: overlap,
      actions,
      status: 'resolved',
    });
  }

  if (results.length === 0) {
    return { session_id: sessionId, unclassified: true, reason: 'no_model_match', models: [], explainability: 0, actionability: 0 };
  }

  const explainability = Math.round((results.filter((r) => r.explainable).length / results.length) * 100);
  const actionability = Math.round((results.filter((r) => r.actions.length > 0).length / results.length) * 100);
  return { session_id: sessionId, unclassified: false, models: results, explainability, actionability };
}

/**
 * Resolve + persist per-session outcome state. Returns the summary, or null if
 * anything fails (never throws — the post-completion hook must not break).
 * UNCLASSIFIED summaries write NOTHING (honest empty state).
 */
export async function resolveSessionOutcomes(pool: Pool, input: ResolveInput): Promise<OutcomeSummary | null> {
  try {
    await ensureWc3OutcomeSchema(pool);
    const summary = await buildOutcomes(pool, input);
    if (summary.unclassified) return summary; // emit nothing

    for (const m of summary.models) {
      const { rows } = await pool.query(
        `INSERT INTO wc3_outcome_state
           (session_id, user_email, user_id, model_key, current_stage, current_order,
            desired_stage, desired_order, gap, gap_normalized, confidence, action_count,
            explainable, matched_constructs, status, resolved_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'resolved', now(), now())
         ON CONFLICT (session_id, model_key) DO UPDATE SET
           user_email = EXCLUDED.user_email,
           user_id = EXCLUDED.user_id,
           current_stage = EXCLUDED.current_stage,
           current_order = EXCLUDED.current_order,
           desired_stage = EXCLUDED.desired_stage,
           desired_order = EXCLUDED.desired_order,
           gap = EXCLUDED.gap,
           gap_normalized = EXCLUDED.gap_normalized,
           confidence = EXCLUDED.confidence,
           action_count = EXCLUDED.action_count,
           explainable = EXCLUDED.explainable,
           matched_constructs = EXCLUDED.matched_constructs,
           status = 'resolved',
           updated_at = now()
         RETURNING id`,
        [
          input.sessionId, input.userEmail ?? null, input.userId ?? null, m.model_key,
          m.current_stage, m.current_order, m.desired_stage, m.desired_order,
          m.gap, m.gap_normalized, m.confidence, m.actions.length,
          m.explainable, m.matched_constructs,
        ],
      );
      const stateId = rows[0]?.id;
      if (stateId == null) continue;
      // Replace the action set (idempotent re-resolve). Library-backed FK only.
      await pool.query(`DELETE FROM wc3_outcome_actions WHERE outcome_state_id = $1`, [stateId]);
      for (const a of m.actions) {
        await pool.query(
          `INSERT INTO wc3_outcome_actions
             (outcome_state_id, session_id, model_key, intervention_id, construct_key, safety_level, rank)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [stateId, input.sessionId, m.model_key, a.intervention_id, a.construct_key, a.safety_level, a.rank],
        );
      }
    }
    return summary;
  } catch (err) {
    console.warn('[wc3-outcome] resolveSessionOutcomes failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Read-only outcome for the GET route. Prefers the persisted state (joins
 * intervention_library so action text is always library-sourced, never copied);
 * if none exists (e.g. session completed before the flag was enabled), computes a
 * transient (non-persisted) summary. Returns an honest UNCLASSIFIED summary when
 * the spine is empty. Never writes.
 */
export async function getSessionOutcomes(pool: Pool, sessionId: string): Promise<OutcomeSummary | null> {
  try {
    await ensureWc3OutcomeSchema(pool);
    const { rows: states } = await pool.query(
      `SELECT s.id, s.model_key, m.display_label, m.gated,
              s.current_stage, s.current_order, s.desired_stage, s.desired_order,
              s.gap, s.gap_normalized, s.confidence, s.explainable, s.matched_constructs
         FROM wc3_outcome_state s
         JOIN wc3_outcome_models m ON m.model_key = s.model_key
        WHERE s.session_id = $1
        ORDER BY s.model_key`,
      [sessionId],
    );

    if (states.length > 0) {
      const { rows: actRows } = await pool.query(
        `SELECT a.outcome_state_id, a.intervention_id, a.construct_key, a.rank,
                il.intervention_text, il.rationale, il.safety_level
           FROM wc3_outcome_actions a
           JOIN intervention_library il ON il.id = a.intervention_id
          WHERE a.session_id = $1
          ORDER BY a.outcome_state_id, a.rank`,
        [sessionId],
      );
      const byState = new Map<string, OutcomeAction[]>();
      for (const ar of actRows) {
        const key = String(ar.outcome_state_id);
        if (!byState.has(key)) byState.set(key, []);
        byState.get(key)!.push({
          intervention_id: String(ar.intervention_id),
          construct_key: String(ar.construct_key),
          intervention_text: ar.intervention_text,
          rationale: ar.rationale,
          safety_level: ar.safety_level ?? null,
          rank: Number(ar.rank),
        });
      }
      const models: OutcomeModelResult[] = states.map((r) => ({
        model_key: r.model_key,
        display_label: r.display_label,
        gated: !!r.gated,
        current_stage: r.current_stage,
        current_order: Number(r.current_order),
        desired_stage: r.desired_stage,
        desired_order: Number(r.desired_order),
        gap: Number(r.gap),
        gap_normalized: Number(r.gap_normalized),
        confidence: Number(r.confidence),
        explainable: !!r.explainable,
        matched_constructs: Array.isArray(r.matched_constructs) ? r.matched_constructs.map(String) : [],
        actions: byState.get(String(r.id)) ?? [],
        status: 'resolved',
      }));
      const explainability = Math.round((models.filter((m) => m.explainable).length / models.length) * 100);
      const actionability = Math.round((models.filter((m) => m.actions.length > 0).length / models.length) * 100);
      return { session_id: sessionId, unclassified: false, models, explainability, actionability };
    }

    // No persisted state — compute a transient (read-only) summary.
    return await buildOutcomes(pool, { sessionId });
  } catch (err) {
    console.warn('[wc3-outcome] getSessionOutcomes failed, degrading:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

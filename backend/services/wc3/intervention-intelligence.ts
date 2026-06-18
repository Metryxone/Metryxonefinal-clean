/**
 * CAPADEX WC-L4 — Intervention Intelligence Engine (compose-only, library-backed).
 *
 * COMPOSE-ONLY. After a session completes, this re-shapes already-computed intelligence into a
 * set of per-session INTERVENTIONS and persists them to `wcl4_interventions`. It introduces NO
 * new construct / ontology / dimension / scoring / AI model — it only composes existing data.
 *
 * GENERATOR (the ONLY source that produces an intervention):
 *   • L2 Outcome Intelligence library-backed actions (`wc3_outcome_actions` → `intervention_library`,
 *     surfaced via `getSessionOutcomes`). Each intervention IS a real curated library row (its uuid +
 *     `intervention_text`). Confidence is INHERITED from the generating outcome model (never blended /
 *     invented). When the same library intervention is surfaced by more than one outcome model we keep
 *     the MAX model confidence (selection, not averaging) and record every contributor.
 *
 * ANNOTATIONS (priority / context only — NEVER generate an intervention):
 *   • L1 Stage — the session's canonical behavioural stage.
 *   • L3 Journey + WC-11 Decision — ONLY when NOT degraded. The degraded mentoring-fallback /
 *     NULL-outcome decision exists to guarantee routing, not as evidence of intervention need, so it
 *     contributes ZERO (honesty-critical).
 *   • WC-L0 User — persona context.
 *   • WC-L1 Trend + WC-L2 Forecast — polarity-aware CONCERN signals (see intervention-registry), recorded
 *     at the USER/session level (a concerning trajectory raises priority of the user's interventions —
 *     never a per-construct causal claim).
 *
 * FAIL-CLOSED: an empty / UNCLASSIFIED behavioural spine, no resolved outcome models, or no
 * library-backed action ⇒ ZERO interventions (no generic fallback). Never fabricates.
 *
 * Strictly additive + never-throws: the caller is gated on `isInterventionIntelligenceEnabled()`.
 */
import type { Pool } from 'pg';
import { getSessionStage } from './stage-intelligence';
import { getSessionOutcomes } from './outcome-intelligence';
import { getSessionJourney } from './journey-intelligence';
import { getPersistedDecision } from '../wc7b/decision-persistence';
import { getUserIntelligence } from './user-intelligence-foundation';
import { getUserTrends } from './trend-intelligence';
import { computeUserForecasts } from './forecast-intelligence';
import { GENERATOR_LAYER, isTrendConcern, isForecastConcern } from './intervention-registry';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface InterventionRecord {
  intervention_id: string; // real intervention_library uuid
  intervention_name: string; // real intervention_library.intervention_text
  source: typeof GENERATOR_LAYER; // primary generating layer — always the outcome generator
  model_key: string; // the generating outcome model (max-confidence contributor)
  confidence: number; // INHERITED from the generating outcome model (no blend)
  priority: number; // inherited library action rank (lower = higher priority)
  priority_elevated: boolean; // true when a concern trend/forecast applies to the user
  rationale: string;
  sources: InterventionSources;
}

interface GeneratorContribution {
  layer: 'outcome';
  model_key: string;
  display_label: string;
  confidence: number;
  rank: number;
}

interface InterventionSources {
  generators: GeneratorContribution[];
  annotations: SessionAnnotations;
}

interface TrendConcern { metric: string; direction: string; confidence: number; }
interface ForecastConcern { kind: string; projected_direction: string; forecast_confidence: number; }

interface SessionAnnotations {
  stage: { canonical_stage: string; confidence: number } | null;
  journey: { route_key: string; route_confidence: number; degraded: true } | { route_key: string; route_confidence: number } | null;
  decision: { route_key: string | null; primary_outcome_model: string | null; confidence: number; degraded: true } | { route_key: string | null; primary_outcome_model: string | null; confidence: number } | null;
  user: { persona: string | null; persona_confidence: number | null } | null;
  trend_concerns: TrendConcern[];
  forecast_concerns: ForecastConcern[];
}

export interface InterventionResult {
  session_id: string;
  user_email: string | null;
  interventions: InterventionRecord[];
  /** Honest meta for the measure layer — distinguishes "no spine" from degraded annotation sources. */
  meta: {
    outcome_unclassified: boolean;
    /** True ONLY when an exception was caught — keeps a real error from masquerading as honest-empty. */
    compose_error: boolean;
    outcome_models: number;
    journey_degraded: boolean | null;
    decision_degraded: boolean | null;
    trend_concern_count: number;
    forecast_concern_count: number;
  };
}

let schemaReady = false;

export async function ensureWcl4InterventionSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wcl4_interventions (
      session_id        uuid NOT NULL,
      intervention_id   uuid NOT NULL,
      user_email        text,
      intervention_name text,
      source            text NOT NULL,
      model_key         text,
      confidence        numeric,
      priority          integer,
      priority_elevated boolean NOT NULL DEFAULT false,
      rationale         text,
      sources           jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, intervention_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wcl4_interventions_email ON wcl4_interventions(user_email);`);
  schemaReady = true;
}

/** Resolve the session's email (trends/forecasts are email-keyed). Best-effort; null when absent. */
async function resolveSessionEmail(pool: Pool, sessionId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT guest_email FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    const e = rows[0]?.guest_email;
    return e ? String(e) : null;
  } catch {
    return null;
  }
}

/**
 * COMPOSE the per-session interventions. Read-only — never writes, never throws.
 * Returns an empty intervention list (fail-closed) whenever the generator is absent.
 */
export async function composeInterventions(pool: Pool, sessionId: string): Promise<InterventionResult> {
  const empty = (
    userEmail: string | null,
    metaOverrides: Partial<InterventionResult['meta']> = {},
  ): InterventionResult => ({
    session_id: sessionId,
    user_email: userEmail,
    interventions: [],
    meta: {
      outcome_unclassified: true,
      compose_error: false,
      outcome_models: 0,
      journey_degraded: null,
      decision_degraded: null,
      trend_concern_count: 0,
      forecast_concern_count: 0,
      ...metaOverrides,
    },
  });

  try {
    const userEmail = await resolveSessionEmail(pool, sessionId);

    // ── GENERATOR: L2 Outcome library-backed actions ──────────────────────────
    const outcomes = await getSessionOutcomes(pool, sessionId);
    if (!outcomes || outcomes.unclassified || outcomes.models.length === 0) {
      return empty(userEmail, { outcome_unclassified: true, outcome_models: 0 });
    }

    // ── ANNOTATIONS (priority/context only) ───────────────────────────────────
    const stageState = await getSessionStage(pool, sessionId);
    const journey = await getSessionJourney(pool, sessionId);
    const decision = await getPersistedDecision(pool, sessionId);
    const user = await getUserIntelligence(pool, sessionId);

    // Trend + Forecast concern signals (polarity-aware, user-keyed). Absent email ⇒ no signals.
    const trendConcerns: TrendConcern[] = [];
    const forecastConcerns: ForecastConcern[] = [];
    if (userEmail) {
      try {
        const trendRows = await getUserTrends(pool, userEmail);
        for (const t of trendRows) {
          const metric = String(t.metric ?? '');
          const direction = String(t.direction ?? '');
          if (isTrendConcern(metric, direction)) {
            trendConcerns.push({ metric, direction, confidence: Number(t.confidence ?? 0) });
          }
        }
      } catch { /* trends optional — never block */ }
      try {
        const fc = await computeUserForecasts(pool, userEmail);
        if ((fc as { enabled?: boolean }).enabled !== false && 'forecasts' in fc) {
          for (const f of Object.values(fc.forecasts)) {
            if ((f as { forecastable?: boolean }).forecastable === true) {
              const kind = String((f as { kind: string }).kind);
              const dir = String((f as { projected_direction: string }).projected_direction);
              if (isForecastConcern(kind, dir)) {
                forecastConcerns.push({
                  kind,
                  projected_direction: dir,
                  forecast_confidence: Number((f as { forecast_confidence: number }).forecast_confidence ?? 0),
                });
              }
            }
          }
        }
      } catch { /* forecasts optional (flag-gated) — never block */ }
    }

    const journeyDegraded = journey ? !!journey.degraded : null;
    const decisionDegraded = decision ? !!decision.degraded : null;

    const annotations: SessionAnnotations = {
      stage: stageState
        ? { canonical_stage: String(stageState.canonical_stage), confidence: Number(stageState.confidence) }
        : null,
      // Degraded journey/decision contribute ZERO context (only the degraded marker is recorded).
      journey: journey
        ? journey.degraded
          ? { route_key: journey.primary_route.route_key, route_confidence: r2(journey.route_confidence), degraded: true }
          : { route_key: journey.primary_route.route_key, route_confidence: r2(journey.route_confidence) }
        : null,
      decision: decision
        ? decision.degraded
          ? { route_key: decision.route_key, primary_outcome_model: decision.primary_outcome_model, confidence: r2(decision.confidence), degraded: true }
          : { route_key: decision.route_key, primary_outcome_model: decision.primary_outcome_model, confidence: r2(decision.confidence) }
        : null,
      user: user
        ? { persona: (user.persona as string) ?? null, persona_confidence: user.persona_confidence == null ? null : Number(user.persona_confidence) }
        : null,
      trend_concerns: trendConcerns,
      forecast_concerns: forecastConcerns,
    };

    const priorityElevated = trendConcerns.length > 0 || forecastConcerns.length > 0;

    // ── COMPOSE: dedupe library interventions by intervention_id, keep MAX model confidence ──
    const byId = new Map<string, {
      intervention_id: string;
      intervention_name: string;
      generators: GeneratorContribution[];
      best_confidence: number;
      best_model_key: string;
      best_rationale: string;
      min_rank: number;
    }>();

    for (const model of outcomes.models) {
      for (const action of model.actions) {
        const id = String(action.intervention_id);
        const contribution: GeneratorContribution = {
          layer: 'outcome',
          model_key: model.model_key,
          display_label: model.display_label,
          confidence: r2(model.confidence),
          rank: action.rank,
        };
        const existing = byId.get(id);
        if (!existing) {
          byId.set(id, {
            intervention_id: id,
            intervention_name: action.intervention_text,
            generators: [contribution],
            best_confidence: r2(model.confidence),
            best_model_key: model.model_key,
            best_rationale: action.rationale,
            min_rank: action.rank,
          });
        } else {
          existing.generators.push(contribution);
          if (model.confidence > existing.best_confidence) {
            existing.best_confidence = r2(model.confidence);
            existing.best_model_key = model.model_key;
            existing.best_rationale = action.rationale;
          }
          if (action.rank < existing.min_rank) existing.min_rank = action.rank;
        }
      }
    }

    const interventions: InterventionRecord[] = [];
    for (const v of byId.values()) {
      const modelLabels = Array.from(new Set(v.generators.map((g) => g.display_label))).join(', ');
      const rationaleParts: string[] = [];
      if (v.best_rationale) rationaleParts.push(v.best_rationale);
      rationaleParts.push(`Surfaced by outcome model(s): ${modelLabels}.`);
      if (annotations.stage) rationaleParts.push(`Stage: ${annotations.stage.canonical_stage}.`);
      if (priorityElevated) {
        const sig = [
          ...trendConcerns.map((t) => `${t.metric} ${t.direction}`),
          ...forecastConcerns.map((f) => `${f.kind} ${f.projected_direction}`),
        ].join('; ');
        rationaleParts.push(`Priority elevated by concern signal(s): ${sig}.`);
      }
      interventions.push({
        intervention_id: v.intervention_id,
        intervention_name: v.intervention_name,
        source: GENERATOR_LAYER,
        model_key: v.best_model_key,
        confidence: v.best_confidence,
        priority: v.min_rank,
        priority_elevated: priorityElevated,
        rationale: rationaleParts.join(' '),
        sources: { generators: v.generators, annotations },
      });
    }

    // Stable, honest ordering: priority asc, then confidence desc, then id.
    interventions.sort((a, b) =>
      a.priority - b.priority ||
      b.confidence - a.confidence ||
      a.intervention_id.localeCompare(b.intervention_id),
    );

    return {
      session_id: sessionId,
      user_email: userEmail,
      interventions,
      meta: {
        outcome_unclassified: false,
        compose_error: false,
        outcome_models: outcomes.models.length,
        journey_degraded: journeyDegraded,
        decision_degraded: decisionDegraded,
        trend_concern_count: trendConcerns.length,
        forecast_concern_count: forecastConcerns.length,
      },
    };
  } catch (e) {
    // Conservative: still fail-closed (zero interventions), but flag the error so the audit never
    // counts a genuine failure as an "honest empty spine".
    console.error('[wcl4] composeInterventions failed (non-blocking, fail-closed):', e);
    return empty(null, { compose_error: true });
  }
}

/**
 * Persist the composed interventions for a session. UPSERTs the current set and prunes any rows
 * for the session that are no longer present (idempotent re-runs). Non-blocking + never-throws.
 * Returns the composed result (or null on failure — the caller ignores it).
 */
export async function persistInterventionsForSession(pool: Pool, sessionId: string): Promise<InterventionResult | null> {
  try {
    const result = await composeInterventions(pool, sessionId);
    await ensureWcl4InterventionSchema(pool);

    const keepIds = result.interventions.map((i) => i.intervention_id);
    // Prune stale rows for this session (interventions that no longer compose).
    if (keepIds.length > 0) {
      await pool.query(
        `DELETE FROM wcl4_interventions WHERE session_id = $1 AND NOT (intervention_id = ANY($2::uuid[]))`,
        [sessionId, keepIds],
      );
    } else {
      await pool.query(`DELETE FROM wcl4_interventions WHERE session_id = $1`, [sessionId]);
    }

    for (const i of result.interventions) {
      await pool.query(
        `INSERT INTO wcl4_interventions
           (session_id, intervention_id, user_email, intervention_name, source, model_key,
            confidence, priority, priority_elevated, rationale, sources, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, now())
         ON CONFLICT (session_id, intervention_id) DO UPDATE SET
           user_email        = EXCLUDED.user_email,
           intervention_name = EXCLUDED.intervention_name,
           source            = EXCLUDED.source,
           model_key         = EXCLUDED.model_key,
           confidence        = EXCLUDED.confidence,
           priority          = EXCLUDED.priority,
           priority_elevated = EXCLUDED.priority_elevated,
           rationale         = EXCLUDED.rationale,
           sources           = EXCLUDED.sources,
           updated_at        = now()`,
        [
          sessionId,
          i.intervention_id,
          result.user_email,
          i.intervention_name,
          i.source,
          i.model_key,
          i.confidence,
          i.priority,
          i.priority_elevated,
          i.rationale,
          JSON.stringify(i.sources),
        ],
      );
    }
    return result;
  } catch (e) {
    console.error('[wcl4] persistInterventionsForSession failed (non-blocking):', e);
    return null;
  }
}

/**
 * CAPADEX WC-L5 — Memory Intelligence Engine (persistence + retrieval, compose-only).
 *
 * COMPOSE-ONLY. After a session completes, this SNAPSHOTS the already-computed WC-L0→L4 intelligence
 * into `wcl5_memory`. It introduces NO new construct / ontology / dimension / scoring / AI model /
 * forecast / intervention / decision — every memory row is a verbatim snapshot of an output some
 * EXISTING layer already produced, read through that layer's own read-only getter (or, for the WC-L4
 * intervention layer, read from its already-PERSISTED `wcl4_interventions` rows — memory remembers what
 * was stored, never a re-derivation).
 *
 * SNAPSHOT SOURCES (one memory ROW per salient atom; stable semantic memory_key):
 *   • stage_memory       ← getSessionStage            key 'canonical_stage'
 *   • outcome_memory     ← getSessionOutcomes         key 'model:<model_key>' (one per resolved model)
 *   • journey_memory     ← getSessionJourney          key 'route'   (degraded flagged, still remembered)
 *   • decision_memory    ← getPersistedDecision       key 'route'   (degraded flagged, still remembered)
 *   • behaviour_memory   ← getUserIntelligence        key 'user_intelligence'   (non-PII subset)
 *                        + getUserTrends (WC-L1 fold)  key 'trend:<metric>'      (one per trend)
 *   • forecast_memory    ← computeUserForecasts        key 'forecast:<kind>'     (one per forecastable kind)
 *   • intervention_memory← wcl4_interventions (read)   key 'intervention:<intervention_id>'
 *
 * FAIL-CLOSED: an absent / UNCLASSIFIED / empty layer ⇒ NO row for that memory type (never a
 * placeholder, never fabricated). Confidence is INHERITED from the source.
 *
 * Persistence is UPSERT-ONLY on (session_id, memory_type, memory_key) — there is NO destructive write,
 * no stale-prune DELETE; `created_at` is preserved on conflict; distinct session_ids preserve history.
 *
 * Strictly additive + never-throws: the caller is gated on `isMemoryIntelligenceEnabled()`. Schema DDL
 * runs ONLY inside the persist path (flag-gated / backfill), so flag OFF ⇒ no DDL ⇒ byte-identical.
 */
import type { Pool } from 'pg';
import { getSessionStage } from '../wc3/stage-intelligence';
import { getSessionOutcomes } from '../wc3/outcome-intelligence';
import { getSessionJourney } from '../wc3/journey-intelligence';
import { getPersistedDecision } from '../wc7b/decision-persistence';
import { getUserIntelligence } from '../wc3/user-intelligence-foundation';
import { getUserTrends } from '../wc3/trend-intelligence';
import { computeUserForecasts } from '../wc3/forecast-intelligence';
import { MEMORY_TYPES, type MemoryType, BEHAVIOUR_USER_KEY, behaviourTrendKey } from './memory-registry';

const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface MemoryRecord {
  memory_type: MemoryType;
  memory_key: string; // stable semantic key
  memory_value: Record<string, unknown>; // verbatim snapshot of the existing output (non-PII)
  source: string; // provenance token (registry source)
  confidence: number | null; // INHERITED from source
}

export interface MemoryResult {
  session_id: string;
  user_email: string | null;
  records: MemoryRecord[];
  /** Honest meta for the measure layer. */
  meta: {
    /** True ONLY when an exception was caught — keeps a real error from masquerading as honest-empty. */
    compose_error: boolean;
    types_present: number; // distinct memory_type count
    rows: number; // total memory records
    has_stage: boolean;
    outcome_models: number;
    journey_present: boolean;
    journey_degraded: boolean | null;
    decision_present: boolean;
    decision_degraded: boolean | null;
    has_user: boolean;
    trend_count: number;
    forecast_count: number;
    intervention_count: number;
    /** True when the WC-4 source table is missing/empty for this session (honest, not silent-zero). */
    intervention_source_empty: boolean;
  };
}

let schemaReady = false;

/**
 * Create the persistence table. Called ONLY from the persist path (flag-gated runtime / backfill) so
 * that no DDL ever runs when the flag is OFF (byte-identical legacy behaviour).
 */
export async function ensureWcl5MemorySchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wcl5_memory (
      id            bigserial PRIMARY KEY,
      session_id    uuid NOT NULL,
      user_email    text,
      memory_type   text NOT NULL,
      memory_key    text NOT NULL,
      memory_value  jsonb NOT NULL DEFAULT '{}'::jsonb,
      source        text NOT NULL,
      confidence    numeric,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (session_id, memory_type, memory_key)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wcl5_memory_email ON wcl5_memory(user_email);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wcl5_memory_type ON wcl5_memory(memory_type);`);
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
 * Read the ALREADY-PERSISTED WC-L4 interventions for a session. Memory remembers what was stored — it
 * never recomputes. Returns { rows, tableMissing } so the caller can honestly distinguish "no
 * intervention persisted" from "WC-L4 table absent" (rather than silently reporting zero).
 */
async function readPersistedInterventions(
  pool: Pool,
  sessionId: string,
): Promise<{ rows: Record<string, unknown>[]; tableMissing: boolean }> {
  try {
    const { rows } = await pool.query(
      `SELECT intervention_id, intervention_name, model_key, confidence, priority, priority_elevated
         FROM wcl4_interventions
        WHERE session_id = $1
        ORDER BY priority ASC NULLS LAST, confidence DESC NULLS LAST, intervention_id`,
      [sessionId],
    );
    return { rows, tableMissing: false };
  } catch (e) {
    // Most commonly the relation does not exist (WC-L4 never ran) — honest "source absent". Log so a
    // genuine fault (e.g. a connection blip) can't silently masquerade as an empty WC-L4 source.
    console.error('[wcl5] readPersistedInterventions failed (treated as source-absent):', e);
    return { rows: [], tableMissing: true };
  }
}

/**
 * COMPOSE the per-session memory snapshot. Read-only — never writes, never throws. Returns an empty
 * record list (fail-closed) whenever every snapshot source is absent.
 */
export async function composeMemory(pool: Pool, sessionId: string): Promise<MemoryResult> {
  const base = (userEmail: string | null, overrides: Partial<MemoryResult['meta']> = {}): MemoryResult => ({
    session_id: sessionId,
    user_email: userEmail,
    records: [],
    meta: {
      compose_error: false,
      types_present: 0,
      rows: 0,
      has_stage: false,
      outcome_models: 0,
      journey_present: false,
      journey_degraded: null,
      decision_present: false,
      decision_degraded: null,
      has_user: false,
      trend_count: 0,
      forecast_count: 0,
      intervention_count: 0,
      intervention_source_empty: true,
      ...overrides,
    },
  });

  try {
    const userEmail = await resolveSessionEmail(pool, sessionId);
    const records: MemoryRecord[] = [];

    // ── stage_memory ──────────────────────────────────────────────────────────
    const stage = await getSessionStage(pool, sessionId);
    let hasStage = false;
    if (stage && stage.canonical_stage) {
      hasStage = true;
      records.push({
        memory_type: 'stage_memory',
        memory_key: 'canonical_stage',
        memory_value: {
          canonical_stage: String(stage.canonical_stage),
          confidence: numOrNull(stage.confidence),
          progression_count: Array.isArray(stage.progression) ? stage.progression.length : 0,
        },
        source: MEMORY_TYPES.stage_memory.source,
        confidence: numOrNull(stage.confidence),
      });
    }

    // ── outcome_memory (one row per resolved model) ───────────────────────────
    const outcomes = await getSessionOutcomes(pool, sessionId);
    let outcomeModels = 0;
    if (outcomes && !outcomes.unclassified && outcomes.models.length > 0) {
      for (const m of outcomes.models) {
        outcomeModels += 1;
        records.push({
          memory_type: 'outcome_memory',
          memory_key: `model:${m.model_key}`,
          memory_value: {
            model_key: m.model_key,
            display_label: m.display_label,
            confidence: numOrNull(m.confidence),
            action_count: Array.isArray(m.actions) ? m.actions.length : 0,
          },
          source: MEMORY_TYPES.outcome_memory.source,
          confidence: numOrNull(m.confidence),
        });
      }
    }

    // ── journey_memory (degraded is remembered, flagged) ──────────────────────
    const journey = await getSessionJourney(pool, sessionId);
    const journeyPresent = !!journey;
    const journeyDegraded = journey ? !!journey.degraded : null;
    if (journey) {
      records.push({
        memory_type: 'journey_memory',
        memory_key: 'route',
        memory_value: {
          route_key: journey.primary_route.route_key,
          route_confidence: numOrNull(journey.route_confidence),
          degraded: !!journey.degraded,
        },
        source: MEMORY_TYPES.journey_memory.source,
        confidence: numOrNull(journey.route_confidence),
      });
    }

    // ── decision_memory (degraded is remembered, flagged) ─────────────────────
    const decision = await getPersistedDecision(pool, sessionId);
    const decisionPresent = !!decision;
    const decisionDegraded = decision ? !!decision.degraded : null;
    if (decision) {
      records.push({
        memory_type: 'decision_memory',
        memory_key: 'route',
        memory_value: {
          route_key: decision.route_key,
          primary_outcome_model: decision.primary_outcome_model,
          confidence: numOrNull(decision.confidence),
          degraded: !!decision.degraded,
        },
        source: MEMORY_TYPES.decision_memory.source,
        confidence: numOrNull(decision.confidence),
      });
    }

    // ── behaviour_memory · WC-L0 user snapshot (non-PII subset) ───────────────
    const user = await getUserIntelligence(pool, sessionId);
    const hasUser = !!user;
    if (user) {
      records.push({
        memory_type: 'behaviour_memory',
        memory_key: BEHAVIOUR_USER_KEY,
        memory_value: {
          persona: (user.persona as string) ?? null,
          persona_segment: (user.persona_segment as string) ?? null,
          persona_confidence: numOrNull(user.persona_confidence),
          motivation: numOrNull(user.motivation),
          confidence: numOrNull(user.confidence),
          risk: numOrNull(user.risk),
          engagement: numOrNull(user.engagement),
          adaptability: numOrNull(user.adaptability),
          learning_style: (user.learning_style as string) ?? null,
          behaviour_dims_present: numOrNull(user.behaviour_dims_present),
          snapshot_captured: user.snapshot_captured === true,
        },
        source: 'wc-l0-user-intelligence',
        confidence: numOrNull(user.persona_confidence),
      });
    }

    // ── behaviour_memory · WC-L1 trend fold (one row per trend metric) ────────
    let trendCount = 0;
    if (userEmail) {
      try {
        const trendRows = await getUserTrends(pool, userEmail);
        for (const t of trendRows) {
          const metric = String(t.metric ?? '');
          if (!metric) continue;
          trendCount += 1;
          records.push({
            memory_type: 'behaviour_memory',
            memory_key: behaviourTrendKey(metric),
            memory_value: {
              metric,
              direction: String(t.direction ?? ''),
              confidence: numOrNull(t.confidence),
            },
            source: 'wc-l1-trend',
            confidence: numOrNull(t.confidence),
          });
        }
      } catch (e) { console.error('[wcl5] getUserTrends snapshot skipped (non-blocking):', e); }
    }

    // ── forecast_memory (one row per forecastable kind) ───────────────────────
    let forecastCount = 0;
    if (userEmail) {
      try {
        const fc = await computeUserForecasts(pool, userEmail);
        if ((fc as { enabled?: boolean }).enabled !== false && 'forecasts' in fc) {
          for (const f of Object.values(fc.forecasts)) {
            if ((f as { forecastable?: boolean }).forecastable === true) {
              const kind = String((f as { kind: string }).kind);
              forecastCount += 1;
              records.push({
                memory_type: 'forecast_memory',
                memory_key: `forecast:${kind}`,
                memory_value: {
                  kind,
                  projected_direction: String((f as { projected_direction: string }).projected_direction),
                  forecast_confidence: numOrNull((f as { forecast_confidence: number }).forecast_confidence),
                },
                source: MEMORY_TYPES.forecast_memory.source,
                confidence: numOrNull((f as { forecast_confidence: number }).forecast_confidence),
              });
            }
          }
        }
      } catch (e) { console.error('[wcl5] computeUserForecasts snapshot skipped (non-blocking):', e); }
    }

    // ── intervention_memory (read persisted WC-L4 rows; never recompute) ──────
    const { rows: interventionRows, tableMissing } = await readPersistedInterventions(pool, sessionId);
    for (const iv of interventionRows) {
      records.push({
        memory_type: 'intervention_memory',
        memory_key: `intervention:${String(iv.intervention_id)}`,
        memory_value: {
          intervention_id: String(iv.intervention_id),
          intervention_name: (iv.intervention_name as string) ?? null,
          model_key: (iv.model_key as string) ?? null,
          confidence: numOrNull(iv.confidence),
          priority: numOrNull(iv.priority),
          priority_elevated: iv.priority_elevated === true,
        },
        source: MEMORY_TYPES.intervention_memory.source,
        confidence: numOrNull(iv.confidence),
      });
    }

    const typesPresent = new Set(records.map((r) => r.memory_type)).size;

    return {
      session_id: sessionId,
      user_email: userEmail,
      records,
      meta: {
        compose_error: false,
        types_present: typesPresent,
        rows: records.length,
        has_stage: hasStage,
        outcome_models: outcomeModels,
        journey_present: journeyPresent,
        journey_degraded: journeyDegraded,
        decision_present: decisionPresent,
        decision_degraded: decisionDegraded,
        has_user: hasUser,
        trend_count: trendCount,
        forecast_count: forecastCount,
        intervention_count: interventionRows.length,
        intervention_source_empty: tableMissing || interventionRows.length === 0,
      },
    };
  } catch (e) {
    console.error('[wcl5] composeMemory failed (non-blocking, fail-closed):', e);
    return base(null, { compose_error: true });
  }
}

/**
 * Persist the composed memory for a session. UPSERT-ONLY (no destructive write, no stale-prune) so the
 * snapshot is idempotent on re-run and per-session history is preserved. Non-blocking + never-throws.
 * Returns the composed result (or null on failure — the caller ignores it).
 */
export async function persistMemoryForSession(pool: Pool, sessionId: string): Promise<MemoryResult | null> {
  try {
    const result = await composeMemory(pool, sessionId);
    await ensureWcl5MemorySchema(pool);

    for (const r of result.records) {
      await pool.query(
        `INSERT INTO wcl5_memory
           (session_id, user_email, memory_type, memory_key, memory_value, source, confidence, updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7, now())
         ON CONFLICT (session_id, memory_type, memory_key) DO UPDATE SET
           user_email   = EXCLUDED.user_email,
           memory_value = EXCLUDED.memory_value,
           source       = EXCLUDED.source,
           confidence   = EXCLUDED.confidence,
           updated_at   = now()`,
        [
          sessionId,
          result.user_email,
          r.memory_type,
          r.memory_key,
          JSON.stringify(r.memory_value),
          r.source,
          r.confidence,
        ],
      );
    }
    return result;
  } catch (e) {
    console.error('[wcl5] persistMemoryForSession failed (non-blocking):', e);
    return null;
  }
}

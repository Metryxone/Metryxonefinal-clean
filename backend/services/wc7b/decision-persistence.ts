/**
 * CAPADEX WC-11 Layer 4 — Decision Persistence (Component #5).
 *
 * The Decision Orchestrator (`decision-orchestrator.ts`) is deliberately READ-ONLY and never
 * writes — it COMPOSES the unified decision + activation envelope on every read. WC-11 adds a
 * SEPARATE, additive write step that snapshots that already-composed decision to durable state,
 * exactly the way `resolveSessionOutcomes` snapshots the L2 outcome. The orchestrator is left
 * byte-identical; nothing here recomputes scores, edits ontology, or fabricates.
 *
 * Lazy ensure-schema (idempotent CREATE TABLE IF NOT EXISTS), mirroring the WC-3 pattern, so there
 * is no migration runner dependency. One row per session (`wc7b_decision_state`, PK session_id).
 *
 * Gated by `isDecisionPersistenceEnabled()` at the call site (post-completion hook). NON-BLOCKING +
 * NEVER-THROWS: any failure logs and returns null so it can never break session completion.
 */
import type { Pool } from 'pg';
import { buildActivationEnvelope, type ActivationEnvelope } from './decision-orchestrator';

let schemaReady = false;

/** Lazy, idempotent schema for the persisted unified decision. Mirrors the WC-3 ensure-schema. */
export async function ensureDecisionStateSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wc7b_decision_state (
      session_id            text PRIMARY KEY,
      canonical_stage       text,
      stage_confidence      numeric,
      primary_outcome_model text,
      primary_outcome_label text,
      outcome_confidence    numeric,
      route_key             text,
      product_path          text,
      route_confidence      numeric,
      confidence            numeric NOT NULL DEFAULT 0,
      ambiguity             text NOT NULL DEFAULT 'high',
      why                   jsonb NOT NULL DEFAULT '[]'::jsonb,
      product_ready         boolean NOT NULL DEFAULT false,
      growth_plan_ready     boolean NOT NULL DEFAULT false,
      mentor_ready          boolean NOT NULL DEFAULT false,
      subscription_ready    boolean NOT NULL DEFAULT false,
      degraded              boolean NOT NULL DEFAULT false,
      composed_from         jsonb NOT NULL DEFAULT '[]'::jsonb,
      envelope              jsonb,
      resolved_at           timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now()
    );
  `);
  schemaReady = true;
}

export interface PersistedDecision {
  session_id: string;
  canonical_stage: string | null;
  confidence: number;
  ambiguity: string;
  primary_outcome_model: string | null;
  route_key: string | null;
  product_ready: boolean;
  growth_plan_ready: boolean;
  mentor_ready: boolean;
  subscription_ready: boolean;
  degraded: boolean;
  composed_from: string[];
  why: string[];
  resolved_at: string;
}

/** True when the subscription slot represents a live (non-out-of-scope) commercial activation. */
function subscriptionReady(env: ActivationEnvelope): boolean {
  const sub = env.subscription as { ready?: boolean };
  return sub?.ready === true;
}

/**
 * Persist the unified decision for a completed session. Reads the activation envelope from the
 * read-only orchestrator, then UPSERTs ONE row. Returns the envelope on success, null on any
 * failure (non-blocking — the caller ignores the result). NEVER throws.
 */
export async function persistDecision(pool: Pool, sessionId: string): Promise<ActivationEnvelope | null> {
  try {
    await ensureDecisionStateSchema(pool);
    const env = await buildActivationEnvelope(pool, sessionId);
    if (env === null) return null; // unknown session — nothing to persist

    const d = env.decision;
    await pool.query(
      `INSERT INTO wc7b_decision_state (
         session_id, canonical_stage, stage_confidence,
         primary_outcome_model, primary_outcome_label, outcome_confidence,
         route_key, product_path, route_confidence,
         confidence, ambiguity, why,
         product_ready, growth_plan_ready, mentor_ready, subscription_ready,
         degraded, composed_from, envelope, resolved_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now(), now()
       )
       ON CONFLICT (session_id) DO UPDATE SET
         canonical_stage       = EXCLUDED.canonical_stage,
         stage_confidence      = EXCLUDED.stage_confidence,
         primary_outcome_model = EXCLUDED.primary_outcome_model,
         primary_outcome_label = EXCLUDED.primary_outcome_label,
         outcome_confidence    = EXCLUDED.outcome_confidence,
         route_key             = EXCLUDED.route_key,
         product_path          = EXCLUDED.product_path,
         route_confidence      = EXCLUDED.route_confidence,
         confidence            = EXCLUDED.confidence,
         ambiguity             = EXCLUDED.ambiguity,
         why                   = EXCLUDED.why,
         product_ready         = EXCLUDED.product_ready,
         growth_plan_ready     = EXCLUDED.growth_plan_ready,
         mentor_ready          = EXCLUDED.mentor_ready,
         subscription_ready    = EXCLUDED.subscription_ready,
         degraded              = EXCLUDED.degraded,
         composed_from         = EXCLUDED.composed_from,
         envelope              = EXCLUDED.envelope,
         updated_at            = now()`,
      [
        sessionId,
        d.stage?.canonical_stage ?? null,
        d.stage?.confidence ?? null,
        d.primary_outcome?.model_key ?? null,
        d.primary_outcome?.display_label ?? null,
        d.primary_outcome?.confidence ?? null,
        d.route?.route_key ?? null,
        d.route?.product_path ?? null,
        d.route?.route_confidence ?? null,
        d.confidence,
        d.ambiguity,
        JSON.stringify(d.why ?? []),
        env.product.ready,
        env.growthPlan.ready,
        env.mentor.ready,
        subscriptionReady(env),
        env.degraded,
        JSON.stringify(env.meta.composed_from ?? []),
        JSON.stringify(env),
      ],
    );
    return env;
  } catch (err) {
    console.warn(
      '[wc7b-decision-persistence] persist failed (non-blocking):',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Read-only fetch of the persisted decision for a session (null when absent / on error). */
export async function getPersistedDecision(pool: Pool, sessionId: string): Promise<PersistedDecision | null> {
  try {
    await ensureDecisionStateSchema(pool);
    const { rows } = await pool.query(
      `SELECT session_id, canonical_stage, confidence, ambiguity, primary_outcome_model, route_key,
              product_ready, growth_plan_ready, mentor_ready, subscription_ready, degraded,
              composed_from, why, resolved_at
         FROM wc7b_decision_state WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      session_id: String(r.session_id),
      canonical_stage: r.canonical_stage ?? null,
      confidence: Number(r.confidence),
      ambiguity: String(r.ambiguity),
      primary_outcome_model: r.primary_outcome_model ?? null,
      route_key: r.route_key ?? null,
      product_ready: !!r.product_ready,
      growth_plan_ready: !!r.growth_plan_ready,
      mentor_ready: !!r.mentor_ready,
      subscription_ready: !!r.subscription_ready,
      degraded: !!r.degraded,
      composed_from: Array.isArray(r.composed_from) ? r.composed_from : [],
      why: Array.isArray(r.why) ? r.why : [],
      resolved_at: r.resolved_at instanceof Date ? r.resolved_at.toISOString() : String(r.resolved_at),
    };
  } catch {
    return null;
  }
}

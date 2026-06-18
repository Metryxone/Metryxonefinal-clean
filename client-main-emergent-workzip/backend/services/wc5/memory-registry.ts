/**
 * CAPADEX WC-L5 — Memory Registry (deterministic persistence contract).
 *
 * COMPOSE-ONLY. This module is the static, deterministic CONTRACT for the WC-L5 Memory Intelligence
 * engine. WC-L5 is a pure PERSISTENCE + RETRIEVAL layer: it SNAPSHOTS already-computed WC-L0→L4
 * intelligence per completed session into `wcl5_memory` and reads it back. It introduces NO new
 * construct / ontology / dimension / scoring / AI model / forecast / intervention / decision — every
 * memory row is a verbatim snapshot of an output some EXISTING layer already produced.
 *
 * The 7 memory types below are the EXACT, closed set this layer may persist. Confidence is always
 * INHERITED from the snapshotted source (never blended, re-derived, or invented).
 *
 * TREND FOLD (honesty-critical): WC-L1 Trend has no dedicated memory type in the closed set. It is
 * folded into `behaviour_memory` (the only user-level type) — NOT into `forecast_memory`, because a
 * forecast covers only 4 kinds (risk/growth/outcome/journey) whereas trends span 9 metrics (4 levers
 * + 5 behaviour dims), so folding into forecast would silently drop the 5 non-forecast trend metrics.
 * behaviour_memory therefore carries TWO key shapes: the WC-L0 user snapshot (`user_intelligence`) and
 * one row per WC-L1 trend (`trend:<metric>`). This keeps "User Memory" and "Trend Memory" directly
 * queryable without inventing a new type.
 *
 * memory_key is a STABLE SEMANTIC key (never the salient VALUE) so UPSERT stays idempotent across
 * re-runs — the value lives in `memory_value`; per-session snapshots (distinct session_id) preserve
 * history without any destructive write.
 */

export interface MemoryTypeSpec {
  /** Human-readable layer that produced the snapshotted intelligence. */
  source_layer: string;
  /** Stable provenance token written to `wcl5_memory.source`. */
  source: string;
  /** The existing read-only getter / table the snapshot is taken from (no recompute). */
  reader: string;
  /** Documented shape of the stable semantic `memory_key` for this type. */
  key_convention: string;
  /** Confidence is always inherited from the source — never produced by this layer. */
  confidence_policy: 'inherited';
}

export const MEMORY_TYPES = {
  stage_memory: {
    source_layer: 'WC-L1 Stage Intelligence',
    source: 'wc-l1-stage',
    reader: 'getSessionStage',
    key_convention: 'canonical_stage',
    confidence_policy: 'inherited',
  },
  outcome_memory: {
    source_layer: 'WC-L2 Outcome Intelligence',
    source: 'wc-l2-outcome',
    reader: 'getSessionOutcomes',
    key_convention: 'model:<model_key>',
    confidence_policy: 'inherited',
  },
  journey_memory: {
    source_layer: 'WC-L3 Journey Intelligence',
    source: 'wc-l3-journey',
    reader: 'getSessionJourney',
    key_convention: 'route',
    confidence_policy: 'inherited',
  },
  decision_memory: {
    source_layer: 'WC-11 Decision Orchestration',
    source: 'wc-11-decision',
    reader: 'getPersistedDecision',
    key_convention: 'route',
    confidence_policy: 'inherited',
  },
  behaviour_memory: {
    // Two key shapes → two distinct provenance tokens are actually written (the engine stamps each row
    // with its true sub-source); this string documents both rather than a single blended token.
    source_layer: 'WC-L0 User Intelligence + WC-L1 Trend (folded)',
    source: 'wc-l0-user-intelligence | wc-l1-trend',
    reader: 'getUserIntelligence + getUserTrends',
    key_convention: 'user_intelligence | trend:<metric>',
    confidence_policy: 'inherited',
  },
  forecast_memory: {
    source_layer: 'WC-L2 Forecast Intelligence',
    source: 'wc-l2-forecast',
    reader: 'computeUserForecasts',
    key_convention: 'forecast:<kind>',
    confidence_policy: 'inherited',
  },
  intervention_memory: {
    source_layer: 'WC-L4 Intervention Intelligence',
    source: 'wc-l4-intervention',
    reader: 'wcl4_interventions (persisted — read, not recomputed)',
    key_convention: 'intervention:<intervention_id>',
    confidence_policy: 'inherited',
  },
} as const satisfies Record<string, MemoryTypeSpec>;

export type MemoryType = keyof typeof MEMORY_TYPES;
export const MEMORY_TYPE_KEYS = Object.keys(MEMORY_TYPES) as MemoryType[];

/** behaviour_memory carries the WC-L0 user snapshot under this fixed key. */
export const BEHAVIOUR_USER_KEY = 'user_intelligence';
/** behaviour_memory carries one WC-L1 trend per key of this shape. */
export const behaviourTrendKey = (metric: string): string => `trend:${metric}`;

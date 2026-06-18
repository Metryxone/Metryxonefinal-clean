/**
 * CAPADEX PIL — Phase 8: Knowledge Graph taxonomy (pure, no DB, no IO).
 *
 * Defines the typed node + edge vocabulary that unifies every CAPADEX intelligence
 * asset into ONE graph, plus deterministic id helpers. This module is the single
 * source of truth for what a node/edge IS; the builder only ever emits ids and
 * relations declared here.
 *
 * CANON (Phase 8):
 *   - Edges are ONLY ever created from a REAL linkage row and carry provenance
 *     (the source table + the row reference). Nothing is fabricated.
 *   - An asset that has no real linkage row is still a node — it simply has no
 *     edges (an honest "not wired in" finding), never a synthesised one.
 *   - Deterministic: ids are pure functions of (type,key) / (relation,src,tgt).
 */

// ── Node taxonomy ────────────────────────────────────────────────────────────
export const NODE_TYPES = [
  'domain',
  'family',
  'atomic_signal',
  'signal',
  'bridge_tag',
  'concern',
  'clarity_question',
  'capability',
  'problem_framing',
  'behavior',
  'archetype',
  'problem',
  'emotion',
  'search_intent',
  'intervention',
  'competency',
  'construct',
  'recommendation',
  'runtime_intervention',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// ── Edge taxonomy (relation = directed src → tgt) ────────────────────────────
export const EDGE_RELATIONS = [
  'family_belongs_to_domain',     // family → domain
  'atomic_belongs_to_family',     // atomic_signal → family
  'atomic_belongs_to_domain',     // atomic_signal → domain
  'tagged_with',                  // {domain|family|atomic|signal|concern|clarity} → bridge_tag
  'concern_activates_signal',     // concern → signal (tier3 map)
  'concern_resolves_clarity',     // concern → bridge_tag (capadex_concern_clarity_map: concern↔clarity resolution)
  'concern_framed_as_capability', // concern → capability (capability_problem_map)
  'capability_addresses_problem', // capability → problem_framing (capability_problem_map)
  'problem_manifests_behavior',   // problem_framing → behavior (capability_problem_behavior_map)
  'behavior_indicates_concern',   // behavior → concern
  'archetype_covers_concern',     // archetype → concern
  'problem_belongs_to_archetype', // problem → archetype
  'emotion_belongs_to_archetype', // emotion → archetype
  'intent_for_archetype',         // search_intent → archetype
  'intent_for_problem',           // search_intent → problem
  'intervention_for_archetype',   // intervention → archetype
  'intervention_for_problem',     // intervention → problem
  'recommendation_anchored_on_construct', // recommendation → construct
  'runtime_intervention_for_construct',   // runtime_intervention → construct
] as const;
export type EdgeRelation = (typeof EDGE_RELATIONS)[number];

// ── Human-readable asset metadata (used by the audit + stats surfaces) ───────
export interface AssetMeta {
  type: NodeType;
  label: string;
  source_table: string;
  description: string;
}
export const ASSET_META: Record<NodeType, AssetMeta> = {
  domain:           { type: 'domain',           label: 'Domain',            source_table: 'capadex_domains',            description: 'Top-tier behavioural domain.' },
  family:           { type: 'family',           label: 'Signal Family',     source_table: 'capadex_families',           description: 'Family of related signals within a domain.' },
  atomic_signal:    { type: 'atomic_signal',    label: 'Atomic Signal',     source_table: 'capadex_atomic_signals',     description: 'Finest-grain behavioural signal.' },
  signal:           { type: 'signal',           label: 'Signal',            source_table: 'capadex_signals',            description: 'Master behavioural signal.' },
  bridge_tag:       { type: 'bridge_tag',       label: 'Bridge Tag',        source_table: '(relational/master bridge tag)', description: 'Routing hub joining concerns, signals and clarity questions.' },
  concern:          { type: 'concern',          label: 'Concern',           source_table: 'capadex_concerns_master',    description: 'Master concern.' },
  clarity_question: { type: 'clarity_question', label: 'Clarity Question',  source_table: 'capadex_clarity_questions',  description: 'Assessment / clarity question.' },
  capability:       { type: 'capability',       label: 'Capability Framing',source_table: 'capability_problem_map',     description: 'Strength framing of a concern.' },
  problem_framing:  { type: 'problem_framing',  label: 'Problem Framing',   source_table: 'capability_problem_map',     description: 'Deficit framing of a concern (capability↔problem↔behavior chain).' },
  behavior:         { type: 'behavior',         label: 'Behavior',          source_table: 'behavior_library',           description: 'Observable behaviour statement.' },
  archetype:        { type: 'archetype',        label: 'Archetype',         source_table: 'archetype_library',          description: 'Behavioural archetype.' },
  problem:          { type: 'problem',          label: 'Problem',           source_table: 'human_problem_library',      description: 'Human problem statement.' },
  emotion:          { type: 'emotion',          label: 'Emotion',           source_table: 'human_emotion_library',      description: 'Emotion statement.' },
  search_intent:    { type: 'search_intent',    label: 'Search Intent',     source_table: 'search_intents',             description: 'Stakeholder search intent.' },
  intervention:     { type: 'intervention',     label: 'Intervention',      source_table: 'pil_intervention_library',   description: 'PIL intervention.' },
  competency:       { type: 'competency',       label: 'Competency',        source_table: 'onto_competencies',          description: 'Trainable competency (separate taxonomy; statically unlinked).' },
  construct:        { type: 'construct',        label: 'Construct',         source_table: '(anchor_construct/construct_key)', description: 'Behavioural construct key (runtime anchor).' },
  recommendation:   { type: 'recommendation',   label: 'Recommendation',    source_table: 'recommendation_library',     description: 'Authored recommendation.' },
  runtime_intervention: { type: 'runtime_intervention', label: 'Runtime Intervention', source_table: 'intervention_library', description: 'Construct-keyed runtime intervention.' },
};

// ── Deterministic id helpers ─────────────────────────────────────────────────
const KEY_SAFE = /[^A-Za-z0-9_.:-]+/g;

/** Normalise a raw key into a stable, id-safe token (collapses whitespace/odd chars). */
export function safeKey(raw: string | number | null | undefined): string {
  return String(raw ?? '').trim().replace(KEY_SAFE, '_');
}

/** Stable node id: `<type>:<key>`. */
export function nodeId(type: NodeType, key: string | number): string {
  return `${type}:${safeKey(key)}`;
}

/** Stable, dedupe-friendly edge id: `<relation>|<source>>><target>`. */
export function edgeId(relation: EdgeRelation, source: string, target: string): string {
  return `${relation}|${source}>>${target}`;
}

// ── Graph value types ────────────────────────────────────────────────────────
export interface KGNode {
  id: string;
  type: NodeType;
  key: string;
  label: string;
  attrs?: Record<string, unknown>;
}

export interface EdgeProvenance {
  table: string;            // source table the linkage row came from
  ref?: string | number;    // row id / key that proves the edge (never fabricated)
}

export interface KGEdge {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
  provenance: EdgeProvenance;
}

export interface KnowledgeGraph {
  nodes: KGNode[];
  edges: KGEdge[];
  built_at: string;
}

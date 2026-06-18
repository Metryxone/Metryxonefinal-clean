/**
 * CAPADEX PIL — Phase 8A: Graph Maturation taxonomy (pure, no DB, no IO).
 *
 * MATURATION, NOT REPLACEMENT. The canonical graph remains pil_kg_nodes / pil_kg_edges
 * (Phase 8). This module declares the descriptive layers that sit ON TOP of that
 * one graph — it NEVER defines a second node/edge store:
 *
 *   - NODE_CATEGORIES (14): the product-level node categories. Each groups one or
 *     more of the existing granular pil_kg_nodes.node_type values (NODE_TYPES) — it is
 *     a *view* over the canonical graph, not a new type system.
 *   - RELATIONSHIP_TYPES (11): the semantic relationship verbs. Each groups one or
 *     more of the existing granular pil_kg_edges.relation values (EDGE_RELATIONS).
 *
 * CANON (strict):
 *   - Every granular NODE_TYPE maps to EXACTLY ONE category; every EDGE_RELATION to
 *     EXACTLY ONE verb (bijective coverage — asserted by buildCoverageReport + tests).
 *   - `report_section` and `EXPLAINS` are honest forward-looking entries with ZERO
 *     members today (no kg_* rows back them yet) — declared, never fabricated.
 *   - Pure + deterministic: the catalogs are a function of (NODE_TYPES, EDGE_RELATIONS).
 */
import {
  NODE_TYPES,
  EDGE_RELATIONS,
  ASSET_META,
  type NodeType,
  type EdgeRelation,
} from './knowledge-graph-schema';

// ── Node categories (14, product-level) ──────────────────────────────────────
export const NODE_CATEGORY_KEYS = [
  'domain',
  'bridge_tag',
  'concern',
  'signal',
  'question',
  'capability',
  'problem',
  'behavior',
  'archetype',
  'emotion',
  'search_intent',
  'intervention',
  'recommendation',
  'report_section',
] as const;
export type NodeCategoryKey = (typeof NODE_CATEGORY_KEYS)[number];

export interface NodeCategory {
  key: NodeCategoryKey;
  label: string;
  description: string;
  /** The granular pil_kg_nodes.node_type values this category groups (the real graph). */
  member_node_types: NodeType[];
  display_order: number;
}

/**
 * Each granular NODE_TYPE assigned to exactly one product category. Finer engine
 * types (family/atomic_signal/construct → signal; competency → capability;
 * problem_framing → problem; runtime_intervention → intervention) roll up here.
 */
const NODE_TYPE_TO_CATEGORY: Record<NodeType, NodeCategoryKey> = {
  domain: 'domain',
  family: 'signal',
  atomic_signal: 'signal',
  signal: 'signal',
  construct: 'signal',
  bridge_tag: 'bridge_tag',
  concern: 'concern',
  clarity_question: 'question',
  capability: 'capability',
  competency: 'capability',
  problem_framing: 'problem',
  problem: 'problem',
  behavior: 'behavior',
  archetype: 'archetype',
  emotion: 'emotion',
  search_intent: 'search_intent',
  intervention: 'intervention',
  runtime_intervention: 'intervention',
  recommendation: 'recommendation',
};

const NODE_CATEGORY_META: Record<NodeCategoryKey, { label: string; description: string }> = {
  domain:         { label: 'Domain',         description: 'Top-tier behavioural domain.' },
  bridge_tag:     { label: 'Bridge Tag',     description: 'Routing hub joining concerns, signals and clarity questions.' },
  concern:        { label: 'Concern',        description: 'Master concern surfaced to a person.' },
  signal:         { label: 'Signal',         description: 'Behavioural signal at any grain (family, atomic, master, construct).' },
  question:       { label: 'Question',       description: 'Assessment / clarity question.' },
  capability:     { label: 'Capability',     description: 'Strength framing / trainable competency.' },
  problem:        { label: 'Problem',        description: 'Deficit framing / human problem statement.' },
  behavior:       { label: 'Behavior',       description: 'Observable behaviour statement.' },
  archetype:      { label: 'Archetype',      description: 'Behavioural archetype.' },
  emotion:        { label: 'Emotion',        description: 'Emotion statement.' },
  search_intent:  { label: 'Search Intent',  description: 'Stakeholder search intent.' },
  intervention:   { label: 'Intervention',   description: 'Authored or runtime intervention.' },
  recommendation: { label: 'Recommendation', description: 'Authored recommendation.' },
  report_section: { label: 'Report Section', description: 'Report narrative section (forward-looking: no graph nodes yet).' },
};

/** Build the 14 node categories deterministically from the granular type assignment. */
export const NODE_CATEGORIES: NodeCategory[] = NODE_CATEGORY_KEYS.map((key, i) => ({
  key,
  label: NODE_CATEGORY_META[key].label,
  description: NODE_CATEGORY_META[key].description,
  member_node_types: NODE_TYPES.filter((t) => NODE_TYPE_TO_CATEGORY[t] === key),
  display_order: i,
}));

/** Source tables backing a category (deduped, from ASSET_META). */
export function categorySourceTables(cat: NodeCategory): string[] {
  const set = new Set<string>();
  for (const t of cat.member_node_types) set.add(ASSET_META[t].source_table);
  return [...set];
}

// ── Relationship types (11, semantic verbs) ──────────────────────────────────
export const RELATIONSHIP_TYPE_KEYS = [
  'BELONGS_TO',
  'INDICATES',
  'MEASURES',
  'CONTRIBUTES_TO',
  'CAUSES',
  'EXPRESSES',
  'CLUSTERS_WITH',
  'LEADS_TO',
  'RECOMMENDS',
  'SUPPORTS',
  'EXPLAINS',
] as const;
export type RelationshipTypeKey = (typeof RELATIONSHIP_TYPE_KEYS)[number];

export interface RelationshipType {
  key: RelationshipTypeKey;
  label: string;
  description: string;
  directed: boolean;
  /** The granular pil_kg_edges.relation values this verb groups (the real graph). */
  member_relations: EdgeRelation[];
  display_order: number;
}

/** Each granular EDGE_RELATION assigned to exactly one semantic verb. */
const EDGE_RELATION_TO_TYPE: Record<EdgeRelation, RelationshipTypeKey> = {
  family_belongs_to_domain: 'BELONGS_TO',
  atomic_belongs_to_family: 'BELONGS_TO',
  atomic_belongs_to_domain: 'BELONGS_TO',
  problem_belongs_to_archetype: 'BELONGS_TO',
  emotion_belongs_to_archetype: 'BELONGS_TO',
  tagged_with: 'CLUSTERS_WITH',
  archetype_covers_concern: 'CLUSTERS_WITH',
  concern_activates_signal: 'MEASURES',
  concern_resolves_clarity: 'MEASURES',
  concern_framed_as_capability: 'EXPRESSES',
  capability_addresses_problem: 'CONTRIBUTES_TO',
  problem_manifests_behavior: 'CAUSES',
  behavior_indicates_concern: 'INDICATES',
  intent_for_archetype: 'LEADS_TO',
  intent_for_problem: 'LEADS_TO',
  intervention_for_archetype: 'SUPPORTS',
  intervention_for_problem: 'SUPPORTS',
  runtime_intervention_for_construct: 'SUPPORTS',
  recommendation_anchored_on_construct: 'RECOMMENDS',
};

const RELATIONSHIP_TYPE_META: Record<RelationshipTypeKey, { label: string; description: string; directed: boolean }> = {
  BELONGS_TO:     { label: 'Belongs To',     description: 'Structural containment / hierarchy membership.', directed: true },
  INDICATES:      { label: 'Indicates',      description: 'Observable evidence that points to a concern.', directed: true },
  MEASURES:       { label: 'Measures',       description: 'A signal or question that quantifies a concern.', directed: true },
  CONTRIBUTES_TO: { label: 'Contributes To', description: 'A capability that addresses / contributes to a problem.', directed: true },
  CAUSES:         { label: 'Causes',         description: 'A problem that manifests as a behaviour.', directed: true },
  EXPRESSES:      { label: 'Expresses',      description: 'A concern expressed as a capability framing.', directed: true },
  CLUSTERS_WITH:  { label: 'Clusters With',  description: 'Grouping under a routing hub or archetype cluster.', directed: true },
  LEADS_TO:       { label: 'Leads To',       description: 'A search intent that leads to an archetype or problem.', directed: true },
  RECOMMENDS:     { label: 'Recommends',     description: 'A recommendation anchored on a construct.', directed: true },
  SUPPORTS:       { label: 'Supports',       description: 'An intervention that supports an archetype, problem or construct.', directed: true },
  EXPLAINS:       { label: 'Explains',       description: 'Explanatory lineage (forward-looking: no graph edges yet).', directed: true },
};

/** Build the 11 relationship types deterministically from the granular assignment. */
export const RELATIONSHIP_TYPES: RelationshipType[] = RELATIONSHIP_TYPE_KEYS.map((key, i) => ({
  key,
  label: RELATIONSHIP_TYPE_META[key].label,
  description: RELATIONSHIP_TYPE_META[key].description,
  directed: RELATIONSHIP_TYPE_META[key].directed,
  member_relations: EDGE_RELATIONS.filter((r) => EDGE_RELATION_TO_TYPE[r] === key),
  display_order: i,
}));

// ── Coverage proof (bijective: every granular type/relation mapped exactly once) ─
export interface CoverageReport {
  node_types_total: number;
  node_types_covered: number;
  node_type_orphans: NodeType[];        // mapped to no category (must be empty)
  node_type_duplicates: NodeType[];     // mapped to >1 category (must be empty)
  relations_total: number;
  relations_covered: number;
  relation_orphans: EdgeRelation[];     // must be empty
  relation_duplicates: EdgeRelation[];  // must be empty
  empty_categories: NodeCategoryKey[];      // declared categories with 0 members (e.g. report_section)
  empty_relationship_types: RelationshipTypeKey[]; // e.g. EXPLAINS
  is_bijective: boolean;
}

export function buildCoverageReport(): CoverageReport {
  const nodeSeen = new Map<NodeType, number>();
  for (const cat of NODE_CATEGORIES) {
    for (const t of cat.member_node_types) nodeSeen.set(t, (nodeSeen.get(t) ?? 0) + 1);
  }
  const relSeen = new Map<EdgeRelation, number>();
  for (const rt of RELATIONSHIP_TYPES) {
    for (const r of rt.member_relations) relSeen.set(r, (relSeen.get(r) ?? 0) + 1);
  }

  const node_type_orphans = NODE_TYPES.filter((t) => !nodeSeen.has(t));
  const node_type_duplicates = [...nodeSeen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
  const relation_orphans = EDGE_RELATIONS.filter((r) => !relSeen.has(r));
  const relation_duplicates = [...relSeen.entries()].filter(([, n]) => n > 1).map(([r]) => r);

  const empty_categories = NODE_CATEGORIES.filter((c) => c.member_node_types.length === 0).map((c) => c.key);
  const empty_relationship_types = RELATIONSHIP_TYPES.filter((r) => r.member_relations.length === 0).map((r) => r.key);

  return {
    node_types_total: NODE_TYPES.length,
    node_types_covered: nodeSeen.size,
    node_type_orphans,
    node_type_duplicates,
    relations_total: EDGE_RELATIONS.length,
    relations_covered: relSeen.size,
    relation_orphans,
    relation_duplicates,
    empty_categories,
    empty_relationship_types,
    is_bijective:
      node_type_orphans.length === 0 &&
      node_type_duplicates.length === 0 &&
      relation_orphans.length === 0 &&
      relation_duplicates.length === 0,
  };
}

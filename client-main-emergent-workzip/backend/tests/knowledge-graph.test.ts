/**
 * CAPADEX Phase 8 — Knowledge Graph engine tests (pure, no DB).
 *   Run: npx tsx backend/tests/knowledge-graph.test.ts
 *
 * Verifies: deterministic assembly, provenance on every edge, no dangling edges,
 * neighbours/path/components/orphans/hubs, and the export serialisers.
 */
import { assembleGraph, type GraphInputs } from '../services/pil/knowledge-graph-builder';
import {
  buildIndex, neighbors, shortestPath, neighborhood,
  connectedComponents, orphans, hubs, graphStats,
} from '../services/pil/knowledge-graph-query';
import { toCytoscape, toGraphML, lineageInducedSubgraph } from '../services/pil/knowledge-graph-service';
import { nodeId } from '../services/pil/knowledge-graph-schema';
import type { PipelineHop } from '../services/pil/pipeline-resolver';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error('  ✗ FAIL:', msg); }
}
function eq(a: unknown, b: unknown, msg: string) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

const empty: GraphInputs = {
  domains: [], families: [], atomics: [], signals: [], concerns: [], clarity: [],
  concernSignal: [], concernClarity: [], capabilities: [], cpb: [], behaviors: [],
  archetypes: [], archetypeConcern: [], problems: [], emotions: [], intents: [],
  interventions: [], competencies: [], recommendations: [], runtimeInterventions: [],
};

function fixture(): GraphInputs {
  return {
    ...empty,
    domains: [{ domain_id: 'D1', domain_name: 'Emotional', bridge: 'TAG_A' }],
    families: [{ family_id: 'F1', family_name: 'Stress', domain_id: 'D1', bridge: 'TAG_A' }],
    atomics: [{ atomic_signal_id: 'A1', label: 'overload', family_id: 'F1', domain_id: 'D1', bridge: 'TAG_A' }],
    signals: [{ signal_id: 'SIG_1', signal_name: 'emotional_overload', bridge: 'TAG_A' }],
    concerns: [
      { concern_id: 'C1', pk: 1, label: 'Burnout', domain: 'Emotional', cluster: 'stress', bridge: 'TAG_A' },
      { concern_id: 'C2', pk: 2, label: 'Lonely', domain: 'Social', cluster: 'social', bridge: 'TAG_B' },
    ],
    clarity: [{ question_id: 'Q1', question: 'Do you feel drained?', bridge: 'TAG_A' }],
    concernSignal: [{ concern_id: 'C1', signal_ref: 'SIG_1', score: 0.9, confidence: 0.8 }],
    concernClarity: [{ id: 'CCM_1', concern_id: 'C1', bridge: 'TAG_A', match_method: 'bridge_exact', score: 0.95, question_count: 12 }],
    capabilities: [{ concern_id: 'C1', capability_name: 'Sustain Energy', problem_concern_id: 'C1', problem_name: 'Energy Depletion', confidence: 0.7, mapping_id: 10 }],
    cpb: [{ mapping_id: 20, problem_concern_id: 'C1', problem_name: 'Energy Depletion', behavior_id: 100 }],
    behaviors: [{ behavior_id: 100, concern_id: 'C1', statement: 'skips meals', category: 'physical' }],
    archetypes: [{ archetype_key: 'emotional_regulation', archetype_name: 'Regulator', category: 'Emotional' }],
    archetypeConcern: [{ archetype_key: 'emotional_regulation', concern_id: 'C1', map_id: 5 }],
    problems: [{ problem_id: 200, statement: 'cannot calm down', archetype_key: 'emotional_regulation' }],
    emotions: [{ emotion_id: 300, statement: 'I feel tense', emotion_type: 'fear', archetype_key: 'emotional_regulation' }],
    intents: [{ intent_id: 400, phrase: 'how to relax', archetype_key: 'emotional_regulation', problem_id: 200 }],
    interventions: [{ intervention_id: 500, text: 'box breathing', archetype_key: 'emotional_regulation', problem_id: 200, type: 'exercise' }],
    competencies: [{ id: 'comp_x', name: 'Adaptability', comp_domain: 'dom_behavioral', comp_family: 'fam_resilience' }],
    recommendations: [{ recommendation_key: 'REC_1', title: 'Sleep plan', category: 'development', anchor_construct: 'EMOTIONAL_REGULATION' }],
    // UUID ids (intervention_library.id is uuid) — two distinct ids must stay two distinct nodes.
    runtimeInterventions: [
      { id: '11111111-1111-4111-8111-111111111111', construct_key: 'EMOTIONAL_REGULATION', persona: 'student', confidence_band: 'moderate' },
      { id: '22222222-2222-4222-8222-222222222222', construct_key: 'RESILIENCE', persona: 'adult', confidence_band: 'high' },
    ],
  };
}

// ── 1. Determinism ────────────────────────────────────────────────────────────
const g1 = assembleGraph(fixture(), '2026-01-01T00:00:00Z');
const g2 = assembleGraph(fixture(), '2026-01-01T00:00:00Z');
eq(g1.nodes.length, g2.nodes.length, 'deterministic node count');
eq(g1.edges.map((e) => e.id).sort(), g2.edges.map((e) => e.id).sort(), 'deterministic edge ids');

// ── 2. Every edge has provenance + both endpoints exist (no dangling) ─────────
const ids = new Set(g1.nodes.map((n) => n.id));
ok(g1.edges.every((e) => e.provenance && !!e.provenance.table), 'every edge provenance-stamped');
ok(g1.edges.every((e) => ids.has(e.source) && ids.has(e.target)), 'no dangling edges');

// ── 3. Expected structural edges present ──────────────────────────────────────
const idx = buildIndex(g1);
const concernC1 = nodeId('concern', 'C1');
const relsFromC1 = neighbors(idx, concernC1).map((n) => n.via.relation).sort();
ok(relsFromC1.includes('concern_activates_signal'), 'concern→signal edge');
ok(relsFromC1.includes('concern_framed_as_capability'), 'concern→capability edge');
ok(relsFromC1.includes('behavior_indicates_concern'), 'behavior→concern edge (incoming)');
ok(relsFromC1.includes('archetype_covers_concern'), 'archetype→concern edge (incoming)');
ok(relsFromC1.includes('tagged_with'), 'concern→bridge_tag edge');
ok(relsFromC1.includes('concern_resolves_clarity'), 'concern→clarity hard edge (concern_clarity_map)');

// capability → problem_framing → behavior chain (from the real cpb map rows) ──
const capC1 = nodeId('capability', 'C1');
const probC1 = nodeId('problem_framing', 'C1');
ok(neighbors(idx, capC1, { relations: ['capability_addresses_problem'] }).some((n) => n.node.id === probC1), 'capability→problem edge');
ok(neighbors(idx, probC1, { relations: ['problem_manifests_behavior'] }).some((n) => n.node.id === nodeId('behavior', 100)), 'problem→behavior edge');

// concern_resolves_clarity lands on the clarity-side bridge tag node ──────────
ok(neighbors(idx, concernC1, { relations: ['concern_resolves_clarity'], types: ['bridge_tag'] }).length === 1, 'concern_resolves_clarity → bridge_tag');

// runtime_intervention UUID ids stay DISTINCT nodes (regression: was Number()→NaN collapse)
const riNodes = g1.nodes.filter((n) => n.type === 'runtime_intervention');
eq(riNodes.length, 2, 'two UUID runtime interventions → two distinct nodes (no NaN collapse)');
ok(riNodes.every((n) => n.id !== nodeId('runtime_intervention', 'NaN')), 'no NaN-keyed runtime_intervention node');

// family→domain + atomic hierarchy
ok(neighbors(idx, nodeId('family', 'F1'), { relations: ['family_belongs_to_domain'] }).length === 1, 'family→domain');
ok(neighbors(idx, nodeId('atomic_signal', 'A1'), { relations: ['atomic_belongs_to_family'] }).length === 1, 'atomic→family');

// ── 4. Path: clarity_question → … → intervention (via bridge tag + concern) ────
const path = shortestPath(idx, nodeId('clarity_question', 'Q1'), nodeId('intervention', 500));
ok(path.length > 0, 'clarity→intervention reachable');
ok(path[0].type === 'clarity_question' && path[path.length - 1].type === 'intervention', 'path endpoints correct');

// ── 5. Components: construct region + competency are separate from the core ────
const comps = connectedComponents(g1, idx);
ok(comps.length >= 2, 'multiple components (runtime-bound region is separate)');
const competencyComp = comps.find((c) => c.by_type.competency);
ok(!!competencyComp && competencyComp.by_type.competency === 1, 'competency is its own (orphan) component');
const constructComp = comps.find((c) => c.by_type.construct);
ok(!!constructComp && !!constructComp.by_type.recommendation && !!constructComp.by_type.runtime_intervention, 'construct hub links recommendation + runtime_intervention');

// ── 6. Orphans: competency has no edges; C2 (TAG_B) connects only to its tag ───
const orph = orphans(g1, idx);
ok(orph.by_type.competency === 1, 'competency reported as orphan');

// ── 7. Hubs: bridge tag TAG_A is a high-degree hub ────────────────────────────
const topHubs = hubs(g1, idx, { limit: 5 });
ok(topHubs.some((h) => h.type === 'bridge_tag' && h.id === nodeId('bridge_tag', 'TAG_A')), 'bridge_tag is a hub');

// ── 8. Stats sanity ───────────────────────────────────────────────────────────
const stats = graphStats(g1, idx);
eq(stats.node_count, g1.nodes.length, 'stats node count matches');
eq(stats.edge_count, g1.edges.length, 'stats edge count matches');
ok(stats.orphan_count >= 1, 'stats orphan count includes competency');

// ── 8b. No fabrication: per-table edge counts never exceed real source rows ───
const fx = fixture();
const byTable = stats.edges_by_provenance_table;
ok((byTable['capadex_concern_clarity_map'] ?? 0) <= fx.concernClarity.length, 'clarity edges ≤ map rows');
ok((byTable['capability_problem_behavior_map'] ?? 0) <= fx.cpb.length, 'cpb edges ≤ map rows');
ok((byTable['capability_problem_map'] ?? 0) <= fx.capabilities.length * 2, 'capability_problem_map edges ≤ 2×rows (capability + problem framing)');
ok((byTable['intervention_library'] ?? 0) <= fx.runtimeInterventions.length, 'runtime intervention edges ≤ rows');

// ── 8c. Row fidelity: duplicate linkage rows (same endpoints) stay distinct ──
// CONTRACT: one edge per REAL linkage row. Two map rows that resolve to the same
// (relation, source, target) must NOT collapse into one edge (no dropped rows).
const dupInputs: GraphInputs = {
  ...empty,
  concerns: [{ concern_id: 'C1', pk: 1, label: 'Burnout', domain: 'Emotional', cluster: 'stress', bridge: 'TAG_A' }],
  behaviors: [{ behavior_id: 100, concern_id: 'C1', statement: 'skips meals', category: 'physical' }],
  capabilities: [{ concern_id: 'C1', capability_name: 'cap', problem_concern_id: 'C1', problem_name: 'p', confidence: 0.5, mapping_id: 10 }],
  concernClarity: [
    { id: 'CCM_1', concern_id: 'C1', bridge: 'TAG_A', match_method: 'bridge_exact', score: 0.9, question_count: 5 },
    { id: 'CCM_2', concern_id: 'C1', bridge: 'TAG_A', match_method: 'token_semantic', score: 0.7, question_count: 3 },
  ],
  cpb: [
    { mapping_id: 20, problem_concern_id: 'C1', problem_name: 'p', behavior_id: 100 },
    { mapping_id: 21, problem_concern_id: 'C1', problem_name: 'p', behavior_id: 100 },
  ],
};
const dupG = assembleGraph(dupInputs);
const dupStats = graphStats(dupG, buildIndex(dupG));
eq(dupStats.edges_by_provenance_table['capadex_concern_clarity_map'], 2, 'two clarity rows (same endpoints) → two distinct edges (no collapse)');
eq(dupStats.edges_by_provenance_table['capability_problem_behavior_map'], 2, 'two cpb rows (same endpoints) → two distinct edges (no collapse)');
ok(new Set(dupG.edges.map((e) => e.id)).size === dupG.edges.length, 'every edge id is unique (row-keyed)');

// ── 8d. Session subgraph = lineage-induced slice, NOT a blind k-hop ball ──────
// Build the lineage hops the resolver would emit for a C1 session, induce the
// subgraph over the static fixture graph, and assert it is EXACTLY the chain
// (concern→capability→problem_framing→behavior + archetype) — excluding the
// huge TAG_A bridge-tag hub and the unrelated C2 a k-hop ball would drag in.
const lineageHops: PipelineHop[] = [
  { step: 2, key: 'signal_to_concern', label: '', resolved: true, summary: '', data: { concern_id: 'C1' } },
  { step: 3, key: 'concern_to_capability', label: '', resolved: true, summary: '', data: { capability_name: 'Sustain Energy' } },
  { step: 4, key: 'capability_to_problem', label: '', resolved: true, summary: '', data: { problem_name: 'Energy Depletion' } },
  { step: 5, key: 'problem_to_behavior', label: '', resolved: true, summary: '', data: { behaviours: [{ behavior_id: 100 }] } },
  { step: 6, key: 'behavior_to_archetype', label: '', resolved: true, summary: '', data: { archetype_key: 'emotional_regulation' } },
];
const lin = lineageInducedSubgraph(idx, lineageHops, 'C1');
const linIds = new Set(lin.nodes.map((n) => n.id));
eq(lin.anchor, concernC1, 'lineage subgraph anchored on the resolved concern');
ok(linIds.has(capC1) && linIds.has(probC1) && linIds.has(nodeId('behavior', 100)) && linIds.has(nodeId('archetype', 'emotional_regulation')), 'lineage nodes present (capability/problem/behavior/archetype)');
ok(!linIds.has(nodeId('bridge_tag', 'TAG_A')), 'lineage slice excludes the TAG_A hub a k-hop ball would pull in');
ok(!linIds.has(nodeId('concern', 'C2')), 'lineage slice excludes the unrelated concern C2');
ok(lin.nodes.every((n) => !!n.hop_role), 'every lineage node annotated with its hop role');
ok(lin.edges.every((e) => linIds.has(e.source) && linIds.has(e.target)), 'lineage edges are induced within the slice (no dangling)');
ok(lin.edges.some((e) => e.relation === 'concern_framed_as_capability') && lin.edges.some((e) => e.relation === 'problem_manifests_behavior'), 'lineage chain edges present');

// Unresolved hops contribute nothing (graceful degradation, no fabrication).
const linDeg = lineageInducedSubgraph(idx, [{ step: 2, key: 'signal_to_concern', label: '', resolved: false, summary: '', data: null }], 'C1');
eq(linDeg.nodes.length, 1, 'only the anchor concern survives when every hop is unresolved');

// ── 9. Empty inputs → empty graph (degrades, never throws) ────────────────────
const ge = assembleGraph(empty);
eq(ge.nodes.length, 0, 'empty inputs → 0 nodes');
eq(ge.edges.length, 0, 'empty inputs → 0 edges');

// ── 10. Exports ───────────────────────────────────────────────────────────────
const sub = neighborhood(idx, concernC1, 2);
const cy = toCytoscape(sub.nodes, sub.edges) as any;
ok(Array.isArray(cy.elements.nodes) && cy.elements.nodes.length === sub.nodes.length, 'cytoscape node count');
const gml = toGraphML(sub.nodes, sub.edges);
ok(gml.startsWith('<?xml') && gml.includes('<graphml'), 'graphml well-formed header');
ok(gml.includes('</graphml>'), 'graphml closed');

console.log(`\nknowledge-graph.test.ts — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

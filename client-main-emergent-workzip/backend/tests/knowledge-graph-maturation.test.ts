/**
 * CAPADEX PIL — Phase 8A: Graph Maturation tests (pure, no DB).
 *   Run: npx tsx backend/tests/knowledge-graph-maturation.test.ts
 *
 * Proves the maturation taxonomy is a faithful, bijective VIEW over the canonical
 * Phase-8 graph taxonomy (every granular node type / edge relation grouped exactly
 * once) and that the pure similarity core is correct + bounded.
 */
import { NODE_TYPES, EDGE_RELATIONS } from '../services/pil/knowledge-graph-schema';
import {
  NODE_CATEGORIES,
  NODE_CATEGORY_KEYS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_KEYS,
  buildCoverageReport,
} from '../services/pil/knowledge-graph-maturation-schema';
import {
  jaccard,
  computeSimilarityFromAdjacency,
} from '../services/pil/knowledge-graph-maturation';

let passed = 0;
let failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error('  ✗ ' + msg); }
}
function eq(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

// ── 1. Catalog shape ─────────────────────────────────────────────────────────
eq(NODE_CATEGORIES.length, 14, '14 node categories');
eq(RELATIONSHIP_TYPES.length, 11, '11 relationship types');
eq(NODE_CATEGORIES.map((c) => c.key), [...NODE_CATEGORY_KEYS], 'node category order matches keys');
eq(RELATIONSHIP_TYPES.map((r) => r.key), [...RELATIONSHIP_TYPE_KEYS], 'relationship type order matches keys');
ok(NODE_CATEGORIES.every((c) => c.label.length > 0 && c.description.length > 0), 'categories have label+description');
ok(RELATIONSHIP_TYPES.every((r) => r.label.length > 0 && r.description.length > 0), 'verbs have label+description');
ok(NODE_CATEGORIES.every((c, i) => c.display_order === i), 'category display_order is stable');

// ── 2. Bijective coverage of the REAL graph taxonomy ─────────────────────────
const cov = buildCoverageReport();
ok(cov.is_bijective, 'taxonomy is bijective');
eq(cov.node_type_orphans, [], 'no node-type orphans (every pil_kg_nodes.node_type grouped)');
eq(cov.node_type_duplicates, [], 'no node-type assigned to >1 category');
eq(cov.relation_orphans, [], 'no edge-relation orphans (every pil_kg_edges.relation grouped)');
eq(cov.relation_duplicates, [], 'no edge-relation assigned to >1 verb');
eq(cov.node_types_covered, NODE_TYPES.length, 'all granular node types covered');
eq(cov.relations_covered, EDGE_RELATIONS.length, 'all granular relations covered');

// union of member_node_types === NODE_TYPES (set equality)
const unionTypes = new Set(NODE_CATEGORIES.flatMap((c) => c.member_node_types));
eq([...unionTypes].sort(), [...NODE_TYPES].sort(), 'member_node_types union === NODE_TYPES');
const unionRels = new Set(RELATIONSHIP_TYPES.flatMap((r) => r.member_relations));
eq([...unionRels].sort(), [...EDGE_RELATIONS].sort(), 'member_relations union === EDGE_RELATIONS');

// ── 3. Honest forward-looking (zero-member) entries ──────────────────────────
eq(cov.empty_categories, ['report_section'], 'report_section is the only empty category');
eq(cov.empty_relationship_types, ['EXPLAINS'], 'EXPLAINS is the only empty relationship type');
ok(NODE_CATEGORIES.find((c) => c.key === 'report_section')!.member_node_types.length === 0, 'report_section has 0 members');
ok(RELATIONSHIP_TYPES.find((r) => r.key === 'EXPLAINS')!.member_relations.length === 0, 'EXPLAINS has 0 members');

// spot-check a few mappings
const cat = (k: string) => NODE_CATEGORIES.find((c) => c.key === k)!;
ok(cat('signal').member_node_types.includes('atomic_signal') && cat('signal').member_node_types.includes('construct'), 'signal groups atomic_signal + construct');
ok(cat('capability').member_node_types.includes('competency'), 'capability groups competency');
ok(cat('intervention').member_node_types.includes('runtime_intervention'), 'intervention groups runtime_intervention');
const verb = (k: string) => RELATIONSHIP_TYPES.find((r) => r.key === k)!;
ok(verb('BELONGS_TO').member_relations.includes('family_belongs_to_domain'), 'BELONGS_TO groups family_belongs_to_domain');
ok(verb('INDICATES').member_relations.includes('behavior_indicates_concern'), 'INDICATES groups behavior_indicates_concern');
ok(verb('SUPPORTS').member_relations.length === 3, 'SUPPORTS groups 3 relations');

// ── 4. Determinism ───────────────────────────────────────────────────────────
eq(buildCoverageReport(), cov, 'coverage report is deterministic');

// ── 5. Similarity pure core ──────────────────────────────────────────────────
eq(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])).score, 2 / 4, 'jaccard {a,b,c}∩{b,c,d} = 0.5');
eq(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])).shared, 2, 'jaccard shared = 2');
eq(jaccard(new Set(), new Set()).score, 0, 'jaccard of empties = 0');
eq(jaccard(new Set(['x']), new Set(['y'])).score, 0, 'jaccard disjoint = 0');

// X and Y share neighbours n1,n2 (identical sets) → score 1.0; Z shares only n2.
const adj = new Map<string, Set<string>>([
  ['X', new Set(['n1', 'n2'])],
  ['Y', new Set(['n1', 'n2'])],
  ['Z', new Set(['n2', 'n3'])],
]);
const sims = computeSimilarityFromAdjacency(adj, ['X', 'Y', 'Z'], { topK: 5, minScore: 0.01 });
const xy = sims.find((p) => p.source_id === 'X' && p.target_id === 'Y');
ok(!!xy && Math.abs(xy.score - 1) < 1e-9, 'X~Y similarity is 1.0 (identical neighbours)');
const xz = sims.find((p) => p.source_id === 'X' && p.target_id === 'Z');
ok(!!xz && Math.abs(xz.score - 1 / 3) < 1e-9, 'X~Z similarity is 1/3 (share n2 of {n1,n2,n3})');
// symmetry: every pair appears from both anchors
ok(sims.some((p) => p.source_id === 'Y' && p.target_id === 'X'), 'similarity is emitted symmetrically');
// nodes with no shared neighbour produce no pair
const none = computeSimilarityFromAdjacency(new Map([['A', new Set(['p'])], ['B', new Set(['q'])]]), ['A', 'B'], {});
eq(none, [], 'disjoint neighbours → no pairs (bounded by real adjacency)');
// determinism
eq(computeSimilarityFromAdjacency(adj, ['X', 'Y', 'Z'], { topK: 5, minScore: 0.01 }), sims, 'similarity is deterministic');

// ── done ─────────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`knowledge-graph-maturation.test.ts — ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`knowledge-graph-maturation.test.ts — ${passed} passed, 0 failed`);

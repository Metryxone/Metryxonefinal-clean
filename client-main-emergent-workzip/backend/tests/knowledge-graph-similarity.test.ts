/**
 * CAPADEX PIL — Phase 8C: SimilarityEngine tests (pure; no DB).
 *   Run: cd backend && npx tsx tests/knowledge-graph-similarity.test.ts
 *
 * Builds a hand-crafted traversal index and asserts the pure resolvers:
 *   - same-category similarity detection + ranking
 *   - same-category restriction (no cross-category leakage)
 *   - symmetry (A~B ⇒ B~A) + determinism under shuffled edge order
 *   - explainability: every match surfaces non-empty shared_neighbors
 *   - false-match review: a hub-only match is flagged
 *   - recommendations-like-this for a recommendation anchor + a non-recommendation anchor
 */
import { buildTraversalIndex, type RawGraph, type CatalogMaps } from '../services/pil/graph-traversal-engine';
import {
  adjacencyFromIndex,
  resolveSimilar,
  resolveRecommendationsLikeThis,
  computeCategoryMatches,
  HUB_DEGREE_THRESHOLD,
} from '../services/pil/similarity-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

// ── Fixture ──────────────────────────────────────────────────────────────────
// Concerns C1,C2 strongly share signals s1,s2,s3 (similar). C3 shares only s4
// with C1 (weaker). C4 connects ONLY through hub H (degree-heavy) → hub_only.
// Recommendations R1,R2 share construct k1,k2 (similar recs); R3 shares only k1.
// A problem P1 also links signals s1,s2 → must NOT appear as a "concern" match.
function makeGraph(): RawGraph {
  const nodes: RawGraph['nodes'] = [
    { id: 'concern:C1', node_type: 'concern', label: 'Anxiety' },
    { id: 'concern:C2', node_type: 'concern', label: 'Overthinking' },
    { id: 'concern:C3', node_type: 'concern', label: 'Restlessness' },
    { id: 'concern:C4', node_type: 'concern', label: 'Hub-only concern' },
    { id: 'problem:P1', node_type: 'problem', label: 'A problem' },
    { id: 'signal:s1', node_type: 'atomic_signal', label: 'sig 1' },
    { id: 'signal:s2', node_type: 'atomic_signal', label: 'sig 2' },
    { id: 'signal:s3', node_type: 'atomic_signal', label: 'sig 3' },
    { id: 'signal:s4', node_type: 'atomic_signal', label: 'sig 4' },
    { id: 'signal:H', node_type: 'atomic_signal', label: 'HUB' },
    { id: 'recommendation:R1', node_type: 'recommendation', label: 'Rec 1' },
    { id: 'recommendation:R2', node_type: 'recommendation', label: 'Rec 2' },
    { id: 'recommendation:R3', node_type: 'recommendation', label: 'Rec 3' },
    { id: 'signal:k1', node_type: 'construct', label: 'construct 1' },
    { id: 'signal:k2', node_type: 'construct', label: 'construct 2' },
  ];
  const edges: RawGraph['edges'] = [];
  let n = 0;
  const e = (s: string, t: string, rel: string) => edges.push({ id: `e${n++}`, source: s, target: t, relation: rel });
  // C1, C2 share s1,s2,s3
  for (const c of ['concern:C1', 'concern:C2']) for (const s of ['signal:s1', 'signal:s2', 'signal:s3']) e(c, s, 'concern_activates_signal');
  // C3 shares only s4 with C1
  e('concern:C1', 'signal:s4', 'concern_activates_signal');
  e('concern:C3', 'signal:s4', 'concern_activates_signal');
  // C4 connects only through hub H; C1 also touches H
  e('concern:C1', 'signal:H', 'concern_activates_signal');
  e('concern:C4', 'signal:H', 'concern_activates_signal');
  // P1 (problem) also links s1,s2 — cross-category noise
  e('problem:P1', 'signal:s1', 'concern_activates_signal');
  e('problem:P1', 'signal:s2', 'concern_activates_signal');
  // Make H a hub: attach many extra concerns so its degree >> threshold
  for (let i = 0; i < HUB_DEGREE_THRESHOLD + 5; i++) {
    nodes.push({ id: `concern:X${i}`, node_type: 'concern', label: `x${i}` });
    e(`concern:X${i}`, 'signal:H', 'concern_activates_signal');
  }
  // Recommendations
  for (const r of ['recommendation:R1', 'recommendation:R2']) for (const k of ['signal:k1', 'signal:k2']) e(r, k, 'recommendation_anchored_on_construct');
  e('recommendation:R3', 'signal:k1', 'recommendation_anchored_on_construct');
  return { nodes, edges };
}

function maps(): CatalogMaps {
  const typeToCategory = new Map<string, string>([
    ['concern', 'concern'], ['problem', 'problem'], ['problem_framing', 'problem'],
    ['atomic_signal', 'signal'], ['construct', 'signal'], ['recommendation', 'recommendation'],
  ]);
  const relationToVerb = new Map<string, string>([
    ['concern_activates_signal', 'MEASURES'],
    ['recommendation_anchored_on_construct', 'RECOMMENDS'],
  ]);
  return { typeToCategory, relationToVerb };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  // deterministic mulberry32 shuffle
  let a = seed >>> 0;
  const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ── Tests ────────────────────────────────────────────────────────────────────
console.log('Phase 8C — SimilarityEngine tests');

const raw = makeGraph();
const index = buildTraversalIndex(raw, maps());
const adj = adjacencyFromIndex(index);

// 1) Similarity detection + ranking: C2 is the top match for C1; C3 ranks below C2.
const simC1 = resolveSimilar(index, adj, 'concern:C1', { limit: 10, minScore: 0 });
check('C1 has matches', !!simC1 && simC1.matches.length > 0);
check('top match for C1 is C2', simC1?.matches[0]?.id === 'concern:C2', simC1?.matches.map((m) => m.id));
const c2 = simC1?.matches.find((m) => m.id === 'concern:C2');
const c3 = simC1?.matches.find((m) => m.id === 'concern:C3');
check('C2 scores higher than C3', !!c2 && !!c3 && c2!.score > c3!.score, { c2: c2?.score, c3: c3?.score });

// 2) Same-category restriction: the problem P1 (shares s1,s2) must NOT appear.
check('no cross-category leak (P1 absent from concern matches)', !simC1?.matches.some((m) => m.id === 'problem:P1'));
check('all matches are concern category', simC1!.matches.every((m) => m.category === 'concern'));

// 3) Symmetry: C1 in C2's matches too.
const simC2 = resolveSimilar(index, adj, 'concern:C2', { limit: 10, minScore: 0 });
check('symmetry: C1 is a match for C2', !!simC2?.matches.some((m) => m.id === 'concern:C1'));

// 4) Explainability: every match has non-empty shared_neighbors.
check('every match has non-empty explanation', simC1!.matches.every((m) => m.shared_neighbors.length > 0));
check('C2 explanation cites s1/s2/s3', (() => {
  const ids = new Set(c2!.shared_neighbors.map((s) => s.id));
  return ids.has('signal:s1') && ids.has('signal:s2') && ids.has('signal:s3');
})(), c2?.shared_neighbors.map((s) => s.id));

// 5) False-match review: C4 shares ONLY the hub H with C1 → hub_only flagged.
const c4 = simC1?.matches.find((m) => m.id === 'concern:C4');
check('C4 is detected as a (weak) match', !!c4);
check('C4 is flagged hub_only', !!c4 && c4!.hub_only === true, { shared: c4?.shared_neighbors });
check('C2 is NOT hub_only', !!c2 && c2!.hub_only === false);

// 6) minScore filtering excludes the weak hub match.
const simStrict = resolveSimilar(index, adj, 'concern:C1', { limit: 10, minScore: 0.5 });
check('minScore=0.5 keeps C2', !!simStrict?.matches.some((m) => m.id === 'concern:C2'));
check('minScore=0.5 drops hub-only C4', !simStrict?.matches.some((m) => m.id === 'concern:C4'));

// 7) recommendations-like-this for a recommendation anchor.
const recR1 = resolveRecommendationsLikeThis(index, adj, 'recommendation:R1', { limit: 10, minScore: 0 });
check('R1 top similar rec is R2', recR1?.matches[0]?.id === 'recommendation:R2', recR1?.matches.map((m) => m.id));
check('recs-like-this only returns recommendations', recR1!.matches.every((m) => m.category === 'recommendation'));

// 8) recommendations-like-this for a NON-recommendation anchor that shares no construct → empty (honest).
const recFromC1 = resolveRecommendationsLikeThis(index, adj, 'concern:C1', { limit: 10, minScore: 0 });
check('C1 has no recommendation matches (no shared construct) — honest empty', recFromC1!.matches.length === 0);

// 9) Unknown anchor → null.
check('unknown anchor → null', resolveSimilar(index, adj, 'concern:NOPE', {}) === null);

// 10) Determinism under shuffled edge/node order.
const rawShuf: RawGraph = { nodes: shuffle(raw.nodes, 7), edges: shuffle(raw.edges, 99) };
const index2 = buildTraversalIndex(rawShuf, maps());
const adj2 = adjacencyFromIndex(index2);
const simC1b = resolveSimilar(index2, adj2, 'concern:C1', { limit: 10, minScore: 0 });
const sig = (r: typeof simC1) => JSON.stringify(r!.matches.map((m) => [m.id, m.score, m.shared_count, m.hub_only]));
check('deterministic under shuffle', sig(simC1) === sig(simC1b), { a: sig(simC1), b: sig(simC1b) });

// 11) Batch computeCategoryMatches: concern coverage > 0, recommendation coverage > 0.
const batchConcern = computeCategoryMatches(index, adj, 'concern', { minScore: 0.05 });
const batchRec = computeCategoryMatches(index, adj, 'recommendation', { minScore: 0 });
check('batch concern produces rows', batchConcern.rows.length > 0);
check('batch concern coverage in [0,1]', batchConcern.coverage > 0 && batchConcern.coverage <= 1, batchConcern.coverage);
check('batch rec coverage > 0', batchRec.coverage > 0, batchRec.coverage);
check('batch rows reference real category nodes', batchConcern.rows.every((r) => index.byId.get(r.source_id)?.category === 'concern' && index.byId.get(r.target_id)?.category === 'concern'));

console.log(`\nPhase 8C SimilarityEngine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

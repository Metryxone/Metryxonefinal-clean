/**
 * CAPADEX PIL — Phase 8E: Graph Explainability tests (pure; no DB).
 *   Run: cd backend && npx tsx tests/knowledge-graph-explainability.test.ts
 *
 * Builds a hand-crafted traversal index with:
 *   - a FULLY traceable intervention: I1 → problem → archetype → concern → bridge_tag ← question
 *   - a recommendation R1 → construct (a SINK): locally supported (anchor) but NOT
 *     source-traceable — the honest construct-anchor limit.
 *   - a cyclic spine (concern↔capability↔problem↔behavior) to prove the BFS is cycle-safe.
 * Asserts: resolveExplain / resolveWhy / resolvePathToSource, coverage (support 100%,
 * source-trace partial), the "No Unsupported Statements" validation, score band/range,
 * determinism under shuffled edge order, and never-throws on a missing node.
 */
import { buildTraversalIndex, type RawGraph, type CatalogMaps } from '../services/pil/graph-traversal-engine';
import {
  resolveExplain,
  resolveWhy,
  resolvePathToSource,
  computeExplainabilityCoverage,
  runExplainabilityValidations,
  computeExplainabilityScore,
  computeExplainabilityReport,
  SOURCE_CATEGORIES,
  STATEMENT_CATEGORIES,
} from '../services/pil/graph-explainability-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const MAPS: CatalogMaps = {
  typeToCategory: new Map<string, string>([
    ['concern', 'concern'],
    ['clarity_question', 'question'],
    ['bridge_tag', 'bridge_tag'],
    ['behavior', 'behavior'],
    ['problem', 'problem'],
    ['problem_framing', 'problem'],
    ['capability', 'capability'],
    ['archetype', 'archetype'],
    ['intervention', 'intervention'],
    ['recommendation', 'recommendation'],
    ['construct', 'signal'],
    ['atomic_signal', 'signal'],
    ['signal', 'signal'],
  ]),
  relationToVerb: new Map<string, string>([
    ['intervention_for_problem', 'SUPPORTS'],
    ['problem_belongs_to_archetype', 'BELONGS_TO'],
    ['archetype_covers_concern', 'CLUSTERS_WITH'],
    ['concern_resolves_clarity', 'MEASURES'],
    ['tagged_with', 'CLUSTERS_WITH'],
    ['recommendation_anchored_on_construct', 'RECOMMENDS'],
    ['concern_framed_as_capability', 'EXPRESSES'],
    ['capability_addresses_problem', 'CONTRIBUTES_TO'],
    ['problem_manifests_behavior', 'CAUSES'],
    ['behavior_indicates_concern', 'INDICATES'],
  ]),
};

// ── Fixture ──────────────────────────────────────────────────────────────────
function makeGraph(): RawGraph {
  const nodes: RawGraph['nodes'] = [
    { id: 'intervention:I1', node_type: 'intervention', label: 'Box breathing' },
    { id: 'problem:P1', node_type: 'problem_framing', label: 'Freezes under pressure' },
    { id: 'archetype:A1', node_type: 'archetype', label: 'The Overthinker' },
    { id: 'concern:C1', node_type: 'concern', label: 'Anxiety & Overthinking' },
    { id: 'bridge:BT1', node_type: 'bridge_tag', label: 'anxiety_overthinking' },
    { id: 'question:Q1', node_type: 'clarity_question', label: 'I replay conversations afterward' },
    { id: 'capability:K1', node_type: 'capability', label: 'Emotional regulation' },
    { id: 'behavior:B1', node_type: 'behavior', label: 'Avoids speaking up' },
    // recommendation island (anchor only → no source)
    { id: 'recommendation:R1', node_type: 'recommendation', label: 'Practice daily reflection' },
    { id: 'construct:K_GROWTH', node_type: 'construct', label: 'CAREER_GROWTH' },
  ];
  let n = 0;
  const edges: RawGraph['edges'] = [];
  const e = (s: string, t: string, rel: string) => edges.push({ id: `e${n++}`, source: s, target: t, relation: rel });
  // traceable intervention chain → concern → bridge_tag ← question
  e('intervention:I1', 'problem:P1', 'intervention_for_problem');
  e('problem:P1', 'archetype:A1', 'problem_belongs_to_archetype');
  e('archetype:A1', 'concern:C1', 'archetype_covers_concern');
  e('concern:C1', 'bridge:BT1', 'concern_resolves_clarity');
  e('question:Q1', 'bridge:BT1', 'tagged_with');
  // cyclic spine: concern ↔ capability ↔ problem ↔ behavior ↔ concern
  e('concern:C1', 'capability:K1', 'concern_framed_as_capability');
  e('capability:K1', 'problem:P1', 'capability_addresses_problem');
  e('problem:P1', 'behavior:B1', 'problem_manifests_behavior');
  e('behavior:B1', 'concern:C1', 'behavior_indicates_concern');
  // recommendation anchored on a construct SINK (no outgoing from construct)
  e('recommendation:R1', 'construct:K_GROWTH', 'recommendation_anchored_on_construct');
  return { nodes, edges };
}

function shuffle<T>(arr: T[], seed = 7): T[] {
  let s = seed;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const idx = buildTraversalIndex(makeGraph(), MAPS);

// ── 1) resolveExplain — traceable intervention ───────────────────────────────
{
  const r = resolveExplain(idx, 'intervention:I1')!;
  check('explain: intervention found + is_statement', r.found && r.is_statement);
  check('explain: intervention locally supported (anchor)', r.supported && r.anchors.length === 1);
  check('explain: intervention reaches a source', r.reaches_source);
  check('explain: intervention nearest source is the concern', r.nearest_source?.id === 'concern:C1', r.nearest_source);
  check('explain: intervention also reaches the question', !!r.source_by_category['question'], Object.keys(r.source_by_category));
  check('explain: path begins at the intervention, every step a real edge', r.path_to_source[0]?.id === 'intervention:I1' && r.path_to_source.slice(1).every((s) => !!s.relation));
  check('explain: sentence is non-empty NL', r.sentence.length > 0 && r.sentence.includes('concern'), r.sentence);
}

// ── 2) resolveExplain — recommendation anchored on a construct sink ───────────
{
  const r = resolveExplain(idx, 'recommendation:R1')!;
  check('explain: recommendation locally supported by its construct anchor', r.supported && r.anchors[0]?.category === 'signal');
  check('explain: recommendation does NOT reach a source (honest)', !r.reaches_source && r.path_to_source.length === 0);
  check('explain: recommendation sentence states the anchor limit', r.sentence.includes('does not chain'), r.sentence);
}

// ── 3) resolveWhy ─────────────────────────────────────────────────────────────
{
  const w = resolveWhy(idx, 'intervention:I1')!;
  check('why: intervention hops_to_source = 3 (I1→P1→A1→C1)', w.hops_to_source === 3, w.hops_to_source);
  check('why: intervention nearest source category = concern', w.nearest_source?.category === 'concern');
  const w2 = resolveWhy(idx, 'recommendation:R1')!;
  check('why: recommendation supported but not source-reaching', w2.supported && !w2.reaches_source && w2.hops_to_source === null);
}

// ── 4) resolvePathToSource ────────────────────────────────────────────────────
{
  const p = resolvePathToSource(idx, 'intervention:I1')!;
  check('path-to-source: reachable + 3 hops', p.reachable && p.hops === 3, { reachable: p.reachable, hops: p.hops });
  check('path-to-source: by_category has concern + question', !!p.by_category['concern'] && !!p.by_category['question']);
  const pr = resolvePathToSource(idx, 'recommendation:R1')!;
  check('path-to-source: recommendation unreachable (honest)', !pr.reachable && pr.path.length === 0);
}

// ── 5) Coverage + validation + score ─────────────────────────────────────────
{
  const cov = computeExplainabilityCoverage(idx);
  check('coverage: both statement categories present', cov.per_category.length === STATEMENT_CATEGORIES.length);
  check('coverage: support_rate = 100% (no unsupported statements)', cov.totals.support_rate === 1 && cov.totals.unsupported === 0);
  check('coverage: source_trace_rate partial (1 of 2 statements)', cov.totals.source_trace_rate === 0.5, cov.totals);
  const interv = cov.per_category.find((c) => c.category === 'intervention')!;
  const rec = cov.per_category.find((c) => c.category === 'recommendation')!;
  check('coverage: intervention 100% source-traceable', interv.source_trace_rate === 1);
  check('coverage: recommendation 0% source-traceable (honest)', rec.source_trace_rate === 0);

  const vals = runExplainabilityValidations(cov);
  check('validation: "No Unsupported Statements" PASSES', vals[0].passed && vals[0].unsupported === 0);

  const score = computeExplainabilityScore(cov);
  check('score: in [0,1]', score.score >= 0 && score.score <= 1);
  check('score: = 0.6*1 + 0.4*0.5 = 0.8 (moderate)', score.score === 0.8 && score.band === 'moderate', score);
}

// ── 6) Determinism under shuffled edge order ─────────────────────────────────
{
  const g = makeGraph();
  const idx2 = buildTraversalIndex({ nodes: shuffle(g.nodes), edges: shuffle(g.edges) }, MAPS);
  const a = JSON.stringify(computeExplainabilityReport(idx).coverage);
  const b = JSON.stringify(computeExplainabilityReport(idx2).coverage);
  check('determinism: coverage identical under shuffled input', a === b);
  const pa = JSON.stringify(resolvePathToSource(idx, 'intervention:I1'));
  const pb = JSON.stringify(resolvePathToSource(idx2, 'intervention:I1'));
  check('determinism: path-to-source identical under shuffle', pa === pb);
}

// ── 7) Never-throws + contracts ──────────────────────────────────────────────
{
  check('missing node: resolveExplain → null', resolveExplain(idx, 'nope:does-not-exist') === null);
  check('missing node: resolveWhy → null', resolveWhy(idx, 'nope') === null);
  check('missing node: resolvePathToSource → null', resolvePathToSource(idx, 'nope') === null);
  check('contract: SOURCE_CATEGORIES = concern,question', SOURCE_CATEGORIES.join(',') === 'concern,question');
  // explaining a source node itself is a degenerate 0-hop grounding
  const cs = resolveExplain(idx, 'concern:C1')!;
  check('source node: explains itself (0-hop, self_is_source)', cs.reaches_source && cs.nearest_source?.hops === 0 && cs.path_to_source.length === 1);
}

console.log(`\nPhase 8E explainability: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

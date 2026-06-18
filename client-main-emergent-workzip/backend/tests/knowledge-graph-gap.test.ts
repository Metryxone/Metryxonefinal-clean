/**
 * CAPADEX PIL — Phase 8D: Gap Detection + Integrity Audit tests (pure; no DB).
 *   Run: cd backend && npx tsx tests/knowledge-graph-gap.test.ts
 *
 * Builds a hand-crafted traversal index with one planted instance of every gap class
 * (orphan, weakly-connected, unused-construct, missing-relationship, dead-end) plus a
 * fully-healthy recommendation/intervention/archetype, and asserts:
 *   - each detector flags its planted node and NOT the healthy ones
 *   - dead-end uses DERIVED source-capability (intended terminals not false-flagged)
 *   - the three hard validations pass on a clean graph and fail when an orphan is planted
 *   - determinism under shuffled edge order
 *   - health score is a sane 0..1 blend
 */
import { buildTraversalIndex, type RawGraph, type CatalogMaps } from '../services/pil/graph-traversal-engine';
import {
  computeGapAnalysis,
  detectOrphanNodes,
  detectWeaklyConnectedNodes,
  detectUnusedConstructs,
  detectMissingRelationships,
  detectDeadEndTraversals,
  deriveSourceCapableTypes,
} from '../services/pil/gap-detection-engine';
import {
  runIntegrityValidations,
  computeCoverage,
  computeIntegrityReport,
} from '../services/pil/integrity-audit-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const MAPS: CatalogMaps = {
  typeToCategory: new Map<string, string>([
    ['concern', 'concern'],
    ['behavior', 'behavior'],
    ['problem', 'problem'],
    ['problem_framing', 'problem'],
    ['archetype', 'archetype'],
    ['intervention', 'intervention'],
    ['recommendation', 'recommendation'],
    ['construct', 'signal'],
    ['atomic_signal', 'signal'],
    ['signal', 'signal'],
    ['competency', 'competency'],
    ['search_intent', 'search_intent'],
  ]),
  relationToVerb: new Map<string, string>(),
};

// ── Fixture ──────────────────────────────────────────────────────────────────
// Healthy spine:  behavior:B1 → concern:C1 → signal:s1 ; archetype:A1 → C1 ;
//                 recommendation:R1 → construct:k1 ; intervention:I1 → problem:P1.
// Planted gaps:
//   ORPHAN            node:ORPH        (competency, degree 0)
//   WEAK              concern:CW       (degree 1, has concern_activates_signal → not missing/dead)
//   UNUSED_CONSTRUCT  construct:KU     (in=0, one out edge → not an orphan)
//   MISSING_REL       recommendation:RM (no recommendation_anchored_on_construct, but has an out edge)
//   DEAD_END          search_intent:SID (search_intent is source-capable via SI1; SID has in, no out)
function makeGraph(extra: RawGraph['edges'] = []): RawGraph {
  const nodes: RawGraph['nodes'] = [
    { id: 'behavior:B1', node_type: 'behavior', label: 'B1' },
    { id: 'concern:C1', node_type: 'concern', label: 'C1' },
    { id: 'signal:s1', node_type: 'atomic_signal', label: 's1' },
    { id: 'archetype:A1', node_type: 'archetype', label: 'A1' },
    { id: 'recommendation:R1', node_type: 'recommendation', label: 'R1' },
    { id: 'construct:k1', node_type: 'construct', label: 'k1' },
    { id: 'intervention:I1', node_type: 'intervention', label: 'I1' },
    { id: 'problem:P1', node_type: 'problem_framing', label: 'P1' },
    { id: 'search_intent:SI1', node_type: 'search_intent', label: 'SI1' },
    // planted
    { id: 'node:ORPH', node_type: 'competency', label: 'orphan' },
    { id: 'concern:CW', node_type: 'concern', label: 'weak concern' },
    { id: 'construct:KU', node_type: 'construct', label: 'unused construct' },
    { id: 'recommendation:RM', node_type: 'recommendation', label: 'missing-rel rec' },
    { id: 'search_intent:SID', node_type: 'search_intent', label: 'dead-end intent' },
    { id: 'signal:s2', node_type: 'atomic_signal', label: 's2' },
  ];
  let n = 0;
  const edges: RawGraph['edges'] = [];
  const e = (s: string, t: string, rel: string) => edges.push({ id: `e${n++}`, source: s, target: t, relation: rel });
  // healthy spine
  e('behavior:B1', 'concern:C1', 'behavior_indicates_concern');
  e('concern:C1', 'signal:s1', 'concern_activates_signal');
  e('archetype:A1', 'concern:C1', 'archetype_covers_concern');
  e('recommendation:R1', 'construct:k1', 'recommendation_anchored_on_construct');
  e('intervention:I1', 'problem:P1', 'intervention_for_problem');
  e('search_intent:SI1', 'archetype:A1', 'intent_for_archetype'); // makes search_intent source-capable
  // planted
  e('concern:CW', 'signal:s1', 'concern_activates_signal'); // weak: degree 1, has expected rel
  e('construct:KU', 'signal:s2', 'related');                 // unused construct: in=0, out=1
  e('recommendation:RM', 'signal:s2', 'related');            // missing-rel: no anchored_on_construct
  e('concern:C1', 'search_intent:SID', 'noticed');           // gives SID an IN edge → dead-end
  edges.push(...extra);
  return { nodes, edges };
}

function shuffle<T>(arr: T[], seed = 7): T[] {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const has = (rows: { node_id: string }[], id: string) => rows.some((r) => r.node_id === id);

console.log('\nPhase 8D — Gap Detection + Integrity Audit\n');

// ── Detectors ────────────────────────────────────────────────────────────────
{
  const index = buildTraversalIndex(makeGraph(), MAPS);

  const orphans = detectOrphanNodes(index);
  check('orphan: flags the planted competency orphan', has(orphans, 'node:ORPH'));
  check('orphan: does NOT flag connected nodes', !has(orphans, 'concern:C1'));
  check('orphan: exactly one orphan', orphans.length === 1, orphans.map((r) => r.node_id));

  const weak = detectWeaklyConnectedNodes(index);
  check('weak: flags the degree-1 core concern', has(weak, 'concern:CW'));
  check('weak: does NOT flag the leaf signal s1 (non-core)', !has(weak, 'signal:s1'));

  const unused = detectUnusedConstructs(index);
  check('unused-construct: flags KU (no incoming)', has(unused, 'construct:KU'));
  check('unused-construct: does NOT flag k1 (anchored on)', !has(unused, 'construct:k1'));

  const missing = detectMissingRelationships(index);
  check('missing-rel: flags RM (no anchored_on_construct)', has(missing, 'recommendation:RM'));
  check('missing-rel: does NOT flag healthy R1', !has(missing, 'recommendation:R1'));
  check('missing-rel: does NOT flag healthy archetype A1', !has(missing, 'archetype:A1'));

  const sourceCapable = deriveSourceCapableTypes(index);
  check('source-capable: search_intent is derived source-capable', sourceCapable.has('search_intent'));
  check('source-capable: atomic_signal is NOT source-capable (intended terminal)', !sourceCapable.has('atomic_signal'));

  const dead = detectDeadEndTraversals(index);
  check('dead-end: flags SID (in, no out, source-capable type)', has(dead, 'search_intent:SID'));
  check('dead-end: does NOT flag the intended-terminal signal s1', !has(dead, 'signal:s1'));
  check('dead-end: does NOT flag healthy concern C1 (has out)', !has(dead, 'concern:C1'));
}

// ── Determinism ──────────────────────────────────────────────────────────────
{
  const a = computeGapAnalysis(buildTraversalIndex(makeGraph(), MAPS));
  const g = makeGraph();
  const b = computeGapAnalysis(buildTraversalIndex({ nodes: shuffle(g.nodes), edges: shuffle(g.edges) }, MAPS));
  check('determinism: identical rows under shuffled node/edge order',
    JSON.stringify(a.rows) === JSON.stringify(b.rows));
  check('determinism: identical by_type counts', JSON.stringify(a.by_type) === JSON.stringify(b.by_type));
  const byTypeSum = Object.values(a.by_type).reduce((x, y) => x + y, 0);
  check('consistency: sum(by_type) === rows.length', byTypeSum === a.rows.length, { byTypeSum, rows: a.rows.length });
}

// ── Hard validations ─────────────────────────────────────────────────────────
{
  // clean graph: recommendations/interventions/archetypes all connected
  const clean = buildTraversalIndex(makeGraph(), MAPS);
  const v1 = runIntegrityValidations(clean);
  check('validations: all three pass on a clean graph', v1.every((v) => v.passed), v1.map((v) => [v.name, v.passed]));

  // plant an orphan recommendation (a recommendation node with no edges)
  const dirty = makeGraph();
  dirty.nodes.push({ id: 'recommendation:RORPH', node_type: 'recommendation', label: 'orphan rec' });
  const v2 = runIntegrityValidations(buildTraversalIndex(dirty, MAPS));
  const recVal = v2.find((v) => v.node_type === 'recommendation')!;
  check('validations: orphan recommendation fails "No Orphan Recommendations"', !recVal.passed && recVal.orphans === 1);
  check('validations: archetype validation still passes', v2.find((v) => v.node_type === 'archetype')!.passed);
}

// ── Coverage + health ────────────────────────────────────────────────────────
{
  const index = buildTraversalIndex(makeGraph(), MAPS);
  const cov = computeCoverage(index);
  const concernCov = cov.find((c) => c.category === 'concern')!;
  check('coverage: concern category coverage is in 0..1', concernCov.coverage >= 0 && concernCov.coverage <= 1);
  check('coverage: competency category has an orphan (coverage 0)', cov.find((c) => c.category === 'competency')!.coverage === 0);

  const report = computeIntegrityReport(index);
  check('health: score within [0,1]', report.health.score >= 0 && report.health.score <= 1, report.health.score);
  check('health: band is one of strong|moderate|weak', ['strong', 'moderate', 'weak'].includes(report.health.band));
  check('health: components all within [0,1]',
    Object.values(report.health.components).every((c) => c >= 0 && c <= 1), report.health.components);
  check('report: all_validations_passed true on clean graph', report.all_validations_passed === true);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

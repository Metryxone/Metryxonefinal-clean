/**
 * CAPADEX PIL — Phase 8B: Relationship Traversal Engine tests (pure, no DB).
 *   Run: cd backend && npx tsx tests/knowledge-graph-traversal.test.ts
 *
 * Validates the four resolvers + the four mandated invariants:
 *   Traversal Accuracy · Lineage Accuracy · No Broken Paths · No Infinite Loops.
 */
import {
  buildTraversalIndex,
  resolveShortestPath,
  resolveRelated,
  resolveLineage,
  resolveDependencies,
  indexSummary,
  LINEAGE_SPINE,
  type RawGraph,
  type CatalogMaps,
  type TraversalIndex,
} from '../services/pil/graph-traversal-engine';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; } else { failed++; console.error(`  ✗ ${name}`, extra !== undefined ? extra : ''); }
}

// ── Fixture: a small graph realizing the spine + an off-spine cycle ───────────
// Mirrors the real builder's edge directions:
//   concern --concern_framed_as_capability--> capability
//   capability --capability_addresses_problem--> problem_framing
//   problem_framing --problem_manifests_behavior--> behavior
//   behavior --behavior_indicates_concern--> concern
//   archetype --archetype_covers_concern--> concern
//   intervention --intervention_for_archetype--> archetype
//   recommendation --recommendation_anchored_on_construct--> construct
const maps: CatalogMaps = {
  typeToCategory: new Map<string, string>([
    ['concern', 'concern'],
    ['capability', 'capability'],
    ['problem_framing', 'problem'],
    ['behavior', 'behavior'],
    ['archetype', 'archetype'],
    ['intervention', 'intervention'],
    ['recommendation', 'recommendation'],
    ['construct', 'recommendation'],
    ['widget', 'widget'],
  ]),
  relationToVerb: new Map<string, string>([
    ['concern_framed_as_capability', 'EXPRESSES'],
    ['capability_addresses_problem', 'CONTRIBUTES_TO'],
    ['problem_manifests_behavior', 'CAUSES'],
    ['behavior_indicates_concern', 'INDICATES'],
    ['archetype_covers_concern', 'CLUSTERS_WITH'],
    ['intervention_for_archetype', 'SUPPORTS'],
    ['recommendation_anchored_on_construct', 'RECOMMENDS'],
    ['cyc', 'CYCLE'],
  ]),
};

const raw: RawGraph = {
  nodes: [
    { id: 'concern:C1', node_type: 'concern', label: 'Anxiety' },
    { id: 'capability:CAP1', node_type: 'capability', label: 'Self-regulation' },
    { id: 'problem_framing:PF1', node_type: 'problem_framing', label: 'Overwhelm' },
    { id: 'behavior:B1', node_type: 'behavior', label: 'Avoidance' },
    { id: 'archetype:A1', node_type: 'archetype', label: 'The Worrier' },
    { id: 'intervention:I1', node_type: 'intervention', label: 'Breathing' },
    { id: 'recommendation:R1', node_type: 'recommendation', label: 'Reframe' },
    { id: 'construct:K1', node_type: 'construct', label: 'Calm' },
    // off-spine 3-cycle to exercise cycle-safety
    { id: 'widget:X', node_type: 'widget', label: 'X' },
    { id: 'widget:Y', node_type: 'widget', label: 'Y' },
    { id: 'widget:Z', node_type: 'widget', label: 'Z' },
  ],
  edges: [
    { id: 'e1', source: 'concern:C1', target: 'capability:CAP1', relation: 'concern_framed_as_capability' },
    { id: 'e2', source: 'capability:CAP1', target: 'problem_framing:PF1', relation: 'capability_addresses_problem' },
    { id: 'e3', source: 'problem_framing:PF1', target: 'behavior:B1', relation: 'problem_manifests_behavior' },
    { id: 'e4', source: 'behavior:B1', target: 'concern:C1', relation: 'behavior_indicates_concern' },
    { id: 'e5', source: 'archetype:A1', target: 'concern:C1', relation: 'archetype_covers_concern' },
    { id: 'e6', source: 'intervention:I1', target: 'archetype:A1', relation: 'intervention_for_archetype' },
    { id: 'e7', source: 'recommendation:R1', target: 'construct:K1', relation: 'recommendation_anchored_on_construct' },
    // cycle X→Y→Z→X
    { id: 'c1', source: 'widget:X', target: 'widget:Y', relation: 'cyc' },
    { id: 'c2', source: 'widget:Y', target: 'widget:Z', relation: 'cyc' },
    { id: 'c3', source: 'widget:Z', target: 'widget:X', relation: 'cyc' },
    // a deliberately BROKEN edge (target absent) — must be dropped at index build
    { id: 'bad', source: 'concern:C1', target: 'ghost:NOPE', relation: 'cyc' },
  ],
};

const index: TraversalIndex = buildTraversalIndex(raw, maps);

// Invariant helper: every step in a path is a real node, and consecutive steps
// are connected by a real edge in the index (Traversal Accuracy + No Broken Paths).
function pathIsRealAndConnected(idx: TraversalIndex, path: { id: string }[]): boolean {
  for (const s of path) if (!idx.byId.has(s.id)) return false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1].id, b = path[i].id;
    const connected = (idx.undirected.get(a) ?? []).some((l) => l.neighbor === b);
    if (!connected) return false;
  }
  return true;
}

// ── Index integrity ──────────────────────────────────────────────────────────
const summary = indexSummary(index);
ok('broken edge dropped (11 real → 10 indexed)', summary.edge_count === 10, summary.edge_count);
ok('all node endpoints exist', [...index.out.values()].flat().every((l) => index.byId.has(l.to)));
ok('category derived from catalog map', index.byId.get('problem_framing:PF1')!.category === 'problem');
ok('verb derived from catalog map', (index.out.get('concern:C1') ?? []).some((l) => l.edge.verb === 'EXPRESSES'));

// ── 1) ShortestPathResolver ──────────────────────────────────────────────────
const pUndir = resolveShortestPath(index, 'concern:C1', 'archetype:A1');
ok('undirected path C1→A1 reachable', pUndir.reachable && pUndir.hops === 1, pUndir.hops);
ok('undirected path is real+connected', pathIsRealAndConnected(index, pUndir.path));

const pDir = resolveShortestPath(index, 'concern:C1', 'behavior:B1', { directed: true });
ok('directed path C1→...→B1 reachable', pDir.reachable && pDir.hops === 3, pDir.hops);
ok('directed path is real+connected', pathIsRealAndConnected(index, pDir.path));

const pDirBack = resolveShortestPath(index, 'archetype:A1', 'concern:C1', { directed: true });
ok('directed A1→C1 reachable (1 hop)', pDirBack.reachable && pDirBack.hops === 1, pDirBack.hops);

const pUnreach = resolveShortestPath(index, 'concern:C1', 'recommendation:R1');
ok('disconnected component unreachable', !pUnreach.reachable && pUnreach.path.length === 0);

const pSelf = resolveShortestPath(index, 'concern:C1', 'concern:C1');
ok('self path is the single node', pSelf.reachable && pSelf.hops === 0 && pSelf.path.length === 1);

const pMissing = resolveShortestPath(index, 'concern:C1', 'nope:X');
ok('missing target → unreachable, empty', !pMissing.reachable && pMissing.path.length === 0);

// ── 2) RelatedNodeResolver ───────────────────────────────────────────────────
// concern:C1 neighbours = {CAP1(out), B1(in), A1(in)}. Co-citation siblings of C1
// are nodes sharing an intermediary: PF1 (via CAP1 and via B1), I1 (via A1).
const rel = resolveRelated(index, 'concern:C1')!;
ok('related: direct neighbours found', rel.direct.map((d) => d.id).sort().join(',') === 'archetype:A1,behavior:B1,capability:CAP1', rel.direct.map((d) => d.id));
ok('related: co-citation siblings include PF1 & I1', rel.related.some((r) => r.id === 'problem_framing:PF1') && rel.related.some((r) => r.id === 'intervention:I1'));
ok('related: PF1 outranks I1 (2 shared > 1)', (rel.related.find((r) => r.id === 'problem_framing:PF1')?.shared_count ?? 0) >= (rel.related.find((r) => r.id === 'intervention:I1')?.shared_count ?? 0));
ok('related: never includes self', rel.related.every((r) => r.id !== 'concern:C1'));
const relMissing = resolveRelated(index, 'ghost:NOPE');
ok('related: missing node → null', relMissing === null);

// ── 3) LineageResolver (Lineage Accuracy) ────────────────────────────────────
const lin = resolveLineage(index, 'concern:C1')!;
ok('lineage spine matches mandate', lin.spine.join('>') === [...LINEAGE_SPINE].join('>'));
ok('lineage starts at concern stage', lin.start_index === 0 && lin.stages[0].category === 'concern' && lin.stages[0].reached);
const stageCat = (c: string) => lin.stages.find((s) => s.category === c)!;
ok('lineage reaches capability', stageCat('capability').reached && stageCat('capability').nodes.some((n) => n.id === 'capability:CAP1'));
ok('lineage reaches problem', stageCat('problem').reached && stageCat('problem').nodes.some((n) => n.id === 'problem_framing:PF1'));
ok('lineage reaches behavior', stageCat('behavior').reached && stageCat('behavior').nodes.some((n) => n.id === 'behavior:B1'));
ok('lineage reaches archetype', stageCat('archetype').reached && stageCat('archetype').nodes.some((n) => n.id === 'archetype:A1'));
ok('lineage reaches intervention', stageCat('intervention').reached && stageCat('intervention').nodes.some((n) => n.id === 'intervention:I1'));
ok('lineage recommendation NOT reachable (honest)', !stageCat('recommendation').reached && stageCat('recommendation').nodes.length === 0);
// every stage path is real + connected
ok('lineage stage paths real+connected', lin.stages.every((s) => s.nodes.every((n) => pathIsRealAndConnected(index, n.path_from_prev_stage))));
const linMissing = resolveLineage(index, 'ghost:NOPE');
ok('lineage: missing anchor → null', linMissing === null);

// ── 4) DependencyResolver + No Infinite Loops ────────────────────────────────
const depDown = resolveDependencies(index, 'concern:C1', { direction: 'downstream' })!;
ok('deps downstream from C1 cover CAP1,PF1,B1', ['capability:CAP1', 'problem_framing:PF1', 'behavior:B1'].every((id) => depDown.nodes.some((n) => n.id === id)));
ok('deps cycle_safe flag', depDown.cycle_safe === true);
ok('deps downstream excludes root', depDown.nodes.every((n) => n.id !== 'concern:C1'));

const depUp = resolveDependencies(index, 'concern:C1', { direction: 'upstream' })!;
ok('deps upstream from C1 include behavior & archetype', depUp.nodes.some((n) => n.id === 'behavior:B1') && depUp.nodes.some((n) => n.id === 'archetype:A1'));

// CYCLE: X→Y→Z→X must terminate (no infinite loop) and visit each once.
const depCycle = resolveDependencies(index, 'widget:X', { direction: 'downstream' });
ok('cycle traversal terminates (no infinite loop)', depCycle !== null);
ok('cycle visits Y & Z exactly once', depCycle!.nodes.map((n) => n.id).sort().join(',') === 'widget:Y,widget:Z', depCycle!.nodes.map((n) => n.id));

// Depth bound respected.
const depShallow = resolveDependencies(index, 'concern:C1', { direction: 'downstream', maxDepth: 1 })!;
ok('deps maxDepth=1 → only depth-1 nodes', depShallow.nodes.every((n) => n.depth <= 1) && depShallow.nodes.some((n) => n.id === 'capability:CAP1'));

const depMissing = resolveDependencies(index, 'ghost:NOPE');
ok('deps: missing node → null', depMissing === null);

// ── Determinism: shuffled input order yields byte-identical resolver output ───
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const shuffled = buildTraversalIndex({ nodes: shuffle(raw.nodes, 7), edges: shuffle(raw.edges, 13) }, maps);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
ok('determinism: shortest path stable under shuffle', eq(resolveShortestPath(index, 'concern:C1', 'behavior:B1', { directed: true }), resolveShortestPath(shuffled, 'concern:C1', 'behavior:B1', { directed: true })));
ok('determinism: related stable under shuffle', eq(resolveRelated(index, 'concern:C1'), resolveRelated(shuffled, 'concern:C1')));
ok('determinism: lineage stable under shuffle', eq(resolveLineage(index, 'concern:C1'), resolveLineage(shuffled, 'concern:C1')));
ok('determinism: dependencies stable under shuffle', eq(resolveDependencies(index, 'concern:C1', { direction: 'both' }), resolveDependencies(shuffled, 'concern:C1', { direction: 'both' })));

console.log(`knowledge-graph-traversal.test.ts — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

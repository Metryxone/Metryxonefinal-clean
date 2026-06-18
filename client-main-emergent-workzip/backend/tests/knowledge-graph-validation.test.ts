/**
 * CAPADEX PIL — Phase 8F: Graph Validation (certification) tests.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 npx tsx tests/knowledge-graph-validation.test.ts
 *
 * Pure-fixture tests over buildTraversalIndex (no DB). They prove the certification
 * composes the engines correctly, the hard gates fire BOTH ways (clean → READY,
 * orphan-injected → ADDITIONAL GRAPH WORK REQUIRED), source-traceability is honest
 * but NOT a blocker, the score is deterministic, and nothing throws on an empty graph.
 */
import { buildTraversalIndex, type RawGraph, type CatalogMaps } from '../services/pil/graph-traversal-engine';
import {
  computeReadinessReport,
  computeSimilarityCoverage,
  auditCoverage,
  READY,
  NOT_READY,
  coverageBand,
} from '../services/pil/graph-validation-engine';
import { computeIntegrityReport } from '../services/pil/integrity-audit-engine';
import { computeExplainabilityReport } from '../services/pil/graph-explainability-engine';
import { indexSummary } from '../services/pil/graph-traversal-engine';

let passed = 0;
let failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { passed += 1; console.log(`  \u2713 ${msg}`); }
  else { failed += 1; console.log(`  \u2717 ${msg}`); }
}

// ── Fixture catalog: the fixture's "known" relations/categories are exactly what
//    it defines, so structural coverage is judged against the fixture's own catalog. ──
const MAPS: CatalogMaps = {
  typeToCategory: new Map([
    ['concern', 'concern'],
    ['clarity_question', 'question'],
    ['bridge_tag', 'bridge_tag'],
    ['archetype', 'archetype'],
    ['problem', 'problem'],
    ['intervention', 'intervention'],
    ['construct', 'construct'],
    ['recommendation', 'recommendation'],
  ]),
  relationToVerb: new Map([
    ['intervention_for_problem', 'addresses'],
    ['problem_belongs_to_archetype', 'belongs_to'],
    ['archetype_covers_concern', 'covers'],
    ['concern_resolves_clarity', 'resolves'],
    ['tagged_with', 'tagged_with'],
    ['recommendation_anchored_on_construct', 'anchored_on'],
  ]),
};

// Clean graph: a fully source-traceable intervention chain + a construct-anchored recommendation.
const CLEAN: RawGraph = {
  nodes: [
    { id: 'concern:c1', node_type: 'concern', label: 'Procrastination' },
    { id: 'question:q1', node_type: 'clarity_question', label: 'Do you delay tasks?' },
    { id: 'bridge:b1', node_type: 'bridge_tag', label: 'procrastination' },
    { id: 'archetype:a1', node_type: 'archetype', label: 'Academic Recovery' },
    { id: 'problem:p1', node_type: 'problem', label: 'Falling behind' },
    { id: 'intervention:i1', node_type: 'intervention', label: 'Finish one focused task today' },
    { id: 'construct:k1', node_type: 'construct', label: 'ACADEMIC_RECOVERY' },
    { id: 'recommendation:r1', node_type: 'recommendation', label: 'Academic Recovery career cluster' },
  ],
  edges: [
    { id: 'e1', source: 'intervention:i1', target: 'problem:p1', relation: 'intervention_for_problem' },
    { id: 'e2', source: 'problem:p1', target: 'archetype:a1', relation: 'problem_belongs_to_archetype' },
    { id: 'e3', source: 'archetype:a1', target: 'concern:c1', relation: 'archetype_covers_concern' },
    { id: 'e4', source: 'concern:c1', target: 'bridge:b1', relation: 'concern_resolves_clarity' },
    { id: 'e5', source: 'question:q1', target: 'bridge:b1', relation: 'tagged_with' },
    { id: 'e6', source: 'recommendation:r1', target: 'construct:k1', relation: 'recommendation_anchored_on_construct' },
  ],
};

// Orphan-injected graph: a recommendation with NO edges → orphan + unsupported.
const ORPHAN: RawGraph = {
  nodes: [...CLEAN.nodes, { id: 'recommendation:r2', node_type: 'recommendation', label: 'Floating rec' }],
  edges: [...CLEAN.edges],
};

const cleanIdx = buildTraversalIndex(CLEAN, MAPS);
const orphanIdx = buildTraversalIndex(ORPHAN, MAPS);

// ── Coverage audit composition ───────────────────────────────────────────────
console.log('Phase 8F — Graph Validation');
{
  const summary = indexSummary(cleanIdx);
  const integrity = computeIntegrityReport(cleanIdx);
  const explain = computeExplainabilityReport(cleanIdx);
  const sim = computeSimilarityCoverage(cleanIdx);
  const cov = auditCoverage(cleanIdx, summary, integrity, explain, sim);

  ok(summary.node_count === 8, 'counts: 8 nodes');
  ok(summary.edge_count === 6, 'counts: 6 edges');
  ok(cov.node.rate === 1, 'node coverage: 100% connected (no orphans)');
  ok(cov.relationship.rate === 1, 'relationship coverage: 100% of fixture catalog realised');
  ok(cov.edge.rate === 1, 'edge coverage: 100% of fixture verbs present');
  ok(cov.explainability.rate === 1, 'explainability: local support = 100%');
  ok(cov.explainability.basis.source_trace_rate < 1 && cov.explainability.basis.source_trace_rate > 0,
    'explainability: source-trace is PARTIAL (intervention yes, recommendation no) — honest');
  ok(['strong', 'moderate', 'weak'].includes(cov.gap.band), 'gap coverage: banded');
}

// ── Clean fixture → READY ────────────────────────────────────────────────────
{
  const r = computeReadinessReport(cleanIdx);
  ok(r.integrity.all_validations_passed, 'clean: integrity validations all pass (no orphan statements)');
  ok(r.explainability.all_validations_passed, 'clean: no unsupported statements');
  ok(r.readiness.score >= 0 && r.readiness.score <= 1, 'clean: readiness score in [0,1]');
  ok(r.readiness.band !== 'weak', 'clean: readiness band >= moderate');
  ok(r.all_hard_gates_passed, 'clean: ALL hard gates pass');
  ok(r.recommendation === READY, `clean: recommendation = "${READY}"`);
  ok(r.explainability.source_trace_rate < 0.85, 'clean: source-trace below strong yet still READY (not a blocker)');
  ok(r.reasons.some((x) => x.toLowerCase().includes('construct sink')), 'clean: reasons surface the honest construct-sink limit');
  const dGate = r.hard_gates.find((g) => g.name === 'Determinism');
  const pGate = r.hard_gates.find((g) => g.name === 'Performance');
  ok(!!dGate && dGate.passed, 'clean: pure report defaults Determinism gate to pass (injected by orchestrator)');
  ok(!!pGate && pGate.passed, 'clean: pure report defaults Performance gate to pass');
}

// ── Orphan-injected fixture → ADDITIONAL GRAPH WORK REQUIRED ──────────────────
{
  const r = computeReadinessReport(orphanIdx);
  ok(!r.integrity.all_validations_passed, 'orphan: integrity validations FAIL (orphan recommendation)');
  ok(!r.explainability.all_validations_passed, 'orphan: unsupported statement detected');
  ok(!r.all_hard_gates_passed, 'orphan: hard gates FAIL');
  ok(r.recommendation === NOT_READY, `orphan: recommendation = "${NOT_READY}"`);
  ok(r.reasons.some((x) => x.toLowerCase().includes('integrity') || x.toLowerCase().includes('unsupported')),
    'orphan: reasons name the blocking failures');
}

// ── Determinism ──────────────────────────────────────────────────────────────
{
  const a = computeReadinessReport(cleanIdx);
  const b = computeReadinessReport(cleanIdx);
  const strip = (x: ReturnType<typeof computeReadinessReport>) => JSON.stringify({ ...x, generated_at: undefined });
  ok(strip(a) === strip(b), 'determinism: identical certification payload across re-runs');
}

// ── Band helper ──────────────────────────────────────────────────────────────
{
  ok(coverageBand(0.9) === 'strong', 'band: 0.9 → strong');
  ok(coverageBand(0.7) === 'moderate', 'band: 0.7 → moderate');
  ok(coverageBand(0.4) === 'weak', 'band: 0.4 → weak');
}

// ── Never-throws AND never falsely certifies on an empty graph ───────────────
{
  let threw = false;
  let rec = '';
  let viabilityFailed = false;
  try {
    const empty = buildTraversalIndex({ nodes: [], edges: [] }, MAPS);
    const r = computeReadinessReport(empty);
    rec = r.recommendation;
    viabilityFailed = r.hard_gates.find((g) => g.name.startsWith('Graph viability'))?.passed === false;
  } catch { threw = true; }
  ok(!threw, 'never-throws: empty graph produces a report (no exception)');
  ok(rec === NOT_READY, 'empty graph → NOT_READY (no vacuous READY false-positive)');
  ok(viabilityFailed, 'empty graph → viability hard gate FAILS');
}

console.log(`\nPhase 8F validation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

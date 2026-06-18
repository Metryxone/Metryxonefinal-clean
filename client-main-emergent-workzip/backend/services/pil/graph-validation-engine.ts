/**
 * CAPADEX PIL — Phase 8F: Knowledge Graph Validation (certification).
 *
 *   The capstone of the Phase-8 Knowledge Graph layer. It does NOT compute any new
 *   graph fact — it COMPOSES the read-only outputs of the prior phases into a single
 *   production-readiness certification:
 *
 *     AUDIT   — Node / Edge / Relationship / Traversal / Similarity / Gap / Explainability coverage
 *     VERIFY  — Graph Integrity / Lineage Integrity / Determinism / Performance / Readiness
 *     GENERATE— Knowledge Graph Readiness Report
 *     OUTPUT  — node+edge counts · coverage metrics · integrity metrics · readiness score ·
 *               final recommendation: READY FOR PHASE 9  |  ADDITIONAL GRAPH WORK REQUIRED
 *
 *   Reused engines (single source of truth — never re-implemented here):
 *     - indexSummary               (graph-traversal-engine)   → node/edge/relationship counts
 *     - computeIntegrityReport     (integrity-audit-engine)   → validations + health + gaps
 *     - computeGapAnalysis         (gap-detection-engine)     → gap coverage (via integrity)
 *     - computeCategoryMatches     (similarity-engine)        → similarity coverage
 *     - computeExplainabilityReport(graph-explainability)     → explainability + lineage
 *
 *   Contracts: pure functions are deterministic and DB-free; the async orchestrator is
 *   best-effort (never throws past it), READ-ONLY of the graph (the ONLY write is an
 *   append-only pil_kg_audit summary row), and flag-gated at the route.
 *
 *   HONESTY: a `weak` band or an `ADDITIONAL GRAPH WORK REQUIRED` verdict is a real
 *   finding. Weights & gates are fixed a priori — the graph is never massaged to a score.
 *   The known architectural limit (recommendations/runtime_interventions anchor on the
 *   `construct` SINK, so source-traceability is partial) is reported as an informational
 *   sub-metric, NOT a hard certification gate.
 */
import type { Pool } from 'pg';
import {
  getTraversalIndex,
  indexSummary,
  type TraversalIndex,
  type IndexSummary,
} from './graph-traversal-engine';
import {
  computeIntegrityReport,
  type IntegrityReport,
} from './integrity-audit-engine';
import {
  computeCategoryMatches,
  adjacencyFromIndex,
  SIMILARITY_CATEGORIES,
} from './similarity-engine';
import {
  computeExplainabilityReport,
  type ExplainabilityReport,
} from './graph-explainability-engine';
import { ensureGraphMaturationSchema, recordGraphAudit } from './knowledge-graph-maturation';

// ── Coverage band (shared a-priori thresholds, consistent with 8D/8E) ────────
export type CoverageBand = 'strong' | 'moderate' | 'weak';
export function coverageBand(rate: number): CoverageBand {
  if (rate > 0.85) return 'strong';
  if (rate >= 0.6) return 'moderate';
  return 'weak';
}
const r6 = (n: number) => Number(n.toFixed(6));
const safeRate = (num: number, den: number) => (den > 0 ? r6(num / den) : 1);

// ── 1) AUDIT — seven coverage dimensions ─────────────────────────────────────
export interface CoverageMetric {
  dimension: string;
  rate: number;
  band: CoverageBand;
  basis: Record<string, number>;
  note?: string;
}
export interface CoverageAudit {
  node: CoverageMetric;
  edge: CoverageMetric;
  relationship: CoverageMetric;
  traversal: CoverageMetric;
  similarity: CoverageMetric;
  gap: CoverageMetric;
  explainability: CoverageMetric;
}

/**
 * Compose the seven coverage dimensions from the already-computed engine reports.
 * Pure & deterministic — takes the index plus the integrity & explainability reports
 * (so they are computed exactly once by the caller).
 */
export function auditCoverage(
  index: TraversalIndex,
  summary: IndexSummary,
  integrity: IntegrityReport,
  explain: ExplainabilityReport,
  similarity: SimilarityCoverage,
): CoverageAudit {
  // Node coverage — connectivity (share of nodes with ≥1 edge) over the whole graph.
  const totalNodes = summary.node_count;
  const connectivity = integrity.health.components.connectivity;
  const categoriesPresent = Object.keys(summary.category_counts).length;
  const node: CoverageMetric = {
    dimension: 'node',
    rate: r6(connectivity),
    band: coverageBand(connectivity),
    basis: {
      total_nodes: totalNodes,
      connected_nodes: integrity.health.basis.connected_nodes,
      categories_present: categoriesPresent,
    },
  };

  // Edge coverage — share of CANONICAL relation verbs that actually occur as edges.
  const knownVerbs = new Set(index.relationToVerb.values());
  const presentVerbs = Object.keys(summary.verb_counts);
  const edgeRate = safeRate(presentVerbs.length, knownVerbs.size);
  const edge: CoverageMetric = {
    dimension: 'edge',
    rate: edgeRate,
    band: coverageBand(edgeRate),
    basis: { total_edges: summary.edge_count, verbs_present: presentVerbs.length, verbs_known: knownVerbs.size },
  };

  // Relationship coverage — share of CANONICAL granular relations realised as edges.
  const knownRelations = new Set(index.relationToVerb.keys());
  const presentRelations = new Set<string>();
  for (const links of index.out.values()) for (const { edge: e } of links) presentRelations.add(e.relation);
  const relRate = safeRate(presentRelations.size, knownRelations.size);
  const relationship: CoverageMetric = {
    dimension: 'relationship',
    rate: relRate,
    band: coverageBand(relRate),
    basis: { relations_present: presentRelations.size, relations_known: knownRelations.size },
    note: 'fraction of catalog relation types realised as ≥1 edge',
  };

  // Traversal coverage — share of source-capable nodes that are NOT dead-ends.
  const traversalRate = integrity.health.components.traversal;
  const traversal: CoverageMetric = {
    dimension: 'traversal',
    rate: r6(traversalRate),
    band: coverageBand(traversalRate),
    basis: {
      source_capable_nodes: integrity.health.basis.source_capable_nodes,
      dead_ends: integrity.gaps.summary.dead_ends,
    },
    note: '1 - dead_ends / source_capable_nodes',
  };

  // Similarity coverage — weighted mean nodes-with-match across the six detect categories.
  const sim: CoverageMetric = {
    dimension: 'similarity',
    rate: similarity.coverage,
    band: coverageBand(similarity.coverage),
    basis: { nodes_scored: similarity.nodes_scored, nodes_with_match: similarity.nodes_with_match, hub_only_rows: similarity.hub_only_rows },
    note: 'nodes with ≥1 same-category match / nodes scored (six detect categories)',
  };

  // Gap coverage — share of nodes with NO structural gap (clean rate).
  const gappedNodes = new Set<string>();
  for (const row of integrity.gaps.rows) gappedNodes.add(row.node_id);
  const gapClean = safeRate(totalNodes - gappedNodes.size, totalNodes);
  const gap: CoverageMetric = {
    dimension: 'gap',
    rate: gapClean,
    band: coverageBand(gapClean),
    basis: {
      total_nodes: totalNodes,
      gapped_nodes: gappedNodes.size,
      orphan_nodes: integrity.gaps.summary.orphan_nodes,
      weakly_connected: integrity.gaps.summary.weakly_connected,
      dead_ends: integrity.gaps.summary.dead_ends,
    },
    note: 'share of nodes with no structural gap (orphan/weak/dead-end/missing-rel/unused)',
  };

  // Explainability coverage — local support (hard) vs source-traceability (architectural).
  const support = explain.coverage.totals.support_rate;
  const sourceTrace = explain.coverage.totals.source_trace_rate;
  const explainability: CoverageMetric = {
    dimension: 'explainability',
    rate: r6(support),
    band: coverageBand(support),
    basis: {
      statements: explain.coverage.totals.statements,
      supported: explain.coverage.totals.supported,
      reaches_source: explain.coverage.totals.reaches_source,
      source_trace_rate: r6(sourceTrace),
    },
    note: 'rate = local support (hard); source_trace is informational (construct-sink limit)',
  };

  return { node, edge, relationship, traversal, similarity: sim, gap, explainability };
}

// Similarity coverage aggregate (computed once, reused by audit + report).
export interface SimilarityCoverage {
  coverage: number;
  nodes_scored: number;
  nodes_with_match: number;
  hub_only_rows: number;
  per_category: { category: string; nodes_scored: number; nodes_with_match: number; coverage: number; hub_only_rows: number }[];
}

/** Aggregate same-category similarity coverage across the six detect categories. Pure. */
export function computeSimilarityCoverage(
  index: TraversalIndex,
  opts: { maxNodes?: number; topK?: number; minScore?: number } = {},
): SimilarityCoverage {
  const adj = adjacencyFromIndex(index);
  const per_category: SimilarityCoverage['per_category'] = [];
  let scored = 0;
  let withMatch = 0;
  let hubOnly = 0;
  for (const category of SIMILARITY_CATEGORIES) {
    const m = computeCategoryMatches(index, adj, category, {
      maxNodes: opts.maxNodes ?? 1500,
      topK: opts.topK ?? 10,
      minScore: opts.minScore ?? 0.05,
    });
    scored += m.nodes_scored;
    withMatch += m.nodes_with_match;
    hubOnly += m.hub_only_rows;
    per_category.push({
      category,
      nodes_scored: m.nodes_scored,
      nodes_with_match: m.nodes_with_match,
      coverage: m.coverage,
      hub_only_rows: m.hub_only_rows,
    });
  }
  return {
    coverage: safeRate(withMatch, scored),
    nodes_scored: scored,
    nodes_with_match: withMatch,
    hub_only_rows: hubOnly,
    per_category,
  };
}

// ── 2) VERIFY — integrity / lineage / determinism / performance / readiness ──
export interface VerificationResult {
  name: string;
  passed: boolean;
  detail: string;
  metrics: Record<string, number | string | boolean>;
}

/**
 * Graph Integrity + Lineage Integrity verifications (pure). Determinism & Performance
 * are produced by the async orchestrator (they need re-runs / timing). Lineage integrity
 * = every statement is locally supported (no broken reasons), with source-traceability
 * surfaced as an honest informational metric.
 */
export function verifyGraph(integrity: IntegrityReport, explain: ExplainabilityReport): VerificationResult[] {
  const out: VerificationResult[] = [];

  // Graph Integrity — all hard orphan validations pass.
  out.push({
    name: 'Graph Integrity',
    passed: integrity.all_validations_passed,
    detail: integrity.all_validations_passed
      ? 'All structural validations passed (no orphan recommendations/interventions/archetypes).'
      : `Failing validations: ${integrity.validations.filter((v) => !v.passed).map((v) => v.name).join(', ')}.`,
    metrics: {
      health_score: integrity.health.score,
      health_band: integrity.health.band,
      validations_total: integrity.validations.length,
      validations_passed: integrity.validations.filter((v) => v.passed).length,
    },
  });

  // Lineage Integrity — no unsupported statements (every statement has a real grounding edge).
  const support = explain.coverage.totals.support_rate;
  const lineagePassed = explain.all_validations_passed;
  out.push({
    name: 'Lineage Integrity',
    passed: lineagePassed,
    detail: lineagePassed
      ? 'No unsupported statements — every recommendation/intervention has a real grounding edge.'
      : 'Unsupported statements detected (statements without any grounding edge).',
    metrics: {
      support_rate: r6(support),
      source_trace_rate: r6(explain.coverage.totals.source_trace_rate),
      statements: explain.coverage.totals.statements,
      unsupported: explain.coverage.totals.statements - explain.coverage.totals.supported,
    },
  });

  return out;
}

// ── 3) Readiness score (fixed a-priori weights, sum = 1) ─────────────────────
/**
 * Documented & a priori — never tuned to a target. Source-traceability is deliberately
 * NOT a weighted input (architectural construct-sink limit); it is reported separately.
 */
export const READINESS_WEIGHTS = {
  graph_health: 0.3,
  structure: 0.2, // mean(node connectivity, relationship coverage)
  traversal: 0.15,
  explainability_support: 0.15,
  gap_clean: 0.1,
  similarity: 0.1,
} as const;

export interface ReadinessScore {
  score: number;
  band: CoverageBand;
  components: {
    graph_health: number;
    structure: number;
    traversal: number;
    explainability_support: number;
    gap_clean: number;
    similarity: number;
  };
}

export function computeReadinessScore(integrity: IntegrityReport, coverage: CoverageAudit): ReadinessScore {
  const components = {
    graph_health: r6(integrity.health.score),
    structure: r6((coverage.node.rate + coverage.relationship.rate) / 2),
    traversal: r6(coverage.traversal.rate),
    explainability_support: r6(coverage.explainability.rate),
    gap_clean: r6(coverage.gap.rate),
    similarity: r6(coverage.similarity.rate),
  };
  const score = r6(
    components.graph_health * READINESS_WEIGHTS.graph_health +
      components.structure * READINESS_WEIGHTS.structure +
      components.traversal * READINESS_WEIGHTS.traversal +
      components.explainability_support * READINESS_WEIGHTS.explainability_support +
      components.gap_clean * READINESS_WEIGHTS.gap_clean +
      components.similarity * READINESS_WEIGHTS.similarity,
  );
  return { score, band: coverageBand(score), components };
}

// ── 4) GENERATE — Knowledge Graph Readiness Report ───────────────────────────
export const READY = 'READY FOR PHASE 9' as const;
export const NOT_READY = 'ADDITIONAL GRAPH WORK REQUIRED' as const;
export type FinalRecommendation = typeof READY | typeof NOT_READY;

export interface ReadinessReport {
  generated_at: string;
  counts: { node_count: number; edge_count: number; category_counts: Record<string, number>; verb_counts: Record<string, number> };
  coverage: CoverageAudit;
  similarity_detail: SimilarityCoverage;
  verifications: VerificationResult[];
  integrity: { all_validations_passed: boolean; health_score: number; health_band: string; validations: { name: string; passed: boolean; orphans: number }[] };
  explainability: { support_rate: number; source_trace_rate: number; all_validations_passed: boolean; score: number; band: string };
  readiness: ReadinessScore;
  hard_gates: { name: string; passed: boolean }[];
  all_hard_gates_passed: boolean;
  recommendation: FinalRecommendation;
  reasons: string[];
}

/**
 * Assemble the full readiness report from a read-only index. Pure & deterministic.
 * `determinism` and `performance` gates are injected by the orchestrator (DB/timing).
 */
export function computeReadinessReport(
  index: TraversalIndex,
  injected: { extraVerifications?: VerificationResult[]; similarityOpts?: { maxNodes?: number; topK?: number; minScore?: number } } = {},
): ReadinessReport {
  const summary = indexSummary(index);
  const integrity = computeIntegrityReport(index);
  const explain = computeExplainabilityReport(index);
  const similarity = computeSimilarityCoverage(index, injected.similarityOpts);
  const coverage = auditCoverage(index, summary, integrity, explain, similarity);
  const readiness = computeReadinessScore(integrity, coverage);

  const verifications = [...verifyGraph(integrity, explain), ...(injected.extraVerifications ?? [])];

  // Hard gates — the production blockers. Coverage % feed the score band, NOT the gates,
  // except the band floor (must be at least moderate to certify).
  // Viability MUST come first: an empty/degraded-to-empty graph would otherwise certify
  // vacuously (every rate defaults to 1 and zero-statement validations pass) — a readiness
  // false-positive. A graph with no nodes/edges/statements can never be production-ready.
  const viabilityGate = summary.node_count > 0 && summary.edge_count > 0 && explain.coverage.totals.statements > 0;
  const integrityGate = integrity.all_validations_passed;
  const lineageGate = explain.all_validations_passed;
  const determinismGate = (injected.extraVerifications ?? []).find((v) => v.name === 'Determinism')?.passed ?? true;
  const performanceGate = (injected.extraVerifications ?? []).find((v) => v.name === 'Performance')?.passed ?? true;
  const bandGate = readiness.band !== 'weak';

  const hard_gates = [
    { name: 'Graph viability (non-empty nodes/edges/statements)', passed: viabilityGate },
    { name: 'Graph Integrity (no orphan statements)', passed: integrityGate },
    { name: 'Lineage Integrity (no unsupported statements)', passed: lineageGate },
    { name: 'Determinism', passed: determinismGate },
    { name: 'Performance', passed: performanceGate },
    { name: 'Readiness band ≥ moderate', passed: bandGate },
  ];
  const all_hard_gates_passed = hard_gates.every((g) => g.passed);

  const reasons: string[] = [];
  if (!viabilityGate) reasons.push(`Graph is empty or degraded (nodes=${summary.node_count}, edges=${summary.edge_count}, statements=${explain.coverage.totals.statements}) — cannot certify.`);
  if (!integrityGate) reasons.push('Structural integrity validations failed (orphan recommendations/interventions/archetypes).');
  if (!lineageGate) reasons.push('Unsupported statements present (no grounding edge).');
  if (!determinismGate) reasons.push('Non-deterministic output across re-runs.');
  if (!performanceGate) reasons.push('Validation exceeded the performance budget.');
  if (!bandGate) reasons.push(`Readiness score ${readiness.score} is in the weak band (< 0.6).`);
  if (all_hard_gates_passed) {
    reasons.push('All hard certification gates passed.');
    if (coverage.explainability.basis.source_trace_rate < 0.85) {
      reasons.push(
        `Informational: source-traceability is ${coverage.explainability.basis.source_trace_rate} — recommendations/runtime_interventions anchor on the construct sink (a documented architectural limit, not a blocker).`,
      );
    }
  }

  return {
    generated_at: new Date().toISOString(),
    counts: {
      node_count: summary.node_count,
      edge_count: summary.edge_count,
      category_counts: summary.category_counts,
      verb_counts: summary.verb_counts,
    },
    coverage,
    similarity_detail: similarity,
    verifications,
    integrity: {
      all_validations_passed: integrity.all_validations_passed,
      health_score: integrity.health.score,
      health_band: integrity.health.band,
      validations: integrity.validations.map((v) => ({ name: v.name, passed: v.passed, orphans: v.orphans })),
    },
    explainability: {
      support_rate: r6(explain.coverage.totals.support_rate),
      source_trace_rate: r6(explain.coverage.totals.source_trace_rate),
      all_validations_passed: explain.all_validations_passed,
      score: explain.score.score,
      band: explain.score.band,
    },
    readiness,
    hard_gates,
    all_hard_gates_passed,
    recommendation: all_hard_gates_passed ? READY : NOT_READY,
    reasons,
  };
}

// ── 5) Orchestrator — read-only certification run (append-only audit row) ─────
export interface RunGraphValidationResult extends ReadinessReport {
  performance_ms: { index_ms: number; compute_ms: number; total_ms: number };
}

/**
 * Full Phase-8F run: build the cached index, certify it (twice for determinism + timed
 * for performance), and append a readiness summary row to pil_kg_audit. Best-effort:
 * never throws; degrades to a weak/NOT-READY report if anything fails. Graph untouched.
 */
export async function runGraphValidation(
  pool: Pool,
  opts: { refresh?: boolean; performanceBudgetMs?: number; similarityOpts?: { maxNodes?: number; topK?: number; minScore?: number } } = {},
): Promise<RunGraphValidationResult> {
  const started = Date.now();
  const budget = opts.performanceBudgetMs ?? 30000;
  try {
    await ensureGraphMaturationSchema(pool);
    const idxStart = Date.now();
    const index = await getTraversalIndex(pool, { refresh: opts.refresh });
    const index_ms = Date.now() - idxStart;

    // Determinism — recompute the certifiable payload twice and deep-compare (minus timestamps).
    const computeStart = Date.now();
    const a = computeReadinessReport(index, { similarityOpts: opts.similarityOpts });
    const b = computeReadinessReport(index, { similarityOpts: opts.similarityOpts });
    const compute_ms = Date.now() - computeStart;
    const deterministic = stableEqual(stripVolatile(a), stripVolatile(b));

    const total_ms = Date.now() - started;
    const determinismCheck: VerificationResult = {
      name: 'Determinism',
      passed: deterministic,
      detail: deterministic ? 'Identical certification payload across two independent re-runs.' : 'Certification payload differed across re-runs.',
      metrics: { reruns: 2 },
    };
    const performanceCheck: VerificationResult = {
      name: 'Performance',
      passed: total_ms <= budget,
      detail: `Validation completed in ${total_ms}ms (budget ${budget}ms).`,
      metrics: { index_ms, compute_ms, total_ms, budget_ms: budget },
    };

    // Final report carries the determinism + performance gates.
    const report = computeReadinessReport(index, {
      similarityOpts: opts.similarityOpts,
      extraVerifications: [determinismCheck, performanceCheck],
    });

    await recordGraphAudit(pool, {
      event_type: 'readiness_audit',
      node_count: report.counts.node_count,
      edge_count: report.counts.edge_count,
      affected_rows: report.hard_gates.filter((g) => !g.passed).length,
      duration_ms: total_ms,
      status: report.all_hard_gates_passed ? 'ok' : 'degraded',
      details: {
        phase: '8f',
        readiness_score: report.readiness.score,
        readiness_band: report.readiness.band,
        recommendation: report.recommendation,
        all_hard_gates_passed: report.all_hard_gates_passed,
        hard_gates: report.hard_gates,
        coverage: {
          node: report.coverage.node.rate,
          edge: report.coverage.edge.rate,
          relationship: report.coverage.relationship.rate,
          traversal: report.coverage.traversal.rate,
          similarity: report.coverage.similarity.rate,
          gap: report.coverage.gap.rate,
          explainability_support: report.coverage.explainability.rate,
          explainability_source_trace: report.coverage.explainability.basis.source_trace_rate,
        },
      },
    });

    return { ...report, performance_ms: { index_ms, compute_ms, total_ms } };
  } catch (err) {
    console.warn('[pil-validation] runGraphValidation degraded:', err instanceof Error ? err.message : String(err));
    const total_ms = Date.now() - started;
    return {
      ...degradedReport(),
      performance_ms: { index_ms: 0, compute_ms: 0, total_ms },
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripVolatile(r: ReadinessReport): Omit<ReadinessReport, 'generated_at'> {
  const { generated_at, ...rest } = r;
  return rest;
}
/** Stable deep-equality via canonical JSON (key-sorted). */
function stableEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
}
function degradedReport(): ReadinessReport {
  const zero: CoverageMetric = { dimension: '', rate: 0, band: 'weak', basis: {} };
  return {
    generated_at: new Date().toISOString(),
    counts: { node_count: 0, edge_count: 0, category_counts: {}, verb_counts: {} },
    coverage: {
      node: { ...zero, dimension: 'node' },
      edge: { ...zero, dimension: 'edge' },
      relationship: { ...zero, dimension: 'relationship' },
      traversal: { ...zero, dimension: 'traversal' },
      similarity: { ...zero, dimension: 'similarity' },
      gap: { ...zero, dimension: 'gap' },
      explainability: { ...zero, dimension: 'explainability', basis: { source_trace_rate: 0 } },
    },
    similarity_detail: { coverage: 0, nodes_scored: 0, nodes_with_match: 0, hub_only_rows: 0, per_category: [] },
    verifications: [],
    integrity: { all_validations_passed: false, health_score: 0, health_band: 'weak', validations: [] },
    explainability: { support_rate: 0, source_trace_rate: 0, all_validations_passed: false, score: 0, band: 'weak' },
    readiness: {
      score: 0,
      band: 'weak',
      components: { graph_health: 0, structure: 0, traversal: 0, explainability_support: 0, gap_clean: 0, similarity: 0 },
    },
    hard_gates: [
      { name: 'Graph viability (non-empty nodes/edges/statements)', passed: false },
      { name: 'Graph Integrity (no orphan statements)', passed: false },
      { name: 'Lineage Integrity (no unsupported statements)', passed: false },
      { name: 'Determinism', passed: false },
      { name: 'Performance', passed: false },
      { name: 'Readiness band ≥ moderate', passed: false },
    ],
    all_hard_gates_passed: false,
    recommendation: NOT_READY,
    reasons: ['Validation could not complete (graph load/compute degraded).'],
  };
}

/** Read-only readiness report from the CACHED traversal index (no writes, no timing gates). */
export async function readinessReport(pool: Pool): Promise<ReadinessReport> {
  const index = await getTraversalIndex(pool);
  return computeReadinessReport(index);
}

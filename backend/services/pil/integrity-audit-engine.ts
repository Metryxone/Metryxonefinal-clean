/**
 * CAPADEX PIL — Phase 8D: Integrity Audit Engine (IntegrityAuditEngine).
 *
 * Sits on top of the GraphGapEngine (gap-detection-engine.ts) and turns the raw gap
 * analysis into product-level integrity guarantees + a single Graph Health Score.
 *
 * HARD VALIDATIONS (must hold for a healthy graph):
 *   - No Orphan Recommendations  — every node_type 'recommendation' is connected.
 *   - No Orphan Interventions    — every node_type 'intervention'   is connected.
 *   - No Orphan Archetypes       — every node_type 'archetype'      is connected.
 *
 * COVERAGE: per-category fraction of nodes that are connected (degree > 0).
 *
 * HEALTH SCORE: a documented, fixed-weight blend of structural integrity signals.
 *   The weights and thresholds are set a priori — the score reflects the graph, the
 *   graph is never massaged to hit a score.
 *
 * CANON: read-only of the graph; the only write is the append-only pil_kg_audit
 *   summary row (Phase 8A). Deterministic. Never throws past the orchestrator boundary.
 */
import type { Pool } from 'pg';
import {
  getTraversalIndex,
  type TraversalIndex,
} from './graph-traversal-engine';
import { ensureGraphMaturationSchema, recordGraphAudit } from './knowledge-graph-maturation';
import {
  computeGapAnalysis,
  degreeOf,
  runGapAnalysis,
  type GapAnalysis,
  type RunGapResult,
} from './gap-detection-engine';

// ── Hard validations ─────────────────────────────────────────────────────────
/** node_types that must NEVER be orphaned for the graph to be production-valid. */
export const NO_ORPHAN_NODE_TYPES = ['recommendation', 'intervention', 'archetype'] as const;
export type GuardedNodeType = (typeof NO_ORPHAN_NODE_TYPES)[number];

export interface ValidationResult {
  name: string;
  node_type: GuardedNodeType;
  total: number;
  orphans: number;
  orphan_ids: string[]; // capped sample for explainability
  passed: boolean;
}

const VALIDATION_SAMPLE = 25;

/** Run the three "No Orphan X" hard validations over the read-only index. */
export function runIntegrityValidations(index: TraversalIndex): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const nodeType of NO_ORPHAN_NODE_TYPES) {
    let total = 0;
    const orphanIds: string[] = [];
    for (const [id, n] of index.byId) {
      if (n.node_type !== nodeType) continue;
      total += 1;
      if (degreeOf(index, id) === 0) orphanIds.push(id);
    }
    orphanIds.sort();
    results.push({
      name: `No Orphan ${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)}s`,
      node_type: nodeType,
      total,
      orphans: orphanIds.length,
      orphan_ids: orphanIds.slice(0, VALIDATION_SAMPLE),
      passed: orphanIds.length === 0,
    });
  }
  return results;
}

// ── Coverage ─────────────────────────────────────────────────────────────────
export interface CategoryCoverage {
  category: string;
  total: number;
  connected: number;
  orphans: number;
  coverage: number; // connected / total, 0..1
}

/** Per-category connectivity coverage (deterministic, sorted by category). */
export function computeCoverage(index: TraversalIndex): CategoryCoverage[] {
  const out: CategoryCoverage[] = [];
  for (const [category, ids] of index.byCategory) {
    let connected = 0;
    for (const id of ids) if (degreeOf(index, id) > 0) connected += 1;
    const total = ids.length;
    out.push({
      category,
      total,
      connected,
      orphans: total - connected,
      coverage: total > 0 ? Number((connected / total).toFixed(6)) : 0,
    });
  }
  return out.sort((a, b) => a.category.localeCompare(b.category));
}

// ── Graph Health Score ───────────────────────────────────────────────────────
/**
 * Fixed weights (sum = 1). Documented & a priori — never tuned to a target.
 *   connectivity   — fraction of nodes with degree > 0
 *   validations    — fraction of the 3 hard validations that pass
 *   traversal      — 1 - dead_end_rate over source-capable nodes
 *   relationships  — 1 - missing_relationship_rate over rule-subject nodes
 *   weak_health    — 1 - weak_rate over CORE nodes
 */
export const HEALTH_WEIGHTS = {
  connectivity: 0.3,
  validations: 0.25,
  traversal: 0.2,
  relationships: 0.15,
  weak_health: 0.1,
} as const;

export interface HealthScore {
  score: number; // 0..1
  band: 'strong' | 'moderate' | 'weak';
  components: {
    connectivity: number;
    validations: number;
    traversal: number;
    relationships: number;
    weak_health: number;
  };
  basis: {
    total_nodes: number;
    connected_nodes: number;
    source_capable_nodes: number;
    rule_subject_nodes: number;
    core_nodes: number;
  };
}

function healthBand(score: number): HealthScore['band'] {
  if (score > 0.85) return 'strong';
  if (score >= 0.6) return 'moderate';
  return 'weak';
}

/**
 * Compute the Graph Health Score from the gap analysis + validations + index.
 * Pure & deterministic.
 */
export function computeHealthScore(
  index: TraversalIndex,
  gaps: GapAnalysis,
  validations: ValidationResult[],
): HealthScore {
  const totalNodes = index.byId.size;

  let connectedNodes = 0;
  for (const id of index.byId.keys()) if (degreeOf(index, id) > 0) connectedNodes += 1;

  const sourceCapable = new Set(gaps.summary.source_capable_types);
  let sourceCapableNodes = 0;
  let coreNodes = 0;
  let ruleSubjectNodes = 0;
  const RULE_TYPES = new Set(['recommendation', 'intervention', 'archetype', 'concern', 'behavior']);
  const CORE_TYPES = new Set(['concern', 'behavior', 'problem', 'problem_framing', 'archetype', 'intervention', 'recommendation', 'construct']);
  for (const n of index.byId.values()) {
    if (sourceCapable.has(n.node_type)) sourceCapableNodes += 1;
    if (CORE_TYPES.has(n.node_type)) coreNodes += 1;
    if (RULE_TYPES.has(n.node_type)) ruleSubjectNodes += 1;
  }

  const connectivity = totalNodes > 0 ? connectedNodes / totalNodes : 1;
  const validationsPassed = validations.filter((v) => v.passed).length;
  const validationScore = validations.length > 0 ? validationsPassed / validations.length : 1;
  const traversal = sourceCapableNodes > 0 ? 1 - gaps.summary.dead_ends / sourceCapableNodes : 1;
  const relationships = ruleSubjectNodes > 0 ? 1 - gaps.summary.missing_relationships / ruleSubjectNodes : 1;
  const weakHealth = coreNodes > 0 ? 1 - gaps.summary.weakly_connected / coreNodes : 1;

  const components = {
    connectivity: Number(connectivity.toFixed(6)),
    validations: Number(validationScore.toFixed(6)),
    traversal: Number(traversal.toFixed(6)),
    relationships: Number(relationships.toFixed(6)),
    weak_health: Number(weakHealth.toFixed(6)),
  };

  const score = Number(
    (
      components.connectivity * HEALTH_WEIGHTS.connectivity +
      components.validations * HEALTH_WEIGHTS.validations +
      components.traversal * HEALTH_WEIGHTS.traversal +
      components.relationships * HEALTH_WEIGHTS.relationships +
      components.weak_health * HEALTH_WEIGHTS.weak_health
    ).toFixed(6),
  );

  return {
    score,
    band: healthBand(score),
    components,
    basis: {
      total_nodes: totalNodes,
      connected_nodes: connectedNodes,
      source_capable_nodes: sourceCapableNodes,
      rule_subject_nodes: ruleSubjectNodes,
      core_nodes: coreNodes,
    },
  };
}

// ── Full integrity report (pure) ─────────────────────────────────────────────
export interface IntegrityReport {
  generated_at: string;
  validations: ValidationResult[];
  all_validations_passed: boolean;
  coverage: CategoryCoverage[];
  gaps: GapAnalysis;
  health: HealthScore;
}

/** Assemble the full integrity report from a read-only index. Pure & deterministic. */
export function computeIntegrityReport(index: TraversalIndex): IntegrityReport {
  const gaps = computeGapAnalysis(index);
  const validations = runIntegrityValidations(index);
  const coverage = computeCoverage(index);
  const health = computeHealthScore(index, gaps, validations);
  return {
    generated_at: new Date().toISOString(),
    validations,
    all_validations_passed: validations.every((v) => v.passed),
    coverage,
    gaps,
    health,
  };
}

// ── Orchestrators ────────────────────────────────────────────────────────────
/** Read-only integrity report from the CACHED traversal index (no writes). */
export async function integrityReport(pool: Pool): Promise<IntegrityReport> {
  const index = await getTraversalIndex(pool);
  return computeIntegrityReport(index);
}

export interface RunIntegrityAuditResult {
  report: IntegrityReport;
  gap_run: RunGapResult;
}

/**
 * Full Phase-8D run: recompute + persist the gap analysis (pil_kg_gap_analysis),
 * assemble the integrity report, and append an integrity summary row to pil_kg_audit.
 * Best-effort: never throws; degrades to whatever it could compute. Graph untouched.
 */
export async function runIntegrityAudit(
  pool: Pool,
  opts: { runId?: string; refresh?: boolean } = {},
): Promise<RunIntegrityAuditResult> {
  const started = Date.now();
  const gapRun = await runGapAnalysis(pool, opts);
  let report: IntegrityReport;
  try {
    await ensureGraphMaturationSchema(pool);
    const index = await getTraversalIndex(pool); // cached; gap run already refreshed
    report = computeIntegrityReport(index);
    await recordGraphAudit(pool, {
      event_type: 'integrity_audit',
      node_count: report.gaps.summary.total_nodes,
      edge_count: report.gaps.summary.total_edges,
      affected_rows: report.validations.reduce((a, v) => a + v.orphans, 0),
      duration_ms: Date.now() - started,
      status: report.all_validations_passed ? 'ok' : 'degraded',
      details: {
        phase: '8d',
        run_id: gapRun.run_id,
        health_score: report.health.score,
        health_band: report.health.band,
        all_validations_passed: report.all_validations_passed,
        validations: report.validations.map((v) => ({ name: v.name, passed: v.passed, orphans: v.orphans })),
        by_type: report.gaps.by_type,
      },
    });
  } catch (err) {
    console.warn('[pil-integrity] runIntegrityAudit degraded:', err instanceof Error ? err.message : String(err));
    report = {
      generated_at: new Date().toISOString(),
      validations: [],
      all_validations_passed: false,
      coverage: [],
      gaps: gapRun.analysis,
      health: {
        score: 0, band: 'weak',
        components: { connectivity: 0, validations: 0, traversal: 0, relationships: 0, weak_health: 0 },
        basis: { total_nodes: 0, connected_nodes: 0, source_capable_nodes: 0, rule_subject_nodes: 0, core_nodes: 0 },
      },
    };
  }
  return { report, gap_run: gapRun };
}

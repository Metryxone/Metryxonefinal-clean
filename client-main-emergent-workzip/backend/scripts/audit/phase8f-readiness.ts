/**
 * CAPADEX PIL — Phase 8F: Knowledge Graph Validation (certification) audit + outputs.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 npx tsx scripts/audit/phase8f-readiness.ts
 *
 * Read-only certification of the CANONICAL materialized graph (pil_kg_*). It runs the
 * GraphValidationEngine — which COMPOSES the 8A–8E engines (traversal counts, integrity +
 * gaps, similarity, explainability) into a single production-readiness verdict — appends an
 * append-only pil_kg_audit `readiness_audit` row, and emits:
 *   - node_counts.json / edge_counts.json (graph counts + category/verb breakdown)
 *   - coverage_metrics.json   (seven coverage dimensions, banded)
 *   - integrity_metrics.json  (structural validations + lineage integrity + health)
 *   - readiness_score.json    (fixed a-priori weighted score + components)
 *   - summary.json            (final recommendation + hard gates)
 *   - KNOWLEDGE_GRAPH_READINESS.md  (READY FOR PHASE 9 | ADDITIONAL GRAPH WORK REQUIRED)
 *   → audit/phase8f/.
 *
 * The graph structure is NEVER mutated; the only write is the append-only pil_kg_audit row.
 * A `weak`/NOT-READY verdict is reported as-is — metrics are never tuned to force a pass.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRuntimeIntelligenceActivationEnabled } from '../../config/feature-flags';
import { runGraphValidation, READINESS_WEIGHTS } from '../../services/pil/graph-validation-engine';

const OUT_DIR = join(process.cwd(), '..', 'audit', 'phase8f');
const writeJson = (name: string, data: unknown) =>
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const flagOn = isRuntimeIntelligenceActivationEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const report = await runGraphValidation(pool, { refresh: true });
    const c = report.coverage;

    writeJson('node_counts.json', {
      generated_at: report.generated_at,
      node_count: report.counts.node_count,
      category_counts: report.counts.category_counts,
    });
    writeJson('edge_counts.json', {
      generated_at: report.generated_at,
      edge_count: report.counts.edge_count,
      verb_counts: report.counts.verb_counts,
    });
    writeJson('coverage_metrics.json', {
      generated_at: report.generated_at,
      dimensions: {
        node: c.node,
        edge: c.edge,
        relationship: c.relationship,
        traversal: c.traversal,
        similarity: c.similarity,
        gap: c.gap,
        explainability: c.explainability,
      },
      similarity_detail: report.similarity_detail,
    });
    writeJson('integrity_metrics.json', {
      generated_at: report.generated_at,
      integrity: report.integrity,
      explainability: report.explainability,
      verifications: report.verifications,
    });
    writeJson('readiness_score.json', {
      generated_at: report.generated_at,
      score: report.readiness.score,
      band: report.readiness.band,
      components: report.readiness.components,
      weights: READINESS_WEIGHTS,
    });

    const out = {
      generated_at: report.generated_at,
      flag_on: flagOn,
      node_count: report.counts.node_count,
      edge_count: report.counts.edge_count,
      coverage: {
        node: c.node.rate,
        edge: c.edge.rate,
        relationship: c.relationship.rate,
        traversal: c.traversal.rate,
        similarity: c.similarity.rate,
        gap: c.gap.rate,
        explainability_support: c.explainability.rate,
        explainability_source_trace: c.explainability.basis.source_trace_rate,
      },
      integrity_passed: report.integrity.all_validations_passed,
      lineage_passed: report.explainability.all_validations_passed,
      readiness_score: report.readiness.score,
      readiness_band: report.readiness.band,
      hard_gates: report.hard_gates,
      all_hard_gates_passed: report.all_hard_gates_passed,
      recommendation: report.recommendation,
      reasons: report.reasons,
      performance_ms: report.performance_ms,
      graph_structure_untouched: true,
    };
    writeJson('summary.json', out);

    const md = [
      '# CAPADEX PIL — Phase 8F: Knowledge Graph Readiness',
      '',
      `Generated: ${report.generated_at}`,
      `Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ${flagOn ? 'ON' : 'OFF'}`,
      '',
      `## Final recommendation: **${report.recommendation}**`,
      '',
      ...report.reasons.map((r) => `- ${r}`),
      '',
      '## Canonical graph (read-only)',
      `- Nodes: ${report.counts.node_count.toLocaleString()}`,
      `- Edges: ${report.counts.edge_count.toLocaleString()}`,
      `- Graph structure untouched: yes (only the append-only pil_kg_audit \`readiness_audit\` row written)`,
      '',
      '## Readiness score',
      `### **${pct(report.readiness.score)}** — ${report.readiness.band.toUpperCase()}`,
      '',
      '| Component | Value | Weight |',
      '| --- | --- | --- |',
      `| Graph health | ${pct(report.readiness.components.graph_health)} | ${READINESS_WEIGHTS.graph_health} |`,
      `| Structure (node + relationship) | ${pct(report.readiness.components.structure)} | ${READINESS_WEIGHTS.structure} |`,
      `| Traversal | ${pct(report.readiness.components.traversal)} | ${READINESS_WEIGHTS.traversal} |`,
      `| Explainability support | ${pct(report.readiness.components.explainability_support)} | ${READINESS_WEIGHTS.explainability_support} |`,
      `| Gap-clean | ${pct(report.readiness.components.gap_clean)} | ${READINESS_WEIGHTS.gap_clean} |`,
      `| Similarity | ${pct(report.readiness.components.similarity)} | ${READINESS_WEIGHTS.similarity} |`,
      '',
      '## Coverage (seven dimensions)',
      '| Dimension | Rate | Band |',
      '| --- | --- | --- |',
      `| Node (connectivity) | ${pct(c.node.rate)} | ${c.node.band} |`,
      `| Edge (verbs present) | ${pct(c.edge.rate)} | ${c.edge.band} |`,
      `| Relationship (relations realised) | ${pct(c.relationship.rate)} | ${c.relationship.band} |`,
      `| Traversal (non-dead-end) | ${pct(c.traversal.rate)} | ${c.traversal.band} |`,
      `| Similarity (same-category match) | ${pct(c.similarity.rate)} | ${c.similarity.band} |`,
      `| Gap-clean | ${pct(c.gap.rate)} | ${c.gap.band} |`,
      `| Explainability (local support) | ${pct(c.explainability.rate)} | ${c.explainability.band} |`,
      '',
      '## Hard certification gates',
      ...report.hard_gates.map((g) => `- ${g.passed ? '✅' : '❌'} ${g.name}`),
      `- All hard gates passed: **${report.all_hard_gates_passed ? 'YES' : 'NO'}**`,
      '',
      '## Verifications',
      ...report.verifications.map((v) => `- ${v.passed ? '✅' : '❌'} **${v.name}** — ${v.detail}`),
      '',
      '## Honest findings',
      `- **Explainability source-traceability = ${pct(c.explainability.basis.source_trace_rate)}** is an architectural`,
      '  limit: recommendations / runtime_interventions anchor on the `construct` sink, so they are',
      '  *locally supported* but do not chain to a concern/question. This is an INFORMATIONAL',
      '  sub-metric, **not** a hard gate — the missing hop is never fabricated.',
      '- Hard gates are the production blockers: structural integrity (no orphan statements),',
      '  lineage integrity (no unsupported statements), determinism, performance, and a readiness',
      '  band of at least *moderate*.',
      '',
      '> Weights, bands and gates are fixed a priori. The verdict reflects the graph; the graph is',
      '> never massaged to hit a score.',
      '',
    ].join('\n');
    writeFileSync(join(OUT_DIR, 'KNOWLEDGE_GRAPH_READINESS.md'), md + '\n', 'utf8');

    console.log('Phase 8F — Knowledge Graph Readiness audit complete:');
    console.log(JSON.stringify(out, null, 2));
    console.log('Artifacts → audit/phase8f/');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

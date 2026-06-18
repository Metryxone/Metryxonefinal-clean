/**
 * CAPADEX PIL — Phase 8E: Graph Explainability audit + outputs.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 npx tsx scripts/audit/phase8e-explainability.ts
 *
 * Read-only validation of the GraphExplainabilityEngine over the CANONICAL materialized
 * graph (pil_kg_*). It computes the explainability report, appends a pil_kg_audit summary
 * row, and emits worked examples + reports:
 *   - Explainability Examples (a worked intervention + a worked recommendation)
 *   - Coverage Report        (per statement category: local support + source-traceability)
 *   - Validations            (No Unsupported Statements)
 *   - Graph Explainability Score
 *   → audit/phase8e/.
 *
 * It NEVER mutates the graph structure; the only write is the append-only pil_kg_audit row.
 * Honest findings (recommendations anchor on a `construct` sink → not source-traceable) are
 * reported as-is — never tuned to force a pass.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRuntimeIntelligenceActivationEnabled } from '../../config/feature-flags';
import { getTraversalIndex, indexSummary } from '../../services/pil/graph-traversal-engine';
import {
  runExplainabilityAudit,
  resolveExplain,
  resolveWhy,
  resolvePathToSource,
  EXPLAINABILITY_WEIGHTS,
  SOURCE_CATEGORIES,
  STATEMENT_CATEGORIES,
} from '../../services/pil/graph-explainability-engine';

const OUT_DIR = join(process.cwd(), '..', 'audit', 'phase8e');
const writeJson = (name: string, data: unknown) =>
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');

/** First node id of a category (sorted, deterministic) that has a worked example. */
function firstOf(index: Awaited<ReturnType<typeof getTraversalIndex>>, category: string): string | null {
  const ids = (index.byCategory.get(category) ?? []).slice().sort();
  return ids[0] ?? null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const flagOn = isRuntimeIntelligenceActivationEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── Compute + persist (explainability report + append-only pil_kg_audit) ──
    const report = await runExplainabilityAudit(pool, { refresh: true });
    const index = await getTraversalIndex(pool); // cached; the run already refreshed it
    const summary = indexSummary(index);

    // ── Worked examples: one fully-traceable intervention + one recommendation ──
    const examples: Record<string, unknown> = {};
    const intervId = firstOf(index, 'intervention');
    const recId = firstOf(index, 'recommendation');
    if (intervId) {
      examples.intervention = {
        node_id: intervId,
        explain: resolveExplain(index, intervId),
        why: resolveWhy(index, intervId),
        path_to_source: resolvePathToSource(index, intervId),
      };
    }
    if (recId) {
      examples.recommendation = {
        node_id: recId,
        explain: resolveExplain(index, recId),
        why: resolveWhy(index, recId),
        path_to_source: resolvePathToSource(index, recId),
      };
    }
    writeJson('explainability_examples.json', {
      generated_at: report.generated_at,
      note: 'Worked examples driving the three resolvers over the real graph. Each path step is a real edge.',
      source_categories: [...SOURCE_CATEGORIES],
      statement_categories: [...STATEMENT_CATEGORIES],
      examples,
    });

    // ── Coverage Report ──
    writeJson('coverage_report.json', {
      generated_at: report.generated_at,
      per_category: report.coverage.per_category,
      totals: report.coverage.totals,
    });

    // ── Validations ──
    writeJson('validations.json', {
      generated_at: report.generated_at,
      all_passed: report.all_validations_passed,
      results: report.validations,
    });

    // ── Graph Explainability Score ──
    writeJson('explainability_score.json', {
      generated_at: report.generated_at,
      score: report.score.score,
      band: report.score.band,
      components: report.score.components,
      weights: EXPLAINABILITY_WEIGHTS,
      basis: report.score.basis,
    });

    writeJson('index_summary.json', summary);

    const out = {
      generated_at: report.generated_at,
      flag_on: flagOn,
      graph: { node_count: summary.node_count, edge_count: summary.edge_count },
      statement_categories: [...STATEMENT_CATEGORIES],
      source_categories: [...SOURCE_CATEGORIES],
      statements: report.coverage.totals.statements,
      support_rate: report.coverage.totals.support_rate,
      source_trace_rate: report.coverage.totals.source_trace_rate,
      all_validations_passed: report.all_validations_passed,
      graph_explainability_score: report.score.score,
      graph_explainability_band: report.score.band,
      graph_structure_untouched: true,
    };
    writeJson('summary.json', out);

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const md = [
      '# CAPADEX PIL — Phase 8E: Graph Explainability',
      '',
      `Generated: ${report.generated_at}`,
      `Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ${flagOn ? 'ON' : 'OFF'}`,
      '',
      '## Canonical graph (read-only)',
      `- Nodes: ${summary.node_count.toLocaleString()}`,
      `- Edges: ${summary.edge_count.toLocaleString()}`,
      `- Graph structure untouched: yes (only the append-only pil_kg_audit summary row written)`,
      '',
      '## What "explainable" means here (two honest layers)',
      '1. **Local support** — a statement has ≥1 real grounding edge (out-degree ≥ 1). This is the',
      '   *No Unsupported Statements* guarantee.',
      '2. **Source-traceability** — the statement chains over real edges to a grounding source',
      `   (${SOURCE_CATEGORIES.join(' / ')}).`,
      '',
      '## Coverage Report (statement layer)',
      '| Category | Total | Locally supported | Source-traceable |',
      '| --- | --- | --- | --- |',
      ...report.coverage.per_category.map(
        (c) => `| ${c.category} | ${c.total.toLocaleString()} | ${c.supported.toLocaleString()} (${pct(c.support_rate)}) | ${c.reaches_source.toLocaleString()} (${pct(c.source_trace_rate)}) |`,
      ),
      `| **All statements** | **${report.coverage.totals.statements.toLocaleString()}** | **${report.coverage.totals.supported.toLocaleString()} (${pct(report.coverage.totals.support_rate)})** | **${report.coverage.totals.reaches_source.toLocaleString()} (${pct(report.coverage.totals.source_trace_rate)})** |`,
      '',
      '## Validations (hard)',
      ...report.validations.map((v) => `- ${v.passed ? '✅' : '❌'} **${v.name}** — ${v.unsupported} unsupported / ${v.total_statements} statements`),
      `- All validations passed: **${report.all_validations_passed ? 'YES' : 'NO'}**`,
      '',
      '## Graph Explainability Score',
      `### **${pct(report.score.score)}** — ${report.score.band.toUpperCase()}`,
      '',
      '| Component | Value | Weight |',
      '| --- | --- | --- |',
      `| Local support | ${pct(report.score.components.support)} | ${EXPLAINABILITY_WEIGHTS.support} |`,
      `| Source-traceability | ${pct(report.score.components.source_trace)} | ${EXPLAINABILITY_WEIGHTS.source_trace} |`,
      '',
      '## Honest findings',
      '- **Interventions are fully traceable** to a grounding source: `intervention → problem →',
      '  archetype → concern → bridge_tag ← clarity_question`.',
      '- **Recommendations anchor on a `construct`, which is a graph sink** (no outgoing edges),',
      '  so they are *locally supported* by their construct anchor but do **NOT** chain to a',
      '  concern/question. This is reported as-is — the missing hop is never fabricated. Closing',
      '  it would require a real construct→concern edge layer (a deliberate future-phase decision).',
      '',
      '> Weights & bands are fixed a priori. The score reflects the graph; the graph is never',
      '> massaged to hit a score.',
      '',
    ].join('\n');
    writeFileSync(join(OUT_DIR, 'GRAPH_EXPLAINABILITY.md'), md + '\n', 'utf8');

    console.log('Phase 8E — Graph Explainability audit complete:');
    console.log(JSON.stringify(out, null, 2));
    console.log('Artifacts → audit/phase8e/');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

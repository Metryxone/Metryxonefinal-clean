/**
 * CAPADEX PIL — Phase 8D: Gap Detection + Integrity audit + outputs.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 npx tsx scripts/audit/phase8d-gap-detection.ts
 *
 * Read-only validation of the GraphGapEngine + IntegrityAuditEngine over the
 * CANONICAL materialized graph (pil_kg_*). It recomputes + persists the derived
 * pil_kg_gap_analysis, appends a pil_kg_audit summary row, and reports:
 *   - Gap Report        (orphan / weakly-connected / unused-construct / missing-rel / dead-end)
 *   - Integrity Report  (No Orphan Recommendations / Interventions / Archetypes)
 *   - Coverage Report   (per-category connectivity)
 *   - Graph Health Score
 *   → audit/phase8d/.
 *
 * It NEVER mutates the graph structure; the only writes are the derived
 * pil_kg_gap_analysis snapshot + the append-only pil_kg_audit row. Honest findings
 * (the known competency orphan class, by-design single-anchor recommendations) are
 * reported as-is — never tuned to force a pass.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRuntimeIntelligenceActivationEnabled } from '../../config/feature-flags';
import { getTraversalIndex, indexSummary } from '../../services/pil/graph-traversal-engine';
import { GAP_TYPES, MISSING_RELATIONSHIP_RULES } from '../../services/pil/gap-detection-engine';
import {
  runIntegrityAudit,
  computeIntegrityReport,
  HEALTH_WEIGHTS,
  NO_ORPHAN_NODE_TYPES,
} from '../../services/pil/integrity-audit-engine';

const OUT_DIR = join(process.cwd(), '..', 'audit', 'phase8d');
const writeJson = (name: string, data: unknown) =>
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');

const SAMPLE_PER_TYPE = 25; // explainable sample of flagged nodes per gap type

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const flagOn = isRuntimeIntelligenceActivationEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── Compute + persist in ONE pass (gap snapshot + pil_kg_audit summary) ──
    const { report, gap_run } = await runIntegrityAudit(pool, { refresh: true });

    // Read-only index for the index summary (cached; the run already refreshed it).
    const index = await getTraversalIndex(pool);
    const summary = indexSummary(index);

    // Re-derive the report from the cached index for the artifacts (identical, deterministic).
    const r = report.gaps.summary.total_nodes > 0 ? report : computeIntegrityReport(index);

    // ── Gap Report ──
    const gapByType: Record<string, unknown> = {};
    for (const t of GAP_TYPES) {
      const rows = r.gaps.rows.filter((g) => g.gap_type === t);
      const byNodeType: Record<string, number> = {};
      for (const g of rows) byNodeType[g.node_type] = (byNodeType[g.node_type] ?? 0) + 1;
      gapByType[t] = {
        total: rows.length,
        by_node_type: byNodeType,
        sample: rows.slice(0, SAMPLE_PER_TYPE).map((g) => ({
          node_id: g.node_id, node_type: g.node_type, category: g.category, severity: g.severity, detail: g.detail,
        })),
      };
    }
    writeJson('gap_report.json', {
      generated_at: r.generated_at,
      run_id: gap_run.run_id,
      rows_persisted: gap_run.rows_written,
      truncated: gap_run.truncated,
      by_type: r.gaps.by_type,
      orphan_by_node_type: r.gaps.summary.orphan_by_node_type,
      source_capable_types: r.gaps.summary.source_capable_types,
      missing_relationship_rules: MISSING_RELATIONSHIP_RULES,
      detail: gapByType,
    });

    // ── Integrity Report ──
    writeJson('integrity_report.json', {
      generated_at: r.generated_at,
      guarded_node_types: [...NO_ORPHAN_NODE_TYPES],
      all_validations_passed: r.all_validations_passed,
      validations: r.validations,
    });
    writeJson('validations.json', {
      generated_at: r.generated_at,
      all_passed: r.all_validations_passed,
      results: r.validations.map((v) => ({ name: v.name, node_type: v.node_type, total: v.total, orphans: v.orphans, passed: v.passed })),
    });

    // ── Coverage Report ──
    writeJson('coverage_report.json', {
      generated_at: r.generated_at,
      categories: r.coverage,
      totals: {
        total_nodes: r.gaps.summary.total_nodes,
        connected_nodes: r.health.basis.connected_nodes,
        overall_coverage: r.gaps.summary.total_nodes > 0
          ? Number((r.health.basis.connected_nodes / r.gaps.summary.total_nodes).toFixed(6)) : 0,
      },
    });

    // ── Graph Health Score ──
    writeJson('graph_health.json', {
      generated_at: r.generated_at,
      score: r.health.score,
      band: r.health.band,
      components: r.health.components,
      weights: HEALTH_WEIGHTS,
      basis: r.health.basis,
    });

    writeJson('index_summary.json', summary);

    const out = {
      generated_at: r.generated_at,
      flag_on: flagOn,
      graph: { node_count: summary.node_count, edge_count: summary.edge_count },
      gap_types: [...GAP_TYPES],
      gaps_by_type: r.gaps.by_type,
      gap_rows_persisted: gap_run.rows_written,
      all_validations_passed: r.all_validations_passed,
      graph_health_score: r.health.score,
      graph_health_band: r.health.band,
      graph_structure_untouched: true,
    };
    writeJson('summary.json', out);

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const md = [
      '# CAPADEX PIL — Phase 8D: Graph Health & Gap Detection',
      '',
      `Generated: ${r.generated_at}`,
      `Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ${flagOn ? 'ON' : 'OFF'}`,
      '',
      '## Canonical graph (read-only)',
      `- Nodes: ${summary.node_count.toLocaleString()}`,
      `- Edges: ${summary.edge_count.toLocaleString()}`,
      `- Graph structure untouched: yes (only derived pil_kg_gap_analysis + append-only pil_kg_audit written)`,
      '',
      '## Gap Report',
      ...GAP_TYPES.map((t) => {
        const d = gapByType[t] as { total: number; by_node_type: Record<string, number> };
        const types = Object.entries(d.by_node_type).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
        return `- **${t}** — ${d.total.toLocaleString()}${types ? ` (${types})` : ''}`;
      }),
      `- Gap rows persisted to \`pil_kg_gap_analysis\`: **${gap_run.rows_written.toLocaleString()}**${gap_run.truncated ? ' *(truncated)*' : ''}`,
      '',
      '## Integrity Report (hard validations)',
      ...r.validations.map((v) => `- ${v.passed ? '✅' : '❌'} **${v.name}** — ${v.orphans} orphan / ${v.total} total`),
      `- All validations passed: **${r.all_validations_passed ? 'YES' : 'NO'}**`,
      '',
      '## Coverage Report (connectivity by category)',
      ...r.coverage.map((c) => `- **${c.category}** — ${c.connected}/${c.total} connected (${pct(c.coverage)})`),
      '',
      '## Graph Health Score',
      `### **${pct(r.health.score)}** — ${r.health.band.toUpperCase()}`,
      '',
      '| Component | Value | Weight |',
      '| --- | --- | --- |',
      `| Connectivity | ${pct(r.health.components.connectivity)} | ${HEALTH_WEIGHTS.connectivity} |`,
      `| Validations | ${pct(r.health.components.validations)} | ${HEALTH_WEIGHTS.validations} |`,
      `| Traversal (no dead-ends) | ${pct(r.health.components.traversal)} | ${HEALTH_WEIGHTS.traversal} |`,
      `| Relationships (no missing) | ${pct(r.health.components.relationships)} | ${HEALTH_WEIGHTS.relationships} |`,
      `| Weak-node health | ${pct(r.health.components.weak_health)} | ${HEALTH_WEIGHTS.weak_health} |`,
      '',
      '> Weights & bands are fixed a priori. Honest findings (the known competency orphan',
      '> class, by-design single-anchor recommendations) are reported as-is, never tuned.',
      '',
    ].join('\n');
    writeFileSync(join(OUT_DIR, 'GRAPH_HEALTH.md'), md + '\n', 'utf8');

    console.log('Phase 8D — Gap Detection + Integrity audit complete:');
    console.log(JSON.stringify(out, null, 2));
    console.log('Artifacts → audit/phase8d/');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

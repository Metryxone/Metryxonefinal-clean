/**
 * CAPADEX Phase 8 — generate the 6 Knowledge Graph review deliverables (read-only).
 *   1. graph_summary.json   — full stats: counts by type/relation, components, hubs, orphans.
 *   2. GRAPH_OVERVIEW.md     — human-readable inventory + connectivity findings (honest).
 *   3. components.csv        — connected components (id, size, dominant type, type breakdown).
 *   4. hubs.csv              — top hubs (id, type, label, degree).
 *   5. sample_paths.json     — provenance-traced example paths + one session subgraph.
 *   6. graph_export.graphml  — induced subgraph around a sample concern (visualisation).
 *
 * Run (flag must be ON):
 *   FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 \
 *     npx tsx backend/scripts/audit/phase8-knowledge-graph-samples.ts
 *
 * Builds the graph from the REAL DB; NO writes to DB. Outputs → audit/phase8/.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeGraph } from '../../services/pil/knowledge-graph-builder';
import {
  buildIndex, graphStats, shortestPath, neighborhood,
  connectedComponents, orphans, hubs,
} from '../../services/pil/knowledge-graph-query';
import { getSessionSubgraph, toGraphML } from '../../services/pil/knowledge-graph-service';
import { nodeId, type KGNode } from '../../services/pil/knowledge-graph-schema';

const SAMPLE_SESSION = '1cd9ca07-4659-42c4-83fd-229e5e8f21f2';
// File-relative so output lands in <repo>/audit/phase8 regardless of cwd
// (this file lives at backend/scripts/audit/ → repo root is three levels up).
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'audit', 'phase8');

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  if (process.env.FF_RUNTIME_INTELLIGENCE_ACTIVATION !== '1') {
    console.error('Refusing to run: FF_RUNTIME_INTELLIGENCE_ACTIVATION must be 1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('[phase8] building knowledge graph from real DB…');
  const graph = await buildKnowledgeGraph(pool);
  const index = buildIndex(graph);
  const stats = graphStats(graph, index);
  const comps = connectedComponents(graph, index);
  const orph = orphans(graph, index);
  const topHubs = hubs(graph, index, { limit: 50 });
  console.log(`[phase8] graph: ${stats.node_count} nodes, ${stats.edge_count} edges, ${comps.length} components.`);

  // ── 1. graph_summary.json ───────────────────────────────────────────────────
  const summary = {
    built_at: graph.built_at,
    ...stats,
    components: comps.slice(0, 50),
    component_total: comps.length,
    orphans: orph,
    top_hubs: topHubs,
  };
  writeFileSync(join(OUT_DIR, 'graph_summary.json'), JSON.stringify(summary, null, 2));

  // ── 3. components.csv ───────────────────────────────────────────────────────
  const compRows = ['component_index,size,dominant_type,type_breakdown'];
  comps.forEach((c, i) => {
    const breakdown = Object.entries(c.by_type).map(([t, n]) => `${t}:${n}`).join(' ');
    const dominant = Object.entries(c.by_type).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    compRows.push([i, c.size, dominant, breakdown].map(csvEscape).join(','));
  });
  writeFileSync(join(OUT_DIR, 'components.csv'), compRows.join('\n'));

  // ── 4. hubs.csv ─────────────────────────────────────────────────────────────
  const hubRows = ['node_id,type,label,degree'];
  for (const h of topHubs) hubRows.push([h.id, h.type, h.label, h.degree].map(csvEscape).join(','));
  writeFileSync(join(OUT_DIR, 'hubs.csv'), hubRows.join('\n'));

  // ── 5. sample_paths.json ────────────────────────────────────────────────────
  // Pick a real concern that has a concern→signal edge, then trace outward.
  const anchorConcern = graph.nodes.find(
    (n) => n.type === 'concern' && (index.adj.get(n.id)?.length ?? 0) > 1,
  );
  const samplePaths: Record<string, unknown> = {};
  if (anchorConcern) {
    const tries: Array<[string, string, string]> = [];
    const find = (t: KGNode['type']) => graph.nodes.find((n) => n.type === t);
    const sig = find('signal'); const clq = find('clarity_question');
    const cap = find('capability'); const interv = find('intervention');
    if (sig) tries.push(['concern→signal', anchorConcern.id, sig.id]);
    if (cap) tries.push(['concern→capability', anchorConcern.id, cap.id]);
    if (clq && interv) tries.push(['clarity_question→intervention', clq.id, interv.id]);
    if (clq && sig) tries.push(['clarity_question→signal', clq.id, sig.id]);
    for (const [name, s, t] of tries) {
      const p = shortestPath(index, s, t);
      samplePaths[name] = {
        source: s, target: t, reachable: p.length > 0, hops: Math.max(0, p.length - 1),
        path: p.map((n) => ({ id: n.id, type: n.type, label: n.label })),
      };
    }
  }
  const sessionSub = await getSessionSubgraph(pool, SAMPLE_SESSION).catch((e) => ({ error: String(e) }));
  writeFileSync(join(OUT_DIR, 'sample_paths.json'), JSON.stringify({ sample_paths: samplePaths, session_subgraph: sessionSub }, null, 2));

  // ── 6. graph_export.graphml ─────────────────────────────────────────────────
  let exportNote = 'no anchor concern available';
  if (anchorConcern) {
    const sub = neighborhood(index, anchorConcern.id, 2, { maxNodes: 600 });
    writeFileSync(join(OUT_DIR, 'graph_export.graphml'), toGraphML(sub.nodes, sub.edges));
    exportNote = `anchor=${anchorConcern.id} (${anchorConcern.label}) · ${sub.nodes.length} nodes / ${sub.edges.length} edges`;
  } else {
    writeFileSync(join(OUT_DIR, 'graph_export.graphml'), toGraphML([], []));
  }

  // ── 2. GRAPH_OVERVIEW.md ────────────────────────────────────────────────────
  const typeRows = Object.entries(stats.nodes_by_type).sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `| ${t} | ${n} |`).join('\n');
  const relRows = Object.entries(stats.edges_by_relation).sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `| ${r} | ${n} |`).join('\n');
  const provRows = Object.entries(stats.edges_by_provenance_table).sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `| ${p} | ${n} |`).join('\n');
  const compSummary = comps.slice(0, 10).map((c, i) => {
    const dominant = Object.entries(c.by_type).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return `| ${i} | ${c.size} | ${dominant} |`;
  }).join('\n');
  const hubSummary = topHubs.slice(0, 15)
    .map((h) => `| ${h.type} | ${h.label} | ${h.degree} |`).join('\n');
  const orphSummary = Object.entries(orph.by_type).sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `| ${t} | ${n} |`).join('\n');

  const md = `# CAPADEX Phase 8 — Knowledge Graph Overview

Generated: ${graph.built_at}

The Knowledge Graph unifies every CAPADEX intelligence asset into ONE directed graph of
typed nodes and **provenance-stamped edges**. Every edge is backed by a real DB linkage
row (its source table is recorded on the edge) — nothing is fabricated. The graph is
deterministic for a given database state.

## 1. Scale
- **Nodes:** ${stats.node_count}
- **Edges:** ${stats.edge_count}
- **Connected components:** ${comps.length}
- **Orphan nodes (no edges):** ${stats.orphan_count}

## 2. Nodes by type
| type | count |
|------|------:|
${typeRows}

## 3. Edges by relation
| relation | count |
|----------|------:|
${relRows}

## 4. Edge provenance (source table)
Every edge records the real table it was derived from.
| provenance table | edges |
|------------------|------:|
${provRows}

## 5. Largest components (top 10)
| component | size | dominant type |
|-----------|-----:|---------------|
${compSummary}

## 6. Top hubs (top 15)
| type | label | degree |
|------|-------|-------:|
${hubSummary}

## 7. Orphans by type (statically-disconnected assets)
These assets have no DB linkage row joining them into the graph today. They are reported,
never force-connected.
| type | count |
|------|------:|
${orphSummary}

## 8. Honest connectivity findings
- The **bridge tag** is the central hub joining domains, families, atomic signals, signals,
  concerns and clarity questions — it carries the bulk of edges.
- The **construct** region (recommendation_library + recommendation runtime constructs +
  runtime intervention library) forms a runtime-bound component anchored on construct hubs;
  it joins the concern core only where a real linkage row exists.
- **Competency** nodes (\`onto_competencies\`) are statically disconnected — there is no DB
  linkage row tying them to concerns/signals today, so they surface as their own
  component/orphans (a real finding, not a bug).
- Concern → signal edges use Tier-3 mappings only; composite/atomic/orphan map rows are
  intentionally not promoted to edges here.

## 9. Outputs in this directory
- \`graph_summary.json\` — machine-readable stats (counts, components, hubs, orphans).
- \`components.csv\` — every connected component with its type breakdown.
- \`hubs.csv\` — top 50 hubs by degree.
- \`sample_paths.json\` — provenance-traced example paths + one session subgraph (${SAMPLE_SESSION}).
- \`graph_export.graphml\` — induced 2-hop subgraph around a sample concern (${exportNote}).
`;
  writeFileSync(join(OUT_DIR, 'GRAPH_OVERVIEW.md'), md);

  console.log(`[phase8] wrote 6 outputs → ${OUT_DIR}`);
  await pool.end();
}

main().catch((e) => { console.error('[phase8] FAILED:', e); process.exit(1); });

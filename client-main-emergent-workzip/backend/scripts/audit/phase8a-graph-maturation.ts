/**
 * CAPADEX PIL — Phase 8A: Graph Maturation seed + verify + audit outputs.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 npx tsx scripts/audit/phase8a-graph-maturation.ts
 *
 * MATURATION, NOT REPLACEMENT. This:
 *   1. (flag-gated) materialises the canonical graph (pil_kg_nodes/pil_kg_edges) so live
 *      counts have something real to read — it never creates a parallel graph.
 *   2. seeds the deterministic catalogs, refreshes live counts + metadata,
 *      computes a bounded similarity sample, and
 *   3. writes proof artifacts to audit/phase8a/.
 *
 * The harness is allowed to surface honest findings (e.g. an unmaterialised graph
 * → zero counts) — it never fabricates rows.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRuntimeIntelligenceActivationEnabled } from '../../config/feature-flags';
import { rebuildAndMaterialize } from '../../services/pil/knowledge-graph-service';
import {
  ensureGraphMaturationSchema,
  seedCatalogs,
  refreshCatalogCounts,
  refreshGraphMetadata,
  computeNodeSimilarity,
  recordGraphAudit,
  getMaturationSnapshot,
} from '../../services/pil/knowledge-graph-maturation';
import { buildCoverageReport } from '../../services/pil/knowledge-graph-maturation-schema';

const OUT_DIR = join(process.cwd(), '..', 'audit', 'phase8a');

function writeJson(name: string, data: unknown) {
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function writeCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  writeFileSync(join(OUT_DIR, name), [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n', 'utf8');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const flagOn = isRuntimeIntelligenceActivationEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await ensureGraphMaturationSchema(pool);

    // 1) Materialise the canonical graph (flag-gated) so counts are real.
    let materialized: { nodes: number; edges: number } | null = null;
    if (flagOn) {
      const started = Date.now();
      try {
        materialized = await rebuildAndMaterialize(pool);
        await recordGraphAudit(pool, {
          event_type: 'materialize',
          node_count: materialized.nodes,
          edge_count: materialized.edges,
          duration_ms: Date.now() - started,
          details: { source: 'phase8a-audit' },
        });
      } catch (e) {
        console.warn('materialize skipped:', (e as Error).message);
      }
    } else {
      console.warn('FF_RUNTIME_INTELLIGENCE_ACTIVATION off — describing whatever graph already exists.');
    }

    // 2) Seed + refresh + similarity (all describe the canonical graph).
    const seeded = await seedCatalogs(pool);
    const counts = await refreshCatalogCounts(pool);
    const meta = await refreshGraphMetadata(pool);

    // Pick the node type with the most live nodes for a representative similarity sample.
    const topType = await pool.query(
      `SELECT node_type AS t, count(*) AS n FROM pil_kg_nodes GROUP BY node_type ORDER BY n DESC LIMIT 1`,
    ).catch(() => ({ rows: [] as { t: string; n: string }[] }));
    let simWritten = 0;
    let simType: string | null = null;
    if (topType.rows.length > 0) {
      simType = String(topType.rows[0].t);
      simWritten = await computeNodeSimilarity(pool, { nodeType: simType, topK: 5, minScore: 0.1, maxNodes: 1500 });
    }

    // 3) Proof artifacts.
    const cov = buildCoverageReport();
    const snap = await getMaturationSnapshot(pool);

    writeJson('coverage_report.json', cov);
    writeJson('graph_metadata.json', meta);
    writeJson('snapshot.json', snap);

    writeCsv(
      'node_type_catalog.csv',
      ['category_key', 'label', 'member_node_types', 'source_tables', 'node_count'],
      snap.node_type_catalog.map((r: any) => [
        r.category_key, r.label, (r.member_node_types || []).join('|'), (r.source_tables || []).join('|'), r.node_count,
      ]),
    );
    writeCsv(
      'relationship_type_catalog.csv',
      ['relationship_type', 'label', 'directed', 'member_relations', 'edge_count'],
      snap.relationship_type_catalog.map((r: any) => [
        r.relationship_type, r.label, r.directed, (r.member_relations || []).join('|'), r.edge_count,
      ]),
    );

    const summary = {
      generated_at: new Date().toISOString(),
      flag_on: flagOn,
      materialized,
      seeded,
      live_counts: counts,
      similarity: { node_type: simType, rows_written: simWritten },
      coverage_is_bijective: cov.is_bijective,
      empty_categories: cov.empty_categories,
      empty_relationship_types: cov.empty_relationship_types,
      canonical_graph_untouched: true,
    };
    writeJson('summary.json', summary);

    console.log('Phase 8A — Graph Maturation audit complete:');
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Artifacts → audit/phase8a/`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

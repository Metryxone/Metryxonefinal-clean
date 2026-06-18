/**
 * CAPADEX PIL — Phase 8C: Similarity Intelligence audit + outputs.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 npx tsx scripts/audit/phase8c-similarity.ts
 *
 * Read-only validation of the SimilarityEngine over the CANONICAL materialized
 * graph (pil_kg_*). For each of the six detect categories it runs the SAME pure
 * resolver the live APIs use, persists the derived pil_kg_similarity_index, and
 * reports the three mandated validations:
 *   - Similarity Coverage      (nodes with ≥1 similar peer / nodes scored)
 *   - False Match Review       (hub-only matches flagged for human review)
 *   - Explainability Coverage  (matches with a non-empty shared-neighbour reason)
 * plus Similarity Examples and a Similarity Readiness Score → audit/phase8c/.
 *
 * It NEVER mutates the graph; the only write is into the derived similarity index.
 * It is allowed to surface honest findings (e.g. a sparse category) — never tuned.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRuntimeIntelligenceActivationEnabled } from '../../config/feature-flags';
import { getTraversalIndex, indexSummary } from '../../services/pil/graph-traversal-engine';
import {
  adjacencyFromIndex,
  computeCategoryMatches,
  resolveSimilar,
  resolveRecommendationsLikeThis,
  rebuildSimilarityIndex,
  SIMILARITY_CATEGORIES,
  SIMILARITY_METHOD,
  HUB_DEGREE_THRESHOLD,
} from '../../services/pil/similarity-engine';

const OUT_DIR = join(process.cwd(), '..', 'audit', 'phase8c');
const writeJson = (name: string, data: unknown) =>
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');

const PER_CATEGORY_NODE_CAP = 3000; // bound the batch per category (honest: reported as scanned/total)
const TOP_K = 10;
const MIN_SCORE = 0.05;
const EXAMPLES_PER_CATEGORY = 4;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const flagOn = isRuntimeIntelligenceActivationEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── Compute + persist in ONE pass (rebuild returns the batches it scored) ──
    const persisted = await rebuildSimilarityIndex(pool, { maxNodes: PER_CATEGORY_NODE_CAP, topK: TOP_K, minScore: MIN_SCORE });

    // Read-only index for examples (cached; rebuild already refreshed it).
    const index = await getTraversalIndex(pool);
    const adj = adjacencyFromIndex(index);
    const summary = indexSummary(index);
    const degree = (id: string) => adj.get(id)?.size ?? 0;

    const batchByCategory = new Map(persisted.batches.map((b) => [b.category, b]));

    const coverageReport: Record<string, unknown>[] = [];
    const similarityExamples: Record<string, unknown>[] = [];
    let totalScored = 0;
    let totalWithMatch = 0;
    let totalMatches = 0;
    let totalRefs = 0;
    let totalResolvedRefs = 0;
    let totalHubOnly = 0;
    let coverageSum = 0;
    let categoriesWithNodes = 0;

    for (const category of SIMILARITY_CATEGORIES) {
      const batch = batchByCategory.get(category) ?? computeCategoryMatches(index, adj, category, { maxNodes: PER_CATEGORY_NODE_CAP, topK: TOP_K, minScore: MIN_SCORE });

      totalScored += batch.nodes_scored;
      totalWithMatch += batch.nodes_with_match;
      totalMatches += batch.rows.length;
      totalRefs += batch.total_refs;
      totalResolvedRefs += batch.resolved_refs;
      totalHubOnly += batch.hub_only_rows;
      if (batch.nodes_scored > 0) { coverageSum += batch.coverage; categoriesWithNodes += 1; }

      coverageReport.push({
        category,
        nodes_total: batch.nodes_total,
        nodes_scored: batch.nodes_scored,
        nodes_with_similar: batch.nodes_with_match,
        similarity_coverage: batch.coverage,
        matches_total: batch.rows.length,
        hub_only_matches: batch.hub_only_rows,
        hub_only_rate: batch.rows.length > 0 ? Number((batch.hub_only_rows / batch.rows.length).toFixed(4)) : 0,
        explainability_coverage: batch.total_refs > 0 ? Number((batch.resolved_refs / batch.total_refs).toFixed(4)) : (batch.rows.length === 0 ? 1 : 0),
        shared_neighbor_refs: batch.total_refs,
        truncated: batch.truncated,
      });

      // Similarity Examples: richest anchors (highest degree) with their top peers + reasons.
      const anchors = (index.byCategory.get(category) ?? [])
        .slice()
        .sort((a, b) => degree(b) - degree(a) || a.localeCompare(b))
        .slice(0, EXAMPLES_PER_CATEGORY);
      const examples = anchors.map((anchorId) => {
        const r = resolveSimilar(index, adj, anchorId, { limit: 3, minScore: MIN_SCORE });
        return {
          anchor: anchorId,
          anchor_label: index.byId.get(anchorId)?.label,
          matches: (r?.matches ?? []).map((m) => ({
            id: m.id, label: m.label, score: m.score, shared_count: m.shared_count, hub_only: m.hub_only,
            shared_neighbors: m.shared_neighbors.slice(0, 4).map((s) => ({ id: s.id, label: s.label, category: s.category, degree: s.degree, is_hub: s.is_hub })),
          })),
        };
      }).filter((e) => e.matches.length > 0);
      similarityExamples.push({ category, examples });
    }

    // A concrete "recommendations-like-this" example for the richest recommendation.
    const recAnchor = (index.byCategory.get('recommendation') ?? [])
      .slice().sort((a, b) => degree(b) - degree(a) || a.localeCompare(b))[0];
    const recLikeThis = recAnchor ? resolveRecommendationsLikeThis(index, adj, recAnchor, { limit: 5, minScore: MIN_SCORE }) : null;

    // ── Aggregate validations ──
    const similarityCoverage = categoriesWithNodes > 0 ? coverageSum / categoriesWithNodes : 0; // mean across categories
    // Explainability = fraction of surfaced shared-neighbour refs that resolve to a real,
    // labelled graph node (integrity → no broken/opaque reasons). 1.0 when there are matches
    // and all refs resolve; 1.0 vacuously when a category produced no matches.
    const explainabilityCoverage = totalRefs > 0 ? totalResolvedRefs / totalRefs : 1;
    const falseMatchRate = totalMatches > 0 ? totalHubOnly / totalMatches : 0;
    const readinessScore = Number((0.4 * similarityCoverage + 0.4 * explainabilityCoverage + 0.2 * (1 - falseMatchRate)).toFixed(4));

    const validations = {
      similarity_coverage: Number(similarityCoverage.toFixed(4)),
      similarity_coverage_basis: 'mean of per-category (nodes_with_similar / nodes_scored)',
      explainability_coverage: Number(explainabilityCoverage.toFixed(4)),
      explainability_basis: 'shared-neighbour refs resolving to a real labelled node / total refs surfaced',
      shared_neighbor_refs_total: totalRefs,
      shared_neighbor_refs_resolved: totalResolvedRefs,
      false_match_rate: Number(falseMatchRate.toFixed(4)),
      hub_only_matches: totalHubOnly,
      total_matches: totalMatches,
      hub_degree_threshold: HUB_DEGREE_THRESHOLD,
    };
    const readiness = {
      similarity_coverage: validations.similarity_coverage,
      explainability_coverage: validations.explainability_coverage,
      false_match_rate: validations.false_match_rate,
      similarity_readiness_score: readinessScore,
      formula: '0.4*similarity_coverage + 0.4*explainability_coverage + 0.2*(1 - false_match_rate)',
    };

    writeJson('index_summary.json', summary);
    writeJson('coverage_report.json', {
      generated_at: new Date().toISOString(),
      categories: coverageReport,
      totals: { nodes_scored: totalScored, nodes_with_similar: totalWithMatch, matches_total: totalMatches },
    });
    writeJson('similarity_examples.json', {
      generated_at: new Date().toISOString(),
      by_category: similarityExamples,
      recommendations_like_this: { anchor: recAnchor, anchor_label: recAnchor ? index.byId.get(recAnchor)?.label : null, result: recLikeThis },
    });
    writeJson('false_match_review.json', {
      generated_at: new Date().toISOString(),
      method: SIMILARITY_METHOD,
      hub_degree_threshold: HUB_DEGREE_THRESHOLD,
      rule: 'a match whose shared neighbours are ALL hubs (degree ≥ threshold) is flagged for review (weak/coincidental) — flagged, never deleted',
      false_match_rate: validations.false_match_rate,
      hub_only_matches: totalHubOnly,
      total_matches: totalMatches,
      per_category: coverageReport.map((c: any) => ({ category: c.category, hub_only_matches: c.hub_only_matches, hub_only_rate: c.hub_only_rate })),
    });
    writeJson('validations.json', validations);
    writeJson('persisted_index.json', { method: SIMILARITY_METHOD, ...persisted });
    writeJson('readiness.json', readiness);

    const out = {
      generated_at: new Date().toISOString(),
      flag_on: flagOn,
      graph: { node_count: summary.node_count, edge_count: summary.edge_count },
      detect_categories: [...SIMILARITY_CATEGORIES],
      similarity_coverage: validations.similarity_coverage,
      explainability_coverage: validations.explainability_coverage,
      false_match_rate: validations.false_match_rate,
      similarity_index_rows_written: persisted.total_written,
      similarity_readiness_score: readinessScore,
      graph_structure_untouched: true,
    };
    writeJson('summary.json', out);

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const md = [
      '# CAPADEX PIL — Phase 8C: Similarity Intelligence Readiness',
      '',
      `Generated: ${out.generated_at}`,
      `Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ${flagOn ? 'ON' : 'OFF'}`,
      '',
      '## Canonical graph (read-only)',
      `- Nodes: ${summary.node_count.toLocaleString()}`,
      `- Edges: ${summary.edge_count.toLocaleString()}`,
      `- Graph structure untouched: yes (only the derived pil_kg_similarity_index is written)`,
      '',
      '## Detect categories',
      ...coverageReport.map((c: any) =>
        `- **${c.category}** — ${c.nodes_with_similar}/${c.nodes_scored} have a similar peer (${pct(c.similarity_coverage)})` +
        `${c.truncated ? ` *(scanned ${c.nodes_scored}/${c.nodes_total})*` : ''}; ` +
        `${c.matches_total} matches, explainable ${pct(c.explainability_coverage)}, hub-only ${pct(c.hub_only_rate)}`),
      '',
      '## Validations',
      `- Similarity Coverage (mean across categories): **${pct(validations.similarity_coverage)}**`,
      `- Explainability Coverage: **${pct(validations.explainability_coverage)}**`,
      `- False Match Review — hub-only rate: **${pct(validations.false_match_rate)}** (${totalHubOnly}/${totalMatches} matches, degree ≥ ${HUB_DEGREE_THRESHOLD})`,
      '',
      `## Persisted index`,
      `- Method: \`${SIMILARITY_METHOD}\` · rows written: **${persisted.total_written.toLocaleString()}**`,
      ...Object.entries(persisted.per_category).map(([k, v]) => `  - ${k}: ${v}`),
      '',
      `## Similarity Readiness Score: **${pct(readinessScore)}**`,
      `(${readiness.formula})`,
      '',
    ].join('\n');
    writeFileSync(join(OUT_DIR, 'SIMILARITY_READINESS.md'), md + '\n', 'utf8');

    console.log('Phase 8C — Similarity Intelligence audit complete:');
    console.log(JSON.stringify(out, null, 2));
    console.log('Artifacts → audit/phase8c/');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * WC-1B-R in-process deterministic evidence for the shared grounding service.
 * Runs in ONE process (no cross-process nondeterminism): dumps, per probe tag,
 * the grounded summary (Phase 3 envelope source), the rank tokens the Phase 4
 * nudge appends to conceptStems, and the capped seed defs the Phase 2 gap-fill
 * contributes. Also emits ontology-health rollups. Read-only; never mutates.
 * Usage: npx tsx scripts/wc1b-r/grounding-stats.ts
 * Writes audit/wc1b-r/grounding_stats.json
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  groundedSummary, loadGroundedRankTokens, loadGroundedSeedDefs, loadGroundedLineage,
  resolveBridgeTagForConcernId, GROUNDED_SEED_CAP,
} from '../../services/signal-grounding-runtime';

const PROBE = [
  { concern_id: 'CONCERN_COM_1718', tag: 'ANALYTICAL_DEVELOPMENT' },
  { concern_id: 'CONCERN_SEL_1618', tag: 'GROWTH_TRACKING' },
  { concern_id: 'CONCERN_ACA_1086', tag: 'LEADERSHIP_OWNERSHIP' },
  { concern_id: 'CONCERN_EMP_17', tag: 'EXAMINATION_STRESS' },
  { concern_id: 'CONCERN_CAR_6', tag: 'EMPLOYABILITY' },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const out: any = { generated_at: new Date().toISOString(), grounded_seed_cap: GROUNDED_SEED_CAP, tags: [], ontology_health: {}, unknown_tag_check: {} };
  try {
    for (const p of PROBE) {
      const resolvedTag = await resolveBridgeTagForConcernId(pool, p.concern_id);
      const summary = await groundedSummary(pool, p.tag);
      const rankTokens = await loadGroundedRankTokens(pool, p.tag, 8);
      const seedDefs = await loadGroundedSeedDefs(pool, p.tag, GROUNDED_SEED_CAP);
      const lineage = await loadGroundedLineage(pool, p.tag);
      out.tags.push({
        concern_id: p.concern_id,
        tag: p.tag,
        resolved_tag_from_concern_id: resolvedTag,
        resolver_consistent: resolvedTag === p.tag,
        summary,
        rank_tokens: rankTokens,
        rank_token_count: rankTokens.length,
        seed_def_count: seedDefs.length,
        seed_defs_sample: seedDefs.slice(0, 5).map((d: any) => ({ signal_key: d.signal_key, confidence: d.confidence })),
        seed_conf_min: seedDefs.length ? Math.min(...seedDefs.map((d: any) => d.confidence)) : null,
        seed_conf_max: seedDefs.length ? Math.max(...seedDefs.map((d: any) => d.confidence)) : null,
        lineage_family_count: Array.isArray(lineage?.families) ? lineage.families.length : null,
        lineage_signal_count: Array.isArray(lineage?.signals) ? lineage.signals.length : null,
      });
    }

    // Unknown-tag contract: loader returns empty/ungrounded for a non-grounded tag.
    const fakeTag = '__NOT_A_REAL_TAG__';
    out.unknown_tag_check = {
      tag: fakeTag,
      summary: await groundedSummary(pool, fakeTag),
      rank_tokens: await loadGroundedRankTokens(pool, fakeTag, 8),
      seed_defs: (await loadGroundedSeedDefs(pool, fakeTag, GROUNDED_SEED_CAP)).length,
    };

    // Ontology health rollups (read-only).
    const q = async (sql: string) => (await pool.query(sql)).rows;
    const [tags] = await q(`SELECT COUNT(DISTINCT bridge_tag)::int n FROM capadex_bridge_tag_signal_grounding`);
    const [rows] = await q(`SELECT COUNT(*)::int n FROM capadex_bridge_tag_signal_grounding`);
    const [fam] = await q(`SELECT COUNT(*)::int n FROM capadex_bridge_tag_family_grounding`);
    const [masterTotal] = await q(`SELECT COUNT(DISTINCT relational_bridge_tag)::int n FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL`);
    const [concernsOnGrounded] = await q(`SELECT COUNT(*)::int n FROM capadex_concerns_master m WHERE m.relational_bridge_tag IN (SELECT DISTINCT bridge_tag FROM capadex_bridge_tag_signal_grounding)`);
    const [prov] = await q(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE provenance='wc1a_green')::int green FROM capadex_bridge_tag_signal_grounding`);
    const perTag = await q(`SELECT bridge_tag, COUNT(*)::int sig, ROUND(AVG(similarity)::numeric,4)::float mean_sim FROM capadex_bridge_tag_signal_grounding GROUP BY bridge_tag`);
    const sigCounts = perTag.map((r: any) => r.sig).sort((a: number, b: number) => a - b);
    out.ontology_health = {
      grounded_tags: tags.n,
      total_grounding_rows: rows.n,
      family_grounding_rows: fam.n,
      master_distinct_tags: masterTotal.n,
      grounded_tag_coverage_pct: Number(((tags.n / masterTotal.n) * 100).toFixed(1)),
      master_concerns_on_grounded_tag: concernsOnGrounded.n,
      provenance_total: prov.n,
      provenance_wc1a_green: prov.green,
      atomic_signals_per_tag: {
        min: sigCounts[0], max: sigCounts[sigCounts.length - 1],
        avg: Number((sigCounts.reduce((a: number, b: number) => a + b, 0) / sigCounts.length).toFixed(1)),
        median: sigCounts[Math.floor(sigCounts.length / 2)],
      },
      seed_cap: GROUNDED_SEED_CAP,
    };
  } finally {
    mkdirSync('audit/wc1b-r', { recursive: true });
    writeFileSync('audit/wc1b-r/grounding_stats.json', JSON.stringify(out, null, 2));
    console.log('[grounding-stats] ->', 'audit/wc1b-r/grounding_stats.json');
    for (const t of out.tags) {
      console.log(`  ${t.tag} resolverOK=${t.resolver_consistent} grounded=${t.summary?.grounded} gsig=${t.summary?.grounded_signal_count} ` +
        `meanSim=${t.summary?.mean_similarity} rankTok=${t.rank_token_count} seedDefs=${t.seed_def_count} ` +
        `seedConf=[${t.seed_conf_min},${t.seed_conf_max}] lineage(f/s)=${t.lineage_family_count}/${t.lineage_signal_count}`);
    }
    console.log('  unknown-tag:', JSON.stringify(out.unknown_tag_check.summary), 'rankTok', out.unknown_tag_check.rank_tokens.length, 'seedDefs', out.unknown_tag_check.seed_defs);
    console.log('  ontology_health:', JSON.stringify(out.ontology_health));
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

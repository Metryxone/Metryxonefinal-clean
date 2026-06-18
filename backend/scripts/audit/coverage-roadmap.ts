/**
 * CAPADEX Phase 2 — Bridge-Tag Coverage Roadmap generator (read-only).
 *
 * Drives the shared `buildCoverageData()` (services/coverage-registry-service.ts)
 * against the live DB and writes the Phase-2 deliverables to audit/phase2/:
 *   • coverage_registry.csv  — every bridge tag (covered + uncovered)
 *   • coverage_roadmap.csv   — uncovered tags, recovery profile, tiered
 *   • coverage_summary.json  — aggregate stats
 *   • COVERAGE_ROADMAP.md    — human-readable blueprint
 *
 * Run:  npx tsx backend/scripts/audit/coverage-roadmap.ts
 *
 * NO writes to the DB. This only reads + emits files.
 */
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCoverageData } from '../../services/coverage-registry-service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../../audit/phase2');

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: Array<Array<unknown>>): string {
  return [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const data = await buildCoverageData(pool);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 1. registry CSV
    const registryCsv = toCsv(
      ['bridge_tag', 'coverage_status', 'question_count', 'concern_count', 'runtime_remap_target', 'runtime_route', 'in_covered_set'],
      data.registry.map((r) => [
        r.bridge_tag, r.coverage_status, r.question_count, r.concern_count,
        r.runtime_remap_target, r.runtime_route, r.in_covered_set,
      ]),
    );
    fs.writeFileSync(path.join(OUT_DIR, 'coverage_registry.csv'), registryCsv);

    // 2. roadmap CSV
    const roadmapCsv = toCsv(
      ['tier', 'bridge_tag', 'concern_count', 'cluster_count', 'remap_target', 'remap_route',
        'modal_persona', 'modal_cluster', 'domains', 'root_cause_categories', 'behavioral_intent',
        'estimated_question_inventory', 'sample_concerns'],
      data.roadmap.map((r) => [
        r.tier, r.bridge_tag, r.concern_count, r.cluster_count, r.remap_target, r.remap_route,
        r.hypothesis_profile.modal_persona, r.hypothesis_profile.modal_cluster,
        r.hypothesis_profile.domains.join(' | '),
        r.root_cause_categories.join(' | '), r.behavioral_intent,
        r.estimated_question_inventory, r.sample_concerns.join(' | '),
      ]),
    );
    fs.writeFileSync(path.join(OUT_DIR, 'coverage_roadmap.csv'), roadmapCsv);

    // 3. summary JSON
    fs.writeFileSync(path.join(OUT_DIR, 'coverage_summary.json'), JSON.stringify(data.stats, null, 2));

    // 4. blueprint MD
    const s = data.stats;
    const tierRows = (tier: 1 | 2 | 3) => data.roadmap.filter((r) => r.tier === tier);
    const md: string[] = [];
    md.push('# CAPADEX Phase 2 — Bridge-Tag Coverage Roadmap');
    md.push('');
    md.push(`_Generated ${s.generated_at} (read-only; no DB writes, no bulk question generation)._`);
    md.push('');
    md.push('## Summary');
    md.push('');
    md.push('| Metric | Value |');
    md.push('| --- | --- |');
    md.push(`| Total bridge tags (master ∪ clarity) | ${s.total_bridge_tags} |`);
    md.push(`| Covered (have curated clarity questions) | ${s.covered_tags} |`);
    md.push(`| Uncovered (remapped to siblings) | ${s.uncovered_tags} |`);
    md.push(`| **Still routing to GENERAL_CONCERN** | **${s.general_concern_dependent_tags}** |`);
    md.push(`| Existing curated questions | ${s.total_questions_existing.toLocaleString()} |`);
    md.push(`| Estimated questions to author for full coverage | ${s.estimated_questions_required.toLocaleString()} |`);
    md.push(`| Canonical covered set size | ${s.covered_set_size} |`);
    md.push('');
    md.push('### Uncovered routing breakdown');
    md.push('');
    md.push('| Route | Tags |');
    md.push('| --- | --- |');
    md.push(`| Sibling (override) | ${s.remap_routes.override} |`);
    md.push(`| Sibling (keyword) | ${s.remap_routes.keyword} |`);
    md.push(`| GENERAL_CONCERN catch-all | ${s.remap_routes.general} |`);
    md.push(`| Unresolved | ${s.remap_routes.none} |`);
    md.push('');
    md.push('> Quality > coverage %. No bulk auto-generated questions: every uncovered tag is routed to');
    md.push('> its closest covered sibling so users get topically-relevant curated questions today, while');
    md.push('> the roadmap below estimates the curated inventory needed to make each tag first-class.');
    md.push('');

    for (const tier of [1, 2, 3] as const) {
      const rows = tierRows(tier);
      const desc = tier === 1
        ? 'Still falls back to GENERAL_CONCERN — author curated questions first.'
        : tier === 2
          ? 'Sibling remap with real volume (≥2 concerns).'
          : 'Low-volume sibling remap (1 concern).';
      md.push(`## Tier ${tier} — ${rows.length} tags`);
      md.push('');
      md.push(`_${desc}_`);
      md.push('');
      if (rows.length === 0) { md.push('_None._'); md.push(''); continue; }
      md.push('| Bridge tag | Concerns | Remap → | Route | Persona | Domains | Root causes | Est. Q |');
      md.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
      for (const r of rows) {
        md.push(`| \`${r.bridge_tag}\` | ${r.concern_count} | \`${r.remap_target || '—'}\` | ${r.remap_route} | ${r.hypothesis_profile.modal_persona || '—'} | ${r.hypothesis_profile.domains.slice(0, 2).join(', ') || '—'} | ${r.root_cause_categories.slice(0, 2).join(', ') || '—'} | ${r.estimated_question_inventory} |`);
      }
      md.push('');
    }
    fs.writeFileSync(path.join(OUT_DIR, 'COVERAGE_ROADMAP.md'), md.join('\n'));

    // Console verification
    console.log('✅ Phase 2 coverage roadmap written to audit/phase2/');
    console.log(`   total_bridge_tags            : ${s.total_bridge_tags}`);
    console.log(`   covered_tags                 : ${s.covered_tags}`);
    console.log(`   uncovered_tags               : ${s.uncovered_tags}`);
    console.log(`   route=override               : ${s.remap_routes.override}`);
    console.log(`   route=keyword                : ${s.remap_routes.keyword}`);
    console.log(`   route=general (GENERAL_CONCERN): ${s.remap_routes.general}`);
    console.log(`   route=none (unresolved)      : ${s.remap_routes.none}`);
    console.log(`   GENERAL_CONCERN-dependent    : ${s.general_concern_dependent_tags}  (target: ~0)`);
    console.log(`   estimated questions required : ${s.estimated_questions_required}`);
    console.log(`   tier counts                  : T1=${s.tier_counts[1]} T2=${s.tier_counts[2]} T3=${s.tier_counts[3]}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

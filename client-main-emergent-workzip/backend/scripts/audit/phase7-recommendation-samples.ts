/**
 * CAPADEX Phase 7 — generate the 6 review deliverables (read-only, composes only).
 *   1-4: example Career / Learning / Project / Development recommendations (print-ready,
 *        each shown per stakeholder where helpful) for the anchor session.
 *   5:   explainability coverage summary (overall + per-category + lineage).
 *   6:   recommendation readiness score summary.
 *
 * Run (flags must be ON):
 *   FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 FF_RUNTIME_INTELLIGENCE_PIPELINE=1 \
 *     npx tsx backend/scripts/audit/phase7-recommendation-samples.ts
 *
 * Writes to audit/phase7/ and prints a summary. NO writes to DB.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSessionRecommendations,
  buildInstitutionRecommendations,
  type SessionRecommendations,
  type InstitutionRecommendations,
} from '../../services/pil/recommendation-builder';
import type { RecCategory, RecStakeholder } from '../../services/pil/recommendation-catalog';

const SAMPLE_SESSION = '1cd9ca07-4659-42c4-83fd-229e5e8f21f2';
const COHORT = [
  '1cd9ca07-4659-42c4-83fd-229e5e8f21f2',
  '11111111-1111-1111-1111-111111111111',
  'a0924499-24bf-43be-adbe-1c6f00a5dd9e',
  'd0f54fc4-7a08-4747-9ccb-422e86cc93b9',
  '4c9b6c0b-4907-48e3-8c56-95a65e623006',
  '4349237c-ce0b-41c5-9206-647c2654b26e',
];

type AnyRec = SessionRecommendations | InstitutionRecommendations;

function categoryBlock(rec: AnyRec, category: RecCategory): string {
  const cat = rec.categories.find((c) => c.category === category);
  const header = `### ${category.toUpperCase()} — ${'stakeholder' in rec ? rec.stakeholder : 'cohort'}`;
  if (!cat || (!cat.items.length && cat.note)) return `${header}\n  (none) ${cat?.note ?? ''}`;
  const lines = cat!.items.map((i) => {
    const trace = i.trace.map((t) => t.label).join('  ›  ');
    return [
      `  • [${i.sub_type}] ${i.title}`,
      `      ${i.description}`,
      `      anchor construct: ${i.anchor_construct} (${i.source})  ·  traced: ${i.traced ? 'YES' : 'no'}  ·  chain complete: ${i.chain_complete ? 'YES' : 'no'}`,
      `      trace: ${trace}`,
    ].join('\n');
  });
  return `${header}\n${lines.join('\n')}`;
}

function coverageBlock(rec: AnyRec): string {
  const e = rec.explainability;
  return [
    `Overall coverage: ${(e.coverage * 100).toFixed(1)}%  (${e.traced_recommendations}/${e.total_recommendations} recommendations)`,
    `Fully traceable: ${e.fully_traceable ? 'YES' : 'no'}  ·  chain-complete recs: ${e.chain_complete_count}  ·  unresolved lineage hops: ${e.unresolved_hops}`,
    '',
    'By category:',
    ...e.by_category.map((c) => `  • ${c.category}: ${(c.coverage * 100).toFixed(0)}%  (${c.traced}/${c.total})`),
    '',
    'Lineage (Concern → … → Intervention):',
    ...e.lineage.map((h) => `  ${h.resolved ? '✓' : '·'} ${h.label}${h.resolved ? '' : '  (unresolved)'}`),
  ].join('\n');
}

function readinessBlock(rec: AnyRec): string {
  const k = rec.readiness;
  return [
    `Score: ${k.score}/100  ·  band: ${k.band}`,
    `  explainability:     ${(k.components.explainability * 100).toFixed(0)}%  (weight 40%)`,
    `  category coverage:  ${(k.components.category_coverage * 100).toFixed(0)}%  (weight 30%)`,
    `  data completeness:  ${(k.components.data_completeness * 100).toFixed(0)}%  (weight 20%)`,
    `  specificity:        ${(k.components.specificity * 100).toFixed(0)}%  (weight 10%)`,
    `  → ${k.note}`,
  ].join('\n');
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const outDir = join(process.cwd(), '..', 'audit', 'phase7');
  mkdirSync(outDir, { recursive: true });

  const STAKEHOLDERS: Exclude<RecStakeholder, 'institution'>[] = ['student', 'parent', 'counselor'];
  const perStakeholder: Record<string, SessionRecommendations> = {};
  for (const s of STAKEHOLDERS) perStakeholder[s] = await buildSessionRecommendations(pool, SAMPLE_SESSION, s);
  const institution = await buildInstitutionRecommendations(pool, COHORT);

  const all: AnyRec[] = [...STAKEHOLDERS.map((s) => perStakeholder[s]), institution];
  const CATEGORIES: RecCategory[] = ['career', 'learning', 'project', 'development'];

  // 1-4 — one file per category, showing every stakeholder + the cohort lens.
  CATEGORIES.forEach((category, idx) => {
    const body = all.map((r) => categoryBlock(r, category)).join('\n\n');
    const intro = `${category.toUpperCase()} RECOMMENDATIONS — anchor session ${SAMPLE_SESSION}\n${'='.repeat(60)}\n`;
    writeFileSync(join(outDir, `${idx + 1}_${category}_recommendations.txt`), intro + body);
  });

  // 5 — explainability coverage
  const coverage = all.map((r) => {
    const name = 'stakeholder' in r ? r.stakeholder : 'cohort';
    return `### ${String(name).toUpperCase()}\n${coverageBlock(r)}`;
  }).join('\n\n');
  writeFileSync(join(outDir, '5_explainability_coverage.txt'), coverage);

  // 6 — readiness score
  const readiness = all.map((r) => {
    const name = 'stakeholder' in r ? r.stakeholder : 'cohort';
    return `### ${String(name).toUpperCase()}\n${readinessBlock(r)}`;
  }).join('\n\n');
  writeFileSync(join(outDir, '6_recommendation_readiness.txt'), readiness);

  // machine-readable api shapes
  writeFileSync(join(outDir, 'recommendations.api.json'), JSON.stringify({
    student: perStakeholder.student.exports.api_ready,
    parent: perStakeholder.parent.exports.api_ready,
    counselor: perStakeholder.counselor.exports.api_ready,
    institution: institution.exports.api_ready,
  }, null, 2));

  console.log('Phase 7 deliverables written to audit/phase7/\n');
  console.log('========== 5. EXPLAINABILITY COVERAGE ==========\n');
  console.log(coverage);
  console.log('\n========== 6. RECOMMENDATION READINESS SCORE ==========\n');
  console.log(readiness);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * CAPADEX Phase 6C — generate the 6 review deliverables (read-only).
 *   1-4: example Student / Parent / Counselor / Institution reports (print-ready)
 *   5:   explainability coverage summary
 *   6:   report readiness score summary
 *
 * Run (flags must be ON):
 *   FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 FF_RUNTIME_INTELLIGENCE_PIPELINE=1 \
 *     npx tsx backend/scripts/audit/phase6c-report-samples.ts
 *
 * Writes to audit/phase6c/ and prints a summary. Composes only — no writes to DB.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildStakeholderReport,
  buildInstitutionReport,
  type StakeholderReport,
  type InstitutionReport,
} from '../../services/pil/report-builder';

const SAMPLE_SESSION = '1cd9ca07-4659-42c4-83fd-229e5e8f21f2';
const COHORT = [
  '1cd9ca07-4659-42c4-83fd-229e5e8f21f2',
  '11111111-1111-1111-1111-111111111111',
  'a0924499-24bf-43be-adbe-1c6f00a5dd9e',
  'd0f54fc4-7a08-4747-9ccb-422e86cc93b9',
  '4c9b6c0b-4907-48e3-8c56-95a65e623006',
  '4349237c-ce0b-41c5-9206-647c2654b26e',
];

function coverageBlock(r: StakeholderReport | InstitutionReport): string {
  const e = r.explainability;
  const lines = [
    `Overall coverage: ${(e.coverage * 100).toFixed(1)}%  (${e.traced_statements}/${e.total_statements} statements)`,
    `Fully traceable: ${e.fully_traceable ? 'YES' : 'no'}`,
    '',
    'By section:',
    ...e.by_section.map((s) => `  • ${s.title}: ${(s.coverage * 100).toFixed(0)}%  (${s.traced}/${s.statements})`),
    '',
    'Lineage (Response → … → Intervention):',
    ...e.lineage.map((h) => `  ${h.resolved ? '✓' : '·'} ${h.label}${h.resolved ? '' : '  (unresolved)'}`),
  ];
  return lines.join('\n');
}

function readinessBlock(r: StakeholderReport | InstitutionReport): string {
  const k = r.readiness;
  return [
    `Score: ${k.score}/100  ·  band: ${k.band}`,
    `  explainability:          ${(k.components.explainability * 100).toFixed(0)}%  (weight 40%)`,
    `  section fill:            ${(k.components.section_fill * 100).toFixed(0)}%  (weight 30%)`,
    `  data completeness:       ${(k.components.data_completeness * 100).toFixed(0)}%  (weight 20%)`,
    `  stakeholder specificity: ${(k.components.stakeholder_specificity * 100).toFixed(0)}%  (weight 10%)`,
    `  → ${k.note}`,
  ].join('\n');
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const outDir = join(process.cwd(), '..', 'audit', 'phase6c');
  mkdirSync(outDir, { recursive: true });

  const student = await buildStakeholderReport(pool, SAMPLE_SESSION, 'student');
  const parent = await buildStakeholderReport(pool, SAMPLE_SESSION, 'parent');
  const counselor = await buildStakeholderReport(pool, SAMPLE_SESSION, 'counselor');
  const institution = await buildInstitutionReport(pool, COHORT);

  const all = [student, parent, counselor, institution];

  // 1-4 — example reports (print-ready)
  writeFileSync(join(outDir, '1_student_report.txt'), student.exports.print_ready);
  writeFileSync(join(outDir, '2_parent_report.txt'), parent.exports.print_ready);
  writeFileSync(join(outDir, '3_counselor_report.txt'), counselor.exports.print_ready);
  writeFileSync(join(outDir, '4_institution_report.txt'), institution.exports.print_ready);

  // 5 — explainability coverage
  const coverage = all.map((r) => {
    const name = 'report_type' in r ? r.report_type : 'report';
    return `### ${name.toUpperCase()}\n${coverageBlock(r)}`;
  }).join('\n\n');
  writeFileSync(join(outDir, '5_explainability_coverage.txt'), coverage);

  // 6 — readiness score
  const readiness = all.map((r) => {
    const name = 'report_type' in r ? r.report_type : 'report';
    return `### ${name.toUpperCase()}\n${readinessBlock(r)}`;
  }).join('\n\n');
  writeFileSync(join(outDir, '6_report_readiness.txt'), readiness);

  // also persist machine-readable api shapes for inspection
  writeFileSync(join(outDir, 'reports.api.json'), JSON.stringify({
    student: student.exports.api_ready,
    parent: parent.exports.api_ready,
    counselor: counselor.exports.api_ready,
    institution: institution.exports.api_ready,
  }, null, 2));

  console.log('Phase 6C deliverables written to audit/phase6c/\n');
  console.log('========== 5. EXPLAINABILITY COVERAGE ==========\n');
  console.log(coverage);
  console.log('\n========== 6. REPORT READINESS SCORE ==========\n');
  console.log(readiness);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

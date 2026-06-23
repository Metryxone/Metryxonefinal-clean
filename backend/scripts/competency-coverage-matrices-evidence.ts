/**
 * Evidence — MX-100X Phase 3 Competency Coverage Matrices (READ-ONLY).
 *
 * Reproducible measurement of the three coverage matrices (competency / assessment / benchmark)
 * against the live DB, broken down by TYPE and by DOMAIN, plus the truthful assessment-ready count.
 * Writes an audit markdown to backend/audit/mx100x-p3/.
 *
 *   npx tsx scripts/competency-coverage-matrices-evidence.ts
 *
 * Honesty: measures only (never writes). Coverage (data exists) and readiness/k-anonymity are
 * reported on SEPARATE axes. Sparse/empty cells (e.g. future_skills = 0) and authoring gaps are
 * honest, never fabricated. The assessment BANK namespace is reported separately, never force-joined.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  COMPETENCY_COVERAGE_MATRICES_VERSION,
  getCompetencyCoverageMatrix,
  getAssessmentCoverageMatrix,
  getBenchmarkCoverageMatrix,
  getCoverageMatricesOverview,
} from '../services/competency-coverage-matrices-engine';

function fmtPct(p: number | null | undefined): string {
  return p == null ? '—' : `${p}%`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];
  const log = (s = '') => { console.log(s); lines.push(s); };
  try {
    const generatedAt = new Date().toISOString();
    log(`# MX-100X Phase 3 — Competency Coverage Matrices Evidence`);
    log('');
    log(`- Engine version: \`${COMPETENCY_COVERAGE_MATRICES_VERSION}\``);
    log(`- Generated: ${generatedAt}`);
    log(`- Honesty: read-only. Coverage (data exists) and readiness/k-anonymity are SEPARATE axes. Sparse/empty cells and authoring gaps are honest, never fabricated. Genome ids are \`onto_*\` TEXT (no coercion). The assessment BANK (\`competency_question_templates.competency_code\`) is a DISJOINT namespace — reported separately, never force-joined to the 5-type axis.`);
    log('');

    // --- 1. Competency coverage ---
    const comp = await getCompetencyCoverageMatrix(pool);
    log(`## 1. Competency coverage`);
    log('');
    log(`Total competencies: **${comp.total_competencies ?? '—'}** · classified: **${comp.classified ?? '—'}** · coverage: **${fmtPct(comp.coverage_pct)}**`);
    log('');
    log(`### By type`);
    log('');
    log(`| Type | Count | % of genome |`);
    log(`| --- | --- | --- |`);
    for (const t of comp.by_type ?? []) log(`| ${t.label} | ${t.count} | ${fmtPct(t.pct)} |`);
    log('');
    log(`### By domain`);
    log('');
    log(`| Domain | Count | % of genome |`);
    log(`| --- | --- | --- |`);
    for (const d of comp.by_domain ?? []) log(`| ${d.name} | ${d.count} | ${fmtPct(d.pct)} |`);
    log('');

    // --- 2. Assessment coverage ---
    const asmt = await getAssessmentCoverageMatrix(pool);
    log(`## 2. Assessment coverage (genome bridge)`);
    log('');
    log(`Genome total: **${asmt.genome_total ?? '—'}** · with ≥1 approved question: **${asmt.competencies_with_any_approved ?? '—'}** (${fmtPct(asmt.coverage_pct_any)}) · assessment-ready (≥${asmt.threshold_min_questions} approved): **${asmt.competencies_assessment_ready ?? '—'}** (${fmtPct(asmt.coverage_pct_ready)})`);
    log('');
    log(`### Approved-question distribution`);
    log('');
    log(`| At least N approved | Competencies |`);
    log(`| --- | --- |`);
    for (const d of asmt.question_count_distribution ?? []) log(`| ≥${d.at_least} | ${d.competencies} |`);
    log('');
    log(`### By type (with ≥1 approved Q / total)`);
    log('');
    log(`| Type | With approved Q | Total | Coverage | Assessment-ready |`);
    log(`| --- | --- | --- | --- | --- |`);
    for (const t of asmt.by_type ?? []) log(`| ${t.label} | ${t.with_any_approved} | ${t.total ?? '—'} | ${fmtPct(t.coverage_pct)} | ${t.assessment_ready} |`);
    log('');
    log(`### By domain (with ≥1 approved Q / total)`);
    log('');
    log(`| Domain | With approved Q | Total | Coverage | Assessment-ready |`);
    log(`| --- | --- | --- | --- | --- |`);
    for (const d of asmt.by_domain ?? []) log(`| ${d.name} | ${d.with_any_approved} | ${d.total ?? '—'} | ${fmtPct(d.coverage_pct)} | ${d.assessment_ready} |`);
    log('');
    log(`### Linked competencies (≥1 approved Q; ✓ = assessment-ready at ≥${asmt.threshold_min_questions})`);
    log('');
    log(`| Competency | Type | Domain | Approved Q |`);
    log(`| --- | --- | --- | --- |`);
    for (const r of asmt.ready_list ?? []) log(`| ${r.canonical_name ?? r.competency_id} | ${r.type_key ?? '—'} | ${r.domain_id ?? '—'} | ${r.approved_questions} |`);
    log('');
    log(`### Bank context (DISJOINT namespace — not joined to genome)`);
    log('');
    log(`- Distinct bank codes: **${asmt.bank_context?.distinct_bank_codes ?? '—'}** · total templates: **${asmt.bank_context?.total_templates ?? '—'}**`);
    for (const s of asmt.bank_context?.by_status ?? []) log(`  - ${s.status}: ${s.count}`);
    log(`- ${asmt.bank_context?.note ?? ''}`);
    log('');

    // --- 3. Benchmark coverage ---
    const bench = await getBenchmarkCoverageMatrix(pool);
    log(`## 3. Benchmark coverage (k_min=${bench.k_min})`);
    log('');
    log(`Genome total: **${bench.genome_total ?? '—'}** · with a k-cleared benchmark: **${bench.competencies_benchmark_ready ?? '—'}** (${fmtPct(bench.coverage_pct)}) · benchmark rows: ${bench.total_benchmark_rows ?? '—'} across ${bench.distinct_cohorts ?? '—'} cohorts · suppressed below k: ${bench.competencies_suppressed_below_k ?? '—'} · orphan ids: ${bench.orphan_competency_ids?.length ?? '—'}`);
    log('');
    log(`### By type (k-cleared / total)`);
    log('');
    log(`| Type | Benchmarked | Total | Coverage |`);
    log(`| --- | --- | --- | --- |`);
    for (const t of bench.by_type ?? []) log(`| ${t.label} | ${t.benchmarked} | ${t.total ?? '—'} | ${fmtPct(t.coverage_pct)} |`);
    log('');
    log(`### By domain (k-cleared / total)`);
    log('');
    log(`| Domain | Benchmarked | Total | Coverage |`);
    log(`| --- | --- | --- | --- |`);
    for (const d of bench.by_domain ?? []) log(`| ${d.name} | ${d.benchmarked} | ${d.total ?? '—'} | ${fmtPct(d.coverage_pct)} |`);
    log('');

    // --- Findings ---
    const ov = await getCoverageMatricesOverview(pool);
    log(`## Findings`);
    log('');
    for (const f of ov.findings) log(`- **[${f.severity}] ${f.area}** — ${f.finding}`);
    log('');

    const outDir = join(process.cwd(), 'audit', 'mx100x-p3');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'competency-coverage-matrices-evidence.md');
    writeFileSync(outPath, lines.join('\n'));
    console.log(`\nAudit written to ${outPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

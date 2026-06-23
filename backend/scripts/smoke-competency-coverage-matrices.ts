/**
 * Smoke test — MX-100X Phase 3 Competency Coverage Matrices.
 *
 * Service-level (read-only composition; not flag-gated at the service layer):
 *   npx tsx scripts/smoke-competency-coverage-matrices.ts
 * HTTP flag-OFF contract (live backend has FF_COMPETENCY_COVERAGE_MATRICES OFF):
 *   asserts every route 503s before auth when the flag is OFF.
 */
import { Pool } from 'pg';
import {
  ASSESSMENT_READY_MIN_QUESTIONS,
  BENCHMARK_K_MIN,
  getCompetencyCoverageMatrix,
  getAssessmentCoverageMatrix,
  getBenchmarkCoverageMatrix,
  getCoverageMatricesOverview,
} from '../services/competency-coverage-matrices-engine';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`, detail != null ? JSON.stringify(detail) : ''); }
}

function sum(map: Array<{ count: number }> | null | undefined): number {
  return (map ?? []).reduce((a, b) => a + b.count, 0);
}

async function serviceTests(pool: Pool) {
  console.log('\n== Service-level (read-only composition) ==');

  // 1. Competency coverage
  const comp = await getCompetencyCoverageMatrix(pool);
  check('competency: total_competencies > 0', (comp.total_competencies ?? 0) > 0, comp.total_competencies);
  check('competency: coverage_pct in [0,100] or null', comp.coverage_pct == null || (comp.coverage_pct >= 0 && comp.coverage_pct <= 100), comp.coverage_pct);
  check('competency: by_type has 5 canonical types', (comp.by_type?.length ?? 0) === 5, comp.by_type?.length);
  check('competency: by_type sum == classified (every classified comp in exactly one type)', comp.classified == null || sum(comp.by_type) === comp.classified, { typeSum: sum(comp.by_type), classified: comp.classified });
  check('competency: by_domain sum == total (every comp has a domain)', comp.total_competencies == null || sum(comp.by_domain) === comp.total_competencies, { domSum: sum(comp.by_domain), total: comp.total_competencies });
  check('competency: future_skills surfaced as honest 0 (not omitted)', (comp.by_type ?? []).some((t) => t.type_key === 'future_skills'), comp.by_type?.map((t) => t.type_key));

  // 2. Assessment coverage
  const asmt = await getAssessmentCoverageMatrix(pool);
  check('assessment: threshold == ASSESSMENT_READY_MIN_QUESTIONS', asmt.threshold_min_questions === ASSESSMENT_READY_MIN_QUESTIONS, asmt.threshold_min_questions);
  check('assessment: with_any_approved <= genome_total', asmt.competencies_with_any_approved == null || asmt.genome_total == null || asmt.competencies_with_any_approved <= asmt.genome_total, { any: asmt.competencies_with_any_approved, total: asmt.genome_total });
  check('assessment: ready <= with_any_approved (readiness is a subset of coverage)', (asmt.competencies_assessment_ready ?? 0) <= (asmt.competencies_with_any_approved ?? 0), { ready: asmt.competencies_assessment_ready, any: asmt.competencies_with_any_approved });
  check('assessment: distribution monotone non-increasing (≥1 ≥ ≥2 ≥ ≥3 ≥ ≥4)', (() => {
    const d = asmt.question_count_distribution ?? [];
    for (let i = 1; i < d.length; i++) if (d[i].competencies > d[i - 1].competencies) return false;
    return true;
  })(), asmt.question_count_distribution);
  check('assessment: bank_context kept SEPARATE (has disjoint-namespace note)', typeof asmt.bank_context?.note === 'string' && /DISJOINT/i.test(asmt.bank_context.note), asmt.bank_context?.note);
  check('assessment: ready_list approved_questions all >= 1', (asmt.ready_list ?? []).every((r) => r.approved_questions >= 1));

  // 3. Benchmark coverage
  const bench = await getBenchmarkCoverageMatrix(pool);
  check('benchmark: k_min == BENCHMARK_K_MIN', bench.k_min === BENCHMARK_K_MIN, bench.k_min);
  check('benchmark: ready <= with_benchmark (k-cleared is a subset)', (bench.competencies_benchmark_ready ?? 0) <= (bench.competencies_with_benchmark ?? 0), { ready: bench.competencies_benchmark_ready, any: bench.competencies_with_benchmark });
  check('benchmark: coverage_pct in [0,100] or null', bench.coverage_pct == null || (bench.coverage_pct >= 0 && bench.coverage_pct <= 100), bench.coverage_pct);
  check('benchmark: orphan ids surfaced as array or null (never silently dropped)', bench.orphan_competency_ids === null || Array.isArray(bench.orphan_competency_ids), bench.orphan_competency_ids);

  // Overview composition
  const ov = await getCoverageMatricesOverview(pool);
  check('overview: headline genome_total matches competency matrix', ov.headline.genome_total === comp.total_competencies, { headline: ov.headline.genome_total, comp: comp.total_competencies });
  check('overview: findings is an array', Array.isArray(ov.findings), ov.findings?.length);
}

async function httpTests() {
  const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
  console.log(`\n== HTTP flag-OFF contract (${base}) ==`);
  const paths = ['/overview', '/competency', '/assessment', '/benchmark', '/feature-flag', '/_meta/versions'];
  for (const p of paths) {
    try {
      const res = await fetch(`${base}/api/v2/competency-coverage-matrices${p}`);
      // Flag OFF → 503 before auth. (If foundation flag is also OFF it still 503s.)
      check(`GET ${p} → 503 when flag OFF`, res.status === 503, res.status);
    } catch (e) {
      console.log(`  SKIP  GET ${p} (backend unreachable: ${(e as Error).message})`);
    }
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await serviceTests(pool);
    await httpTests();
  } finally {
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

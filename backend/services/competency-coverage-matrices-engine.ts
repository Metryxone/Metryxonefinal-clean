/**
 * Competency Coverage Matrices engine — MX-100X Phase 3 (additive, feature-flagged, READ-ONLY).
 *
 * Composes EXISTING competency surfaces into three coverage matrices, each broken down by the
 * canonical 5-TYPE axis (`onto_competency_type_map`) and the 6-DOMAIN axis
 * (`onto_competencies.domain_id` → `onto_domains.name`):
 *
 *   1. Competency coverage — how many of the 419 genome competencies are classified into a type,
 *      by type and by domain.
 *   2. Assessment coverage — how many genome competencies have authored, APPROVED questions via the
 *      genome→question bridge `onto_competency_question_map` → `competency_question_templates`, plus a
 *      truthful assessment-ready count at a documented threshold. The assessment BANK's
 *      `competency_question_templates.competency_code` is a DISJOINT namespace from the genome — it is
 *      reported separately as context and NEVER force-joined to the 5-type axis.
 *   3. Benchmark coverage — how many genome competencies have a population benchmark in
 *      `bench_competency_benchmarks` that clears k-anonymity (n_samples >= K_MIN).
 *
 * HONESTY CONTRACT:
 *   - Coverage (data exists) and readiness/Confidence (sufficient questions / above k-anonymity) are
 *     SEPARATE axes. Sparse or empty cells (e.g. future_skills = 0) are HONEST gaps, never fabricated.
 *   - Read-only: every query uses a to_regclass probe + degrade. Missing table → null (NOT 0).
 *   - All ids here are `onto_*` TEXT — no `ont_*` INTEGER coercion anywhere in this engine.
 *   - No DDL, no writes — there is no ensure-schema and no POST path in this phase.
 */
import type { Pool } from 'pg';
import { COMPETENCY_TYPES, COMPETENCY_TYPE_CLASSIFICATION_VERSION } from './competency-type-classification';

export const COMPETENCY_COVERAGE_MATRICES_VERSION = 'mx100x-p3-1.0.0';

/** A genome competency is "assessment-ready" when it has at least this many APPROVED linked questions. */
export const ASSESSMENT_READY_MIN_QUESTIONS = 4;
/** k-anonymity floor for a population benchmark to be reportable. */
export const BENCHMARK_K_MIN = 30;

const CANONICAL_TYPE_ORDER = COMPETENCY_TYPES.map((t) => t.type_key);
const TYPE_LABELS: Record<string, string> = Object.fromEntries(COMPETENCY_TYPES.map((t) => [t.type_key, t.label]));

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
    return r.rows[0]?.reg != null;
  } catch {
    return false;
  }
}

async function safeRows<T = any>(pool: Pool, sql: string, params: unknown[] = []): Promise<T[] | null> {
  try {
    return (await pool.query(sql, params)).rows as T[];
  } catch {
    return null;
  }
}

function pct(n: number | null | undefined, d: number | null | undefined): number | null {
  if (n == null || d == null || d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type SourceTables = Record<string, boolean>;

/* ------------------------------------------------------------------ */
/* 1. Competency coverage                                              */
/* ------------------------------------------------------------------ */
export async function getCompetencyCoverageMatrix(pool: Pool) {
  const source_tables: SourceTables = {
    onto_competencies: await tableExists(pool, 'onto_competencies'),
    onto_competency_type_map: await tableExists(pool, 'onto_competency_type_map'),
    onto_domains: await tableExists(pool, 'onto_domains'),
  };

  if (!source_tables.onto_competencies) {
    return {
      source_tables,
      total_competencies: null,
      classified: null,
      unclassified: null,
      coverage_pct: null,
      by_type: null,
      by_domain: null,
      matrix: null,
      note: 'onto_competencies absent — competency coverage not measurable (null, never fabricated as 0).',
    };
  }

  const totalRows = await safeRows<{ c: string }>(pool, `SELECT COUNT(*)::text AS c FROM onto_competencies`);
  const total = totalRows ? num(totalRows[0]?.c) : null;

  const classifiedRows = source_tables.onto_competency_type_map
    ? await safeRows<{ c: string }>(pool, `SELECT COUNT(DISTINCT competency_id)::text AS c FROM onto_competency_type_map`)
    : null;
  const classified = classifiedRows ? num(classifiedRows[0]?.c) : null;

  // by type (left-fill canonical 5 types so empty types surface as honest 0)
  const typeCounts = source_tables.onto_competency_type_map
    ? await safeRows<{ type_key: string; c: string }>(
        pool,
        `SELECT type_key, COUNT(*)::text AS c FROM onto_competency_type_map GROUP BY type_key`,
      )
    : null;
  const typeMap = new Map<string, number>((typeCounts ?? []).map((r) => [r.type_key, num(r.c)]));
  const by_type = typeCounts == null
    ? null
    : CANONICAL_TYPE_ORDER.map((tk) => {
        const count = typeMap.get(tk) ?? 0;
        return { type_key: tk, label: TYPE_LABELS[tk] ?? tk, count, pct: pct(count, total) };
      });

  // by domain (left-fill from onto_domains so empty domains surface honestly)
  const domainRows = await safeRows<{ domain_id: string | null; c: string }>(
    pool,
    `SELECT domain_id, COUNT(*)::text AS c FROM onto_competencies GROUP BY domain_id`,
  );
  const domainCount = new Map<string, number>((domainRows ?? []).map((r) => [String(r.domain_id ?? '__null__'), num(r.c)]));
  const domainLabels = source_tables.onto_domains
    ? await safeRows<{ id: string; name: string; display_order: number }>(
        pool,
        `SELECT id, name, display_order FROM onto_domains ORDER BY display_order, id`,
      )
    : null;
  let by_domain: Array<{ domain_id: string; name: string; count: number; pct: number | null }> | null = null;
  if (domainRows != null) {
    const seen = new Set<string>();
    by_domain = [];
    for (const d of domainLabels ?? []) {
      const c = domainCount.get(d.id) ?? 0;
      by_domain.push({ domain_id: d.id, name: d.name, count: c, pct: pct(c, total) });
      seen.add(d.id);
    }
    // include any domain_id present on competencies but absent from onto_domains (honest, no fabrication)
    for (const [id, c] of domainCount.entries()) {
      if (id === '__null__') {
        by_domain.push({ domain_id: '(no domain)', name: '(no domain)', count: c, pct: pct(c, total) });
      } else if (!seen.has(id)) {
        by_domain.push({ domain_id: id, name: id, count: c, pct: pct(c, total) });
      }
    }
  }

  // type × domain cross matrix (only when both axes present)
  const cross = source_tables.onto_competency_type_map
    ? await safeRows<{ type_key: string; domain_id: string | null; c: string }>(
        pool,
        `SELECT m.type_key, c.domain_id, COUNT(*)::text AS c
           FROM onto_competency_type_map m
           JOIN onto_competencies c ON c.id = m.competency_id
          GROUP BY m.type_key, c.domain_id`,
      )
    : null;
  const matrix = cross == null
    ? null
    : cross.map((r) => ({ type_key: r.type_key, domain_id: r.domain_id ?? '(no domain)', count: num(r.c) }));

  return {
    source_tables,
    total_competencies: total,
    classified,
    unclassified: total != null && classified != null ? total - classified : null,
    coverage_pct: pct(classified, total),
    by_type,
    by_domain,
    matrix,
    note: 'Competency coverage = a genome competency is classified into a canonical type. Domain axis from onto_competencies.domain_id; empty types/domains are honest 0s, missing tables are null.',
  };
}

/* ------------------------------------------------------------------ */
/* 2. Assessment coverage                                             */
/* ------------------------------------------------------------------ */
export async function getAssessmentCoverageMatrix(pool: Pool) {
  const source_tables: SourceTables = {
    onto_competencies: await tableExists(pool, 'onto_competencies'),
    onto_competency_type_map: await tableExists(pool, 'onto_competency_type_map'),
    onto_competency_question_map: await tableExists(pool, 'onto_competency_question_map'),
    competency_question_templates: await tableExists(pool, 'competency_question_templates'),
  };

  const genomeTotalRows = source_tables.onto_competencies
    ? await safeRows<{ c: string }>(pool, `SELECT COUNT(*)::text AS c FROM onto_competencies`)
    : null;
  const genome_total = genomeTotalRows ? num(genomeTotalRows[0]?.c) : null;

  const bridgeReady = source_tables.onto_competency_question_map && source_tables.competency_question_templates;

  // approved authored questions per genome competency (via the bridge ONLY — the honest genome join)
  const perComp = bridgeReady
    ? await safeRows<{ competency_id: string; approved: string }>(
        pool,
        `SELECT m.competency_id, COUNT(*)::text AS approved
           FROM onto_competency_question_map m
           JOIN competency_question_templates t ON t.id = m.question_id
          WHERE m.active = true AND t.status = 'approved'
          GROUP BY m.competency_id`,
      )
    : null;

  const approvedByComp = new Map<string, number>((perComp ?? []).map((r) => [r.competency_id, num(r.approved)]));

  // ≥1/≥2/≥3/≥4 distribution (honest spread, so the single "ready" headline can't mislead)
  const thresholds = [1, 2, 3, 4];
  const question_count_distribution = perComp == null
    ? null
    : thresholds.map((t) => ({ at_least: t, competencies: [...approvedByComp.values()].filter((v) => v >= t).length }));

  const with_any_approved = perComp == null ? null : approvedByComp.size;
  const assessment_ready = perComp == null
    ? null
    : [...approvedByComp.values()].filter((v) => v >= ASSESSMENT_READY_MIN_QUESTIONS).length;

  // type / domain for the linked competencies (genome-joined, honest)
  const linkedMeta = bridgeReady && source_tables.onto_competencies
    ? await safeRows<{ competency_id: string; canonical_name: string | null; type_key: string | null; domain_id: string | null }>(
        pool,
        `SELECT DISTINCT m.competency_id,
                c.canonical_name AS canonical_name,
                tm.type_key,
                c.domain_id
           FROM onto_competency_question_map m
           JOIN competency_question_templates t ON t.id = m.question_id AND t.status = 'approved'
           LEFT JOIN onto_competencies c ON c.id = m.competency_id
           LEFT JOIN onto_competency_type_map tm ON tm.competency_id = m.competency_id
          WHERE m.active = true`,
      )
    : null;

  // by type: total members vs members with any approved Q vs assessment-ready
  let by_type: Array<{ type_key: string; label: string; total: number | null; with_any_approved: number; assessment_ready: number; coverage_pct: number | null }> | null = null;
  if (source_tables.onto_competency_type_map && perComp != null) {
    const typeTotals = await safeRows<{ type_key: string; c: string }>(
      pool,
      `SELECT type_key, COUNT(*)::text AS c FROM onto_competency_type_map GROUP BY type_key`,
    );
    const totalByType = new Map<string, number>((typeTotals ?? []).map((r) => [r.type_key, num(r.c)]));
    const anyByType = new Map<string, number>();
    const readyByType = new Map<string, number>();
    for (const row of linkedMeta ?? []) {
      const tk = row.type_key ?? '(unclassified)';
      anyByType.set(tk, (anyByType.get(tk) ?? 0) + 1);
      if ((approvedByComp.get(row.competency_id) ?? 0) >= ASSESSMENT_READY_MIN_QUESTIONS) {
        readyByType.set(tk, (readyByType.get(tk) ?? 0) + 1);
      }
    }
    by_type = CANONICAL_TYPE_ORDER.map((tk) => {
      const total = totalByType.has(tk) ? totalByType.get(tk)! : null;
      const any = anyByType.get(tk) ?? 0;
      return { type_key: tk, label: TYPE_LABELS[tk] ?? tk, total, with_any_approved: any, assessment_ready: readyByType.get(tk) ?? 0, coverage_pct: pct(any, total) };
    });
  }

  // by domain: total members vs members with any approved Q
  let by_domain: Array<{ domain_id: string; name: string; total: number | null; with_any_approved: number; assessment_ready: number; coverage_pct: number | null }> | null = null;
  if (source_tables.onto_competencies && perComp != null) {
    const domTotals = await safeRows<{ domain_id: string | null; c: string }>(
      pool,
      `SELECT domain_id, COUNT(*)::text AS c FROM onto_competencies GROUP BY domain_id`,
    );
    const totalByDom = new Map<string, number>((domTotals ?? []).map((r) => [String(r.domain_id ?? '(no domain)'), num(r.c)]));
    const domLabels = await safeRows<{ id: string; name: string; display_order: number }>(
      pool,
      `SELECT id, name, display_order FROM onto_domains ORDER BY display_order, id`,
    );
    const labelById = new Map<string, string>((domLabels ?? []).map((r) => [r.id, r.name]));
    const anyByDom = new Map<string, number>();
    const readyByDom = new Map<string, number>();
    for (const row of linkedMeta ?? []) {
      const d = row.domain_id ?? '(no domain)';
      anyByDom.set(d, (anyByDom.get(d) ?? 0) + 1);
      if ((approvedByComp.get(row.competency_id) ?? 0) >= ASSESSMENT_READY_MIN_QUESTIONS) {
        readyByDom.set(d, (readyByDom.get(d) ?? 0) + 1);
      }
    }
    by_domain = [...totalByDom.entries()].map(([id, total]) => ({
      domain_id: id,
      name: labelById.get(id) ?? id,
      total,
      with_any_approved: anyByDom.get(id) ?? 0,
      assessment_ready: readyByDom.get(id) ?? 0,
      coverage_pct: pct(anyByDom.get(id) ?? 0, total),
    }));
  }

  const ready_list = perComp == null
    ? null
    : (linkedMeta ?? [])
        .filter((r) => (approvedByComp.get(r.competency_id) ?? 0) >= 1)
        .map((r) => ({
          competency_id: r.competency_id,
          canonical_name: r.canonical_name,
          type_key: r.type_key,
          domain_id: r.domain_id,
          approved_questions: approvedByComp.get(r.competency_id) ?? 0,
        }))
        .sort((a, b) => b.approved_questions - a.approved_questions);

  // BANK context — DISJOINT namespace, reported separately, never force-joined to the genome.
  let bank_context: any = { measurable: false, note: 'competency_question_templates absent.' };
  if (source_tables.competency_question_templates) {
    const statusRows = await safeRows<{ status: string; c: string }>(
      pool,
      `SELECT status, COUNT(*)::text AS c FROM competency_question_templates GROUP BY status`,
    );
    const distinctCodes = await safeRows<{ c: string }>(
      pool,
      `SELECT COUNT(DISTINCT competency_code)::text AS c FROM competency_question_templates`,
    );
    const total = await safeRows<{ c: string }>(pool, `SELECT COUNT(*)::text AS c FROM competency_question_templates`);
    bank_context = {
      measurable: statusRows != null,
      distinct_bank_codes: distinctCodes ? num(distinctCodes[0]?.c) : null,
      total_templates: total ? num(total[0]?.c) : null,
      by_status: statusRows == null ? null : statusRows.map((r) => ({ status: r.status, count: num(r.c) })),
      note: 'competency_question_templates.competency_code is the assessment BANK domain code (COG/COM/LEA/EXE/ADP/TEC/EIQ…) — a DISJOINT namespace from the 419-competency genome. Shown as context only; NEVER force-joined to the 5-type axis. Genome assessment coverage above is via onto_competency_question_map only.',
    };
  }

  return {
    source_tables,
    threshold_min_questions: ASSESSMENT_READY_MIN_QUESTIONS,
    genome_total,
    competencies_with_any_approved: with_any_approved,
    competencies_assessment_ready: assessment_ready,
    coverage_pct_any: pct(with_any_approved, genome_total),
    coverage_pct_ready: pct(assessment_ready, genome_total),
    question_count_distribution,
    by_type,
    by_domain,
    ready_list,
    bank_context,
    note: 'Assessment coverage joins genome competencies to APPROVED authored questions via onto_competency_question_map ONLY. Coverage (≥1 approved Q) and readiness (≥threshold) are separate axes; low coverage is an honest content gap, not fabricated.',
  };
}

/* ------------------------------------------------------------------ */
/* 3. Benchmark coverage                                              */
/* ------------------------------------------------------------------ */
export async function getBenchmarkCoverageMatrix(pool: Pool) {
  const source_tables: SourceTables = {
    onto_competencies: await tableExists(pool, 'onto_competencies'),
    onto_competency_type_map: await tableExists(pool, 'onto_competency_type_map'),
    bench_competency_benchmarks: await tableExists(pool, 'bench_competency_benchmarks'),
  };

  const genomeTotalRows = source_tables.onto_competencies
    ? await safeRows<{ c: string }>(pool, `SELECT COUNT(*)::text AS c FROM onto_competencies`)
    : null;
  const genome_total = genomeTotalRows ? num(genomeTotalRows[0]?.c) : null;

  if (!source_tables.bench_competency_benchmarks) {
    return {
      source_tables,
      k_min: BENCHMARK_K_MIN,
      genome_total,
      total_benchmark_rows: null,
      distinct_cohorts: null,
      competencies_with_benchmark: null,
      competencies_benchmark_ready: null,
      competencies_suppressed_below_k: null,
      orphan_competency_ids: null,
      coverage_pct: null,
      by_type: null,
      by_domain: null,
      note: 'bench_competency_benchmarks absent — benchmark coverage not measurable (null, never fabricated as 0).',
    };
  }

  const summary = await safeRows<{ rows: string; cohorts: string }>(
    pool,
    `SELECT COUNT(*)::text AS rows, COUNT(DISTINCT cohort_id)::text AS cohorts FROM bench_competency_benchmarks`,
  );

  // a competency is benchmark-ready if it has ANY benchmark row clearing k-anonymity
  const ready = await safeRows<{ c: string }>(
    pool,
    `SELECT COUNT(DISTINCT competency_id)::text AS c FROM bench_competency_benchmarks WHERE n_samples >= $1`,
    [BENCHMARK_K_MIN],
  );
  const anyComp = await safeRows<{ c: string }>(
    pool,
    `SELECT COUNT(DISTINCT competency_id)::text AS c FROM bench_competency_benchmarks`,
  );
  // competencies that ONLY have sub-k rows (present but suppressed) — honest k-anonymity disclosure
  const suppressedOnly = await safeRows<{ c: string }>(
    pool,
    `SELECT COUNT(*)::text AS c FROM (
       SELECT competency_id FROM bench_competency_benchmarks
       GROUP BY competency_id
       HAVING MAX(n_samples) < $1
     ) s`,
    [BENCHMARK_K_MIN],
  );

  // orphans: benchmark competency_id not present in genome (honest, never silently dropped)
  const orphans = source_tables.onto_competencies
    ? await safeRows<{ competency_id: string }>(
        pool,
        `SELECT DISTINCT b.competency_id
           FROM bench_competency_benchmarks b
           LEFT JOIN onto_competencies c ON c.id = b.competency_id
          WHERE c.id IS NULL`,
      )
    : null;

  // by type / domain — count READY (k-cleared) genome competencies per axis
  let by_type: Array<{ type_key: string; label: string; total: number | null; benchmarked: number; coverage_pct: number | null }> | null = null;
  if (source_tables.onto_competency_type_map) {
    const typeTotals = await safeRows<{ type_key: string; c: string }>(
      pool,
      `SELECT type_key, COUNT(*)::text AS c FROM onto_competency_type_map GROUP BY type_key`,
    );
    const totalByType = new Map<string, number>((typeTotals ?? []).map((r) => [r.type_key, num(r.c)]));
    const benchByType = await safeRows<{ type_key: string; c: string }>(
      pool,
      `SELECT tm.type_key, COUNT(DISTINCT b.competency_id)::text AS c
         FROM bench_competency_benchmarks b
         JOIN onto_competency_type_map tm ON tm.competency_id = b.competency_id
        WHERE b.n_samples >= $1
        GROUP BY tm.type_key`,
      [BENCHMARK_K_MIN],
    );
    const benchMap = new Map<string, number>((benchByType ?? []).map((r) => [r.type_key, num(r.c)]));
    by_type = CANONICAL_TYPE_ORDER.map((tk) => {
      const total = totalByType.has(tk) ? totalByType.get(tk)! : null;
      const benchmarked = benchMap.get(tk) ?? 0;
      return { type_key: tk, label: TYPE_LABELS[tk] ?? tk, total, benchmarked, coverage_pct: pct(benchmarked, total) };
    });
  }

  let by_domain: Array<{ domain_id: string; name: string; total: number | null; benchmarked: number; coverage_pct: number | null }> | null = null;
  if (source_tables.onto_competencies) {
    const domTotals = await safeRows<{ domain_id: string | null; c: string }>(
      pool,
      `SELECT domain_id, COUNT(*)::text AS c FROM onto_competencies GROUP BY domain_id`,
    );
    const totalByDom = new Map<string, number>((domTotals ?? []).map((r) => [String(r.domain_id ?? '(no domain)'), num(r.c)]));
    const domLabels = await safeRows<{ id: string; name: string }>(pool, `SELECT id, name FROM onto_domains`);
    const labelById = new Map<string, string>((domLabels ?? []).map((r) => [r.id, r.name]));
    const benchByDom = await safeRows<{ domain_id: string | null; c: string }>(
      pool,
      `SELECT c.domain_id, COUNT(DISTINCT b.competency_id)::text AS c
         FROM bench_competency_benchmarks b
         JOIN onto_competencies c ON c.id = b.competency_id
        WHERE b.n_samples >= $1
        GROUP BY c.domain_id`,
      [BENCHMARK_K_MIN],
    );
    const benchMap = new Map<string, number>((benchByDom ?? []).map((r) => [String(r.domain_id ?? '(no domain)'), num(r.c)]));
    by_domain = [...totalByDom.entries()].map(([id, total]) => ({
      domain_id: id,
      name: labelById.get(id) ?? id,
      total,
      benchmarked: benchMap.get(id) ?? 0,
      coverage_pct: pct(benchMap.get(id) ?? 0, total),
    }));
  }

  const benchReady = ready ? num(ready[0]?.c) : null;

  return {
    source_tables,
    k_min: BENCHMARK_K_MIN,
    genome_total,
    total_benchmark_rows: summary ? num(summary[0]?.rows) : null,
    distinct_cohorts: summary ? num(summary[0]?.cohorts) : null,
    competencies_with_benchmark: anyComp ? num(anyComp[0]?.c) : null,
    competencies_benchmark_ready: benchReady,
    competencies_suppressed_below_k: suppressedOnly ? num(suppressedOnly[0]?.c) : null,
    orphan_competency_ids: orphans == null ? null : orphans.map((r) => r.competency_id),
    coverage_pct: pct(benchReady, genome_total),
    by_type,
    by_domain,
    note: 'Benchmark coverage = a genome competency has a population benchmark clearing k-anonymity (n_samples >= k_min). Coverage and k-suppression are reported separately; orphan benchmark ids are surfaced, never silently dropped.',
  };
}

/* ------------------------------------------------------------------ */
/* Overview — composes the three matrices + honest findings           */
/* ------------------------------------------------------------------ */
export async function getCoverageMatricesOverview(pool: Pool) {
  const [competency, assessment, benchmark] = await Promise.all([
    getCompetencyCoverageMatrix(pool),
    getAssessmentCoverageMatrix(pool),
    getBenchmarkCoverageMatrix(pool),
  ]);

  const findings: Array<{ severity: 'info' | 'gap'; area: string; finding: string }> = [];

  // empty / sparse types are honest gaps
  for (const t of competency.by_type ?? []) {
    if (t.count === 0) findings.push({ severity: 'gap', area: 'competency', finding: `Type "${t.label}" has 0 classified competencies — honest content gap, not fabricated.` });
    else if (t.count > 0 && competency.total_competencies && t.count / competency.total_competencies < 0.06) {
      findings.push({ severity: 'info', area: 'competency', finding: `Type "${t.label}" is sparse (${t.count}/${competency.total_competencies}).` });
    }
  }

  if (assessment.coverage_pct_any != null) {
    findings.push({
      severity: assessment.coverage_pct_any < 25 ? 'gap' : 'info',
      area: 'assessment',
      finding: `${assessment.competencies_with_any_approved ?? 0}/${assessment.genome_total ?? '?'} genome competencies have approved questions (${assessment.coverage_pct_any}%); ${assessment.competencies_assessment_ready ?? 0} are assessment-ready at ≥${assessment.threshold_min_questions} questions. The remainder is an authoring gap (out of scope this phase).`,
    });
  }

  if (benchmark.coverage_pct != null) {
    findings.push({
      severity: benchmark.coverage_pct < 25 ? 'gap' : 'info',
      area: 'benchmark',
      finding: `${benchmark.competencies_benchmark_ready ?? 0}/${benchmark.genome_total ?? '?'} genome competencies have a k-cleared benchmark (${benchmark.coverage_pct}%, k_min=${benchmark.k_min}).`,
    });
  }
  if (benchmark.orphan_competency_ids && benchmark.orphan_competency_ids.length > 0) {
    findings.push({ severity: 'gap', area: 'benchmark', finding: `${benchmark.orphan_competency_ids.length} benchmark competency id(s) are not in the genome (orphans).` });
  }

  return {
    headline: {
      competency_coverage_pct: competency.coverage_pct,
      assessment_coverage_pct: assessment.coverage_pct_any,
      assessment_ready_count: assessment.competencies_assessment_ready,
      benchmark_coverage_pct: benchmark.coverage_pct,
      genome_total: competency.total_competencies,
    },
    competency,
    assessment,
    benchmark,
    findings,
    note: 'Three independent coverage axes over one genome. Coverage (data exists) is reported separately from readiness/k-anonymity. Sparse/empty cells and authoring gaps are honest, never fabricated.',
  };
}

export const COVERAGE_MATRICES_METHODOLOGY = {
  classification_version: COMPETENCY_TYPE_CLASSIFICATION_VERSION,
  coverage_matrices_version: COMPETENCY_COVERAGE_MATRICES_VERSION,
  assessment_ready_min_questions: ASSESSMENT_READY_MIN_QUESTIONS,
  benchmark_k_min: BENCHMARK_K_MIN,
};

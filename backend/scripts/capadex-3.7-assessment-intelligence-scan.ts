/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting) CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical intelligence model size (8 dimensions, norm types, standard-score types, benchmark scopes,
 *     AI-interpretation capabilities, report sections, performance metrics, mapping steps),
 *   - EIGHT INDEPENDENT certification dimensions, each verified vs the live filesystem + DB:
 *       norm_referencing · standardization · benchmarking · ai_interpretation · report_intelligence ·
 *       candidate_performance · frontend · apis,
 *   - a SEPARATE adoption axis (real interpreted / standardized / benchmarked / narrated / reported VOLUME)
 *     + classified gaps (OPEN deferrals + RESOLVED via reuse) + verdict.
 *
 * The EIGHT dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is INTERPRETATION & REPORTING ONLY (norm-referencing · standardization · benchmarking ·
 * AI-interpretation · report intelligence · candidate performance · frontend · apis) — it turns a SCORED +
 * VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING and NEVER re-scores or re-validates the instrument.
 * Norm-referenced statistics + benchmarks ABSTAIN below k_min real members (never fabricated).
 *
 * Emits `backend/audit/capadex-3.7-assessment-intelligence/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.7-assessment-intelligence-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  AINT_AXES, AINT_DIMENSIONS, AINT_K_MIN, NORM_TYPES, STANDARD_SCORE_TYPES,
  BENCHMARK_SCOPES, AI_INTERPRETATION_CAPABILITIES, REPORT_SECTIONS, PERFORMANCE_METRICS,
  MAPPING_MODEL, AINT_DECISIONS,
} from '../config/assessment-intelligence';
import {
  composeDimensions, composeNormTypes, composeStandardScoreTypes, composeBenchmarkScopes,
  composeAiCapabilities, composeReportSections, composePerformanceMetrics,
  composeMapping, composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-intelligence-engine';

type StatusCounts = { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const norm_types = composeNormTypes();
    const standard_score_types = composeStandardScoreTypes();
    const benchmark_scopes = await composeBenchmarkScopes(pool);
    const ai_capabilities = await composeAiCapabilities(pool);
    const report_sections = await composeReportSections(pool);
    const performance_metrics = await composePerformanceMetrics(pool);
    const mapping = await composeMapping(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      k_min: AINT_K_MIN,
      scope: 'INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/' +
        'report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + ' +
        '3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument. Norm-referenced statistics + ' +
        'benchmarks ABSTAIN below k_min real members (never fabricated).',
      axes: AINT_AXES,
      dimension_count: AINT_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: AINT_DIMENSIONS,
        norm_types: NORM_TYPES,
        standard_score_types: STANDARD_SCORE_TYPES,
        benchmark_scopes: BENCHMARK_SCOPES,
        ai_interpretation_capabilities: AI_INTERPRETATION_CAPABILITIES,
        report_sections: REPORT_SECTIONS,
        performance_metrics: PERFORMANCE_METRICS,
        mapping_model: MAPPING_MODEL,
        decisions: AINT_DECISIONS,
      },
      // The EIGHT INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_norm_types: { count: norm_types.count, status_counts: norm_types.status_counts },
      axis_standard_score_types: { count: standard_score_types.count, status_counts: standard_score_types.status_counts },
      axis_benchmark_scopes: { count: benchmark_scopes.count, status_counts: benchmark_scopes.status_counts },
      axis_ai_capabilities: { count: ai_capabilities.count, status_counts: ai_capabilities.status_counts },
      axis_report_sections: { count: report_sections.count, status_counts: report_sections.status_counts },
      axis_performance_metrics: { count: performance_metrics.count, status_counts: performance_metrics.status_counts },
      axis_mapping: mapping,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.7-assessment-intelligence');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: StatusCounts) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.7 Assessment Intelligence (Interpretation & Reporting) certification scan ──');
    console.log(`dimensions: ${out.dimension_count} · k_min: ${out.k_min}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM norm-types:', sc(norm_types.status_counts), `types=${norm_types.count}`);
    console.log('DIM standard-score-types:', sc(standard_score_types.status_counts), `types=${standard_score_types.count}`);
    console.log('DIM benchmark-scopes:', sc(benchmark_scopes.status_counts), `scopes=${benchmark_scopes.count}`);
    console.log('DIM ai-capabilities:', sc(ai_capabilities.status_counts), `caps=${ai_capabilities.count}`);
    console.log('DIM report-sections:', sc(report_sections.status_counts), `sections=${report_sections.count}`);
    console.log('DIM performance-metrics:', sc(performance_metrics.status_counts), `metrics=${performance_metrics.count}`);
    console.log('mapping:', sc(mapping.mapping_status_counts), `steps=${mapping.step_count}`);
    console.log('repository-alignment:', JSON.stringify({
      services: repository_alignment.services, routes: repository_alignment.routes,
      frontend: repository_alignment.frontend, tables: repository_alignment.tables,
    }));
    console.log('gap counts:', JSON.stringify(gap_counts), `total=${out.gap_total} resolved=${resolved_gap_count}`);
    console.log('verdict:', summary.enterprise_ready.verdict, '| ready_for_certification:', summary.ready_for_certification.verdict);
    for (const d of dimensions.dimensions) {
      const e = d.evidence;
      console.log(
        `  ${d.key.padEnd(22)} ${d.status.padEnd(10)} ` +
        `svc ${e.services.present}/${e.services.total} rt ${e.routes.present}/${e.routes.total} ` +
        `fe ${e.frontend.present}/${e.frontend.total} tbl ${e.tables.present}/${e.tables.total}` +
        (e.tables.unknown ? ` (unknown ${e.tables.unknown})` : ''),
      );
    }
    console.log('wrote', path.join(dir, 'scan.json'));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

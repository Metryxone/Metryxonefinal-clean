/**
 * CAPADEX 3.0 — Program 3 · Phase 3.5 Assessment Measurement & Scoring Engine CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical scoring model size (7 dimensions, 13 scoring models, 5 response-processing modes,
 *     9 measurement types, 8 scoring rules, 5 scoring-config controls, 4 validation checks, 10 mapping steps),
 *   - SEVEN INDEPENDENT certification dimensions, each verified vs the live filesystem + DB:
 *       measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend,
 *   - a SEPARATE adoption axis (real scored-assessment volume) + classified gaps
 *     (OPEN deferrals + RESOLVED via reuse) + verdict + Phase-3.6 readiness.
 *
 * The SEVEN dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is MEASUREMENT & SCORING ONLY (responses → measurable scores/indicators) — NOT
 * psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports.
 *
 * Emits `backend/audit/capadex-3.5-assessment-scoring/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.5-assessment-scoring-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  AS_AXES, AS_DIMENSIONS, SCORING_MODELS, RESPONSE_PROCESSING, MEASUREMENT_TYPES,
  SCORING_RULES, SCORING_CONFIG, VALIDATION_CHECKS, MAPPING_MODEL, AS_DECISIONS,
} from '../config/assessment-scoring';
import {
  composeDimensions, composeScoringModels, composeResponseProcessing, composeMeasurementTypes,
  composeScoringRules, composeScoringConfig, composeValidationChecks,
  composeMapping, composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-scoring-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const scoring_models = composeScoringModels();
    const response_processing = composeResponseProcessing();
    const measurement = await composeMeasurementTypes(pool);
    const rules = await composeScoringRules(pool);
    const config = await composeScoringConfig(pool);
    const validation = await composeValidationChecks(pool);
    const mapping = await composeMapping(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      scope: 'MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/' +
        'scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; ' +
        'NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/' +
        'reports/analytics (= Phase 3.6+)',
      axes: AS_AXES,
      dimension_count: AS_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: AS_DIMENSIONS,
        scoring_models: SCORING_MODELS,
        response_processing: RESPONSE_PROCESSING,
        measurement_types: MEASUREMENT_TYPES,
        scoring_rules: SCORING_RULES,
        scoring_config: SCORING_CONFIG,
        validation_checks: VALIDATION_CHECKS,
        mapping_model: MAPPING_MODEL,
        decisions: AS_DECISIONS,
      },
      // The SEVEN INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_scoring_models: scoring_models,
      axis_response_processing: response_processing,
      axis_measurement_types: measurement,
      axis_scoring_rules: rules,
      axis_scoring_config: config,
      axis_validation_checks: validation,
      axis_mapping: mapping,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.5-assessment-scoring');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: any) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.5 Assessment Measurement & Scoring Engine certification scan ──');
    console.log(`dimensions: ${out.dimension_count}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM scoring-models:', sc(scoring_models.status_counts), `models=${scoring_models.count}`);
    console.log('DIM response-processing:', sc(response_processing.status_counts), `modes=${response_processing.count}`);
    console.log('DIM measurement-types:', sc(measurement.status_counts), `types=${measurement.count}`);
    console.log('DIM scoring-rules:', sc(rules.status_counts), `rules=${rules.count}`);
    console.log('DIM scoring-config:', sc(config.status_counts), `controls=${config.count}`);
    console.log('DIM validation-checks:', sc(validation.status_counts), `checks=${validation.count}`);
    console.log('mapping:', sc(mapping.mapping_status_counts), `steps=${mapping.step_count}`);
    console.log('repository-alignment:', JSON.stringify({
      services: repository_alignment.services, routes: repository_alignment.routes,
      frontend: repository_alignment.frontend, tables: repository_alignment.tables,
    }));
    console.log('gap counts:', JSON.stringify(gap_counts), `total=${out.gap_total} resolved=${resolved_gap_count}`);
    console.log('verdict:', summary.enterprise_ready.verdict, '| ready_for_3.6:', summary.ready_for_phase_3_6.verdict);
    for (const d of dimensions.dimensions) {
      const e = d.evidence;
      console.log(
        `  ${d.key.padEnd(20)} ${d.status.padEnd(10)} ` +
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

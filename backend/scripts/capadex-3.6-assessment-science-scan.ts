/**
 * CAPADEX 3.0 — Program 3 · Phase 3.6 Assessment Science / Psychometrics / Item Intelligence CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical science model size (8 dimensions, 9 item-analysis metrics, 6 quality checks,
 *     7 reliability types, 8 validity types, governance stages, blueprint controls, mapping steps),
 *   - EIGHT INDEPENDENT certification dimensions, each verified vs the live filesystem + DB:
 *       item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis,
 *   - a SEPARATE adoption axis (real analysed-item / reliability / validity / quality / blueprint VOLUME)
 *     + classified gaps (OPEN deferrals + RESOLVED via reuse) + verdict + Phase-3.7 readiness.
 *
 * The EIGHT dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is INSTRUMENT / QUESTION QUALITY ONLY (item analysis · reliability · validity · quality governance ·
 * blueprint validation · frontend · ux · apis) — it measures how GOOD the assessment/question is and NEVER
 * scores or interprets a candidate; NOT norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
 * Item-level statistics ABSTAIN below k_min real responses (never fabricated).
 *
 * Emits `backend/audit/capadex-3.6-assessment-science/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.6-assessment-science-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  ASCI_AXES, ASCI_DIMENSIONS, ASCI_K_MIN, ITEM_ANALYSIS_METRICS, QUALITY_CHECKS,
  RELIABILITY_TYPES, VALIDITY_TYPES, GOVERNANCE_STAGES, BLUEPRINT_COVERAGE,
  MAPPING_MODEL, ASCI_DECISIONS,
} from '../config/assessment-science';
import {
  composeDimensions, composeMapping, composeRepositoryAlignment,
  composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-science-engine';

type StatusCounts = { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };
function statusCounts(items: { status: string }[]): StatusCounts {
  const out: StatusCounts = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  for (const it of items) out[it.status as keyof StatusCounts] += 1;
  return out;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const mapping = await composeMapping(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const item_analysis = { count: ITEM_ANALYSIS_METRICS.length, status_counts: statusCounts(ITEM_ANALYSIS_METRICS) };
    const quality_checks = { count: QUALITY_CHECKS.length, status_counts: statusCounts(QUALITY_CHECKS) };
    const reliability = { count: RELIABILITY_TYPES.length, status_counts: statusCounts(RELIABILITY_TYPES) };
    const validity = { count: VALIDITY_TYPES.length, status_counts: statusCounts(VALIDITY_TYPES) };
    const governance = { count: GOVERNANCE_STAGES.length, status_counts: statusCounts(GOVERNANCE_STAGES) };
    const blueprint = { count: BLUEPRINT_COVERAGE.length, status_counts: statusCounts(BLUEPRINT_COVERAGE) };

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      k_min: ASCI_K_MIN,
      scope: 'INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint ' +
        'validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets ' +
        'a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+)',
      axes: ASCI_AXES,
      dimension_count: ASCI_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: ASCI_DIMENSIONS,
        item_analysis_metrics: ITEM_ANALYSIS_METRICS,
        quality_checks: QUALITY_CHECKS,
        reliability_types: RELIABILITY_TYPES,
        validity_types: VALIDITY_TYPES,
        governance_stages: GOVERNANCE_STAGES,
        blueprint_coverage: BLUEPRINT_COVERAGE,
        mapping_model: MAPPING_MODEL,
        decisions: ASCI_DECISIONS,
      },
      // The EIGHT INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_item_analysis: item_analysis,
      axis_quality_checks: quality_checks,
      axis_reliability: reliability,
      axis_validity: validity,
      axis_governance: governance,
      axis_blueprint: blueprint,
      axis_mapping: mapping,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.6-assessment-science');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: StatusCounts) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.6 Assessment Science / Psychometrics / Item Intelligence certification scan ──');
    console.log(`dimensions: ${out.dimension_count} · k_min: ${out.k_min}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM item-analysis:', sc(item_analysis.status_counts), `metrics=${item_analysis.count}`);
    console.log('DIM quality-checks:', sc(quality_checks.status_counts), `checks=${quality_checks.count}`);
    console.log('DIM reliability:', sc(reliability.status_counts), `types=${reliability.count}`);
    console.log('DIM validity:', sc(validity.status_counts), `types=${validity.count}`);
    console.log('DIM governance:', sc(governance.status_counts), `stages=${governance.count}`);
    console.log('DIM blueprint:', sc(blueprint.status_counts), `controls=${blueprint.count}`);
    console.log('mapping:', sc(mapping.mapping_status_counts), `steps=${mapping.step_count}`);
    console.log('repository-alignment:', JSON.stringify({
      services: repository_alignment.services, routes: repository_alignment.routes,
      frontend: repository_alignment.frontend, tables: repository_alignment.tables,
    }));
    console.log('gap counts:', JSON.stringify(gap_counts), `total=${out.gap_total} resolved=${resolved_gap_count}`);
    console.log('verdict:', summary.enterprise_ready.verdict, '| ready_for_3.7:', summary.ready_for_phase_3_7.verdict);
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

/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence Platform CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical benchmark model size (9 dimensions, benchmark types, comparison dimensions, time modes,
 *     benchmark config controls, governance states, super-admin surfaces, frontend surfaces, ux criteria,
 *     api groups, traceability links),
 *   - NINE INDEPENDENT certification dimensions, each verified vs the live filesystem + DB,
 *   - a SEPARATE adoption axis (real benchmarked / governed / audited / saved-view VOLUME)
 *     + classified gaps (OPEN deferrals + RESOLVED via reuse) + verdict.
 *
 * The NINE dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is BENCHMARKING & COMPARISON ONLY (benchmark engine · comparison engine · governance · super admin ·
 * frontend · ux · apis · testing · documentation) — it turns a STANDARDIZED score (3.8) into
 * percentile / z / delta / quartile against a reference group across multiple dimensions + time modes and
 * NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard /
 * candidate-analytics are OUT OF SCOPE (later phases). Benchmarking ABSTAINS below k_min real members in the
 * reference group (never fabricated).
 *
 * The reused benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark /
 * benchmark-engine / comparative-intelligence) is composed by EXISTENCE-verification — never invoked at compose.
 *
 * Emits `backend/audit/capadex-3.9-benchmark-intelligence/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.9-benchmark-intelligence-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  BMK_AXES, BMK_DIMENSIONS, BMK_K_MIN, BENCHMARK_TYPES, COMPARISON_DIMENSIONS, TIME_MODES,
  BENCHMARK_CONFIG, GOVERNANCE_STATES, SUPER_ADMIN_SURFACES, FRONTEND_SURFACES, UX_CRITERIA,
  API_GROUPS, TRACEABILITY_MODEL, BMK_DECISIONS,
} from '../config/benchmark-intelligence';
import {
  composeDimensions, composeBenchmarkTypes, composeComparisonDimensions, composeTimeModes,
  composeBenchmarkConfig, composeGovernanceStates, composeSuperAdminSurfaces, composeFrontendSurfaces,
  composeUxCriteria, composeApiGroups, composeTraceability, composeRepositoryAlignment,
  composeAdoption, classifiedGaps, composeSummary,
} from '../services/benchmark-intelligence-engine';

type StatusCounts = { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const benchmark_types = composeBenchmarkTypes();
    const comparison_dimensions = composeComparisonDimensions();
    const time_modes = composeTimeModes();
    const benchmark_config = await composeBenchmarkConfig(pool);
    const governance_states = await composeGovernanceStates(pool);
    const super_admin_surfaces = await composeSuperAdminSurfaces(pool);
    const frontend_surfaces = await composeFrontendSurfaces(pool);
    const ux_criteria = await composeUxCriteria(pool);
    const api_groups = await composeApiGroups(pool);
    const traceability = await composeTraceability(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      k_min: BMK_K_MIN,
      scope: 'BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/' +
        'frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / ' +
        'delta / quartile against a reference group (self/peer/cohort/organization/industry/functional/' +
        'geographic/global/custom) across multiple comparison dimensions + time modes; it NEVER re-scores, ' +
        're-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / ' +
        'candidate-analytics are OUT OF SCOPE (later phases). Benchmarking ABSTAINS below k_min real members ' +
        'in the reference group (never fabricated). The reused benchmark substrate (peer-benchmark / ' +
        'm5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / ' +
        'comparative-intelligence) is composed by EXISTENCE — never invoked at compose time.',
      axes: BMK_AXES,
      dimension_count: BMK_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: BMK_DIMENSIONS,
        benchmark_types: BENCHMARK_TYPES,
        comparison_dimensions: COMPARISON_DIMENSIONS,
        time_modes: TIME_MODES,
        benchmark_config: BENCHMARK_CONFIG,
        governance_states: GOVERNANCE_STATES,
        super_admin_surfaces: SUPER_ADMIN_SURFACES,
        frontend_surfaces: FRONTEND_SURFACES,
        ux_criteria: UX_CRITERIA,
        api_groups: API_GROUPS,
        traceability_model: TRACEABILITY_MODEL,
        decisions: BMK_DECISIONS,
      },
      // The NINE INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_benchmark_types: { count: benchmark_types.count, status_counts: benchmark_types.status_counts },
      axis_comparison_dimensions: { count: comparison_dimensions.count, status_counts: comparison_dimensions.status_counts },
      axis_time_modes: { count: time_modes.count, status_counts: time_modes.status_counts },
      axis_benchmark_config: { count: benchmark_config.count, status_counts: benchmark_config.status_counts },
      axis_governance_states: { count: governance_states.count, status_counts: governance_states.status_counts },
      axis_super_admin_surfaces: { count: super_admin_surfaces.count, status_counts: super_admin_surfaces.status_counts },
      axis_frontend_surfaces: { count: frontend_surfaces.count, status_counts: frontend_surfaces.status_counts },
      axis_ux_criteria: { count: ux_criteria.count, status_counts: ux_criteria.status_counts },
      axis_api_groups: { count: api_groups.count, status_counts: api_groups.status_counts },
      axis_traceability: traceability,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.9-benchmark-intelligence');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: StatusCounts) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.9 Enterprise Benchmark Intelligence Platform certification scan ──');
    console.log(`dimensions: ${out.dimension_count} · k_min: ${out.k_min}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM benchmark-types:', sc(benchmark_types.status_counts), `types=${benchmark_types.count}`);
    console.log('DIM comparison-dimensions:', sc(comparison_dimensions.status_counts), `dims=${comparison_dimensions.count}`);
    console.log('DIM time-modes:', sc(time_modes.status_counts), `modes=${time_modes.count}`);
    console.log('DIM benchmark-config:', sc(benchmark_config.status_counts), `controls=${benchmark_config.count}`);
    console.log('DIM governance-states:', sc(governance_states.status_counts), `states=${governance_states.count}`);
    console.log('DIM super-admin-surfaces:', sc(super_admin_surfaces.status_counts), `surfaces=${super_admin_surfaces.count}`);
    console.log('DIM frontend-surfaces:', sc(frontend_surfaces.status_counts), `surfaces=${frontend_surfaces.count}`);
    console.log('DIM ux-criteria:', sc(ux_criteria.status_counts), `criteria=${ux_criteria.count}`);
    console.log('DIM api-groups:', sc(api_groups.status_counts), `groups=${api_groups.count}`);
    console.log('traceability:', sc(traceability.trace_status_counts), `links=${traceability.link_count}`);
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

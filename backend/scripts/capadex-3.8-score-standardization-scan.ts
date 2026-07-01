/**
 * CAPADEX 3.0 — Program 3 · Phase 3.8 Enterprise Score Standardization & Interpretation CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical standardization model size (10 dimensions, standard-score types, performance bands,
 *     interpretation rule types, config scopes, formula capabilities, governance states, validation
 *     checks, super-admin surfaces, frontend surfaces, ux criteria, traceability links),
 *   - TEN INDEPENDENT certification dimensions, each verified vs the live filesystem + DB,
 *   - a SEPARATE adoption axis (real standardized / interpreted / governed / validated VOLUME)
 *     + classified gaps (OPEN deferrals + RESOLVED via reuse) + verdict.
 *
 * The TEN dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is STANDARDIZATION & INTERPRETATION ONLY (standard scores · structured-AST formula engine ·
 * interpretation rules · governance · super admin · frontend · ux · apis · testing · documentation) —
 * it turns a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance
 * bands and interpretation-rule verdicts and NEVER re-scores or re-validates the instrument.
 * Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT
 * OF SCOPE (later phases). Norm-referenced standardization ABSTAINS below k_min real members (never fabricated).
 *
 * Emits `backend/audit/capadex-3.8-score-standardization/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.8-score-standardization-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  STD_AXES, STD_DIMENSIONS, STD_K_MIN, STANDARD_SCORE_TYPES, PERFORMANCE_BANDS,
  INTERPRETATION_RULE_TYPES, STANDARDIZATION_CONFIG_SCOPES, FORMULA_CAPABILITIES,
  GOVERNANCE_STATES, VALIDATION_CHECKS, SUPER_ADMIN_SURFACES, FRONTEND_SURFACES,
  UX_CRITERIA, TRACEABILITY_MODEL, STD_DECISIONS,
} from '../config/score-standardization';
import {
  composeDimensions, composeStandardScoreTypes, composePerformanceBands,
  composeInterpretationRuleTypes, composeConfigScopes, composeFormulaCapabilities,
  composeGovernanceStates, composeValidationChecks, composeSuperAdminSurfaces,
  composeFrontendSurfaces, composeUxCriteria, composeTraceability,
  composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/score-standardization-engine';

type StatusCounts = { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const standard_score_types = composeStandardScoreTypes();
    const performance_bands = composePerformanceBands();
    const interpretation_rule_types = composeInterpretationRuleTypes();
    const config_scopes = composeConfigScopes();
    const formula_capabilities = await composeFormulaCapabilities(pool);
    const governance_states = await composeGovernanceStates(pool);
    const validation_checks = await composeValidationChecks(pool);
    const super_admin_surfaces = await composeSuperAdminSurfaces(pool);
    const frontend_surfaces = await composeFrontendSurfaces(pool);
    const ux_criteria = await composeUxCriteria(pool);
    const traceability = await composeTraceability(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      k_min: STD_K_MIN,
      scope: 'STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/' +
        'interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a ' +
        'SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and ' +
        'interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / ' +
        'AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE ' +
        '(later phases). Norm-referenced standardization ABSTAINS below k_min real members (never fabricated).',
      axes: STD_AXES,
      dimension_count: STD_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: STD_DIMENSIONS,
        standard_score_types: STANDARD_SCORE_TYPES,
        performance_bands: PERFORMANCE_BANDS,
        interpretation_rule_types: INTERPRETATION_RULE_TYPES,
        config_scopes: STANDARDIZATION_CONFIG_SCOPES,
        formula_capabilities: FORMULA_CAPABILITIES,
        governance_states: GOVERNANCE_STATES,
        validation_checks: VALIDATION_CHECKS,
        super_admin_surfaces: SUPER_ADMIN_SURFACES,
        frontend_surfaces: FRONTEND_SURFACES,
        ux_criteria: UX_CRITERIA,
        traceability_model: TRACEABILITY_MODEL,
        decisions: STD_DECISIONS,
      },
      // The TEN INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_standard_score_types: { count: standard_score_types.count, status_counts: standard_score_types.status_counts },
      axis_performance_bands: { count: performance_bands.count, status_counts: performance_bands.status_counts },
      axis_interpretation_rule_types: { count: interpretation_rule_types.count, status_counts: interpretation_rule_types.status_counts },
      axis_config_scopes: { count: config_scopes.count, status_counts: config_scopes.status_counts },
      axis_formula_capabilities: { count: formula_capabilities.count, status_counts: formula_capabilities.status_counts },
      axis_governance_states: { count: governance_states.count, status_counts: governance_states.status_counts },
      axis_validation_checks: { count: validation_checks.count, status_counts: validation_checks.status_counts },
      axis_super_admin_surfaces: { count: super_admin_surfaces.count, status_counts: super_admin_surfaces.status_counts },
      axis_frontend_surfaces: { count: frontend_surfaces.count, status_counts: frontend_surfaces.status_counts },
      axis_ux_criteria: { count: ux_criteria.count, status_counts: ux_criteria.status_counts },
      axis_traceability: traceability,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.8-score-standardization');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: StatusCounts) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.8 Enterprise Score Standardization & Interpretation certification scan ──');
    console.log(`dimensions: ${out.dimension_count} · k_min: ${out.k_min}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM standard-score-types:', sc(standard_score_types.status_counts), `types=${standard_score_types.count}`);
    console.log('DIM performance-bands:', sc(performance_bands.status_counts), `bands=${performance_bands.count}`);
    console.log('DIM interpretation-rule-types:', sc(interpretation_rule_types.status_counts), `types=${interpretation_rule_types.count}`);
    console.log('DIM config-scopes:', sc(config_scopes.status_counts), `scopes=${config_scopes.count}`);
    console.log('DIM formula-capabilities:', sc(formula_capabilities.status_counts), `caps=${formula_capabilities.count}`);
    console.log('DIM governance-states:', sc(governance_states.status_counts), `states=${governance_states.count}`);
    console.log('DIM validation-checks:', sc(validation_checks.status_counts), `checks=${validation_checks.count}`);
    console.log('DIM super-admin-surfaces:', sc(super_admin_surfaces.status_counts), `surfaces=${super_admin_surfaces.count}`);
    console.log('DIM frontend-surfaces:', sc(frontend_surfaces.status_counts), `surfaces=${frontend_surfaces.count}`);
    console.log('DIM ux-criteria:', sc(ux_criteria.status_counts), `criteria=${ux_criteria.count}`);
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

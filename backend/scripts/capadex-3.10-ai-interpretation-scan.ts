/**
 * CAPADEX 3.0 — Program 3 · Phase 3.10 Enterprise AI Interpretation & Explainability Platform CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical AI-interpretation model size (11 certification dimensions, interpretation kinds, explainability
 *     criteria, confidence criteria, hallucination controls, rule-repository capabilities, persona coverage,
 *     lifecycle coverage, super-admin surfaces, frontend surfaces, ux criteria, api groups, testing coverage,
 *     doc set, traceability links),
 *   - ELEVEN INDEPENDENT certification dimensions, each verified vs the live filesystem + DB,
 *   - a SEPARATE adoption axis (real interpreted / governed / audited / saved-view VOLUME)
 *     + classified gaps (OPEN deferrals + RESOLVED via reuse) + verdict.
 *
 * The ELEVEN dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — it turns a
 * STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored,
 * hallucination-protected result and NEVER re-scores, re-standardizes, re-benchmarks or builds a norm.
 * Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are
 * OUT OF SCOPE (later phases; boundaries). Interpretation ABSTAINS below the confidence / k_min evidence
 * floor (never fabricated).
 *
 * The reused interpretation substrate (aiClient health-gated LLM seam / mei-narrative-engine rule-driven
 * narration prior-art / 3.8 structured-AST formula engine / psychometric transforms) is composed by
 * EXISTENCE-verification — never invoked at compose time.
 *
 * Emits `backend/audit/capadex-3.10-ai-interpretation/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.10-ai-interpretation-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  AIXP_AXES, AIXP_DIMENSIONS, AIXP_K_MIN, INTERPRETATION_KINDS, EXPLAINABILITY_CRITERIA,
  CONFIDENCE_CRITERIA, HALLUCINATION_CONTROLS, RULE_CAPABILITIES, PERSONA_COVERAGE, LIFECYCLE_COVERAGE,
  SUPER_ADMIN_SURFACES, FRONTEND_SURFACES, UX_CRITERIA, API_GROUPS, TESTING_COVERAGE, DOC_SET,
  TRACEABILITY_MODEL, AIXP_DECISIONS, INTERPRETATION_BOUNDARIES,
} from '../config/ai-interpretation';
import {
  composeDimensions, composeInterpretationKinds, composeExplainabilityCriteria, composeConfidenceCriteria,
  composeHallucinationControls, composeRuleCapabilities, composePersonaCoverage, composeLifecycleCoverage,
  composeSuperAdminSurfaces, composeFrontendSurfaces, composeUxCriteria, composeApiGroups,
  composeTestingCoverage, composeDocSet, composeTraceability, composeRepositoryAlignment,
  composeAdoption, classifiedGaps, composeSummary,
} from '../services/ai-interpretation-engine';

type StatusCounts = { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const interpretation_kinds = composeInterpretationKinds();
    const explainability_criteria = composeExplainabilityCriteria();
    const confidence_criteria = composeConfidenceCriteria();
    const hallucination_controls = composeHallucinationControls();
    const rule_capabilities = composeRuleCapabilities();
    const persona_coverage = composePersonaCoverage();
    const lifecycle_coverage = composeLifecycleCoverage();
    const super_admin_surfaces = await composeSuperAdminSurfaces(pool);
    const frontend_surfaces = await composeFrontendSurfaces(pool);
    const ux_criteria = await composeUxCriteria(pool);
    const api_groups = await composeApiGroups(pool);
    const testing_coverage = await composeTestingCoverage(pool);
    const doc_set = await composeDocSet(pool);
    const traceability = await composeTraceability(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      k_min: AIXP_K_MIN,
      scope: 'INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation ' +
        'engine / explainability / confidence / hallucination-protection / rule-repository / super admin / ' +
        'frontend / ux / APIs / testing / documentation that turn a STANDARDIZED score (3.8) + BENCHMARK ' +
        'result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it ' +
        'NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / ' +
        'growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; ' +
        'boundaries). Interpretation ABSTAINS below the confidence / k_min evidence floor (never fabricated). ' +
        'The reused interpretation substrate (aiClient health-gated LLM seam / mei-narrative-engine rule-driven ' +
        'narration prior-art / 3.8 structured-AST formula engine / psychometric transforms) is composed by ' +
        'EXISTENCE — never invoked at compose time.',
      axes: AIXP_AXES,
      dimension_count: AIXP_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: AIXP_DIMENSIONS,
        interpretation_kinds: INTERPRETATION_KINDS,
        explainability_criteria: EXPLAINABILITY_CRITERIA,
        confidence_criteria: CONFIDENCE_CRITERIA,
        hallucination_controls: HALLUCINATION_CONTROLS,
        rule_capabilities: RULE_CAPABILITIES,
        persona_coverage: PERSONA_COVERAGE,
        lifecycle_coverage: LIFECYCLE_COVERAGE,
        super_admin_surfaces: SUPER_ADMIN_SURFACES,
        frontend_surfaces: FRONTEND_SURFACES,
        ux_criteria: UX_CRITERIA,
        api_groups: API_GROUPS,
        testing_coverage: TESTING_COVERAGE,
        doc_set: DOC_SET,
        traceability_model: TRACEABILITY_MODEL,
        decisions: AIXP_DECISIONS,
        boundaries: INTERPRETATION_BOUNDARIES,
      },
      // The ELEVEN INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_interpretation_kinds: { count: interpretation_kinds.count, status_counts: interpretation_kinds.status_counts },
      axis_explainability_criteria: { count: explainability_criteria.count, status_counts: explainability_criteria.status_counts },
      axis_confidence_criteria: { count: confidence_criteria.count, status_counts: confidence_criteria.status_counts },
      axis_hallucination_controls: { count: hallucination_controls.count, status_counts: hallucination_controls.status_counts },
      axis_rule_capabilities: { count: rule_capabilities.count, status_counts: rule_capabilities.status_counts },
      axis_persona_coverage: { count: persona_coverage.count, status_counts: persona_coverage.status_counts },
      axis_lifecycle_coverage: { count: lifecycle_coverage.count, status_counts: lifecycle_coverage.status_counts },
      axis_super_admin_surfaces: { count: super_admin_surfaces.count, status_counts: super_admin_surfaces.status_counts },
      axis_frontend_surfaces: { count: frontend_surfaces.count, status_counts: frontend_surfaces.status_counts },
      axis_ux_criteria: { count: ux_criteria.count, status_counts: ux_criteria.status_counts },
      axis_api_groups: { count: api_groups.count, status_counts: api_groups.status_counts },
      axis_testing_coverage: { count: testing_coverage.count, status_counts: testing_coverage.status_counts },
      axis_doc_set: { count: doc_set.count, status_counts: doc_set.status_counts },
      axis_traceability: traceability,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.10-ai-interpretation');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: StatusCounts) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.10 Enterprise AI Interpretation & Explainability Platform certification scan ──');
    console.log(`dimensions: ${out.dimension_count} · k_min: ${out.k_min}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM interpretation-kinds:', sc(interpretation_kinds.status_counts), `kinds=${interpretation_kinds.count}`);
    console.log('DIM explainability-criteria:', sc(explainability_criteria.status_counts), `criteria=${explainability_criteria.count}`);
    console.log('DIM confidence-criteria:', sc(confidence_criteria.status_counts), `criteria=${confidence_criteria.count}`);
    console.log('DIM hallucination-controls:', sc(hallucination_controls.status_counts), `controls=${hallucination_controls.count}`);
    console.log('DIM rule-capabilities:', sc(rule_capabilities.status_counts), `caps=${rule_capabilities.count}`);
    console.log('DIM persona-coverage:', sc(persona_coverage.status_counts), `personas=${persona_coverage.count}`);
    console.log('DIM lifecycle-coverage:', sc(lifecycle_coverage.status_counts), `stages=${lifecycle_coverage.count}`);
    console.log('DIM super-admin-surfaces:', sc(super_admin_surfaces.status_counts), `surfaces=${super_admin_surfaces.count}`);
    console.log('DIM frontend-surfaces:', sc(frontend_surfaces.status_counts), `surfaces=${frontend_surfaces.count}`);
    console.log('DIM ux-criteria:', sc(ux_criteria.status_counts), `criteria=${ux_criteria.count}`);
    console.log('DIM api-groups:', sc(api_groups.status_counts), `groups=${api_groups.count}`);
    console.log('DIM testing-coverage:', sc(testing_coverage.status_counts), `suites=${testing_coverage.count}`);
    console.log('DIM doc-set:', sc(doc_set.status_counts), `docs=${doc_set.count}`);
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
        `  ${d.key.padEnd(24)} ${d.status.padEnd(10)} ` +
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

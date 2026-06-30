/**
 * CAPADEX 3.0 — Program 1 · Phase 1.7 AI Recommendation Report Orchestration
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Answers: "assessment → AI analysis → confidence → explainability → recommendation →
 * intervention → outcome-validation → report → KPI."
 *
 * Measures (NO writes, NO DDL):
 *   - canonical AI-orchestration model size (12-step spine, capability inventory, recommendation /
 *     explainability criteria, report sections, dashboard surfaces, path/persona count),
 *   - per-path status distribution + evidence VERIFIED against the live filesystem + DB,
 *   - per-capability / per-recommendation-criterion / per-explainability-criterion / per-report-section /
 *     per-dashboard-surface coverage (substrate present/absent/unknown),
 *   - per-axis mapping coverage + spine reachability rollup,
 *   - recommendation/intervention EFFECTIVENESS substrate + loop-level calibration (rate honest-null/abstained),
 *   - classified gaps + rollup + STRUCTURAL verdict,
 *   - AI-loop ADOPTION + persona⟂AI-outcome read-time-join linkage
 *     (Adoption⟂Coverage⟂Confidence⟂Outcome never composited).
 *
 * Emits `backend/audit/capadex-3.0-ai-orchestration/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-1.7-ai-orchestration-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  AI_ORCHESTRATION_MODEL,
  AI_ORCHESTRATION_SPINE,
  AI_ORCHESTRATION_AXES,
  AI_CAPABILITIES,
  RECOMMENDATION_CRITERIA,
  EXPLAINABILITY_CRITERIA,
  REPORT_SECTIONS,
  DASHBOARD_SURFACES,
  AI_ORCHESTRATION_DECISIONS,
} from '../config/ai-orchestration-model';
import {
  composeCoverage,
  composeCapabilityInventory,
  composeRecommendationCompleteness,
  composeExplainability,
  composeReportValidation,
  composeDashboardValidation,
  composeEffectiveness,
  composeAdoption,
  composePersonaAiLinkage,
  composeSummary,
  AI_ORCHESTRATION_GAPS,
  RESOLVED_AI_ORCHESTRATION_GAPS,
} from '../services/ai-orchestration-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await composeCoverage(pool);
    const capability_coverage = await composeCapabilityInventory(pool);
    const recommendation_coverage = await composeRecommendationCompleteness(pool);
    const explainability_coverage = await composeExplainability(pool);
    const report_coverage = await composeReportValidation(pool);
    const dashboard_coverage = await composeDashboardValidation(pool);
    const effectiveness = await composeEffectiveness(pool);
    const adoption = await composeAdoption(pool);
    const persona_linkage = await composePersonaAiLinkage(pool);
    const summary = await composeSummary(pool);

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      spine_frozen: true,
      axes: AI_ORCHESTRATION_AXES,
      spine_step_count: AI_ORCHESTRATION_SPINE.length,
      capability_count: AI_CAPABILITIES.length,
      recommendation_criteria_count: RECOMMENDATION_CRITERIA.length,
      explainability_criteria_count: EXPLAINABILITY_CRITERIA.length,
      report_section_count: REPORT_SECTIONS.length,
      dashboard_surface_count: DASHBOARD_SURFACES.length,
      path_count: AI_ORCHESTRATION_MODEL.length,
      // Full registry payload embedded so the deliverable generator reads ONLY scan.json
      // (single measurement artifact → docs can never drift from the scan).
      spine: AI_ORCHESTRATION_SPINE,
      capabilities: AI_CAPABILITIES,
      recommendation_criteria: RECOMMENDATION_CRITERIA,
      explainability_criteria: EXPLAINABILITY_CRITERIA,
      report_sections: REPORT_SECTIONS,
      dashboard_surfaces: DASHBOARD_SURFACES,
      paths: AI_ORCHESTRATION_MODEL,
      decisions: AI_ORCHESTRATION_DECISIONS,
      coverage,
      capability_coverage,
      recommendation_coverage,
      explainability_coverage,
      report_coverage,
      dashboard_coverage,
      effectiveness,
      gaps: AI_ORCHESTRATION_GAPS,
      // Chain mechanisms REUSED (not rebuilt) — traceability; residual is ADOPTION/CONFIDENCE, never a gap.
      resolved_gaps: RESOLVED_AI_ORCHESTRATION_GAPS,
      summary,
      // AI-loop ADOPTION + persona⟂AI-outcome linkage (read-only; Adoption⟂Coverage⟂Outcome never composited).
      adoption,
      persona_linkage,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.0-ai-orchestration');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    // Console summary (human glance).
    console.log('── CAPADEX 1.7 AI Recommendation Report Orchestration scan ──');
    console.log(`spine steps: ${out.spine_step_count}  capabilities: ${out.capability_count}  rec criteria: ${out.recommendation_criteria_count}  expl criteria: ${out.explainability_criteria_count}  report sections: ${out.report_section_count}  dashboards: ${out.dashboard_surface_count}  paths: ${out.path_count}  personas: ${summary.persona_count}`);
    console.log('status:', JSON.stringify(summary.status_counts));
    console.log('evidence rollup:', JSON.stringify(summary.evidence_rollup));
    console.log('spine rollup:', JSON.stringify(summary.spine_rollup));
    console.log('capability rollup:', JSON.stringify(summary.capability_rollup));
    console.log('recommendation rollup:', JSON.stringify(summary.recommendation_rollup));
    console.log('explainability rollup:', JSON.stringify(summary.explainability_rollup));
    console.log('report rollup:', JSON.stringify(summary.report_rollup));
    console.log('dashboard rollup:', JSON.stringify(summary.dashboard_rollup));
    console.log('gap counts:', JSON.stringify(summary.gap_counts));
    console.log('verdict:', summary.enterprise_ready.verdict);
    console.log('effectiveness:', JSON.stringify({
      rec_rows: effectiveness.recommendation.substrate_rows,
      int_rows: effectiveness.intervention.substrate_rows,
      realized: effectiveness.realized_outcomes,
      cal_status: effectiveness.calibration.status,
      cal_pairs: effectiveness.calibration.pairs_used,
      rate: effectiveness.calibration.effectiveness_rate,
    }));
    console.log('adoption:', JSON.stringify({
      chains: adoption.reasoning_chains,
      recs: adoption.recommendations,
      interventions: adoption.interventions,
      reports: adoption.reports,
      realized: adoption.realized_outcomes,
      subjects: adoption.outcome_subjects,
      reassessed: adoption.reassessed_subjects,
      kpi_rows: adoption.kpi_rows,
    }));
    for (const c of coverage) {
      const e = c.evidence;
      console.log(
        `  ${c.key.padEnd(24)} ${c.status.padEnd(10)} ` +
        `spine ${c.spineReached}/${c.spineTotal} axes ${c.axesMapped}/${c.axesTotal} ` +
        `kpi ${c.kpiFamilies} ` +
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

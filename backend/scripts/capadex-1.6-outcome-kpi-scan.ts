/**
 * CAPADEX 3.0 — Program 1 · Phase 1.6 Outcome Framework / KPI Engine
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Answers: "assessment → intervention → MEASURABLE OUTCOME → KPI."
 *
 * Measures (NO writes, NO DDL):
 *   - canonical outcome/KPI model size (spine length, outcome-type count, KPI-family count,
 *     lifecycle-rule count, path/persona count),
 *   - per-path status distribution + evidence VERIFIED against the live filesystem + DB,
 *   - per-outcome-type + per-KPI-family coverage (substrate present/absent/unknown),
 *   - per-axis mapping coverage + spine reachability rollup,
 *   - recommendation/intervention EFFECTIVENESS substrate (rate honest-null/abstained),
 *   - classified gaps + rollup + STRUCTURAL verdict,
 *   - outcome-loop ADOPTION + persona⟂outcome read-time-join linkage
 *     (Adoption⟂Coverage⟂Confidence⟂Outcome never composited).
 *
 * Emits `backend/audit/capadex-3.0-outcome-kpi/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-1.6-outcome-kpi-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  OUTCOME_MODEL,
  OUTCOME_SPINE,
  OUTCOME_TYPES,
  KPI_FAMILIES,
  LIFECYCLE_OUTCOME_RULES,
  OUTCOME_KPI_AXES,
  OUTCOME_KPI_DECISIONS,
} from '../config/outcome-kpi-model';
import {
  composeCoverage,
  composeOutcomeTypeCoverage,
  composeKpiCoverage,
  composeEffectiveness,
  composeOutcomeAdoption,
  composePersonaOutcomeLinkage,
  composeSummary,
  OUTCOME_KPI_GAPS,
  RESOLVED_OUTCOME_KPI_GAPS,
} from '../services/outcome-kpi-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await composeCoverage(pool);
    const outcome_type_coverage = await composeOutcomeTypeCoverage(pool);
    const kpi_coverage = await composeKpiCoverage(pool);
    const effectiveness = await composeEffectiveness(pool);
    const adoption = await composeOutcomeAdoption(pool);
    const persona_linkage = await composePersonaOutcomeLinkage(pool);
    const summary = await composeSummary(pool);

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      spine_frozen: true,
      axes: OUTCOME_KPI_AXES,
      spine_step_count: OUTCOME_SPINE.length,
      outcome_type_count: OUTCOME_TYPES.length,
      kpi_family_count: KPI_FAMILIES.length,
      lifecycle_rule_count: LIFECYCLE_OUTCOME_RULES.length,
      path_count: OUTCOME_MODEL.length,
      // Full registry payload embedded so the deliverable generator reads ONLY scan.json
      // (single measurement artifact → docs can never drift from the scan).
      spine: OUTCOME_SPINE,
      outcome_types: OUTCOME_TYPES,
      kpi_families: KPI_FAMILIES,
      lifecycle_rules: LIFECYCLE_OUTCOME_RULES,
      paths: OUTCOME_MODEL,
      decisions: OUTCOME_KPI_DECISIONS,
      coverage,
      outcome_type_coverage,
      kpi_coverage,
      effectiveness,
      gaps: OUTCOME_KPI_GAPS,
      // Chain mechanisms REUSED (not rebuilt) — traceability; residual is ADOPTION/CONFIDENCE, never a gap.
      resolved_gaps: RESOLVED_OUTCOME_KPI_GAPS,
      summary,
      // Outcome-loop ADOPTION + persona⟂outcome linkage (read-only; Adoption⟂Coverage⟂Outcome never composited).
      adoption,
      persona_linkage,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.0-outcome-kpi');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    // Console summary (human glance).
    console.log('── CAPADEX 1.6 Outcome Framework / KPI Engine scan ──');
    console.log(`spine steps: ${out.spine_step_count}  outcome types: ${out.outcome_type_count}  kpi families: ${out.kpi_family_count}  lifecycle rules: ${out.lifecycle_rule_count}  paths: ${out.path_count}  personas: ${summary.persona_count}`);
    console.log('status:', JSON.stringify(summary.status_counts));
    console.log('evidence rollup:', JSON.stringify(summary.evidence_rollup));
    console.log('spine rollup:', JSON.stringify(summary.spine_rollup));
    console.log('outcome-type rollup:', JSON.stringify(summary.outcome_type_rollup));
    console.log('kpi-family rollup:', JSON.stringify(summary.kpi_family_rollup));
    console.log('gap counts:', JSON.stringify(summary.gap_counts));
    console.log('verdict:', summary.enterprise_ready.verdict);
    console.log('effectiveness:', JSON.stringify({
      rec_rows: effectiveness.recommendation.substrate_rows,
      int_rows: effectiveness.intervention.substrate_rows,
      realized: effectiveness.realized_outcomes,
      rate: effectiveness.recommendation.effectiveness_rate,
    }));
    console.log('adoption:', JSON.stringify({
      realized: adoption.realized_outcomes,
      subjects: adoption.outcome_subjects,
      progressed: adoption.progressed_subjects,
      mastery: adoption.mastery_subjects,
      reassessed: adoption.reassessed_subjects,
      kpi_rows: adoption.kpi_rows,
    }));
    for (const c of coverage) {
      const e = c.evidence;
      console.log(
        `  ${c.key.padEnd(24)} ${c.status.padEnd(10)} ` +
        `spine ${c.spineReached}/${c.spineTotal} axes ${c.axesMapped}/${c.axesTotal} ` +
        `out ${c.outcomeTypes} kpi ${c.kpiFamilies} ` +
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

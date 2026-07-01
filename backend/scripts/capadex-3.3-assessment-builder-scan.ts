/**
 * CAPADEX 3.0 — Program 3 · Phase 3.3 Enterprise Assessment Builder CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical builder model size (7 dimensions, 7 designer actions, 10 structure levels, …),
 *   - SEVEN INDEPENDENT certification dimensions, each verified vs the live filesystem + DB:
 *       builder · blueprint · validation · version_management · publishing · apis · frontend,
 *   - a SEPARATE adoption axis (real authored-assessment volume) + classified gaps
 *     (0 OPEN + 7 RESOLVED via reuse) + verdict.
 *
 * The SEVEN dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is AUTHORING ONLY (design/compose/configure/validate/version/approve/publish) — NOT
 * delivery/scoring/psychometrics.
 *
 * Emits `backend/audit/capadex-3.3-assessment-builder/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.3-assessment-builder-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  AB_AXES, AB_DIMENSIONS, DESIGNER_ACTIONS, STRUCTURE_LEVELS, COMPOSITION_CAPS,
  REUSABLE_TEMPLATES, BLUEPRINT_CAPS, RULE_TYPES, CONFIG_OPTIONS, VERSION_CAPABILITIES,
  VALIDATION_CHECKS, WORKFLOW_STATES, MAPPING_MODEL, AB_DECISIONS,
} from '../config/assessment-builder';
import {
  composeDimensions, composeDesignerActions, composeStructureLevels, composeCompositionCaps,
  composeTemplates, composeBlueprintCaps, composeRuleTypes, composeConfigOptions, composeVersioning,
  composeValidationChecks, composeWorkflow, composeMapping, composeRepositoryAlignment,
  composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-builder-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const designer_actions = composeDesignerActions();
    const structure_levels = composeStructureLevels();
    const composition = composeCompositionCaps();
    const templates = composeTemplates();
    const blueprint = await composeBlueprintCaps(pool);
    const rules = await composeRuleTypes(pool);
    const config = await composeConfigOptions(pool);
    const versioning = await composeVersioning(pool);
    const validation = await composeValidationChecks(pool);
    const workflow = await composeWorkflow(pool);
    const mapping = await composeMapping(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      scope: 'AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics',
      axes: AB_AXES,
      dimension_count: AB_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: AB_DIMENSIONS,
        designer_actions: DESIGNER_ACTIONS,
        structure_levels: STRUCTURE_LEVELS,
        composition_caps: COMPOSITION_CAPS,
        reusable_templates: REUSABLE_TEMPLATES,
        blueprint_caps: BLUEPRINT_CAPS,
        rule_types: RULE_TYPES,
        config_options: CONFIG_OPTIONS,
        version_capabilities: VERSION_CAPABILITIES,
        validation_checks: VALIDATION_CHECKS,
        workflow_states: WORKFLOW_STATES,
        mapping_model: MAPPING_MODEL,
        decisions: AB_DECISIONS,
      },
      // The SEVEN INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_designer_actions: designer_actions,
      axis_structure_levels: structure_levels,
      axis_composition: composition,
      axis_templates: templates,
      axis_blueprint: blueprint,
      axis_rules: rules,
      axis_config: config,
      axis_versioning: versioning,
      axis_validation: validation,
      axis_workflow: workflow,
      axis_mapping: mapping,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: 0 OPEN + 7 RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.3-assessment-builder');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: any) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.3 Enterprise Assessment Builder certification scan ──');
    console.log(`dimensions: ${out.dimension_count}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM designer-actions:', sc(designer_actions.status_counts), `count=${designer_actions.count}`);
    console.log('DIM structure:', sc(structure_levels.status_counts), `count=${structure_levels.count}`);
    console.log('DIM composition:', sc(composition.status_counts), `count=${composition.count}`);
    console.log('DIM templates:', sc(templates.status_counts), `count=${templates.count}`);
    console.log('DIM blueprint:', sc(blueprint.status_counts), `caps=${blueprint.count}`);
    console.log('DIM rules:', sc(rules.status_counts), `types=${rules.count}`);
    console.log('DIM config:', sc(config.status_counts), `options=${config.count}`);
    console.log('DIM versioning:', sc(versioning.status_counts), `caps=${versioning.count}`);
    console.log('DIM validation:', sc(validation.status_counts), `checks=${validation.count}`);
    console.log('DIM workflow:', sc(workflow.status_counts), `states=${workflow.count}`);
    console.log('repository-alignment:', JSON.stringify({
      services: repository_alignment.services, routes: repository_alignment.routes,
      frontend: repository_alignment.frontend, tables: repository_alignment.tables,
    }));
    console.log('gap counts:', JSON.stringify(gap_counts), `total=${out.gap_total} resolved=${resolved_gap_count}`);
    console.log('verdict:', summary.enterprise_ready.verdict);
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

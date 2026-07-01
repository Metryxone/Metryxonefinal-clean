/**
 * CAPADEX 3.0 — Program 3 · Phase 3.1 Assessment Architecture CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical architecture model size (13 layers, 2 families, 10-type taxonomy, crosswalk),
 *   - FIVE INDEPENDENT certification axes, each verified vs the live filesystem + DB:
 *       architecture · lifecycle · governance · metadata · repository-alignment,
 *   - classified remaining ADDITIVE architecture gaps + rollup + certification verdict.
 *
 * The FIVE axes are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 *
 * Emits `backend/audit/program-3-phase-3.1-assessment-architecture/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.1-assessment-architecture-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  ARCHITECTURE_AXES,
  ARCHITECTURE_LAYERS,
  ASSESSMENT_FAMILIES,
  CANONICAL_TYPES,
  TYPE_CROSSWALK,
  ASSESSMENT_CATEGORIES,
  LIFECYCLE_STATES,
  LIFECYCLE_MAPPING,
  GOVERNANCE_CONTROLS,
  METADATA_STANDARD,
  METADATA_SOURCE_COVERAGE,
  MAPPING_MODEL,
  ARCHITECTURE_DECISIONS,
  OVERLAP_DECISIONS,
} from '../config/assessment-architecture';
import {
  composeArchitecture,
  composeLifecycle,
  composeGovernance,
  composeMetadata,
  composeRepositoryAlignment,
  composeSummary,
  classifiedGaps,
} from '../services/assessment-architecture-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const architecture = await composeArchitecture(pool);
    const lifecycle = await composeLifecycle(pool);
    const governance = await composeGovernance(pool);
    const metadata = await composeMetadata(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      architecture_frozen: true,
      axes: ARCHITECTURE_AXES,
      layer_count: ARCHITECTURE_LAYERS.length,
      family_count: ASSESSMENT_FAMILIES.length,
      type_count: CANONICAL_TYPES.length,
      // Full registry payload embedded so the deliverable generator reads ONLY scan.json
      // (single measurement artifact → docs can never drift from the scan).
      registry: {
        layers: ARCHITECTURE_LAYERS,
        families: ASSESSMENT_FAMILIES,
        taxonomy: CANONICAL_TYPES,
        type_crosswalk: TYPE_CROSSWALK,
        categories: ASSESSMENT_CATEGORIES,
        lifecycle_states: LIFECYCLE_STATES,
        lifecycle_mapping: LIFECYCLE_MAPPING,
        governance_controls: GOVERNANCE_CONTROLS,
        metadata_standard: METADATA_STANDARD,
        metadata_source_coverage: METADATA_SOURCE_COVERAGE,
        mapping_model: MAPPING_MODEL,
        decisions: ARCHITECTURE_DECISIONS,
        overlaps: OVERLAP_DECISIONS,
      },
      // The five INDEPENDENT certification axes (never composited).
      axis_architecture: architecture,
      axis_lifecycle: lifecycle,
      axis_governance: governance,
      axis_metadata: metadata,
      axis_repository_alignment: repository_alignment,
      // Classified remaining ADDITIVE gaps (honest OPEN work; 0 Launch-Critical / 0 High).
      gaps,
      gap_counts,
      gap_total: gaps.length,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'program-3-phase-3.1-assessment-architecture');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    // Console summary (human glance).
    console.log('── CAPADEX 3.1 Assessment Architecture certification scan ──');
    console.log(`layers: ${out.layer_count}  families: ${out.family_count}  types: ${out.type_count}  crosswalk: ${TYPE_CROSSWALK.length}`);
    console.log('AXIS architecture status:', JSON.stringify(architecture.status_counts));
    console.log('AXIS lifecycle mapping status:', JSON.stringify(lifecycle.mapping_status_counts), `states=${lifecycle.state_count}`);
    console.log('AXIS governance status:', JSON.stringify(governance.status_counts), `controls=${governance.control_count}`);
    console.log('AXIS metadata:', `fields=${metadata.field_count} covered=${metadata.fields_covered} sources=${metadata.sources.length}`);
    console.log('AXIS repository-alignment:', JSON.stringify({
      services: repository_alignment.services, routes: repository_alignment.routes,
      frontend: repository_alignment.frontend, tables: repository_alignment.tables,
    }));
    console.log('gap counts:', JSON.stringify(gap_counts), `total=${out.gap_total}`);
    console.log('verdict:', summary.enterprise_ready.verdict);
    for (const l of architecture.layers) {
      const e = l.evidence;
      console.log(
        `  L${String(l.layer).padStart(2)} ${l.key.padEnd(20)} ${l.status.padEnd(10)} ` +
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

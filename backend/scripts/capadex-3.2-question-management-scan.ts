/**
 * CAPADEX 3.0 — Program 3 · Phase 3.2 Enterprise Question Management Platform CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical platform model size (8 dimensions, 29 types, 35 metadata fields, 9 lifecycle states, …),
 *   - EIGHT INDEPENDENT certification dimensions, each verified vs the live filesystem + DB:
 *       platform · library · metadata · governance · version_management · workflow · apis · frontend,
 *   - a SEPARATE adoption axis (real question volume) + classified gaps (0 OPEN + 8 RESOLVED) + verdict.
 *
 * The EIGHT dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 *
 * Emits `backend/audit/capadex-3.2-question-management/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.2-question-management-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  QMP_AXES, QMP_DIMENSIONS, QUESTION_TYPES, METADATA_STANDARD, METADATA_SOURCE_COVERAGE,
  LIFECYCLE_STATES, LIFECYCLE_MAPPING, GOVERNANCE_CONTROLS, VERSION_CAPABILITIES, WORKFLOW_STAGES,
  SEARCH_CAPABILITIES, BULK_OPERATIONS, LIBRARY_SCOPES, MAPPING_MODEL, QMP_DECISIONS,
} from '../config/question-management-platform';
import {
  composeDimensions, composeTypeCatalog, composeMetadata, composeLifecycle, composeGovernance,
  composeVersioning, composeWorkflow, composeSearch, composeBulkOps, composeLibrary,
  composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/question-management-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const type_catalog = composeTypeCatalog();
    const metadata = await composeMetadata(pool);
    const lifecycle = await composeLifecycle(pool);
    const governance = await composeGovernance(pool);
    const versioning = await composeVersioning(pool);
    const workflow = await composeWorkflow(pool);
    const search = await composeSearch(pool);
    const bulk_ops = await composeBulkOps(pool);
    const library = await composeLibrary(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      axes: QMP_AXES,
      dimension_count: QMP_DIMENSIONS.length,
      type_count: QUESTION_TYPES.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: QMP_DIMENSIONS,
        question_types: QUESTION_TYPES,
        metadata_standard: METADATA_STANDARD,
        metadata_source_coverage: METADATA_SOURCE_COVERAGE,
        lifecycle_states: LIFECYCLE_STATES,
        lifecycle_mapping: LIFECYCLE_MAPPING,
        governance_controls: GOVERNANCE_CONTROLS,
        version_capabilities: VERSION_CAPABILITIES,
        workflow_stages: WORKFLOW_STAGES,
        search_capabilities: SEARCH_CAPABILITIES,
        bulk_operations: BULK_OPERATIONS,
        library_scopes: LIBRARY_SCOPES,
        mapping_model: MAPPING_MODEL,
        decisions: QMP_DECISIONS,
      },
      // The EIGHT INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_type_catalog: type_catalog,
      axis_metadata: metadata,
      axis_lifecycle: lifecycle,
      axis_governance: governance,
      axis_versioning: versioning,
      axis_workflow: workflow,
      axis_search: search,
      axis_bulk_ops: bulk_ops,
      axis_library: library,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: 0 OPEN + 8 RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.2-question-management');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: any) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.2 Question Management Platform certification scan ──');
    console.log(`dimensions: ${out.dimension_count}  types: ${out.type_count}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM types:', sc(type_catalog.status_counts));
    console.log('DIM metadata:', `fields=${metadata.field_count} covered=${metadata.fields_covered} sources=${metadata.sources.length}`);
    console.log('DIM lifecycle:', sc(lifecycle.mapping_status_counts), `states=${lifecycle.state_count}`);
    console.log('DIM governance:', sc(governance.status_counts), `controls=${governance.count}`);
    console.log('DIM versioning:', sc(versioning.status_counts), `caps=${versioning.count}`);
    console.log('DIM workflow:', sc(workflow.status_counts), `stages=${workflow.count}`);
    console.log('DIM search:', sc(search.status_counts), '| bulk:', sc(bulk_ops.status_counts));
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

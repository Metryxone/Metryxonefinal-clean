/**
 * CAPADEX 3.0 — Program 1 · Phase 1.3 Assessment Framework Completion
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical taxonomy size + status distribution,
 *   - per-type evidence VERIFIED against the live filesystem + DB (present/absent/unknown),
 *   - per-axis mapping coverage,
 *   - classified gaps + rollup + enterprise-ready verdict.
 *
 * Emits `backend/audit/capadex-3.0-assessment-framework/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-1.3-assessment-framework-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { ASSESSMENT_FRAMEWORK, SPEC_19_CROSSWALK, ASSESSMENT_AXES, KNOWN_OVERLAPS } from '../config/assessment-framework';
import { composeCoverage, composeSummary, ASSESSMENT_GAPS } from '../services/assessment-framework-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await composeCoverage(pool);
    const summary = await composeSummary(pool);

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      taxonomy_frozen: true,
      axes: ASSESSMENT_AXES,
      canonical_type_count: ASSESSMENT_FRAMEWORK.length,
      spec_name_count: SPEC_19_CROSSWALK.length,
      // Full registry payload embedded so the deliverable generator reads ONLY scan.json
      // (single measurement artifact → docs can never drift from the scan).
      framework: ASSESSMENT_FRAMEWORK,
      crosswalk: SPEC_19_CROSSWALK,
      known_overlaps: KNOWN_OVERLAPS,
      coverage,
      gaps: ASSESSMENT_GAPS,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.0-assessment-framework');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    // Console summary (human glance).
    console.log('── CAPADEX 1.3 Assessment Framework scan ──');
    console.log(`canonical types: ${out.canonical_type_count}  spec names: ${out.spec_name_count}`);
    console.log('status:', JSON.stringify(summary.status_counts));
    console.log('evidence rollup:', JSON.stringify(summary.evidence_rollup));
    console.log('gap counts:', JSON.stringify(summary.gap_counts));
    console.log('verdict:', summary.enterprise_ready.verdict);
    for (const c of coverage) {
      const e = c.evidence;
      console.log(
        `  ${c.key.padEnd(12)} ${c.status.padEnd(12)} ` +
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

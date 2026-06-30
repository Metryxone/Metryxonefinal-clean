/**
 * CAPADEX 3.0 — Program 1 · Phase 1.4 Customer Journey Completion & Experience Orchestration
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical journey model size (spine length, template count, journey count, persona count),
 *   - per-journey status distribution + evidence VERIFIED against the live filesystem + DB (present/absent/unknown),
 *   - per-axis mapping coverage + spine reachability rollup,
 *   - classified journey gaps + rollup + enterprise-ready verdict,
 *   - outcome-tail ADOPTION + persona⟂outcome read-time-join linkage (Adoption⟂Coverage⟂Outcome never composited).
 *
 * Emits `backend/audit/capadex-3.0-customer-journey/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-1.4-customer-journey-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  CUSTOMER_JOURNEY_MODEL,
  CANONICAL_SPINE,
  JOURNEY_TEMPLATES,
  JOURNEY_AXES,
  DUPLICATE_ENTRANCES,
} from '../config/customer-journey';
import {
  composeCoverage,
  composeSummary,
  composeOutcomeTailAdoption,
  composePersonaOutcomeLinkage,
  JOURNEY_GAPS,
} from '../services/customer-journey-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await composeCoverage(pool);
    const summary = await composeSummary(pool);
    const outcome_tail = await composeOutcomeTailAdoption(pool);
    const persona_linkage = await composePersonaOutcomeLinkage(pool);

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      spine_frozen: true,
      axes: JOURNEY_AXES,
      spine_step_count: CANONICAL_SPINE.length,
      template_count: JOURNEY_TEMPLATES.length,
      journey_count: CUSTOMER_JOURNEY_MODEL.length,
      // Full registry payload embedded so the deliverable generator reads ONLY scan.json
      // (single measurement artifact → docs can never drift from the scan).
      spine: CANONICAL_SPINE,
      templates: JOURNEY_TEMPLATES,
      journeys: CUSTOMER_JOURNEY_MODEL,
      duplicate_entrances: DUPLICATE_ENTRANCES,
      coverage,
      gaps: JOURNEY_GAPS,
      summary,
      // Close-the-loop ADOPTION + persona⟂outcome linkage (read-only, Adoption⟂Coverage⟂Outcome never composited).
      outcome_tail,
      persona_linkage,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.0-customer-journey');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    // Console summary (human glance).
    console.log('── CAPADEX 1.4 Customer Journey scan ──');
    console.log(`spine steps: ${out.spine_step_count}  templates: ${out.template_count}  journeys: ${out.journey_count}  personas: ${summary.persona_count}`);
    console.log('status:', JSON.stringify(summary.status_counts));
    console.log('evidence rollup:', JSON.stringify(summary.evidence_rollup));
    console.log('spine rollup:', JSON.stringify(summary.spine_rollup));
    console.log('gap counts:', JSON.stringify(summary.gap_counts));
    console.log('verdict:', summary.enterprise_ready.verdict);
    console.log('outcome-tail adoption:', JSON.stringify({
      progression: outcome_tail.progression_subjects,
      exit: outcome_tail.exit_subjects,
      reassessed: outcome_tail.reassessed_subjects,
      realized: outcome_tail.realized_outcomes,
    }));
    for (const c of coverage) {
      const e = c.evidence;
      console.log(
        `  ${c.key.padEnd(22)} ${c.status.padEnd(10)} ` +
        `spine ${c.spineReached}/${c.spineTotal} axes ${c.axesMapped}/${c.axesTotal} ` +
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

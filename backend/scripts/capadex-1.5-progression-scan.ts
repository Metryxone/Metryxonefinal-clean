/**
 * CAPADEX 3.0 — Program 1 · Phase 1.5 Progression Engine Completion & Continuous Growth
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Answers: "Is CAPADEX capable of measurable, continuous customer growth?"
 *
 * Measures (NO writes, NO DDL):
 *   - canonical progression model size (spine length, invariant count, promotion-rule count, path/persona count),
 *   - per-path status distribution + evidence VERIFIED against the live filesystem + DB (present/absent/unknown),
 *   - per-axis mapping coverage + spine reachability rollup,
 *   - loop-closure invariant coverage (the 4 close-the-loop edges, mechanism-present),
 *   - classified progression gaps + rollup + STRUCTURAL verdict,
 *   - growth-loop ADOPTION + persona⟂progression read-time-join linkage (Adoption⟂Coverage⟂Outcome never composited).
 *
 * Emits `backend/audit/capadex-3.0-progression/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-1.5-progression-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  PROGRESSION_MODEL,
  PROGRESSION_SPINE,
  LOOP_CLOSURE_INVARIANTS,
  LIFECYCLE_PROMOTION_RULES,
  PROGRESSION_AXES,
  PROGRESSION_DECISIONS,
} from '../config/progression-model';
import {
  composeCoverage,
  composeSummary,
  composeLoopClosure,
  composeProgressionAdoption,
  composePersonaProgressionLinkage,
  PROGRESSION_GAPS,
  RESOLVED_PROGRESSION_GAPS,
} from '../services/progression-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await composeCoverage(pool);
    const summary = await composeSummary(pool);
    const loop_closure = await composeLoopClosure(pool);
    const adoption = await composeProgressionAdoption(pool);
    const persona_linkage = await composePersonaProgressionLinkage(pool);

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      spine_frozen: true,
      axes: PROGRESSION_AXES,
      spine_step_count: PROGRESSION_SPINE.length,
      invariant_count: LOOP_CLOSURE_INVARIANTS.length,
      promotion_rule_count: LIFECYCLE_PROMOTION_RULES.length,
      path_count: PROGRESSION_MODEL.length,
      // Full registry payload embedded so the deliverable generator reads ONLY scan.json
      // (single measurement artifact → docs can never drift from the scan).
      spine: PROGRESSION_SPINE,
      invariants: LOOP_CLOSURE_INVARIANTS,
      promotion_rules: LIFECYCLE_PROMOTION_RULES,
      paths: PROGRESSION_MODEL,
      decisions: PROGRESSION_DECISIONS,
      coverage,
      gaps: PROGRESSION_GAPS,
      // Phase 1.5 mechanisms reused (not rebuilt) — traceability; residual is ADOPTION, never a gap.
      resolved_gaps: RESOLVED_PROGRESSION_GAPS,
      summary,
      // Loop-closure coverage (4 invariants) + growth-loop ADOPTION + persona⟂progression linkage
      // (read-only, Adoption⟂Coverage⟂Outcome never composited).
      loop_closure,
      adoption,
      persona_linkage,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.0-progression');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    // Console summary (human glance).
    console.log('── CAPADEX 1.5 Progression Engine scan ──');
    console.log(`spine steps: ${out.spine_step_count}  invariants: ${out.invariant_count}  promotion rules: ${out.promotion_rule_count}  paths: ${out.path_count}  personas: ${summary.persona_count}`);
    console.log('status:', JSON.stringify(summary.status_counts));
    console.log('evidence rollup:', JSON.stringify(summary.evidence_rollup));
    console.log('spine rollup:', JSON.stringify(summary.spine_rollup));
    console.log('loop closure:', JSON.stringify(summary.loop_closure));
    console.log('gap counts:', JSON.stringify(summary.gap_counts));
    console.log('verdict:', summary.enterprise_ready.verdict);
    console.log('adoption:', JSON.stringify({
      progressed: adoption.progressed_subjects,
      mastery: adoption.mastery_subjects,
      reassessed: adoption.reassessed_subjects,
      trend: adoption.trend_subjects,
      realized: adoption.realized_outcomes,
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

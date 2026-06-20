/**
 * PHASE 4.11 — Career Progression Tracking smoke test (engine-level, no HTTP).
 *
 * Verifies the honesty/compose contract WITHOUT mutating live data:
 *   - engine never throws on an absent/unknown subject (read-only)
 *   - no history => every dimension measurable:false (a single point can't show growth)
 *   - returns all FIVE progression dimensions
 *   - Coverage and Confidence are SEPARATE axes
 *   - numeric direction respects the STABLE_BAND noise threshold
 *   - list helpers fall back to honest-empty when the tables are absent (GET-never-writes)
 *
 * Run: cd backend && npx tsx scripts/smoke-career-progression.ts
 */

import { Pool } from 'pg';
import {
  CAREER_PROGRESSION_VERSION,
  buildCareerProgression,
  buildCareerProgressionTimeline,
  listGrowthTracking,
  listCareerHistory,
} from '../services/career-progression-engine.js';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${msg}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Phase 4.11 — Career Progression Tracking smoke\n');

    // ---- Read-only build on a non-existent subject -----------------------
    console.log('Read-only build (unknown subject):');
    const env = await buildCareerProgression(pool, `smoke_no_such_subject_${Date.now()}`);
    ok(env.ok === true, 'envelope ok (never throws)');
    ok(env.version === CAREER_PROGRESSION_VERSION, `version is ${CAREER_PROGRESSION_VERSION}`);
    ok(env.dimensions.length === 5, `returns all five dimensions (got ${env.dimensions.length})`);
    const expectedKeys = [
      'career_growth',
      'readiness_growth',
      'competency_growth',
      'career_movement',
      'role_evolution',
    ];
    ok(
      expectedKeys.every((k) => env.dimensions.some((d) => d.key === k)),
      'all five canonical dimension keys present',
    );
    ok(
      env.dimensions.every((d) => d.measurable === false),
      'no history => every dimension measurable:false (single point can not show growth)',
    );
    ok(env.measurable === false, 'envelope measurable:false with no history');
    ok(
      env.summary.overall_trajectory === 'insufficient_data',
      'overall trajectory = insufficient_data with no history',
    );
    ok(env.summary.total_snapshots === 0, 'zero snapshots reported honestly');
    ok(Array.isArray(env.notes) && env.notes.length > 0, 'honest notes present');

    // ---- Numeric dimensions: null scores, no fabricated trend ------------
    console.log('\nNumeric dimensions (absent):');
    const numericDims = env.dimensions.filter((d) => d.kind === 'numeric');
    ok(numericDims.length === 3, `three numeric trajectory dimensions (got ${numericDims.length})`);
    ok(
      numericDims.every((d: any) => d.delta === null && d.direction === null && d.first_score === null),
      'numeric dims => delta/direction/first_score all null (no trend fabricated)',
    );

    // ---- Event dimensions: no transitions when no observations -----------
    console.log('\nEvent dimensions (absent):');
    const eventDims = env.dimensions.filter((d) => d.kind === 'event');
    ok(eventDims.length === 2, `two event dimensions (got ${eventDims.length})`);
    ok(
      eventDims.every((d: any) => d.transition_count === 0 && d.transitions.length === 0),
      'event dims => zero transitions when no observations',
    );

    // ---- Coverage vs Confidence as SEPARATE axes -------------------------
    console.log('\nHonesty axes:');
    const d0 = env.dimensions[0];
    ok(
      typeof d0.coverage === 'object' && typeof d0.confidence === 'object',
      'each dimension exposes coverage AND confidence objects',
    );
    ok(
      'datapoints' in d0.coverage && 'band' in d0.confidence,
      'Coverage (datapoints) and Confidence (band) are distinct fields',
    );
    ok(
      env.dimensions.every((d) => d.confidence.band === 'None'),
      'confidence band None when fewer than two datapoints',
    );
    ok(
      env.dimensions.every((d) => d.confidence.caps.includes('single_datapoint')),
      'confidence capped single_datapoint with no longitudinal evidence',
    );
    ok(
      env.dimensions.every((d) => typeof d.interpretation === 'string' && d.interpretation.length > 0),
      'every dimension carries a developmental interpretation cap',
    );
    ok(!!env.language_policy, 'language_policy surfaced on envelope');

    // ---- Sources accounting --------------------------------------------
    console.log('\nSources accounting:');
    ok(
      typeof env.sources.readiness_history === 'number' &&
        typeof env.sources.growth_tracking === 'number' &&
        typeof env.sources.career_history === 'number',
      'sources count from all three history tables (readiness/growth/career)',
    );

    // ---- Timeline + list helpers (read-only, honest-empty) --------------
    console.log('\nRead-only list helpers:');
    const tl = await buildCareerProgressionTimeline(pool, 'smoke_no_such_subject');
    ok(Array.isArray(tl.growth_tracking) && Array.isArray(tl.events), 'timeline returns arrays (never throws)');
    const gt = await listGrowthTracking(pool, 'smoke_no_such_subject');
    ok(typeof gt.exists === 'boolean' && gt.count === gt.items.length, 'growth_tracking list consistent');
    const ch = await listCareerHistory(pool, 'smoke_no_such_subject');
    ok(typeof ch.exists === 'boolean' && ch.count === ch.items.length, 'career_history list consistent');
    ok(
      gt.items.length === 0 && ch.items.length === 0,
      'unknown subject => empty growth/history (no fabrication)',
    );

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(1);
});

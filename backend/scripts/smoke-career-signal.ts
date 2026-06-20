/**
 * PHASE 4.10 — Career Signal Engine smoke test (engine-level, no HTTP).
 *
 * Verifies the honesty/compose contract WITHOUT mutating live data:
 *   - defaults catalogue is the canonical seven signals
 *   - engine never throws on an absent/unknown subject (read-only)
 *   - absent data => measurable:false + score:null (never fabricated)
 *   - Coverage and Confidence are SEPARATE axes
 *   - banding maps deterministically; risk/potential polarity respected
 *   - config readers fall back to in-code defaults (GET-never-writes)
 *
 * Run: cd backend && npx tsx scripts/smoke-career-signal.ts
 */

import { Pool } from 'pg';
import {
  DEFAULT_SIGNAL_LIBRARY,
  DEFAULT_SIGNAL_RULES,
  CAREER_SIGNAL_VERSION,
  buildCareerSignals,
  buildCareerSignal,
  listSignalLibrary,
  getSignalRules,
} from '../services/career-signal-engine.js';

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
    console.log('Phase 4.10 — Career Signal Engine smoke\n');

    // ---- Defaults catalogue ----------------------------------------------
    console.log('Defaults catalogue:');
    const keys = DEFAULT_SIGNAL_LIBRARY.map((s) => s.signal_key);
    const expected = [
      'career_potential',
      'leadership_potential',
      'technical_potential',
      'growth_potential',
      'promotion_potential',
      'career_risk',
      'career_stagnation_risk',
    ];
    ok(keys.length === 7, `seven signals defined (got ${keys.length})`);
    ok(expected.every((k) => keys.includes(k)), 'all seven canonical signal keys present');
    ok(
      DEFAULT_SIGNAL_LIBRARY.filter((s) => s.category === 'potential').length === 5,
      'five potential signals',
    );
    ok(
      DEFAULT_SIGNAL_LIBRARY.filter((s) => s.category === 'risk').length === 2,
      'two risk signals',
    );
    ok(
      DEFAULT_SIGNAL_LIBRARY.every((s) => s.inputs.length > 0),
      'every signal declares at least one input',
    );
    const growth = DEFAULT_SIGNAL_LIBRARY.find((s) => s.signal_key === 'growth_potential')!;
    ok(
      growth.inputs.length === 1 && growth.inputs[0].source === 'ei' && growth.inputs[0].metric === 'growth',
      'Growth Potential composes EI growth_potential DIRECTLY (no recompute)',
    );
    const risk = DEFAULT_SIGNAL_LIBRARY.find((s) => s.signal_key === 'career_risk')!;
    ok(
      risk.inputs.some((i) => i.transform === 'invert'),
      'Career Risk inverts a potential measure (polarity respected)',
    );
    ok(
      DEFAULT_SIGNAL_RULES.bands.potential.length >= 3 && DEFAULT_SIGNAL_RULES.bands.risk.length >= 2,
      'default banding rules present for both categories',
    );

    // ---- Read-only build on a non-existent subject ------------------------
    console.log('\nRead-only build (unknown subject):');
    const env = await buildCareerSignals(pool, `smoke_no_such_subject_${Date.now()}`);
    ok(env.ok === true, 'envelope ok (never throws)');
    ok(env.version === CAREER_SIGNAL_VERSION, `version is ${CAREER_SIGNAL_VERSION}`);
    ok(env.signals.length === 7, `returns all seven signals (got ${env.signals.length})`);
    ok(
      env.signals.every((s) => !s.measurable && s.score === null),
      'absent data => every signal measurable:false + score:null (never fabricated)',
    );
    ok(
      env.signals.every((s) => s.band === null),
      'no band assigned when score is null',
    );
    ok(env.measurable === false, 'envelope measurable:false with no data');
    ok(
      env.summary.top_potential === null && env.summary.top_risk === null,
      'no top potential/risk when nothing measurable',
    );
    ok(Array.isArray(env.notes) && env.notes.length > 0, 'honest notes present');

    // ---- Coverage vs Confidence as SEPARATE axes -------------------------
    console.log('\nHonesty axes:');
    const s0 = env.signals[0];
    ok(
      typeof s0.coverage === 'object' && typeof s0.confidence === 'object',
      'each signal exposes coverage AND confidence objects',
    );
    ok(
      'coverage_pct' in s0.coverage && 'band' in s0.confidence,
      'Coverage (coverage_pct) and Confidence (band) are distinct fields',
    );
    ok(
      s0.confidence.caps.includes('not_measurable'),
      'confidence capped not_measurable when no input present',
    );
    ok(
      env.signals.every((s) => typeof s.interpretation === 'string' && s.interpretation.length > 0),
      'every signal carries a developmental interpretation cap',
    );
    ok(!!env.language_policy, 'language_policy surfaced on envelope');

    // ---- Single-signal accessor ------------------------------------------
    console.log('\nSingle-signal accessor:');
    const one = await buildCareerSignal(pool, 'smoke_no_such_subject', 'growth_potential');
    ok(one.signal?.signal_key === 'growth_potential', 'buildCareerSignal returns requested signal');
    const missing = await buildCareerSignal(pool, 'smoke_no_such_subject', 'does_not_exist');
    ok(missing.signal === null, 'unknown signal key => null (no fabrication)');

    // ---- Config readers fall back to defaults (GET-never-writes) ----------
    console.log('\nConfig readers (read-only fallback):');
    const lib = await listSignalLibrary(pool);
    ok(
      (lib.source === 'defaults' && lib.items.length === 7) || (lib.source === 'db' && lib.items.length > 0),
      `library source=${lib.source}, items=${lib.items.length}`,
    );
    const rules = await getSignalRules(pool);
    ok(
      !!rules.rules.bands.potential && !!rules.rules.bands.risk,
      `rules source=${rules.source}, has both band sets`,
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

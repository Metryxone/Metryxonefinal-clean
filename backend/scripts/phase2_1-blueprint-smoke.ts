/**
 * Phase 2.1 e2e smoke — Assessment Blueprint Engine (flag ON).
 * Derives a real mix (read-only) from an existing blueprint, authors the
 * Software Engineer example against a DEMO blueprint, validates good/bad mixes,
 * then DELETES every demo row. Idempotent.
 *
 *   FF_COMPETENCY_RUNTIME=1 tsx scripts/phase2_1-blueprint-smoke.ts
 */
process.env.FF_COMPETENCY_RUNTIME = '1';

import { Pool } from 'pg';
import {
  deriveDimensionMix, buildBlueprint, getDimensionMix, validateDimensionMix,
} from '../services/blueprint-builder.js';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';

const REAL_BP = process.env.SMOKE_BLUEPRINT || 'blueprint_be_eng';
const DEMO_BP = 'demo_p21_se_blueprint';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const log = (...a: any[]) => console.log(...a);
  log('flag isCompetencyRuntimeEnabled():', isCompetencyRuntimeEnabled());

  try {
    // ---- 1. DERIVE (read-only) from a real blueprint -----------------------
    const derived = await deriveDimensionMix(pool, REAL_BP);
    log('\n=== DERIVE (real, read-only):', REAL_BP, '===');
    log('ok:', derived.ok);
    if (derived.ok) {
      log('mix:', JSON.stringify(derived.mix));
      log('sum:', Object.values(derived.mix).reduce((a, b) => a + b, 0));
      log('coverage:', JSON.stringify(derived.coverage, null, 2));
    }

    // ---- 2. AUTHOR the Software Engineer example on a DEMO blueprint --------
    await pool.query(
      `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, source)
       VALUES ($1,$1,'DEMO Software Engineer (phase2.1 smoke)','authored')
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_BP],
    );
    const seExample = { behavioral: 15, cognitive: 25, functional: 20, technical: 35, future_skills: 5 };
    const authored = await buildBlueprint(pool, DEMO_BP, seExample);
    log('\n=== AUTHOR (Software Engineer example) ===');
    log('ok:', authored.ok, 'source:', (authored as any).source);
    log('mix:', JSON.stringify((authored as any).mix));
    log('validation:', JSON.stringify((authored as any).validation));

    // ---- 3. READ BACK -------------------------------------------------------
    const readback = await getDimensionMix(pool, DEMO_BP);
    log('\n=== READ BACK ===');
    log('exists:', readback.exists, 'source:', readback.source, 'mix:', JSON.stringify(readback.mix), 'valid:', readback.validation?.valid);

    // ---- 4. VALIDATION: good vs bad ----------------------------------------
    log('\n=== VALIDATE ===');
    log('SE example     ->', JSON.stringify(validateDimensionMix(seExample)));
    log('sums to 90     ->', JSON.stringify(validateDimensionMix({ behavioral: 10, cognitive: 25, functional: 20, technical: 30, future_skills: 5 })));
    log('missing dim    ->', JSON.stringify(validateDimensionMix({ behavioral: 50, cognitive: 50 })));
    log('out of range   ->', JSON.stringify(validateDimensionMix({ behavioral: 120, cognitive: -20, functional: 0, technical: 0, future_skills: 0 })));

    // ---- 5. AUTHOR an INVALID mix is rejected (not persisted) ---------------
    const rejected = await buildBlueprint(pool, DEMO_BP, { behavioral: 10, cognitive: 10, functional: 10, technical: 10, future_skills: 10 });
    log('\n=== REJECT invalid author ===');
    log('ok:', rejected.ok, 'error:', (rejected as any).error, 'sum:', (rejected as any).validation?.sum);
  } finally {
    await pool.query(`DELETE FROM onto_assessment_blueprints WHERE id = $1`, [DEMO_BP]); // cascades dimension_mix
    console.log('\ncleanup done (demo blueprint removed)');
    await pool.end();
  }
}
main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });

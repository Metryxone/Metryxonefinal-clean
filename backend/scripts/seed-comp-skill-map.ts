/**
 * Seed the comp_skill_map crosswalk — 98X Gap Closure, Phase 5 (reversible reference data).
 *
 * Usage:
 *   npx tsx scripts/seed-comp-skill-map.ts            # dry-run (no writes)
 *   npx tsx scripts/seed-comp-skill-map.ts --apply    # write/refresh (reversible by source)
 *   npx tsx scripts/seed-comp-skill-map.ts --rollback # delete every source=98x_phase5 row
 *
 * comp_skill_map is a DERIVED reference crosswalk (onto_competencies × cg_skill_requirements) —
 * no user data. Fully reversible. Inert at runtime until FF_COMPETENCY_SKILL_INTELLIGENCE=1.
 */
import { Pool } from 'pg';
import { seedCompSkillMap, rollbackCompSkillMap } from '../services/competency-skill-intelligence';

async function main() {
  const apply = process.argv.includes('--apply');
  const rollback = process.argv.includes('--rollback');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (rollback) {
      const r = await rollbackCompSkillMap(pool);
      console.log('[rollback]', JSON.stringify(r, null, 2));
      return;
    }
    const result = await seedCompSkillMap(pool, apply);
    console.log(`[seed${apply ? ':apply' : ':dry-run'}]`, JSON.stringify(result, null, 2));
    if (!apply) console.log('\n(no rows written — re-run with --apply to persist)');
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Task #145 — wire the Backend / Senior Backend Engineer role-DNA competencies
 * (those with approved + active questions) into each role's blueprint competency
 * map (lever 2 of the precise per-competency scoring gate) so generateAssessment
 * serves the comp-tagged questions and scoring is PRECISE.
 *
 * Thin wrapper. The single source of truth lives in
 * services/role-bridge-activation.ts and runs at boot (index.ts). This script
 * remains for manual/CLI runs against a target DATABASE_URL. Idempotent
 * (NOT EXISTS); pass --apply to write (default is a no-write report).
 */
import { Pool } from 'pg';
import { seedBlueprintWiring } from '../services/role-bridge-activation';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!apply) {
    console.log('DRY-RUN: pass --apply to wire role-DNA competencies into blueprints via the shared service.');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await seedBlueprintWiring(pool);
    r.notes.forEach((n) => console.log(n));
    console.log('\n' + '='.repeat(60));
    console.log(`APPLIED: ${r.blueprintsCreated} blueprints created, ${r.mapInserted} blueprint-competency rows wired, ${r.dnaCompsNoQ} DNA comps still without questions.`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

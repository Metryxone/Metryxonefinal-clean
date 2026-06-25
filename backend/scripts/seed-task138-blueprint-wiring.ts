/**
 * Task #138 — blueprint wiring (lever 2b). THIN CLI WRAPPER.
 *
 * The seed logic now lives in services/task138-competency-seed.ts (single source of truth,
 * shared with the idempotent backend-startup hook ensureTask138CompetencySeed). This wrapper
 * just runs the blueprint-wiring step against DATABASE_URL. Run with --apply to write; default
 * dry run. See the service file header for the full honesty/safety contract.
 */
import { Pool } from 'pg';
import { seedBlueprintWiring } from '../services/task138-competency-seed';

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await seedBlueprintWiring(pool, apply);
    console.log(r.summary.join('\n'));
    console.log('\n' + '='.repeat(60));
    console.log(`${apply ? 'APPLIED' : 'DRY-RUN'}: ${r.blueprintsCreated} blueprints created, ` +
      `${r.mapRows} blueprint-competency rows wired, ${r.skippedNoQ} role-DNA comps skipped (no approved questions → stay unmeasured).`);
    if (!apply) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

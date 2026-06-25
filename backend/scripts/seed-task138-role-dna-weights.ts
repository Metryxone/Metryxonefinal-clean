/**
 * Task #138 — role-DNA weights (lever 2a). THIN CLI WRAPPER.
 *
 * The seed logic now lives in services/task138-competency-seed.ts (single source of truth,
 * shared with the idempotent backend-startup hook ensureTask138CompetencySeed). This wrapper
 * just runs the role-DNA step against DATABASE_URL. Run with --apply to write; default dry run.
 * See the service file header for the full honesty/safety contract.
 */
import { Pool } from 'pg';
import { seedRoleDnaWeights } from '../services/task138-competency-seed';

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await seedRoleDnaWeights(pool, apply);
    console.log(r.summary.join('\n'));
    console.log('\n' + '='.repeat(60));
    console.log(`${apply ? 'APPLIED' : 'DRY-RUN'}: ${r.inserted} role-DNA weights added, ${r.skipped} skipped (existing/invalid).`);
    if (!apply) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

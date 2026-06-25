/**
 * Task #145 — bridge role_be_eng / role_sr_be_eng to the curated ontology role
 * library so the employer competency match reaches their curated Role DNA.
 *
 * Thin wrapper. The activation is now a self-running, idempotent boot seeder —
 * the single source of truth lives in services/role-bridge-activation.ts and runs
 * at startup (index.ts). This script remains for manual/CLI runs against a target
 * DATABASE_URL. It ensures the dedicated library roles exist, then resolves the
 * bridge. Idempotent; pass --apply to write (default is a no-write report).
 */
import { Pool } from 'pg';
import { ensureLibraryRoles, seedBridge } from '../services/role-bridge-activation';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!apply) {
    console.log('DRY-RUN: pass --apply to run the idempotent bridge activation via the shared service.');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const lib = await ensureLibraryRoles(pool);
    const bridge = await seedBridge(pool);
    [...lib.notes, ...bridge.notes].forEach((n) => console.log(n));
    console.log('\n' + '='.repeat(60));
    console.log(`APPLIED: ${lib.inserted} library roles ensured, ${bridge.set} bridge rows set, ${bridge.skipped} skipped.`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

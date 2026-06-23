/**
 * Smoke test — 98X Phase 1 materialize → list → ROLLBACK (proves reversibility).
 * Writes 2 provenance-stamped rows then deletes them, leaving the DB clean.
 * Run: FF_ROLE_DNA_EXPANSION=1 npx tsx scripts/smoke-role-dna-expansion-write.ts
 */
import { Pool } from 'pg';
import {
  materializeRoleDNA,
  listMaterialized,
  rollbackExpansion,
} from '../services/role-dna-expansion-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const mat = await materializeRoleDNA(pool, { roleCodes: ['ONET_15-1252.00', 'ROLE_SWE'] });
    console.log('MATERIALIZE:', JSON.stringify(mat, null, 2));

    const after = await listMaterialized(pool, 10);
    console.log('LIST after materialize (expect count 2):', JSON.stringify({ available: after.available, count: after.count, rows: after.rows }, null, 2));

    const rb = await rollbackExpansion(pool);
    console.log('ROLLBACK:', JSON.stringify(rb));

    const clean = await listMaterialized(pool, 10);
    console.log('LIST after rollback (expect count 0):', JSON.stringify({ available: clean.available, count: clean.count }, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('WRITE SMOKE FAILED:', e); process.exit(1); });

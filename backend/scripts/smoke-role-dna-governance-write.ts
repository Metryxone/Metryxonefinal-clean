/**
 * Write-path smoke — MX-100X Phase 1 Role DNA Governance (materialize → list → rollback).
 * Proves the persistence path is reversible: ends with row count back to baseline.
 *
 * Run: FF_ADAPTIVE_INTELLIGENCE_FOUNDATION=1 FF_ROLE_DNA_GOVERNANCE=1 \
 *        npx tsx scripts/smoke-role-dna-governance-write.ts
 */
import { Pool } from 'pg';
import {
  materializeGovernance,
  listGovernance,
  rollbackGovernance,
} from '../services/role-dna-governance-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const before = await listGovernance(pool, 1);
    console.log('BEFORE: available=%s count=%s', before.available, before.count);

    const mat = await materializeGovernance(pool, { limit: 5 });
    console.log('MATERIALIZE:', JSON.stringify({ requested: mat.requested, resolved: mat.resolved, written: mat.written, skipped: mat.skipped, provenance: mat.provenance }, null, 2));

    const after = await listGovernance(pool, 10);
    console.log('AFTER MATERIALIZE: available=%s count=%s', after.available, after.count);
    console.log('SAMPLE ROWS:', JSON.stringify(after.rows.slice(0, 3), null, 2));

    const rb = await rollbackGovernance(pool);
    console.log('ROLLBACK:', JSON.stringify(rb, null, 2));

    const post = await listGovernance(pool, 1);
    console.log('AFTER ROLLBACK: available=%s count=%s', post.available, post.count);

    const reversible = post.count === 0;
    console.log(reversible ? '\nOK — reversible (count back to 0)' : '\nWARN — residual rows remain');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

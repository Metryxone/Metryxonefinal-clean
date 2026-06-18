/**
 * Phase 1.5 — Role Competency Profile seed runner.
 *
 * Loads the example role competency profiles (real onto_roles + onto_competencies).
 * Idempotent: re-running inserts 0 new rows. Run FROM the backend dir:
 *   cd backend && npx tsx scripts/seed-role-competency-profile.ts
 */

import { Pool } from 'pg';
import { runRoleCompetencyProfileSeed } from '../services/role-competency-profile.js';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const result = await runRoleCompetencyProfileSeed(pool);
    // eslint-disable-next-line no-console
    console.log('[seed-role-competency-profile] result:', JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed-role-competency-profile] failed:', err?.message ?? err);
  process.exit(1);
});

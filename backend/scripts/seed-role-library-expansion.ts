/**
 * Role Library Expansion seed runner.
 *
 * Adds a curated set of common roles (Software Engineer, Frontend Engineer, Data
 * Analyst, Project Manager, …) with weight-balanced competency profiles so more
 * free-text job titles crosswalk to a matchable curated role. Idempotent:
 * re-running inserts 0 new rows. Run FROM the backend dir:
 *   cd backend && npx tsx scripts/seed-role-library-expansion.ts
 */

import { Pool } from 'pg';
import { runRoleLibraryExpansion } from '../services/role-library-expansion.js';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const result = await runRoleLibraryExpansion(pool);
    // eslint-disable-next-line no-console
    console.log('[seed-role-library-expansion] result:', JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed-role-library-expansion] failed:', err?.message ?? err);
  process.exit(1);
});

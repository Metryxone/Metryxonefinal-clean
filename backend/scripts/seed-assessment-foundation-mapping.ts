/**
 * Phase 1.6 — Assessment Foundation Mapping seed runner.
 *
 * Derives all three foundational mappings from EXISTING data:
 *   - Assessment blueprints + competency relationships <- onto_role_competency_profiles (Phase 1.5)
 *   - Role -> assessment blueprint map
 *   - Competency -> question map <- competency_question_templates (honestly 0 if none exist)
 *
 * Idempotent: re-running inserts 0 new rows. Run FROM the backend dir:
 *   cd backend && npx tsx scripts/seed-assessment-foundation-mapping.ts
 */

import { Pool } from 'pg';
import { runAssessmentFoundationSeed } from '../services/assessment-foundation-mapping.js';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const result = await runAssessmentFoundationSeed(pool);
    // eslint-disable-next-line no-console
    console.log('[seed-assessment-foundation-mapping] result:', JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed-assessment-foundation-mapping] failed:', err?.message ?? err);
  process.exit(1);
});

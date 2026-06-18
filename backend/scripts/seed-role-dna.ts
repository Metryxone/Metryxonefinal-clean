/**
 * Role-DNA competency seed — runner.
 *
 * Applies the curated `onto_*` competency ontology + Role DNA profiles/weights
 * (services/role-dna-seed.ts) so the Role DNA endpoint
 * (`GET /api/ontology/roles/:id/dna`) returns a non-empty weighted competency
 * vector in development. Idempotent (CREATE IF NOT EXISTS + ON CONFLICT DO
 * NOTHING) — safe to re-run.
 *
 * Usage: cd backend && npx tsx scripts/seed-role-dna.ts
 */
import { Pool } from 'pg';
import { runRoleDnaSeed } from '../services/role-dna-seed';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    console.log('Seeding curated Role-DNA competency profiles…');
    const result = await runRoleDnaSeed(pool);
    if (!result.ok) {
      console.error(`FAILED: ${result.error}`);
      process.exit(1);
    }
    console.log('\nTable counts:');
    console.log(`  onto_roles        ${result.counts.roles}`);
    console.log(`  onto_dna_profiles ${result.counts.dna_profiles}`);
    console.log(`  onto_role_weights ${result.counts.role_weights}`);
    console.log(`  onto_competencies ${result.counts.competencies}`);
    console.log('\nRoles with current DNA weights:');
    for (const r of result.rolesWithDna) {
      console.log(`  ${r.id.padEnd(22)} ${r.title.padEnd(26)} ${r.weights} weights`);
    }
    if (!result.rolesWithDna.length) {
      console.error('\nERROR: no roles have DNA weights after seeding.');
      process.exit(1);
    }
    console.log('\nOK');
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

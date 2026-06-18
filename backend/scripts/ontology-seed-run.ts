/**
 * Competency Ontology Starter Seed — runner.
 * Activates the curated, code-authored ontology (services/ontology-seed.ts) into
 * the DB. Idempotent (every INSERT is ON CONFLICT DO NOTHING); creates its own
 * tables via the ensure*Schema helpers. No fabricated content — this is the
 * starter taxonomy already authored by the team that simply never got seeded.
 *
 * Usage: cd backend && npx tsx scripts/ontology-seed-run.ts
 */
import { Pool } from 'pg';
import { runOntologySeed } from '../services/ontology-seed';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    console.log('Running competency ontology starter seed…');
    const result = await runOntologySeed(pool);
    console.log('\nPhase row counts:');
    for (const [phase, n] of Object.entries(result.phases)) {
      console.log(`  ${phase.padEnd(28)} ${n}`);
    }
    console.log(`\nTotal rows seeded: ${result.totalRows}`);
    console.log(`OK: ${result.ok}${result.error ? `  error: ${result.error}` : ''}`);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

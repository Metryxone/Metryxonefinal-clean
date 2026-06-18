/**
 * O*NET Competency Ontology importer — runner.
 * Expands the curated starter ontology (services/ontology-seed.ts) into a full
 * role / skill library sourced from the public-domain O*NET database.
 * Idempotent (every write is ON CONFLICT DO UPDATE / DO NOTHING) and additive —
 * starter rows (ROLE_*, C_*) use disjoint code namespaces and are untouched.
 *
 * Usage:
 *   cd backend && npx tsx scripts/onet-import-run.ts
 *   cd backend && npx tsx scripts/onet-import-run.ts --no-download   (require cached files)
 *   cd backend && IMPORTANCE_THRESHOLD=2.5 npx tsx scripts/onet-import-run.ts
 */
import { Pool } from 'pg';
import { runOnetImport } from '../services/onet-import';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function main() {
  const download = !process.argv.includes('--no-download');
  const thr = process.env.IMPORTANCE_THRESHOLD ? parseFloat(process.env.IMPORTANCE_THRESHOLD) : undefined;
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    console.log('Running O*NET ontology import…');
    const result = await runOnetImport(pool, { download, importanceThreshold: thr });
    console.log('\nImport counts:');
    for (const [k, v] of Object.entries(result.counts)) {
      console.log(`  ${k.padEnd(32)} ${v}`);
    }
    console.log(`\nOK: ${result.ok}${result.error ? `  error: ${result.error}` : ''}`);
    if (!result.ok) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

import { Pool } from 'pg';
import { runDiscovery, getSummary, getValidation, schemaReady } from '../services/platform-lifecycle';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('schemaReady (before):', await schemaReady(pool));
    const disc = await runDiscovery(pool, 'dev-activation');
    console.log('discovery counts:', JSON.stringify(disc.counts, null, 2));
    console.log('schemaReady (after):', await schemaReady(pool));
    const summary = await getSummary(pool);
    console.log('summary:', JSON.stringify(summary, null, 2));
    const validation = await getValidation(pool);
    console.log('validation:', JSON.stringify(validation, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

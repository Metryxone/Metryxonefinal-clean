import pg from 'pg';
import { calculateAndPersistLBI } from '../routes/lbi-engine';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const { rows } = await pool.query(
    `SELECT DISTINCT guest_email FROM capadex_sessions
     WHERE guest_email IS NOT NULL AND guest_email != ''
     AND status = 'completed'`
  );
  console.log(`Backfilling LBI for ${rows.length} user(s)…`);
  for (const { guest_email } of rows) {
    await calculateAndPersistLBI(guest_email, pool);
    console.log(`  ✓ ${guest_email}`);
  }
  await pool.end();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });

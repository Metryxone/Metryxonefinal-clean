/**
 * One-shot script: run the intelligence pipeline backfill for all sessions
 * that have signals but are missing composites.
 *
 * Usage:  cd backend && npx tsx scripts/run-backfill.ts
 *
 * Idempotent — re-running only processes sessions still missing composites.
 */
import 'dotenv/config';
import pg from 'pg';
import { backfillIntelligencePipeline } from '../services/intelligence-pipeline';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('━━━ Intelligence Backfill ━━━');
  console.log(`DB: ${process.env.DATABASE_URL ? '✓ connected' : '✗ DATABASE_URL missing'}`);
  console.log();

  const { total, processed, results } = await backfillIntelligencePipeline(pool, 50);

  console.log(`Eligible sessions  : ${total}`);
  console.log(`Processed          : ${processed}`);
  console.log();

  let totalComp = 0, totalPat = 0, errors = 0;
  for (const r of results) {
    totalComp += r.composites_written;
    totalPat  += r.patterns_written;
    if (r.error) errors++;
    const status = r.error
      ? `✗ ERROR: ${r.error}`
      : r.skipped_reason
        ? `⟳ SKIPPED: ${r.skipped_reason}`
        : `✓ composites=${r.composites_written} patterns=${r.patterns_written} signals=${r.signals_count}`;
    console.log(`  ${r.session_id.slice(0, 8)}…  ${status}`);
  }

  console.log();
  console.log(`Total composites written : ${totalComp}`);
  console.log(`Total patterns written   : ${totalPat}`);
  console.log(`Errors                   : ${errors}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

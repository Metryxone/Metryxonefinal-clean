/**
 * MEI + UCIP Backfill Script
 * ──────────────────────────
 * Runs the full EI intelligence chain for every user who has a career profile
 * (career_seeker_profiles). Chunked, observable, resumable.
 *
 * Usage:
 *   npx tsx backend/scripts/mei-ucip-backfill.ts [--dry-run] [--chunk=10]
 */
import { Pool } from 'pg';
import { backfillMEIChain } from '../services/mei-chain-trigger';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const chunkArg = args.find(a => a.startsWith('--chunk='));
const chunkSize = chunkArg ? parseInt(chunkArg.replace('--chunk=', ''), 10) : 5;

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  MEI + UCIP Chain Backfill');
  console.log('══════════════════════════════════════════');
  console.log(`  Mode:       ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Chunk size: ${chunkSize}`);
  console.log(`  Started:    ${new Date().toISOString()}`);
  console.log('──────────────────────────────────────────\n');

  const beforeMEI = await pool.query('SELECT COUNT(*) FROM mei_scores').then(r => Number(r.rows[0].count)).catch(() => 0);
  const beforeUCIP = await pool.query('SELECT COUNT(*) FROM ucip_profiles').then(r => Number(r.rows[0].count)).catch(() => 0);
  const beforeRecs = await pool.query('SELECT COUNT(*) FROM mei_user_recommendations').then(r => Number(r.rows[0].count)).catch(() => 0);
  const beforeHistory = await pool.query('SELECT COUNT(*) FROM mei_score_history').then(r => Number(r.rows[0].count)).catch(() => 0);

  console.log('Before counts:');
  console.log(`  mei_scores:               ${beforeMEI}`);
  console.log(`  mei_score_history:        ${beforeHistory}`);
  console.log(`  mei_user_recommendations: ${beforeRecs}`);
  console.log(`  ucip_profiles:            ${beforeUCIP}`);
  console.log('');

  const usersRes = await pool.query(
    `SELECT DISTINCT user_id FROM career_seeker_profiles WHERE user_id IS NOT NULL ORDER BY user_id`
  );
  const userIds = usersRes.rows.map((r: { user_id: string }) => String(r.user_id));
  console.log(`Eligible users (have career profiles): ${userIds.length}`);

  if (dryRun) {
    console.log('\nDRY RUN: would process:', userIds.slice(0, 10).join(', '), userIds.length > 10 ? `... +${userIds.length - 10} more` : '');
    await pool.end();
    return;
  }

  if (userIds.length === 0) {
    console.log('No eligible users found. career_seeker_profiles is empty.');
    await pool.end();
    return;
  }

  const { ok, skipped, failed } = await backfillMEIChain(pool, userIds, {
    chunkSize,
    onProgress: (done, total, uid, success) => {
      const pct = Math.round((done / total) * 100);
      process.stdout.write(`\r  Progress: ${done}/${total} (${pct}%) — ${uid}: ${success ? '✓' : '✗'} `);
    },
  });

  console.log('\n');

  const afterMEI = await pool.query('SELECT COUNT(*) FROM mei_scores').then(r => Number(r.rows[0].count)).catch(() => 0);
  const afterUCIP = await pool.query('SELECT COUNT(*) FROM ucip_profiles').then(r => Number(r.rows[0].count)).catch(() => 0);
  const afterRecs = await pool.query('SELECT COUNT(*) FROM mei_user_recommendations').then(r => Number(r.rows[0].count)).catch(() => 0);
  const afterHistory = await pool.query('SELECT COUNT(*) FROM mei_score_history').then(r => Number(r.rows[0].count)).catch(() => 0);

  console.log('══════════════════════════════════════════');
  console.log('  Backfill Results');
  console.log('══════════════════════════════════════════');
  console.log(`  Users processed: ${userIds.length}`);
  console.log(`    ✓ ok:      ${ok}`);
  console.log(`    ○ skipped: ${skipped}  (no profile)`);
  console.log(`    ✗ failed:  ${failed}`);
  console.log('');
  console.log('After counts (vs before):');
  console.log(`  mei_scores:               ${beforeMEI} → ${afterMEI}  (+${afterMEI - beforeMEI})`);
  console.log(`  mei_score_history:        ${beforeHistory} → ${afterHistory}  (+${afterHistory - beforeHistory})`);
  console.log(`  mei_user_recommendations: ${beforeRecs} → ${afterRecs}  (+${afterRecs - beforeRecs})`);
  console.log(`  ucip_profiles:            ${beforeUCIP} → ${afterUCIP}  (+${afterUCIP - beforeUCIP})`);
  console.log(`\n  Completed: ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════\n');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

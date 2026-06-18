/**
 * CAPADEX Concern → Signal Mapping backfill (Task #16, step 4).
 *
 * Runs the deterministic mapping engine across all concerns in
 * `capadex_concerns_master` and populates `capadex_concern_signal_map`. Idempotent
 * — re-running converges. Reuses the production engine
 * (`services/concern-signal-mapping-engine.ts`) so the seed and the live
 * `POST /rebuild` route can never drift.
 *
 * Run:
 *   npx tsx backend/scripts/seed-concern-signal-map.ts                # replace (default)
 *   npx tsx backend/scripts/seed-concern-signal-map.ts --mode=upsert
 *   npx tsx backend/scripts/seed-concern-signal-map.ts --dry-run
 */
import { Pool } from 'pg';
import { runConcernSignalMapping, type BackfillMode } from '../services/concern-signal-mapping-engine';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');

  const modeRaw = (arg('mode') || 'replace').toLowerCase();
  const mode: BackfillMode =
    modeRaw === 'upsert' || modeRaw === 'append' ? (modeRaw as BackfillMode) : 'replace';
  const dryRun = process.argv.includes('--dry-run');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    console.log(`[concern-signal-map] running mode=${mode} dryRun=${dryRun} …`);
    const stats = await runConcernSignalMapping(pool, { mode, dryRun });
    console.log('[concern-signal-map] done:');
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[concern-signal-map] FAILED:', err);
  process.exit(1);
});

/**
 * CAPADEX Concern → Clarity-question Mapping backfill (2026-06-01).
 *
 * Runs the deterministic mapping engine across all concerns in
 * `capadex_concerns_master` and populates `capadex_concern_clarity_map`.
 * Idempotent — re-running converges. Reuses the production engine
 * (`services/concern-clarity-mapping-engine.ts`) so the seed and any future
 * rebuild route can never drift.
 *
 * Run:
 *   npx tsx backend/scripts/seed-concern-clarity-map.ts                # replace (default)
 *   npx tsx backend/scripts/seed-concern-clarity-map.ts --mode=upsert
 *   npx tsx backend/scripts/seed-concern-clarity-map.ts --dry-run
 */
import { Pool } from 'pg';
import { runConcernClarityMapping, type BackfillMode } from '../services/concern-clarity-mapping-engine';

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
    console.log(`[concern-clarity-map] running mode=${mode} dryRun=${dryRun} …`);
    const stats = await runConcernClarityMapping(pool, { mode, dryRun });
    console.log('[concern-clarity-map] done:');
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[concern-clarity-map] FAILED:', err);
  process.exit(1);
});

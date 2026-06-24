/**
 * seed-region-native-market.ts — Task 75 / Task 81
 *
 * Thin CLI wrapper. The seed LOGIC + data now live in the shared service
 * `backend/services/region-native-market-seed.ts` so the SAME implementation runs from both this
 * manual CLI path and the idempotent backend-startup hook (`ensureRegionNativeMarketSeed`).
 *
 * This CLI FORCE re-seeds (delete-by-provenance then insert) — use it for a manual refresh.
 *
 * Run:  cd backend && npx tsx scripts/seed-region-native-market.ts
 */
import { Pool } from 'pg';
import {
  REGION_NATIVE_PROVENANCE,
  seedRegionNativeMarket,
  reportRegionCoverage,
} from '../services/region-native-market-seed';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await seedRegionNativeMarket(pool);
    console.log(`\n[seed-region-native-market] provenance=${REGION_NATIVE_PROVENANCE}`);
    console.log(`  market signals inserted: ${result.signals}`);
    console.log(`  region benchmark cohorts: ${result.cohorts}`);
    console.log('  overlay rows by region/surface:');
    for (const r of result.overlayByRegionSurface) {
      console.log(`    ${r.region_code.padEnd(5)} ${r.surface.padEnd(22)} ${r.n}`);
    }
    console.log('\nRegion-native market & benchmark data seeded (all real, provenance-stamped). Coverage:');
    await reportRegionCoverage(pool);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

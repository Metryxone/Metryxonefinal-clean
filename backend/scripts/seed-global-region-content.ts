/**
 * PHASE 8 — Global region content SEED (closes the content half of the global-readiness gap).
 *
 * Thin CLI wrapper. The seed LOGIC now lives in the shared service
 * `backend/services/region-native-market-seed.ts` (`seedGlobalRegionContent`) so the SAME
 * implementation runs from both this manual CLI path and the idempotent backend-startup hook.
 *
 * It region-tags EXISTING universal entities to the priority regions — it never invents an entity
 * and never fabricates regional statistics:
 *   - role_library       → all universal roles (region-agnostic definitions).
 *   - competency_models  → the full universal competency genome.
 *   - benchmarks         → GLOBAL + structural cohort DEFINITIONS only (`coh_role_*` India-population
 *                          statistical cohorts deliberately EXCLUDED → honest SUBSET).
 *   - demand_intelligence→ the global market signals (geography='global').
 *   - readiness_models   → INTENTIONALLY NOT seeded (subject-specific user snapshots).
 *
 * Every row carries provenance `phase8_global_competency` (reversible via rollbackRegionContent).
 *
 * Run: cd backend && npx tsx scripts/seed-global-region-content.ts
 */
import { Pool } from 'pg';
import { DEFAULT_REGION } from '../services/global-competency-engine';
import { seedGlobalRegionContent, reportRegionCoverage } from '../services/region-native-market-seed';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log(`[seed] Global region content (default ${DEFAULT_REGION} unchanged)`);
    const res = await seedGlobalRegionContent(pool);
    console.log(
      `[seed] entity pools — roles=${res.pools.roles}, competencies=${res.pools.competencies}, ` +
        `benchmarks=${res.pools.benchmarks} (coh_role_* excluded), demand=${res.pools.demand}`,
    );
    console.log(`[seed] DONE — rows written=${res.written}, rejected(nonexistent)=${res.rejected}`);
    await reportRegionCoverage(pool);
  } catch (err) {
    console.error('[seed] FAILED:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();

/**
 * Smoke test — 98X Phase 1 Role DNA Expansion engine (READ-ONLY).
 * Run: FF_ROLE_DNA_EXPANSION=1 npx tsx scripts/smoke-role-dna-expansion.ts
 */
import { Pool } from 'pg';
import { isRoleDnaExpansionEnabled } from '../config/feature-flags';
import {
  computeCrosswalkCoverage,
  generateRoleDNA,
  listMaterialized,
} from '../services/role-dna-expansion-engine';

async function main() {
  console.log('flag isRoleDnaExpansionEnabled():', isRoleDnaExpansionEnabled());
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await computeCrosswalkCoverage(pool);
    console.log('COVERAGE:', JSON.stringify(coverage, null, 2));

    const byCode = await generateRoleDNA(pool, 'ONET_15-1252.00');
    console.log('DNA by code (ONET_15-1252.00):', JSON.stringify({
      resolved: byCode.resolved, roleCode: byCode.roleCode, roleTitle: byCode.roleTitle,
      match: byCode.match, curatedPrecedence: byCode.curatedPrecedence,
      bridgedOntoRoleId: byCode.bridgedOntoRoleId, competencyCount: byCode.competencyCount,
      benchmark: byCode.benchmark, sampleReq: byCode.requirements.slice(0, 3),
    }, null, 2));

    const byTitle = await generateRoleDNA(pool, 'Software Engineer');
    console.log('DNA by title (Software Engineer):', JSON.stringify({
      resolved: byTitle.resolved, roleCode: byTitle.roleCode, roleTitle: byTitle.roleTitle,
      match: byTitle.match, competencyCount: byTitle.competencyCount, benchmark: byTitle.benchmark,
    }, null, 2));

    const bogus = await generateRoleDNA(pool, 'zzz-not-a-real-role-xyz');
    console.log('DNA unresolved (bogus):', JSON.stringify({
      resolved: bogus.resolved, match: bogus.match, benchmark: bogus.benchmark,
    }, null, 2));

    const mat = await listMaterialized(pool, 5);
    console.log('MATERIALIZED (read-only, expect available:false until POST /materialize):', JSON.stringify(mat, null, 2));

    // Invariant: total competencyCount == curated + inherited for every shape.
    for (const inp of ['Credit Analyst', 'ONET_15-1252.00', 'zzz-not-a-real-role-xyz']) {
      const d = await generateRoleDNA(pool, inp);
      const ok = d.competencyCount === d.curatedRequirementCount + d.inheritedRequirementCount;
      console.log(`INVARIANT ${inp}: ${ok ? 'PASS' : 'FAIL'} (total=${d.competencyCount} curated=${d.curatedRequirementCount} inherited=${d.inheritedRequirementCount} source=${d.requirementSource})`);
      if (!ok) throw new Error(`invariant violated for ${inp}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });

/**
 * Smoke test — 98X Phase 1 O*NET Activation (READ-ONLY orchestration).
 *
 * Service-level (works regardless of flag — service fns are not flag-gated):
 *   FF_ONET_ACTIVATION=1 npx tsx scripts/smoke-onet-activation.ts
 * HTTP flag-OFF contract (run against the live backend which has FF_ONET_ACTIVATION OFF):
 *   the same script asserts every route 503s when the flag is OFF.
 */
import { Pool } from 'pg';
import {
  getCrosswalkExpansion,
  getRoleIntelligence,
  getCompetencyInheritance,
  getRoleDna,
  getBenchmarkFoundation,
  getActivationStatus,
} from '../services/onet-activation';
import { listMaterialized } from '../services/role-dna-expansion-engine';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`, detail != null ? JSON.stringify(detail) : ''); }
}

async function serviceTests(pool: Pool) {
  console.log('\n== Service-level (read-only composition) ==');

  // 1) Crosswalk Expansion
  const cw = await getCrosswalkExpansion(pool);
  check('coverage totalOntRoles > 0', (cw.coverage.totalOntRoles ?? 0) > 0, cw.coverage.totalOntRoles);
  check('coverage withCompetencyLinks > 0', (cw.coverage.withCompetencyLinks ?? 0) > 0);
  check('bridge available', cw.bridge.available === true);
  check('bridge total <= curatedRoles*N (small, capped surface)', (cw.bridge.total ?? 999) <= 50, cw.bridge.total);
  check('industriesReference reported (reference dim, not role-attached)', cw.industriesReference != null);

  // 2) Role Intelligence + hierarchy context
  const ri = await getRoleIntelligence(pool, 'ONET_15-1252.00');
  check('role intelligence resolves a known O*NET code', ri.resolved === true, ri.roleCode);
  check('role intelligence carries hierarchy context', ri.hierarchy.available === true || ri.hierarchy.family != null, ri.hierarchy);
  const riBogus = await getRoleIntelligence(pool, 'zzz-not-a-real-role-xyz');
  check('bogus role intelligence honest-unresolved', riBogus.resolved === false && riBogus.hierarchy.available === false);

  // 3) Competency Inheritance grouped
  const inh = await getCompetencyInheritance(pool, 'ONET_15-1252.00');
  check('inheritance resolved with requirements', inh.resolved === true && inh.total > 0, inh.total);
  check('inheritance byTier sums to total', Object.values(inh.byTier).reduce((a, b) => a + b, 0) === inh.total);
  const inhBogus = await getCompetencyInheritance(pool, 'zzz-not-a-real-role-xyz');
  check('bogus inheritance honest-empty (never fabricated)', inhBogus.resolved === false && inhBogus.total === 0);

  // 4) Role DNA + invariant
  const dna = await getRoleDna(pool, 'ONET_15-1252.00');
  check('role DNA resolved', dna.resolved === true);
  check('role DNA competencyCount == curated + inherited', dna.competencyCount === dna.curatedRequirementCount + dna.inheritedRequirementCount, {
    total: dna.competencyCount, curated: dna.curatedRequirementCount, inherited: dna.inheritedRequirementCount,
  });
  check('role DNA carries hierarchy context', dna.hierarchy != null);

  // Curated precedence: a bridged curated role should compose curated requirements.
  const curatedDna = await getRoleDna(pool, 'Product Manager');
  check('Product Manager DNA resolves (bridged curated role)', curatedDna.resolved === true, curatedDna.roleCode);
  check('curated precedence flag is boolean (true only when curated reqs applied)', typeof curatedDna.curatedPrecedence === 'boolean');

  // 5) Benchmark Foundation (abstain-by-default honesty)
  const bm = await getBenchmarkFoundation(pool, 'ONET_15-1252.00');
  check('benchmark foundation returns a shape', bm != null && typeof bm.benchmark.available === 'boolean');
  check('benchmark libraryCoverage rows reported', bm.libraryCoverage.benchmarkRows != null);

  // Activation status + 500+ target
  const status = await getActivationStatus(pool);
  check('activation status target is 500', status.target.materializedProfiles === 500);
  const mat = await listMaterialized(pool, 1);
  console.log(`  INFO  materialized snapshots present: ${mat.available ? mat.count : 0} (target reached: ${status.target.reached})`);
}

async function httpFlagOffTests() {
  const base = process.env.SMOKE_BASE || 'http://localhost:8080';
  console.log(`\n== HTTP flag-OFF contract (${base}) ==`);
  const routes = [
    '/api/v2/onet-activation/feature-flag',
    '/api/v2/onet-activation/_meta/versions',
    '/api/v2/onet-activation/status',
    '/api/v2/onet-activation/coverage',
    '/api/v2/onet-activation/materialized',
    '/api/v2/onet-activation/role-intelligence/ONET_15-1252.00',
    '/api/v2/onet-activation/inheritance/ONET_15-1252.00',
    '/api/v2/onet-activation/role-dna/ONET_15-1252.00',
    '/api/v2/onet-activation/benchmark/ONET_15-1252.00',
  ];
  for (const r of routes) {
    try {
      const res = await fetch(base + r);
      // Flag-OFF contract: 503 before auth. (If FF_ONET_ACTIVATION were ON, auth would yield 401.)
      check(`flag-OFF 503 ${r}`, res.status === 503, res.status);
    } catch (err) {
      check(`reachable ${r}`, false, (err as Error).message);
    }
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await serviceTests(pool);
    if (!process.argv.includes('--no-http')) await httpFlagOffTests();
  } finally {
    await pool.end();
  }
  console.log(`\n==== ${pass} PASS / ${fail} FAIL ====`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

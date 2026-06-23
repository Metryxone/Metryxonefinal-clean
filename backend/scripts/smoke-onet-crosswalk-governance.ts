/**
 * Smoke test — MX-100X Phase 2 O*NET Crosswalk Governance.
 *
 * Service-level (read-only composition; not flag-gated at the service layer):
 *   npx tsx scripts/smoke-onet-crosswalk-governance.ts
 * HTTP flag-OFF contract (live backend has FF_ONET_CROSSWALK_GOVERNANCE OFF):
 *   asserts every route 503s before auth when the flag is OFF.
 */
import { Pool } from 'pg';
import {
  getCrosswalkConfidence,
  getDuplicates,
  getMissingMappings,
  getUnlinkedRoleAnalysis,
  getGovernanceOverview,
} from '../services/onet-crosswalk-governance-engine';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`, detail != null ? JSON.stringify(detail) : ''); }
}

async function serviceTests(pool: Pool) {
  console.log('\n== Service-level (read-only composition) ==');

  // Confidence — Coverage ⟂ Confidence, industry abstains, no id coercion.
  const conf = await getCrosswalkConfidence(pool);
  check('roleBridge total > 0', conf.roleBridge.total > 0, conf.roleBridge.total);
  check('roleBridge resolved + unresolved == total', conf.roleBridge.resolved + conf.roleBridge.unresolved === conf.roleBridge.total);
  check('roleBridge coverage_pct in [0,100] or null', conf.roleBridge.coverage_pct == null || (conf.roleBridge.coverage_pct >= 0 && conf.roleBridge.coverage_pct <= 100), conf.roleBridge.coverage_pct);
  check('roleBridge band counts == resolved (band only over resolved)', Object.values(conf.roleBridge.band_distribution).reduce((a, b) => a + b, 0) === conf.roleBridge.resolved);
  check('roleBridge entity_ref is curated TEXT id (not the INT ont id)', conf.roleBridge.rows.every((r) => typeof r.entity_ref === 'string'));
  check('unresolved rows carry null ont_id + null numeric (no fabricated confidence)', conf.roleBridge.rows.filter((r) => r.ont_id == null).every((r) => r.confidence_numeric == null));
  check('industry abstains honestly', conf.industry.measurable === false && conf.industry.reason === 'no_role_industry_linkage');

  const compConf = conf.competencyMapping;
  check('competencyMapping total > 0', compConf.total > 0, compConf.total);
  check('competencyMapping bands == resolved', Object.values(compConf.band_distribution).reduce((a, b) => a + b, 0) === compConf.resolved);

  // Duplicates — shape + non-negative.
  const dups = await getDuplicates(pool);
  check('duplicates total_duplicate_groups >= 0', dups.total_duplicate_groups >= 0, dups.total_duplicate_groups);
  check('duplicate groups all have count > 1', [
    ...dups.roleBridge.duplicate_onto_role,
    ...dups.roleBridge.duplicate_ont_role,
    ...dups.competencyMapping.duplicate_onto_competency,
    ...dups.competencyMapping.duplicate_ont_competency,
    ...dups.roleCompetency.duplicate_pairs,
  ].every((g) => g.count > 1));

  // Missing — honest counts, both denominators present.
  const missing = await getMissingMappings(pool);
  check('unresolvedRoleBridges count == roleBridge.unresolved', missing.unresolvedRoleBridges.count === conf.roleBridge.unresolved, { a: missing.unresolvedRoleBridges.count, b: conf.roleBridge.unresolved });
  check('rolesWithoutCompetencies count >= 0', missing.rolesWithoutCompetencies.count >= 0, missing.rolesWithoutCompetencies.count);
  check('competency crosswalk reports ont side', missing.competenciesWithoutCrosswalk.ont_total != null);

  // Unlinked-role analysis — verdict invariant, never fabricated.
  const unlinked = await getUnlinkedRoleAnalysis(pool);
  check('unlinked total == closable + unmappable', unlinked.total_unlinked === unlinked.inheritance_closable + unlinked.genuinely_unmappable, unlinked);
  check('genuinely_unmappable rows have 0 linked siblings', unlinked.roles.filter((r) => r.verdict === 'genuinely_unmappable').every((r) => r.family_linked_siblings === 0));
  check('inheritance_closable rows have >0 linked siblings', unlinked.roles.filter((r) => r.verdict === 'inheritance_closable').every((r) => r.family_linked_siblings > 0));
  check('rolesWithoutCompetencies count == unlinked total', missing.rolesWithoutCompetencies.count === unlinked.total_unlinked, { missing: missing.rolesWithoutCompetencies.count, unlinked: unlinked.total_unlinked });

  // Overview composes consistently.
  const ov = await getGovernanceOverview(pool);
  check('overview roleBridge coverage matches confidence', ov.confidence.roleBridge.coverage_pct === conf.roleBridge.coverage_pct);
  check('overview unlinked matches analysis', ov.unlinked.total === unlinked.total_unlinked && ov.unlinked.genuinely_unmappable === unlinked.genuinely_unmappable);
  check('overview industry abstains', ov.confidence.industry.measurable === false);
}

async function httpFlagOffTests() {
  const base = process.env.SMOKE_BASE || 'http://localhost:8080';
  console.log(`\n== HTTP flag-OFF contract (${base}) ==`);
  const getRoutes = [
    '/api/v2/onet-crosswalk-governance/feature-flag',
    '/api/v2/onet-crosswalk-governance/_meta/versions',
    '/api/v2/onet-crosswalk-governance/status',
    '/api/v2/onet-crosswalk-governance/confidence',
    '/api/v2/onet-crosswalk-governance/duplicates',
    '/api/v2/onet-crosswalk-governance/missing',
    '/api/v2/onet-crosswalk-governance/unlinked-analysis',
    '/api/v2/onet-crosswalk-governance/decisions',
  ];
  for (const r of getRoutes) {
    try {
      const res = await fetch(base + r);
      check(`flag-OFF 503 GET ${r}`, res.status === 503, res.status);
    } catch (err) {
      check(`reachable ${r}`, false, (err as Error).message);
    }
  }
  // Writes also 503 before auth/admin when flag OFF.
  for (const r of ['/api/v2/onet-crosswalk-governance/decision', '/api/v2/onet-crosswalk-governance/rollback']) {
    try {
      const res = await fetch(base + r, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      check(`flag-OFF 503 POST ${r}`, res.status === 503, res.status);
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

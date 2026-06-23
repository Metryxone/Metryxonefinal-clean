/**
 * Evidence — MX-100X Phase 1 Role DNA Governance & Benchmarks (READ-ONLY).
 * Reports per-level benchmark coverage % + a few sample per-role governance envelopes.
 * Reproducible; mutates nothing.
 *
 * Run: FF_ADAPTIVE_INTELLIGENCE_FOUNDATION=1 FF_ROLE_DNA_GOVERNANCE=1 \
 *        npx tsx scripts/role-dna-governance-coverage.ts
 */
import { Pool } from 'pg';
import { isRoleDnaGovernanceEnabled } from '../config/feature-flags';
import {
  ROLE_DNA_GOVERNANCE_VERSION,
  computeBenchmarkCoverage,
  computeGovernanceOverview,
  computeRoleGovernance,
} from '../services/role-dna-governance-engine';

async function main() {
  console.log('=== MX-100X Phase 1 — Role DNA Governance Coverage ===');
  console.log('version:', ROLE_DNA_GOVERNANCE_VERSION);
  console.log('flag isRoleDnaGovernanceEnabled():', isRoleDnaGovernanceEnabled());

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const coverage = await computeBenchmarkCoverage(pool);
    console.log('\n--- PER-LEVEL BENCHMARK COVERAGE ---');
    for (const l of coverage.levels) {
      const pct = l.coveragePct == null ? 'n/a' : `${l.coveragePct}%`;
      console.log(`  ${l.level.padEnd(11)} ${String(l.covered ?? '?').padStart(5)}/${String(l.total ?? '?').padEnd(5)}  ${pct.padStart(7)}  — ${l.note}`);
    }

    const overview = await computeGovernanceOverview(pool);
    console.log('\n--- GOVERNANCE OVERVIEW ---');
    console.log(`  total active roles : ${overview.totalRoles}`);
    console.log(`  roles with DNA links: ${overview.rolesWithLinks}`);
    console.log(`  roles abstained     : ${overview.rolesAbstained}`);
    console.log(`  materialized        : available=${overview.materialized.available} count=${overview.materialized.count}`);

    console.log('\n--- SAMPLE PER-ROLE GOVERNANCE ---');
    for (const code of ['ONET_15-1252.00', 'Software Engineer', 'ONET_55-3011.00', 'zzz-not-a-real-role']) {
      const g = await computeRoleGovernance(pool, code);
      console.log(`\n  [${code}] resolved=${g.resolved} role=${g.roleCode ?? '-'} abstained=${g.abstained}${g.abstainReason ? ` (${g.abstainReason})` : ''}`);
      console.log(`    completeness=${g.completeness} (${g.completenessBand})  confidence=${g.confidence} (${g.confidenceBand})  quality=${g.quality} (${g.qualityBand})  provisional=${g.provisional}`);
      console.log(`    competencies=${g.competencyCount} (core ${g.coreCompetencyCount})  benchmarkLevels=${g.benchmarkLevelsAvailable}/${g.benchmarkLevelsTotal}`);
      console.log('    benchmarks:', Object.entries(g.benchmarks).map(([k, v]) => `${k}:${v.available ? 'Y' : 'N' + (v.reason ? `(${v.reason})` : '')}`).join('  '));
    }

    console.log('\n=== DONE (read-only) ===');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

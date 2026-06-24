/**
 * O*NET Role DNA activation — 98X Gap Closure, Phase 1 (reversible, provenance-stamped).
 *
 * Materializes 500+ Role DNA *profiles* by composing the already-live O*NET reference library
 * (ont_roles / map_role_competency / ti_role_benchmarks) with curated onto_* precedence where a
 * bridge exists. This is the HONEST reading of "5 -> 500+ crosswalks": the curated <-> O*NET role
 * bridge stays small (capped by the 5 curated onto_roles), while generated Role DNA profiles scale
 * to the O*NET library. Nothing existing is mutated; every snapshot carries provenance
 * '98x_phase1_expansion' and is fully reversible.
 *
 * Usage:
 *   npx tsx scripts/activate-onet-role-dna.ts                       # dry-run (no writes) — status only
 *   npx tsx scripts/activate-onet-role-dna.ts --apply              # materialize Role DNA (default 600)
 *   npx tsx scripts/activate-onet-role-dna.ts --apply --limit 800  # materialize a specific count
 *   npx tsx scripts/activate-onet-role-dna.ts --apply --resolve-bridges  # also resolve unresolved curated bridges (reversible)
 *   npx tsx scripts/activate-onet-role-dna.ts --rollback          # delete all materialized snapshots + revert bridge resolution
 *
 * Notes:
 *   - The live DB is shared/PROD. Snapshots are DERIVED reference data (no user PII) and are
 *     reversible by provenance. Curated-bridge resolution only writes CONFIDENT matches and is
 *     reverted by --rollback (rows restored to 'unresolved').
 */
import { Pool } from 'pg';
import {
  materializeRoleDNA,
  rollbackExpansion,
  computeCrosswalkCoverage,
} from '../services/role-dna-expansion-engine';
import {
  getActivationStatus,
  resolveCuratedBridges,
  rollbackBridgeResolution,
} from '../services/onet-activation';
import { deriveUnratedRoleCompetencies } from '../services/onet-import';

async function topRoleCodes(pool: Pool, limit: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT r.code
       FROM ont_roles r
       JOIN map_role_competency m ON m.role_id = r.id AND m.is_active = true
      WHERE r.is_active = true
      GROUP BY r.code
      ORDER BY COUNT(m.id) DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((x: any) => String(x.code));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const rollback = process.argv.includes('--rollback');
  const doBridges = process.argv.includes('--resolve-bridges');
  const doDeriveUnrated = process.argv.includes('--derive-unrated');
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  const limit = limitArg
    ? Math.min(Math.max(Number(limitArg.split('=')[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) || 600, 1), 1100)
    : 600;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (rollback) {
      const snap = await rollbackExpansion(pool);
      const bridge = await rollbackBridgeResolution(pool);
      console.log('[rollback] snapshots:', JSON.stringify(snap), 'bridges:', JSON.stringify(bridge));
      const status = await getActivationStatus(pool);
      console.log('[rollback] post-status materialized:', status.materialized.count);
      return;
    }

    const before = await computeCrosswalkCoverage(pool);
    console.log('[before] coverage:', JSON.stringify({
      totalOntRoles: before.totalOntRoles,
      withCompetencyLinks: before.withCompetencyLinks,
      coveragePct: before.coveragePct,
      materializedSnapshots: before.materializedSnapshots,
    }, null, 2));

    if (doBridges) {
      const bridge = await resolveCuratedBridges(pool, { apply });
      console.log(`[bridges${apply ? ':apply' : ':dry-run'}]`, JSON.stringify(bridge, null, 2));
    }

    if (doDeriveUnrated && apply) {
      const derived = await deriveUnratedRoleCompetencies(pool);
      console.log('[derive-unrated]', JSON.stringify(derived, null, 2));
    } else if (doDeriveUnrated) {
      console.log('[derive-unrated] dry-run — re-run with --apply to link unrated roles.');
    }

    if (!apply) {
      const codes = await topRoleCodes(pool, limit);
      console.log(`[dry-run] would materialize ${codes.length} Role DNA profiles (top by competency coverage).`);
      console.log('(re-run with --apply to persist; reversible by --rollback)');
      return;
    }

    const codes = await topRoleCodes(pool, limit);
    console.log(`[apply] materializing ${codes.length} Role DNA profiles...`);
    const result = await materializeRoleDNA(pool, { roleCodes: codes });
    console.log('[apply] result:', JSON.stringify({
      requested: result.requested, resolved: result.resolved,
      written: result.written, skipped: result.skipped, provenance: result.provenance,
    }, null, 2));

    const status = await getActivationStatus(pool);
    console.log('[after] status:', JSON.stringify({
      materialized: status.materialized,
      target: status.target,
      coveragePct: status.coverage.coveragePct,
      bridgeResolved: status.bridge.resolved,
    }, null, 2));
    if (!status.target.reached) {
      console.log('[warn] materialized count below 500 — investigate skipped/unresolved roles above.');
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

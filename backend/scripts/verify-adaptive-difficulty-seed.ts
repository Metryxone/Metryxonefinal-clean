/**
 * Verify — Role-based difficulty stays activated after every deploy (Task #384).
 *
 * Runtime Role-DNA expected levels are populated by a self-running seed
 * (`services/adaptive-assessment-seed.ts`) that fires at route registration so
 * it reproduces on a fresh production database (a merge carries CODE + migration
 * DDL but NOT rows). This check is the standing alarm for that flow: a missed
 * table, a rename in the curated source (`onto_role_weights` / `onto_dna_profiles`),
 * or a broken join in `lookupRoleDnaAnchor` would silently drop difficulty back to
 * the career-stage anchor with no signal. This asserts, against the live/seeded DB:
 *
 *   1. The seed is idempotent — running it again writes NOTHING (0 writes on every
 *      counter). This first run also GUARANTEES the seeded state on a fresh DB.
 *   2. `competency_runtime_weights` holds expected_level rows joinable via the exact
 *      engine chain (competency_runtime_weights → role_dna_profiles_v2 is_active →
 *      onto_roles) that `lookupRoleDnaAnchor` walks.
 *   3. Every joinable expected_level falls within the 0–100 proficiency scale.
 *   4. `buildDifficultyPlan` stamps `proficiency_source = role_dna_expected_level`
 *      for at least one populated live role, and falls back to `seniority_anchor`
 *      for an unknown role.
 *
 * READ-ONLY except for the (idempotent, no-op) seed re-run. Exits non-zero on any
 * failure so it can gate a deploy as a validation step.
 *
 * Run with:  cd backend && npx tsx scripts/verify-adaptive-difficulty-seed.ts
 */
import { Pool } from 'pg';
import { runAdaptiveAssessmentSeed } from '../services/adaptive-assessment-seed';
import { buildDifficultyPlan } from '../services/adaptive-difficulty-activation';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); }

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Run 1: guarantee the seeded/post-deploy state on a fresh DB. Its own success
    // is asserted (a hard failure here means the activation flow itself is broken).
    const first = await runAdaptiveAssessmentSeed(pool);
    check('0. seed activation run succeeds', first.ok === true, first.error ?? 'ok');

    // 1. Idempotency — re-running the seed must be a clean no-op (0 writes on every
    //    write counter). skipped_existing is NOT a write, so it is allowed to be >0.
    const second = await runAdaptiveAssessmentSeed(pool);
    const writes = {
      roles_seeded: second.runtime_role_dna.roles_seeded,
      weights_inserted: second.runtime_role_dna.weights_inserted,
      normalized_easy: second.difficulty.normalized_easy,
      normalized_medium: second.difficulty.normalized_medium,
      normalized_hard: second.difficulty.normalized_hard,
      variants_inserted: second.difficulty.variants_inserted,
    };
    const totalWrites = Object.values(writes).reduce((a, b) => a + b, 0);
    check('1. seed re-run is an idempotent no-op (0 writes)', second.ok === true && totalWrites === 0,
      `writes=${JSON.stringify(writes)}`);

    // 2 + 3. Engine-chain joinability + 0–100 scale, using the EXACT chain
    //        lookupRoleDnaAnchor walks (competency_runtime_weights →
    //        role_dna_profiles_v2 is_active → onto_roles).
    const agg = await pool.query<{ total: string; out_of_range: string; mn: string | null; mx: string | null }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE crw.expected_level < 0 OR crw.expected_level > 100)::int AS out_of_range,
              MIN(crw.expected_level) AS mn, MAX(crw.expected_level) AS mx
         FROM competency_runtime_weights crw
         JOIN role_dna_profiles_v2 dp ON dp.id = crw.role_dna_id AND dp.is_active = true
         JOIN onto_roles ro ON ro.id = dp.role_id
        WHERE crw.expected_level IS NOT NULL`,
    );
    const total = Number(agg.rows[0]?.total ?? 0);
    const outOfRange = Number(agg.rows[0]?.out_of_range ?? 0);
    const mn = agg.rows[0]?.mn != null ? Number(agg.rows[0].mn) : null;
    const mx = agg.rows[0]?.mx != null ? Number(agg.rows[0].mx) : null;
    check('2. runtime Role-DNA expected_level rows joinable via engine chain', total > 0,
      `joinable rows=${total} (chain: competency_runtime_weights → role_dna_profiles_v2 is_active → onto_roles)`);
    check('3. all expected_level values within 0–100 scale', total > 0 && outOfRange === 0,
      `out_of_range=${outOfRange}, range=[${mn}, ${mx}]`);

    // 4a. Provenance = role_dna_expected_level for a POPULATED live role. Pick the
    //     most-populated role from the same chain and drive buildDifficultyPlan by
    //     its title (the runtime path resolves title OR id).
    const topRole = await pool.query<{ title: string; n: string }>(
      `SELECT ro.title AS title, COUNT(*)::int AS n
         FROM competency_runtime_weights crw
         JOIN role_dna_profiles_v2 dp ON dp.id = crw.role_dna_id AND dp.is_active = true
         JOIN onto_roles ro ON ro.id = dp.role_id
        WHERE crw.expected_level IS NOT NULL
        GROUP BY ro.title
        ORDER BY n DESC
        LIMIT 1`,
    );
    const roleTitle = topRole.rows[0]?.title ?? null;
    if (roleTitle) {
      const populated = await buildDifficultyPlan(pool, { stage: 'mid', role: roleTitle });
      check('4a. populated role → proficiency_source = role_dna_expected_level',
        populated.seniority.proficiency_source === 'role_dna_expected_level',
        `role="${roleTitle}" → source=${populated.seniority.proficiency_source}, anchor=${populated.seniority.proficiency_anchor}`);
    } else {
      check('4a. populated role → proficiency_source = role_dna_expected_level', false,
        'no populated live role available to exercise the provenance path');
    }

    // 4b. Unknown role must fall back to the career-stage anchor (never fabricate a
    //     Role-DNA anchor for a role the chain does not resolve).
    const unknown = await buildDifficultyPlan(pool, { stage: 'mid', role: '__nonexistent_role_zzz_384__' });
    check('4b. unknown role → proficiency_source = seniority_anchor',
      unknown.seniority.proficiency_source === 'seniority_anchor',
      `source=${unknown.seniority.proficiency_source}, anchor=${unknown.seniority.proficiency_anchor}`);
  } finally {
    await pool.end();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

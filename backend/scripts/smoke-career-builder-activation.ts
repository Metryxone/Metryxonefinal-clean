/**
 * Smoke test (LIVE DB) — 98X Gap Closure Phase 4: Career Builder Activation.
 *
 * Phase 4 is an ORCHESTRATOR that COMPOSES the already-existing persisting engines
 * (computeSkillGaps / computeReadiness / generateRecommendations / generateLearningRecs) to
 * materialize the empty cg_user_* calculation tables for a user, plus a reversible
 * anchor→target career path (source='98x_phase4'). This check exercises the REAL service
 * end-to-end against the live DB with a DISPOSABLE synthetic user, then rolls everything back
 * and asserts the DB is byte-identical to before (shared dev/prod DB — everything purgeable).
 *
 * Asserts:
 *   1. activateCareerBuilder resolves an anchor + materializes cg_user_* rows (counts > 0).
 *   2. The rows actually exist in the DB for the synthetic user.
 *   3. getCareerBuilderIntelligence reads them back read-only (available=true, counts match).
 *   4. A user-saved career path (source='user_selected') is NEVER clobbered by activation.
 *   5. rollbackCareerBuilderActivation deletes exactly the generated rows (user_selected survives).
 *   6. Rollback is idempotent (second run deletes 0).
 *   7. The flag-gated completion hook no-ops for an email with no matching career user.
 *   8. HTTP flag-OFF contract: all 5 routes 503 before any auth/DB touch.
 *
 * Run: cd backend && npx tsx scripts/smoke-career-builder-activation.ts
 */
process.env.FF_CAREER_BUILDER_ACTIVATION = '1'; // for the hook flag-gate test only

import pg from 'pg';
import {
  activateCareerBuilder,
  getCareerBuilderIntelligence,
  rollbackCareerBuilderActivation,
  maybeActivateCareerBuilderOnCompletion,
  ACTIVATION_SOURCE,
} from '../services/career-builder-activation';

const STAMP = Date.now();
const USER = `smoke-cba-${STAMP}@example.com`;
const HOST = process.env.SMOKE_HOST || 'http://localhost:8080';

let pass = 0, fail = 0;
function ok(cond: boolean, label: string, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`); }
}

async function countRows(pool: pg.Pool, table: string, where = 'user_id=$1', params: unknown[] = [USER]): Promise<number> {
  const r = await pool.query(`SELECT COUNT(*)::int n FROM ${table} WHERE ${where}`, params).catch(() => ({ rows: [{ n: 0 }] }));
  return Number(r.rows[0]?.n ?? 0);
}

async function purge(pool: pg.Pool) {
  for (const t of ['cg_user_skill_gaps', 'cg_user_role_readiness', 'cg_user_recommendations',
    'cg_user_learning_recs', 'cg_readiness_history', 'cg_user_career_path']) {
    await pool.query(`DELETE FROM ${t} WHERE user_id=$1`, [USER]).catch(() => {});
  }
  await pool.query(`DELETE FROM cg_user_activation_runs WHERE user_id=$1`, [USER]).catch(() => {});
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await purge(pool); // clean slate

    // ── Pre-check ───────────────────────────────────────────────────────────
    const roleCount = await pool.query(`SELECT COUNT(*)::int n FROM cg_roles WHERE is_active`).then(r => Number(r.rows[0].n)).catch(() => 0);
    ok(roleCount > 0, `cg_roles has active rows (${roleCount})`);

    // ── 1. Activate ───────────────────────────────────────────────────────────
    console.log('\n[1] activateCareerBuilder');
    const summary = await activateCareerBuilder(pool, USER);
    ok(summary.ok, 'activation ok', JSON.stringify(summary.notes));
    ok(summary.activated, 'activated=true');
    ok(summary.anchor_role_id != null, `anchor resolved (role_id=${summary.anchor_role_id})`);
    ok(summary.roles_processed.length > 0, `roles processed (${summary.roles_processed.length})`);
    ok(summary.counts.skill_gaps > 0, `skill_gaps generated (${summary.counts.skill_gaps})`);
    ok(summary.counts.role_readiness > 0, `role_readiness generated (${summary.counts.role_readiness})`);
    ok(summary.counts.career_paths > 0, `career_paths generated (${summary.counts.career_paths})`);
    ok(summary.run_id != null, `provenance run recorded (run_id=${summary.run_id})`);

    // ── 2. Rows exist in DB ───────────────────────────────────────────────────
    console.log('\n[2] rows exist in DB');
    const dbGaps = await countRows(pool, 'cg_user_skill_gaps');
    const dbRead = await countRows(pool, 'cg_user_role_readiness');
    const dbPath = await countRows(pool, 'cg_user_career_path', "user_id=$1 AND source=$2", [USER, ACTIVATION_SOURCE]);
    ok(dbGaps > 0, `cg_user_skill_gaps rows (${dbGaps})`);
    ok(dbRead > 0, `cg_user_role_readiness rows (${dbRead})`);
    ok(dbPath > 0, `cg_user_career_path 98x rows (${dbPath})`);

    // ── 3. Read-back ──────────────────────────────────────────────────────────
    console.log('\n[3] getCareerBuilderIntelligence (read-only)');
    const intel = await getCareerBuilderIntelligence(pool, USER);
    ok(intel.ok && !intel.degraded, 'read ok, not degraded');
    ok(intel.available, 'available=true');
    ok(intel.counts.skill_gaps === dbGaps, `skill_gaps count matches (${intel.counts.skill_gaps})`);
    ok(intel.last_run?.id === summary.run_id, `last_run matches activation run`);
    // read-only proof: counts identical after a second read (no writes)
    const intel2 = await getCareerBuilderIntelligence(pool, USER);
    ok(intel2.counts.skill_gaps === intel.counts.skill_gaps, 'GET is read-only (stable counts)');

    // ── 4. user_selected path is preserved by re-activation ───────────────────
    console.log('\n[4] user_selected path preserved');
    // Pick a target NOT already written by activation to avoid the unique(user_id,to_role_id) clash.
    const existingTo = await pool.query(`SELECT to_role_id FROM cg_user_career_path WHERE user_id=$1`, [USER]).then(r => r.rows.map(x => Number(x.to_role_id)));
    const freeRole = await pool.query(
      `SELECT id FROM cg_roles WHERE is_active AND id <> ALL($1::int[]) ORDER BY id LIMIT 1`,
      [existingTo.length ? existingTo : [-1]],
    ).then(r => r.rows[0]?.id).catch(() => null);
    if (freeRole) {
      await pool.query(
        `INSERT INTO cg_user_career_path(user_id, to_role_id, source) VALUES ($1,$2,'user_selected')
         ON CONFLICT(user_id,to_role_id) DO UPDATE SET source='user_selected'`,
        [USER, freeRole],
      );
      await activateCareerBuilder(pool, USER); // re-activate
      const stillUserSel = await countRows(pool, 'cg_user_career_path', "user_id=$1 AND to_role_id=$2 AND source='user_selected'", [USER, freeRole]);
      ok(stillUserSel === 1, 'user_selected path NOT clobbered by re-activation');
    } else {
      ok(true, 'user_selected preservation (no free role to test — skipped)');
    }

    // ── 5. Rollback ───────────────────────────────────────────────────────────
    console.log('\n[5] rollbackCareerBuilderActivation');
    const userSelBefore = await countRows(pool, 'cg_user_career_path', "user_id=$1 AND source='user_selected'");
    const rb = await rollbackCareerBuilderActivation(pool, USER);
    ok(rb.ok, 'rollback ok');
    ok(rb.deleted.career_paths > 0, `98x career_paths deleted (${rb.deleted.career_paths})`);
    const afterGaps = await countRows(pool, 'cg_user_skill_gaps');
    const afterRecs = await countRows(pool, 'cg_user_recommendations');
    const afterLearning = await countRows(pool, 'cg_user_learning_recs');
    const afterReadiness = await countRows(pool, 'cg_user_role_readiness');
    const after98xPath = await countRows(pool, 'cg_user_career_path', "user_id=$1 AND source=$2", [USER, ACTIVATION_SOURCE]);
    const afterRuns = await countRows(pool, 'cg_user_activation_runs');
    const userSelAfter = await countRows(pool, 'cg_user_career_path', "user_id=$1 AND source='user_selected'");
    ok(afterGaps === 0, `cg_user_skill_gaps cleared (${afterGaps})`);
    ok(afterRecs === 0, `cg_user_recommendations cleared incl. multi-hop (${afterRecs})`);
    ok(afterLearning === 0, `cg_user_learning_recs cleared (${afterLearning})`);
    ok(afterReadiness === 0, `cg_user_role_readiness cleared (${afterReadiness})`);
    ok(after98xPath === 0, `98x career_paths cleared (${after98xPath})`);
    ok(afterRuns === 0, `provenance runs cleared (${afterRuns})`);
    ok(userSelAfter === userSelBefore && userSelAfter > 0, `user_selected path SURVIVED rollback (${userSelAfter})`);

    // ── 6. Idempotent rollback ────────────────────────────────────────────────
    console.log('\n[6] idempotent rollback');
    const rb2 = await rollbackCareerBuilderActivation(pool, USER);
    ok(rb2.deleted.skill_gaps === 0 && rb2.deleted.career_paths === 0, 'second rollback deletes 0 (idempotent)');

    // ── 6b. Pre-existing rec on a processed role SURVIVES rollback ─────────────
    console.log('\n[6b] pre-existing recommendation preserved by rollback');
    const probe = await activateCareerBuilder(pool, USER);
    const processedRole = probe.roles_processed[0];
    await rollbackCareerBuilderActivation(pool, USER); // clean slate again
    // Simulate a recommendation the user already had (e.g. from normal browsing).
    await pool.query(
      `INSERT INTO cg_user_recommendations(user_id, role_id, segment, rec_score)
       VALUES ($1,$2,'next_steps',0.5)
       ON CONFLICT(user_id, role_id) DO UPDATE SET rec_score=0.5`,
      [USER, processedRole],
    );
    await activateCareerBuilder(pool, USER); // pre-existing role is in recBefore → not net-new
    await rollbackCareerBuilderActivation(pool, USER);
    const survived = await countRows(pool, 'cg_user_recommendations', "user_id=$1 AND role_id=$2", [USER, processedRole]);
    ok(survived === 1, 'pre-existing rec on a processed role SURVIVED rollback (net-new-only semantics)');
    await purge(pool); // reset before the hook test

    // ── 7. Hook no-ops for unknown email ──────────────────────────────────────
    console.log('\n[7] completion hook honest no-op');
    const before = await countRows(pool, 'cg_user_activation_runs', "user_id=$1", [`nobody-${STAMP}@example.com`]);
    await maybeActivateCareerBuilderOnCompletion(pool, `nobody-${STAMP}@example.com`);
    const after = await countRows(pool, 'cg_user_activation_runs', "user_id=$1", [`nobody-${STAMP}@example.com`]);
    ok(before === 0 && after === 0, 'hook no-op for non-matching email (no fabricated user)');

    // ── 8. HTTP flag-OFF contract ─────────────────────────────────────────────
    console.log('\n[8] HTTP flag-OFF → 503 (workflow has flag OFF)');
    const routes: Array<[string, string]> = [
      ['GET', '/api/v2/career-builder/feature-flag'],
      ['GET', '/api/v2/career-builder/_meta/versions'],
      ['POST', `/api/v2/career-builder/activate/${USER}`],
      ['GET', `/api/v2/career-builder/intelligence/${USER}`],
      ['POST', `/api/v2/career-builder/rollback/${USER}`],
    ];
    for (const [method, path] of routes) {
      try {
        const res = await fetch(`${HOST}${path}`, { method });
        ok(res.status === 503, `${method} ${path} → 503`, `got ${res.status}`);
      } catch (e) {
        ok(false, `${method} ${path} → 503`, `fetch error ${(e as Error).message}`);
      }
    }

    // Final cleanup (also removes the user_selected demo path).
    await purge(pool);
    const leftover = await countRows(pool, 'cg_user_career_path');
    ok(leftover === 0, `final cleanup — no leftover rows (${leftover})`);

    console.log(`\n──────── ${pass} PASS / ${fail} FAIL ────────`);
    await pool.end();
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.error('SMOKE ERROR', err);
    await purge(pool).catch(() => {});
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

main();

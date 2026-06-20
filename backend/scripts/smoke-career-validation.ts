/**
 * PHASE 4.12 — Super Admin Career Validation smoke test (engine-level, no HTTP).
 *
 * Verifies the honesty/compose contract WITHOUT mutating live data:
 *   - the harness never throws on an absent/unknown subject (read-only, never-throws)
 *   - returns all THIRTEEN areas with valid statuses (pass|warn|fail)
 *   - Career Matching (Phase 4.2) is reported as an honest WARN, never fabricated
 *   - every area's rolled-up status = worst of its checks; summary folds correctly
 *   - GET-never-writes: no career-* lazy table is created by a read (to_regclass null
 *     before == null after for a representative lazily-created config table)
 *
 * Run: cd backend && npx tsx scripts/smoke-career-validation.ts
 */

import { Pool } from 'pg';
import {
  SUPER_ADMIN_CAREER_VALIDATION_VERSION,
  runSuperAdminCareerValidation,
  type ValidationStatus,
} from '../services/super-admin-career-validation-engine.js';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${msg}`);
  }
}

const VALID: ValidationStatus[] = ['pass', 'warn', 'fail'];

async function regclass(pool: Pool, table: string): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Phase 4.12 — Super Admin Career Validation smoke\n');

    // ---- GET-never-writes: capture pre-state of a lazily-created config table ----
    // career_signal_library is created only by the signal admin write path; a read
    // of the validation harness must NOT bring it into existence.
    const probeTable = 'career_signal_library';
    const existedBefore = await regclass(pool, probeTable);

    // ---- Read-only run on a non-existent subject ----------------------------
    console.log('Read-only run (unknown subject):');
    const res = await runSuperAdminCareerValidation(pool, `smoke_no_such_subject_${Date.now()}`);
    ok(res.ok === true, 'result ok (never throws)');
    ok(res.version === SUPER_ADMIN_CAREER_VALIDATION_VERSION, `version is ${SUPER_ADMIN_CAREER_VALIDATION_VERSION}`);
    ok(res.areas.length === 13, `returns all thirteen areas (got ${res.areas.length})`);

    const expectedAreas = [
      'career_architecture', 'career_matching', 'career_readiness', 'career_gaps',
      'career_roadmaps', 'career_development', 'career_recommendations', 'career_simulations',
      'career_passport', 'career_signals', 'career_tracking', 'audit_logs', 'permissions',
    ];
    ok(
      expectedAreas.every((id) => res.areas.some((a) => a.id === id)),
      'all thirteen canonical area ids present',
    );

    // ---- Every status is one of the three legal values ----------------------
    console.log('\nStatus legality:');
    ok(VALID.includes(res.summary.status), `summary status is legal (${res.summary.status})`);
    ok(
      res.areas.every((a) => VALID.includes(a.status)),
      'every area status is pass|warn|fail',
    );
    ok(
      res.areas.every((a) => a.checks.every((c) => VALID.includes(c.status))),
      'every check status is pass|warn|fail',
    );

    // ---- Rolled-up area status = worst of its checks ------------------------
    console.log('\nFold integrity:');
    const worstOf = (ss: ValidationStatus[]): ValidationStatus =>
      ss.includes('fail') ? 'fail' : ss.includes('warn') ? 'warn' : 'pass';
    ok(
      res.areas.every((a) => a.status === worstOf(a.checks.map((c) => c.status))),
      'each area status = worst of its checks',
    );
    ok(
      res.summary.status === worstOf(res.areas.map((a) => a.status)),
      'summary status = worst of all areas',
    );
    ok(
      res.summary.pass + res.summary.warn + res.summary.fail === res.areas.length,
      'summary pass+warn+fail = areas_total',
    );
    ok(res.summary.areas_total === res.areas.length, 'areas_total matches areas length');

    // ---- Career Matching (4.2) reported as honest WARN, never fabricated -----
    console.log('\nCareer Matching honest-absence:');
    const matching = res.areas.find((a) => a.id === 'career_matching')!;
    ok(matching.status === 'warn', 'Career Matching area is WARN (not yet built)');
    ok(matching.measurable === false, 'Career Matching is not measurable (honest absence)');
    ok(
      matching.checks.some((c) => c.id === 'matching_built' && c.status === 'warn'),
      'matching_built check WARNs that Phase 4.2 is not yet built',
    );

    // ---- Subject areas with no measured profile WARN (never FAIL) -----------
    console.log('\nUnknown subject => no fabricated FAILs from absent data:');
    const subjectAreas = res.areas.filter((a) => a.scope === 'subject');
    ok(subjectAreas.length === 10, `ten subject-scoped areas (got ${subjectAreas.length})`);
    // An unknown subject must never produce a FAIL from missing data — only WARN.
    const subjectFails = subjectAreas.filter((a) => a.status === 'fail');
    ok(subjectFails.length === 0, `no subject area FAILs on an unknown subject (got ${subjectFails.map((a) => a.id).join(',') || 'none'})`);

    // ---- Platform areas present --------------------------------------------
    console.log('\nPlatform governance probes:');
    ok(res.areas.some((a) => a.id === 'audit_logs' && a.scope === 'platform'), 'Audit Logs is a platform area');
    ok(res.areas.some((a) => a.id === 'permissions' && a.scope === 'platform'), 'Permissions is a platform area');
    ok(typeof res.runtime_provisioned === 'boolean', 'runtime_provisioned flag surfaced');

    // ---- Every area + check carries human-readable copy --------------------
    ok(
      res.areas.every((a) => a.label && a.checks.every((c) => c.label && c.detail)),
      'every area + check carries label/detail copy',
    );
    ok(Array.isArray(res.notes) && res.notes.length > 0, 'honest top-level notes present');

    // ---- GET-never-writes: post-state unchanged ----------------------------
    console.log('\nGET-never-writes:');
    const existedAfter = await regclass(pool, probeTable);
    ok(existedBefore === existedAfter, `read did not create ${probeTable} (before=${existedBefore} after=${existedAfter})`);

    console.log(`\nruntime_provisioned=${res.runtime_provisioned} · status=${res.summary.status} · pass=${res.summary.pass} warn=${res.summary.warn} fail=${res.summary.fail}`);
    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(1);
});

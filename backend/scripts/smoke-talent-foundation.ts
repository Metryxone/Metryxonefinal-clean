/**
 * Smoke test for Phase 5.1/5.2 Talent Foundation aggregator (compose-only).
 * Runs the aggregator directly against the live DB and asserts honesty invariants.
 * Usage: cd backend && npx tsx scripts/smoke-talent-foundation.ts
 */
import { Pool } from 'pg';
import { buildTalentFoundationOverview } from '../services/talent-foundation-aggregator.js';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, detail = '') => {
    if (ok) { pass++; console.log(`  PASS ${name}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };
  try {
    const ov = await buildTalentFoundationOverview(pool, null);
    check('version present', ov.version === '5.1.0');
    check('two domains', ov.domains.length === 2, `got ${ov.domains.length}`);
    check('7 deliverables total', ov.rollup.deliverables_total === 7, `got ${ov.rollup.deliverables_total}`);
    check('read_only meta', ov._meta.read_only === true);

    const all = ov.domains.flatMap((d) => d.deliverables);
    const byName = Object.fromEntries(all.map((d) => [d.name, d]));

    // None should be 'missing' after the migration applied.
    const missing = all.filter((d) => d.coverage === 'missing').map((d) => d.name);
    check('no missing deliverables (migration applied)', missing.length === 0, `missing: ${missing.join(',')}`);

    // Populated sources must report present + a row count.
    check('employer_rbac present', byName.employer_rbac?.coverage === 'present', JSON.stringify(byName.employer_rbac));
    check('job_architecture present', byName.job_architecture?.coverage === 'present', JSON.stringify(byName.job_architecture));
    check('job_role_framework present', byName.job_role_framework?.coverage === 'present', JSON.stringify(byName.job_role_framework));

    // Empty sources must be honest 'absent' (NOT fabricated to present), rows === 0.
    check('employer_master honest absent (empty source)', byName.employer_master?.coverage === 'absent' && byName.employer_master?.rows === 0, JSON.stringify(byName.employer_master));
    check('job_templates honest absent (new gap table)', byName.job_templates?.coverage === 'absent' && byName.job_templates?.rows === 0, JSON.stringify(byName.job_templates));

    // No row count should ever be silently coerced — null only when unreadable.
    check('no fabricated counts (rows is number or null)', all.every((d) => d.rows === null || typeof d.rows === 'number'));

    // Every deliverable carries a source_authority for transparency.
    check('all carry source_authority', all.every((d) => typeof d.source_authority === 'string' && d.source_authority.length > 0));

    console.log(JSON.stringify(ov.rollup, null, 2));

    // Regression guard: legacy /api/talent/* and new /api/talent-foundation/*
    // must BOTH be live simultaneously (legacy auth-protected, new flag-gated).
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const legacy = await fetch(`${base}/api/admin/talent/summary`);
      check('legacy /api/admin/talent/summary restored (401 auth, not 404)', legacy.status === 401, `got ${legacy.status}`);
      const v52 = await fetch(`${base}/api/talent-foundation/overview`);
      check('new /api/talent-foundation/overview flag-gated (503)', v52.status === 503, `got ${v52.status}`);
    } catch (e: any) {
      console.log('  SKIP namespace HTTP guard (server unreachable):', e?.message ?? e);
    }
  } catch (e: any) {
    fail++;
    console.log('  FAIL aggregator threw:', e?.message ?? e);
  } finally {
    await pool.end();
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

/**
 * PHASE 8 — Global Competency smoke test.
 *
 * Two axes:
 *   A) Pure-engine contract (flag-independent): registry shape, default region, validators,
 *      coverage degrades-not-throws, default region inherits real counts, non-default empty.
 *   B) HTTP flag-OFF contract: every route is gated. The Backend API workflow runs with
 *      `globalCompetency` OFF, so each route must return one of {401, 403, 503} (never 200/500).
 *
 * Run: cd backend && npx tsx scripts/smoke-global-competency.ts
 */
import { Pool } from 'pg';
import {
  REGIONS,
  DEFAULT_REGION,
  SURFACES,
  isValidRegion,
  isValidSurface,
  computeRegionCoverage,
  validateEntityRefs,
} from '../services/global-competency-engine';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:8080';
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function httpStatus(method: string, path: string, body?: object): Promise<number> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\n[A] Pure-engine contract');
    check('registry has exactly 5 regions', REGIONS.length === 5, `got ${REGIONS.length}`);
    check('default region is IN', DEFAULT_REGION === 'IN');
    check('exactly one region flagged is_default', REGIONS.filter((r) => r.is_default).length === 1);
    check('default-flagged region is IN', REGIONS.find((r) => r.is_default)?.code === 'IN');
    check('expected region codes present', ['IN', 'ME', 'EU', 'US', 'APAC'].every((c) => isValidRegion(c)));
    check('invalid region rejected', !isValidRegion('XX'));
    check('5 surfaces declared', SURFACES.length === 5, `got ${SURFACES.length}`);
    check('surface validator accepts known', isValidSurface('role_library') && isValidSurface('demand_intelligence'));
    check('surface validator rejects unknown', !isValidSurface('nope'));

    let coverage;
    try {
      coverage = await computeRegionCoverage(pool);
      check('computeRegionCoverage does not throw', true);
    } catch (e) {
      check('computeRegionCoverage does not throw', false, (e as Error).message);
      throw e;
    }
    check('coverage reports 5 regions', coverage.regions.length === 5);
    const def = coverage.regions.find((r) => r.is_default)!;
    const nonDef = coverage.regions.filter((r) => !r.is_default);
    const defHasReal = def.surfaces.some((s) => (s.effective_content ?? 0) > 0);
    check('default region inherits real global content (>0 somewhere)', defHasReal);
    const allNonDefEmpty = nonDef.every((r) => r.surfaces.every((s) => (s.effective_content ?? 0) === 0));
    check('non-default regions are honestly empty (no fabricated content)', allNonDefEmpty);
    check('default region global_content populated, non-default null', def.surfaces.every((s) => s.global_content != null) && nonDef.every((r) => r.surfaces.every((s) => s.global_content == null)));

    // Honesty guard: a nonexistent entity_ref must be REJECTED (never taggable → never inflates coverage).
    const v = await validateEntityRefs(pool, 'role_library', ['__definitely_not_a_real_role__', '__nope__']);
    check('nonexistent refs are rejected, none valid', v.valid.length === 0 && v.invalid.length === 2, JSON.stringify(v));

    console.log('\n[B] HTTP flag-OFF contract (expect 401/403/503, never 200/500)');
    const ok = new Set([401, 403, 503]);
    const endpoints: Array<[string, string, object?]> = [
      ['GET', '/api/global-competency/regions'],
      ['GET', '/api/global-competency/coverage'],
      ['GET', '/api/global-competency/coverage/EU'],
      ['POST', '/api/global-competency/assign', { surface: 'role_library', region: 'EU', entity_refs: ['x'] }],
      ['POST', '/api/global-competency/rollback', {}],
    ];
    for (const [m, p, b] of endpoints) {
      const s = await httpStatus(m, p, b);
      check(`${m} ${p} gated`, ok.has(s), `got ${s}`);
    }

    console.log(`\n[smoke] ${passed} passed, ${failed} failed`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (err) {
    console.error('[smoke] FATAL:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();

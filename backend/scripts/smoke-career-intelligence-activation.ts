/**
 * PHASE 6 — Career Intelligence Activation: SMOKE.
 *
 * Asserts the additive / honesty-first contract:
 *   1. Flag OFF => HTTP GET /api/career/competency-activation/:userId returns 503
 *      `feature_disabled` BEFORE any DB touch (byte-identical-OFF).
 *   2. Service-level cold-start: buildActivationScores(null,null,null) is
 *      measurable:false with EVERY value null (no fabricated 0).
 *   3. Language policy is developmental-signal-only (disallowed hiring/suitability terms).
 *   4. IDOR: resolveEffectiveUserId pins non-admins to their own id and refuses an
 *      explicit cross-user request (no silent IDOR); super-admin may target another.
 *
 * The HTTP check requires the Backend API running with the flag OFF (the workflow
 * default). Run: cd backend && npx tsx scripts/smoke-career-intelligence-activation.ts
 */
import type { Request } from 'express';
import { buildActivationScores } from '../services/career-intelligence-bridge.js';
import { LANGUAGE_POLICY } from '../services/competency-ei-scoring-shared.js';
import { resolveEffectiveUserId } from '../routes/behavioural-memory.js';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failed++;
}

const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';

async function main() {
  // 1. Flag-OFF HTTP 503 contract.
  try {
    const r = await fetch(`${BASE}/api/career/competency-activation/smoke-user`);
    assert(r.status === 503, `flag-OFF => HTTP 503 (got ${r.status})`);
    const body = await r.json().catch(() => ({}));
    assert(body?.error === 'feature_disabled' && body?.flag === 'careerIntelligenceActivation',
      'flag-OFF body is {error:feature_disabled, flag:careerIntelligenceActivation}');
  } catch (err: any) {
    assert(false, `HTTP 503 check — backend reachable: ${err?.message ?? err}`);
  }

  // 2. Service-level cold-start — measurable:false, all values null (no fabrication).
  const cold = buildActivationScores(null, null, null);
  assert(cold.measurable === false, 'cold-start activation_scores.measurable === false');
  const all = [cold.career_readiness, cold.career_growth, cold.role_progression, cold.skill_gap];
  assert(all.every((s) => s.measurable === false), 'every cold score measurable=false');
  assert(all.every((s) => s.value === null), 'every cold score value=null (NOT a fabricated 0)');
  assert(all.every((s) => s.band === null), 'every cold score band=null');
  assert(cold.role_progression.direction === null, 'cold progression direction=null');
  assert(all.every((s) => typeof s.provenance === 'string' && s.provenance.length > 0), 'every cold score carries provenance');

  // 2b. Measured fixture — values trace to inputs (no recomputation / fabrication).
  const measured = buildActivationScores(
    { measurable: true, growth_potential: { score: 62, level: 'Moderate' } } as any,
    {
      measurable: true,
      readiness: { score: 74, band: 'Developing' },
      role_gap: { blocking_gaps: 1, gap_areas: [{ competency_name: 'X', required_level: 80, actual_level: 55, gap: 25, criticality: 'critical', blocking: true }] },
    } as any,
    { ei_history: { snapshots: [{ ei_score: 71 }, { ei_score: 58 }] } } as any,
  );
  assert(measured.measurable === true, 'measured fixture measurable=true');
  assert(measured.career_readiness.value === 74, 'readiness value traces to role.readiness.score (74)');
  assert(measured.career_growth.value === 62, 'growth value traces to growth_potential.score (62)');
  assert(measured.role_progression.measurable === true && measured.role_progression.direction === 'improving',
    'progression measurable + improving from 58→71');
  assert(measured.skill_gap.measurable === true && (measured.skill_gap.value ?? 0) > 0, 'skill-gap pressure measurable + > 0');

  // 3. Language policy — developmental signals only.
  assert(LANGUAGE_POLICY.intent === 'developmental_signal_only', 'language policy intent = developmental_signal_only');
  assert(Array.isArray(LANGUAGE_POLICY.disallowed_terms) && LANGUAGE_POLICY.disallowed_terms.includes('suitability'),
    'language policy disallows "suitability" (no hiring/suitability predictions)');

  // 4. IDOR via resolveEffectiveUserId.
  const asReq = (id: string, role?: string): Request => ({ user: { id, role } } as any);
  assert(resolveEffectiveUserId(asReq('u1'), 'u2').forbidden === true, 'non-admin cross-user request => forbidden');
  assert(resolveEffectiveUserId(asReq('u1'), 'u1').userId === 'u1', 'non-admin same-user request => own id');
  assert(resolveEffectiveUserId(asReq('u1'), undefined).userId === 'u1', 'non-admin no id => own id');
  assert(resolveEffectiveUserId(asReq('admin', 'super_admin'), 'u2').userId === 'u2', 'super-admin may target another user');
  assert(resolveEffectiveUserId({} as any, 'u2').userId === undefined, 'unauthenticated => no user id (no leak)');

  // eslint-disable-next-line no-console
  console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[smoke] fatal', err);
  process.exit(1);
});

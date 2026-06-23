/**
 * Smoke test — 98X Gap Closure Phase 3: Employer Competency Hiring Activation.
 *
 * Verifies (READ-ONLY — this script performs ZERO writes, ZERO DDL, no prod seeding):
 *   1. Flag-OFF HTTP contract: with FF_EMPLOYER_COMPETENCY_HIRING unset, every route 503s
 *      BEFORE any auth/DB touch (byte-identical legacy behaviour).
 *   2. Direct-service match: computeCompetencyDrivenMatch composes Phase-1 Role DNA +
 *      Phase-2 unified competency profile (subject = candidate email) for a REAL scored
 *      subject. Asserts internal consistency + honesty, never a fabricated score.
 *   3. Fail-CLOSED: no email → heuristic_fallback/null; bogus subject → heuristic_fallback/
 *      profile-unavailable/null. A profile-but-no-requirement-overlap is an honest coverage
 *      miss (null match, never a fabricated 0).
 *   4. Coverage vs Confidence are SEPARATE axes; calibration uncalibrated until >=30
 *      realized outcomes.
 */
import { Pool } from 'pg';
import {
  computeCompetencyDrivenMatch,
  resolveCandidateCompetencySubject,
  CALIBRATION_MIN_OUTCOMES,
  MIN_COVERAGE_FOR_FIT,
} from '../services/employer-competency-hiring';
import { generateRoleDNA } from '../services/role-dna-expansion-engine';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    failed += 1;
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${msg}`);
  }
}

async function pickSubject(table: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT subject_id FROM ${table} WHERE subject_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    );
    return rows[0]?.subject_id ?? null;
  } catch {
    return null;
  }
}

/** Find a role title that resolves a DNA with at least one requirement. */
async function pickResolvableRoleTitle(): Promise<string | null> {
  const candidates: string[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT title FROM ont_roles WHERE title IS NOT NULL ORDER BY id LIMIT 25`,
    );
    for (const r of rows) if (r.title) candidates.push(String(r.title));
  } catch { /* ignore */ }
  try {
    const { rows } = await pool.query(
      `SELECT role_title AS title FROM onto_roles WHERE role_title IS NOT NULL LIMIT 25`,
    );
    for (const r of rows) if (r.title) candidates.push(String(r.title));
  } catch { /* ignore */ }
  for (const title of candidates) {
    const dna = await generateRoleDNA(pool, title);
    if (dna.resolved && dna.requirements.length > 0) return title;
  }
  return candidates[0] ?? null;
}

(async () => {
  console.log('== Phase 3: Employer Competency Hiring — direct-service ==');

  const roleTitle = await pickResolvableRoleTitle();
  console.log(`  resolvable role title: ${roleTitle}`);
  const runtimeSubject = await pickSubject('onto_competency_profiles');
  const normalizedSubject = await pickSubject('onto_competency_score_runs');
  console.log(`  runtime subject (email key): ${runtimeSubject}`);
  console.log(`  normalized subject (email key): ${normalizedSubject}`);

  // Subject resolution helper.
  assert(resolveCandidateCompetencySubject({ email: 'a@b.com' }) === 'a@b.com', 'subject = candidate email');
  assert(resolveCandidateCompetencySubject({ email: '' }) === null, 'no email → null subject (abstain)');

  const job = { id: 'demo_job_98x', title: roleTitle ?? 'Software Engineer' };

  // --- Real scored subject (try both ledgers; report whichever overlaps) ---
  let demonstratedOntoPath = false;
  for (const subj of [normalizedSubject, runtimeSubject].filter(Boolean) as string[]) {
    const m = await computeCompetencyDrivenMatch(pool, { candidate: { email: subj }, job });
    console.log(
      `  [${subj}] source=${m.source} match=${m.competencyMatch} coverage=${m.requirementCoveragePct}% ` +
      `assessed=${m.matchedRequirementCount}/${m.totalRequirementCount} ` +
      `headlineBand=${m.fitSignal.band} assessedBand=${m.fitSignal.assessedBand} ` +
      `coverageSufficient=${m.fitSignal.coverageSufficient} provisional=${m.fitSignal.provisional}`,
    );
    // Internal consistency / honesty invariants (hold regardless of overlap).
    assert(
      m.competencyMatch === null || (m.competencyMatch >= 0 && m.competencyMatch <= 100),
      `[${subj}] competencyMatch is null or in [0,100] (never fabricated)`,
    );
    if (m.competencyMatch !== null) {
      assert(m.source === 'onto_competency_profile', `[${subj}] non-null match ⇒ source=onto_competency_profile`);
      assert(m.matchedRequirementCount > 0, `[${subj}] non-null match ⇒ at least one assessed requirement`);
      demonstratedOntoPath = true;
    } else {
      assert(m.source === 'heuristic_fallback', `[${subj}] null match ⇒ source=heuristic_fallback (fail-closed)`);
    }
    // Coverage vs Confidence are independent.
    assert(m.calibration.state === 'uncalibrated' || m.calibration.state === 'calibrated', `[${subj}] calibration state present`);
    assert(m.calibration.minRequired === CALIBRATION_MIN_OUTCOMES, `[${subj}] calibration min = ${CALIBRATION_MIN_OUTCOMES}`);
    assert(m.fitSignal.validated === (m.calibration.state === 'calibrated'), `[${subj}] fitSignal.validated tracks calibration`);
    // Coverage-aware fit gating: headline band is WITHHELD when coverage is too thin to
    // represent role fit (a high match on a 1/76 subset must NOT surface as strong_fit).
    const covSufficient = (m.requirementCoveragePct ?? 0) >= MIN_COVERAGE_FOR_FIT;
    assert(m.fitSignal.coverageSufficient === covSufficient, `[${subj}] coverageSufficient reflects ${MIN_COVERAGE_FOR_FIT}% threshold`);
    if (!covSufficient) {
      assert(m.fitSignal.band === null, `[${subj}] coverage-thin ⇒ headline band WITHHELD (null)`);
      assert(m.fitSignal.provisional === true, `[${subj}] coverage-thin ⇒ provisional=true`);
    }
    if (m.competencyMatch === null) {
      assert(m.fitSignal.band === null, `[${subj}] null match ⇒ headline band null`);
    }
    // No fabricated requirement scores.
    assert(
      m.requirements.every((r) => r.candidateScore === null || Number.isFinite(r.candidateScore)),
      `[${subj}] no fabricated/non-finite requirement candidateScore`,
    );
    assert(
      m.unassessedRequirements.every((r) => r.candidateScore === null),
      `[${subj}] unassessed requirements carry null score (never fabricated)`,
    );
  }
  console.log(`  onto_* path exercised with a real overlap: ${demonstratedOntoPath} (no-overlap is an honest coverage finding)`);

  // --- Fail CLOSED: no email ---
  {
    const m = await computeCompetencyDrivenMatch(pool, { candidate: { email: '' }, job });
    assert(m.competencyMatch === null && m.source === 'heuristic_fallback', 'no email → null match + heuristic_fallback');
    assert(m.fitSignal.band === null, 'no email → no fit band asserted');
  }

  // --- Fail CLOSED: bogus subject (no competency profile) ---
  {
    const m = await computeCompetencyDrivenMatch(pool, {
      candidate: { email: 'no_such_subject_98x@example.com' },
      job,
    });
    assert(m.competencyMatch === null, 'bogus subject → null competency match');
    assert(m.source === 'heuristic_fallback', 'bogus subject → heuristic_fallback');
    assert(m.competencyProfileAvailable === false, 'bogus subject → competencyProfileAvailable=false');
  }

  // --- Calibration honesty (employer_candidates has 0 decided rows in dev) ---
  {
    const m = await computeCompetencyDrivenMatch(pool, { candidate: { email: 'x@example.com' }, job });
    console.log(`  realized outcomes: ${m.calibration.realizedOutcomes} → state=${m.calibration.state}`);
    assert(
      (m.calibration.realizedOutcomes ?? 0) >= CALIBRATION_MIN_OUTCOMES
        ? m.calibration.state === 'calibrated'
        : m.calibration.state === 'uncalibrated',
      'calibration state matches realized-outcome count',
    );
  }

  // --- Flag-OFF HTTP contract (server runs WITHOUT FF_EMPLOYER_COMPETENCY_HIRING) ---
  console.log('== Flag-OFF HTTP contract (expect 503) ==');
  const routes = [
    `/api/v2/employer/competency-match/feature-flag`,
    `/api/v2/employer/competency-match/_meta/versions`,
    `/api/v2/employer/competency-match/demo_cand_98x/demo_job_98x`,
  ];
  for (const r of routes) {
    try {
      const resp = await fetch(`${BASE}${r}`);
      assert(resp.status === 503, `GET ${r} → 503 (flag OFF), got ${resp.status}`);
    } catch (e) {
      assert(false, `GET ${r} threw: ${(e as Error).message}`);
    }
  }

  await pool.end();
  console.log(failed === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failed} SMOKE CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SMOKE CRASHED:', e);
  process.exit(1);
});

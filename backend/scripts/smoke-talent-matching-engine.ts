/**
 * Phase 5.5 — Competency Matching Engine smoke.
 *
 * Seeds @example.com demo candidates (measured / inferred / no-evidence tiers)
 * against the EXISTING onto role profiles, exercises the five-axis match +
 * ranking + explanation, then removes every demo row. HTTP check proves the
 * route is flag-gated 503 on the running server (flag OFF there).
 *
 * Run: FF_TALENT_MATCHING=1 npx tsx scripts/smoke-talent-matching-engine.ts
 */
import { Pool } from 'pg';
import {
  matchCandidateToRole,
  rankCandidatesForRole,
  rankRolesForCandidate,
} from '../services/talent-matching-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) { passed += 1; console.log(`  PASS ${name}`); }
  else { failed += 1; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const ROLE = 'role_be_eng';          // Backend Engineer: agile(4,crit) accountability(4,crit) adaptability(3) resilience(3), wt 25 each
const NO_PROFILE_ROLE = 'role_eng_manager';
const EMP = 'demo_emp_p55';
const IDS = {
  alice: 'demo_p55_alice',  // measured, all meet/exceed → strong fit
  bob: 'demo_p55_bob',      // measured, critical accountability below → blocking cap
  carol: 'demo_p55_carol',  // keyword skills only → inferred, low confidence
  dave: 'demo_p55_dave',    // no skills/profile → no evidence
};

async function seedCandidate(pool: Pool, id: string, name: string, skills: any[], profile: any): Promise<void> {
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, name, email, candidate_role, skills, competency_profile, ei_score, assessment_score, match_score, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10, now())
     ON CONFLICT (id) DO UPDATE SET skills=EXCLUDED.skills, competency_profile=EXCLUDED.competency_profile`,
    [id, EMP, name, `${id}@example.com`, 'Engineer', JSON.stringify(skills), JSON.stringify(profile), 72, 65, 50],
  );
}

async function cleanup(pool: Pool): Promise<void> {
  await pool.query(`DELETE FROM employer_candidates WHERE id = ANY($1)`, [Object.values(IDS)]);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await cleanup(pool);

    // measured: explicit per-competency levels keyed by competency_id.
    await seedCandidate(pool, IDS.alice, 'Alice Demo', ['Backend'], [
      { competency_id: 'comp_agile_collaboration', level: 5 },
      { competency_id: 'comp_accountability', level: 4 },
      { competency_id: 'comp_adaptability', level: 4 },
      { competency_id: 'comp_personal_resilience', level: 3 },
    ]);
    // measured but a CRITICAL competency below required → blocking gap.
    await seedCandidate(pool, IDS.bob, 'Bob Demo', ['Backend'], [
      { competency_id: 'comp_agile_collaboration', level: 5 },
      { competency_id: 'comp_accountability', level: 2 },
      { competency_id: 'comp_adaptability', level: 4 },
      { competency_id: 'comp_personal_resilience', level: 3 },
    ]);
    // inferred only: skill keywords that match two competency names, no levels.
    await seedCandidate(pool, IDS.carol, 'Carol Demo', ['Agile', 'Accountability'], null);
    // no evidence at all.
    await seedCandidate(pool, IDS.dave, 'Dave Demo', [], null);
    check('seeded 4 demo candidates', true);

    // ── GET-never-writes regression guard: snapshot relation count before any
    //    engine call so we can prove the read path triggers NO DDL (no lazy
    //    ensure-schema CREATE TABLE/INDEX). ─────────────────────────────────
    const relCount = async (): Promise<number> =>
      Number((await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relkind IN ('r','i')`)).rows[0].n);
    const relBefore = await relCount();

    // ── Alice: measured strong fit ─────────────────────────────────────────
    const aliceR = await matchCandidateToRole(pool, IDS.alice, ROLE);
    check('Alice match ok', aliceR.ok);
    if (aliceR.ok) {
      const m = aliceR.data;
      check('Alice match_pct=100 (full breadth)', m.match_pct === 100, `got ${m.match_pct}`);
      check('Alice readiness_pct=100', m.readiness_pct === 100, `got ${m.readiness_pct}`);
      check('Alice fit_pct=100', m.fit_pct === 100, `got ${m.fit_pct}`);
      check('Alice gap_pct=0', m.gap_pct === 0, `got ${m.gap_pct}`);
      check('Alice confidence_pct=100 (all measured)', m.confidence_pct === 100, `got ${m.confidence_pct}`);
      check('Alice fit_band=strong', m.fit_band === 'strong', m.fit_band);
      check('Alice not capped', m.capped_by_critical === false);
      check('Alice evidence all measured (4)', m.evidence_mix.measured === 4 && m.evidence_mix.inferred === 0 && m.evidence_mix.none === 0);
      check('Alice all breakdown status=met', m.breakdown.every((b) => b.status === 'met'));
    }

    // ── Bob: blocking critical gap caps fit band ───────────────────────────
    const bobR = await matchCandidateToRole(pool, IDS.bob, ROLE);
    check('Bob match ok', bobR.ok);
    if (bobR.ok) {
      const m = bobR.data;
      check('Bob has 1 blocking gap', m.blocking_gaps === 1, `got ${m.blocking_gaps}`);
      check('Bob capped_by_critical true', m.capped_by_critical === true);
      check('Bob fit_band downgraded to partial', m.fit_band === 'partial', m.fit_band);
      check('Bob readiness 87.5 (weighted attainment)', m.readiness_pct === 87.5, `got ${m.readiness_pct}`);
      check('Bob match_pct=100 (full breadth despite gap)', m.match_pct === 100, `got ${m.match_pct}`);
      const acct = m.breakdown.find((b) => b.competency_id === 'comp_accountability');
      check('Bob accountability status=blocking_gap', acct?.status === 'blocking_gap', acct?.status);
    }

    // ── Carol: inferred-only → breadth present, confidence low ──────────────
    const carolR = await matchCandidateToRole(pool, IDS.carol, ROLE);
    check('Carol match ok', carolR.ok);
    if (carolR.ok) {
      const m = carolR.data;
      check('Carol evidence inferred=2, none=2', m.evidence_mix.inferred === 2 && m.evidence_mix.none === 2, JSON.stringify(m.evidence_mix));
      check('Carol match_pct=50 (2/4 weighted breadth)', m.match_pct === 50, `got ${m.match_pct}`);
      check('Carol confidence low (<=30, inferred-discounted)', (m.confidence_pct ?? 99) <= 30, `got ${m.confidence_pct}`);
      check('Carol confidence < Alice confidence', (m.confidence_pct ?? 0) < 100);
      check('Carol fit_pct < Alice fit_pct', (m.fit_pct ?? 0) < 100);
      const inf = m.breakdown.find((b) => b.competency_id === 'comp_agile_collaboration');
      check('Carol agile is inferred', inf?.evidence === 'inferred', inf?.evidence);
      check('Carol has a no_evidence competency', m.breakdown.some((b) => b.status === 'no_evidence'));
    }

    // ── Dave: no evidence → zeros, honest (not null when profile exists) ────
    const daveR = await matchCandidateToRole(pool, IDS.dave, ROLE);
    check('Dave match ok', daveR.ok);
    if (daveR.ok) {
      const m = daveR.data;
      check('Dave measurable (role has profile)', m.measurable === true);
      check('Dave match_pct=0', m.match_pct === 0, `got ${m.match_pct}`);
      check('Dave readiness null (nothing assessed)', m.readiness_pct === null, `got ${m.readiness_pct}`);
      check('Dave fit_pct=0', m.fit_pct === 0, `got ${m.fit_pct}`);
      check('Dave gap_pct=100', m.gap_pct === 100, `got ${m.gap_pct}`);
      check('Dave confidence_pct=0', m.confidence_pct === 0, `got ${m.confidence_pct}`);
      check('Dave all breakdown no_evidence', m.breakdown.every((b) => b.status === 'no_evidence'));
    }

    // ── role with no competency profile → not measurable, scores null ───────
    const noProf = await matchCandidateToRole(pool, IDS.alice, NO_PROFILE_ROLE);
    check('no-profile role match ok', noProf.ok);
    if (noProf.ok) {
      check('no-profile measurable=false', noProf.data.measurable === false);
      check('no-profile scores null', noProf.data.match_pct === null && noProf.data.fit_pct === null && noProf.data.confidence_pct === null);
      check('no-profile note explains missing profile', noProf.data.notes.some((n) => /no competency profile/i.test(n)));
    }

    // ── ranking: candidates for the role (Alice should top) ─────────────────
    const rank = await rankCandidatesForRole(pool, ROLE, { limit: 50 });
    check('rankCandidatesForRole ok', rank.ok);
    if (rank.ok) {
      const demo = rank.data.candidates.filter((c) => c.candidate_id.startsWith('demo_p55_'));
      check('rank includes 4 demo candidates', demo.length === 4, `got ${demo.length}`);
      check('rank Alice first among demo (highest fit)', demo[0]?.candidate_id === IDS.alice, demo[0]?.candidate_id);
      check('rank sorted by fit desc', demo.every((c, i) => i === 0 || (demo[i - 1].fit_pct ?? 0) >= (c.fit_pct ?? 0)));
    }

    // ── ranking: roles for a candidate ─────────────────────────────────────
    const roleRank = await rankRolesForCandidate(pool, IDS.alice, { limit: 50 });
    check('rankRolesForCandidate ok', roleRank.ok);
    if (roleRank.ok) {
      check('roles ranked only over profiled roles (>=1)', roleRank.data.roles.length >= 1);
      check('roles ranked include role_be_eng', roleRank.data.roles.some((r) => r.role_id === ROLE));
      check('roles sorted by fit desc', roleRank.data.roles.every((r, i) => i === 0 || (roleRank.data.roles[i - 1].fit_pct ?? 0) >= (r.fit_pct ?? 0)));
    }

    // ── not-found paths ────────────────────────────────────────────────────
    const badCand = await matchCandidateToRole(pool, 'demo_p55_nope', ROLE);
    check('unknown candidate -> not_found', !badCand.ok && badCand.code === 'not_found');
    const badRole = await matchCandidateToRole(pool, IDS.alice, 'role_does_not_exist');
    check('unknown role -> not_found', !badRole.ok && badRole.code === 'not_found');
    const badInput = await matchCandidateToRole(pool, '   ', ROLE);
    check('blank candidate -> invalid_input', !badInput.ok && badInput.code === 'invalid_input');

    // ── prove the read path created no relations (GET-never-writes / no DDL) ─
    const relAfter = await relCount();
    check('read path created ZERO relations (no DDL)', relAfter === relBefore, `before ${relBefore}, after ${relAfter}`);

    // ── HTTP flag-gated 503 on the running server (flag OFF there) ──────────
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r = await fetch(`${base}/api/talent-matching-engine/_meta/status`);
      check('HTTP /_meta/status flag-gated 503 (server flag OFF)', r.status === 503, `got ${r.status}`);
      const r2 = await fetch(`${base}/api/talent-matching-engine/candidate/${IDS.alice}/role/${ROLE}`);
      check('HTTP /candidate/:c/role/:r flag-gated 503', r2.status === 503, `got ${r2.status}`);
    } catch (e: any) {
      check('HTTP flag-gate reachable', false, e?.message);
    }
  } finally {
    await cleanup(pool);
    console.log('  cleanup: removed demo candidates');
    await pool.end();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Task #144 E2E — live HTTP proof of the candidate precise-scores flow.
 *
 * Unlike task136-smoke.ts (which exercises the write + resolver IN-PROCESS,
 * bypassing auth/session), this test drives the REAL HTTP surface end to end:
 *
 *   1. Registers a candidate over HTTP (POST /api/register) and keeps the
 *      session cookie — i.e. authenticates as a real logged-in candidate.
 *   2. Submits a real assessment via POST /api/competency/run-assessment with
 *      that cookie (a mix of mapped + unmapped CRA codes).
 *   3. Reads GET /api/competency/precise-scores with the SAME cookie and asserts
 *      it returns the expected competency-granularity scores keyed to that
 *      authenticated session (subject resolved server-side from the session, so
 *      this catches auth/session/identity regressions the in-process smoke can't).
 *
 * Self-cleaning: uses a @example.com candidate and DELETEs every row it creates
 * (users, cra_profiles, cra_scores, onto_competency_score_runs) before AND after.
 *
 * Requires the competencyRuntime flag ON (FF_COMPETENCY_RUNTIME=1 — the Backend
 * API workflow already sets it). With the flag OFF the precise field is omitted
 * and { enabled:false } is returned; this test asserts the flag-ON behaviour.
 *
 * Run: npx tsx backend/scripts/task144-e2e-precise-scores.ts
 *      (optional: SMOKE_BASE=http://localhost:8080)
 */
import { Pool } from 'pg';

const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';
const EMAIL = 'task144-e2e@example.com';
const PASSWORD = 'Task144!e2e-pw';

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

/** Collect Set-Cookie name=value pairs from a fetch Response into a Cookie header. */
function cookieFromRes(res: Response): string {
  const anyHeaders = res.headers as any;
  const list: string[] =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

async function cleanup(pool: Pool) {
  // onto ledger is keyed by EMAIL; cra_* keyed by user id; remove all of them.
  await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [EMAIL]).catch(() => {});
  const u = await pool
    .query<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [EMAIL])
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of u.rows) {
    await pool.query(`DELETE FROM cra_scores WHERE user_id = $1`, [row.id]).catch(() => {});
    await pool.query(`DELETE FROM cra_profiles WHERE user_id = $1`, [row.id]).catch(() => {});
  }
  await pool.query(`DELETE FROM users WHERE username = $1`, [EMAIL]).catch(() => {});
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await cleanup(pool); // start from a clean slate (idempotent re-runs)

    // 1) Authenticate as a real candidate over HTTP. username == email so the
    //    server resolves the onto-ledger subject (email) directly from the session.
    const reg = await fetch(`${BASE}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: EMAIL,
        password: PASSWORD,
        fullName: 'Task144 E2E Candidate',
        role: 'career_seeker',
        email: EMAIL,
      }),
    });
    const regBody = await reg.json().catch(() => ({}));
    assert(reg.ok, `registered & authenticated candidate over HTTP (HTTP ${reg.status})`);
    const cookie = cookieFromRes(reg);
    assert(cookie.length > 0, 'session cookie issued on registration');
    if (!reg.ok || !cookie) throw new Error('cannot continue without an authenticated session');

    // 2) Submit a real assessment over HTTP as that candidate. Mix of mapped +
    //    unmapped CRA codes — only the mapped ones may become precise scores.
    const scores = [
      { competencyCode: 'COG01', rawScore: 82, confidence: 0.9 }, // -> comp_critical_thinking  (level 5)
      { competencyCode: 'COG02', rawScore: 55, confidence: 0.8 }, // -> comp_problem_solving     (level 3)
      { competencyCode: 'EIQ05', rawScore: 30, confidence: 0.7 }, // -> comp_conflict_resolution (level 2)
      { competencyCode: 'COG03', rawScore: 90, confidence: 0.9 }, // UNMAPPED (Analytical Reasoning)
      { competencyCode: 'TEC02', rawScore: 70, confidence: 0.8 }, // UNMAPPED (Digital Fluency)
    ];
    const run = await fetch(`${BASE}/api/competency/run-assessment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ scores }),
    });
    const runBody = await run.json().catch(() => ({}));
    assert(run.ok, `POST run-assessment accepted over HTTP (HTTP ${run.status})`);
    assert(runBody?.data?.saved === scores.length, `all ${scores.length} scores saved (got ${runBody?.data?.saved})`);
    // The bridge writes the precise run inline (flag ON). 3 mapped, 2 unmapped omitted.
    assert(
      runBody?.data?.precise?.written === true && runBody?.data?.precise?.competencies === 3,
      `precise-run bridge wrote 3 mapped competencies (got written=${runBody?.data?.precise?.written}, n=${runBody?.data?.precise?.competencies})`,
    );

    // 3) Read precise-scores with the SAME session — proves the authenticated
    //    candidate sees competency-granularity scores keyed to their session.
    const ps = await fetch(`${BASE}/api/competency/precise-scores`, { headers: { cookie } });
    const psBody = await ps.json().catch(() => ({}));
    assert(ps.ok, `GET precise-scores returned over HTTP (HTTP ${ps.status})`);
    assert(psBody?.enabled === true, 'precise-scores enabled (competencyRuntime flag ON)');
    assert(psBody?.resolved === true, 'resolver resolved the authenticated session subject');
    assert(psBody?.hasPrecise === true, 'hasPrecise=true');

    const precise: any[] = Array.isArray(psBody?.precise) ? psBody.precise : [];
    assert(precise.length === 3, `precise-scores surfaces 3 competency-granularity scores (got ${precise.length})`);

    const ct = precise.find((s) => s.code === 'comp_critical_thinking');
    assert(
      !!ct && ct.score === 82 && ct.level === 5 && ct.levelLabel === 'Expert / Strategic Application' && ct.measurement === 'precise',
      `comp_critical_thinking = 82 / level 5 / Expert / precise (got ${ct?.score}/${ct?.level}/${ct?.levelLabel}/${ct?.measurement})`,
    );
    const ps2 = precise.find((s) => s.code === 'comp_problem_solving');
    assert(!!ps2 && ps2.score === 55 && ps2.level === 3, `comp_problem_solving = 55 / level 3 (got ${ps2?.score}/${ps2?.level})`);
    const cr = precise.find((s) => s.code === 'comp_conflict_resolution');
    assert(!!cr && cr.score === 30 && cr.level === 2, `comp_conflict_resolution = 30 / level 2 (got ${cr?.score}/${cr?.level})`);

    // Honesty: unmapped CRA codes never appear as precise scores.
    assert(
      !precise.some((s) => s.code === 'COG03' || s.code === 'TEC02' || s.code === 'comp_analytical_reasoning' || s.code === 'comp_digital_fluency'),
      'unmapped CRA codes never appear as precise scores (no fabrication)',
    );

    // 4) Identity guard: a DIFFERENT (unauthenticated) request must NOT see them.
    const anon = await fetch(`${BASE}/api/competency/precise-scores`);
    assert(anon.status === 401, `unauthenticated request is rejected (HTTP ${anon.status}, not the candidate's scores)`);
  } finally {
    await cleanup(pool);
    await pool.end();
  }

  console.log(failures === 0 ? '\nE2E: ALL PASS' : `\nE2E: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

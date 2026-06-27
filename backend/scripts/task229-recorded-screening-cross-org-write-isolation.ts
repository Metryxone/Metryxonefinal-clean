/**
 * Task #229 — Prove one employer can't TAMPER WITH another org's RECORDED
 * (non-live) voice screening (IDOR isolation on the WRITE side).
 *
 * Task #224 (read) and Task #226 (write) locked cross-org isolation on the LIVE
 * avatar channel only. The SAME voice-screening file also exposes the classic
 * RECORDED / legacy "browser" channel (channel != 'live_avatar') mutating
 * routes — upload an answer and finalize/score on `voice_screening_sessions`.
 * Both routes scope every read+write by `WHERE id = $1 AND employer_id = $2`
 * and return 404 (no effect, no leak) when the session isn't owned — but there
 * was no automated test proving an employer in org B can't inject an answer or
 * finalize another org's recorded session by guessing the session id. This test
 * closes that gap for the recorded channel:
 *
 *   • POST /api/employer/voice-screening/sessions/:id/answers   (inject answer)
 *   • POST /api/employer/voice-screening/sessions/:id/finalize  (score/finalize)
 *
 * Why this shape (mirrors task #226): the authZ scoping under test is independent
 * of the speech-to-text / scoring AI seam and the CSRF/employer-auth chain.
 * Rather than depend on real provider keys or two real HTTP login sessions, we
 * mount the REAL voice-screening route handlers (the exact code under test) on a
 * minimal Express app with the voice-screening flag forced ON and a stub auth
 * that resolves the employer principal from an `x-test-org` header — so a single
 * app can act as either org A or org B by flipping that header, exactly as two
 * distinct authenticated employers would look to the route's `employerId(req)`.
 *
 *   1. Seed a RECORDED ('browser') session for org A, status 'in_progress', plus
 *      one already-recorded answer carrying confidential transcript text — all
 *      employer_id = orgA. Capture A's baseline (status, answer count).
 *   2. RIGHTFUL OWNER (A) control — A, with A's principal, reaches the route:
 *      POST /answers with no audio file returns 400 (audio_required), NOT 404,
 *      proving the session exists and is owned by A (so B's 404 is a real authZ
 *      block, not "the route always 404s"). The finalize owner-control runs LAST
 *      (it mutates A's own session) and must be NON-404.
 *   3. THE ISOLATION ASSERTIONS — employer B (distinct org), passing A's exact
 *      session id, gets 404 with no effect on EVERY recorded mutating route, and
 *      the 404 bodies carry NEITHER the transcript text NOR the candidate name.
 *   4. ZERO-EFFECT PROOF — after B's denied attempts, A's session is unchanged:
 *      answer count identical (no injected answer), no answer row bearing B's
 *      employer_id or tamper text, status still 'in_progress' (not finalized).
 *
 * Self-cleaning: all seeded rows use employer_ids prefixed `task229-` and are
 * DELETEd before AND after the run, so re-runs are idempotent and the shared
 * dev/prod DB carries no residue.
 *
 * Run: cd backend && npx tsx scripts/task229-recorded-screening-cross-org-write-isolation.ts
 */
import express from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';

import { registerVoiceScreeningRoutes } from '../routes/voice-screening';

// Force the voice-screening flag ON for THIS process only (read at request time
// via isVoiceScreeningEnabled() → FF_VOICE_SCREENING). This is a test process;
// the real workflow's flag state is untouched.
process.env.FF_VOICE_SCREENING = '1';

const ORG_A = `task229-emp-a-${randomUUID()}`;
const ORG_B = `task229-emp-b-${randomUUID()}`;

const CANDIDATE_NAME = 'Task229 Confidential Candidate';
const SECRET_ANSWER_TEXT = 'My salary expectation is 51 lakhs and I have a competing offer — task229-secret.';
const B_TAMPER_ANSWER_TEXT = 'task229-org-B-injected-tamper-answer-should-never-persist';

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

async function cleanup(pool: Pool) {
  await pool.query(`DELETE FROM voice_screening_answers  WHERE employer_id LIKE 'task229-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_sessions WHERE employer_id LIKE 'task229-%'`).catch(() => {});
}

/** Insert a RECORDED ('browser', i.e. non-live) session for an org and return its id. */
async function seedRecordedSession(pool: Pool, org: string): Promise<string> {
  const id = `vss_${randomUUID()}`;
  await pool.query(
    `INSERT INTO voice_screening_sessions
       (id, employer_id, candidate_id, candidate_name, job_id, job_title, channel, status, questions, question_count, answered_count, created_at)
     VALUES ($1,$2,$3,$4,'','Software Engineer','browser','in_progress','[]'::jsonb,0,1, now())`,
    [id, org, `cand-${randomUUID()}`, CANDIDATE_NAME],
  );
  return id;
}

/** Write one already-recorded answer carrying the confidential transcript text. */
async function seedAnswer(pool: Pool, org: string, sessionId: string) {
  await pool.query(
    `INSERT INTO voice_screening_answers
       (id, session_id, employer_id, question_index, question_id, question_text, transcript, audio_format, audio_bytes, duration_ms)
     VALUES ($1,$2,$3,0,'q1','Tell me about your expectations.',$4,'webm',1024,1000)`,
    [`vsa_${randomUUID()}`, sessionId, org, SECRET_ANSWER_TEXT],
  );
}

/** Assert a cross-org 404 body leaks nothing confidential. */
function assertNoLeak(label: string, raw: string) {
  assert(!raw.includes(SECRET_ANSWER_TEXT), `${label}: body does NOT contain the answer transcript text`);
  assert(!raw.includes('task229-secret'), `${label}: body does NOT contain the secret answer marker`);
  assert(!raw.includes(CANDIDATE_NAME), `${label}: body does NOT contain the candidate name`);
}

/** Snapshot of A's session state used to prove ZERO effect from B's writes. */
async function snapshotSession(pool: Pool, sessionId: string) {
  const status = (await pool.query(`SELECT status FROM voice_screening_sessions WHERE id = $1`, [sessionId])).rows[0]?.status;
  const answerCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM voice_screening_answers WHERE session_id = $1`, [sessionId])).rows[0].n;
  return { status, answerCount };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Minimal app hosting the REAL voice-screening routes. The stub auth resolves
  // the employer principal from the `x-test-org` header so ONE app can act as
  // either org A or org B (exactly what `employerId(req)` sees for two distinct
  // authenticated employers). No CSRF middleware is mounted (not the surface
  // under test); the routes' own employer_id scoping is.
  const app = express();
  app.use(express.json());
  const stubAuth = (req: any, _res: any, next: any) => {
    const org = req.headers['x-test-org'] || ORG_A;
    req.orgId = org;
    req.user = { id: org };
    next();
  };
  registerVoiceScreeningRoutes(app, pool, stubAuth as any);
  const server = app.listen(0);
  await new Promise<void>((r) => server.on('listening', () => r()));
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const url = (id: string, suffix: string) => `${BASE}/api/employer/voice-screening/sessions/${id}${suffix}`;

  /** POST a multipart audio answer as a given org (a realistic tamper attempt). */
  const postAnswer = (id: string, org: string, transcriptText: string) => {
    const fd = new FormData();
    fd.append('audio', new Blob([Buffer.from('task229-fake-webm-audio')], { type: 'audio/webm' }), 'ans.webm');
    fd.append('questionIndex', '1');
    fd.append('questionId', 'q2');
    fd.append('questionText', transcriptText);
    return fetch(url(id, '/answers'), { method: 'POST', body: fd, headers: { 'x-test-org': org } });
  };

  try {
    await cleanup(pool);

    // Warm-up so the lazy ensureVoiceSchema() runs and the recorded tables exist
    // before we seed directly via SQL. (No audio → 404/400, we only need schema.)
    await fetch(url('warmup', '/finalize'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_A },
      body: '{}',
    }).catch(() => {});

    // Flag-ON sanity: the enabled probe must report enabled (the gate we depend on).
    const probe = await fetch(`${BASE}/api/employer/voice-screening/enabled`, { headers: { 'x-test-org': ORG_A } });
    const probeBody = await probe.json().catch(() => ({}));
    assert(probe.status === 200 && probeBody?.enabled === true, `voice-screening flag is ON for this run (enabled=${probeBody?.enabled})`);

    assert(ORG_A !== ORG_B, `A and B are distinct orgs (${ORG_A.slice(0, 16)}… != ${ORG_B.slice(0, 16)}…)`);

    // 1) Seed a RECORDED session + one confidential answer, all owned by org A.
    const sessA = await seedRecordedSession(pool, ORG_A);
    await seedAnswer(pool, ORG_A, sessA);

    // Baseline — this is the state B must NOT change.
    const before = await snapshotSession(pool, sessA);
    assert(before.status === 'in_progress', `A baseline: session status is 'in_progress' (got ${before.status})`);
    assert(before.answerCount === 1, `A baseline: session has its one recorded answer (got ${before.answerCount})`);

    // 2a) RIGHTFUL OWNER (A) control — A reaches the /answers route: with NO audio
    //     it returns 400 (audio_required), NOT 404, proving the session exists and
    //     is owned by A (so B's 404 is authZ, not an always-404). This does not
    //     mutate the session.
    const answersAOwner = await fetch(url(sessA, '/answers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_A },
      body: '{}',
    });
    assert(answersAOwner.status === 400, `A: POST own /answers with no audio → 400 (got ${answersAOwner.status}) — route found A's session (not 404)`);

    // 3) ISOLATION — employer B (distinct org), passing A's exact session id, gets
    //    404 with no leak on EVERY recorded mutating route.
    const answersB = await postAnswer(sessA, ORG_B, B_TAMPER_ANSWER_TEXT);
    const answersBRaw = await answersB.text();
    assert(answersB.status === 404, `B: POST /answers of A's session → 404 (got ${answersB.status}) — cannot inject a recorded answer`);
    assertNoLeak('B POST /answers', answersBRaw);

    const finalizeB = await fetch(url(sessA, '/finalize'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_B },
      body: '{}',
    });
    const finalizeBRaw = await finalizeB.text();
    assert(finalizeB.status === 404, `B: POST /finalize of A's session → 404 (got ${finalizeB.status}) — cannot finalize/score the session`);
    assertNoLeak('B POST /finalize', finalizeBRaw);

    // 4) ZERO-EFFECT PROOF — A's session is unchanged after B's writes.
    const after = await snapshotSession(pool, sessA);
    assert(after.answerCount === before.answerCount, `A unchanged: answer count identical (${before.answerCount} → ${after.answerCount}) — B injected NO answer`);

    const injectedByText = (
      await pool.query(`SELECT COUNT(*)::int AS n FROM voice_screening_answers WHERE session_id = $1 AND question_text = $2`, [sessA, B_TAMPER_ANSWER_TEXT])
    ).rows[0].n;
    assert(injectedByText === 0, `A unchanged: B's tamper answer text was NOT persisted (matches=${injectedByText})`);

    const injectedByOrg = (
      await pool.query(`SELECT COUNT(*)::int AS n FROM voice_screening_answers WHERE session_id = $1 AND employer_id = $2`, [sessA, ORG_B])
    ).rows[0].n;
    assert(injectedByOrg === 0, `A unchanged: NO answer row bears org B's employer_id (matches=${injectedByOrg})`);

    assert(after.status === 'in_progress', `A unchanged: status still 'in_progress' (got ${after.status}) — B did NOT finalize it`);

    // 2b) OWNER finalize control (runs LAST — it legitimately mutates A's own
    //     session): A's finalize is NON-404, proving B's 404 was authZ, not a
    //     route that always 404s. A real AI seam may make this 200 or 503; either
    //     is a valid owner-reaches-the-route result. (404 would be the failure.)
    const finalizeAOwner = await fetch(url(sessA, '/finalize'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_A },
      body: '{}',
    });
    assert(finalizeAOwner.status !== 404, `A: POST own /finalize → ${finalizeAOwner.status} (NON-404) — proves the route serves the owner, so B's 404 is authZ`);
  } finally {
    await cleanup(pool);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }

  console.log(
    failures === 0
      ? '\nTASK 229 RECORDED-SCREENING CROSS-ORG WRITE ISOLATION: ALL PASS'
      : `\nTASK 229 RECORDED-SCREENING CROSS-ORG WRITE ISOLATION: ${failures} FAILURE(S)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

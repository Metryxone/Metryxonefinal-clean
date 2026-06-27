/**
 * Task #224 — Prove one employer can't read another org's LIVE avatar interview
 * recordings or transcript (IDOR isolation on the live voice-screening reads).
 *
 * The live (HeyGen Interactive) avatar interview captures the candidate's full
 * webcam recording plus a turn-by-turn transcript — sensitive hiring data. The
 * three read routes in `voice-screening.ts` are all employer-scoped
 * (`WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`) and the
 * video is streamed `private, no-store`. Task #223 locked the billing-cap
 * backstop on this same surface; this test closes the adjacent privacy risk:
 * an employer in org B fetching org A's live session by a guessed session id.
 *
 * Why this shape (mirrors task #223): the authZ scoping under test is independent
 * of the live provider seam (HeyGen/OpenAI) and the CSRF/employer-auth chain.
 * Rather than depend on real provider keys or two real HTTP login sessions, we
 * mount the REAL voice-screening route handlers (the exact code under test) on a
 * minimal Express app with the live-avatar flag forced ON and a stub auth that
 * resolves the employer principal from an `x-test-org` header — so a single app
 * can act as either org A or org B by flipping that header, exactly as two
 * distinct authenticated employers would look to the route's `employerId(req)`.
 *
 *   1. Seed a live_avatar session for org A, write transcript turns, upload a
 *      webcam recording — all employer_id = orgA.
 *   2. RIGHTFUL OWNER (A) controls — A, with A's principal, gets 200 on all three
 *      reads (GET /:id, GET /:id/turns, GET /:id/video), proving the data exists
 *      and is reachable by the owning org (so B's 404 is a real authZ block, not
 *      "no data anywhere").
 *   3. THE ISOLATION ASSERTIONS — employer B (distinct org), passing A's exact
 *      session id, gets 404 with no leak on:
 *        • GET /api/employer/voice-screening/live/sessions/:id
 *        • GET /api/employer/voice-screening/live/sessions/:id/turns
 *        • GET /api/employer/voice-screening/live/sessions/:id/video
 *      and the 404 bodies must carry NEITHER the transcript text, the candidate
 *      name/id, NOR the recording bytes.
 *
 * Self-cleaning: all seeded rows use employer_ids prefixed `task224-` and are
 * DELETEd before AND after the run, so re-runs are idempotent and the shared
 * dev/prod DB carries no residue.
 *
 * Run: cd backend && npx tsx scripts/task224-live-avatar-cross-org-isolation.ts
 */
import express from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';

import { registerVoiceScreeningRoutes } from '../routes/voice-screening';

// Force the live-avatar flag ON for THIS process only (read at request time via
// envOverride('liveAvatarInterview') → FF_LIVE_AVATAR_INTERVIEW). This is a test
// process; the real workflow's flag state is untouched.
process.env.FF_LIVE_AVATAR_INTERVIEW = '1';

const ORG_A = `task224-emp-a-${randomUUID()}`;
const ORG_B = `task224-emp-b-${randomUUID()}`;

const CANDIDATE_NAME = 'Task224 Confidential Candidate';
const SECRET_TURN_TEXT = 'My salary expectation is 42 lakhs and I have a competing offer — task224-secret.';
const SECRET_VIDEO_BYTES = Buffer.from('task224-secret-webm-recording-bytes');

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

async function cleanup(pool: Pool) {
  await pool.query(`DELETE FROM voice_live_avatar_turns  WHERE employer_id LIKE 'task224-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_live_avatar_videos WHERE employer_id LIKE 'task224-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_answers  WHERE employer_id LIKE 'task224-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_sessions WHERE employer_id LIKE 'task224-%'`).catch(() => {});
}

/** Insert a live_avatar session for an org and return its id. */
async function seedLiveSession(pool: Pool, org: string): Promise<string> {
  const id = `vss_${randomUUID()}`;
  await pool.query(
    `INSERT INTO voice_screening_sessions
       (id, employer_id, candidate_id, candidate_name, job_id, job_title, channel, status, questions, question_count, answered_count, created_at)
     VALUES ($1,$2,$3,$4,'','Software Engineer','live_avatar','in_progress','[]'::jsonb,0,0, now())`,
    [id, org, `cand-${randomUUID()}`, CANDIDATE_NAME],
  );
  return id;
}

/** Write one candidate transcript turn carrying the confidential text. */
async function seedTurn(pool: Pool, org: string, sessionId: string) {
  await pool.query(
    `INSERT INTO voice_live_avatar_turns
       (id, session_id, employer_id, turn_index, role, question_id, is_follow_up, source, text, created_at)
     VALUES ($1,$2,$3,0,'candidate','q1',false,'asr',$4, now())`,
    [`vlt_${randomUUID()}`, sessionId, org, SECRET_TURN_TEXT],
  );
}

/** Store a webcam recording for the session. */
async function seedVideo(pool: Pool, org: string, sessionId: string) {
  await pool.query(
    `INSERT INTO voice_live_avatar_videos
       (id, session_id, employer_id, mime, bytes, duration_ms, data)
     VALUES ($1,$2,$3,'video/webm',$4,1000,$5)`,
    [`vlav_${randomUUID()}`, sessionId, org, SECRET_VIDEO_BYTES.length, SECRET_VIDEO_BYTES],
  );
}

/** Assert a cross-org 404 body leaks nothing confidential. */
function assertNoLeak(label: string, raw: string) {
  assert(!raw.includes(SECRET_TURN_TEXT), `${label}: body does NOT contain the transcript text`);
  assert(!raw.includes('task224-secret'), `${label}: body does NOT contain the secret recording bytes`);
  assert(!raw.includes(CANDIDATE_NAME), `${label}: body does NOT contain the candidate name`);
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

  const reads = (id: string) => [
    { suffix: '', label: 'GET /:id' },
    { suffix: '/turns', label: 'GET /:id/turns' },
    { suffix: '/video', label: 'GET /:id/video' },
  ];
  const url = (id: string, suffix: string) => `${BASE}/api/employer/voice-screening/live/sessions/${id}${suffix}`;

  try {
    await cleanup(pool);

    // Warm-up so the lazy ensure*Schema() runs and the live_avatar tables exist
    // before we seed directly via SQL.
    await fetch(url('warmup', '/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'candidate', text: 'warmup' }),
    }).catch(() => {});

    // Flag-ON sanity: the live probe must report enabled (the gate we depend on).
    const probe = await fetch(url('x', '').replace('/sessions/x', '/enabled'));
    const probeBody = await probe.json().catch(() => ({}));
    assert(probe.status === 200 && probeBody?.enabled === true, `live-avatar flag is ON for this run (enabled=${probeBody?.enabled})`);

    // 1) Seed a live session + transcript + recording, all owned by org A.
    const sessA = await seedLiveSession(pool, ORG_A);
    await seedTurn(pool, ORG_A, sessA);
    await seedVideo(pool, ORG_A, sessA);

    // 2) RIGHTFUL OWNER (A) — all three reads return 200 with the real data.
    const idA = await fetch(url(sessA, ''), { headers: { 'x-test-org': ORG_A } });
    const idABody = await idA.json().catch(() => ({}));
    assert(idA.status === 200, `A: GET own session → 200 (got ${idA.status})`);
    assert(idABody?.session?._id === sessA, `A: own session envelope carries the session id`);
    assert(idABody?.session?.candidateName === CANDIDATE_NAME, `A: own session exposes the candidate name to the owner`);

    const turnsA = await fetch(url(sessA, '/turns'), { headers: { 'x-test-org': ORG_A } });
    const turnsABody = await turnsA.json().catch(() => ({}));
    assert(turnsA.status === 200, `A: GET own turns → 200 (got ${turnsA.status})`);
    assert(
      Array.isArray(turnsABody?.turns) && turnsABody.turns.some((t: any) => t?.text === SECRET_TURN_TEXT),
      `A: own transcript returns the confidential turn text to the owner`,
    );

    const videoA = await fetch(url(sessA, '/video'), { headers: { 'x-test-org': ORG_A } });
    const videoABuf = Buffer.from(await videoA.arrayBuffer());
    assert(videoA.status === 200, `A: GET own video → 200 (got ${videoA.status})`);
    assert(videoABuf.equals(SECRET_VIDEO_BYTES), `A: own recording streams the stored bytes to the owner`);
    assert(
      (videoA.headers.get('cache-control') || '').includes('no-store'),
      `A: video is served Cache-Control private/no-store (got "${videoA.headers.get('cache-control')}")`,
    );

    // 3) ISOLATION — employer B (distinct org), passing A's exact session id,
    //    gets 404 with no leak on every read.
    assert(ORG_A !== ORG_B, `A and B are distinct orgs (${ORG_A.slice(0, 16)}… != ${ORG_B.slice(0, 16)}…)`);
    for (const { suffix, label } of reads(sessA)) {
      const res = await fetch(url(sessA, suffix), { headers: { 'x-test-org': ORG_B } });
      const raw = await res.text();
      assert(res.status === 404, `B: ${label} of A's session → 404 (got ${res.status})`);
      assertNoLeak(`B ${label}`, raw);
    }

    // Cross-check: B's 404 is a real authZ block, not "the row vanished" — A can
    // STILL read its own session id after B's denied attempts.
    const idAAfter = await fetch(url(sessA, ''), { headers: { 'x-test-org': ORG_A } });
    assert(idAAfter.status === 200, `A: still reads its own session after B's denied attempts (got ${idAAfter.status}) — proves 404 is authZ, not deletion`);
  } finally {
    await cleanup(pool);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }

  console.log(
    failures === 0
      ? '\nTASK 224 LIVE-AVATAR CROSS-ORG ISOLATION: ALL PASS'
      : `\nTASK 224 LIVE-AVATAR CROSS-ORG ISOLATION: ${failures} FAILURE(S)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Task #226 — Prove one employer can't TAMPER WITH another org's LIVE avatar
 * interview while it is being recorded (IDOR isolation on the WRITE side).
 *
 * Task #224 locked the READ side (org B can't view org A's live recording or
 * transcript). The adjacent risk is the WRITE side on the SAME live surface: an
 * employer in org B should not be able to inject transcript turns, overwrite the
 * webcam recording, drive the avatar's next utterance, or finalize/score another
 * org's live session by passing a guessed session id. All four mutating routes in
 * `voice-screening.ts` scope every read+write by
 * `WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'` and return 404
 * (no effect, no leak) when the session isn't owned — but there was no automated
 * test proving the cross-org block on the MUTATING paths. This test closes that.
 *
 * Why this shape (mirrors task #224): the authZ scoping under test is independent
 * of the live provider seam (HeyGen/OpenAI) and the CSRF/employer-auth chain.
 * Rather than depend on real provider keys or two real HTTP login sessions, we
 * mount the REAL voice-screening route handlers (the exact code under test) on a
 * minimal Express app with the live-avatar flag forced ON and a stub auth that
 * resolves the employer principal from an `x-test-org` header — so a single app
 * can act as either org A or org B by flipping that header, exactly as two
 * distinct authenticated employers would look to the route's `employerId(req)`.
 *
 *   1. Seed a FRESH live_avatar session for org A (un-expired so the billing-cap
 *      guard never masks the authZ result), plus one transcript turn + one webcam
 *      recording — all employer_id = orgA. Capture A's baseline (status, turn
 *      count, recording bytes).
 *   2. RIGHTFUL OWNER (A) controls — A, with A's principal, succeeds on the write
 *      routes (POST /turns 200, POST /video 200), proving the session exists and
 *      is mutable by the owning org (so B's 404 is a real authZ block, not "the
 *      route always 404s").
 *   3. THE ISOLATION ASSERTIONS — employer B (distinct org), passing A's exact
 *      session id, gets 404 with no effect on EVERY mutating route:
 *        • POST /api/employer/voice-screening/live/sessions/:id/turns
 *        • POST /api/employer/voice-screening/live/sessions/:id/video
 *        • POST /api/employer/voice-screening/live/sessions/:id/next
 *        • POST /api/employer/voice-screening/live/sessions/:id/finalize
 *      and the 404 bodies must carry NEITHER the transcript text, the candidate
 *      name, NOR the recording bytes.
 *   4. ZERO-EFFECT PROOF — after B's denied attempts, A's session is byte-for-byte
 *      unchanged: turn count identical (no injected turn), recording bytes
 *      identical (not overwritten), status still 'in_progress' (not finalized).
 *
 * Self-cleaning: all seeded rows use employer_ids prefixed `task226-` and are
 * DELETEd before AND after the run, so re-runs are idempotent and the shared
 * dev/prod DB carries no residue.
 *
 * Run: cd backend && npx tsx scripts/task226-live-avatar-cross-org-write-isolation.ts
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

const ORG_A = `task226-emp-a-${randomUUID()}`;
const ORG_B = `task226-emp-b-${randomUUID()}`;

const CANDIDATE_NAME = 'Task226 Confidential Candidate';
const SECRET_TURN_TEXT = 'My salary expectation is 51 lakhs and I have a competing offer — task226-secret.';
const SECRET_VIDEO_BYTES = Buffer.from('task226-secret-webm-recording-bytes');
const B_TAMPER_TURN_TEXT = 'task226-org-B-injected-tamper-turn-should-never-persist';
const B_TAMPER_VIDEO_BYTES = Buffer.from('task226-org-B-overwrite-bytes-should-never-persist');

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

async function cleanup(pool: Pool) {
  await pool.query(`DELETE FROM voice_live_avatar_turns  WHERE employer_id LIKE 'task226-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_live_avatar_videos WHERE employer_id LIKE 'task226-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_answers  WHERE employer_id LIKE 'task226-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_sessions WHERE employer_id LIKE 'task226-%'`).catch(() => {});
}

/** Insert a FRESH (un-expired) live_avatar session for an org and return its id. */
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
  assert(!raw.includes('task226-secret'), `${label}: body does NOT contain the secret recording bytes`);
  assert(!raw.includes(CANDIDATE_NAME), `${label}: body does NOT contain the candidate name`);
}

/** Snapshot of A's session state used to prove ZERO effect from B's writes. */
async function snapshotSession(pool: Pool, sessionId: string) {
  const status = (await pool.query(`SELECT status FROM voice_screening_sessions WHERE id = $1`, [sessionId])).rows[0]?.status;
  const turnCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM voice_live_avatar_turns WHERE session_id = $1`, [sessionId])).rows[0].n;
  const video = (await pool.query(`SELECT data FROM voice_live_avatar_videos WHERE session_id = $1`, [sessionId])).rows[0];
  return { status, turnCount, videoBytes: video?.data ? Buffer.from(video.data) : null };
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
  const url = (id: string, suffix: string) => `${BASE}/api/employer/voice-screening/live/sessions/${id}${suffix}`;

  /** POST a multipart webcam recording as a given org. */
  const postVideo = (id: string, org: string, bytes: Buffer) => {
    const fd = new FormData();
    fd.append('video', new Blob([bytes], { type: 'video/webm' }), 'rec.webm');
    fd.append('durationMs', '1000');
    return fetch(url(id, '/video'), { method: 'POST', body: fd, headers: { 'x-test-org': org } });
  };

  try {
    await cleanup(pool);

    // Warm-up so the lazy ensure*Schema() runs and the live_avatar tables exist
    // before we seed directly via SQL.
    await fetch(url('warmup', '/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_A },
      body: JSON.stringify({ role: 'candidate', text: 'warmup' }),
    }).catch(() => {});

    // Flag-ON sanity: the live probe must report enabled (the gate we depend on).
    const probe = await fetch(`${BASE}/api/employer/voice-screening/live/enabled`);
    const probeBody = await probe.json().catch(() => ({}));
    assert(probe.status === 200 && probeBody?.enabled === true, `live-avatar flag is ON for this run (enabled=${probeBody?.enabled})`);

    assert(ORG_A !== ORG_B, `A and B are distinct orgs (${ORG_A.slice(0, 16)}… != ${ORG_B.slice(0, 16)}…)`);

    // 1) Seed a FRESH live session + transcript + recording, all owned by org A.
    const sessA = await seedLiveSession(pool, ORG_A);
    await seedTurn(pool, ORG_A, sessA);
    await seedVideo(pool, ORG_A, sessA);

    // 2) RIGHTFUL OWNER (A) — the write routes succeed for the owning org, proving
    //    the session is real + mutable (so B's 404 is authZ, not an always-404).
    const turnsAOwner = await fetch(url(sessA, '/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_A },
      body: JSON.stringify({ role: 'candidate', text: 'A genuine owner turn.' }),
    });
    assert(turnsAOwner.status === 200, `A: POST own /turns → 200 (got ${turnsAOwner.status}) — session is real + mutable by owner`);

    const videoAOwner = await postVideo(sessA, ORG_A, SECRET_VIDEO_BYTES);
    assert(videoAOwner.status === 200, `A: POST own /video → 200 (got ${videoAOwner.status}) — recording is writable by owner`);

    // Baseline AFTER the owner's legitimate writes — this is the state B must NOT change.
    const before = await snapshotSession(pool, sessA);
    assert(before.status === 'in_progress', `A baseline: session status is 'in_progress' (got ${before.status})`);
    assert(before.turnCount >= 2, `A baseline: session has its turns (got ${before.turnCount})`);
    assert(before.videoBytes != null && before.videoBytes.equals(SECRET_VIDEO_BYTES), `A baseline: recording holds A's bytes`);

    // 3) ISOLATION — employer B (distinct org), passing A's exact session id, gets
    //    404 with no leak on EVERY mutating route.
    const turnsB = await fetch(url(sessA, '/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_B },
      body: JSON.stringify({ role: 'candidate', text: B_TAMPER_TURN_TEXT }),
    });
    const turnsBRaw = await turnsB.text();
    assert(turnsB.status === 404, `B: POST /turns of A's session → 404 (got ${turnsB.status}) — cannot inject a transcript turn`);
    assertNoLeak('B POST /turns', turnsBRaw);

    const videoB = await postVideo(sessA, ORG_B, B_TAMPER_VIDEO_BYTES);
    const videoBRaw = await videoB.text();
    assert(videoB.status === 404, `B: POST /video of A's session → 404 (got ${videoB.status}) — cannot overwrite the recording`);
    assertNoLeak('B POST /video', videoBRaw);

    const nextB = await fetch(url(sessA, '/next'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_B },
      body: '{}',
    });
    const nextBRaw = await nextB.text();
    assert(nextB.status === 404, `B: POST /next of A's session → 404 (got ${nextB.status}) — cannot drive the avatar's next turn`);
    assertNoLeak('B POST /next', nextBRaw);

    const finalizeB = await fetch(url(sessA, '/finalize'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_B },
      body: '{}',
    });
    const finalizeBRaw = await finalizeB.text();
    assert(finalizeB.status === 404, `B: POST /finalize of A's session → 404 (got ${finalizeB.status}) — cannot finalize/score the session`);
    assertNoLeak('B POST /finalize', finalizeBRaw);

    // 4) ZERO-EFFECT PROOF — A's session is byte-for-byte unchanged after B's writes.
    const after = await snapshotSession(pool, sessA);
    assert(after.turnCount === before.turnCount, `A unchanged: turn count identical (${before.turnCount} → ${after.turnCount}) — B injected NO turn`);

    const injected = (
      await pool.query(`SELECT COUNT(*)::int AS n FROM voice_live_avatar_turns WHERE session_id = $1 AND text = $2`, [sessA, B_TAMPER_TURN_TEXT])
    ).rows[0].n;
    assert(injected === 0, `A unchanged: B's tamper turn text was NOT persisted (matches=${injected})`);

    assert(after.videoBytes != null && after.videoBytes.equals(SECRET_VIDEO_BYTES), `A unchanged: recording still holds A's bytes (B did NOT overwrite)`);

    const overwritten = (
      await pool.query(`SELECT COUNT(*)::int AS n FROM voice_live_avatar_videos WHERE session_id = $1 AND data = $2`, [sessA, B_TAMPER_VIDEO_BYTES])
    ).rows[0].n;
    assert(overwritten === 0, `A unchanged: B's overwrite bytes were NOT persisted (matches=${overwritten})`);

    assert(after.status === 'in_progress', `A unchanged: status still 'in_progress' (got ${after.status}) — B did NOT finalize it`);

    // Cross-check: B's 404 is a real authZ block, not "the row vanished" — A can
    // STILL mutate its own session after B's denied attempts.
    const turnsAAfter = await fetch(url(sessA, '/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-org': ORG_A },
      body: JSON.stringify({ role: 'candidate', text: 'A still owns this session.' }),
    });
    assert(turnsAAfter.status === 200, `A: still writes to its own session after B's denied attempts (got ${turnsAAfter.status}) — proves 404 is authZ, not deletion`);
  } finally {
    await cleanup(pool);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }

  console.log(
    failures === 0
      ? '\nTASK 226 LIVE-AVATAR CROSS-ORG WRITE ISOLATION: ALL PASS'
      : `\nTASK 226 LIVE-AVATAR CROSS-ORG WRITE ISOLATION: ${failures} FAILURE(S)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

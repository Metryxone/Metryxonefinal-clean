/**
 * Task #223 — Prove a tampered client can't run live avatar minutes past the billing cap.
 *
 * Live (HeyGen Interactive) avatar minutes are BILLABLE. The browser countdown is
 * convenience only; the enforced backstop is server-side in `voice-screening.ts`:
 * `liveSessionExpired(created_at)` compares elapsed time against
 * `LIVE_AVATAR_MAX_DURATION_MS` and the billable turn routes (POST /next, POST
 * /turns) reject with 409 `{expired:true}` once the cap is exceeded — while
 * /video and /finalize stay OPEN so the partial recording + score still save.
 * A regression here directly costs money, so this test locks the backstop in.
 *
 * Why this shape: the duration/follow-up guards are independent of the live
 * provider seam (HeyGen/OpenAI). Rather than depend on real provider keys, a live
 * workflow flag, or the CSRF/employer-auth chain, we mount the REAL
 * voice-screening route handlers (the exact code under test) on a minimal Express
 * app with the live-avatar flag forced ON and a stub employer auth, then seed a
 * live_avatar session row whose `created_at` is BACKDATED past the cap — exactly
 * what a tampered client trying to run extra minutes would look like to the
 * server (the client cannot move the server's clock or the stored created_at).
 *
 *   PART A — server-authoritative duration cap (real routes, real DB):
 *     • An EXPIRED live session → POST /next and POST /turns return 409
 *       {expired:true}, while POST /video and POST /finalize still succeed (200).
 *     • A FRESH (un-expired) live session → the SAME billable routes proceed
 *       (NOT 409), proving the 409 is specifically the expiry backstop and not an
 *       always-on rejection (i.e. the guard is real, not a tautology).
 *
 *   PART B — "≤1 follow-up per authored question" guard (real engine):
 *     • Drives the REAL `orchestrateNextTurn` against a tiny in-process mock
 *       OpenAI server that always tries to emit a follow-up. With no prior
 *       follow-up the follow-up is allowed (source:'llm', isFollowUp:true); when
 *       a follow-up was ALREADY used for the active question, a SECOND consecutive
 *       follow-up is converted to the next authored question
 *       (source:'authored_fallback', isFollowUp:false, questionId = next q).
 *
 * Self-cleaning: all seeded rows use an employer_id prefixed `task223-` and are
 * DELETEd before AND after the run, so re-runs are idempotent and the shared
 * dev/prod DB carries no residue.
 *
 * Run: cd backend && npx tsx scripts/task223-live-avatar-billing-cap.ts
 */
import express from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import http from 'http';
import type { AddressInfo } from 'net';

import { registerVoiceScreeningRoutes } from '../routes/voice-screening';
import { LIVE_AVATAR_MAX_DURATION_MS } from '../services/voice-screening-avatar';
import { orchestrateNextTurn } from '../services/voice-screening-engine';

// Force the live-avatar flag ON for THIS process only (read at request time via
// envOverride('liveAvatarInterview') → FF_LIVE_AVATAR_INTERVIEW). This is a test
// process; the real workflow's flag state is untouched.
process.env.FF_LIVE_AVATAR_INTERVIEW = '1';

const ORG = `task223-emp-${randomUUID()}`;

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

const AUTHORED_QUESTIONS = [
  { id: 'q1', question: 'Tell me about a time you solved a hard problem.', expectedResponse: 'Structured STAR answer.', scoringCriteria: 'Clarity, ownership, outcome.' },
  { id: 'q2', question: 'How do you prioritise competing deadlines?', expectedResponse: 'Explicit prioritisation method.', scoringCriteria: 'Method, tradeoffs.' },
  { id: 'q3', question: 'Describe how you handle feedback.', expectedResponse: 'Receptive, action-oriented.', scoringCriteria: 'Openness, follow-through.' },
];

async function cleanup(pool: Pool) {
  await pool.query(`DELETE FROM voice_live_avatar_turns  WHERE employer_id LIKE 'task223-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_live_avatar_videos WHERE employer_id LIKE 'task223-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_answers  WHERE employer_id LIKE 'task223-%'`).catch(() => {});
  await pool.query(`DELETE FROM voice_screening_sessions WHERE employer_id LIKE 'task223-%'`).catch(() => {});
}

/** Insert a live_avatar session for ORG with an explicit created_at (backdating = elapsed time). */
async function seedLiveSession(pool: Pool, ageMs: number): Promise<string> {
  const id = `vss_${randomUUID()}`;
  await pool.query(
    `INSERT INTO voice_screening_sessions
       (id, employer_id, candidate_id, candidate_name, job_id, job_title, channel, status, questions, question_count, answered_count, created_at)
     VALUES ($1,$2,$3,$4,'','Software Engineer','live_avatar','in_progress',$5::jsonb,$6,0, now() - ($7::text || ' milliseconds')::interval)`,
    [id, ORG, `cand-${randomUUID()}`, 'Task223 Candidate', JSON.stringify(AUTHORED_QUESTIONS), AUTHORED_QUESTIONS.length, String(ageMs)],
  );
  return id;
}

// ── A tiny mock OpenAI Chat Completions server (used only by PART B) ──────────
function startMockOpenAI(): Promise<{ baseURL: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Drain the request body, then always answer with a follow-up attempt.
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const content = JSON.stringify({
          utterance: 'Interesting — can you say a bit more about how you measured success there?',
          questionId: null,
          isFollowUp: true,
          done: false,
        });
        const payload = {
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'mock',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        baseURL: `http://127.0.0.1:${port}/v1`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Minimal app hosting the REAL voice-screening routes. Stub auth injects an
  // employer principal (employerId(req) reads req.orgId) so the routes run; no
  // CSRF middleware is mounted (not the surface under test).
  const app = express();
  app.use(express.json());
  const stubAuth = (req: any, _res: any, next: any) => {
    req.orgId = ORG;
    req.user = { id: ORG };
    next();
  };
  registerVoiceScreeningRoutes(app, pool, stubAuth as any);
  const server = app.listen(0);
  await new Promise<void>((r) => server.on('listening', () => r()));
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await cleanup(pool);

    // Warm-up: hit a live route on a non-existent session so the lazy
    // ensure*Schema() runs and the live_avatar tables exist before we seed.
    await fetch(`${BASE}/api/employer/voice-screening/live/sessions/warmup/turns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'candidate', text: 'warmup' }),
    }).catch(() => {});

    // Flag-ON sanity: the live probe must report enabled (the gate we depend on).
    const probe = await fetch(`${BASE}/api/employer/voice-screening/live/enabled`);
    const probeBody = await probe.json().catch(() => ({}));
    assert(probe.status === 200 && probeBody?.enabled === true, `live-avatar flag is ON for this run (enabled=${probeBody?.enabled})`);
    assert(Number(probeBody?.maxDurationMs) === LIVE_AVATAR_MAX_DURATION_MS, `probe reports the billing cap maxDurationMs=${probeBody?.maxDurationMs}`);

    // ── PART A1 — EXPIRED session: billable turn routes must 409, save routes 200 ──
    const expiredId = await seedLiveSession(pool, LIVE_AVATAR_MAX_DURATION_MS + 60_000); // 1 min past the cap
    const url = (suffix: string) => `${BASE}/api/employer/voice-screening/live/sessions/${expiredId}${suffix}`;

    const nextExpired = await fetch(url('/next'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const nextExpiredBody = await nextExpired.json().catch(() => ({}));
    assert(nextExpired.status === 409, `EXPIRED /next → 409 (got ${nextExpired.status})`);
    assert(nextExpiredBody?.expired === true, `EXPIRED /next body carries {expired:true} (got ${JSON.stringify(nextExpiredBody?.expired)})`);

    const turnExpired = await fetch(url('/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'candidate', text: 'I would keep talking to burn minutes.' }),
    });
    const turnExpiredBody = await turnExpired.json().catch(() => ({}));
    assert(turnExpired.status === 409, `EXPIRED POST /turns → 409 (got ${turnExpired.status})`);
    assert(turnExpiredBody?.expired === true, `EXPIRED POST /turns body carries {expired:true} (got ${JSON.stringify(turnExpiredBody?.expired)})`);

    // No billable turn should have been written for the expired session.
    const turnCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM voice_live_avatar_turns WHERE session_id = $1`, [expiredId])).rows[0].n;
    assert(turnCount === 0, `EXPIRED session persisted ZERO turns past the cap (got ${turnCount})`);

    // /video must still succeed so the partial recording is saved.
    const fd = new FormData();
    fd.append('video', new Blob([Buffer.from('fake-webm-bytes-for-test')], { type: 'video/webm' }), 'rec.webm');
    fd.append('durationMs', '1000');
    const videoExpired = await fetch(url('/video'), { method: 'POST', body: fd });
    const videoExpiredBody = await videoExpired.json().catch(() => ({}));
    assert(videoExpired.status === 200 && videoExpiredBody?.success === true, `EXPIRED /video still saves the recording (HTTP ${videoExpired.status})`);

    // /finalize must still succeed so the (partial) session is scored/closed.
    const finalizeExpired = await fetch(url('/finalize'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const finalizeExpiredBody = await finalizeExpired.json().catch(() => ({}));
    assert(finalizeExpired.status === 200 && finalizeExpiredBody?.success === true, `EXPIRED /finalize still completes the session (HTTP ${finalizeExpired.status})`);
    assert(finalizeExpiredBody?.session?.status === 'completed', `EXPIRED /finalize marks the session completed (got ${finalizeExpiredBody?.session?.status})`);

    // ── PART A2 — FRESH session control: the SAME billable routes must NOT 409 ──
    const freshId = await seedLiveSession(pool, 0); // created just now
    const fresh = (suffix: string) => `${BASE}/api/employer/voice-screening/live/sessions/${freshId}${suffix}`;

    const turnFresh = await fetch(fresh('/turns'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'candidate', text: 'A genuine on-time answer.' }),
    });
    assert(turnFresh.status === 200, `FRESH POST /turns proceeds (NOT 409) → 200 (got ${turnFresh.status})`);

    const nextFresh = await fetch(fresh('/next'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const nextFreshBody = await nextFresh.json().catch(() => ({}));
    assert(nextFresh.status === 200, `FRESH /next proceeds (NOT 409) → 200 (got ${nextFresh.status})`);
    assert(nextFresh.status !== 409 && nextFreshBody?.expired !== true, `FRESH /next is NOT flagged expired (proves 409 is the cap, not always-on)`);

    // ── PART B — "≤1 follow-up per authored question" guard (real engine) ──
    const mock = await startMockOpenAI();
    const prevKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const prevBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const prevModel = process.env.AI_INTEGRATIONS_OPENAI_MODEL;
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = 'mock-key';
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = mock.baseURL;
    process.env.AI_INTEGRATIONS_OPENAI_MODEL = 'mock';
    try {
      const engineQs = AUTHORED_QUESTIONS.map((q) => ({ id: q.id, question: q.question }));
      const transcript = [
        { role: 'avatar' as const, text: AUTHORED_QUESTIONS[0].question, questionId: 'q1' },
        { role: 'candidate' as const, text: 'A brief, thin answer.', questionId: 'q1' },
      ];

      // First follow-up for the active question is allowed (LLM path).
      const firstFollowUp = await orchestrateNextTurn({
        jobTitle: 'Software Engineer',
        questions: engineQs,
        askedQuestionIds: ['q1'],
        transcript,
        followUpUsedForActiveQuestion: false,
      });
      assert(firstFollowUp.isFollowUp === true && firstFollowUp.source === 'llm', `1st follow-up allowed (isFollowUp=${firstFollowUp.isFollowUp}, source=${firstFollowUp.source})`);

      // A SECOND consecutive follow-up is converted to the next authored question.
      const secondFollowUp = await orchestrateNextTurn({
        jobTitle: 'Software Engineer',
        questions: engineQs,
        askedQuestionIds: ['q1'],
        transcript,
        followUpUsedForActiveQuestion: true,
      });
      assert(secondFollowUp.isFollowUp === false, `2nd consecutive follow-up is NOT delivered as a follow-up (isFollowUp=${secondFollowUp.isFollowUp})`);
      assert(secondFollowUp.source === 'authored_fallback', `2nd consecutive follow-up falls back to authored content (source=${secondFollowUp.source})`);
      assert(secondFollowUp.questionId === 'q2', `2nd consecutive follow-up advances to the NEXT authored question q2 (got ${secondFollowUp.questionId})`);
      assert(secondFollowUp.utterance === AUTHORED_QUESTIONS[1].question, `the converted turn speaks the authored q2 wording verbatim`);
    } finally {
      if (prevKey === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY; else process.env.AI_INTEGRATIONS_OPENAI_API_KEY = prevKey;
      if (prevBase === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL; else process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = prevBase;
      if (prevModel === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_MODEL; else process.env.AI_INTEGRATIONS_OPENAI_MODEL = prevModel;
      await mock.close();
    }
  } finally {
    await cleanup(pool);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }

  console.log(
    failures === 0
      ? '\nTASK 223 LIVE-AVATAR BILLING-CAP BACKSTOP: ALL PASS'
      : `\nTASK 223 LIVE-AVATAR BILLING-CAP BACKSTOP: ${failures} FAILURE(S)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

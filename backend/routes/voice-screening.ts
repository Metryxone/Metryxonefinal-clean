/**
 * Voice Screening routes — real end-to-end AI voice screening (employer portal).
 * ----------------------------------------------------------------------------
 * Flow (browser channel):
 *   1. GET  /api/employer/voice-screening/enabled                  flag + AI-readiness probe
 *   2. GET  /api/employer/voice-screening/questions?candidateId=   authored question set
 *   3. POST /api/employer/voice-screening/sessions                 start a session
 *   4. POST /api/employer/voice-screening/sessions/:id/answers     upload one recorded answer (multipart) → STT
 *   5. POST /api/employer/voice-screening/sessions/:id/finalize    score + persist report
 *   6. GET  /api/employer/voice-screening/sessions/:id             fetch a persisted session
 *   7. GET  /api/employer/voice-screening/candidates/:cid/latest   latest session for a candidate
 *
 * These routes mount UNDER `/api/employer`, so the employer-account gate (auth +
 * account_type=employer/superadmin + org context) already applies. Each handler
 * is additionally flag-gated FIRST: flag OFF → 503 before any DB/AI touch, and no
 * schema is created (byte-identical legacy when OFF).
 *
 * Privacy: raw audio is transcribed in-memory and DISCARDED — only the transcript
 * (PII, employer-scoped) + lightweight metadata are persisted. All reads/writes are
 * strictly scoped by employer_id (orgId ?? user.id) to prevent cross-employer IDOR.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import multer from 'multer';
import { randomUUID } from 'crypto';
import {
  isVoiceScreeningEnabled,
  isAvatarInterviewEnabled,
  isLiveAvatarInterviewEnabled,
} from '../config/feature-flags';
import { selectScreeningQuestions } from '../services/interview-question-store';
import {
  VOICE_DIMENSIONS,
  transcribeAudio,
  scoreScreening,
  orchestrateNextTurn,
  isAIConfigured,
  VoiceAIUnavailable,
  AI_PROVENANCE,
  type AnswerInput,
  type ConversationTurn,
} from '../services/voice-screening-engine';
import {
  twilioStatus,
  initiateOutboundCall,
  TwilioUnavailable,
} from '../services/voice-screening-twilio';
import {
  avatarStatus,
  isAvatarConfigured,
  requestAvatarVideo,
  fetchAvatarVideoStatus,
  AvatarUnavailable,
  isLiveAvatarConfigured,
  liveAvatarStatus,
  createLiveAvatarToken,
  LIVE_AVATAR_MAX_DURATION_MS,
} from '../services/voice-screening-avatar';
import { createHash } from 'crypto';

type Middleware = (req: Request, res: Response, next: any) => void;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per recorded answer
});

// Candidate webcam video answers run larger than audio-only clips.
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB per recorded video answer
});

let schemaReady = false;
async function ensureVoiceSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_screening_sessions (
      id               TEXT PRIMARY KEY,
      employer_id      TEXT NOT NULL,
      candidate_id     TEXT NOT NULL,
      candidate_name   TEXT DEFAULT '',
      job_id           TEXT DEFAULT '',
      job_title        TEXT DEFAULT '',
      channel          TEXT DEFAULT 'browser',
      status           TEXT DEFAULT 'in_progress',
      questions        JSONB DEFAULT '[]'::jsonb,
      question_count   INTEGER DEFAULT 0,
      answered_count   INTEGER DEFAULT 0,
      overall_score    INTEGER,
      recommendation   TEXT,
      summary          TEXT DEFAULT '',
      dimension_scores JSONB,
      abstained        BOOLEAN DEFAULT false,
      ai_provenance    TEXT DEFAULT '',
      created_at       TIMESTAMPTZ DEFAULT now(),
      updated_at       TIMESTAMPTZ DEFAULT now(),
      completed_at     TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_vss_employer  ON voice_screening_sessions(employer_id);
    CREATE INDEX IF NOT EXISTS idx_vss_candidate ON voice_screening_sessions(employer_id, candidate_id);

    CREATE TABLE IF NOT EXISTS voice_screening_answers (
      id             TEXT PRIMARY KEY,
      session_id     TEXT NOT NULL,
      employer_id    TEXT NOT NULL,
      question_index INTEGER DEFAULT 0,
      question_id    TEXT DEFAULT '',
      question_text  TEXT DEFAULT '',
      transcript     TEXT,
      audio_format   TEXT DEFAULT '',
      audio_bytes    INTEGER DEFAULT 0,
      duration_ms    INTEGER DEFAULT 0,
      created_at     TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_vsa_session ON voice_screening_answers(session_id);
  `);
  schemaReady = true;
}

function flagGate(_req: Request, res: Response, next: any) {
  if (!isVoiceScreeningEnabled()) {
    return res.status(503).json({ enabled: false, message: 'voice_screening_disabled' });
  }
  next();
}

// ── Avatar layer (Option A) — own flag, own schema, byte-identical when OFF ────
// Avatar routes 503 BEFORE any DB/AI/schema touch when the flag is off, so no
// avatar tables are ever created and the existing voice-screening surface is
// unchanged regardless of this flag.
function avatarFlagGate(_req: Request, res: Response, next: any) {
  if (!isAvatarInterviewEnabled()) {
    return res.status(503).json({ enabled: false, message: 'avatar_interview_disabled' });
  }
  next();
}

let avatarSchemaReady = false;
async function ensureAvatarSchema(pool: Pool): Promise<void> {
  if (avatarSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_avatar_question_videos (
      id                TEXT PRIMARY KEY,
      employer_id       TEXT NOT NULL,
      session_id        TEXT DEFAULT '',
      question_id       TEXT NOT NULL,
      script_hash       TEXT NOT NULL,
      provider          TEXT DEFAULT 'heygen',
      provider_video_id TEXT DEFAULT '',
      status            TEXT DEFAULT 'pending',
      video_url         TEXT DEFAULT '',
      error             TEXT DEFAULT '',
      created_at        TIMESTAMPTZ DEFAULT now(),
      updated_at        TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vaqv_key
      ON voice_avatar_question_videos(employer_id, question_id, script_hash);

    CREATE TABLE IF NOT EXISTS voice_avatar_answer_videos (
      id             TEXT PRIMARY KEY,
      answer_id      TEXT DEFAULT '',
      session_id     TEXT NOT NULL,
      employer_id    TEXT NOT NULL,
      question_index INTEGER DEFAULT 0,
      question_id    TEXT DEFAULT '',
      mime           TEXT DEFAULT 'video/webm',
      bytes          INTEGER DEFAULT 0,
      data           BYTEA,
      created_at     TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_vaav_session ON voice_avatar_answer_videos(session_id);
  `);
  avatarSchemaReady = true;
}

// ── Live avatar layer (Option B) — own flag, own schema, byte-identical when OFF ─
// Every live route 503s BEFORE any auth/DB/AI/schema touch when the flag is off,
// so no live tables are ever created and Option A + the base voice-screening
// surface stay byte-identical regardless of this flag.
function liveAvatarFlagGate(_req: Request, res: Response, next: any) {
  if (!isLiveAvatarInterviewEnabled()) {
    return res.status(503).json({ enabled: false, message: 'live_avatar_interview_disabled' });
  }
  next();
}

// Server-authoritative session age (realtime avatar minutes are billable). The
// frontend countdown is convenience only — this is the enforced backstop so a
// tampered client cannot keep a live session running past the cap.
function liveSessionExpired(createdAt: any): boolean {
  const started = new Date(createdAt).getTime();
  if (!Number.isFinite(started)) return false; // never block on an unparseable timestamp
  return Date.now() - started > LIVE_AVATAR_MAX_DURATION_MS;
}

let liveAvatarSchemaReady = false;
async function ensureLiveAvatarSchema(pool: Pool): Promise<void> {
  if (liveAvatarSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_live_avatar_turns (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL,
      employer_id  TEXT NOT NULL,
      turn_index   INTEGER DEFAULT 0,
      role         TEXT NOT NULL,
      question_id  TEXT DEFAULT '',
      is_follow_up BOOLEAN DEFAULT false,
      source       TEXT DEFAULT '',
      text         TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_vlat_session ON voice_live_avatar_turns(session_id);

    CREATE TABLE IF NOT EXISTS voice_live_avatar_videos (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL,
      employer_id  TEXT NOT NULL,
      mime         TEXT DEFAULT 'video/webm',
      bytes        INTEGER DEFAULT 0,
      duration_ms  INTEGER DEFAULT 0,
      data         BYTEA,
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_vlav_session ON voice_live_avatar_videos(session_id);
  `);
  liveAvatarSchemaReady = true;
}

const scriptHash = (text: string): string =>
  createHash('sha256').update(String(text || '')).digest('hex').slice(0, 32);

function employerId(req: Request): string {
  return (req as any).orgId ?? (req.user as any)?.id ?? 'anonymous';
}

function sessionToJson(row: any, answers: any[] = []) {
  return {
    _id: row.id,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name ?? '',
    jobId: row.job_id ?? '',
    jobTitle: row.job_title ?? '',
    channel: row.channel ?? 'browser',
    status: row.status ?? 'in_progress',
    questions: row.questions ?? [],
    questionCount: row.question_count ?? 0,
    answeredCount: row.answered_count ?? 0,
    overallScore: row.overall_score ?? null,
    recommendation: row.recommendation ?? null,
    summary: row.summary ?? '',
    dimensions: row.dimension_scores ?? null,
    abstained: !!row.abstained,
    provenance: row.ai_provenance ?? '',
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    answers: answers.map((a) => ({
      questionIndex: a.question_index,
      questionId: a.question_id,
      questionText: a.question_text,
      transcript: a.transcript ?? null,
      audioFormat: a.audio_format ?? '',
      audioBytes: a.audio_bytes ?? 0,
    })),
  };
}

export function registerVoiceScreeningRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Middleware,
): void {
  // ── Flag + AI-readiness probe (employer-gated; never creates schema) ─────────
  app.get('/api/employer/voice-screening/enabled', requireAuth, (_req: Request, res: Response) => {
    const enabled = isVoiceScreeningEnabled();
    res.json({
      enabled,
      aiReady: enabled && isAIConfigured(),
      provenance: AI_PROVENANCE,
      dimensions: VOICE_DIMENSIONS,
    });
  });

  // ── Authored question set (preview) ─────────────────────────────────────────
  app.get(
    '/api/employer/voice-screening/questions',
    flagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const eid = employerId(req);
        let jobTitle = String(req.query.role ?? '').trim();
        const candidateId = String(req.query.candidateId ?? '').trim();
        if (!jobTitle && candidateId) {
          await ensureVoiceSchema(pool);
          const c = await pool.query(
            `SELECT job_title, candidate_role FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
            [candidateId, eid],
          );
          jobTitle = c.rows[0]?.job_title || c.rows[0]?.candidate_role || '';
        }
        const questions = await selectScreeningQuestions(pool, { role: jobTitle });
        res.json({ success: true, questions });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err?.message || 'failed_to_build_questions' });
      }
    },
  );

  // ── Start a session ─────────────────────────────────────────────────────────
  app.post(
    '/api/employer/voice-screening/sessions',
    flagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const candidateId = String((req.body as any)?.candidateId ?? '').trim();
        if (!candidateId) return res.status(400).json({ message: 'candidateId_required' });

        const c = await pool.query(
          `SELECT id, name, job_id, job_title, candidate_role FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
          [candidateId, eid],
        );
        if (c.rowCount === 0) return res.status(404).json({ message: 'candidate_not_found' });
        const cand = c.rows[0];
        const jobTitle = cand.job_title || cand.candidate_role || '';
        const questions = await selectScreeningQuestions(pool, { role: jobTitle });
        const id = `vss_${randomUUID()}`;

        await pool.query(
          `INSERT INTO voice_screening_sessions
             (id, employer_id, candidate_id, candidate_name, job_id, job_title, channel, status, questions, question_count, answered_count)
           VALUES ($1,$2,$3,$4,$5,$6,'browser','in_progress',$7::jsonb,$8,0)`,
          [id, eid, candidateId, cand.name ?? '', cand.job_id ?? '', jobTitle, JSON.stringify(questions), questions.length],
        );

        const row = (await pool.query(`SELECT * FROM voice_screening_sessions WHERE id = $1`, [id])).rows[0];
        res.json({ success: true, session: sessionToJson(row) });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'failed_to_start_session' });
      }
    },
  );

  // ── Upload one recorded answer → transcribe ─────────────────────────────────
  app.post(
    '/api/employer/voice-screening/sessions/:id/answers',
    flagGate,
    requireAuth,
    upload.single('audio'),
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT id FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });

        const file = (req as any).file;
        if (!file || !file.buffer || file.buffer.length === 0) {
          return res.status(400).json({ message: 'audio_required' });
        }
        const questionIndex = Number((req.body as any)?.questionIndex ?? 0) || 0;
        const questionId = String((req.body as any)?.questionId ?? '');
        const questionText = String((req.body as any)?.questionText ?? '');
        const durationMs = Number((req.body as any)?.durationMs ?? 0) || 0;

        // Real transcription — throws VoiceAIUnavailable (503) when AI unconfigured.
        const { transcript, format, bytes } = await transcribeAudio(file.buffer);

        const answerId = `vsa_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_screening_answers
             (id, session_id, employer_id, question_index, question_id, question_text, transcript, audio_format, audio_bytes, duration_ms)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [answerId, sessionId, eid, questionIndex, questionId, questionText, transcript, format, bytes, durationMs],
        );

        const cnt = await pool.query(
          `SELECT COUNT(*)::int AS n FROM voice_screening_answers
             WHERE session_id = $1 AND transcript IS NOT NULL AND trim(transcript) <> ''`,
          [sessionId],
        );
        await pool.query(
          `UPDATE voice_screening_sessions SET answered_count = $1, updated_at = now() WHERE id = $2`,
          [cnt.rows[0].n, sessionId],
        );

        res.json({ success: true, transcript, format, answeredCount: cnt.rows[0].n });
      } catch (err: any) {
        const status = err instanceof VoiceAIUnavailable ? 503 : 500;
        res.status(status).json({ message: err?.message || 'transcription_failed', aiUnavailable: status === 503 });
      }
    },
  );

  // ── Finalize → score + persist ──────────────────────────────────────────────
  app.post(
    '/api/employer/voice-screening/sessions/:id/finalize',
    flagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        const row = sess.rows[0];

        const ans = await pool.query(
          `SELECT question_index, question_id, question_text, transcript FROM voice_screening_answers
             WHERE session_id = $1 ORDER BY question_index ASC`,
          [sessionId],
        );
        // Enrich each answer with the authored grading rubric carried on the
        // session's stored question set (matched by question id), so the scorer
        // grades against expectedResponse + scoringCriteria.
        const storedQuestions: any[] = Array.isArray(row.questions) ? row.questions : [];
        const rubricById = new Map<string, any>();
        for (const q of storedQuestions) {
          if (q && q.id) rubricById.set(String(q.id), q);
        }
        const answers: AnswerInput[] = ans.rows.map((a) => {
          const rubric = rubricById.get(String(a.question_id ?? ''));
          return {
            question: a.question_text ?? '',
            transcript: a.transcript ?? null,
            expectedResponse: rubric?.expectedResponse ?? null,
            scoringCriteria: rubric?.scoringCriteria ?? null,
          };
        });

        const report = await scoreScreening({ jobTitle: row.job_title ?? '', answers });

        await pool.query(
          `UPDATE voice_screening_sessions
             SET status = 'completed', overall_score = $1, recommendation = $2, summary = $3,
                 dimension_scores = $4::jsonb, abstained = $5, ai_provenance = $6,
                 answered_count = $7, updated_at = now(), completed_at = now()
           WHERE id = $8`,
          [
            report.overallScore,
            report.recommendation,
            report.summary,
            JSON.stringify(report.dimensions),
            report.abstained,
            report.provenance,
            report.answeredCount,
            sessionId,
          ],
        );

        const updated = (await pool.query(`SELECT * FROM voice_screening_sessions WHERE id = $1`, [sessionId])).rows[0];
        res.json({ success: true, session: sessionToJson(updated, ans.rows) });
      } catch (err: any) {
        const status = err instanceof VoiceAIUnavailable ? 503 : 500;
        res.status(status).json({ message: err?.message || 'finalize_failed', aiUnavailable: status === 503 });
      }
    },
  );

  // ── Fetch one session ───────────────────────────────────────────────────────
  app.get(
    '/api/employer/voice-screening/sessions/:id',
    flagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const row = (
          await pool.query(`SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`, [
            req.params.id,
            eid,
          ])
        ).rows[0];
        if (!row) return res.status(404).json({ message: 'session_not_found' });
        const ans = (
          await pool.query(
            `SELECT * FROM voice_screening_answers WHERE session_id = $1 ORDER BY question_index ASC`,
            [req.params.id],
          )
        ).rows;
        res.json({ success: true, session: sessionToJson(row, ans) });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'fetch_failed' });
      }
    },
  );

  // ── Latest completed/most-recent session for a candidate ────────────────────
  app.get(
    '/api/employer/voice-screening/candidates/:candidateId/latest',
    flagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const row = (
          await pool.query(
            `SELECT * FROM voice_screening_sessions
               WHERE candidate_id = $1 AND employer_id = $2
               ORDER BY created_at DESC LIMIT 1`,
            [req.params.candidateId, eid],
          )
        ).rows[0];
        if (!row) return res.json({ success: true, session: null });
        const ans = (
          await pool.query(
            `SELECT * FROM voice_screening_answers WHERE session_id = $1 ORDER BY question_index ASC`,
            [row.id],
          )
        ).rows;
        res.json({ success: true, session: sessionToJson(row, ans) });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'fetch_failed' });
      }
    },
  );

  // ── Phone-leg (Twilio) v2 scaffold — honestly disabled until configured ─────
  // Reports the REAL connection state; never pretends the phone channel works.
  app.get(
    '/api/employer/voice-screening/phone/enabled',
    flagGate,
    requireAuth,
    (_req: Request, res: Response) => {
      res.json({ enabled: isVoiceScreeningEnabled(), ...twilioStatus() });
    },
  );

  // Initiating a phone screen always 503s until the phone leg is built/configured.
  app.post(
    '/api/employer/voice-screening/phone/call',
    flagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const sessionId = String((req.body as any)?.sessionId ?? '').trim();
        const toNumber = String((req.body as any)?.toNumber ?? '').trim();
        await initiateOutboundCall({ sessionId, toNumber });
        res.json({ success: true }); // unreachable until implemented
      } catch (err: any) {
        const status = err instanceof TwilioUnavailable ? 503 : 500;
        res.status(status).json({
          message: err?.message || 'phone_call_failed',
          phoneUnavailable: status === 503,
        });
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // AVATAR LAYER (Option A) — avatar presents each question; candidate records a
  // webcam video answer. Own flag, own schema, own endpoints. The audio track of
  // each video answer is transcribed + scored by the EXISTING pipeline (unchanged):
  // avatar answers write a row into voice_screening_answers and reuse /finalize.
  // ════════════════════════════════════════════════════════════════════════════

  // ── Avatar flag + provider-readiness probe (employer-gated; no schema) ───────
  app.get(
    '/api/employer/voice-screening/avatar/enabled',
    avatarFlagGate,
    requireAuth,
    (_req: Request, res: Response) => {
      const status = avatarStatus();
      // `configured` is an explicit alias of the honest `connected` flag so the
      // frontend CTA gate (avatar.enabled && avatar.configured) has a stable field.
      res.json({ enabled: isAvatarInterviewEnabled(), configured: status.connected, ...status });
    },
  );

  // ── Start an avatar-channel session (mirrors the browser session, channel='avatar') ──
  app.post(
    '/api/employer/voice-screening/avatar/sessions',
    avatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const candidateId = String((req.body as any)?.candidateId ?? '').trim();
        if (!candidateId) return res.status(400).json({ message: 'candidateId_required' });

        const c = await pool.query(
          `SELECT id, name, job_id, job_title, candidate_role FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
          [candidateId, eid],
        );
        if (c.rowCount === 0) return res.status(404).json({ message: 'candidate_not_found' });
        const cand = c.rows[0];
        const jobTitle = cand.job_title || cand.candidate_role || '';
        const questions = await selectScreeningQuestions(pool, { role: jobTitle });
        const id = `vss_${randomUUID()}`;

        await pool.query(
          `INSERT INTO voice_screening_sessions
             (id, employer_id, candidate_id, candidate_name, job_id, job_title, channel, status, questions, question_count, answered_count)
           VALUES ($1,$2,$3,$4,$5,$6,'avatar','in_progress',$7::jsonb,$8,0)`,
          [id, eid, candidateId, cand.name ?? '', cand.job_id ?? '', jobTitle, JSON.stringify(questions), questions.length],
        );

        const row = (await pool.query(`SELECT * FROM voice_screening_sessions WHERE id = $1`, [id])).rows[0];
        res.json({ success: true, session: sessionToJson(row) });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'failed_to_start_session' });
      }
    },
  );

  // ── Request avatar videos for the session's questions (idempotent, cached) ───
  //    Each question's script is rendered once per (employer, question, script);
  //    re-requesting reuses the cached HeyGen render. Returns honest per-question
  //    status. 503 (avatarUnavailable) when HeyGen is not configured.
  app.post(
    '/api/employer/voice-screening/avatar/sessions/:id/videos',
    avatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAvatarConfigured()) {
          return res.status(503).json({ message: avatarStatus().message, avatarUnavailable: true });
        }
        await ensureVoiceSchema(pool);
        await ensureAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        const storedQuestions: any[] = Array.isArray(sess.rows[0].questions) ? sess.rows[0].questions : [];

        const out: Array<{ questionId: string; questionIndex: number; status: string; url: string | null; error: string | null }> = [];
        for (let i = 0; i < storedQuestions.length; i++) {
          const q = storedQuestions[i];
          const questionId = String(q?.id ?? `q-${i}`);
          const script = String(q?.question ?? '');
          const hash = scriptHash(script);

          const existing = await pool.query(
            `SELECT * FROM voice_avatar_question_videos WHERE employer_id = $1 AND question_id = $2 AND script_hash = $3`,
            [eid, questionId, hash],
          );
          let rowv = existing.rows[0];

          if (!rowv) {
            // Kick off a fresh render.
            const vid = `vaqv_${randomUUID()}`;
            try {
              const { providerVideoId } = await requestAvatarVideo(script);
              await pool.query(
                `INSERT INTO voice_avatar_question_videos
                   (id, employer_id, session_id, question_id, script_hash, provider, provider_video_id, status)
                 VALUES ($1,$2,$3,$4,$5,'heygen',$6,'processing')
                 ON CONFLICT (employer_id, question_id, script_hash) DO UPDATE
                   SET provider_video_id = EXCLUDED.provider_video_id, status = 'processing',
                       error = '', updated_at = now()`,
                [vid, eid, sessionId, questionId, hash, providerVideoId],
              );
            } catch (e: any) {
              if (e instanceof AvatarUnavailable) throw e;
              await pool.query(
                `INSERT INTO voice_avatar_question_videos
                   (id, employer_id, session_id, question_id, script_hash, provider, status, error)
                 VALUES ($1,$2,$3,$4,$5,'heygen','failed',$6)
                 ON CONFLICT (employer_id, question_id, script_hash) DO UPDATE
                   SET status = 'failed', error = EXCLUDED.error, updated_at = now()`,
                [vid, eid, sessionId, questionId, hash, String(e?.message || 'render_request_failed')],
              );
            }
            rowv = (await pool.query(
              `SELECT * FROM voice_avatar_question_videos WHERE employer_id = $1 AND question_id = $2 AND script_hash = $3`,
              [eid, questionId, hash],
            )).rows[0];
          }

          // Poll HeyGen for any not-yet-completed render.
          if (rowv && rowv.status !== 'completed' && rowv.status !== 'failed' && rowv.provider_video_id) {
            try {
              const st = await fetchAvatarVideoStatus(rowv.provider_video_id);
              await pool.query(
                `UPDATE voice_avatar_question_videos
                   SET status = $1, video_url = $2, error = $3, updated_at = now()
                 WHERE id = $4`,
                [st.status, st.url ?? '', st.error ?? '', rowv.id],
              );
              rowv.status = st.status;
              rowv.video_url = st.url ?? '';
              rowv.error = st.error ?? '';
            } catch (e: any) {
              if (e instanceof AvatarUnavailable) throw e;
            }
          }

          out.push({
            questionId,
            questionIndex: i,
            status: rowv?.status ?? 'pending',
            url: rowv?.status === 'completed' ? (rowv?.video_url || null) : null,
            error: rowv?.error || null,
          });
        }

        res.json({ success: true, videos: out });
      } catch (err: any) {
        const status = err instanceof AvatarUnavailable ? 503 : 500;
        res.status(status).json({
          message: err?.message || 'avatar_video_failed',
          avatarUnavailable: status === 503,
        });
      }
    },
  );

  // ── Poll avatar video status for a session's questions (no new renders) ──────
  app.get(
    '/api/employer/voice-screening/avatar/sessions/:id/videos',
    avatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        const storedQuestions: any[] = Array.isArray(sess.rows[0].questions) ? sess.rows[0].questions : [];

        const out: Array<{ questionId: string; questionIndex: number; status: string; url: string | null; error: string | null }> = [];
        for (let i = 0; i < storedQuestions.length; i++) {
          const q = storedQuestions[i];
          const questionId = String(q?.id ?? `q-${i}`);
          const hash = scriptHash(String(q?.question ?? ''));
          let rowv = (await pool.query(
            `SELECT * FROM voice_avatar_question_videos WHERE employer_id = $1 AND question_id = $2 AND script_hash = $3`,
            [eid, questionId, hash],
          )).rows[0];

          // Refresh in-flight renders if HeyGen is configured.
          if (rowv && isAvatarConfigured() && rowv.status !== 'completed' && rowv.status !== 'failed' && rowv.provider_video_id) {
            try {
              const st = await fetchAvatarVideoStatus(rowv.provider_video_id);
              await pool.query(
                `UPDATE voice_avatar_question_videos SET status = $1, video_url = $2, error = $3, updated_at = now() WHERE id = $4`,
                [st.status, st.url ?? '', st.error ?? '', rowv.id],
              );
              rowv = { ...rowv, status: st.status, video_url: st.url ?? '', error: st.error ?? '' };
            } catch { /* transient poll error — keep last known state */ }
          }

          out.push({
            questionId,
            questionIndex: i,
            status: rowv?.status ?? 'pending',
            url: rowv?.status === 'completed' ? (rowv?.video_url || null) : null,
            error: rowv?.error || null,
          });
        }
        res.json({ success: true, videos: out });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'avatar_video_status_failed' });
      }
    },
  );

  // ── Upload one candidate WEBCAM VIDEO answer ────────────────────────────────
  //    Stores the video (employer-scoped) for review AND transcribes its audio
  //    track via the EXISTING engine, writing a row into voice_screening_answers
  //    so the unchanged /finalize scorer grades it. Never fabricates a transcript.
  app.post(
    '/api/employer/voice-screening/avatar/sessions/:id/answers',
    avatarFlagGate,
    requireAuth,
    videoUpload.single('video'),
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT id FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });

        const file = (req as any).file;
        if (!file || !file.buffer || file.buffer.length === 0) {
          return res.status(400).json({ message: 'video_required' });
        }
        const questionIndex = Number((req.body as any)?.questionIndex ?? 0) || 0;
        const questionId = String((req.body as any)?.questionId ?? '');
        const questionText = String((req.body as any)?.questionText ?? '');
        const durationMs = Number((req.body as any)?.durationMs ?? 0) || 0;
        const mime = String(file.mimetype || 'video/webm');

        // Transcribe the audio track from the video container (Whisper accepts
        // webm/mp4). Throws VoiceAIUnavailable (503) when AI is unconfigured.
        const { transcript, format, bytes } = await transcribeAudio(file.buffer);

        const answerId = `vsa_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_screening_answers
             (id, session_id, employer_id, question_index, question_id, question_text, transcript, audio_format, audio_bytes, duration_ms)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [answerId, sessionId, eid, questionIndex, questionId, questionText, transcript, format, bytes, durationMs],
        );

        // Persist the candidate video (employer-scoped) for reviewer playback.
        const videoId = `vaav_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_avatar_answer_videos
             (id, answer_id, session_id, employer_id, question_index, question_id, mime, bytes, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [videoId, answerId, sessionId, eid, questionIndex, questionId, mime, file.buffer.length, file.buffer],
        );

        const cnt = await pool.query(
          `SELECT COUNT(*)::int AS n FROM voice_screening_answers
             WHERE session_id = $1 AND transcript IS NOT NULL AND trim(transcript) <> ''`,
          [sessionId],
        );
        await pool.query(
          `UPDATE voice_screening_sessions SET answered_count = $1, updated_at = now() WHERE id = $2`,
          [cnt.rows[0].n, sessionId],
        );

        res.json({ success: true, transcript, format, answerId, answeredCount: cnt.rows[0].n });
      } catch (err: any) {
        const status = err instanceof VoiceAIUnavailable ? 503 : 500;
        res.status(status).json({ message: err?.message || 'transcription_failed', aiUnavailable: status === 503 });
      }
    },
  );

  // ── List a session's answers + which have a stored candidate video ──────────
  app.get(
    '/api/employer/voice-screening/avatar/sessions/:id/answers',
    avatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT id FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });

        const rows = (await pool.query(
          `SELECT a.id, a.question_index, a.question_id, a.question_text, a.transcript,
                  v.id AS video_id, v.mime AS video_mime, v.bytes AS video_bytes
             FROM voice_screening_answers a
             LEFT JOIN voice_avatar_answer_videos v ON v.answer_id = a.id
            WHERE a.session_id = $1
            ORDER BY a.question_index ASC`,
          [sessionId],
        )).rows;

        res.json({
          success: true,
          answers: rows.map((r) => ({
            answerId: r.id,
            questionIndex: r.question_index,
            questionId: r.question_id,
            questionText: r.question_text,
            transcript: r.transcript ?? null,
            hasVideo: !!r.video_id,
            videoMime: r.video_mime ?? null,
            videoBytes: r.video_bytes ?? 0,
          })),
        });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'answers_fetch_failed' });
      }
    },
  );

  // ── Stream one stored candidate video answer (employer-scoped) ──────────────
  app.get(
    '/api/employer/voice-screening/avatar/answers/:answerId/video',
    avatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureAvatarSchema(pool);
        const eid = employerId(req);
        const row = (await pool.query(
          `SELECT mime, bytes, data FROM voice_avatar_answer_videos WHERE answer_id = $1 AND employer_id = $2`,
          [req.params.answerId, eid],
        )).rows[0];
        if (!row || !row.data) return res.status(404).json({ message: 'video_not_found' });
        res.setHeader('Content-Type', row.mime || 'video/webm');
        res.setHeader('Content-Length', String(row.bytes || (row.data as Buffer).length));
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(row.data);
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'video_fetch_failed' });
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LIVE AVATAR LAYER (Option B) — real-time two-way conversational interview.
  // A HeyGen Interactive/Streaming Avatar (WebRTC, driven by the browser SDK with
  // a server-minted token) speaks AND listens live; an OpenAI LLM conducts the
  // dialogue (authored questions + brief in-scope follow-ups under safety
  // guardrails). The candidate webcam video + full turn-by-turn transcript are
  // captured, then scored by the EXISTING 5-dimension rubric (same honesty
  // contract — abstain when no usable signal). Own flag, own schema, own routes;
  // OFF → 503 before any auth/DB/AI/schema touch (byte-identical legacy).
  // ════════════════════════════════════════════════════════════════════════════

  // ── Live flag + provider/AI readiness probe (employer-gated; no schema) ──────
  app.get(
    '/api/employer/voice-screening/live/enabled',
    liveAvatarFlagGate,
    requireAuth,
    (_req: Request, res: Response) => {
      const status = liveAvatarStatus();
      const aiReady = isAIConfigured();
      res.json({
        enabled: isLiveAvatarInterviewEnabled(),
        // The live flow needs BOTH the avatar provider AND the LLM orchestrator.
        configured: status.connected,
        aiReady,
        ready: status.connected && aiReady,
        maxDurationMs: LIVE_AVATAR_MAX_DURATION_MS,
        dimensions: VOICE_DIMENSIONS,
        provenance: AI_PROVENANCE,
        ...status,
      });
    },
  );

  // ── Start a live session: create the row + mint a HeyGen streaming token ─────
  //    Needs HeyGen (token) AND OpenAI (orchestration). Honest 503 when either is
  //    unconfigured — never fabricates a session or token.
  app.post(
    '/api/employer/voice-screening/live/sessions',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isLiveAvatarConfigured()) {
          return res.status(503).json({ message: liveAvatarStatus().message, avatarUnavailable: true });
        }
        if (!isAIConfigured()) {
          return res.status(503).json({
            message:
              'AI not configured — set OPENAI_API_KEY (or connect the OpenAI integration) to run a live interview.',
            aiUnavailable: true,
          });
        }
        await ensureVoiceSchema(pool);
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const candidateId = String((req.body as any)?.candidateId ?? '').trim();
        if (!candidateId) return res.status(400).json({ message: 'candidateId_required' });

        const c = await pool.query(
          `SELECT id, name, job_id, job_title, candidate_role FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
          [candidateId, eid],
        );
        if (c.rowCount === 0) return res.status(404).json({ message: 'candidate_not_found' });
        const cand = c.rows[0];
        const jobTitle = cand.job_title || cand.candidate_role || '';
        const questions = await selectScreeningQuestions(pool, { role: jobTitle });

        // Mint the streaming token FIRST so we never persist a session we can't run.
        const tok = await createLiveAvatarToken();

        const id = `vss_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_screening_sessions
             (id, employer_id, candidate_id, candidate_name, job_id, job_title, channel, status, questions, question_count, answered_count)
           VALUES ($1,$2,$3,$4,$5,$6,'live_avatar','in_progress',$7::jsonb,$8,0)`,
          [id, eid, candidateId, cand.name ?? '', cand.job_id ?? '', jobTitle, JSON.stringify(questions), questions.length],
        );

        const row = (await pool.query(`SELECT * FROM voice_screening_sessions WHERE id = $1`, [id])).rows[0];
        res.json({
          success: true,
          session: sessionToJson(row),
          live: {
            token: tok.token,
            avatarId: tok.avatarId,
            voiceId: tok.voiceId,
            maxDurationMs: tok.maxDurationMs,
          },
        });
      } catch (err: any) {
        const status = err instanceof AvatarUnavailable ? 503 : 500;
        res.status(status).json({
          message: err?.message || 'failed_to_start_live_session',
          avatarUnavailable: status === 503,
        });
      }
    },
  );

  // ── Append one conversation turn (avatar or candidate) to the transcript ─────
  //    The candidate's turns carry the REAL captured speech (never fabricated).
  app.post(
    '/api/employer/voice-screening/live/sessions/:id/turns',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT id, questions, created_at FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        if (liveSessionExpired(sess.rows[0].created_at)) {
          return res.status(409).json({ message: 'live_session_expired', expired: true, maxDurationMs: LIVE_AVATAR_MAX_DURATION_MS });
        }

        const role = String((req.body as any)?.role ?? '').trim();
        if (role !== 'avatar' && role !== 'candidate') {
          return res.status(400).json({ message: 'role_must_be_avatar_or_candidate' });
        }
        const text = String((req.body as any)?.text ?? '').trim();
        if (!text) return res.status(400).json({ message: 'text_required' });

        // Validate questionId (if provided) against the session's stored set.
        const stored: any[] = Array.isArray(sess.rows[0].questions) ? sess.rows[0].questions : [];
        let questionId = String((req.body as any)?.questionId ?? '').trim();
        if (questionId && !stored.some((q) => String(q?.id ?? '') === questionId)) {
          questionId = '';
        }
        const isFollowUp = (req.body as any)?.isFollowUp === true;

        const nextIdx = (
          await pool.query(
            `SELECT COALESCE(MAX(turn_index), -1) + 1 AS n FROM voice_live_avatar_turns WHERE session_id = $1`,
            [sessionId],
          )
        ).rows[0].n;

        const turnId = `vlat_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_live_avatar_turns
             (id, session_id, employer_id, turn_index, role, question_id, is_follow_up, source, text)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [turnId, sessionId, eid, nextIdx, role, questionId, isFollowUp, 'client', text],
        );

        res.json({ success: true, turnId, turnIndex: nextIdx });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'turn_append_failed' });
      }
    },
  );

  // ── Decide + persist the avatar's NEXT utterance (LLM orchestrator) ──────────
  //    Reads the stored questions, which authored ids have been asked, and the
  //    running transcript; produces the next avatar turn and persists it.
  app.post(
    '/api/employer/voice-screening/live/sessions/:id/next',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        const row = sess.rows[0];
        if (liveSessionExpired(row.created_at)) {
          return res.status(409).json({ message: 'live_session_expired', expired: true, maxDurationMs: LIVE_AVATAR_MAX_DURATION_MS });
        }
        const stored: any[] = Array.isArray(row.questions) ? row.questions : [];

        const turns = (
          await pool.query(
            `SELECT role, text, question_id, is_follow_up FROM voice_live_avatar_turns
               WHERE session_id = $1 ORDER BY turn_index ASC`,
            [sessionId],
          )
        ).rows;

        const transcript: ConversationTurn[] = turns.map((t) => ({
          role: t.role === 'candidate' ? 'candidate' : 'avatar',
          text: t.text ?? '',
          questionId: t.question_id || null,
        }));
        // Authored ids already DELIVERED (avatar turns that named an authored id).
        const askedQuestionIds = Array.from(
          new Set(
            turns
              .filter((t) => t.role === 'avatar' && !t.is_follow_up && t.question_id)
              .map((t) => String(t.question_id)),
          ),
        );

        // Has a follow-up ALREADY been asked for the most-recent authored question?
        // (Resets each time a new authored question is delivered.) Server-side
        // backstop for the "≤1 follow-up per authored question" rule.
        let followUpUsedForActiveQuestion = false;
        for (const t of turns) {
          if (t.role !== 'avatar') continue;
          if (!t.is_follow_up && t.question_id) followUpUsedForActiveQuestion = false;
          else if (t.is_follow_up) followUpUsedForActiveQuestion = true;
        }

        const result = await orchestrateNextTurn({
          jobTitle: row.job_title ?? '',
          questions: stored.map((q) => ({ id: String(q?.id ?? ''), question: String(q?.question ?? '') })),
          askedQuestionIds,
          transcript,
          followUpUsedForActiveQuestion,
        });

        // Persist the avatar's utterance as the next transcript turn.
        const nextIdx = (
          await pool.query(
            `SELECT COALESCE(MAX(turn_index), -1) + 1 AS n FROM voice_live_avatar_turns WHERE session_id = $1`,
            [sessionId],
          )
        ).rows[0].n;
        const turnId = `vlat_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_live_avatar_turns
             (id, session_id, employer_id, turn_index, role, question_id, is_follow_up, source, text)
           VALUES ($1,$2,$3,$4,'avatar',$5,$6,$7,$8)`,
          [turnId, sessionId, eid, nextIdx, result.questionId ?? '', result.isFollowUp, result.source, result.utterance],
        );

        res.json({
          success: true,
          utterance: result.utterance,
          questionId: result.questionId,
          isFollowUp: result.isFollowUp,
          done: result.done,
          source: result.source,
          turnIndex: nextIdx,
        });
      } catch (err: any) {
        const status = err instanceof VoiceAIUnavailable ? 503 : 500;
        res.status(status).json({ message: err?.message || 'orchestration_failed', aiUnavailable: status === 503 });
      }
    },
  );

  // ── Fetch the full conversation transcript for review/replay ─────────────────
  app.get(
    '/api/employer/voice-screening/live/sessions/:id/turns',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT id FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        const rows = (
          await pool.query(
            `SELECT turn_index, role, question_id, is_follow_up, source, text, created_at
               FROM voice_live_avatar_turns WHERE session_id = $1 ORDER BY turn_index ASC`,
            [sessionId],
          )
        ).rows;
        res.json({
          success: true,
          turns: rows.map((r) => ({
            turnIndex: r.turn_index,
            role: r.role,
            questionId: r.question_id || null,
            isFollowUp: !!r.is_follow_up,
            source: r.source || '',
            text: r.text ?? '',
            createdAt: r.created_at,
          })),
        });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'turns_fetch_failed' });
      }
    },
  );

  // ── Upload the candidate's full webcam recording (one per live session) ──────
  app.post(
    '/api/employer/voice-screening/live/sessions/:id/video',
    liveAvatarFlagGate,
    requireAuth,
    videoUpload.single('video'),
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT id FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });

        const file = (req as any).file;
        if (!file || !file.buffer || file.buffer.length === 0) {
          return res.status(400).json({ message: 'video_required' });
        }
        const mime = String(file.mimetype || 'video/webm');
        const durationMs = Number((req.body as any)?.durationMs ?? 0) || 0;

        // One stored recording per live session (replace on re-upload).
        await pool.query(`DELETE FROM voice_live_avatar_videos WHERE session_id = $1 AND employer_id = $2`, [
          sessionId,
          eid,
        ]);
        const videoId = `vlav_${randomUUID()}`;
        await pool.query(
          `INSERT INTO voice_live_avatar_videos
             (id, session_id, employer_id, mime, bytes, duration_ms, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [videoId, sessionId, eid, mime, file.buffer.length, durationMs, file.buffer],
        );
        res.json({ success: true, videoId, bytes: file.buffer.length });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'video_upload_failed' });
      }
    },
  );

  // ── Stream the stored candidate recording (employer-scoped) ─────────────────
  app.get(
    '/api/employer/voice-screening/live/sessions/:id/video',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const row = (
          await pool.query(
            `SELECT mime, bytes, data FROM voice_live_avatar_videos WHERE session_id = $1 AND employer_id = $2`,
            [req.params.id, eid],
          )
        ).rows[0];
        if (!row || !row.data) return res.status(404).json({ message: 'video_not_found' });
        res.setHeader('Content-Type', row.mime || 'video/webm');
        res.setHeader('Content-Length', String(row.bytes || (row.data as Buffer).length));
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(row.data);
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'video_fetch_failed' });
      }
    },
  );

  // ── Finalize: score the conversation transcript across the SAME 5 dimensions ─
  //    Candidate turns are grouped by the authored questionId they answered,
  //    paired with the authored rubric, and scored by the EXISTING scorer (which
  //    abstains honestly when no usable signal exists).
  app.post(
    '/api/employer/voice-screening/live/sessions/:id/finalize',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        await ensureLiveAvatarSchema(pool);
        const eid = employerId(req);
        const sessionId = req.params.id;
        const sess = await pool.query(
          `SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`,
          [sessionId, eid],
        );
        if (sess.rowCount === 0) return res.status(404).json({ message: 'session_not_found' });
        const row = sess.rows[0];
        const stored: any[] = Array.isArray(row.questions) ? row.questions : [];

        const turns = (
          await pool.query(
            `SELECT role, question_id, text FROM voice_live_avatar_turns
               WHERE session_id = $1 ORDER BY turn_index ASC`,
            [sessionId],
          )
        ).rows;

        // Collect candidate speech per authored question. A candidate turn with no
        // explicit questionId is attributed to the most-recent authored question
        // the avatar delivered (tracked while iterating in order).
        const candidateByQuestion = new Map<string, string[]>();
        let activeQuestionId = '';
        for (const t of turns) {
          if (t.role === 'avatar') {
            if (t.question_id) activeQuestionId = String(t.question_id);
          } else if (t.role === 'candidate') {
            const key = (t.question_id && String(t.question_id)) || activeQuestionId;
            if (!key) continue; // candidate speech before any authored question — skip
            const txt = String(t.text ?? '').trim();
            if (!txt) continue;
            const arr = candidateByQuestion.get(key) || [];
            arr.push(txt);
            candidateByQuestion.set(key, arr);
          }
        }

        const answers: AnswerInput[] = stored.map((q) => {
          const qid = String(q?.id ?? '');
          const spoken = (candidateByQuestion.get(qid) || []).join(' ').trim();
          return {
            question: String(q?.question ?? ''),
            transcript: spoken.length > 0 ? spoken : null,
            expectedResponse: q?.expectedResponse ?? null,
            scoringCriteria: q?.scoringCriteria ?? null,
          };
        });

        const report = await scoreScreening({ jobTitle: row.job_title ?? '', answers });

        await pool.query(
          `UPDATE voice_screening_sessions
             SET status = 'completed', overall_score = $1, recommendation = $2, summary = $3,
                 dimension_scores = $4::jsonb, abstained = $5, ai_provenance = $6,
                 answered_count = $7, updated_at = now(), completed_at = now()
           WHERE id = $8`,
          [
            report.overallScore,
            report.recommendation,
            report.summary,
            JSON.stringify(report.dimensions),
            report.abstained,
            report.provenance,
            report.answeredCount,
            sessionId,
          ],
        );

        const updated = (await pool.query(`SELECT * FROM voice_screening_sessions WHERE id = $1`, [sessionId])).rows[0];
        res.json({ success: true, session: sessionToJson(updated) });
      } catch (err: any) {
        const status = err instanceof VoiceAIUnavailable ? 503 : 500;
        res.status(status).json({ message: err?.message || 'finalize_failed', aiUnavailable: status === 503 });
      }
    },
  );

  // ── Fetch one live session (metadata + report) ──────────────────────────────
  app.get(
    '/api/employer/voice-screening/live/sessions/:id',
    liveAvatarFlagGate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        await ensureVoiceSchema(pool);
        const eid = employerId(req);
        const row = (
          await pool.query(
            `SELECT * FROM voice_screening_sessions WHERE id = $1 AND employer_id = $2 AND channel = 'live_avatar'`,
            [req.params.id, eid],
          )
        ).rows[0];
        if (!row) return res.status(404).json({ message: 'session_not_found' });
        res.json({ success: true, session: sessionToJson(row) });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || 'fetch_failed' });
      }
    },
  );
}

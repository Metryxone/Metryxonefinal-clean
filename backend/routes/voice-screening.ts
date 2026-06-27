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
import { isVoiceScreeningEnabled } from '../config/feature-flags';
import {
  VOICE_DIMENSIONS,
  buildQuestionSet,
  transcribeAudio,
  scoreScreening,
  isAIConfigured,
  VoiceAIUnavailable,
  AI_PROVENANCE,
  type AnswerInput,
} from '../services/voice-screening-engine';

type Middleware = (req: Request, res: Response, next: any) => void;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per recorded answer
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
        res.json({ success: true, questions: buildQuestionSet(jobTitle) });
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
        const questions = buildQuestionSet(jobTitle);
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
          `SELECT question_text, transcript FROM voice_screening_answers
             WHERE session_id = $1 ORDER BY question_index ASC`,
          [sessionId],
        );
        const answers: AnswerInput[] = ans.rows.map((a) => ({
          question: a.question_text ?? '',
          transcript: a.transcript ?? null,
        }));

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
}

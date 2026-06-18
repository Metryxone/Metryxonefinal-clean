/**
 * AI Assessment V2 routes (additive, feature-flagged).
 * Mount prefix: /api/v2/ai
 * Flag: aiInferenceV2.
 *
 *   POST /infer-competencies     — multi-source inference
 *   POST /analyze-resume         — resume only
 *   POST /analyze-linkedin       — linkedin only
 *   POST /analyze-github         — github only
 *   POST /start-conversation     — start conversational assessment
 *   POST /conversation/:id/respond — submit a turn response
 *   GET  /conversation/:id       — fetch session state
 *   GET  /reasoning/:userId      — reasoning chains for a user (self-only)
 *   GET  /feature-flag           — public
 *   GET  /_meta/versions         — public
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  inferCompetencies, persistInference, INFERENCE_VERSIONS,
} from '../services/ai-competency-inference-engine';
import { extractResumeSignals, signalsToCompetencyLevels } from '../services/resume-signal-engine';
import { analyzeGithubPayload, githubToCompetencyLevels } from '../services/github-competency-analyzer';
import { analyzeLinkedinPayload, linkedinToCompetencyLevels } from '../services/linkedin-intelligence-engine';
import {
  startConversation, chooseNextProbe, appendProbe, recordResponse,
  CONVERSATIONAL_ENGINE_VERSION, type ConversationState,
} from '../services/conversational-assessment-engine';
import { isAiInferenceV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { ...INFERENCE_VERSIONS, CONVERSATIONAL_ENGINE_VERSION };

const LANGUAGE_POLICY = {
  allowed: ['inferred competency', 'developmental signal', 'reasoning chain', 'behavioural evidence', 'confidence band'],
  disallowed: ['hiring recommendation', 'promotion ranking', 'individual suitability prediction', 'pass/fail verdict'],
  inference_mode: 'heuristic' as const,        // no LLM; pattern-based
};

function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { aiInferenceV2: isAiInferenceV2Enabled() } };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}) {
  return { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { aiInferenceV2: isAiInferenceV2Enabled() } };
}

function requireFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isAiInferenceV2Enabled()) return res.status(503).json(errorEnvelope('aiInferenceV2 disabled'));
  next();
}

function authUserId(req: Request): number | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  const n = typeof u.id === 'string' ? Number.parseInt(u.id, 10) : u.id;
  return Number.isFinite(n) ? (n as number) : null;
}

export function registerAiAssessmentV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/ai/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/ai/_meta/versions', (_req, res) => res.json(envelope({})));

  // ── Multi-source inference ─────────────────────────────────────────────
  app.post('/api/v2/ai/infer-competencies', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const reqUid = req.body?.userId != null ? Number(req.body.userId) : auth;
      if (!Number.isFinite(reqUid) || reqUid <= 0) return res.status(400).json(errorEnvelope('userId required'));
      if (reqUid !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const sources = Array.isArray(req.body?.sources) ? req.body.sources : [];
      if (!sources.length) return res.status(400).json(errorEnvelope('sources[] required'));
      const result = await inferCompetencies(pool, reqUid, sources);
      // Fire-and-forget persistence (one row per source bundle)
      for (const src of sources) {
        persistInference(pool, reqUid, src.type, src, result).catch((e) => console.warn('[ai] persist failed:', (e as Error).message));
      }
      res.json(envelope({ inference: result }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Resume only ────────────────────────────────────────────────────────
  app.post('/api/v2/ai/analyze-resume', requireAuth, requireFlag, async (req, res) => {
    try {
      const text = String(req.body?.text ?? '');
      if (!text.trim()) return res.status(400).json(errorEnvelope('text required'));
      const signals = extractResumeSignals(text);
      const levels = signalsToCompetencyLevels(signals);
      res.json(envelope({ signals, competency_levels: levels }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── LinkedIn only ──────────────────────────────────────────────────────
  app.post('/api/v2/ai/analyze-linkedin', requireAuth, requireFlag, async (req, res) => {
    try {
      const payload = req.body?.payload ?? req.body ?? {};
      const analysis = analyzeLinkedinPayload(payload);
      const levels = linkedinToCompetencyLevels(analysis);
      res.json(envelope({ analysis, competency_levels: levels }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── GitHub only ────────────────────────────────────────────────────────
  app.post('/api/v2/ai/analyze-github', requireAuth, requireFlag, async (req, res) => {
    try {
      const payload = req.body?.payload ?? req.body ?? {};
      const analysis = analyzeGithubPayload(payload);
      const levels = githubToCompetencyLevels(analysis);
      res.json(envelope({ analysis, competency_levels: levels }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Conversation lifecycle ────────────────────────────────────────────
  app.post('/api/v2/ai/start-conversation', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      let state = startConversation();
      const probe = chooseNextProbe(state); state = appendProbe(state, probe);
      const r = await pool.query<{ id: string }>(
        `INSERT INTO conversational_assessment_sessions (user_id, state, turns, detected_competencies, contradiction_count, quality_score)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6) RETURNING id`,
        [auth, state.state, JSON.stringify(state.turns), JSON.stringify(state.detected_competencies), state.contradiction_count, state.quality_score],
      );
      res.json(envelope({ session_id: r.rows[0].id, state, next_question: probe }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/ai/conversation/:id/respond', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const id = String(req.params.id);
      const response = String(req.body?.response ?? '').trim();
      if (!response) return res.status(400).json(errorEnvelope('response required'));
      const r = await pool.query<{ user_id: string; state: string; turns: ConversationState['turns']; detected_competencies: ConversationState['detected_competencies']; contradiction_count: number; quality_score: number }>(
        `SELECT user_id::text, state, turns, detected_competencies, contradiction_count, quality_score
         FROM conversational_assessment_sessions WHERE id = $1`, [id],
      );
      if (!r.rowCount) return res.status(404).json(errorEnvelope('session not found'));
      if (Number(r.rows[0].user_id) !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      let current: ConversationState = {
        state: r.rows[0].state as ConversationState['state'],
        turns: r.rows[0].turns ?? [],
        detected_competencies: r.rows[0].detected_competencies ?? {},
        contradiction_count: r.rows[0].contradiction_count ?? 0,
        quality_score: Number(r.rows[0].quality_score ?? 0),
      };
      if (current.state !== 'open') return res.status(409).json(errorEnvelope('session closed'));
      const { state: next, turn } = recordResponse(current, response);
      // Decide next probe (close after 7 turns or 3 contradictions)
      const shouldClose = next.turns.length >= 7 || next.contradiction_count >= 3;
      let probe: { question: string; competency_target: string } | null = null;
      let final = next;
      if (shouldClose) {
        final = { ...next, state: next.contradiction_count >= 3 ? 'escalated' : 'closed' };
      } else {
        probe = chooseNextProbe(next); final = appendProbe(next, probe);
      }
      await pool.query(
        `UPDATE conversational_assessment_sessions
         SET state = $2, turns = $3::jsonb, detected_competencies = $4::jsonb, contradiction_count = $5, quality_score = $6, closed_at = CASE WHEN $2 IN ('closed','escalated') THEN NOW() ELSE closed_at END
         WHERE id = $1`,
        [id, final.state, JSON.stringify(final.turns), JSON.stringify(final.detected_competencies), final.contradiction_count, final.quality_score],
      );
      res.json(envelope({ state: final, recorded_turn: turn, next_question: probe }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.get('/api/v2/ai/conversation/:id', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const id = String(req.params.id);
      const r = await pool.query(
        `SELECT id, user_id::text, state, turns, detected_competencies, contradiction_count, quality_score, started_at, closed_at
         FROM conversational_assessment_sessions WHERE id = $1`, [id],
      );
      if (!r.rowCount) return res.status(404).json(errorEnvelope('session not found'));
      if (Number(r.rows[0].user_id) !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      res.json(envelope({ session: r.rows[0] }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Reasoning chains for a user (self-only) ────────────────────────────
  app.get('/api/v2/ai/reasoning/:userId', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = Number.parseInt(String(req.params.userId), 10);
      if (!Number.isFinite(userId)) return res.status(400).json(errorEnvelope('userId required'));
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const r = await pool.query(
        `SELECT id, scope, competency_key, reasoning, confidence, created_at
         FROM ai_reasoning_chains WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId],
      );
      res.json(envelope({ reasoning_chains: r.rows, count: r.rowCount }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
}

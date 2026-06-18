/**
 * Adaptive Assessment V2 routes (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/assessment
 * Flag: adaptiveAssessmentRuntimeV2 (default ON; FF_ADAPTIVE_ASSESSMENT_RUNTIME_V2=false to disable).
 *
 *   POST /generate-blueprint        - dry-run blueprint preview (no persistence)
 *   POST /start                     - persist DNA + blueprint + session
 *   POST /next-question             - lightweight wrapper: returns current state
 *   POST /submit-response           - apply response, adaptive decision, persist
 *   POST /complete                  - finalize session, infer behavioural signals
 *   GET  /explainability/:sessionId - full explainability log
 *   GET  /feature-flag              - public flag readback
 *   GET  /_meta/versions            - public version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { generateBlueprint } from '../services/assessment-blueprint-engine';
import {
  startSession, submitResponse, completeSession, getExplainability, loadSessionStates,
  VERSIONS as ORCH_VERSIONS,
} from '../services/assessment-runtime-orchestrator';
import {
  generateNextQuestion, QUESTION_GENERATION_VERSION,
  type CompetencySignal, type SessionContext as QGSessionContext,
} from '../services/question-generation-engine';
import { isAdaptiveAssessmentV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const LANGUAGE_POLICY = {
  allowed: ['developmental signal', 'capability indicator', 'readiness band'],
  disallowed: ['hiring decision', 'promotion prediction', 'candidate suitability'],
};

function envelope<T extends object>(payload: T) {
  return {
    ok: true,
    ...payload,
    methodology_versions: ORCH_VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { adaptiveAssessmentRuntimeV2: isAdaptiveAssessmentV2Enabled() },
  };
}

function errorEnvelope(error: string, extra: Record<string, unknown> = {}) {
  return {
    ok: false,
    error,
    ...extra,
    methodology_versions: ORCH_VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { adaptiveAssessmentRuntimeV2: isAdaptiveAssessmentV2Enabled() },
  };
}

function requireFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveAssessmentV2Enabled()) {
    return res.status(503).json(errorEnvelope('adaptiveAssessmentRuntimeV2 disabled'));
  }
  next();
}

function getReqUserId(req: Request): number | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  const n = typeof u.id === 'string' ? Number.parseInt(u.id, 10) : u.id;
  return Number.isFinite(n) ? (n as number) : null;
}

export function registerAdaptiveAssessmentV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/assessment/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/assessment/_meta/versions', (_req, res) => res.json(envelope({})));

  app.post('/api/v2/assessment/generate-blueprint', requireAuth, requireFlag, (req, res) => {
    try {
      const { weights, expectedLevels, intensity, industry, layer } = req.body ?? {};
      if (!weights || typeof weights !== 'object') return res.status(400).json(errorEnvelope('weights required'));
      const bp = generateBlueprint({
        weights, expectedLevels: expectedLevels ?? {}, intensity: intensity ?? 0.55,
        industry: industry ?? null, layer: layer ?? null,
      });
      res.json(envelope({ blueprint: bp }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  app.post('/api/v2/assessment/start', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const ctx = req.body?.runtimeContext ?? req.body ?? {};
      const result = await startSession(pool, { userId, runtimeContext: { ...ctx, user_id: userId } });
      res.json(envelope({ result }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  app.post('/api/v2/assessment/next-question', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const sessionId = req.body?.sessionId;
      if (!sessionId) return res.status(400).json(errorEnvelope('sessionId required'));
      const loaded = await loadSessionStates(pool, sessionId, userId);
      const current = loaded.states.find((s) => s.competency_code === loaded.currentCompetency) ?? loaded.states[0] ?? null;
      res.json(envelope({
        current_competency: loaded.currentCompetency,
        state: current,
        all_states: loaded.states,
      }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });

  app.post('/api/v2/assessment/submit-response', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const { sessionId, competencyCode, score, confidence, responseTimeMs, flaggedContradiction, questionId, questionType, difficulty } = req.body ?? {};
      if (!sessionId || !competencyCode || score == null) {
        return res.status(400).json(errorEnvelope('sessionId, competencyCode, score required'));
      }
      const { decision, states } = await submitResponse(pool, {
        sessionId, userId, competencyCode,
        ev: { score: Number(score), confidence, response_time_ms: responseTimeMs, flagged_contradiction: !!flaggedContradiction },
        questionId, questionType, difficulty,
      });
      res.json(envelope({ decision, states }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });

  app.post('/api/v2/assessment/complete', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const { sessionId } = req.body ?? {};
      if (!sessionId) return res.status(400).json(errorEnvelope('sessionId required'));
      const out = await completeSession(pool, { sessionId, userId });
      res.json(envelope({ result: out }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });

  app.get('/api/v2/assessment/explainability/:sessionId', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const logs = await getExplainability(pool, req.params.sessionId, userId);
      res.json(envelope({ logs }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 2 gap-fill: slim aliases matching spec endpoint names
  //   /next     → existing /next-question
  //   /respond  → existing /submit-response
  // ────────────────────────────────────────────────────────────────────────
  app.post('/api/v2/assessment/next', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const sessionId = req.body?.sessionId;
      if (!sessionId) return res.status(400).json(errorEnvelope('sessionId required'));
      const priorResponse = req.body?.priorResponse ?? null;
      const allowSynthetic = req.body?.allowSynthetic !== false;

      const loaded = await loadSessionStates(pool, sessionId, userId);
      const signals: CompetencySignal[] = (loaded.states || []).map((s) => ({
        competency_code: s.competency_code,
        importance_weight: Number((s as { importance_weight?: number }).importance_weight ?? 0.5),
        expected_level: Number((s as { expected_level?: number }).expected_level ?? 50),
        observed_confidence: Number((s as { observed_confidence?: number }).observed_confidence ?? 0),
        observed_level: Number((s as { observed_level?: number }).observed_level ?? 0),
        responses_so_far: Number((s as { responses_count?: number }).responses_count ?? 0),
      }));
      const ctx: QGSessionContext = {
        session_id: sessionId,
        user_id: userId,
        question_index: signals.reduce((n, s) => n + (s.responses_so_far ?? 0), 0),
        prior_response: priorResponse,
        signals,
        allowSynthetic,
      };
      const gen = await generateNextQuestion(pool, ctx);
      const current = loaded.states.find((s) => s.competency_code === loaded.currentCompetency) ?? loaded.states[0] ?? null;
      res.json(envelope({
        current_competency: loaded.currentCompetency,
        state: current,
        all_states: loaded.states,
        next_question: gen.question,
        generation: {
          source: gen.source,
          rationale: gen.rationale,
          methodology_version: gen.methodology_version,
          engine: 'question-generation-engine',
          version: QUESTION_GENERATION_VERSION,
        },
      }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });

  app.post('/api/v2/assessment/respond', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const { sessionId, competencyCode, score, confidence, responseTimeMs, flaggedContradiction, questionId, questionType, difficulty } = req.body ?? {};
      if (!sessionId || !competencyCode || score == null) {
        return res.status(400).json(errorEnvelope('sessionId, competencyCode, score required'));
      }
      const { decision, states } = await submitResponse(pool, {
        sessionId, userId, competencyCode,
        ev: { score: Number(score), confidence, response_time_ms: responseTimeMs, flagged_contradiction: !!flaggedContradiction },
        questionId, questionType, difficulty,
      });
      res.json(envelope({ decision, states }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 2 NEW: graph-driven intelligence report
  // Aggregates from existing competency graph + resolution + signal tables
  // (no template files). Every call is audited into ai_report_generations.
  // ────────────────────────────────────────────────────────────────────────
  app.get('/api/v2/report/intelligence/:sessionId', requireAuth, requireFlag, async (req, res) => {
    const t0 = Date.now();
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;

      // 0) Session ownership check + capture session's bound role_dna_id
      //    (fail-closed on mismatch — prevents IDOR)
      const ownerCheck = await pool.query<{ user_id: string; role_dna_id: string | null }>(
        `SELECT user_id::text AS user_id, role_dna_id::text AS role_dna_id
           FROM assessment_runtime_sessions_v2
          WHERE id = $1::uuid LIMIT 1`,
        [sessionId],
      );
      if (!ownerCheck.rows[0]) {
        return res.status(404).json(errorEnvelope('session not found'));
      }
      if (String(ownerCheck.rows[0].user_id) !== String(userId)) {
        return res.status(403).json(errorEnvelope('session does not belong to user'));
      }
      const sessionRoleDnaId = ownerCheck.rows[0].role_dna_id;

      // 1) Pull weighted competency derivation SCOPED TO THIS SESSION's DNA
      //    (not just "latest by user" — prevents weight drift across sessions).
      //    Fallback: if session has no role_dna_id, fall back to user's latest
      //    resolved DNA (matches Phase 1 behaviour for legacy sessions).
      const weights = sessionRoleDnaId
        ? await pool.query(
            `SELECT competency_code, importance_weight, expected_level,
                    minimum_threshold, growth_priority, criticality,
                    weighting_reason
               FROM competency_runtime_weights
              WHERE role_dna_id = $1::uuid
              ORDER BY importance_weight DESC
              LIMIT 50`,
            [sessionRoleDnaId],
          )
        : await pool.query(
            `SELECT w.competency_code, w.importance_weight, w.expected_level,
                    w.minimum_threshold, w.growth_priority, w.criticality,
                    w.weighting_reason
               FROM competency_resolution_history h
               JOIN competency_runtime_weights w ON w.role_dna_id = h.resolved_role_dna_id
              WHERE h.user_id = $1
              ORDER BY h.created_at DESC, w.importance_weight DESC
              LIMIT 50`,
            [userId],
          );

      // 2) Pull session states from runtime_state JSONB (verified column name)
      //    runtime_state is shaped { states: [{competency_code, observed_level, observed_confidence, responses_count}, ...] }
      const states = await pool.query(
        `SELECT x.competency_code, x.observed_level, x.observed_confidence, x.responses_count
           FROM assessment_runtime_sessions_v2 s
          CROSS JOIN LATERAL jsonb_to_recordset(
              COALESCE(s.runtime_state->'states', '[]'::jsonb)
            ) AS x(competency_code TEXT, observed_level NUMERIC,
                   observed_confidence NUMERIC, responses_count INT)
          WHERE s.id = $1::uuid AND s.user_id = $2`,
        [sessionId, userId],
      );

      // 3) Pull behavioural signals — owner-scoped on BOTH session_id AND user_id (IDOR fix)
      const signals = await pool.query(
        `SELECT competency_code, question_type, response_payload,
                confidence_self_report, confidence_inferred, signal_score, captured_at
           FROM competency_signal_capture
          WHERE session_id = $1::uuid AND user_id = $2
          ORDER BY captured_at DESC
          LIMIT 200`,
        [sessionId, userId],
      );

      // 4) Build graph-driven sections (no templates — pure aggregation)
      const competencyCodes = Array.from(new Set([
        ...weights.rows.map((r) => r.competency_code as string),
        ...states.rows.map((r) => r.competency_code as string),
      ])).filter(Boolean);

      const intelligenceBySection = {
        competency_intelligence: weights.rows.map((w) => {
          const st = states.rows.find((s) => s.competency_code === w.competency_code);
          const gap = st ? Number(w.expected_level) - Number(st.observed_level ?? 0) : null;
          return {
            competency_code: w.competency_code,
            importance_weight: Number(w.importance_weight),
            expected_level: Number(w.expected_level),
            observed_level: st ? Number(st.observed_level) : null,
            observed_confidence: st ? Number(st.observed_confidence) : null,
            gap,
            criticality: w.criticality,
            rationale: w.weighting_reason,
          };
        }),
        readiness_intelligence: weights.rows
          .filter((w) => {
            const st = states.rows.find((s) => s.competency_code === w.competency_code);
            return st && Number(st.observed_level ?? 0) >= Number(w.minimum_threshold ?? 0);
          })
          .map((w) => ({
            competency_code: w.competency_code,
            status: 'ready',
            threshold: Number(w.minimum_threshold),
          })),
        growth_pathways: weights.rows
          .filter((w) => {
            const st = states.rows.find((s) => s.competency_code === w.competency_code);
            return st && Number(st.observed_level ?? 0) < Number(w.expected_level ?? 0);
          })
          .sort((a, b) => Number(b.growth_priority) - Number(a.growth_priority))
          .slice(0, 10)
          .map((w) => {
            const st = states.rows.find((s) => s.competency_code === w.competency_code);
            return {
              competency_code: w.competency_code,
              gap: Number(w.expected_level) - Number(st?.observed_level ?? 0),
              growth_priority: Number(w.growth_priority),
              criticality: w.criticality,
            };
          }),
        behavioural_signals: signals.rows,
        explainability_chain: {
          source_tables: [
            'competency_resolution_history',
            'competency_runtime_weights',
            'assessment_runtime_sessions_v2',
            'competency_signal_capture',
          ],
          graph_nodes_used: competencyCodes,
          generator: 'intelligence-report (graph-driven aggregator)',
        },
      };

      const sections_produced = Object.keys(intelligenceBySection);
      const confidence_score = states.rows.length
        ? +(
            states.rows.reduce((s, r) => s + Number(r.observed_confidence ?? 0), 0) /
            states.rows.length *
            100
          ).toFixed(2)
        : null;

      const payload = {
        session_id: sessionId,
        user_id: userId,
        sections: intelligenceBySection,
        confidence_score,
      };

      // Audit: append to ai_report_generations (best-effort)
      const latency = Date.now() - t0;
      pool.query(
        `INSERT INTO ai_report_generations
           (session_id, user_id, report_type, report_payload,
            source_graph_nodes, source_data_points, sections_produced,
            confidence_score, generation_latency_ms,
            engine_versions, language_policy_snapshot)
         VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10::jsonb, $11::jsonb)`,
        [
          sessionId, String(userId), 'intelligence',
          JSON.stringify(payload),
          JSON.stringify(competencyCodes),
          JSON.stringify([
            { table: 'competency_runtime_weights', count: weights.rows.length },
            { table: 'assessment_runtime_sessions_v2.competency_states', count: states.rows.length },
            { table: 'competency_signal_capture', count: signals.rows.length },
          ]),
          sections_produced,
          confidence_score,
          latency,
          JSON.stringify(ORCH_VERSIONS),
          JSON.stringify(LANGUAGE_POLICY),
        ],
      ).catch((err) => console.warn('[intelligence-report] audit failed:', (err as Error).message));

      res.json(envelope({ report: payload, generation_latency_ms: latency }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: (e as Error).message });
    }
  });
}

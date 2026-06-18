/**
 * Governance & Explainability Routes — Phase 1 S11
 *
 * POST /api/admin/bios/simulate            — dry-run simulation (no DB writes)
 * GET  /api/admin/bios/explainability-log  — unified chronological event feed
 *
 * Event types surfaced by the explainability log:
 *   hypothesis_generated       — behavioural_hypotheses (S3)
 *   confidence_update          — confidence_traces (S4)
 *   contradiction_detected     — contradiction_events (S5)
 *   cognitive_load_snapshot    — cognitive_load_snapshots (S6)
 *   adaptive_question_selected — adaptive_question_selections (S7)
 *   intervention_triggered     — capadex_recommendations (S9)
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { buildHypotheses, type RawHypothesis } from '../services/hypothesis-engine';
import { computeConfidence } from '../services/confidence-engine';
import { getState, replayState } from '../services/cognitive-state';

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SimulatedHypothesis extends RawHypothesis {
  confidence_result: {
    confidence:               number;
    uncertainty:              number;
    evidence_depth:           number;
    signal_reliability:       number;
    longitudinal_consistency: number;
    contradiction_weighting:  number;
    reason_why:               string;
  };
}

interface SimulatedIntervention {
  construct_key:     string;
  confidence_band:   string;
  persona:           string;
  safety_level:      string;
  intervention_text: string;
}

// ─── S7 Scoring helpers (identical weights to adaptive-assessment.ts) ──────────

const W_HYPOTHESIS_RELEVANCE = 0.35;
const W_CONFIDENCE_GAIN      = 0.25;
const W_CONTRADICTION_PROBE  = 0.20;
const W_BASE_PRIORITY        = 0.10;
const W_LOAD_PENALTY         = 0.10;

function clamp(x: number): number { return Math.min(1, Math.max(0, x)); }

interface HypCtx { construct_key: string; confidence: number; }

function scoreHypothesisRelevance(
  constructs: string[],
  hyps:       HypCtx[],
): { relevance: number; matchedKey: string | null; minConfidence: number } {
  if (!constructs.length || !hyps.length) return { relevance: 0, matchedKey: null, minConfidence: 0.5 };
  let matches = 0; let matchKey: string | null = null; let minConf = 1;
  for (const qk of constructs) {
    const qkl = qk.toLowerCase();
    for (const h of hyps) {
      const hkl = h.construct_key.toLowerCase();
      if (qkl === hkl || qkl.includes(hkl) || hkl.includes(qkl)) {
        matches++; matchKey = h.construct_key;
        if (h.confidence < minConf) minConf = h.confidence;
        break;
      }
    }
  }
  return { relevance: clamp(matches / constructs.length), matchedKey: matchKey, minConfidence: minConf };
}

function buildAdaptiveReason(opts: {
  relevance:      number;
  matchedKey:     string | null;
  minConfidence:  number;
  confidenceGain: number;
  evidenceObjs:   string[];
}): string {
  const parts: string[] = [];
  if (opts.relevance >= 0.7 && opts.matchedKey) {
    parts.push(`Targets '${opts.matchedKey}' hypothesis (confidence: ${Math.round(opts.minConfidence * 100)}%)`);
  } else if (opts.relevance > 0 && opts.matchedKey) {
    parts.push(`Related to hypothesis '${opts.matchedKey}'`);
  } else if (opts.evidenceObjs.length > 0) {
    parts.push(`Collecting ${opts.evidenceObjs[0].replace(/_/g, ' ')}`);
  }
  if (opts.confidenceGain >= 0.15) parts.push('high evidence yield');
  return parts.length ? parts.join('; ') : 'standard evidence collection';
}

// ─── Read-only candidate question loader (mirrors S7 resolution order) ─────────

interface CandidateRow {
  id:                     string;
  question_text:          string;
  focus_area:             string | null;
  dimension:              string | null;
  adaptive_priority:      number;
  confidence_gain:        number;
  behavioural_constructs: unknown;
  evidence_objectives:    unknown;
}

async function loadCandidateQuestionsForSim(pool: Pool, concernText: string): Promise<CandidateRow[]> {
  const keyword = (concernText.split(' ')[0] ?? concernText).toLowerCase();

  // 1. SAQ matched by keyword in concern_area name
  try {
    const { rows } = await pool.query<CandidateRow>(
      `SELECT saq.id::text AS id, saq.question_text, saq.focus_area, saq.dimension,
              COALESCE(saq.adaptive_priority, 3)::int      AS adaptive_priority,
              COALESCE(saq.confidence_gain, 0.10)::float8  AS confidence_gain,
              COALESCE(saq.behavioural_constructs, '[]'::jsonb) AS behavioural_constructs,
              COALESCE(saq.evidence_objectives,    '[]'::jsonb) AS evidence_objectives
       FROM short_assessment_questions saq
       JOIN concern_areas ca ON ca.id = saq.concern_area_id
       WHERE LOWER(ca.concern_area) LIKE '%' || $1 || '%'
         AND saq.stage = 'Curiosity' AND saq.is_active = TRUE
       ORDER BY saq.is_anchor DESC NULLS LAST, saq.weight::numeric DESC
       LIMIT 20`,
      [keyword]
    );
    if (rows.length >= 3) return rows;
  } catch { /* fall through */ }

  // 2. SAQ — any Curiosity-stage question (broadened)
  try {
    const { rows } = await pool.query<CandidateRow>(
      `SELECT saq.id::text AS id, saq.question_text, saq.focus_area, saq.dimension,
              COALESCE(saq.adaptive_priority, 3)::int      AS adaptive_priority,
              COALESCE(saq.confidence_gain, 0.10)::float8  AS confidence_gain,
              COALESCE(saq.behavioural_constructs, '[]'::jsonb) AS behavioural_constructs,
              COALESCE(saq.evidence_objectives,    '[]'::jsonb) AS evidence_objectives
       FROM short_assessment_questions saq
       WHERE saq.stage = 'Curiosity' AND saq.is_active = TRUE
       ORDER BY saq.weight::numeric DESC NULLS LAST
       LIMIT 20`,
      []
    );
    if (rows.length >= 3) return rows;
  } catch { /* fall through */ }

  // 3. SDI items — last resort
  try {
    const { rows } = await pool.query<CandidateRow>(
      `SELECT i.id::text AS id, i.question AS question_text, i.focus_area, i.dimension,
              3::int       AS adaptive_priority, 0.10::float8 AS confidence_gain,
              '[]'::jsonb  AS behavioural_constructs, '[]'::jsonb AS evidence_objectives
       FROM sdi_items i
       WHERE i.stage_code = 'CAP_CUR' AND i.is_active = TRUE
       ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC
       LIMIT 20`,
      []
    );
    return rows;
  } catch { return []; }
}

// ─── Registration ──────────────────────────────────────────────────────────────

export function registerGovernanceRoutes(
  app:               Express,
  pool:              Pool,
  requireSuperAdmin: AuthMiddleware,
): void {

  // ── POST /api/admin/bios/simulate ─────────────────────────────────────────
  app.post('/api/admin/bios/simulate', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { concern_text, persona } = req.body as { concern_text?: string; persona?: string };
      if (!concern_text || typeof concern_text !== 'string' || concern_text.trim().length < 2) {
        return res.status(400).json({ error: 'concern_text is required (min 2 chars).' });
      }
      const resolvedPersona = ['student', 'parent', 'teacher', 'counsellor'].includes(persona ?? '')
        ? persona! : 'student';
      const simSessionId = `sim-${Date.now()}`;

      // ── S3: Hypothesis generation (pure) ──────────────────────────────────
      const rawHypotheses = buildHypotheses({ sessionId: simSessionId, concernText: concern_text.trim() });

      // ── S4: Confidence computation (pure) ─────────────────────────────────
      const hypotheses: SimulatedHypothesis[] = rawHypotheses.map((h) => ({
        ...h,
        confidence_result: computeConfidence({
          base_confidence:          h.confidence,
          evidence_depth:           h.evidence_sources.length >= 3 ? 0.7 : 0.4,
          signal_reliability:       0.65,
          longitudinal_consistency: 0.0,
          contradiction_weighting:  0.0,
        }),
      }));
      hypotheses.sort((a, b) => b.confidence_result.confidence - a.confidence_result.confidence);

      // Build hypothesis context for S7 scoring
      const hypCtx: HypCtx[] = hypotheses.map(h => ({
        construct_key: h.construct_key,
        confidence:    h.confidence_result.confidence,
      }));
      const minHypConf = hypCtx.length > 0 ? Math.min(...hypCtx.map(h => h.confidence)) : 0.5;

      // ── S7: Adaptive question scoring (same engine weights, read-only DB) ─
      const candidates = await loadCandidateQuestionsForSim(pool, concern_text.trim());

      const scored = candidates.map((q) => {
        const constructs: string[] = Array.isArray(q.behavioural_constructs) ? (q.behavioural_constructs as string[]) : [];
        const evidObjs: string[]   = Array.isArray(q.evidence_objectives)    ? (q.evidence_objectives as string[])    : [];

        const { relevance, matchedKey, minConfidence } = scoreHypothesisRelevance(constructs, hypCtx);
        const confidenceGap        = clamp(1 - minHypConf);
        const confidenceGainFactor = clamp(q.confidence_gain * (0.5 + confidenceGap * 0.5));
        const basePriority         = clamp(1 - Math.abs(q.adaptive_priority - 3) / 4);

        const adaptive_score = clamp(
          relevance            * W_HYPOTHESIS_RELEVANCE +
          confidenceGainFactor * W_CONFIDENCE_GAIN      +
          0                    * W_CONTRADICTION_PROBE  + // no contradictions in dry-run
          basePriority         * W_BASE_PRIORITY        -
          0                    * W_LOAD_PENALTY           // no prior load in dry-run
        );

        return {
          id:                /^\d+$/.test(q.id) ? parseInt(q.id, 10) : q.id,
          question_text:     q.question_text,
          focus_area:        q.focus_area,
          dimension:         q.dimension,
          construct_key:     matchedKey,
          adaptive_priority: q.adaptive_priority,
          confidence_gain:   q.confidence_gain,
          adaptive_score:    Math.round(adaptive_score * 1000) / 1000,
          reason:            buildAdaptiveReason({ relevance, matchedKey, minConfidence, confidenceGain: q.confidence_gain, evidenceObjs: evidObjs }),
        };
      });

      // Sort desc by score; lighter adaptive_priority wins ties (same as S7)
      scored.sort((a, b) => b.adaptive_score - a.adaptive_score || a.adaptive_priority - b.adaptive_priority);
      const predictedQuestions = scored.slice(0, 3);

      // ── Intervention preview (read-only) ──────────────────────────────────
      const topConstruct   = hypotheses[0]?.construct_key ?? 'ATTENTION_REGULATION';
      const topConf        = hypotheses[0]?.confidence_result.confidence ?? 0;
      const cBand          = topConf >= 0.65 ? 'high' : topConf >= 0.4 ? 'moderate' : 'low';

      const { rows: interventionRows } = await pool.query<SimulatedIntervention>(
        `SELECT construct_key, confidence_band, persona, safety_level,
                LEFT(intervention_text, 200) AS intervention_text
         FROM intervention_library
         WHERE construct_key = $1 AND persona = $2 AND is_active = true
         ORDER BY CASE WHEN confidence_band = $3 THEN 0 ELSE 1 END, id
         LIMIT 3`,
        [topConstruct, resolvedPersona, cBand]
      );

      return res.json({
        ok: true, simulation_id: simSessionId,
        concern_text: concern_text.trim(), persona: resolvedPersona,
        hypotheses: hypotheses.map(h => ({
          construct_key: h.construct_key, label: h.label,
          confidence: h.confidence_result.confidence, uncertainty: h.confidence_result.uncertainty,
          reason_why: h.confidence_result.reason_why,
          lifecycle_state: h.lifecycle_state, evidence_sources: h.evidence_sources,
        })),
        top_3_confidence_scores: hypotheses.slice(0, 3).map(h => ({
          construct_key: h.construct_key,
          label:         h.label,
          confidence:    h.confidence_result.confidence,
        })),
        top_confidence_band: cBand,
        predicted_questions: predictedQuestions,
        intervention_preview: interventionRows,
        scoring_weights: {
          hypothesis_relevance: W_HYPOTHESIS_RELEVANCE,
          confidence_gain_factor: W_CONFIDENCE_GAIN,
          contradiction_probe: W_CONTRADICTION_PROBE,
          base_priority_factor: W_BASE_PRIORITY,
          load_penalty: W_LOAD_PENALTY,
          note: 'Identical to Phase 1 S7 adaptive_questioning engine weights.',
        },
        meta: {
          hypothesis_count:   hypotheses.length,
          question_count:     predictedQuestions.length,
          intervention_count: interventionRows.length,
          note: 'Dry-run only — no database records were created.',
        },
      });
    } catch (err) {
      console.error('[governance] simulate error:', err);
      return res.status(500).json({ error: 'Simulation failed.' });
    }
  });

  // ── GET /api/admin/bios/explainability-log ────────────────────────────────
  app.get('/api/admin/bios/explainability-log', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const page      = Math.max(1,   parseInt(String(req.query.page   ?? '1'),  10));
      const limit     = Math.min(100, parseInt(String(req.query.limit  ?? '25'), 10));
      const offset    = (page - 1) * limit;
      const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() || null : null;
      const eventType = typeof req.query.event_type === 'string' ? req.query.event_type.trim() || null : null;

      // Build params list: [sessionId?, eventType?, limit, offset]
      // sessionId = $1 (if present)
      // eventType = $N (next slot, if present)
      // limit     = $N+1, offset = $N+2
      const params: unknown[] = [];
      const sidPh  = sessionId ? `$${params.push(sessionId)}` : 'NULL::text';
      const etPh   = eventType ? `$${params.push(eventType)}` : null;
      const limitPh  = `$${params.push(limit)}`;
      const offsetPh = `$${params.push(offset)}`;

      // Session filter helper used in each UNION arm (uses sidPh — same param index every time)
      const sf = sessionId ? `AND session_id = ${sidPh}` : '';
      // For capadex_recommendations session_id is UUID — cast to text for comparison
      const sfUuid = sessionId ? `AND cr.session_id::text = ${sidPh}` : '';

      const events_sql = `
        WITH unified AS (

          SELECT bh.id::text AS id, bh.session_id::text AS session_id,
                 'hypothesis_generated'::text AS event_type,
                 bh.lifecycle_state AS sub_type,
                 'Hypothesis "' || bh.label || '" created — confidence: '
                   || ROUND(bh.confidence::numeric * 100) || '%' AS reason_why,
                 bh.label AS hypothesis_label,
                 NULL::text AS value_before, bh.confidence::text AS value_after,
                 bh.created_at AS occurred_at
          FROM behavioural_hypotheses bh WHERE 1=1 ${sessionId ? `AND bh.session_id = ${sidPh}` : ''}

          UNION ALL

          SELECT ct.id::text, ct.session_id::text, 'confidence_update'::text,
                 ct.trigger_event, ct.reason_why, bh2.label,
                 ct.confidence_before::text, ct.confidence_after::text, ct.created_at
          FROM confidence_traces ct
          LEFT JOIN behavioural_hypotheses bh2 ON bh2.id = ct.hypothesis_id::uuid
          WHERE 1=1 ${sessionId ? `AND ct.session_id = ${sidPh}` : ''}

          UNION ALL

          SELECT ce.id::text, ce.session_id, 'contradiction_detected'::text,
                 ce.contradiction_type, ce.description, NULL::text,
                 ce.severity, NULL::text, ce.created_at
          FROM contradiction_events ce WHERE 1=1 ${sessionId ? `AND ce.session_id = ${sidPh}` : ''}

          UNION ALL

          SELECT cls.id::text, cls.session_id::text, 'cognitive_load_snapshot'::text,
                 cls.recommended_action,
                 'Composite load: ' || ROUND(cls.composite_load::numeric * 100) || '% — '
                   || cls.recommended_action,
                 NULL::text, cls.composite_load::text, NULL::text, cls.created_at
          FROM cognitive_load_snapshots cls WHERE 1=1 ${sessionId ? `AND cls.session_id = ${sidPh}` : ''}

          UNION ALL

          SELECT aqs.id::text, aqs.session_id, 'adaptive_question_selected'::text,
                 aqs.question_code, aqs.selection_reason, NULL::text,
                 NULL::text, aqs.adaptive_score::text, aqs.created_at
          FROM adaptive_question_selections aqs WHERE 1=1 ${sessionId ? `AND aqs.session_id = ${sidPh}` : ''}

          UNION ALL

          SELECT cr.id::text, cr.session_id::text, 'intervention_triggered'::text,
                 cr.category,
                 cr.title || ': ' || COALESCE(LEFT(cr.description, 120), ''),
                 NULL::text, cr.score_level, cr.status, cr.created_at
          FROM capadex_recommendations cr WHERE 1=1 ${sfUuid}

        )
        SELECT * FROM unified
        ${etPh ? `WHERE event_type = ${etPh}` : ''}
        ORDER BY occurred_at DESC
        LIMIT ${limitPh} OFFSET ${offsetPh}
      `;

      // Count query — identical CTE but just COUNT(*)
      const countParams: unknown[] = [];
      if (sessionId) countParams.push(sessionId);
      if (eventType) countParams.push(eventType);
      const cSidPh = sessionId ? `$${sessionId ? 1 : 0}` : 'NULL::text';
      const cEtPh  = eventType ? `$${sessionId ? 2 : 1}` : null;

      const count_sql = `
        WITH unified AS (
          SELECT 'hypothesis_generated'::text AS event_type
          FROM behavioural_hypotheses WHERE 1=1 ${sessionId ? `AND session_id = ${cSidPh}` : ''}
          UNION ALL
          SELECT 'confidence_update' FROM confidence_traces
          WHERE 1=1 ${sessionId ? `AND session_id = ${cSidPh}` : ''}
          UNION ALL
          SELECT 'contradiction_detected' FROM contradiction_events
          WHERE 1=1 ${sessionId ? `AND session_id = ${cSidPh}` : ''}
          UNION ALL
          SELECT 'cognitive_load_snapshot' FROM cognitive_load_snapshots
          WHERE 1=1 ${sessionId ? `AND session_id = ${cSidPh}` : ''}
          UNION ALL
          SELECT 'adaptive_question_selected' FROM adaptive_question_selections
          WHERE 1=1 ${sessionId ? `AND session_id = ${cSidPh}` : ''}
          UNION ALL
          SELECT 'intervention_triggered' FROM capadex_recommendations
          WHERE 1=1 ${sessionId ? `AND session_id::text = ${cSidPh}` : ''}
        )
        SELECT COUNT(*) AS total FROM unified
        ${cEtPh ? `WHERE event_type = ${cEtPh}` : ''}
      `;

      const [eventsResult, countResult] = await Promise.all([
        pool.query(events_sql, params),
        pool.query(count_sql, countParams),
      ]);

      const total = parseInt(String(countResult.rows[0]?.total ?? '0'), 10);

      return res.json({
        events:      eventsResult.rows,
        total,
        page,
        limit,
        pages:       Math.ceil(total / limit),
        session_id:  sessionId,
        event_type:  eventType,
        event_types: [
          'hypothesis_generated',
          'confidence_update',
          'contradiction_detected',
          'cognitive_load_snapshot',
          'adaptive_question_selected',
          'intervention_triggered',
        ],
      });
    } catch (err) {
      console.error('[governance] explainability-log error:', err);
      return res.status(500).json({ error: 'Failed to load explainability log.' });
    }
  });

  // ── GET /api/admin/bios/runtime-state/:sessionId ──────────────────────────
  // Admin-guarded per-session detail (replaces unguarded /api/bios/runtime-state/:sessionId).
  // Used by the Governance dashboard drawer.
  app.get(
    '/api/admin/bios/runtime-state/:sessionId',
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const sessionId = String(req.params.sessionId);
      try {
        const state = await getState(pool, sessionId);
        if (!state) {
          return res.status(404).json({ error: 'No cognitive runtime state for this session.' });
        }
        return res.json({ session_id: sessionId, state });
      } catch (err) {
        console.error('[governance] runtime-state detail error:', err);
        return res.status(500).json({ error: 'Failed to retrieve state.' });
      }
    }
  );

  // ── GET /api/admin/bios/runtime-state/:sessionId/history ─────────────────
  // Admin-guarded snapshot history — used by the Governance dashboard drawer.
  app.get(
    '/api/admin/bios/runtime-state/:sessionId/history',
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const sessionId = String(req.params.sessionId);
      const limit = Math.min(100, parseInt(String(req.query.limit ?? '50'), 10));
      try {
        const raw = await replayState(pool, sessionId, limit);
        // Map created_at → snapshot_at to match the UI's RuntimeStateDetail.history shape
        const history = raw.map(h => ({
          snapshot_at:     h.created_at,
          version:         h.version,
          state:           h.state,
          snapshot_reason: h.snapshot_reason,
        }));
        return res.json({ session_id: sessionId, count: history.length, history });
      } catch (err) {
        console.error('[governance] runtime-state history error:', err);
        return res.status(500).json({ error: 'Failed to retrieve state history.' });
      }
    }
  );
}

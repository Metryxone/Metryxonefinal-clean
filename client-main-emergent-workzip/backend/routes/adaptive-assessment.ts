/**
 * Adaptive Assessment Runtime Routes — Phase 1 S7
 *
 * POST /api/capadex/adaptive-question
 *   When `adaptive_questioning` flag is ON: calls selectNextQuestion() and
 *   returns the scored next question with adaptive_reason, OR a done signal.
 *   When flag is OFF: delegates to the existing static question-ordering query
 *   (same logic as capadex.ts question loader) and returns the next unanswered
 *   question — so the caller always gets a usable question response.
 *
 * GET  /api/admin/bios/adaptive-assessment/stats
 *   Aggregate analytics: selection frequency per question, average confidence
 *   gain per question, questions most often triggering contradiction probes.
 *   Requires auth + super-admin. Flag-gated.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnabled }          from '../services/feature-flags';
import { selectNextQuestion, rankCandidateQuestions } from '../services/adaptive-assessment';

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

// ─── Static fallback loader ───────────────────────────────────────────────────

/**
 * Returns the next unanswered question using the same static ordering as the
 * main CAPADEX question loader (anchor-first, weight DESC).
 * Used when the adaptive_questioning flag is disabled.
 */
async function staticNextQuestion(
  pool:       Pool,
  sessionId:  string,
): Promise<Record<string, unknown> | null> {
  // Load session context.
  // Invalid UUID format → PostgreSQL throws → log + return null.
  // Valid UUID but session not found → rows[0] undefined → return null.
  // Transient DB error → re-throw so caller can return 500 (not done:true).
  let session: { concern_name: string; age_band: string; stage_code: string } | undefined;
  try {
    const { rows } = await pool.query<{
      concern_name: string;
      age_band:     string;
      stage_code:   string;
    }>(
      `SELECT concern_name, age_band, stage_code FROM capadex_sessions WHERE id = $1`,
      [sessionId]
    );
    session = rows[0];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // invalid_text_representation = bad UUID format → not a DB health issue
    if (typeof err === 'object' && err !== null && (err as Record<string,unknown>)['code'] === '22P02') {
      return null;
    }
    // Other DB errors: log as warning and re-throw so the route returns 500
    console.warn(`[adaptive-assessment] session lookup DB error for ${sessionId}: ${msg}`);
    throw err;
  }
  if (!session) return null; // session not found (valid UUID, no row)

  const stageMap: Record<string, string> = {
    CAP_CUR: 'Curiosity', CAP_INS: 'Insight', CAP_GRW: 'Growth', CAP_MAS: 'Mastery',
  };
  const stageName = stageMap[session.stage_code] ?? 'Curiosity';

  // Already-answered IDs (raw item_id strings: digits for SAQ, UUIDs for SDI)
  const answeredIds = new Set<string>();
  try {
    const { rows: answeredRows } = await pool.query<{ item_id: string }>(
      `SELECT item_id FROM capadex_responses WHERE session_id = $1`,
      [sessionId]
    );
    for (const r of answeredRows) answeredIds.add(r.item_id);
  } catch { /* non-fatal */ }

  // ── 1. SAQ bank: anchor-first, weight DESC (same ordering as capadex.ts) ──
  let candidates: Array<Record<string, unknown>> = [];
  try {
    const { rows: saqRows } = await pool.query<Record<string, unknown>>(
      `SELECT saq.id::text AS id, saq.question_code, saq.question_text AS question_text,
              saq.stage, saq.age_band, saq.focus_area, saq.dimension, saq.layer,
              saq.options, saq.polarity, saq.weight, saq.is_anchor
       FROM short_assessment_questions saq
       JOIN concern_areas ca ON ca.id = saq.concern_area_id
       WHERE LOWER(ca.concern_area) = LOWER($1)
         AND (saq.age_band = $2 OR saq.age_band IS NULL)
         AND saq.stage = $3
         AND saq.is_active = TRUE
       ORDER BY saq.is_anchor DESC NULLS LAST,
                saq.weight::numeric DESC,
                saq.sort_order ASC, saq.id ASC`,
      [session.concern_name, session.age_band, stageName]
    );
    if (saqRows.length >= 3) candidates = saqRows;
  } catch { /* SAQ unavailable */ }

  // ── 2. SDI items with age_band filter ─────────────────────────────────────
  if (candidates.length < 3) {
    try {
      const { rows: sdiRows } = await pool.query<Record<string, unknown>>(
        `SELECT i.id::text AS id, i.item_code AS question_code, i.question AS question_text,
                i.stage_code AS stage, i.age_band, i.focus_area, i.dimension,
                i.layer_tag AS layer,
                COALESCE(
                  json_agg(json_build_object(
                    'id',o.id,'option_text',o.text,'score_value',o.score_value,
                    'display_order',o.display_order
                  ) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL),
                  '[]'::json
                ) AS options,
                i.polarity, i.weight, i.anchor AS is_anchor
         FROM sdi_items i
         LEFT JOIN sdi_item_options o ON o.item_id = i.id
         WHERE LOWER(i.concern_name) = LOWER($1)
           AND i.stage_code = $2
           AND i.age_band = ANY($3::text[])
           AND i.is_active = TRUE
         GROUP BY i.id
         ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, i.id`,
        [session.concern_name, session.stage_code, [session.age_band]]
      );
      if (sdiRows.length > candidates.length) candidates = sdiRows;
    } catch { /* sdi_items unavailable */ }
  }

  // ── 3. SDI items without age_band filter (fallback) ───────────────────────
  if (candidates.length < 3) {
    try {
      const { rows: sdiFallback } = await pool.query<Record<string, unknown>>(
        `SELECT i.id::text AS id, i.item_code AS question_code, i.question AS question_text,
                i.stage_code AS stage, i.age_band, i.focus_area, i.dimension,
                i.layer_tag AS layer,
                COALESCE(
                  json_agg(json_build_object(
                    'id',o.id,'option_text',o.text,'score_value',o.score_value,
                    'display_order',o.display_order
                  ) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL),
                  '[]'::json
                ) AS options,
                i.polarity, i.weight, i.anchor AS is_anchor
         FROM sdi_items i
         LEFT JOIN sdi_item_options o ON o.item_id = i.id
         WHERE LOWER(i.concern_name) = LOWER($1)
           AND i.stage_code = $2
           AND i.is_active = TRUE
         GROUP BY i.id
         ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, i.id`,
        [session.concern_name, session.stage_code]
      );
      if (sdiFallback.length > candidates.length) candidates = sdiFallback;
    } catch { /* fallback unavailable */ }
  }

  const next = candidates.find(r => !answeredIds.has(String(r['id'])));
  return next ?? null;
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerAdaptiveAssessmentRoutes(
  app:               Express,
  pool:              Pool,
  requireAuth:       AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
): void {

  // ── GET /api/admin/bios/adaptive-assessment/stats ─────────────────────────
  app.get(
    '/api/admin/bios/adaptive-assessment/stats',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      if (!isEnabled('adaptive_questioning', tenantId)) {
        return res.json({
          flag_active:                     false,
          total_selections:                0,
          sessions_with_adaptive:          0,
          top_selected_questions:          [],
          avg_confidence_gain_by_question: [],
          contradiction_probe_questions:   [],
        });
      }

      try {
        // ── KPI aggregates ────────────────────────────────────────────────
        const kpiResult = await pool.query<{
          total_selections:       string;
          sessions_with_adaptive: string;
        }>(`
          SELECT
            COUNT(*)                   AS total_selections,
            COUNT(DISTINCT session_id) AS sessions_with_adaptive
          FROM adaptive_question_selections
        `);

        // ── Top selected questions (most frequently chosen) ────────────────
        // Use numeric ordering — cast to text only in JS mapping.
        const topResult = await pool.query<{
          question_id:     string;
          question_code:   string | null;
          selection_count: string;
          avg_score:       string | null;
        }>(`
          SELECT
            question_id,
            MAX(question_code)               AS question_code,
            COUNT(*)                         AS selection_count,
            AVG(adaptive_score)::numeric(6,4) AS avg_score
          FROM adaptive_question_selections
          GROUP BY question_id
          ORDER BY COUNT(*) DESC
          LIMIT 20
        `);

        // ── Avg confidence gain per question ──────────────────────────────
        // Reads confidence_gain from the table directly — correct for both
        // SAQ and SDI selections, no join dependency on a single bank.
        const gainResult = await pool.query<{
          question_id:          string;
          question_code:        string | null;
          avg_confidence_gain:  string | null;
          selection_count:      string;
        }>(`
          SELECT
            question_id,
            MAX(question_code)              AS question_code,
            AVG(confidence_gain)::numeric(5,4) AS avg_confidence_gain,
            COUNT(*)                        AS selection_count
          FROM adaptive_question_selections
          WHERE confidence_gain IS NOT NULL
          GROUP BY question_id
          ORDER BY AVG(confidence_gain) DESC NULLS LAST
          LIMIT 20
        `);

        // ── Questions most often triggering contradiction probes ───────────
        const probeResult = await pool.query<{
          question_id:   string;
          question_code: string | null;
          probe_count:   string;
        }>(`
          SELECT
            question_id,
            MAX(question_code) AS question_code,
            COUNT(*)           AS probe_count
          FROM adaptive_question_selections
          WHERE selection_reason ILIKE '%contradiction%'
          GROUP BY question_id
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `);

        const kpi = kpiResult.rows[0];

        return res.json({
          flag_active:            true,
          total_selections:       parseInt(kpi.total_selections,       10),
          sessions_with_adaptive: parseInt(kpi.sessions_with_adaptive, 10),
          top_selected_questions: topResult.rows.map(r => ({
            question_id:     r.question_id,
            question_code:   r.question_code,
            selection_count: parseInt(r.selection_count, 10),
            avg_score:       r.avg_score != null ? Number(r.avg_score) : null,
          })),
          avg_confidence_gain_by_question: gainResult.rows.map(r => ({
            question_id:         r.question_id,
            question_code:       r.question_code,
            avg_confidence_gain: r.avg_confidence_gain != null ? Number(r.avg_confidence_gain) : null,
            selection_count:     parseInt(r.selection_count, 10),
          })),
          contradiction_probe_questions: probeResult.rows.map(r => ({
            question_id:   r.question_id,
            question_code: r.question_code,
            probe_count:   parseInt(r.probe_count, 10),
          })),
        });
      } catch (err) {
        console.error('[adaptive-assessment] stats error:', err);
        return res.status(500).json({ error: 'Failed to retrieve adaptive assessment stats' });
      }
    }
  );

  // ── GET /api/bios/selection/:sessionId ─────────────────────────────────────
  // Read-only inspection surface: returns the FULL ranked candidate list for the
  // session, each annotated with its confidence band + investigative governance
  // role (explore / weaken / eliminate / strengthen). Never mutates the runtime.
  // Flag-off → { flag_active:false, questions:[] } (byte-identical absence).
  app.get(
    '/api/bios/selection/:sessionId',
    async (req: Request, res: Response) => {
      const sessionId = String(req.params.sessionId ?? '').trim();
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      if (!isEnabled('adaptive_questioning', tenantId)) {
        return res.json({ flag_active: false, session_id: sessionId, questions: [] });
      }

      try {
        const questions = await rankCandidateQuestions(pool, sessionId, tenantId);
        return res.json({
          flag_active: true,
          session_id:  sessionId,
          count:       questions.length,
          questions,
        });
      } catch (err) {
        console.error('[adaptive-assessment] selection ranking error:', err);
        return res.status(500).json({ error: 'Failed to rank candidate questions' });
      }
    }
  );

  // ── POST /api/capadex/adaptive-question ────────────────────────────────────
  // Body: { session_id: string }
  //
  // When adaptive_questioning flag is ON:
  //   Returns the engine-scored next question with adaptive_reason, OR a
  //   done signal with reason when questions are exhausted / load ceiling hit.
  //
  // When adaptive_questioning flag is OFF:
  //   Delegates to the static ordering (same as main question loader) and
  //   returns the next unanswered question — caller always gets a question.
  app.post(
    '/api/capadex/adaptive-question',
    async (req: Request, res: Response) => {
      const sessionId = String(req.body?.session_id ?? '').trim();
      if (!sessionId) {
        return res.status(400).json({ error: 'session_id is required' });
      }

      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      // ── Flag-off: delegate to static question ordering ─────────────────
      if (!isEnabled('adaptive_questioning', tenantId)) {
        try {
          const next = await staticNextQuestion(pool, sessionId);
          if (!next) {
            return res.json({
              flag_active:  false,
              session_id:   sessionId,
              done:         true,
              reason:       'no_questions_remaining',
            });
          }
          return res.json({
            flag_active:      false,
            session_id:       sessionId,
            done:             false,
            question:         next,
            adaptive_reason:  'static_order',
          });
        } catch (err) {
          console.error('[adaptive-assessment] static fallback error:', err);
          return res.status(500).json({ error: 'Failed to retrieve next question' });
        }
      }

      // ── Flag-on: adaptive engine ───────────────────────────────────────
      try {
        const result = await selectNextQuestion(pool, sessionId, tenantId);
        return res.json({ flag_active: true, session_id: sessionId, ...result });
      } catch (err) {
        console.error('[adaptive-assessment] select error:', err);
        return res.status(500).json({ error: 'Failed to select adaptive question' });
      }
    }
  );
}

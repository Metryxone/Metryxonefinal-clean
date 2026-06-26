/**
 * CAPADEX Behavioural Signal Capture Routes
 * Step 2: Behavioural Signal Capture — intake, classification, admin intelligence
 *
 * Ingestion logic is now delegated to backend/lib/signal-ingest.ts so that
 * the canonical 14-type taxonomy and DB persistence are shared with the
 * BIOS Intelligence route (behavioural-signals.ts).
 */

import type { Application, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { ingestSessionSignals } from '../lib/signal-ingest';
import { isEnabled } from '../services/feature-flags';
import type { QuestionTiming } from '../services/signal-classifier';
import { z } from 'zod';
import { validate } from '../lib/validate';

// telemetry: mirrors the handler's truthy check (`!session_id || !question_id`).
// Both fields may be string OR number in legitimate clients (handler String()s them),
// so we assert TRUTHY presence rather than a string type → byte-identical for valid input.
// NOTE: /api/signals/ingest is intentionally NOT gated here — its flag-skip path
// returns 200 BEFORE the session_id check, so a middleware required-field gate would
// break the flag-off byte-identical behaviour. Its session_id check stays in-handler.
const telemetryBody = z
  .object({ session_id: z.any().optional(), question_id: z.any().optional() })
  .refine((b) => !!b?.session_id && !!b?.question_id, {
    message: 'session_id and question_id are required',
  });

/**
 * Defensive timings normaliser. The ingest pipeline expects `timings` as an
 * item-keyed map: Record<itemId, {response_time_ms, answer_changed, response_value}>.
 * Some clients post a sequential array instead, which would make the classifier
 * silently mis-read array indices as item ids. Reduce an array back into the
 * canonical record keyed by the entry's own id field (falling back to index).
 * A record is passed through untouched; anything else becomes an empty map.
 */
function normalizeTimings(timings: unknown): Record<string, QuestionTiming> {
  if (!timings || typeof timings !== 'object') return {};
  if (!Array.isArray(timings)) return timings as Record<string, QuestionTiming>;
  return (timings as Array<Record<string, unknown>>).reduce<Record<string, QuestionTiming>>((acc, entry, idx) => {
    if (!entry || typeof entry !== 'object') return acc;
    const key = String(entry.item_id ?? entry.itemId ?? entry.question_id ?? entry.id ?? idx);
    acc[key] = {
      response_time_ms: Number(entry.response_time_ms ?? entry.responseTimeMs ?? 0),
      answer_changed: Boolean(entry.answer_changed ?? entry.answerChanged ?? false),
      response_value: Number(entry.response_value ?? entry.responseValue ?? 0),
      ...(entry.hesitation_ms != null ? { hesitation_ms: Number(entry.hesitation_ms) } : {}),
    };
    return acc;
  }, {});
}

export function registerSignalCaptureRoutes(app: Application, pool: Pool): void {

  // ── Bootstrap tables (idempotent) ─────────────────────────────────────────
  pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_session_signals (
      id           SERIAL PRIMARY KEY,
      session_id   UUID NOT NULL,
      item_id      INTEGER,
      signal_type  VARCHAR(50)  NOT NULL,
      signal_key   VARCHAR(100) NOT NULL,
      signal_value JSONB        DEFAULT '{}',
      weight       DECIMAL(4,2) DEFAULT 1.0,
      severity     VARCHAR(20)  DEFAULT 'minimal',
      confidence   DECIMAL(3,2) DEFAULT 0.80,
      description  TEXT,
      captured_at  TIMESTAMPTZ  DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS capadex_signal_profiles (
      id                    SERIAL PRIMARY KEY,
      session_id            VARCHAR(255) UNIQUE NOT NULL,
      user_id               INTEGER,
      concern_name          VARCHAR(500),
      stage_code            VARCHAR(50),
      persona               VARCHAR(100),
      emotional_load        DECIMAL(5,2) DEFAULT 0,
      cognitive_load        DECIMAL(5,2) DEFAULT 0,
      engagement_score      DECIMAL(5,2) DEFAULT 50,
      risk_score            DECIMAL(5,2) DEFAULT 0,
      composite_intensity   DECIMAL(5,2) DEFAULT 0,
      dominant_signals      JSONB DEFAULT '[]',
      early_warnings        JSONB DEFAULT '[]',
      growth_indicators     JSONB DEFAULT '[]',
      hidden_patterns       JSONB DEFAULT '[]',
      persona_signals       JSONB DEFAULT '{}',
      linguistic_summary    JSONB DEFAULT '{}',
      behavioural_flags     JSONB DEFAULT '[]',
      reliability_score     DECIMAL(3,2) DEFAULT 0.80,
      volatility_score      DECIMAL(3,2) DEFAULT 0.00,
      severity_level        VARCHAR(20)  DEFAULT 'minimal',
      signal_count          INTEGER      DEFAULT 0,
      intervention_priority VARCHAR(20)  DEFAULT 'standard',
      generated_at          TIMESTAMPTZ  DEFAULT NOW(),
      updated_at            TIMESTAMPTZ  DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS capadex_session_telemetry (
      id              SERIAL       PRIMARY KEY,
      session_id      VARCHAR(100) NOT NULL,
      question_id     VARCHAR(50)  NOT NULL,
      hesitation_ms   INTEGER      NOT NULL DEFAULT 0,
      backtrack_count INTEGER      NOT NULL DEFAULT 0,
      text_edit_count INTEGER      NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT capadex_session_telemetry_session_question_uniq
        UNIQUE (session_id, question_id)
    );
    CREATE INDEX IF NOT EXISTS idx_capadex_session_telemetry_session_question
      ON capadex_session_telemetry (session_id, question_id);
    CREATE TABLE IF NOT EXISTS capadex_linguistic_signals (
      id                      SERIAL PRIMARY KEY,
      session_id              VARCHAR(255) NOT NULL,
      concern_text            TEXT,
      detected_patterns       JSONB DEFAULT '[]',
      emotional_vocabulary    JSONB DEFAULT '[]',
      intensity_score         DECIMAL(3,2) DEFAULT 0.50,
      certainty_score         DECIMAL(3,2) DEFAULT 0.50,
      absolutism_score        DECIMAL(3,2) DEFAULT 0.00,
      helplessness_indicators JSONB DEFAULT '[]',
      fatigue_markers         JSONB DEFAULT '[]',
      anxiety_markers         JSONB DEFAULT '[]',
      raw_word_count          INTEGER      DEFAULT 0,
      detected_at             TIMESTAMPTZ  DEFAULT NOW()
    );
  `).catch(console.error);

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/signals/ingest
  // Body: { session_id, concern_text?, timings: {[itemId]: QuestionTiming}, stage_code?, persona? }
  // Delegates to shared lib/signal-ingest.ts for classification + persistence.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/signals/ingest', async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = String(req.body?.tenant_id ?? '').trim() || undefined;
    if (!isEnabled('signal_intelligence', tenantId)) {
      return res.json({ ok: true, skipped: true, reason: 'signal_intelligence flag disabled' });
    }
    try {
      const { session_id, concern_text, timings, stage_code, persona } = req.body || {};
      if (!session_id) return res.status(400).json({ error: 'session_id is required' });

      const result = await ingestSessionSignals(pool, {
        session_id,
        concern_text,
        timings: normalizeTimings(timings),
        stage_code,
        persona,
      });

      res.json({ ok: true, ...result });
    } catch (err) { next(err); }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/signals/telemetry — Behavioral Signal Ingestion Buffer (Adv. #1)
  // Body: { session_id, question_id, hesitation_ms?, backtrack_count?, text_edit_count? }
  // High-frequency upsert: one row per (session_id, question_id). Client sends
  // cumulative counters; each call overwrites with the latest snapshot.
  //
  // Auth deliberately omitted to match `/api/signals/ingest` — the CAPADEX free
  // funnel is anonymous; ownership is implicit via the opaque session_id UUID.
  // We hard-cap input ranges so a hostile client can't poison the aggregates.
  // Response is fire-and-forget friendly: returns 202 immediately, never blocks
  // the UI. Errors are swallowed (logged server-side) so transient DB blips
  // never surface as screen freezes during an assessment.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/signals/telemetry', validate({ body: telemetryBody }), async (req: Request, res: Response) => {
    try {
      const { session_id, question_id } = req.body || {};
      if (!session_id || !question_id) {
        // Reject malformed payloads loud-and-fast so a misbehaving client surfaces
        // in dev. We still 202 in the happy path; this is the only validation path.
        return res.status(400).json({ error: 'session_id and question_id are required' });
      }
      // Sanitise: cap counters at sane upper bounds so a runaway client can't
      // overflow ints or skew aggregates. Negative values clamp to 0.
      const hesitation_ms   = Math.max(0, Math.min(600_000, parseInt(req.body?.hesitation_ms,   10) || 0)); // ≤ 10 min
      const backtrack_count = Math.max(0, Math.min(1_000,   parseInt(req.body?.backtrack_count, 10) || 0));
      const text_edit_count = Math.max(0, Math.min(10_000,  parseInt(req.body?.text_edit_count, 10) || 0));

      // Upsert via ON CONFLICT against the (session_id, question_id) unique
      // constraint. For hesitation we take GREATEST so we keep the *longest*
      // observed pause across re-sends (most diagnostically useful signal);
      // counter fields take the latest cumulative value (client tracks state).
      // Reply BEFORE awaiting the write — keeps p95 sub-ms even under load.
      res.status(202).json({ ok: true });

      pool.query(
        `INSERT INTO capadex_session_telemetry
           (session_id, question_id, hesitation_ms, backtrack_count, text_edit_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT capadex_session_telemetry_session_question_uniq
         DO UPDATE SET
           hesitation_ms   = GREATEST(capadex_session_telemetry.hesitation_ms,   EXCLUDED.hesitation_ms),
           backtrack_count = GREATEST(capadex_session_telemetry.backtrack_count, EXCLUDED.backtrack_count),
           text_edit_count = GREATEST(capadex_session_telemetry.text_edit_count, EXCLUDED.text_edit_count),
           updated_at      = NOW()`,
        [String(session_id).slice(0, 100), String(question_id).slice(0, 50), hesitation_ms, backtrack_count, text_edit_count]
      ).catch(err => console.error('[signals/telemetry] upsert failed:', err?.message || err));
    } catch (err: any) {
      // If headers already flushed (the early 202 happy path), Express will no-op.
      // Otherwise surface a 400 so dev sees malformed payloads.
      if (!res.headersSent) res.status(400).json({ error: err?.message || 'invalid payload' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/signals/dashboard — overview stats
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/admin/signals/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows: [stats] } = await pool.query(`
        SELECT
          COUNT(*)                                               AS total_sessions,
          COUNT(*) FILTER (WHERE early_warnings != '[]'::jsonb) AS sessions_with_warnings,
          COUNT(*) FILTER (WHERE intervention_priority IN ('urgent','critical')) AS urgent_priority,
          ROUND(AVG(risk_score)::numeric, 1)                    AS avg_risk_score,
          ROUND(AVG(composite_intensity)::numeric, 1)           AS avg_composite,
          ROUND(AVG(emotional_load)::numeric, 1)                AS avg_emotional_load,
          ROUND(AVG(cognitive_load)::numeric, 1)                AS avg_cognitive_load,
          ROUND(AVG(engagement_score)::numeric, 1)              AS avg_engagement,
          COUNT(*) FILTER (WHERE severity_level IN ('severe','critical')) AS high_severity_count
        FROM capadex_signal_profiles
      `);

      const { rows: severityDist } = await pool.query(`
        SELECT severity_level, COUNT(*) AS count
        FROM capadex_signal_profiles
        GROUP BY severity_level
        ORDER BY CASE severity_level
          WHEN 'critical' THEN 1 WHEN 'severe' THEN 2 WHEN 'elevated' THEN 3
          WHEN 'moderate' THEN 4 WHEN 'mild' THEN 5 ELSE 6 END
      `);

      const { rows: signalFreq } = await pool.query(`
        SELECT signal_key, signal_type, COUNT(*) AS count,
               ROUND(AVG(weight)::numeric, 2) AS avg_weight
        FROM capadex_session_signals
        GROUP BY signal_key, signal_type
        ORDER BY count DESC
        LIMIT 10
      `);

      const { rows: recentWarnings } = await pool.query(`
        SELECT p.session_id, p.concern_name, p.stage_code, p.severity_level,
               p.intervention_priority, p.early_warnings, p.risk_score,
               p.emotional_load, p.cognitive_load, p.engagement_score, p.generated_at
        FROM capadex_signal_profiles p
        WHERE p.early_warnings != '[]'::jsonb
        ORDER BY p.generated_at DESC
        LIMIT 5
      `);

      res.json({ stats, severity_dist: severityDist, top_signals: signalFreq, recent_warnings: recentWarnings });
    } catch (err) { next(err); }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/signals/profiles — paginated signal profiles
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/admin/signals/profiles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page     = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit    = Math.min(50, Math.max(10, parseInt(String(req.query.limit || '20'), 10)));
      const offset   = (page - 1) * limit;
      const severity = req.query.severity as string | undefined;
      const priority = req.query.priority as string | undefined;
      const search   = req.query.search as string | undefined;
      const warnings = req.query.warnings === 'true';

      const conditions: string[] = [];
      const params: unknown[]    = [];
      let   pIdx = 1;

      if (severity) { conditions.push(`p.severity_level = $${pIdx++}`); params.push(severity); }
      if (priority) { conditions.push(`p.intervention_priority = $${pIdx++}`); params.push(priority); }
      if (warnings) { conditions.push(`p.early_warnings != '[]'::jsonb`); }
      if (search)   { conditions.push(`(p.concern_name ILIKE $${pIdx++} OR p.session_id ILIKE $${pIdx++})`); params.push(`%${search}%`, `%${search}%`); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const { rows: profiles } = await pool.query(`
        SELECT p.*, jsonb_array_length(p.early_warnings) AS warning_count
        FROM capadex_signal_profiles p
        ${where}
        ORDER BY p.generated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params);

      const { rows: [{ total }] } = await pool.query(`
        SELECT COUNT(*) AS total FROM capadex_signal_profiles p ${where}
      `, params);

      res.json({ profiles, total: parseInt(total, 10), page, limit });
    } catch (err) { next(err); }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/signals/profiles/:sessionId — full signal profile
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/admin/signals/profiles/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const { rows: [profile] } = await pool.query(
        'SELECT * FROM capadex_signal_profiles WHERE session_id = $1', [sessionId]
      );
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      const { rows: signals } = await pool.query(
        'SELECT * FROM capadex_session_signals WHERE session_id = $1 ORDER BY captured_at ASC', [sessionId]
      );

      const { rows: [linguistic] } = await pool.query(
        'SELECT * FROM capadex_linguistic_signals WHERE session_id = $1 LIMIT 1', [sessionId]
      );

      const { rows: [session] } = await pool.query(
        'SELECT session_id, concern_name, stage_code, guest_email, score, status, created_at FROM capadex_sessions WHERE id = $1 LIMIT 1',
        [sessionId]
      );

      res.json({ profile, signals, linguistic: linguistic || null, session: session || null });
    } catch (err) { next(err); }
  });
}

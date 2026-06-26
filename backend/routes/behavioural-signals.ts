/**
 * BIOS Intelligence — Behavioural Signal Routes
 *
 * Writes to the `behavioural_signals` / `signal_patterns` / `signal_history`
 * tables (BIOS Intelligence layer, user-email keyed).
 *
 * All incoming signal_type values are normalised to the canonical 14-type
 * taxonomy via normalizeSignalType() from backend/lib/signal-ingest.ts so
 * both ingestion paths share the same type vocabulary.
 */

import type { Express } from 'express';
import pg from 'pg';
import { CANONICAL_SIGNAL_TYPES, ingestBehaviouralSignals } from '../lib/signal-ingest';
import { z } from 'zod';
import { validate } from '../lib/validate';

// Mirrors the handler's hard requirement: a non-empty `signals` array.
// session_id / user_email stay optional (handler treats them as optional).
const biosIngestBody = z.object({ signals: z.array(z.any()).min(1) });

export function registerBehaviouralSignalsRoutes(app: Express, pool: pg.Pool) {

  // POST /api/bios/signals/ingest — ingest one or many signals
  // Delegates write logic to shared ingestBehaviouralSignals() for canonical
  // taxonomy enforcement and consistent DB persistence.
  app.post('/api/bios/signals/ingest', validate({ body: biosIngestBody }), async (req, res) => {
    const { session_id, user_email, signals } = req.body;
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return res.status(400).json({ error: 'signals array required' });
    }
    try {
      const result = await ingestBehaviouralSignals(pool, { session_id, user_email, signals });

      // Non-blocking: detect patterns + snapshot
      if (user_email) {
        setImmediate(() => detectPatternsForUser(user_email, pool));
        setImmediate(() => snapshotSignalHistory(user_email, pool));
      }

      res.json({ success: true, ingested: result.ingested });
    } catch (err) {
      console.error('Signal ingest error:', err);
      res.status(500).json({ error: 'ingest failed' });
    }
  });

  // ── Pattern detection (internal) ─────────────────────────────────────────
  async function detectPatternsForUser(email: string, pool: pg.Pool) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT signal_type, signal_category, severity_level, COUNT(*) as freq
         FROM behavioural_signals
         WHERE user_email = $1 AND captured_at > NOW() - INTERVAL '30 days'
         GROUP BY signal_type, signal_category, severity_level
         ORDER BY freq DESC`,
        [email]
      );
      const rows = res.rows;

      const patterns: { pattern_type: string; correlated_signals: unknown[]; risk_level: string; confidence: number }[] = [];

      const highEmotional = rows.filter(r => r.signal_type === 'emotional' && r.severity_level === 'high');
      const highCognitive = rows.filter(r => r.signal_type === 'cognitive' && r.severity_level === 'high');
      const lowEngagement = rows.filter(r => r.signal_type === 'engagement' && r.severity_level === 'low');
      const executiveFn = rows.filter(r => r.signal_type === 'executive_function');

      if (highEmotional.length > 0 && highCognitive.length > 0) {
        patterns.push({
          pattern_type: 'burnout_trajectory_risk',
          correlated_signals: [highEmotional[0], highCognitive[0]],
          risk_level: 'high',
          confidence: 0.75,
        });
      }
      if (lowEngagement.length > 0 && rows.filter(r => r.signal_type === 'motivational').length > 0) {
        patterns.push({
          pattern_type: 'disengagement_drift',
          correlated_signals: lowEngagement,
          risk_level: 'medium',
          confidence: 0.65,
        });
      }
      if (executiveFn.length >= 2) {
        patterns.push({
          pattern_type: 'executive_function_challenge',
          correlated_signals: executiveFn,
          risk_level: 'medium',
          confidence: 0.70,
        });
      }
      const anxietySignals = rows.filter(r => r.signal_category === 'anxiety' || r.signal_type === 'emotional');
      if (anxietySignals.length >= 3) {
        patterns.push({
          pattern_type: 'anxiety_pattern_detected',
          correlated_signals: anxietySignals.slice(0,3),
          risk_level: 'medium',
          confidence: 0.68,
        });
      }

      for (const p of patterns) {
        await client.query(
          `INSERT INTO signal_patterns (user_email, pattern_type, correlated_signals, risk_level, confidence, detected_at)
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [email, p.pattern_type, JSON.stringify(p.correlated_signals), p.risk_level, p.confidence]
        );
      }
    } catch (e) {
      console.error('Pattern detection error:', e);
    } finally { client.release(); }
  }

  // ── Signal history snapshot (internal) ────────────────────────────────────
  async function snapshotSignalHistory(email: string, pool: pg.Pool) {
    const client = await pool.connect();
    try {
      const stats = await client.query(
        `SELECT
           COUNT(*) as total_signals,
           COUNT(DISTINCT signal_type) as unique_types,
           COUNT(*) FILTER (WHERE severity_level='high') as high_severity,
           COUNT(*) FILTER (WHERE severity_level='medium') as medium_severity,
           COUNT(*) FILTER (WHERE severity_level='low') as low_severity,
           json_object_agg(signal_type, count) as type_breakdown
         FROM (
           SELECT signal_type, severity_level, COUNT(*) as count
           FROM behavioural_signals WHERE user_email=$1
           GROUP BY signal_type, severity_level
         ) t`,
        [email]
      );
      const last = await client.query(
        `SELECT id FROM signal_history WHERE user_email=$1 AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
        [email]
      );
      if (last.rows.length === 0) {
        await client.query(
          `INSERT INTO signal_history (user_email, signal_snapshot, created_at) VALUES ($1,$2,NOW())`,
          [email, JSON.stringify(stats.rows[0])]
        );
      }
    } catch (e) {
      console.error('Snapshot error:', e);
    } finally { client.release(); }
  }

  // GET /api/admin/bios/signals/dashboard — KPIs
  app.get('/api/admin/bios/signals/dashboard', async (_req, res) => {
    try {
      const kpi = await pool.query(`
        SELECT
          COUNT(*) as total_signals,
          COUNT(DISTINCT user_email) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(*) FILTER (WHERE severity_level='high') as high_severity_count,
          COUNT(*) FILTER (WHERE severity_level='medium') as medium_severity_count,
          COUNT(*) FILTER (WHERE severity_level='low') as low_severity_count,
          COUNT(*) FILTER (WHERE captured_at > NOW() - INTERVAL '24 hours') as last_24h
        FROM behavioural_signals
      `);
      const byType = await pool.query(`
        SELECT signal_type, COUNT(*) as count,
          ROUND(100.0*COUNT(*)/NULLIF((SELECT COUNT(*) FROM behavioural_signals),0),1) as pct
        FROM behavioural_signals
        GROUP BY signal_type ORDER BY count DESC
      `);
      const patterns = await pool.query(`
        SELECT pattern_type, risk_level, COUNT(*) as count
        FROM signal_patterns
        GROUP BY pattern_type, risk_level ORDER BY count DESC LIMIT 10
      `);
      const recentWarnings = await pool.query(`
        SELECT user_email, pattern_type, risk_level, confidence, detected_at
        FROM signal_patterns WHERE risk_level IN ('high','medium')
        ORDER BY detected_at DESC LIMIT 20
      `);
      res.json({ kpi: kpi.rows[0], byType: byType.rows, patterns: patterns.rows, recentWarnings: recentWarnings.rows });
    } catch (err) {
      console.error('BIOS dashboard error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/bios/signals/profiles — paginated user signal profiles
  app.get('/api/admin/bios/signals/profiles', async (req, res) => {
    const { page = '1', limit = '25', search } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
      const rows = await pool.query(
        `SELECT
           bs.user_email,
           COUNT(*) as total_signals,
           COUNT(DISTINCT bs.signal_type) as unique_types,
           COUNT(*) FILTER (WHERE bs.severity_level='high') as high_count,
           MAX(bs.captured_at) as last_signal_at,
           (SELECT json_agg(sp.pattern_type) FROM signal_patterns sp WHERE sp.user_email=bs.user_email AND sp.risk_level IN ('high','medium') LIMIT 3) as patterns
         FROM behavioural_signals bs
         WHERE ($1::text IS NULL OR bs.user_email ILIKE $1)
         GROUP BY bs.user_email
         ORDER BY last_signal_at DESC
         LIMIT $2 OFFSET $3`,
        [search ? `%${search}%` : null, parseInt(limit), offset]
      );
      const total = await pool.query(
        `SELECT COUNT(DISTINCT user_email) FROM behavioural_signals WHERE ($1::text IS NULL OR user_email ILIKE $1)`,
        [search ? `%${search}%` : null]
      );
      res.json({ rows: rows.rows, total: parseInt(total.rows[0].count), page: parseInt(page) });
    } catch (err) {
      console.error('BIOS profiles error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/bios/signals/profiles/:email — single user detail
  app.get('/api/admin/bios/signals/profiles/:email', async (req, res) => {
    const { email } = req.params;
    try {
      const signals = await pool.query(
        `SELECT * FROM behavioural_signals WHERE user_email=$1 ORDER BY captured_at DESC LIMIT 100`,
        [email]
      );
      const patterns = await pool.query(
        `SELECT * FROM signal_patterns WHERE user_email=$1 ORDER BY detected_at DESC LIMIT 20`,
        [email]
      );
      const history = await pool.query(
        `SELECT * FROM signal_history WHERE user_email=$1 ORDER BY created_at DESC LIMIT 10`,
        [email]
      );
      const byType = await pool.query(
        `SELECT signal_type, COUNT(*) as count FROM behavioural_signals WHERE user_email=$1 GROUP BY signal_type ORDER BY count DESC`,
        [email]
      );
      res.json({ signals: signals.rows, patterns: patterns.rows, history: history.rows, byType: byType.rows });
    } catch (err) {
      console.error('BIOS profile detail error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/bios/signal-types — list all valid canonical signal types
  app.get('/api/bios/signal-types', (_req, res) => {
    res.json({ types: CANONICAL_SIGNAL_TYPES });
  });
}

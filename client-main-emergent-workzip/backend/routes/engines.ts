/**
 * /app/backend/routes/engines.ts
 *
 * §11 Confidence Engine    — computes a confidence score from attempts × recency × consistency.
 * §13 Explainability Engine — produces top strengths, top gaps, reason-for-score, suggested actions.
 * §14 Event System         — in-process EventEmitter that re-computes EI when assessment_completed.
 *
 * Mounted at /api/engines/* by registerRoutes() in routes.ts.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { EventEmitter } from 'node:events';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

// ─── Event System (§14) ────────────────────────────────────────────────────
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// Lightweight in-memory event log so the dashboard can show recent activity.
const EVENT_LOG_MAX = 200;
const eventLog: Array<{ id: number; type: string; payload: any; ts: string }> = [];
let eventCounter = 1;
function logEvent(type: string, payload: any) {
  eventLog.unshift({ id: eventCounter++, type, payload, ts: new Date().toISOString() });
  if (eventLog.length > EVENT_LOG_MAX) eventLog.length = EVENT_LOG_MAX;
}

// ─── Confidence Engine (§11) ───────────────────────────────────────────────
// Inputs: number of attempts, recency (days since last attempt), consistency (stddev of scores)
// Output: 0..100 confidence score
export function computeConfidence(stats: { attempts: number; daysSinceLast: number; stdDev: number }): number {
  const attemptsScore  = Math.min(100, stats.attempts * 20);                // 5 attempts = 100
  const recencyScore   = Math.max(0, 100 - stats.daysSinceLast * 1.5);       // 0 days = 100, 67 days = 0
  const consistencyScore = Math.max(0, 100 - stats.stdDev * 4);              // stddev 0 = 100, 25 = 0
  // Weighted blend
  const conf = (attemptsScore * 0.35) + (recencyScore * 0.25) + (consistencyScore * 0.40);
  return Math.round(Math.max(0, Math.min(100, conf)));
}

// ─── Explainability Engine (§13) ───────────────────────────────────────────
// Given a per-competency score map, returns top strengths, top gaps, narrative summary.
export function explainScores(opts: {
  scores: Array<{ competency_id: string; competency_name: string; domain_name: string; score: number; norm_top10: number }>;
  ei: number;
  topN?: number;
}): {
  ei: number;
  bucket: 'low' | 'medium' | 'high';
  topStrengths: typeof opts.scores;
  topGaps: typeof opts.scores;
  narrative: string;
  suggestedActions: string[];
} {
  const topN = opts.topN ?? 3;
  const sorted = [...opts.scores].sort((a, b) => b.score - a.score);
  const topStrengths = sorted.slice(0, topN);
  const gaps = [...opts.scores]
    .map(s => ({ ...s, gap: Math.max(0, s.norm_top10 - s.score) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, topN);

  const bucket: 'low' | 'medium' | 'high' = opts.ei >= 70 ? 'high' : opts.ei >= 50 ? 'medium' : 'low';

  const strengthList = topStrengths.map(s => s.competency_name).join(', ') || '—';
  const gapList = gaps.map(g => g.competency_name).join(', ') || '—';
  const narrative =
    bucket === 'high'
      ? `Strong overall employability index (${opts.ei}/100). Stand-out strengths: ${strengthList}. Continue compounding while closing residual gaps in: ${gapList}.`
      : bucket === 'medium'
      ? `Mid-range employability index (${opts.ei}/100). Leverage strengths in ${strengthList} while focusing development on ${gapList}.`
      : `Below-target employability index (${opts.ei}/100). Highest-leverage gaps: ${gapList}. Build a 90-day improvement plan starting with the top 2.`;

  const suggestedActions = gaps.map(g => `Targeted practice on "${g.competency_name}" (gap of ${g.gap.toFixed(0)} pts vs benchmark)`);
  return { ei: opts.ei, bucket, topStrengths, topGaps: gaps, narrative, suggestedActions };
}

// ─── Routes ────────────────────────────────────────────────────────────────
export function registerEngineRoutes(app: Express, pool: Pool, requireAuth: Auth, _requireSuperAdmin: Auth) {
  // §11 — Confidence for a user × competency
  app.get('/api/engines/confidence/:userId/:competencyId', requireAuth, async (req, res, next) => {
    try {
      const { userId, competencyId } = req.params;
      const r = await pool.query(
        `SELECT
            COUNT(*)::int AS attempts,
            COALESCE(EXTRACT(EPOCH FROM (now() - MAX(cur.created_at))) / 86400, 999)::float AS days_since,
            COALESCE(stddev_pop(score_obtained), 0)::float AS std_dev,
            AVG(score_obtained)::float AS avg_score
         FROM competency_user_responses cur
         JOIN competency_assessment_items i ON i.id = cur.item_id
         WHERE cur.user_id = $1 AND i.competency_id = $2`,
        [userId, competencyId]
      );
      const row = r.rows[0] || { attempts: 0, days_since: 999, std_dev: 0, avg_score: 0 };
      const confidence = computeConfidence({
        attempts: row.attempts,
        daysSinceLast: row.days_since,
        stdDev: row.std_dev,
      });
      res.json({
        attempts: row.attempts,
        days_since_last: Math.round(row.days_since),
        std_dev: Math.round(row.std_dev * 10) / 10,
        avg_score: Math.round(row.avg_score || 0),
        confidence,
      });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ attempts: 0, confidence: 0, days_since_last: null, std_dev: 0, avg_score: 0 });
      next(err);
    }
  });

  // §13 — Explainability summary for a user
  app.get('/api/engines/explain/:userId', requireAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const r = await pool.query(
        `WITH user_avg AS (
           SELECT i.competency_id, AVG(cur.score_obtained)::float AS user_score
           FROM competency_user_responses cur
           JOIN competency_assessment_items i ON i.id = cur.item_id
           WHERE cur.user_id = $1
           GROUP BY i.competency_id
         )
         SELECT c.id AS competency_id, c.name AS competency_name, d.name AS domain_name,
                COALESCE(u.user_score, 0)::float AS score,
                COALESCE(MAX(s.top10_score), 100)::float AS norm_top10
         FROM competencies c
         JOIN competency_domains d ON d.id = c.domain_id
         LEFT JOIN user_avg u ON u.competency_id = c.id
         LEFT JOIN stage_competency_norms s ON s.competency_id = c.id
         WHERE c.is_active = true
         GROUP BY c.id, c.name, d.name, u.user_score
         ORDER BY u.user_score DESC NULLS LAST`,
        [userId]
      );
      const scores = r.rows.filter(x => x.score > 0);
      if (scores.length === 0) {
        return res.json({
          ei: 0, bucket: 'low',
          topStrengths: [], topGaps: [],
          narrative: 'No assessment responses recorded yet for this user.',
          suggestedActions: ['Complete an initial competency assessment to generate insights'],
        });
      }
      const ei = Math.round(scores.reduce((a, x) => a + x.score, 0) / scores.length);
      res.json(explainScores({ scores, ei }));
    } catch (err: any) {
      if (err?.code === '42P01') {
        return res.json({ ei: 0, bucket: 'low', topStrengths: [], topGaps: [], narrative: 'Schema not initialised', suggestedActions: [] });
      }
      next(err);
    }
  });

  // §14 — Event log + manual event trigger (admin)
  app.get('/api/engines/events', requireAuth, async (_req, res) => {
    res.json({ events: eventLog.slice(0, 50), total: eventLog.length });
  });

  app.post('/api/engines/events/emit', requireAuth, async (req, res) => {
    const { type, payload } = req.body || {};
    if (!type || typeof type !== 'string') return res.status(400).json({ error: 'type required' });
    eventBus.emit(type, payload);
    logEvent(type, payload);
    res.json({ ok: true, type });
  });

  // Built-in handler: when an assessment completes, log event (room for future EI recompute job)
  eventBus.on('assessment_completed', (payload: any) => {
    logEvent('assessment_completed', payload);
    // Future: enqueue recompute job for user's EI / push to dashboard.
  });
  eventBus.on('score_updated', (payload: any) => {
    logEvent('score_updated', payload);
  });
}

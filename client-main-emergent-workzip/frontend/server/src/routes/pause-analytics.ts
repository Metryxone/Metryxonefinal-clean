import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const eventSchema = z.object({
  type: z.enum(['start', 'complete']),
  ts: z.number().int().positive(),
});

router.post('/event', async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'INVALID_PAYLOAD' });
    return;
  }
  const { type, ts } = parsed.data;
  try {
    await pool.query(
      `INSERT INTO pause_events (event_type, client_ts) VALUES ($1, $2)`,
      [type, ts],
    );
    res.status(204).end();
  } catch (err) {
    console.error('[PauseAnalytics] Failed to insert event:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

function parseParamAsMs(param: string): number | null {
  const n = Number(param);
  if (Number.isFinite(n) && n > 0) return n;
  const d = new Date(param);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
}

router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;

    const params: number[] = [];
    const conditions: string[] = [];

    if (fromParam) {
      const fromMs = parseParamAsMs(fromParam);
      if (fromMs !== null) {
        params.push(fromMs);
        conditions.push(`client_ts >= $${params.length}`);
      }
    }

    if (toParam) {
      let toMs = parseParamAsMs(toParam);
      if (toMs !== null) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
          toMs += 86400000 - 1;
        }
        params.push(toMs);
        conditions.push(`client_ts <= $${params.length}`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalsResult = await pool.query<{ event_type: string; count: string }>(
      `SELECT event_type, COUNT(*) AS count FROM pause_events ${whereClause} GROUP BY event_type`,
      params,
    );

    const stats: Record<string, number> = { started: 0, completed: 0 };
    for (const row of totalsResult.rows) {
      if (row.event_type === 'start') stats.started = parseInt(row.count, 10);
      if (row.event_type === 'complete') stats.completed = parseInt(row.count, 10);
    }

    const trendResult = await pool.query<{ day: string; event_type: string; count: string }>(
      `SELECT
         TO_CHAR(TO_TIMESTAMP(client_ts / 1000), 'YYYY-MM-DD') AS day,
         event_type,
         COUNT(*) AS count
       FROM pause_events
       ${whereClause}
       GROUP BY day, event_type
       ORDER BY day ASC`,
      params,
    );

    const trendMap: Record<string, { date: string; started: number; completed: number }> = {};
    for (const row of trendResult.rows) {
      if (!trendMap[row.day]) {
        trendMap[row.day] = { date: row.day, started: 0, completed: 0 };
      }
      if (row.event_type === 'start') trendMap[row.day].started = parseInt(row.count, 10);
      if (row.event_type === 'complete') trendMap[row.day].completed = parseInt(row.count, 10);
    }

    const trend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ ...stats, trend });
  } catch (err) {
    console.error('[PauseAnalytics] Failed to fetch stats:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;

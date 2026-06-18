/**
 * Career Pathways Intelligence (CPI) — API routes
 * Prefix: /api/career/pi/*   (user-facing, authenticated)
 *         /api/admin/career/pi/*  (superadmin analytics)
 *
 * Additive + flag-gated: FF_CAREER_GRAPH=1 to enable.
 * Flag-off → 503. Never throws: all paths degrade gracefully.
 * Composes from: MEI scores, LBI scores, UCIP, career graph recommendations.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';

type AuthFn = (req: Request, res: Response, next: () => void) => void;

// ─── Schema ─────────────────────────────────────────────────────────────────

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cpi_growth_plans (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      role_id       INTEGER REFERENCES cg_roles(id) ON DELETE SET NULL,
      item_id       TEXT NOT NULL,
      title         TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'course',
      status        TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','in_progress','completed','skipped')),
      priority      INTEGER NOT NULL DEFAULT 1,
      ei_lift       NUMERIC(5,2) NOT NULL DEFAULT 0,
      hours         INTEGER NOT NULL DEFAULT 0,
      cost_inr      INTEGER NOT NULL DEFAULT 0,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, role_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cpi_growth_user ON cpi_growth_plans(user_id);

    CREATE TABLE IF NOT EXISTS cpi_interventions (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      title         TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'skill',
      status        TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','started','completed','cancelled')),
      target_role_id INTEGER REFERENCES cg_roles(id) ON DELETE SET NULL,
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      outcome_notes TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cpi_interventions_user ON cpi_interventions(user_id);

    CREATE TABLE IF NOT EXISTS cpi_outcomes (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'skill_acquired'
                    CHECK (type IN ('role_change','salary_increase','promotion','skill_acquired','certification','other')),
      description   TEXT NOT NULL,
      role_id       INTEGER REFERENCES cg_roles(id) ON DELETE SET NULL,
      value_inr     INTEGER,
      recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cpi_outcomes_user ON cpi_outcomes(user_id);

    CREATE TABLE IF NOT EXISTS cpi_rec_lifecycle (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      role_id       INTEGER NOT NULL REFERENCES cg_roles(id) ON DELETE CASCADE,
      segment       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','viewed','saved','in_progress','completed','dismissed')),
      action_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes         TEXT,
      UNIQUE(user_id, role_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cpi_rec_lifecycle_user ON cpi_rec_lifecycle(user_id);
  `);
  schemaReady = true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flagGate(_req: Request, res: Response, next: () => void) {
  if (!flagOn()) return res.status(503).json({ ok: false, error: 'Feature not enabled', flag: FLAG });
  next();
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerCareerPathwaysIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: AuthFn,
  requireSuperAdmin: AuthFn,
): void {
  // Ensure schema on first request
  app.use('/api/career/pi', flagGate, async (_req, _res, next) => {
    try { await ensureSchema(pool); } catch {}
    next();
  });
  app.use('/api/admin/career/pi', flagGate, async (_req, _res, next) => {
    try { await ensureSchema(pool); } catch {}
    next();
  });

  // ── GET /api/career/pi/pathway-intelligence/:userId ────────────────────────
  // Compose adaptive pathway intelligence from EI + LBI + UCIP + career graph.
  app.get('/api/career/pi/pathway-intelligence/:userId', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      // 1. Career graph recommendations (real data)
      const recsRow = await pool.query<{
        role_id: number; role_title: string; domain: string; segment: string;
        rec_score: string; readiness_score: string; market_score: string;
        salary_delta_pct: string; transition_prob: string; behaviour_fit: string;
      }>(`
        SELECT r.id AS role_id, r.title AS role_title, r.domain,
               rec.segment, rec.rec_score, rec.readiness_score, rec.market_score,
               rec.salary_delta_pct, rec.transition_prob, rec.behaviour_fit
        FROM cg_user_recommendations rec
        JOIN cg_roles r ON r.id = rec.role_id
        WHERE rec.user_id = $1
        ORDER BY rec.rec_score DESC
        LIMIT 10
      `, [userId]);

      // 2. MEI score
      const meiRow = await pool.query<{
        composite_score: string; band: string; confidence: string;
      }>(`SELECT composite_score, band, confidence FROM mei_scores WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`, [userId])
        .catch(() => ({ rows: [] as any[] }));
      const mei = meiRow.rows[0] ?? null;

      // 3. LBI score
      const lbiRow = await pool.query<{
        composite_score: string; band: string;
      }>(`SELECT composite_score, band FROM lbi_scores WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`, [userId])
        .catch(() => ({ rows: [] as any[] }));
      const lbi = lbiRow.rows[0] ?? null;

      // 4. LBI trends
      const lbiTrends = await pool.query<{ dimension: string; direction: string; strength: string }>(
        `SELECT dimension, direction, strength FROM lbi_behavior_trends WHERE user_id = $1 ORDER BY strength DESC LIMIT 5`, [userId]
      ).catch(() => ({ rows: [] as any[] }));

      // 5. Recommendation lifecycle (existing user actions)
      const lifecycleRow = await pool.query<{ role_id: number; status: string }>(
        `SELECT role_id, status FROM cpi_rec_lifecycle WHERE user_id = $1`, [userId]
      ).catch(() => ({ rows: [] as any[] }));
      const lifecycleMap = new Map(lifecycleRow.rows.map(r => [r.role_id, r.status]));

      // 6. Assemble enriched recommendations
      const meiScore = safeNum(mei?.composite_score, 50);
      const lbiScore = safeNum(lbi?.composite_score, 50);

      const improvingDims = lbiTrends.rows
        .filter(t => t.direction === 'improving')
        .map(t => t.dimension);

      const recommendations = recsRow.rows.map(rec => {
        const readiness = safeNum(rec.readiness_score, 50);
        const behaviourFit = safeNum(rec.behaviour_fit, 0.5);

        // Intelligence modifiers
        const meiLift    = meiScore >= 70 ? 5 : meiScore >= 50 ? 2 : -2;
        const lbiLift    = lbiScore >= 70 ? 4 : lbiScore >= 50 ? 1 : -1;
        const trendBonus = improvingDims.length >= 3 ? 3 : improvingDims.length >= 1 ? 1 : 0;

        const intelligenceScore = Math.min(100, readiness + meiLift + lbiLift + trendBonus);
        const lifecycleStatus   = lifecycleMap.get(rec.role_id) ?? 'proposed';

        return {
          role_id:          rec.role_id,
          role_title:       rec.role_title,
          domain:           rec.domain,
          segment:          rec.segment,
          rec_score:        safeNum(rec.rec_score),
          readiness_score:  readiness,
          market_score:     safeNum(rec.market_score, 50),
          salary_delta_pct: safeNum(rec.salary_delta_pct),
          transition_prob:  safeNum(rec.transition_prob, 0.5),
          behaviour_fit:    behaviourFit,
          intelligence_score: intelligenceScore,
          lifecycle_status: lifecycleStatus,
          intelligence_signals: {
            mei_score:       meiScore,
            mei_band:        mei?.band ?? 'unknown',
            lbi_score:       lbiScore,
            lbi_band:        lbi?.band ?? 'unknown',
            improving_dims:  improvingDims,
            mei_lift:        meiLift,
            lbi_lift:        lbiLift,
            trend_bonus:     trendBonus,
          },
        };
      });

      // 7. Summary intelligence
      const avgReadiness = recommendations.length
        ? Math.round(recommendations.reduce((s, r) => s + r.readiness_score, 0) / recommendations.length)
        : 0;

      res.json({
        ok: true,
        user_id: userId,
        intelligence_summary: {
          mei_score:   meiScore,
          mei_band:    mei?.band ?? 'unknown',
          lbi_score:   lbiScore,
          lbi_band:    lbi?.band ?? 'unknown',
          avg_readiness: avgReadiness,
          total_recommendations: recommendations.length,
          improving_dimensions: improvingDims,
        },
        recommendations,
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/career/pi/growth-plan/:userId ─────────────────────────────────
  app.get('/api/career/pi/growth-plan/:userId', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      await ensureSchema(pool);
      const rows = await pool.query<{
        id: number; role_id: number | null; item_id: string; title: string;
        type: string; status: string; priority: number; ei_lift: string;
        hours: number; cost_inr: number; notes: string | null;
        created_at: string; updated_at: string;
        role_title?: string;
      }>(`
        SELECT p.*, r.title AS role_title
        FROM cpi_growth_plans p
        LEFT JOIN cg_roles r ON r.id = p.role_id
        WHERE p.user_id = $1
        ORDER BY p.priority ASC, p.created_at ASC
      `, [userId]);

      const stats = {
        total:       rows.rows.length,
        planned:     rows.rows.filter(r => r.status === 'planned').length,
        in_progress: rows.rows.filter(r => r.status === 'in_progress').length,
        completed:   rows.rows.filter(r => r.status === 'completed').length,
        total_ei_lift: rows.rows.reduce((s, r) => s + safeNum(r.ei_lift), 0),
        earned_ei:   rows.rows.filter(r => r.status === 'completed').reduce((s, r) => s + safeNum(r.ei_lift), 0),
        total_hours: rows.rows.reduce((s, r) => s + r.hours, 0),
      };

      res.json({ ok: true, user_id: userId, items: rows.rows, stats });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── POST /api/career/pi/growth-plan/:userId/sync ───────────────────────────
  // Sync IDP items from the frontend engine into the DB (upsert).
  app.post('/api/career/pi/growth-plan/:userId/sync', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const { items, role_id } = req.body as {
      items: Array<{
        item_id: string; title: string; type: string;
        priority: number; ei_lift: number; hours: number; cost_inr: number;
      }>;
      role_id?: number;
    };
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items[] required' });
    try {
      await ensureSchema(pool);
      let synced = 0;
      for (const item of items) {
        await pool.query(`
          INSERT INTO cpi_growth_plans (user_id, role_id, item_id, title, type, priority, ei_lift, hours, cost_inr)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (user_id, role_id, item_id)
          DO UPDATE SET title=$4, type=$5, priority=$6, ei_lift=$7, hours=$8, cost_inr=$9, updated_at=NOW()
          WHERE cpi_growth_plans.status = 'planned'
        `, [userId, role_id ?? null, item.item_id, item.title, item.type, item.priority, item.ei_lift, item.hours, item.cost_inr]);
        synced++;
      }
      res.json({ ok: true, synced });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── PATCH /api/career/pi/growth-plan/:userId/item/:itemId ─────────────────
  app.patch('/api/career/pi/growth-plan/:userId/item/:itemId', requireAuth, async (req: Request, res: Response) => {
    const { userId, itemId } = req.params;
    const { status, notes } = req.body as { status?: string; notes?: string };
    if (!status) return res.status(400).json({ ok: false, error: 'status required' });
    const allowed = ['planned', 'in_progress', 'completed', 'skipped'];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: `status must be one of ${allowed.join(',')}` });
    try {
      await ensureSchema(pool);
      const result = await pool.query(
        `UPDATE cpi_growth_plans SET status=$3, notes=COALESCE($4, notes), updated_at=NOW()
         WHERE user_id=$1 AND item_id=$2`,
        [userId, itemId, status, notes ?? null]
      );
      if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Item not found' });
      res.json({ ok: true, updated: itemId, status });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/career/pi/forecast/:userId ───────────────────────────────────
  // 6-month career forecast: project MEI trajectory + readiness growth.
  app.get('/api/career/pi/forecast/:userId', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      // MEI history for trend
      const meiHistory = await pool.query<{ composite_score: string; snapshot_date: string }>(
        `SELECT composite_score, snapshot_date FROM mei_score_history
         WHERE user_id=$1 ORDER BY snapshot_date ASC LIMIT 12`,
        [userId]
      ).catch(() => ({ rows: [] as any[] }));

      // LBI trends
      const lbiTrends = await pool.query<{ dimension: string; direction: string; magnitude: string }>(
        `SELECT dimension, direction, magnitude FROM lbi_behavior_trends WHERE user_id=$1 LIMIT 6`, [userId]
      ).catch(() => ({ rows: [] as any[] }));

      // Current readiness (top recommendation)
      const readinessRow = await pool.query<{ readiness_score: string; role_title: string }>(
        `SELECT rec.readiness_score, r.title AS role_title
         FROM cg_user_recommendations rec
         JOIN cg_roles r ON r.id = rec.role_id
         WHERE rec.user_id=$1
         ORDER BY rec.rec_score DESC LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as any[] }));

      // Growth plan progress
      const planStats = await pool.query<{ completed: string; total: string; earned_ei: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status='completed') AS completed,
           COUNT(*) AS total,
           COALESCE(SUM(ei_lift) FILTER (WHERE status='completed'), 0) AS earned_ei
         FROM cpi_growth_plans WHERE user_id=$1`,
        [userId]
      ).catch(() => ({ rows: [{ completed: '0', total: '0', earned_ei: '0' }] }));

      const meiScores = meiHistory.rows.map(r => safeNum(r.composite_score));
      const currentMei = meiScores.length ? meiScores[meiScores.length - 1] : 50;
      const earnedEi   = safeNum(planStats.rows[0]?.earned_ei, 0);

      // Linear trend slope from history
      let slope = 0;
      if (meiScores.length >= 2) {
        const n = meiScores.length;
        const sumX = meiScores.reduce((s, _, i) => s + i, 0);
        const sumY = meiScores.reduce((s, v) => s + v, 0);
        const sumXY = meiScores.reduce((s, v, i) => s + i * v, 0);
        const sumX2 = meiScores.reduce((s, _, i) => s + i * i, 0);
        slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      }

      // Improving dimensions lift
      const improvingDims = lbiTrends.rows.filter(t => t.direction === 'improving').length;
      const behaviourLift = improvingDims * 0.5; // +0.5 per improving dim per month

      const currentReadiness = safeNum(readinessRow.rows[0]?.readiness_score, 50);

      // Build 6-month projection
      const months: { month: number; label: string; mei_score: number; readiness: number; behaviour_lift: number }[] = [];
      const labels = ['Now', '+1 mo', '+2 mo', '+3 mo', '+4 mo', '+5 mo', '+6 mo'];
      for (let m = 0; m <= 6; m++) {
        const meiProjected = Math.max(0, Math.min(100, currentMei + slope * m + behaviourLift * m * 0.3 + (earnedEi * 0.1)));
        const readinessProjected = Math.max(0, Math.min(100, currentReadiness + (slope * 0.5 + behaviourLift * 0.4) * m + earnedEi * 0.15));
        months.push({
          month:          m,
          label:          labels[m],
          mei_score:      Math.round(meiProjected * 10) / 10,
          readiness:      Math.round(readinessProjected * 10) / 10,
          behaviour_lift: Math.round(behaviourLift * m * 10) / 10,
        });
      }

      const targetRole = readinessRow.rows[0]?.role_title ?? null;
      const finalReadiness = months[6]?.readiness ?? currentReadiness;
      const eta_months = finalReadiness >= 80
        ? Math.max(0, months.findIndex(m => m.readiness >= 80))
        : null;

      res.json({
        ok: true,
        user_id: userId,
        current: {
          mei_score:       currentMei,
          readiness:       currentReadiness,
          earned_ei:       earnedEi,
          improving_dims:  improvingDims,
          target_role:     targetRole,
        },
        projection: months,
        summary: {
          projected_mei_6mo:      months[6]?.mei_score ?? currentMei,
          projected_readiness_6mo: finalReadiness,
          eta_to_ready_months:    eta_months,
          trend_direction:        slope > 0.5 ? 'accelerating' : slope > 0 ? 'improving' : slope < -0.5 ? 'declining' : 'stable',
          data_confidence:        meiScores.length >= 4 ? 'high' : meiScores.length >= 2 ? 'moderate' : 'low',
        },
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/career/pi/what-if ────────────────────────────────────────────
  // What-if transition analysis: ?from_role_id=N&to_role_id=M&user_id=...
  app.get('/api/career/pi/what-if', requireAuth, async (req: Request, res: Response) => {
    const { from_role_id, to_role_id, user_id } = req.query as Record<string, string>;
    if (!to_role_id) return res.status(400).json({ ok: false, error: 'to_role_id required' });
    const toId = parseInt(to_role_id, 10);
    const fromId = from_role_id ? parseInt(from_role_id, 10) : null;
    try {
      // Target role details
      const toRole = await pool.query<{
        id: number; title: string; domain: string; demand_score: number;
        growth_36mo: number; salary_p50: number; salary_p75: number;
      }>('SELECT id, title, domain, demand_score, growth_36mo, salary_p50, salary_p75 FROM cg_roles WHERE id=$1', [toId]);
      if (!toRole.rows.length) return res.status(404).json({ ok: false, error: 'Role not found' });
      const target = toRole.rows[0];

      // From role (if provided)
      let sourceRole: any = null;
      if (fromId) {
        const fromRow = await pool.query('SELECT id, title, domain, salary_p50 FROM cg_roles WHERE id=$1', [fromId]);
        sourceRole = fromRow.rows[0] ?? null;
      }

      // Skill gap for target
      const skillGap = await pool.query<{ skill_id: number; skill_name: string; required_level: number; weight: number }>(
        `SELECT sr.skill_id, sr.skill_name, sr.required_level, sr.weight
         FROM cg_skill_requirements sr WHERE sr.role_id=$1 ORDER BY sr.weight DESC LIMIT 10`,
        [toId]
      );

      // User readiness if user_id provided
      let userReadiness: any = null;
      if (user_id) {
        const readRow = await pool.query(
          `SELECT readiness_score, skills_score, behaviour_score, market_score
           FROM cg_user_role_readiness WHERE user_id=$1 AND role_id=$2 ORDER BY computed_at DESC LIMIT 1`,
          [user_id, toId]
        ).catch(() => ({ rows: [] as any[] }));
        userReadiness = readRow.rows[0] ?? null;

        // Also check existing recommendation
        const recRow = await pool.query(
          `SELECT rec_score, readiness_score, salary_delta_pct, transition_prob, segment
           FROM cg_user_recommendations WHERE user_id=$1 AND role_id=$2`,
          [user_id, toId]
        ).catch(() => ({ rows: [] as any[] }));
        if (recRow.rows[0]) {
          userReadiness = { ...userReadiness, ...recRow.rows[0] };
        }
      }

      // Path from source to target
      let pathLength: number | null = null;
      if (fromId) {
        const edgeRow = await pool.query(
          `WITH RECURSIVE path(from_id, to_id, depth) AS (
             SELECT from_role_id, to_role_id, 1 FROM cg_role_edges WHERE from_role_id=$1
             UNION ALL
             SELECT e.from_role_id, e.to_role_id, p.depth+1
             FROM cg_role_edges e JOIN path p ON p.to_id = e.from_role_id WHERE p.depth < 5
           ) SELECT MIN(depth) AS hops FROM path WHERE to_id=$2`,
          [fromId, toId]
        ).catch(() => ({ rows: [] as any[] }));
        pathLength = edgeRow.rows[0]?.hops ?? null;
      }

      // Salary delta
      const salaryDelta = sourceRole
        ? Math.round(((target.salary_p50 - sourceRole.salary_p50) / sourceRole.salary_p50) * 100)
        : null;

      // Estimated time to reach 80% readiness
      const currentReadiness = safeNum(userReadiness?.readiness_score, 40);
      const monthsToReady = currentReadiness >= 80 ? 0
        : Math.round((80 - currentReadiness) / 3.5); // ~3.5% per month with consistent effort

      res.json({
        ok: true,
        scenario: {
          from: sourceRole ? { id: sourceRole.id, title: sourceRole.title, domain: sourceRole.domain } : null,
          to:   { id: target.id, title: target.title, domain: target.domain },
        },
        transition_analysis: {
          path_hops:           pathLength,
          salary_delta_pct:    salaryDelta,
          target_salary_p50:   target.salary_p50,
          target_salary_p75:   target.salary_p75,
          demand_score:        target.demand_score,
          growth_36mo:         target.growth_36mo,
          months_to_ready:     monthsToReady,
          transition_probability: safeNum(userReadiness?.transition_prob, 0.5),
          segment:             userReadiness?.segment ?? 'unknown',
        },
        current_readiness: {
          overall:   currentReadiness,
          skills:    safeNum(userReadiness?.skills_score, 0),
          behaviour: safeNum(userReadiness?.behaviour_score, 0),
          market:    safeNum(userReadiness?.market_score, 0),
        },
        top_skill_gaps: skillGap.rows.slice(0, 6).map(s => ({
          skill:    s.skill_name,
          required: s.required_level,
          weight:   safeNum(s.weight),
        })),
        recommendation: currentReadiness >= 75
          ? 'strong_candidate'
          : currentReadiness >= 55
          ? 'near_ready'
          : currentReadiness >= 35
          ? 'developing'
          : 'early_stage',
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/career/pi/recommendation-history/:userId ─────────────────────
  app.get('/api/career/pi/recommendation-history/:userId', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      await ensureSchema(pool);
      const rows = await pool.query<{
        id: number; role_id: number; role_title: string; domain: string;
        segment: string; status: string; action_at: string; notes: string | null;
        rec_score: string; readiness_score: string;
      }>(`
        SELECT lc.id, lc.role_id, r.title AS role_title, r.domain,
               lc.segment, lc.status, lc.action_at, lc.notes,
               rec.rec_score, rec.readiness_score
        FROM cpi_rec_lifecycle lc
        JOIN cg_roles r ON r.id = lc.role_id
        LEFT JOIN cg_user_recommendations rec ON rec.user_id=lc.user_id AND rec.role_id=lc.role_id
        WHERE lc.user_id=$1
        ORDER BY lc.action_at DESC
      `, [userId]);

      const summary = {
        total:       rows.rows.length,
        saved:       rows.rows.filter(r => r.status === 'saved').length,
        in_progress: rows.rows.filter(r => r.status === 'in_progress').length,
        completed:   rows.rows.filter(r => r.status === 'completed').length,
        dismissed:   rows.rows.filter(r => r.status === 'dismissed').length,
      };

      res.json({ ok: true, user_id: userId, history: rows.rows, summary });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── POST /api/career/pi/recommendation-lifecycle ───────────────────────────
  app.post('/api/career/pi/recommendation-lifecycle', requireAuth, async (req: Request, res: Response) => {
    const { user_id, role_id, segment, status, notes } = req.body as {
      user_id: string; role_id: number; segment: string; status: string; notes?: string;
    };
    if (!user_id || !role_id || !status) {
      return res.status(400).json({ ok: false, error: 'user_id, role_id, status required' });
    }
    const allowed = ['proposed', 'viewed', 'saved', 'in_progress', 'completed', 'dismissed'];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: `Invalid status` });
    try {
      await ensureSchema(pool);
      await pool.query(`
        INSERT INTO cpi_rec_lifecycle (user_id, role_id, segment, status, notes)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id, role_id)
        DO UPDATE SET status=$4, segment=COALESCE($3, cpi_rec_lifecycle.segment),
                      notes=COALESCE($5, cpi_rec_lifecycle.notes), action_at=NOW()
      `, [user_id, role_id, segment ?? 'unknown', status, notes ?? null]);
      res.json({ ok: true, role_id, status });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/career/pi/interventions/:userId ──────────────────────────────
  app.get('/api/career/pi/interventions/:userId', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      await ensureSchema(pool);
      const rows = await pool.query<{
        id: number; title: string; type: string; status: string;
        role_title: string | null; started_at: string | null;
        completed_at: string | null; outcome_notes: string | null; created_at: string;
      }>(`
        SELECT i.id, i.title, i.type, i.status,
               r.title AS role_title, i.started_at, i.completed_at,
               i.outcome_notes, i.created_at
        FROM cpi_interventions i
        LEFT JOIN cg_roles r ON r.id = i.target_role_id
        WHERE i.user_id=$1
        ORDER BY i.created_at DESC
      `, [userId]);

      res.json({ ok: true, user_id: userId, interventions: rows.rows });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── POST /api/career/pi/interventions ─────────────────────────────────────
  app.post('/api/career/pi/interventions', requireAuth, async (req: Request, res: Response) => {
    const { user_id, title, type, target_role_id, status, outcome_notes } = req.body as {
      user_id: string; title: string; type: string; target_role_id?: number;
      status?: string; outcome_notes?: string;
    };
    if (!user_id || !title) return res.status(400).json({ ok: false, error: 'user_id, title required' });
    try {
      await ensureSchema(pool);
      const st = status ?? 'planned';
      const result = await pool.query<{ id: number }>(`
        INSERT INTO cpi_interventions (user_id, title, type, target_role_id, status, outcome_notes,
          started_at, completed_at)
        VALUES ($1,$2,$3,$4,$5,$6,
          CASE WHEN $5='started' THEN NOW() ELSE NULL END,
          CASE WHEN $5='completed' THEN NOW() ELSE NULL END)
        RETURNING id
      `, [user_id, title, type ?? 'skill', target_role_id ?? null, st, outcome_notes ?? null]);
      res.json({ ok: true, id: result.rows[0].id, status: st });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── PATCH /api/career/pi/interventions/:id ────────────────────────────────
  app.patch('/api/career/pi/interventions/:id', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { status, outcome_notes } = req.body as { status: string; outcome_notes?: string };
    const allowed = ['planned', 'started', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: `Invalid status` });
    try {
      await ensureSchema(pool);
      await pool.query(`
        UPDATE cpi_interventions SET status=$2, outcome_notes=COALESCE($3, outcome_notes),
          started_at  = CASE WHEN $2='started'   AND started_at   IS NULL THEN NOW() ELSE started_at   END,
          completed_at= CASE WHEN $2='completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
          updated_at  = NOW()
        WHERE id=$1
      `, [id, status, outcome_notes ?? null]);
      res.json({ ok: true, id, status });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/career/pi/outcomes/:userId ───────────────────────────────────
  app.get('/api/career/pi/outcomes/:userId', requireAuth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      await ensureSchema(pool);
      const rows = await pool.query<{
        id: number; type: string; description: string; role_title: string | null;
        value_inr: number | null; recorded_at: string;
      }>(`
        SELECT o.id, o.type, o.description, r.title AS role_title,
               o.value_inr, o.recorded_at
        FROM cpi_outcomes o
        LEFT JOIN cg_roles r ON r.id = o.role_id
        WHERE o.user_id=$1 ORDER BY o.recorded_at DESC
      `, [userId]);
      res.json({ ok: true, user_id: userId, outcomes: rows.rows });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── POST /api/career/pi/outcomes ──────────────────────────────────────────
  app.post('/api/career/pi/outcomes', requireAuth, async (req: Request, res: Response) => {
    const { user_id, type, description, role_id, value_inr } = req.body as {
      user_id: string; type: string; description: string; role_id?: number; value_inr?: number;
    };
    if (!user_id || !type || !description) {
      return res.status(400).json({ ok: false, error: 'user_id, type, description required' });
    }
    const validTypes = ['role_change','salary_increase','promotion','skill_acquired','certification','other'];
    if (!validTypes.includes(type)) return res.status(400).json({ ok: false, error: 'Invalid type' });
    try {
      await ensureSchema(pool);
      const result = await pool.query<{ id: number }>(
        `INSERT INTO cpi_outcomes (user_id, type, description, role_id, value_inr)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [user_id, type, description, role_id ?? null, value_inr ?? null]
      );
      res.json({ ok: true, id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPERADMIN ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /api/admin/career/pi/pathway-analytics ────────────────────────────
  app.get('/api/admin/career/pi/pathway-analytics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const [segDist, topRoles, recStats] = await Promise.all([
        // Segment distribution of all recommendations
        pool.query<{ segment: string; count: string }>(
          `SELECT segment, COUNT(*) AS count FROM cg_user_recommendations GROUP BY segment ORDER BY count DESC`
        ),
        // Top recommended roles by frequency
        pool.query<{ role_title: string; domain: string; rec_count: string; avg_score: string }>(
          `SELECT r.title AS role_title, r.domain,
                  COUNT(*) AS rec_count,
                  AVG(rec.rec_score)::numeric(5,2) AS avg_score
           FROM cg_user_recommendations rec
           JOIN cg_roles r ON r.id = rec.role_id
           GROUP BY r.id, r.title, r.domain
           ORDER BY rec_count DESC LIMIT 10`
        ),
        // Recommendation lifecycle status distribution
        pool.query<{ status: string; count: string }>(
          `SELECT status, COUNT(*) AS count FROM cpi_rec_lifecycle GROUP BY status ORDER BY count DESC`
        ),
      ]);

      res.json({
        ok: true,
        segment_distribution: segDist.rows,
        top_recommended_roles: topRoles.rows,
        lifecycle_distribution: recStats.rows,
        total_recommendations: segDist.rows.reduce((s, r) => s + Number(r.count), 0),
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/admin/career/pi/occupation-analytics ─────────────────────────
  app.get('/api/admin/career/pi/occupation-analytics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const [roleSummary, domainDist, skillDemand, trackPopularity] = await Promise.all([
        pool.query<{ title: string; domain: string; demand_score: number; growth_36mo: number; salary_p50: number }>(
          `SELECT title, domain, demand_score, growth_36mo, salary_p50 FROM cg_roles ORDER BY demand_score DESC LIMIT 20`
        ),
        pool.query<{ domain: string; role_count: string; avg_demand: string }>(
          `SELECT domain, COUNT(*) AS role_count, AVG(demand_score)::numeric(5,1) AS avg_demand
           FROM cg_roles GROUP BY domain ORDER BY role_count DESC`
        ),
        pool.query<{ skill_name: string; role_count: string; avg_required: string }>(
          `SELECT skill_name, COUNT(*) AS role_count, AVG(required_level)::numeric(3,1) AS avg_required
           FROM cg_skill_requirements GROUP BY skill_name ORDER BY role_count DESC LIMIT 15`
        ),
        pool.query<{ track_name: string; waypoint_count: string }>(
          `SELECT t.name AS track_name, COUNT(w.id) AS waypoint_count
           FROM cg_tracks t LEFT JOIN cg_track_waypoints w ON w.track_id=t.id
           GROUP BY t.id, t.name ORDER BY waypoint_count DESC`
        ),
      ]);

      res.json({
        ok: true,
        top_roles_by_demand: roleSummary.rows,
        domain_distribution: domainDist.rows,
        top_demanded_skills: skillDemand.rows,
        track_popularity: trackPopularity.rows,
        total_roles: roleSummary.rows.length,
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/admin/career/pi/recommendation-analytics ────────────────────
  app.get('/api/admin/career/pi/recommendation-analytics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const [totals, segScores, readinessDist, lifecycleRates, conversionFunnel] = await Promise.all([
        pool.query<{ total_users: string; total_recs: string; avg_rec_score: string }>(
          `SELECT COUNT(DISTINCT user_id) AS total_users,
                  COUNT(*) AS total_recs,
                  AVG(rec_score)::numeric(5,2) AS avg_rec_score
           FROM cg_user_recommendations`
        ),
        pool.query<{ segment: string; avg_score: string; avg_readiness: string }>(
          `SELECT segment,
                  AVG(rec_score)::numeric(5,2) AS avg_score,
                  AVG(readiness_score)::numeric(5,1) AS avg_readiness
           FROM cg_user_recommendations GROUP BY segment ORDER BY avg_score DESC`
        ),
        pool.query<{ band: string; count: string }>(
          `SELECT CASE
             WHEN readiness_score >= 80 THEN 'High (80+)'
             WHEN readiness_score >= 60 THEN 'Medium (60-79)'
             WHEN readiness_score >= 40 THEN 'Developing (40-59)'
             ELSE 'Early (< 40)' END AS band,
             COUNT(*) AS count
           FROM cg_user_recommendations GROUP BY 1 ORDER BY 2 DESC`
        ),
        pool.query<{ status: string; count: string; pct: string }>(
          `SELECT status, COUNT(*) AS count,
                  ROUND(COUNT(*)*100.0/NULLIF((SELECT COUNT(*) FROM cpi_rec_lifecycle),0),1) AS pct
           FROM cpi_rec_lifecycle GROUP BY status ORDER BY count DESC`
        ),
        pool.query<{ stage: string; count: string }>(
          `SELECT unnest(ARRAY['proposed','viewed','saved','in_progress','completed']) AS stage,
                  COUNT(*) FILTER (WHERE status IN (
                    CASE unnest(ARRAY['proposed','viewed','saved','in_progress','completed'])
                      WHEN 'proposed' THEN 'proposed'
                      WHEN 'viewed' THEN 'viewed'
                      WHEN 'saved' THEN 'saved'
                      WHEN 'in_progress' THEN 'in_progress'
                      WHEN 'completed' THEN 'completed'
                    END, 'completed')) AS count
           FROM cpi_rec_lifecycle GROUP BY 1` // simplified funnel
        ).catch(() => ({ rows: [] as any[] })),
      ]);

      res.json({
        ok: true,
        summary: totals.rows[0] ?? {},
        by_segment: segScores.rows,
        readiness_distribution: readinessDist.rows,
        lifecycle_rates: lifecycleRates.rows,
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/admin/career/pi/forecast-analytics ───────────────────────────
  app.get('/api/admin/career/pi/forecast-analytics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const [meiTrends, lbiTrends, planProgress, growthPlanDist] = await Promise.all([
        pool.query<{ snapshot_date: string; avg_score: string; user_count: string }>(
          `SELECT DATE_TRUNC('week', snapshot_date) AS snapshot_date,
                  AVG(composite_score)::numeric(5,1) AS avg_score,
                  COUNT(*) AS user_count
           FROM mei_score_history
           GROUP BY 1 ORDER BY 1 DESC LIMIT 8`
        ).catch(() => ({ rows: [] as any[] })),
        pool.query<{ direction: string; count: string }>(
          `SELECT direction, COUNT(*) AS count FROM lbi_behavior_trends GROUP BY direction ORDER BY count DESC`
        ).catch(() => ({ rows: [] as any[] })),
        pool.query<{ status: string; count: string; avg_ei_lift: string }>(
          `SELECT status, COUNT(*) AS count, AVG(ei_lift)::numeric(5,2) AS avg_ei_lift
           FROM cpi_growth_plans GROUP BY status ORDER BY count DESC`
        ),
        pool.query<{ type: string; count: string }>(
          `SELECT type, COUNT(*) AS count FROM cpi_growth_plans GROUP BY type ORDER BY count DESC`
        ),
      ]);

      res.json({
        ok: true,
        mei_trends_weekly: meiTrends.rows.map(r => ({ ...r, snapshot_date: r.snapshot_date })),
        lbi_trend_directions: lbiTrends.rows,
        growth_plan_by_status: planProgress.rows,
        growth_plan_by_type: growthPlanDist.rows,
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });

  // ── GET /api/admin/career/pi/transition-analytics ─────────────────────────
  app.get('/api/admin/career/pi/transition-analytics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const [edgeSummary, completedTransitions, readinessHistory, interventionStats, outcomeSummary] = await Promise.all([
        // Edge type breakdown
        pool.query<{ edge_type: string; count: string; avg_transition_prob: string }>(
          `SELECT edge_type, COUNT(*) AS count,
                  AVG(transition_probability)::numeric(4,2) AS avg_transition_prob
           FROM cg_role_edges GROUP BY edge_type ORDER BY count DESC`
        ).catch(() => ({ rows: [] as any[] })),
        // Users with completed transitions
        pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM cpi_rec_lifecycle WHERE status='completed'`
        ),
        // Readiness history distribution
        pool.query<{ month: string; avg_readiness: string; user_count: string }>(
          `SELECT DATE_TRUNC('month', computed_at) AS month,
                  AVG(readiness_score)::numeric(5,1) AS avg_readiness,
                  COUNT(DISTINCT user_id) AS user_count
           FROM cg_user_role_readiness
           GROUP BY 1 ORDER BY 1 DESC LIMIT 6`
        ).catch(() => ({ rows: [] as any[] })),
        // Intervention completion stats
        pool.query<{ status: string; count: string }>(
          `SELECT status, COUNT(*) AS count FROM cpi_interventions GROUP BY status ORDER BY count DESC`
        ),
        // Outcomes by type
        pool.query<{ type: string; count: string }>(
          `SELECT type, COUNT(*) AS count FROM cpi_outcomes GROUP BY type ORDER BY count DESC`
        ),
      ]);

      res.json({
        ok: true,
        edge_type_breakdown: edgeSummary.rows,
        completed_transitions: Number(completedTransitions.rows[0]?.count ?? 0),
        monthly_readiness_trend: readinessHistory.rows,
        intervention_by_status: interventionStats.rows,
        outcome_by_type: outcomeSummary.rows,
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err.message) });
    }
  });
}

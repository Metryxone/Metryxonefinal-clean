/**
 * Report Intelligence Assembler.
 *
 * GET /api/intelligence/layers
 *
 * Thin, auth-scoped endpoint that composes CIE competency intelligence,
 * MEI score, and CAPADEX session data into ONE payload.  Pure consumer —
 * no new engines, no new computations.  All layers degrade gracefully when
 * data is absent.
 *
 * Query params
 *   sessionId?  — CAPADEX session UUID (enables patterns + composites layer)
 *
 * Response shape  (matches CIESummary in IntelligenceLayers.tsx)
 * ─────────────────────────────────────────────────────────────────────────
 * {
 *   ok: true,
 *   meta: { user_id, assessed_competencies, has_trend_data, has_forecast_data,
 *           mei_score?, generated_at },
 *   profile_context: { career_stage?, target_role?, current_role? },
 *   trends:          TrendItem[],
 *   forecasts:       ForecastItem[],
 *   gap_priority:    GapItem[],
 *   readiness_projection: ReadinessItem[],
 *   outcome_projection: { overall_readiness_pct, outcome_label, assessed_competencies },
 *   interventions:   InterventionItem[],
 *   // Bonus layers (absent for unauthenticated / no data)
 *   mei?:     { score, band, confidence, breakdown },
 *   session?: { patterns, composites }
 * }
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { computePatternTrends }  from '../services/wc3/pattern-trend-intelligence';
import { computeHorizonForecasts } from '../services/wc3/horizon-forecast';
import { deriveProjections }      from '../services/wc3/wcl-projections';
import { computeUserTrends }      from '../services/wc3/trend-intelligence';

// ── Types (mirror the CIE summary shape) ─────────────────────────────────────

interface TrendItem {
  competency_code:  string;
  competency_name:  string;
  points:           { score: number; captured_at: string }[];
  velocity:         { trend: string; momentum: number };
  has_sufficient_data: boolean;
}

interface ForecastItem {
  competency_code: string;
  competency_name: string;
  current_score:   number;
  projected:       { offset: number; score: number; label: string }[];
  confidence:      number;
}

interface GapItem {
  competency_code:  string;
  competency_name:  string;
  current_score:    number;
  gap_level:        'critical' | 'high' | 'medium' | 'low' | 'strength';
  priority_score:   number;
  domain_code?:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function callerId(req: Request): string | null {
  const u = (req as any).user;
  if (!u) return null;
  return String(u.id ?? u.userId ?? u.user_id ?? '').trim() || null;
}

/** Capitalise each word, replace underscores. */
function humanise(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Score → gap level ─────────────────────────────────────────────────────────
function gapLevel(score: number): GapItem['gap_level'] {
  if (score >= 80) return 'strength';
  if (score >= 65) return 'low';
  if (score >= 50) return 'medium';
  if (score >= 35) return 'high';
  return 'critical';
}

function gapPriority(score: number): number {
  return Math.max(0, 100 - score);
}

// ── Trend builder (from history rows) ─────────────────────────────────────────
function buildTrendsFromHistory(
  rows: { competency_id: string; score: number; captured_at: string }[],
): TrendItem[] {
  const map = new Map<string, { score: number; captured_at: string }[]>();
  for (const r of rows) {
    const arr = map.get(r.competency_id) ?? [];
    arr.push({ score: Number(r.score), captured_at: r.captured_at });
    map.set(r.competency_id, arr);
  }

  const result: TrendItem[] = [];
  for (const [code, pts] of Array.from(map.entries())) {
    pts.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
    const n      = pts.length;
    const delta  = n >= 2 ? pts[n - 1].score - pts[n - 2].score : 0;
    const trend  = delta > 3 ? 'growing' : delta < -3 ? 'declining' : 'stable';
    result.push({
      competency_code:     code,
      competency_name:     humanise(code),
      points:              pts,
      velocity:            { trend, momentum: Math.round(delta * 10) / 10 },
      has_sufficient_data: n >= 2,
    });
  }
  return result.sort((a, b) => a.competency_code.localeCompare(b.competency_code));
}

// ── Forecast builder (linear extrapolation) ───────────────────────────────────
function buildForecastsFromTrends(trends: TrendItem[]): ForecastItem[] {
  const result: ForecastItem[] = [];
  for (const t of trends) {
    if (!t.has_sufficient_data || t.points.length < 2) continue;
    const pts   = t.points;
    const n     = pts.length;
    const slope = (pts[n - 1].score - pts[0].score) / Math.max(1, n - 1);
    const last  = pts[n - 1].score;
    const projected = [1, 2, 3].map((offset) => ({
      offset,
      score: Math.min(100, Math.max(0, Math.round(last + slope * offset))),
      label: offset === 1 ? 'Next session' : offset === 2 ? '+2 sessions' : '+3 sessions',
    }));
    result.push({
      competency_code: t.competency_code,
      competency_name: t.competency_name,
      current_score:   last,
      projected,
      confidence:      Math.min(0.9, 0.5 + n * 0.06),
    });
  }
  return result;
}

// ── Gap priority builder ──────────────────────────────────────────────────────
function buildGapsFromTrends(trends: TrendItem[]): GapItem[] {
  return trends
    .filter((t) => t.has_sufficient_data || t.points.length > 0)
    .map((t) => {
      const latest = t.points[t.points.length - 1]?.score ?? 0;
      return {
        competency_code: t.competency_code,
        competency_name: t.competency_name,
        current_score:   latest,
        gap_level:       gapLevel(latest),
        priority_score:  gapPriority(latest),
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score);
}

// ── Register ─────────────────────────────────────────────────────────────────

export function registerReportIntelligenceAssembler(
  app: Express,
  pool: Pool,
  requireAuth: (req: Request, res: Response, next: any) => void,
): void {

  app.get(
    '/api/intelligence/layers',
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = callerId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });

      const sessionId = String(req.query.sessionId ?? '').trim() || null;

      // ── Parallel fetch — every query is wrapped in catch so a missing table
      //    or empty result never breaks the whole response.                   ──
      const [historyRes, meiRes, profileRes, patternsRes, compositesRes] = await Promise.all([

        // CIE: competency history (last 10 rows per code)
        pool.query<{ competency_id: string; score: string; captured_at: string }>(
          `SELECT competency_id, score, captured_at
             FROM p4_competency_history
            WHERE user_id = $1
            ORDER BY competency_id, captured_at DESC`,
          [userId],
        ).catch(() => ({ rows: [] as any[] })),

        // MEI score (latest)
        pool.query<{ composite_score: string; band: string; confidence: string; breakdown: any }>(
          `SELECT composite_score, band, confidence, breakdown
             FROM mei_scores
            WHERE user_id = $1
            ORDER BY computed_at DESC
            LIMIT 1`,
          [userId],
        ).catch(() => ({ rows: [] as any[] })),

        // Career profile (for context)
        pool.query<{ data: any }>(
          `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
          [userId],
        ).catch(() => ({ rows: [] as any[] })),

        // CAPADEX patterns (if sessionId provided)
        sessionId
          ? pool.query<{ label: string; confidence: string; signal_refs: any; explanation: string }>(
              `SELECT label, confidence, signal_refs, explanation
                 FROM capadex_session_patterns
                WHERE session_id = $1
                ORDER BY confidence DESC`,
              [sessionId],
            ).catch(() => ({ rows: [] as any[] }))
          : Promise.resolve({ rows: [] as any[] }),

        // CAPADEX composites (if sessionId provided)
        sessionId
          ? pool.query<{ label: string; strength: string; confidence: string; composite_key: string }>(
              `SELECT label, strength, confidence, composite_key
                 FROM capadex_session_composites
                WHERE session_id = $1
                ORDER BY confidence DESC`,
              [sessionId],
            ).catch(() => ({ rows: [] as any[] }))
          : Promise.resolve({ rows: [] as any[] }),
      ]);

      // ── Build layers ─────────────────────────────────────────────────────
      const historyRows = historyRes.rows.map((r) => ({
        competency_id: r.competency_id,
        score:         Number(r.score),
        captured_at:   r.captured_at,
      }));

      const trends   = buildTrendsFromHistory(historyRows);
      const forecasts = buildForecastsFromTrends(trends);
      const gaps     = buildGapsFromTrends(trends);

      const profileData = profileRes.rows[0]?.data ?? {};
      const meiRow      = meiRes.rows[0];

      const patterns   = patternsRes.rows.map((r) => ({
        label:       r.label,
        confidence:  Number(r.confidence),
        signal_refs: r.signal_refs,
        explanation: r.explanation,
      }));
      const composites = compositesRes.rows.map((r) => ({
        label:         r.label,
        composite_key: r.composite_key,
        strength:      Number(r.strength),
        confidence:    Number(r.confidence),
      }));

      // ── Outcome projection ───────────────────────────────────────────────
      const scoredItems      = gaps.filter((g) => g.current_score > 0);
      const readyItems       = scoredItems.filter((g) => g.gap_level === 'strength' || g.gap_level === 'low');
      const overallReadiness = scoredItems.length > 0
        ? Math.round((readyItems.length / scoredItems.length) * 100)
        : 0;

      const outcomeLabel =
        overallReadiness >= 80 ? 'role_ready'  :
        overallReadiness >= 60 ? 'near_ready'  :
        overallReadiness >= 40 ? 'in_progress' :
        overallReadiness >  0  ? 'early_stage' : 'insufficient_data';

      // ── Readiness projection (per-competency) ────────────────────────────
      const readinessProjection = gaps.map((g) => ({
        competency_code:  g.competency_code,
        competency_name:  g.competency_name,
        readiness_status: g.gap_level === 'strength' ? 'above_target'
                        : g.gap_level === 'low'      ? 'near_ready'
                        : g.gap_level === 'medium'   ? 'in_progress'
                        : g.gap_level === 'high'     ? 'in_progress'
                        : 'early_stage',
        current_score:    g.current_score,
      }));

      // ── Interventions (generic from gaps) ───────────────────────────────
      const topGapCodes = gaps
        .filter((g) => ['critical', 'high', 'medium'].includes(g.gap_level))
        .slice(0, 6)
        .map((g) => g.competency_code);

      const interventionsRes = topGapCodes.length > 0
        ? await pool.query<{
            id:                string;
            construct_key:     string;
            intervention_text: string;
            confidence_band:   string;
          }>(
            `SELECT id, construct_key, intervention_text, confidence_band
               FROM intervention_library
              WHERE construct_key = ANY($1::text[])
                AND is_active = true
              ORDER BY confidence_band DESC
              LIMIT 15`,
            [topGapCodes],
          ).catch(() => ({ rows: [] as any[] }))
        : { rows: [] as any[] };

      const interventions = interventionsRes.rows.map((r) => ({
        competency_code: r.construct_key,
        competency_name: humanise(r.construct_key),
        action:          r.intervention_text,
        type:            'learning',
        gap_level:       gaps.find((g) => g.competency_code === r.construct_key)?.gap_level ?? 'medium',
      }));

      // ── Response ─────────────────────────────────────────────────────────
      res.json({
        ok: true,
        meta: {
          user_id:               userId,
          assessed_competencies: trends.length,
          has_trend_data:        trends.some((t) => t.has_sufficient_data),
          has_forecast_data:     forecasts.length > 0,
          mei_score:             meiRow ? Number(meiRow.composite_score) : null,
          generated_at:          new Date().toISOString(),
        },
        profile_context: {
          career_stage:  profileData?.careerStage   ?? null,
          target_role:   profileData?.targetRole     ?? null,
          current_role:  profileData?.currentRole    ?? null,
        },
        trends,
        forecasts,
        gap_priority:          gaps,
        readiness_projection:  readinessProjection,
        outcome_projection: {
          overall_readiness_pct: overallReadiness,
          outcome_label:         outcomeLabel,
          assessed_competencies: trends.length,
        },
        interventions,
        // Extended layers
        mei: meiRow
          ? {
              score:      Number(meiRow.composite_score),
              band:       meiRow.band,
              confidence: Number(meiRow.confidence),
              breakdown:  meiRow.breakdown,
            }
          : null,
        session: sessionId
          ? { patterns, composites }
          : null,
      });
    },
  );

  /* ─────────────────────────────────────────────────────────────────────────
   * GET /api/intelligence/wcl
   *
   * WCL1 → WCL2 → WCL3 chain assembled in one response:
   *   wcl1: pattern_trends   — per-pattern trend (direction/slope/confidence)
   *   wcl2: horizon_forecasts — 30/60/90-day projections from pattern trends
   *   wcl3: projections       — risk / growth / outcome derived from forecasts
   *
   * Requires:  ?sessionId=<uuid>  (resolves guest_email for cross-session chain)
   * Auth:      requireAuth (caller identity for audit; data keyed on email)
   * Degrades:  any absent layer returns { enabled:false } or [] — never throws.
   * ───────────────────────────────────────────────────────────────────────── */
  app.get(
    '/api/intelligence/wcl',
    requireAuth,
    async (req: Request, res: Response) => {
      const sessionId = String(req.query.sessionId ?? '').trim() || null;

      if (!sessionId) {
        return res.json({
          ok: true,
          enabled: false,
          reason: 'sessionId required for WCL chain',
          wcl1: { trends: [], sessions: 0, note: 'No sessionId' },
          wcl2: { enabled: false, forecasts: [], note: 'No sessionId' },
          wcl3: null,
        });
      }

      // Resolve guest_email from session (WCL chain is email-keyed)
      let email: string | null = null;
      try {
        const { rows } = await pool.query(
          `SELECT guest_email FROM capadex_sessions WHERE id = $1 LIMIT 1`,
          [sessionId],
        );
        email = rows[0]?.guest_email ? String(rows[0].guest_email).toLowerCase() : null;
      } catch {
        email = null;
      }

      if (!email) {
        return res.json({
          ok: true,
          enabled: false,
          reason: 'anonymous_session',
          wcl1: { trends: [], sessions: 0, note: 'Anonymous session — no cross-session chain' },
          wcl2: { enabled: false, forecasts: [], note: 'Anonymous session' },
          wcl3: null,
        });
      }

      // ── WCL1 + WCL2 in parallel (WCL3 derives from WCL2 result) ──────────
      const [wcl1, wcl2, leverTrends] = await Promise.all([
        computePatternTrends(pool, email).catch(() => ({
          user_email: email!, sessions: 0, trends: [], note: 'computation error',
        })),
        computeHorizonForecasts(pool, email).catch(() => ({
          enabled: false as const, user_email: email!, sessions_per_30d: 0,
          forecasts: [], note: 'computation error',
        })),
        // Stage direction from existing WCL1 lever trends (for WCL3 growth projection)
        computeUserTrends(pool, email).catch(() => ({
          user_email: email!, sessions: 0, trends: [], note: null,
        })),
      ]);

      const stageDir = leverTrends.trends.find((t) => t.lever === 'stage')?.direction ?? null;
      const wcl3     = deriveProjections(wcl2, stageDir);

      return res.json({
        ok:      true,
        enabled: wcl1.trends.length > 0,
        email,
        wcl1: {
          user_email:       wcl1.user_email,
          sessions:         wcl1.sessions,
          trends:           wcl1.trends,
          note:             wcl1.note,
        },
        wcl2: {
          enabled:          'enabled' in wcl2 ? wcl2.enabled : true,
          sessions_per_30d: wcl2.sessions_per_30d,
          forecasts:        wcl2.forecasts,
          note:             wcl2.note,
        },
        wcl3,
      });
    },
  );
}

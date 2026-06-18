/**
 * EI Intelligence Route — P-R6 World-Class Readiness
 *
 * GET /api/ei/intelligence   (requireAuth)
 *
 * Activates 7 shared intelligence engines for the Employability Index.
 * No EI-specific trend or forecast engine — every layer reuses an existing
 * shared service.  Additive, never-throws, degrades gracefully.
 *
 * Layers:
 *   forecast      — WCL2 horizon forecasts       (shared horizon-forecast service)
 *   outcomes      — WCL3 risk/growth projections  (shared wcl-projections service)
 *   comparative   — peer / percentile / cohort    (shared comparative-intelligence)
 *   benchmark     — included in comparative       (shared comparative-intelligence)
 *   cohort        — included in comparative       (shared comparative-intelligence)
 *   trajectory    — EI score trend projection     (WCL2 linear math on snapshot history)
 *   interventions — top-5 causal recommendations  (shared causal-recommendation-engine)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { computeHorizonForecasts }        from '../services/wc3/horizon-forecast';
import { computeUserTrends }             from '../services/wc3/trend-intelligence';
import { deriveProjections }             from '../services/wc3/wcl-projections';
import { resolveComparativeIntelligence } from '../services/comparative-intelligence';
import { generateCausalRecommendations }  from '../services/causal-recommendation-engine';

export const EI_INTELLIGENCE_VERSION = '1.0.0';

async function lookupEmail(pool: Pool, userId: string): Promise<string | null> {
  try {
    // Prefer email col; fall back to username if it looks like an email address
    // (dev users often have no email col set, but username = the login email).
    const { rows } = await pool.query(
      `SELECT COALESCE(
         NULLIF(TRIM(email), ''),
         CASE WHEN username LIKE '%@%' THEN username ELSE NULL END
       ) AS email
       FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return rows[0]?.email ? String(rows[0].email).toLowerCase() : null;
  } catch { return null; }
}

async function fetchCareerContext(
  pool: Pool,
  userId: string,
): Promise<{ seniority: string | null; domain: string | null; target_role: string | null; current_role: string | null }> {
  try {
    const { rows } = await pool.query(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (!rows.length) return { seniority: null, domain: null, target_role: null, current_role: null };
    const d = rows[0].data ?? {};
    return {
      seniority:    d.seniority_level   ?? d.current_seniority ?? null,
      domain:       d.domain            ?? d.target_domain     ?? null,
      target_role:  d.target_role       ?? d.target_occupation ?? null,
      current_role: d.current_role      ?? null,
    };
  } catch { return { seniority: null, domain: null, target_role: null, current_role: null }; }
}

async function fetchLatestBreakdown(
  pool: Pool,
  userId: string,
): Promise<Record<string, number> | null> {
  try {
    const { rows } = await pool.query(
      `SELECT breakdown FROM ei_snapshot_versions WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 1`,
      [userId],
    );
    if (!rows.length || !rows[0].breakdown) return null;
    const b = rows[0].breakdown as Record<string, unknown>;
    return {
      technicalScore:    Number(b.technicalScore    ?? 0),
      softScore:         Number(b.softScore         ?? 0),
      experienceScore:   Number(b.experienceScore   ?? 0),
      certScore:         Number(b.certScore         ?? 0),
      projectScore:      Number(b.projectScore      ?? 0),
      completenessScore: Number(b.completenessScore ?? 0),
    };
  } catch { return null; }
}

async function fetchSnapshotHistory(
  pool: Pool,
  userId: string,
): Promise<Array<{ date: string; score: number; band: string }>> {
  try {
    const { rows } = await pool.query(
      `SELECT snapshot_date::text AS date,
              capability_score::numeric AS score,
              band
         FROM ei_snapshot_versions
        WHERE user_id = $1
        ORDER BY snapshot_date ASC
        LIMIT 20`,
      [userId],
    );
    return rows.map((r: any) => ({
      date:  String(r.date),
      score: Number(r.score),
      band:  String(r.band ?? ''),
    }));
  } catch { return []; }
}

/**
 * Derive an EI score trajectory using the same linear-extrapolation math
 * as WCL2 — no new engine, just the same pattern applied to EI snapshot scores.
 */
function deriveEITrajectory(
  history: Array<{ date: string; score: number; band: string }>,
) {
  if (history.length < 2) {
    return {
      enabled:   false,
      reason:    history.length === 0 ? 'no_snapshots' : 'insufficient_snapshots',
      snapshots: history.length,
    };
  }

  const pts  = history.slice(-8);
  const n    = pts.length;
  const sumX = pts.reduce((s, _, i) => s + i, 0);
  const sumY = pts.reduce((s, p) => s + p.score, 0);
  const sumXY = pts.reduce((s, p, i) => s + i * p.score, 0);
  const sumX2 = pts.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;

  const latest    = pts[pts.length - 1];
  const direction = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
  const proj = (days: number) =>
    Math.min(100, Math.max(0, Math.round(latest.score + slope * days)));

  return {
    enabled:              true,
    current_score:        Math.round(latest.score),
    current_band:         latest.band,
    direction,
    slope_per_snapshot:   Math.round(slope * 100) / 100,
    projected:            { d30: proj(30), d60: proj(60), d90: proj(90) },
    confidence:           n >= 5 ? 'high' : n >= 3 ? 'moderate' : 'low',
    snapshots_used:       n,
    history:              pts,
  };
}

interface RegisterDeps {
  app:          Express;
  pool:         Pool;
  requireAuth:  RequestHandler;
}

export function registerEIIntelligenceRoute({ app, pool, requireAuth }: RegisterDeps) {

  // ── GET /api/ei/intelligence ───────────────────────────────────────────────
  app.get('/api/ei/intelligence', requireAuth, async (req: Request, res: Response) => {
    const isSuperAdmin = (req as any).user?.role === 'super_admin';
    const userId = (isSuperAdmin && req.query.adminUserId)
      ? String(req.query.adminUserId).trim()
      : String((req as any).user?.id ?? (req as any).user?.userId ?? '').trim();

    if (!userId) return res.status(401).json({ ok: false, error: 'auth required' });

    const t0 = Date.now();

    // ── Prerequisites ─────────────────────────────────────────────────────────
    const [email, history, careerCtx, latestBreakdown] = await Promise.all([
      lookupEmail(pool, userId),
      fetchSnapshotHistory(pool, userId),
      fetchCareerContext(pool, userId),
      fetchLatestBreakdown(pool, userId),
    ]);

    // ── Layer 6: trajectory (pure inline math, no external call) ─────────────
    const trajectory = deriveEITrajectory(history);

    // ── Layers 1+2 (Forecast + Outcomes) and 3+4+5 (Comparative / Benchmark /
    //    Cohort) and 7 (Interventions) all run in parallel ─────────────────────
    const [wclResult, stageResult, comparativeResult, causalResult] = await Promise.allSettled([

      // Forecast (WCL2 — shared horizon-forecast)
      email
        ? computeHorizonForecasts(pool, email)
        : Promise.resolve({ enabled: false as const, user_email: '', sessions_per_30d: 0, forecasts: [] as any[], note: 'no_registered_email' }),

      // Stage direction for WCL3 growth axis (shared trend-intelligence)
      email
        ? computeUserTrends(pool, email).then(t => {
            const stageTrend = (t.trends ?? []).find((x: any) => x.lever === 'stage');
            return stageTrend?.direction ?? null;
          })
        : Promise.resolve(null as string | null),

      // Comparative + Benchmark + Cohort (shared comparative-intelligence)
      resolveComparativeIntelligence(pool, userId),

      // Interventions (shared causal-recommendation-engine)
      generateCausalRecommendations(pool, { user_id: userId, limit: 5 }),
    ]);

    // ── Unwrap results ────────────────────────────────────────────────────────
    const wcl2       = wclResult.status        === 'fulfilled' ? wclResult.value        : { enabled: false, forecasts: [], sessions_per_30d: 0, note: 'error' };
    const stageDir   = stageResult.status      === 'fulfilled' ? stageResult.value      : null;
    const comparative = comparativeResult.status === 'fulfilled' ? comparativeResult.value : null;
    const causal     = causalResult.status      === 'fulfilled' ? causalResult.value      : null;

    // WCL3 derives from WCL2 — same call pattern as the /api/intelligence/wcl route
    const wcl3 = (() => {
      try {
        if ((wcl2 as any).enabled === false) return null;
        if (!((wcl2 as any).forecasts?.length)) return null;
        return deriveProjections(wcl2 as any, stageDir);
      } catch { return null; }
    })();

    // ── Compose response ──────────────────────────────────────────────────────
    const forecasts = (wcl2 as any).forecasts ?? [];

    // Shape CausalRecommendation → EIIntervention (match frontend interface exactly)
    const recs = (causal?.recommendations ?? []).slice(0, 5).map((r: any) => ({
      id:          r.id ?? `rec_${Math.random().toString(36).slice(2, 9)}`,
      title:       r.intervention_title ?? r.title ?? 'Development Action',
      description: r.rationale?.base_effectiveness ?? r.description ?? null,
      action_type: r.intervention_kind ?? r.action_type ?? 'unknown',
      causal_score: r.causal_score ?? 0,
      expected_ei_lift: r.expected_ei_lift_lower != null
        ? { low: Number(r.expected_ei_lift_lower), high: Number(r.expected_ei_lift_upper) }
        : r.expected_ei_lift != null
        ? { low: Number(r.expected_ei_lift), high: Number(r.expected_ei_lift) }
        : null,
      effort_hours:    r.effort_hours    ?? null,
      competency_name: r.competency_name ?? null,
      is_ready_now:    r.is_ready_now    ?? true,
    }));

    res.json({
      ok:      true,
      version: EI_INTELLIGENCE_VERSION,
      user_id: userId,

      // Layer 1 — Forecast (WCL2)
      forecast: {
        enabled:          (wcl2 as any).enabled !== false,
        sessions_per_30d: (wcl2 as any).sessions_per_30d ?? 0,
        forecasts,
        note:             (wcl2 as any).note ?? null,
      },

      // Layer 2 — Outcomes (WCL3)
      outcomes: wcl3,

      // Layers 3+4+5 — Comparative / Benchmark / Cohort
      comparative,

      // Layer 6 — Trajectory (EI score trend projection + dimension breakdown + career context)
      trajectory: {
        ...(trajectory as any),
        breakdown:      latestBreakdown,
        career_context: careerCtx,
      },

      // Layer 7 — Interventions (causal recs, shaped to EIIntervention interface)
      interventions: recs,
      intervention_meta: causal
        ? {
            sequence_warnings: causal.sequence_warnings ?? [],
            versions:          causal.versions          ?? {},
          }
        : null,

      meta: {
        has_forecast:      forecasts.length > 0,
        has_outcomes:      wcl3 !== null,
        has_comparative:   comparative !== null,
        has_trajectory:    (trajectory as any).enabled === true,
        has_interventions: recs.length > 0,
        has_report:        history.length >= 1,
        snapshot_count:    history.length,
        computation_ms:    Date.now() - t0,
        generated_at:      new Date().toISOString(),
      },
    });
  });

  // ── GET /api/ei/intelligence/report-summary ────────────────────────────────
  // Generates a structured narrative EI Intelligence Report from existing layers.
  // No new engine — composes trajectory + comparative + career context.
  app.get('/api/ei/intelligence/report-summary', requireAuth, async (req: Request, res: Response) => {
    const userId = String(
      (req as any).user?.id ?? (req as any).user?.userId ?? '',
    ).trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'auth required' });

    const t0 = Date.now();
    const [email, history, careerCtx] = await Promise.all([
      lookupEmail(pool, userId),
      fetchSnapshotHistory(pool, userId),
      fetchCareerContext(pool, userId),
    ]);

    const trajectory   = deriveEITrajectory(history);
    const comparative  = await resolveComparativeIntelligence(pool, userId).catch(() => null);

    const sections: Array<{ id: string; title: string; type: string; content: string; data?: unknown }> = [];

    // § 1 — EI Position Summary
    const currentScore = (trajectory as any).enabled ? (trajectory as any).current_score : null;
    const currentBand  = (trajectory as any).enabled ? (trajectory as any).current_band  : null;
    sections.push({
      id: 'position', title: 'Employability Position', type: 'summary',
      content: currentScore != null
        ? `Your current Employability Index score is ${currentScore} (${currentBand ?? 'assessed'}). ` +
          `This reflects your readiness profile across ${history.length} EI measurement${history.length === 1 ? '' : 's'}.`
        : 'Your EI position is being established. Complete an assessment to see your score.',
      data: { score: currentScore, band: currentBand, snapshots: history.length },
    });

    // § 2 — Score Trajectory
    if ((trajectory as any).enabled) {
      const dir   = (trajectory as any).direction   as string;
      const slope = (trajectory as any).slope_per_snapshot as number;
      const proj  = (trajectory as any).projected   as { d30: number; d60: number; d90: number } | undefined;
      sections.push({
        id: 'trajectory', title: 'Score Trajectory', type: 'trend',
        content: `Your EI score is ${dir === 'improving' ? 'on an upward trend' : dir === 'declining' ? 'showing a downward trend' : 'stable'}, ` +
          `averaging ${slope >= 0 ? '+' : ''}${slope?.toFixed(1)} points per assessment. ` +
          (proj ? `At this rate you are projected to reach ${proj.d30} in 30 days and ${proj.d90} in 90 days.` : ''),
        data: trajectory,
      });
    }

    // § 3 — Peer Benchmarking
    const pc = comparative?.peer_comparison;
    if (pc && !pc.suppressed && pc.user_ei_score != null) {
      const pct = comparative?.percentile_rank;
      sections.push({
        id: 'peer', title: 'Peer Benchmarking', type: 'comparison',
        content: `Compared to ${pc.cohort_size} peers, your EI score of ${pc.user_ei_score} ` +
          `places you ${pc.relative_position.replace(/_/g, ' ')} the cohort average of ${pc.cohort_avg_score}. ` +
          (pct?.percentile != null ? `You are at the ${pct.percentile}th percentile.` : ''),
        data: { peer_comparison: pc, percentile: pct },
      });
    }

    // § 4 — Career Context
    if (careerCtx.current_role || careerCtx.target_role || careerCtx.seniority) {
      sections.push({
        id: 'career', title: 'Career Path Context', type: 'context',
        content: [
          careerCtx.current_role ? `Current role: ${careerCtx.current_role}.` : null,
          careerCtx.target_role  ? `Target role: ${careerCtx.target_role}.`   : null,
          careerCtx.seniority    ? `Seniority: ${careerCtx.seniority}.`        : null,
          careerCtx.domain       ? `Domain: ${careerCtx.domain}.`              : null,
        ].filter(Boolean).join(' '),
        data: careerCtx,
      });
    }

    // § 5 — Development Guidance (structural summary, not personalised recs)
    if ((comparative?.competency_benchmarks?.length ?? 0) > 0) {
      const above = comparative!.competency_benchmarks.filter(b => b.above_avg).length;
      const total = comparative!.competency_benchmarks.length;
      sections.push({
        id: 'competency', title: 'Competency Position', type: 'benchmarks',
        content: `Across ${total} benchmarked competencies, you are above the cohort average on ${above}. ` +
          `Focus on the areas below average for the fastest EI score gains.`,
        data: comparative!.competency_benchmarks.slice(0, 5),
      });
    }

    // Persist this report generation to rf_generated_reports (non-blocking, best-effort).
    // rf_generated_reports schema is guaranteed by the Report Factory schema init.
    pool.query(
      `INSERT INTO rf_generated_reports
         (user_id, report_type, status, data_snapshot, generated_content, insights, completed_at)
       VALUES ($1, 'ei_intelligence', 'completed', $2::jsonb, $3::jsonb, $4::jsonb, NOW())`,
      [
        userId,
        JSON.stringify({
          snapshot_count:      history.length,
          trajectory_enabled:  (trajectory as any).enabled === true,
        }),
        JSON.stringify({ sections }),
        JSON.stringify(sections.map(s => ({ id: s.id, title: s.title }))),
      ]
    ).catch(() => {});

    res.json({
      ok:      true,
      version: EI_INTELLIGENCE_VERSION,
      user_id: userId,
      report: {
        title:        'Employability Intelligence Report',
        generated_at: new Date().toISOString(),
        sections,
        meta: {
          snapshot_count:      history.length,
          trajectory_enabled:  (trajectory as any).enabled === true,
          peer_benchmarked:    !!(pc && !pc.suppressed),
          career_context:      !!(careerCtx.current_role || careerCtx.target_role),
          has_email:           !!email,
          computation_ms:      Date.now() - t0,
        },
      },
    });
  });

  // ── GET /api/ei/intelligence/report-history ────────────────────────────────
  // Returns the last 10 archived EI Intelligence Report generations for the user
  // (persisted to rf_generated_reports by the report-summary route above).
  app.get('/api/ei/intelligence/report-history', requireAuth, async (req: Request, res: Response) => {
    const isSuperAdmin = (req as any).user?.role === 'super_admin';
    const userId = (isSuperAdmin && req.query.adminUserId)
      ? String(req.query.adminUserId).trim()
      : String((req as any).user?.id ?? (req as any).user?.userId ?? '').trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'auth required' });

    const { rows } = await pool.query(
      `SELECT id, report_uuid, created_at, generated_content, data_snapshot
         FROM rf_generated_reports
        WHERE user_id = $1
          AND report_type = 'ei_intelligence'
          AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 10`,
      [userId]
    ).catch(() => ({ rows: [] as any[] }));

    res.json({
      ok: true,
      history: rows.map((r: any) => ({
        id:             r.id,
        report_uuid:    r.report_uuid,
        created_at:     r.created_at,
        section_count:  (r.generated_content?.sections ?? []).length,
        section_titles: (r.generated_content?.sections ?? []).slice(0, 3).map((s: any) => s.title),
        snapshot_count: r.data_snapshot?.snapshot_count ?? 0,
      })),
    });
  });
}

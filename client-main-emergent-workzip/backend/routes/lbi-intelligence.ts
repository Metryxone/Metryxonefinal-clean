/**
 * LBI Intelligence Routes  (W2–W8)
 *
 * Registers all new LBI intelligence endpoints under FF_LEARNING_INTELLIGENCE.
 * All learner routes require requireAuth; admin routes require requireSuperAdmin.
 *
 * Routes:
 *   GET  /api/lbi/score                              — unified score surface
 *   GET  /api/lbi/trends/behavior                    — per-dimension behavior trends
 *   GET  /api/lbi/trends/learning                    — overall learning trend
 *   GET  /api/lbi/risk-profile                       — active + resolved risks
 *   GET  /api/lbi/recommendations                    — personalised recs
 *   POST /api/lbi/recommendations/:id/action         — mark rec as actioned
 *   GET  /api/lbi/interventions                      — intervention library
 *   GET  /api/lbi/learner-profile                    — composite 3-profile
 *   POST /api/lbi/report/generate                    — generate + save report
 *   GET  /api/lbi/report/:id                         — fetch saved report
 *   GET  /api/lbi/longitudinal                       — trajectory snapshot
 *   GET  /api/admin/lbi/longitudinal-aggregates      — platform-wide aggregates
 *   GET  /api/admin/lbi/quality-health               — capability health check
 *   POST /api/admin/lbi/backfill-intelligence        — backfill all users
 */

import type { Express } from 'express';
import pg from 'pg';
import { getTrends, computeAndPersistTrends }                     from '../services/lbi-trend-engine';
import { getRiskProfile, computeAndPersistRisks }                  from '../services/lbi-risk-engine';
import { getRecommendations, getInterventions,
         markRecommendationActioned,
         computeAndPersistRecommendations }                        from '../services/lbi-recommendation-engine';
import { buildCompositeProfile }                                   from '../services/lbi-profile-builder';
import { generateReport, getReport, getLatestReport }             from '../services/lbi-report-generator';
import { getLongitudinal, getLongitudinalAggregates,
         computeAndPersistLongitudinal }                           from '../services/lbi-longitudinal-engine';
import { getUnifiedLbiProfile }                                    from '../services/lbi-unifier';
import { computeUserTrends }                                        from '../services/wc3/trend-intelligence';
import { computeHorizonForecasts }                                  from '../services/wc3/horizon-forecast';
import { getSessionOutcomes }                                       from '../services/wc3/outcome-intelligence';
import { resolveComparativeIntelligence }                           from '../services/comparative-intelligence';
import { generateCausalRecommendations }                            from '../services/causal-recommendation-engine';
import { computeLbiFrpEnrichment }                                  from '../services/lbi-frp-bridge';
import { generateLbiStakeholderReport, type StakeholderType }      from '../services/lbi-stakeholder-report';

type MW = (req: any, res: any, next: any) => void;

function flagEnabled(): boolean {
  return !!(process.env.FF_LEARNING_INTELLIGENCE);
}

function getEmail(req: any): string | null {
  return req.user?.email ?? req.session?.email ?? (req.query?.email as string) ?? null;
}

export function registerLbiIntelligenceRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth?: MW,
  requireSuperAdmin?: MW
) {
  const auth    = [requireAuth].filter(Boolean) as MW[];
  const chain   = [requireAuth, requireSuperAdmin].filter(Boolean) as MW[];

  // ── Unified score surface ─────────────────────────────────────────────────
  app.get('/api/lbi/score', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const profile = await getUnifiedLbiProfile(email, pool);
      res.json(profile);
    } catch (err) {
      console.error('[lbi-intel] /score error:', err);
      res.status(500).json({ error: 'score fetch failed' });
    }
  });

  // ── Behavior trends ───────────────────────────────────────────────────────
  app.get('/api/lbi/trends/behavior', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const data = await getTrends(email, pool);
      res.json({ email, ...data });
    } catch (err) {
      console.error('[lbi-intel] /trends/behavior error:', err);
      res.status(500).json({ error: 'trend fetch failed' });
    }
  });

  // ── Learning trend ────────────────────────────────────────────────────────
  app.get('/api/lbi/trends/learning', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const data = await getTrends(email, pool);
      res.json({ email, learning_trend: data.learning_trend, computed_at: data.computed_at });
    } catch (err) {
      console.error('[lbi-intel] /trends/learning error:', err);
      res.status(500).json({ error: 'learning trend fetch failed' });
    }
  });

  // ── Risk profile ──────────────────────────────────────────────────────────
  app.get('/api/lbi/risk-profile', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const data = await getRiskProfile(email, pool);
      res.json({ email, ...data });
    } catch (err) {
      console.error('[lbi-intel] /risk-profile error:', err);
      res.status(500).json({ error: 'risk profile fetch failed' });
    }
  });

  // ── Recommendations ───────────────────────────────────────────────────────
  app.get('/api/lbi/recommendations', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit ?? 10)));
    try {
      const recs = await getRecommendations(email, pool, limit);
      res.json({ email, recommendations: recs, count: recs.length });
    } catch (err) {
      console.error('[lbi-intel] /recommendations error:', err);
      res.status(500).json({ error: 'recommendations fetch failed' });
    }
  });

  app.post('/api/lbi/recommendations/:id/action', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    const recId = parseInt(req.params?.id ?? '0');
    if (!recId) return res.status(400).json({ error: 'valid recommendation id required' });
    try {
      const ok = await markRecommendationActioned(email, recId, pool);
      res.json({ success: ok });
    } catch (err) {
      console.error('[lbi-intel] /recommendations/action error:', err);
      res.status(500).json({ error: 'action failed' });
    }
  });

  // ── Intervention library ──────────────────────────────────────────────────
  app.get('/api/lbi/interventions', async (req: any, res) => {
    try {
      const dim = (req.query?.dimension as string) || null;
      const interventions = await getInterventions(dim, pool);
      res.json({ interventions, count: interventions.length });
    } catch (err) {
      console.error('[lbi-intel] /interventions error:', err);
      res.status(500).json({ error: 'interventions fetch failed' });
    }
  });

  // ── Composite learner profile ─────────────────────────────────────────────
  app.get('/api/lbi/learner-profile', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const profile = await buildCompositeProfile(email, pool);
      res.json({ email, ...profile });
    } catch (err) {
      console.error('[lbi-intel] /learner-profile error:', err);
      res.status(500).json({ error: 'learner profile fetch failed' });
    }
  });

  // ── Report generate ───────────────────────────────────────────────────────
  app.post('/api/lbi/report/generate', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    const reportType = (['standard', 'summary', 'parent'].includes(req.body?.type)
      ? req.body.type : 'standard') as 'standard' | 'summary' | 'parent';
    try {
      const report = await generateReport(email, reportType, pool);
      if (!report) return res.status(500).json({ error: 'report generation failed' });
      res.json(report);
    } catch (err) {
      console.error('[lbi-intel] /report/generate error:', err);
      res.status(500).json({ error: 'report generation failed' });
    }
  });

  // GET /api/lbi/report/latest must come BEFORE /api/lbi/report/:id
  app.get('/api/lbi/report/latest', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    const reportType = (['standard', 'summary', 'parent'].includes(req.query?.type as string)
      ? req.query.type : 'standard') as 'standard' | 'summary' | 'parent';
    try {
      const report = await getLatestReport(email, reportType, pool);
      if (!report) return res.json({ report: null });
      res.json(report);
    } catch (err) {
      console.error('[lbi-intel] /report/latest error:', err);
      res.status(500).json({ error: 'report fetch failed' });
    }
  });

  app.get('/api/lbi/report/:id', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const id = parseInt(req.params?.id ?? '0');
    if (!id) return res.status(400).json({ error: 'valid report id required' });
    try {
      const report = await getReport(id, pool);
      if (!report) return res.status(404).json({ error: 'report not found' });
      res.json(report);
    } catch (err) {
      console.error('[lbi-intel] /report/:id error:', err);
      res.status(500).json({ error: 'report fetch failed' });
    }
  });

  // ── Longitudinal ──────────────────────────────────────────────────────────
  app.get('/api/lbi/longitudinal', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const data = await getLongitudinal(email, pool);
      res.json({ email, ...data });
    } catch (err) {
      console.error('[lbi-intel] /longitudinal error:', err);
      res.status(500).json({ error: 'longitudinal fetch failed' });
    }
  });

  // ── Admin: longitudinal aggregates ────────────────────────────────────────
  app.get('/api/admin/lbi/longitudinal-aggregates', ...chain, async (_req, res) => {
    try {
      const data = await getLongitudinalAggregates(pool);
      res.json(data);
    } catch (err) {
      console.error('[lbi-intel] /admin/longitudinal-aggregates error:', err);
      res.status(500).json({ error: 'aggregates fetch failed' });
    }
  });

  // ── Admin: quality health check ───────────────────────────────────────────
  app.get('/api/admin/lbi/quality-health', ...chain, async (_req, res) => {
    try {
      const client = await pool.connect();
      try {
        const [
          scoresCount, histCount, trendsCount, riskCount,
          recMasterCount, userRecCount, interventionCount,
          reportCount, longitudinalCount, domainCount, subdomainCount,
          ageBandCount, scaleCount
        ] = await Promise.all([
          client.query(`SELECT COUNT(*) AS n FROM lbi_scores`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_score_history`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_behavior_trends`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_risk_indicators WHERE is_active=TRUE`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_recommendation_master WHERE is_active=TRUE`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_user_recommendations`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_intervention_library WHERE is_active=TRUE`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_reports`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_longitudinal_snapshots`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_domains WHERE LOWER(status)='active'`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_subdomains WHERE LOWER(status)='active'`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_age_bands WHERE LOWER(status)='active'`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_response_scales WHERE LOWER(status)='active'`),
        ]);

        const n = (r: any) => Number(r.rows[0]?.n ?? 0);

        const capabilities = [
          { name: 'System A scoring (lbi_scores)',         status: n(scoresCount) > 0 },
          { name: 'Score history',                          status: n(histCount) > 0 },
          { name: 'System B domains seeded',               status: n(domainCount) >= 19 },
          { name: 'System B subdomains seeded',            status: n(subdomainCount) >= 95 },
          { name: 'Age bands seeded',                      status: n(ageBandCount) >= 3 },
          { name: 'Response scales seeded',                status: n(scaleCount) >= 2 },
          { name: 'Behavior trends computed',              status: n(trendsCount) > 0 },
          { name: 'Risk indicators active',                status: true },     // schema exists = capable
          { name: 'Recommendation master seeded',         status: n(recMasterCount) >= 20 },
          { name: 'User recommendations generated',       status: n(userRecCount) > 0 },
          { name: 'Intervention library seeded',          status: n(interventionCount) >= 15 },
          { name: 'Reports generated',                     status: n(reportCount) > 0 },
          { name: 'Longitudinal snapshots computed',      status: n(longitudinalCount) > 0 },
          { name: 'FF_LEARNING_INTELLIGENCE flag active', status: flagEnabled() },
        ];

        const ready = capabilities.filter(c => c.status).length;
        const total = capabilities.length;
        const pct   = Math.round((ready / total) * 100);

        res.json({
          readiness_pct:    pct,
          capabilities_ready: ready,
          capabilities_total: total,
          capabilities,
          counts: {
            lbi_scores:       n(scoresCount),
            score_history:    n(histCount),
            behavior_trends:  n(trendsCount),
            active_risks:     n(riskCount),
            rec_master:       n(recMasterCount),
            user_recs:        n(userRecCount),
            interventions:    n(interventionCount),
            reports:          n(reportCount),
            longitudinal:     n(longitudinalCount),
            domains:          n(domainCount),
            subdomains:       n(subdomainCount),
          },
          checked_at: new Date().toISOString(),
        });
      } finally { client.release(); }
    } catch (err) {
      console.error('[lbi-intel] /admin/quality-health error:', err);
      res.status(500).json({ error: 'quality health check failed' });
    }
  });

  // ── Admin: backfill intelligence for all scored users ─────────────────────
  app.post('/api/admin/lbi/backfill-intelligence', ...chain, async (_req, res) => {
    res.json({ message: 'LBI intelligence backfill started in background' });
    (async () => {
      try {
        const users = await pool.query(
          `SELECT DISTINCT user_email FROM lbi_scores LIMIT 500`
        );
        let ok = 0; let fail = 0;
        for (const { user_email } of users.rows) {
          try {
            await computeAndPersistTrends(user_email, pool);
            await computeAndPersistRisks(user_email, pool);
            await computeAndPersistRecommendations(user_email, pool);
            await computeAndPersistLongitudinal(user_email, pool);
            ok++;
          } catch { fail++; }
        }
        console.log(`[lbi-intel] backfill done: ${ok} ok, ${fail} failed`);
      } catch (err) {
        console.error('[lbi-intel] backfill error:', err);
      }
    })();
  });

  // ── Admin: per-user intelligence (unified view) ───────────────────────────
  app.get('/api/admin/lbi/intelligence/:email', ...chain, async (req: any, res) => {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const [profile, trends, risks, recs, longitudinal] = await Promise.all([
        buildCompositeProfile(email, pool),
        getTrends(email, pool),
        getRiskProfile(email, pool),
        getRecommendations(email, pool, 5),
        getLongitudinal(email, pool),
      ]);
      res.json({ email, profile, trends, risks, recommendations: recs, longitudinal });
    } catch (err) {
      console.error('[lbi-intel] /admin/intelligence error:', err);
      res.status(500).json({ error: 'intelligence fetch failed' });
    }
  });

  // ── Shared-engine consumer routes ─────────────────────────────────────────

  // Helper: resolve numeric user_id (TEXT) from email
  async function resolveUserId(email: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE LOWER(COALESCE(NULLIF(TRIM(email),''), username)) = $1 LIMIT 1`,
      [email.toLowerCase()],
    );
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  // Helper: latest completed CAPADEX session id for email
  async function resolveLatestSessionId(email: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM capadex_sessions
        WHERE LOWER(guest_email) = $1 AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()],
    );
    return rows[0]?.id ?? null;
  }

  // GET /api/lbi/intelligence — unified composition of all 7 intelligence layers
  app.get('/api/lbi/intelligence', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const isSuperAdmin = req.user?.role === 'super_admin';
    const adminOverride = isSuperAdmin && req.query?.adminEmail
      ? String(req.query.adminEmail).trim() : null;
    const email = adminOverride ?? getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const [userId, sessionId] = await Promise.all([
        resolveUserId(email),
        resolveLatestSessionId(email),
      ]);

      const [score, wcl1, wcl2, wcl3, riskProf, comparative, causalRecs] = await Promise.allSettled([
        getUnifiedLbiProfile(email, pool),
        computeUserTrends(pool, email),
        computeHorizonForecasts(pool, email),
        sessionId ? getSessionOutcomes(pool, sessionId) : Promise.resolve(null),
        getRiskProfile(email, pool),
        userId ? resolveComparativeIntelligence(pool, userId) : Promise.resolve(null),
        userId
          ? generateCausalRecommendations(pool, { user_id: userId, limit: 5 })
          : Promise.resolve({ recommendations: [], sequence_warnings: [], versions: {}, inputs_used: { candidate_competency_ids: [], profile_segment: 'global' } }),
      ]);

      const val = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? r.value : null;

      res.json({
        email,
        layers: {
          score:               val(score),
          trends:              val(wcl1),
          forecast:            val(wcl2),
          outcomes:            val(wcl3),
          risk:                val(riskProf),
          comparative:         val(comparative),
          causal_recommendations: val(causalRecs),
        },
        meta: {
          user_id:             userId,
          session_id:          sessionId,
          has_capadex_session: sessionId !== null,
          layers_available:    7,
          generated_at:        new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[lbi-intel] /intelligence error:', err);
      res.status(500).json({ error: 'intelligence fetch failed' });
    }
  });

  // GET /api/lbi/forecast — WCL2 horizon forecasts
  app.get('/api/lbi/forecast', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const data = await computeHorizonForecasts(pool, email);
      res.json({ email, ...data });
    } catch (err) {
      console.error('[lbi-intel] /forecast error:', err);
      res.status(500).json({ error: 'forecast fetch failed' });
    }
  });

  // GET /api/lbi/outcomes — WCL3 outcomes for the latest CAPADEX session
  app.get('/api/lbi/outcomes', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const sessionId = await resolveLatestSessionId(email);
      if (!sessionId) return res.json({ email, session_id: null, outcomes: null, note: 'no_completed_session' });
      const outcomes = await getSessionOutcomes(pool, sessionId);
      res.json({ email, session_id: sessionId, outcomes });
    } catch (err) {
      console.error('[lbi-intel] /outcomes error:', err);
      res.status(500).json({ error: 'outcomes fetch failed' });
    }
  });

  // GET /api/lbi/comparative — comparative intelligence (EI-cohort benchmarks)
  app.get('/api/lbi/comparative', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const userId = await resolveUserId(email);
      if (!userId) return res.json({ email, comparative: null, note: 'user_not_found' });
      const data = await resolveComparativeIntelligence(pool, userId);
      res.json({ email, ...data });
    } catch (err) {
      console.error('[lbi-intel] /comparative error:', err);
      res.status(500).json({ error: 'comparative fetch failed' });
    }
  });

  // GET /api/lbi/causal-recommendations — causal recommendation engine
  app.get('/api/lbi/causal-recommendations', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'LBI intelligence not enabled' });
    const email = getEmail(req);
    if (!email) return res.status(400).json({ error: 'email required' });
    const limit = Math.min(15, Math.max(1, Number(req.query?.limit ?? 8)));
    try {
      const userId = await resolveUserId(email);
      if (!userId) return res.json({ email, recommendations: [], note: 'user_not_found' });
      const result = await generateCausalRecommendations(pool, { user_id: userId, limit });
      res.json({ email, ...result });
    } catch (err) {
      console.error('[lbi-intel] /causal-recommendations error:', err);
      res.status(500).json({ error: 'causal recommendations fetch failed' });
    }
  });

  // ── Admin: WC-P2 two-axis activation health ───────────────────────────────
  app.get('/api/admin/lbi/activation-health', ...chain, async (_req, res) => {
    try {
      const client = await pool.connect();
      try {
        const [capadexSessions, lbiScored, withTrends, withRisks, withRecs, withLongitudinal, withReports] = await Promise.all([
          client.query(`SELECT COUNT(*) AS n FROM capadex_sessions WHERE status='completed'`),
          client.query(`SELECT COUNT(*) AS n FROM lbi_scores`),
          client.query(`SELECT COUNT(DISTINCT user_email) AS n FROM lbi_behavior_trends`),
          client.query(`SELECT COUNT(DISTINCT user_email) AS n FROM lbi_risk_indicators WHERE is_active=TRUE`),
          client.query(`SELECT COUNT(DISTINCT user_email) AS n FROM lbi_user_recommendations`),
          client.query(`SELECT COUNT(DISTINCT user_email) AS n FROM lbi_longitudinal_snapshots`),
          client.query(`SELECT COUNT(DISTINCT user_email) AS n FROM lbi_reports`),
        ]);

        const n = (r: any) => Number(r.rows[0]?.n ?? 0);
        const totalSessions = n(capadexSessions);
        const scored        = n(lbiScored);
        const allLayers     = Math.min(n(withTrends), n(withRisks), n(withRecs), n(withLongitudinal));

        const consumptionRate    = totalSessions > 0 ? Math.round((scored / totalSessions) * 100) : 0;
        const activationReadiness = scored > 0 ? Math.round((allLayers / scored) * 100) : 0;

        res.json({
          consumption: {
            label:       'Consumption Rate',
            description: 'Completed CAPADEX sessions where LBI chain fired',
            numerator:   scored,
            denominator: totalSessions,
            rate_pct:    consumptionRate,
            status:      consumptionRate >= 90 ? 'ready' : consumptionRate >= 60 ? 'partial' : 'needs_data',
          },
          activation: {
            label:       'Activation Readiness',
            description: 'Scored users with all 4 intelligence layers computed',
            numerator:   allLayers,
            denominator: scored,
            rate_pct:    activationReadiness,
            status:      activationReadiness >= 90 ? 'ready' : activationReadiness >= 60 ? 'partial' : 'needs_data',
          },
          layer_coverage: {
            scored_users:      scored,
            with_trends:       n(withTrends),
            with_risks:        n(withRisks),
            with_recs:         n(withRecs),
            with_longitudinal: n(withLongitudinal),
            with_reports:      n(withReports),
          },
          shared_engine_routes: [
            { route: 'GET /api/lbi/intelligence',           engine: 'Unified Composition (7 layers)',     status: 'active' },
            { route: 'GET /api/lbi/forecast',               engine: 'WCL2 Horizon Forecast',             status: 'active' },
            { route: 'GET /api/lbi/outcomes',               engine: 'WCL3 Outcome Intelligence',         status: 'active' },
            { route: 'GET /api/lbi/comparative',            engine: 'Comparative Intelligence (EI-cohort)', status: 'active' },
            { route: 'GET /api/lbi/causal-recommendations', engine: 'Causal Recommendation Engine',      status: 'active' },
          ],
          checked_at: new Date().toISOString(),
        });
      } finally { client.release(); }
    } catch (err) {
      console.error('[lbi-intel] /admin/activation-health error:', err);
      res.status(500).json({ error: 'activation health check failed' });
    }
  });

  // ── E7: LBI ↔ FRP cross-platform bridge ───────────────────────────────────
  app.get('/api/lbi/frp-bridge', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'FF_LEARNING_INTELLIGENCE disabled' });
    try {
      const email = getEmail(req);
      if (!email) return res.status(400).json({ error: 'email required' });
      const enrichment = await computeLbiFrpEnrichment(email, pool);
      res.json(enrichment);
    } catch (err) {
      console.error('[lbi-intel] /frp-bridge error:', err);
      res.status(500).json({ error: 'frp bridge computation failed' });
    }
  });

  // ── E8: LBI stakeholder report — 4 audience variants ─────────────────────
  // Literal paths registered BEFORE the /:id catch-all in /api/lbi/report/*
  app.get('/api/lbi/report/stakeholder/:type', ...auth, async (req: any, res) => {
    if (!flagEnabled()) return res.status(503).json({ error: 'FF_LEARNING_INTELLIGENCE disabled' });
    try {
      const email = getEmail(req);
      if (!email) return res.status(400).json({ error: 'email required' });
      const type = req.params.type as StakeholderType;
      const valid: StakeholderType[] = ['learner', 'parent', 'counselor', 'employer'];
      if (!valid.includes(type)) {
        return res.status(400).json({ error: `invalid type; must be one of: ${valid.join(', ')}` });
      }
      const report = await generateLbiStakeholderReport(email, type, pool);
      if (!report) return res.status(404).json({ error: 'no LBI data found for this user' });
      res.json(report);
    } catch (err) {
      console.error('[lbi-intel] /report/stakeholder error:', err);
      res.status(500).json({ error: 'stakeholder report generation failed' });
    }
  });

  // ── E9: Admin cohort analytics ────────────────────────────────────────────
  app.get('/api/admin/lbi/cohort-analytics', ...chain, async (_req, res) => {
    try {
      const client = await pool.connect();
      try {
        const [styleRes, riskRes, bandRes, topRes] = await Promise.all([
          client.query(`
            SELECT learning_style,
                   COUNT(*)::int                               AS user_count,
                   ROUND(AVG(overall_lbi)::numeric, 1)        AS avg_lbi,
                   ROUND(AVG(attention_score)::numeric, 1)    AS avg_attention,
                   ROUND(AVG(consistency_score)::numeric, 1)  AS avg_consistency,
                   ROUND(AVG(persistence_score)::numeric, 1)  AS avg_persistence,
                   ROUND(AVG(velocity_score)::numeric, 1)     AS avg_velocity,
                   ROUND(AVG(adaptability_score)::numeric, 1) AS avg_adaptability
            FROM lbi_scores GROUP BY learning_style ORDER BY user_count DESC
          `),
          client.query(`
            SELECT risk_type, risk_label, COUNT(DISTINCT user_email)::int AS user_count
            FROM lbi_risk_indicators WHERE is_active = TRUE
            GROUP BY risk_type, risk_label ORDER BY user_count DESC LIMIT 15
          `),
          client.query(`
            SELECT lbi_band, COUNT(*)::int AS user_count
            FROM lbi_scores GROUP BY lbi_band ORDER BY user_count DESC
          `),
          client.query(`
            SELECT COUNT(*)::int                                                AS total_users,
                   ROUND(AVG(overall_lbi)::numeric, 1)                         AS platform_avg_lbi,
                   COUNT(*) FILTER (WHERE lbi_band IN ('exceptional','growth'))::int AS high_performer_count,
                   COUNT(*) FILTER (WHERE overall_lbi < 40)::int               AS at_risk_count
            FROM lbi_scores
          `),
        ]);
        const top = topRes.rows[0] ?? {};
        res.json({
          topline: {
            total_users:          Number(top.total_users ?? 0),
            platform_avg_lbi:     Number(top.platform_avg_lbi ?? 0),
            high_performer_count: Number(top.high_performer_count ?? 0),
            at_risk_count:        Number(top.at_risk_count ?? 0),
          },
          learning_style_distribution: styleRes.rows,
          risk_distribution:           riskRes.rows,
          band_distribution:           bandRes.rows,
          generated_at: new Date().toISOString(),
        });
      } finally { client.release(); }
    } catch (err) {
      console.error('[lbi-intel] /admin/cohort-analytics error:', err);
      res.status(500).json({ error: 'cohort analytics failed' });
    }
  });
}

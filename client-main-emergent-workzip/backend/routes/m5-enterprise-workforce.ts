/**
 * Phase 5 — Enterprise Workforce Intelligence + AI Coaching + Executive Decision Intelligence
 *
 * Mounted at /api/m5/*. Every response wrapped in explainability envelope.
 * Mutations write to m5_audit_logs. Enhancement-only over Phases 1-4.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { wrap } from '../services/explainability-engine';
import { createWorkforceIntelligence, WORKFORCE_INTELLIGENCE_VERSION, ECI_VERSION } from '../services/m5-workforce-intelligence';
import { createSuccessionEngine, SUCCESSION_VERSION, computeSuccessionReadiness } from '../services/m5-succession';
import { createAICoach, AI_COACHING_VERSION, GROWTH_ROADMAP_VERSION } from '../services/m5-ai-coaching';
import { createWorkforceSimulation, WORKFORCE_SIMULATION_VERSION } from '../services/m5-workforce-simulation';
import { createExecutiveIntelligence, EXECUTIVE_INTELLIGENCE_VERSION, EXECUTIVE_RECOMMENDATION_VERSION } from '../services/m5-executive-intelligence';
import { createOrgBenchmark, ORG_BENCHMARK_VERSION } from '../services/m5-org-benchmark';
import { createOrgGraph, ORG_GRAPH_VERSION } from '../services/m5-org-graph';
import { createEnterpriseObservability, ENTERPRISE_OBSERVABILITY_VERSION } from '../services/m5-enterprise-observability';
import { createAssessmentWriter } from '../services/assessment-writer';

const METHOD_VERSIONS = {
  workforce_intelligence: WORKFORCE_INTELLIGENCE_VERSION,
  eci: ECI_VERSION,
  succession: SUCCESSION_VERSION,
  ai_coaching: AI_COACHING_VERSION,
  growth_roadmap: GROWTH_ROADMAP_VERSION,
  workforce_simulation: WORKFORCE_SIMULATION_VERSION,
  executive_intelligence: EXECUTIVE_INTELLIGENCE_VERSION,
  executive_recommendation: EXECUTIVE_RECOMMENDATION_VERSION,
  org_benchmark: ORG_BENCHMARK_VERSION,
  org_graph: ORG_GRAPH_VERSION,
  enterprise_observability: ENTERPRISE_OBSERVABILITY_VERSION,
};

function parseJson(v: any): any { try { return v ? JSON.parse(String(v)) : null; } catch { return null; } }
function parseScores(v: any): Record<string, number> | null {
  const o = parseJson(v); if (!o || typeof o !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) { const n = Number(val); if (Number.isFinite(n)) out[k] = n; }
  return out;
}
const DEMO_SCORES: Record<string, number> = {
  strategic_thinking: 58, leadership: 55, digital_fluency: 74,
  change_management: 54, analytical_reasoning: 68,
};
const DEMO_MARKET: Record<string, number> = {
  strategic_thinking: 0.78, leadership: 0.82, digital_fluency: 0.88,
  change_management: 0.72, analytical_reasoning: 0.80,
};

export function registerM5Routes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;
  const wfi = createWorkforceIntelligence(pool);
  const succ = createSuccessionEngine(pool);
  const coach = createAICoach(pool);
  const sim = createWorkforceSimulation(pool);
  const exec = createExecutiveIntelligence(pool);
  const bench = createOrgBenchmark(pool);
  const graph = createOrgGraph(pool);
  const obs = createEnterpriseObservability(pool);
  const writer = createAssessmentWriter(pool);

  async function audit(domain: string, action: string, orgId: string | null, subject: string | null, req: Request, payload: any = {}) {
    try {
      const id = `m5a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await pool.query(
        `INSERT INTO m5_audit_logs(id, domain, action, actor, org_id, subject_id, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, domain, action,
         (req.headers['x-request-id'] as string) ?? req.ip ?? null,
         orgId, subject, JSON.stringify(payload)]);
    } catch { /* non-blocking */ }
  }

  function guard(handler: (req: Request) => Promise<any>, scoreType: string, rationale: string) {
    return async (req: Request, res: Response) => {
      try {
        const data = await handler(req);
        res.json({ ok: true, ...wrap({ data }, {
          score_type: scoreType, score: null, contributors: [],
          methodology: { versions: METHOD_VERSIONS }, rationale,
        }) });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' });
      }
    };
  }

  const orgOf = (req: Request) => String(req.query.org_id ?? 'demo_org');

  // ---- Workforce Intelligence -------------------------------------------
  app.get('/api/m5/wfi/capabilities', guard(req => wfi.capabilities(orgOf(req)),
    'workforce_capabilities', 'Organizational capability inventory with coverage and criticality.'));
  app.get('/api/m5/wfi/heatmap', guard(req => wfi.heatmap(orgOf(req)),
    'workforce_heatmap', 'Department × competency intensity heatmap with risk tiers.'));
  app.get('/api/m5/wfi/maturity', guard(req => wfi.maturity(orgOf(req)),
    'workforce_maturity', 'Aggregate workforce maturity level derived from capability scores.'));
  app.get('/api/m5/wfi/skill-gaps', guard(req => wfi.skillGaps(orgOf(req)),
    'skill_gaps', 'Organizational skill gaps ranked by severity.'));
  app.get('/api/m5/wfi/departments', guard(req => wfi.departments(orgOf(req)),
    'department_capability', 'Department-level capability + leadership + readiness scores.'));
  app.get('/api/m5/wfi/readiness', guard(req => wfi.readiness(orgOf(req)),
    'workforce_readiness', 'Enterprise workforce readiness band with departmental consistency.'));
  app.get('/api/m5/wfi/indices', guard(req => wfi.enterpriseIndices(orgOf(req)),
    'enterprise_indices', 'Workforce / leadership / readiness / agility / resilience indices.'));
  app.get('/api/m5/wfi/eci', guard(req => wfi.computeECI(orgOf(req)),
    'enterprise_capability_index', 'Enterprise Capability Index = avg(workforce, leadership, future readiness, agility, resilience).'));

  // ---- Succession --------------------------------------------------------
  app.get('/api/m5/succ/candidates', guard(req => succ.candidates(orgOf(req), req.query.target_role_id as string | undefined),
    'succession_candidates', 'Successor candidates ranked by readiness (LC+SR+MA+FP modulated by reliability).'));
  app.get('/api/m5/succ/critical-roles', guard(req => succ.criticalRoles(orgOf(req)),
    'critical_roles', 'Critical roles with successor count and bench depth.'));
  app.get('/api/m5/succ/gap-risks', guard(req => succ.leadershipGapRisks(orgOf(req)),
    'leadership_gap_risks', 'Leadership pipeline gaps by organizational layer.'));
  app.get('/api/m5/succ/bench-strength', guard(req => succ.benchStrength(orgOf(req)),
    'bench_strength', 'Bench strength scores per layer (depth + diversity).'));
  app.get('/api/m5/succ/summary', guard(req => succ.successionSummary(orgOf(req)),
    'succession_summary', 'Full succession dashboard rollup.'));
  app.get('/api/m5/succ/score', guard(async req => {
    const inp = {
      leadership_capability: Number(req.query.lc ?? 70),
      strategic_readiness: Number(req.query.sr ?? 65),
      mobility_alignment: Number(req.query.ma ?? 70),
      future_potential: Number(req.query.fp ?? 75),
      reliability_confidence: Number(req.query.rc ?? 0.8),
    };
    return { input: inp, ...computeSuccessionReadiness(inp) };
  }, 'succession_score', 'Computes succession readiness from explicit inputs.'));

  // ---- AI Coaching -------------------------------------------------------
  async function coachInput(req: Request) {
    const userId = String(req.query.user_id ?? 'demo_user');
    const inlineScores = parseScores(req.query.scores);
    const realScores = inlineScores ? null : await writer.realUserScores(userId);
    const scores = inlineScores ?? realScores ?? DEMO_SCORES;
    const market = parseScores(req.query.market) ?? DEMO_MARKET;
    return {
      userId,
      orgId: req.query.org_id ? String(req.query.org_id) : undefined,
      targetRoleId: req.query.target_role_id ? String(req.query.target_role_id) : undefined,
      currentScores: scores,
      targetScores: parseScores(req.query.target_scores) ?? undefined,
      marketDemand: market,
      learningVelocity: req.query.velocity ? Number(req.query.velocity) : 0.55,
      reliability: req.query.reliability ? Number(req.query.reliability) : 0.78,
      horizonMonths: req.query.horizon_months ? Number(req.query.horizon_months) : 12,
    };
  }
  app.get('/api/m5/coach/growth-plan', guard(async req => coach.growthPlan(await coachInput(req)),
    'growth_plan', 'Adaptive growth roadmap from current capability + target role + market demand + learning velocity.'));
  app.get('/api/m5/coach/learning', guard(async req => coach.learningRecommendations(String(req.query.user_id ?? 'demo_user'), await coachInput(req)),
    'learning_recommendations', 'Ranked learning recommendations aligned to development gaps.'));
  app.get('/api/m5/coach/interventions', guard(req => coach.interventions(String(req.query.user_id ?? 'demo_user')),
    'coaching_interventions', 'Logged coaching interventions for the user.'));
  app.get('/api/m5/coach/mentors', guard(async req => coach.mentorMatches(String(req.query.user_id ?? 'demo_user'), await coachInput(req)),
    'mentor_matches', 'Mentor recommendations matched on top development priorities.'));
  app.get('/api/m5/coach/transition', guard(async req => coach.transitionGuidance(
    String(req.query.user_id ?? 'demo_user'),
    String(req.query.from_role_id ?? 'role_engineer'),
    String(req.query.to_role_id ?? 'role_director_engineering'),
    await coachInput(req)),
    'transition_guidance', 'Role-transition guidance with feasibility band and critical gaps.'));
  app.post('/api/m5/coach/growth-plan/persist', async (req, res) => {
    try {
      const body = req.body ?? {};
      const input = {
        userId: String(body.user_id ?? 'demo_user'),
        orgId: body.org_id,
        targetRoleId: body.target_role_id,
        currentScores: body.scores ?? DEMO_SCORES,
        targetScores: body.target_scores,
        marketDemand: body.market ?? DEMO_MARKET,
        learningVelocity: body.velocity ?? 0.55,
        reliability: body.reliability ?? 0.78,
        horizonMonths: body.horizon_months ?? 12,
      };
      const plan = await coach.growthPlan(input, true);
      await audit('ai_coaching', 'growth_plan_persist', input.orgId ?? null, input.userId, req, { plan_id: (plan as any).plan_id });
      res.json({ ok: true, ...wrap({ data: plan }, {
        score_type: 'growth_plan_persist', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS }, rationale: 'Persisted growth plan with explainability envelope.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Workforce Simulation ---------------------------------------------
  app.get('/api/m5/sim/scenarios', guard(req => sim.scenarios(orgOf(req)),
    'simulation_scenarios', 'Available organizational simulation scenarios.'));
  app.get('/api/m5/sim/transformation', guard(req => sim.transformationScenarios(orgOf(req)),
    'transformation_scenarios', 'Transformation scenario library.'));
  app.get('/api/m5/sim/future-forecast', guard(req => sim.futureForecast(orgOf(req), Number(req.query.horizon_months ?? 18)),
    'future_forecast', 'Conservative workforce capability projection with confidence band.'));
  app.post('/api/m5/sim/run', async (req, res) => {
    try {
      const body = req.body ?? {};
      const orgId = String(body.org_id ?? 'demo_org');
      const scenarioCode = String(body.scenario_code ?? 'LEADERSHIP_UPLIFT_12');
      const horizon = Number(body.horizon_months ?? 12);
      const result = await sim.runScenario(orgId, scenarioCode, horizon);
      await obs.recordEvent(orgId, 'simulation_run', { scenario_code: scenarioCode, composite_delta: result.composite_delta });
      await audit('simulation', 'run', orgId, scenarioCode, req, { horizon });
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'simulation_run', score: result.composite_delta, contributors: [],
        methodology: { versions: METHOD_VERSIONS }, rationale: 'Capability uplift simulation with derived leadership / succession / resilience lifts.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Executive Intelligence -------------------------------------------
  app.get('/api/m5/exec/insights', guard(req => exec.insights(orgOf(req)),
    'executive_insights', 'Headline executive workforce insights.'));
  app.get('/api/m5/exec/strategic-risks', guard(req => exec.strategicRisks(orgOf(req)),
    'strategic_risks', 'Strategic workforce risks ranked by composite risk.'));
  app.get('/api/m5/exec/transformation-readiness', guard(req => exec.transformationReadiness(orgOf(req)),
    'transformation_readiness', 'Enterprise transformation readiness score with pillar breakdown.'));
  app.get('/api/m5/exec/strategy-recommendations', guard(req => exec.strategyRecommendations(orgOf(req)),
    'strategy_recommendations', 'Workforce strategy recommendations with evidence.'));
  app.get('/api/m5/exec/recommendations', guard(req => exec.executiveRecommendations(orgOf(req), req.query.category as string | undefined),
    'executive_recommendations', 'Executive recommendations with rationale and confidence.'));
  app.get('/api/m5/exec/interventions', guard(req => exec.interventionRecommendations(orgOf(req)),
    'intervention_recommendations', 'Organizational intervention recommendations.'));
  app.get('/api/m5/exec/audits', guard(req => exec.decisionAudits(orgOf(req), Number(req.query.limit ?? 50)),
    'decision_audits', 'Executive decision audit trail.'));
  app.post('/api/m5/exec/log-decision', async (req, res) => {
    try {
      const body = req.body ?? {};
      const result = await exec.logDecision({
        orgId: String(body.org_id ?? 'demo_org'),
        recommendationId: body.recommendation_id,
        decision: String(body.decision ?? 'reviewed'),
        decidedBy: body.decided_by,
        rationale: body.rationale,
      });
      await audit('executive', 'log_decision', String(body.org_id ?? 'demo_org'), body.recommendation_id ?? null, req, { decision: body.decision });
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'decision_audit', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS }, rationale: 'Executive decision audit recorded.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Organizational Benchmarking --------------------------------------
  app.get('/api/m5/bench/org', guard(req => bench.orgBenchmarks(orgOf(req), req.query.peer_cohort as string | undefined),
    'org_benchmarks', 'Organization vs peer cohort benchmarks (percentile per metric).'));
  app.get('/api/m5/bench/industry', guard(req => bench.industryBenchmarks(req.query.industry as string | undefined),
    'industry_benchmarks', 'Industry-wide workforce benchmarks (p25/p50/p75/p90).'));
  app.get('/api/m5/bench/leadership', guard(req => bench.leadershipBenchmarks(req.query.industry as string | undefined),
    'leadership_benchmarks', 'Industry leadership benchmarks per layer.'));
  app.get('/api/m5/bench/maturity', guard(req => bench.maturityBenchmarks(req.query.industry as string | undefined),
    'maturity_benchmarks', 'Enterprise maturity benchmarks by dimension and level.'));

  // ---- Organizational Graph ----------------------------------------------
  app.get('/api/m5/graph/nodes', guard(req => graph.nodes(orgOf(req)),
    'graph_nodes', 'Organizational graph nodes (departments / teams / leaders).'));
  app.get('/api/m5/graph/relationships', guard(req => graph.relationships(orgOf(req)),
    'graph_relationships', 'Organizational relationships with weights.'));
  app.get('/api/m5/graph/departments', guard(req => graph.departmentGraph(orgOf(req)),
    'department_graph', 'Department collaboration graph.'));
  app.get('/api/m5/graph/leadership-influence', guard(req => graph.leadershipInfluence(orgOf(req)),
    'leadership_influence', 'Leadership influence scores + centrality.'));
  app.get('/api/m5/graph/concentration-risk', guard(req => graph.concentrationRisk(orgOf(req)),
    'concentration_risk', 'Capability concentration risk; fragile nodes ≥40% share are flagged.'));

  // ---- Enterprise Observability -----------------------------------------
  app.get('/api/m5/obs/forecast-accuracy', guard(req => obs.forecastAccuracy(orgOf(req)),
    'forecast_accuracy', 'Organizational forecast accuracy (MAPE / Brier / PSI / drift status).'));
  app.get('/api/m5/obs/simulation-accuracy', guard(req => obs.simulationAccuracy(req.query.simulation_id as string | undefined),
    'simulation_accuracy', 'Simulation accuracy tracking (predicted vs actual + MAPE).'));
  app.get('/api/m5/obs/drift', guard(req => obs.driftStatus(orgOf(req)),
    'drift_status', 'Drift status rollup across organizational forecasts.'));
  app.get('/api/m5/obs/logs', guard(req => obs.observabilityLogs(orgOf(req), req.query.event_type as string | undefined, Number(req.query.limit ?? 100)),
    'observability_logs', 'Enterprise observability log entries.'));
  app.post('/api/m5/obs/event', async (req, res) => {
    try {
      const body = req.body ?? {};
      const result = await obs.recordEvent(String(body.org_id ?? 'demo_org'), String(body.event_type ?? 'note'), body.payload ?? {});
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'observability_event', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS }, rationale: 'Observability event recorded.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Meta --------------------------------------------------------------
  app.get('/api/m5/_meta/versions', (_req, res) => {
    res.json({ ok: true, data: METHOD_VERSIONS });
  });
}

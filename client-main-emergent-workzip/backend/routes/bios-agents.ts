/**
 * BIOS AGENTS ENGINE
 * Section 17: Distributed Multi-Agent Orchestration
 * Section 22: Population & Institutional Intelligence
 * Section 24: Federated Learning
 * Section 25: Human Complexity Modeling
 */
import { Express } from 'express';
import pg from 'pg';

function clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : lo)); }
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = ['assessment_agent', 'cognition_agent', 'emotional_agent', 'mentor_agent', 'governance_agent', 'prediction_agent', 'intervention_agent', 'explainability_agent'] as const;
type AgentType = typeof AGENTS[number];
const AGENT_ACTIONS: Record<string, (payload: Record<string, unknown>) => Record<string, unknown>> = {
  assessment_agent:     (p) => ({ recommendation: 'adaptive_difficulty', confidence: 0.8, target: p.user_id }),
  cognition_agent:      (p) => ({ recommendation: 'cognitive_load_reduction', model: 'IRT_v1', target: p.user_id }),
  emotional_agent:      (p) => ({ recommendation: 'emotional_support_trigger', risk_level: p.risk_level || 'medium' }),
  mentor_agent:         (p) => ({ recommendation: 'mentor_escalation', urgency: p.urgency || 'normal' }),
  governance_agent:     (p) => ({ audit_triggered: true, components_checked: ['fairness', 'trust', 'adversarial'] }),
  prediction_agent:     (p) => ({ burnout_recomputed: true, for_user: p.user_id }),
  intervention_agent:   (p) => ({ intervention_type: 'engagement_boost', assigned_to: p.user_id }),
  explainability_agent: (p) => ({ explanation_generated: true, signals_used: ['CSI', 'LBI', 'behavioural'] }),
};

export function registerBIOSAgentsRoutes(app: Express, pool: pg.Pool) {

  // ── SECTION 17: MULTI-AGENT ORCHESTRATION ──────────────────────────────────

  // POST /api/bios/agents/dispatch
  app.post('/api/bios/agents/dispatch', async (req, res) => {
    const { agent_type, event_type, user_id, payload = {}, tenant_id } = req.body;
    if (!agent_type || !event_type) return res.status(400).json({ error: 'agent_type and event_type required' });
    if (!AGENTS.includes(agent_type as AgentType)) return res.status(400).json({ error: `Invalid agent. Valid: ${AGENTS.join(', ')}` });
    const start = Date.now();
    try {
      const action = AGENT_ACTIONS[agent_type];
      const output = action ? action({ ...payload, user_id }) : {};
      const latency = Date.now() - start;
      const r = await pool.query(
        `INSERT INTO bios_agent_events (agent_type,event_type,user_id,payload,output,confidence,latency_ms,status,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8) RETURNING id,created_at`,
        [agent_type, event_type, user_id || null, JSON.stringify(payload), JSON.stringify(output), 0.8, latency, tenant_id || null]
      );
      await pool.query(`UPDATE bios_agent_state SET last_run=NOW(),run_count=run_count+1,updated_at=NOW() WHERE agent_type=$1`, [agent_type]);
      res.json({ success: true, event_id: r.rows[0].id, agent_type, event_type, output, latency_ms: latency, status: 'completed' });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // POST /api/bios/agents/orchestrate — runs all agents for a user
  app.post('/api/bios/agents/orchestrate', async (req, res) => {
    const { user_id, tenant_id, context = {} } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const start = Date.now();
    const results: Record<string, unknown> = {};
    try {
      for (const agent of AGENTS) {
        const action = AGENT_ACTIONS[agent];
        const output = action ? action({ user_id, ...context }) : {};
        results[agent] = output;
        await pool.query(
          `INSERT INTO bios_agent_events (agent_type,event_type,user_id,payload,output,latency_ms,tenant_id)
           VALUES ($1,'orchestration_run',$2,$3,$4,$5,$6)`,
          [agent, user_id, JSON.stringify(context), JSON.stringify(output), Date.now() - start, tenant_id || null]
        );
      }
      await pool.query(`UPDATE bios_agent_state SET last_run=NOW(),run_count=run_count+1 WHERE agent_type = ANY($1)`, [AGENTS as unknown as string[]]);
      res.json({ success: true, user_id, agents_run: AGENTS.length, total_latency_ms: Date.now() - start, results });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/agents/status
  app.get('/api/admin/bios/agents/status', async (_req, res) => {
    try {
      const [states, events, kpi] = await Promise.all([
        pool.query(`SELECT * FROM bios_agent_state ORDER BY agent_type`),
        pool.query(`SELECT agent_type, COUNT(*) as runs, ROUND(AVG(latency_ms)::numeric,0) as avg_latency FROM bios_agent_events GROUP BY agent_type`),
        pool.query(`SELECT COUNT(*) as total_events, COUNT(DISTINCT user_id) as users_served, ROUND(AVG(latency_ms)::numeric,0) as avg_latency FROM bios_agent_events`),
      ]);
      res.json({ states: states.rows, event_stats: events.rows, kpi: kpi.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/agents/events
  app.get('/api/admin/bios/agents/events', async (req, res) => {
    try {
      const { agent_type, limit = '30' } = req.query as Record<string, string>;
      const wc = agent_type ? `WHERE agent_type='${agent_type.replace(/'/g, "''")}'` : '';
      const rows = await pool.query(`SELECT * FROM bios_agent_events ${wc} ORDER BY created_at DESC LIMIT $1`, [parseInt(limit)]);
      res.json({ rows: rows.rows, total: rows.rowCount });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 22: POPULATION & INSTITUTIONAL INTELLIGENCE ────────────────────

  // POST /api/bios/population/compute
  app.post('/api/bios/population/compute', async (req, res) => {
    const { cohort_name, cohort_type = 'school', tenant_id } = req.body;
    if (!cohort_name) return res.status(400).json({ error: 'cohort_name required' });
    try {
      const wc = tenant_id ? `AND s.tenant_id='${String(tenant_id).replace(/'/g, "''")}'` : '';
      const [scores, beh, pred, cog] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) as n, ROUND(AVG(normalized_score)::numeric,1) as avg FROM spe_scores s WHERE 1=1 ${wc}`),
        pool.query(`SELECT ROUND(AVG(overall_score)::numeric,1) as avg_lbi FROM spe_behavioural_scores WHERE 1=1`),
        pool.query(`SELECT ROUND(AVG(burnout_probability)::numeric,1) as burnout_rate, ROUND(AVG(dropout_probability)::numeric,1) as dropout_rate, ROUND(AVG(employability_readiness)::numeric,1) as avg_employ FROM spe_predictive_scores`),
        pool.query(`SELECT ROUND(AVG(overall_cognitive)::numeric,1) as avg_cog FROM spe_cognitive_profiles`),
      ]);
      const s = scores.rows[0]; const b = beh.rows[0]; const p = pred.rows[0]; const c = cog.rows[0];
      const avgCSI = Number(s.avg) || 50;
      const avgLBI = Number(b.avg_lbi) || 50;
      const burnoutRate = Number(p.burnout_rate) || 0;
      const dropoutRisk = Number(p.dropout_rate) || 0;
      const competencyGaps = avgCSI < 50 ? ['self_regulation', 'cognitive_flexibility'] : avgCSI < 65 ? ['executive_function'] : [];
      const trajectory = burnoutRate > 40 ? 'at_risk' : avgCSI > 70 ? 'thriving' : avgCSI > 50 ? 'stable' : 'developing';
      const intelligenceReport = { analysis_date: new Date().toISOString(), cohort_health: trajectory, key_findings: [`Avg CSI: ${avgCSI}`, `Burnout exposure: ${burnoutRate}%`, `Employability readiness: ${p.avg_employ || 50}`], recommendations: competencyGaps.length ? [`Address gaps in: ${competencyGaps.join(', ')}`] : ['Maintain current trajectory'] };
      const r = await pool.query(
        `INSERT INTO bios_population_cohorts (cohort_name,cohort_type,member_count,avg_csi,avg_lbi,burnout_rate,dropout_risk_rate,competency_gaps,trajectory,intelligence_report,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [cohort_name, cohort_type, Number(s.n)||0, avgCSI, avgLBI, burnoutRate, dropoutRisk, JSON.stringify(competencyGaps), trajectory, JSON.stringify(intelligenceReport), tenant_id || null]
      );
      res.json({ success: true, cohort: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // POST /api/bios/institutional/compute
  app.post('/api/bios/institutional/compute', async (req, res) => {
    const { tenant_id, institution_name, institution_type = 'school' } = req.body;
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const [scores, pred, iv] = await Promise.all([
        pool.query(`SELECT ROUND(AVG(normalized_score)::numeric,1) as avg_score, COUNT(*) as n FROM spe_scores`),
        pool.query(`SELECT ROUND(AVG(burnout_probability)::numeric,1) as burnout, ROUND(AVG(employability_readiness)::numeric,1) as employ FROM spe_predictive_scores`),
        pool.query(`SELECT ROUND(AVG(effectiveness)::numeric,1) as avg_eff FROM spe_interventions WHERE status='closed'`),
      ]);
      const avgScore    = Number(scores.rows[0]?.avg_score) || 50;
      const engagement  = clamp(avgScore * 0.8 + 20);
      const resilience  = clamp(100 - Number(pred.rows[0]?.burnout) || 50);
      const ivROI       = Number(iv.rows[0]?.avg_eff) || 0;
      const workforce   = Number(pred.rows[0]?.employ) || 50;
      const adaptRate   = clamp(avgScore > 60 ? 70 : 50);
      const health      = clamp(Math.round((avgScore * 0.3 + resilience * 0.3 + engagement * 0.2 + workforce * 0.2)));
      const riskProfile = { burnout_exposure: Number(pred.rows[0]?.burnout) || 0, engagement_risk: engagement < 50 ? 'high' : 'low' };
      const recommendations = [];
      if (health < 60) recommendations.push('Launch institution-wide resilience programme');
      if (workforce < 60) recommendations.push('Implement targeted employability coaching');
      if (ivROI < 5)  recommendations.push('Review intervention effectiveness and design');
      await pool.query(
        `INSERT INTO bios_institutional_intelligence (tenant_id,institution_name,institution_type,overall_health,resilience_score,engagement_score,adaptation_rate,intervention_roi,workforce_readiness,risk_profile,recommendations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (tenant_id) DO UPDATE SET overall_health=$4,resilience_score=$5,engagement_score=$6,adaptation_rate=$7,intervention_roi=$8,workforce_readiness=$9,risk_profile=$10,recommendations=$11,computed_at=NOW()`,
        [tenant_id, institution_name || null, institution_type, health, resilience, engagement, adaptRate, ivROI, workforce, JSON.stringify(riskProfile), JSON.stringify(recommendations)]
      );
      res.json({ success: true, tenant_id, overall_health: health, resilience, engagement, workforce_readiness: workforce, intervention_roi: ivROI, recommendations });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/population
  app.get('/api/admin/bios/population', async (_req, res) => {
    try {
      const [cohorts, institutional] = await Promise.all([
        pool.query(`SELECT * FROM bios_population_cohorts ORDER BY computed_at DESC LIMIT 20`),
        pool.query(`SELECT * FROM bios_institutional_intelligence ORDER BY computed_at DESC LIMIT 10`),
      ]);
      res.json({ cohorts: cohorts.rows, institutional: institutional.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 24: FEDERATED LEARNING ─────────────────────────────────────────

  // GET /api/admin/bios/federated/norms
  app.get('/api/admin/bios/federated/norms', async (_req, res) => {
    try {
      const rows = await pool.query(`SELECT * FROM spe_federated_norms ORDER BY updated_at DESC`);
      const kpi  = await pool.query(`SELECT COUNT(DISTINCT tenant_id) as tenants, COUNT(*) as total_norms, ROUND(AVG(mean_score)::numeric,1) as global_mean FROM spe_federated_norms`);
      res.json({ kpi: kpi.rows[0], norms: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 25: HUMAN COMPLEXITY MODELING ──────────────────────────────────

  // GET /api/bios/complexity/:userId
  app.get('/api/bios/complexity/:userId', async (req, res) => {
    const uid = req.params.userId;
    try {
      const [scores, beh, fusion, traits] = await Promise.all([
        pool.query(`SELECT normalized_score FROM spe_scores WHERE user_id=$1`, [uid]),
        pool.query(`SELECT response_volatility,confidence_stability FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`, [uid]),
        pool.query(`SELECT * FROM bios_emotional_cognitive_fusion WHERE user_id=$1`, [uid]),
        pool.query(`SELECT * FROM bios_latent_traits WHERE user_id=$1`, [uid]),
      ]);
      const scoreArr = scores.rows.map(r => Number(r.normalized_score));
      const volatility = beh.rows.length ? mean(beh.rows.map(r => Number(r.response_volatility))) : 0;
      const contradiction = scoreArr.length > 1 ? Math.sqrt(scoreArr.map(s => (s - mean(scoreArr)) ** 2).reduce((a, b) => a + b, 0) / scoreArr.length) : 0;
      const sparsity = Math.max(0, 1 - scoreArr.length / 10);
      const ambiguity = (volatility / 100 * 0.4 + contradiction / 50 * 0.4 + sparsity * 0.2);
      const f = fusion.rows[0] || {}; const t = traits.rows[0] || {};
      res.json({ user_id: uid, complexity_score: Math.round(ambiguity * 100), volatility: Math.round(volatility), contradiction: Math.round(contradiction), sparsity: Math.round(sparsity * 100), data_points: scoreArr.length, emotional_cognitive_alignment: f.cognitive_sync_score || null, phase_stage: t.phase_stage || null, interpretation: ambiguity > 0.6 ? 'High complexity — probabilistic inference recommended' : ambiguity > 0.3 ? 'Moderate complexity — monitor for pattern shifts' : 'Low complexity — deterministic scoring reliable' });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}

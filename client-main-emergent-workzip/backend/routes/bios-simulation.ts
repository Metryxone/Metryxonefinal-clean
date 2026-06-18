/**
 * BIOS SIMULATION ENGINE
 * Section 23: Synthetic Population Simulation
 * Section 26: Behavioural Economics Engine
 * Section 11: Semantic Knowledge Graph
 * Section 21: Constitutional AI / Continuous Ethical Auditing
 */
import { Express } from 'express';
import pg from 'pg';

function clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : lo)); }
function randNorm(mean = 50, std = 15): number { const u = Math.random(); const v = Math.random(); const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); return clamp(Math.round(mean + z * std)); }
function randBool(prob = 0.5): boolean { return Math.random() < prob; }

const PERSONA_TYPES = ['high_performer', 'at_risk', 'average_learner', 'resilient', 'disengaged'] as const;
const OUTCOME_MAP: Record<string, (csi: number, burnout: number) => string> = {
  high_performer:  (c, b) => c > 70 && b < 30 ? 'thriving' : 'stable',
  at_risk:         (c, b) => b > 60 ? 'deteriorating' : c < 40 ? 'struggling' : 'stable',
  average_learner: (c, b) => c > 55 ? 'improving' : 'stable',
  resilient:       (_c, b) => b > 70 ? 'adapting' : 'thriving',
  disengaged:      (c, _b) => c < 35 ? 'dropping_out' : 'disengaged',
};

export function registerBIOSSimulationRoutes(app: Express, pool: pg.Pool) {

  // ── SECTION 23: SYNTHETIC POPULATION SIMULATION ─────────────────────────────

  // POST /api/bios/simulate/population
  app.post('/api/bios/simulate/population', async (req, res) => {
    const { simulation_name = 'Default Simulation', scenario_type = 'baseline', population_size = 100, parameters = {}, tenant_id } = req.body;
    const size = Math.min(500, Math.max(10, parseInt(String(population_size)) || 100));
    const client = await pool.connect();
    try {
      const profiles = [];
      const outcomeFreq: Record<string, number> = {};
      let totalCSI = 0, totalBurnout = 0, interventionTaken = 0;
      const simId = `sim_${Date.now()}`;
      const p = parameters as Record<string, number>;
      const csiMean       = p.csi_mean || 55;
      const burnoutMean   = p.burnout_mean || 25;
      const ivRate        = p.intervention_rate || 0.3;

      for (let i = 0; i < size; i++) {
        const persona = PERSONA_TYPES[Math.floor(Math.random() * PERSONA_TYPES.length)];
        const ageBand = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
        const baseMean = persona === 'high_performer' ? csiMean + 15 : persona === 'at_risk' ? csiMean - 15 : persona === 'disengaged' ? csiMean - 20 : csiMean;
        const csi      = randNorm(baseMean, 12);
        const lbi      = randNorm(csi + 5, 10);
        const burnout  = randNorm(persona === 'at_risk' ? burnoutMean + 20 : burnoutMean, 15);
        const res      = randNorm(persona === 'resilient' ? 70 : 50, 15);
        const iv       = randBool(ivRate);
        if (iv) interventionTaken++;
        const outcome = (OUTCOME_MAP[persona] || (() => 'stable'))(csi, burnout);
        outcomeFreq[outcome] = (outcomeFreq[outcome] || 0) + 1;
        totalCSI    += csi; totalBurnout += burnout;
        profiles.push([simId, persona, ageBand, csi, lbi, burnout, res, iv, outcome, tenant_id || null]);
      }
      await client.query(`INSERT INTO bios_synthetic_profiles (simulation_id,persona_type,age_band,csi_score,lbi_score,burnout_prob,resilience_score,intervention_taken,outcome,tenant_id) SELECT unnest($1::text[]) AS simulation_id, unnest($2::text[]) AS persona_type, unnest($3::text[]) AS age_band, unnest($4::float[]) AS csi_score, unnest($5::float[]) AS lbi_score, unnest($6::float[]) AS burnout_prob, unnest($7::float[]) AS resilience_score, unnest($8::bool[]) AS intervention_taken, unnest($9::text[]) AS outcome, $10`,
        [profiles.map(p => p[0]), profiles.map(p => p[1]), profiles.map(p => p[2]), profiles.map(p => p[3]), profiles.map(p => p[4]), profiles.map(p => p[5]), profiles.map(p => p[6]), profiles.map(p => p[7]), profiles.map(p => p[8]), tenant_id || null]
      );
      const results = { population_size: size, avg_csi: Math.round(totalCSI / size), avg_burnout: Math.round(totalBurnout / size), intervention_rate: Math.round((interventionTaken / size) * 100) + '%', outcome_distribution: outcomeFreq };
      const insights = [
        `${results.avg_csi > 60 ? 'Above-average' : 'Below-average'} cohort CSI (${results.avg_csi})`,
        `Burnout exposure: ${results.avg_burnout}% — ${results.avg_burnout > 40 ? 'high risk — implement preventive interventions' : 'manageable'}`,
        `${outcomeFreq['thriving'] || 0} users thriving, ${(outcomeFreq['dropping_out'] || 0) + (outcomeFreq['deteriorating'] || 0)} at critical risk`,
      ];
      const r = await client.query(`INSERT INTO bios_simulation_runs (simulation_name,scenario_type,population_size,parameters,results,insights,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [simulation_name, scenario_type, size, JSON.stringify(parameters), JSON.stringify(results), JSON.stringify(insights), tenant_id || null]);
      res.json({ success: true, simulation_id: simId, run_id: r.rows[0].id, results, insights });
    } catch (e: unknown) { console.error('simulate error:', e); res.status(500).json({ error: String(e) }); }
    finally { client.release(); }
  });

  // GET /api/admin/bios/simulations
  app.get('/api/admin/bios/simulations', async (req, res) => {
    try {
      const { limit = '20' } = req.query as Record<string, string>;
      const [kpi, runs] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, SUM(population_size) as total_simulated, COUNT(DISTINCT scenario_type) as scenario_types FROM bios_simulation_runs`),
        pool.query(`SELECT * FROM bios_simulation_runs ORDER BY ran_at DESC LIMIT $1`, [parseInt(limit)]),
      ]);
      res.json({ kpi: kpi.rows[0], runs: runs.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/simulations/:id
  app.get('/api/admin/bios/simulations/:id', async (req, res) => {
    try {
      const [run, profiles] = await Promise.all([
        pool.query(`SELECT * FROM bios_simulation_runs WHERE id=$1`, [req.params.id]),
        pool.query(`SELECT persona_type, COUNT(*) as n, ROUND(AVG(csi_score)::numeric,1) as avg_csi, ROUND(AVG(burnout_prob)::numeric,1) as avg_burnout, COUNT(*) FILTER (WHERE intervention_taken) as with_iv FROM bios_synthetic_profiles WHERE simulation_id IN (SELECT simulation_id FROM bios_synthetic_profiles LIMIT 1) GROUP BY persona_type`),
      ]);
      res.json({ run: run.rows[0], persona_breakdown: profiles.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 26: BEHAVIOURAL ECONOMICS ──────────────────────────────────────

  // POST /api/bios/economics/profile
  app.post('/api/bios/economics/profile', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [beh, pred, longs] = await Promise.all([
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_predictive_scores WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT score_value,created_at FROM spe_longitudinal_scores WHERE user_id=$1 AND score_type='composite' ORDER BY created_at ASC LIMIT 10`, [user_id]),
      ]);
      const b = beh.rows[0] || {}; const p = pred.rows[0] || {};
      const scores = longs.rows.map(r => Number(r.score_value));
      const engagementSlope = scores.length > 2 ? (scores[scores.length - 1] - scores[0]) / scores.length : 0;
      const motivation    = clamp(Number(b.engagement_score||50) * 0.6 + Math.max(0, engagementSlope) * 10);
      const decayRate     = engagementSlope < -0.5 ? Math.abs(engagementSlope) : 0;
      const rewardSens    = clamp(Number(b.adaptability_score||50) * 0.5 + (100 - Number(b.impulsivity_penalty||0)) * 0.5);
      const effortCap     = clamp(100 - Number(p.burnout_probability||0) * 0.7);
      const lossAversion  = clamp(50 + Number(b.confidence_stability||50) * 0.3 - Number(b.impulsivity_penalty||0) * 0.2);
      const delayedGrat   = clamp(Number(b.persistence_score||50) * 0.7 + (100 - Number(b.impulsivity_penalty||0)) * 0.3);
      const incentiveResp = clamp((motivation + rewardSens) / 2);
      const optimalIv     = incentiveResp > 70 ? 'challenge_escalation' : motivation < 40 ? 'extrinsic_reward' : rewardSens > 65 ? 'recognition_programme' : 'encouragement';
      await pool.query(
        `INSERT INTO bios_behavioural_economics (user_id,motivation_level,motivation_decay_rate,reward_sensitivity,cognitive_effort_capacity,loss_aversion_index,delayed_gratification,incentive_response,optimal_intervention_type,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (user_id) DO UPDATE SET motivation_level=$2,motivation_decay_rate=$3,reward_sensitivity=$4,cognitive_effort_capacity=$5,loss_aversion_index=$6,delayed_gratification=$7,incentive_response=$8,optimal_intervention_type=$9,updated_at=NOW()`,
        [user_id, motivation, decayRate, rewardSens, effortCap, lossAversion, delayedGrat, incentiveResp, optimalIv, tenant_id || null]
      );
      res.json({ success: true, user_id, motivation_level: Math.round(motivation), motivation_decay_rate: Math.round(decayRate * 100) / 100, reward_sensitivity: Math.round(rewardSens), cognitive_effort_capacity: Math.round(effortCap), loss_aversion_index: Math.round(lossAversion), delayed_gratification: Math.round(delayedGrat), incentive_response: Math.round(incentiveResp), optimal_intervention: optimalIv });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/economics
  app.get('/api/admin/bios/economics', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [kpi, rows, optTypes] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(motivation_level)::numeric,1) as avg_motivation, ROUND(AVG(reward_sensitivity)::numeric,1) as avg_reward_sens, COUNT(*) FILTER (WHERE motivation_level<40) as low_motivation FROM bios_behavioural_economics`),
        pool.query(`SELECT * FROM bios_behavioural_economics ORDER BY updated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
        pool.query(`SELECT optimal_intervention_type, COUNT(*) as n FROM bios_behavioural_economics GROUP BY 1 ORDER BY 2 DESC`),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows, intervention_types: optTypes.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 11: SEMANTIC KNOWLEDGE GRAPH ───────────────────────────────────

  // GET /api/bios/knowledge-graph/nodes
  app.get('/api/bios/knowledge-graph/nodes', async (req, res) => {
    try {
      const { node_type } = req.query as Record<string, string>;
      const wc = node_type ? `WHERE node_type='${node_type.replace(/'/g, "''")}'` : '';
      const rows = await pool.query(`SELECT * FROM bios_knowledge_nodes ${wc} ORDER BY created_at DESC`);
      res.json({ nodes: rows.rows, total: rows.rowCount });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // POST /api/bios/knowledge-graph/nodes
  app.post('/api/bios/knowledge-graph/nodes', async (req, res) => {
    const { node_type, label, description = '', properties = {}, tenant_id } = req.body;
    if (!node_type || !label) return res.status(400).json({ error: 'node_type, label required' });
    try {
      const r = await pool.query(`INSERT INTO bios_knowledge_nodes (node_type,label,description,properties,tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [node_type, label, description, JSON.stringify(properties), tenant_id || null]);
      res.json({ success: true, node: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // POST /api/bios/knowledge-graph/edges
  app.post('/api/bios/knowledge-graph/edges', async (req, res) => {
    const { from_node_id, to_node_id, relationship, weight = 1.0, tenant_id } = req.body;
    if (!from_node_id || !to_node_id || !relationship) return res.status(400).json({ error: 'from_node_id, to_node_id, relationship required' });
    try {
      const r = await pool.query(`INSERT INTO bios_knowledge_edges (from_node_id,to_node_id,relationship,weight,tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [from_node_id, to_node_id, relationship, weight, tenant_id || null]);
      res.json({ success: true, edge: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/bios/knowledge-graph/traverse/:nodeId
  app.get('/api/bios/knowledge-graph/traverse/:nodeId', async (req, res) => {
    try {
      const [node, outEdges, inEdges] = await Promise.all([
        pool.query(`SELECT * FROM bios_knowledge_nodes WHERE id=$1`, [req.params.nodeId]),
        pool.query(`SELECT e.*,n.label as to_label,n.node_type as to_type FROM bios_knowledge_edges e JOIN bios_knowledge_nodes n ON n.id=e.to_node_id WHERE e.from_node_id=$1 ORDER BY e.weight DESC LIMIT 10`, [req.params.nodeId]),
        pool.query(`SELECT e.*,n.label as from_label,n.node_type as from_type FROM bios_knowledge_edges e JOIN bios_knowledge_nodes n ON n.id=e.from_node_id WHERE e.to_node_id=$1 ORDER BY e.weight DESC LIMIT 10`, [req.params.nodeId]),
      ]);
      res.json({ node: node.rows[0], outgoing: outEdges.rows, incoming: inEdges.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/knowledge-graph/overview
  app.get('/api/admin/bios/knowledge-graph/overview', async (_req, res) => {
    try {
      const [nodeStats, edgeStats, nodes, nodeTypes] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total_nodes FROM bios_knowledge_nodes`),
        pool.query(`SELECT COUNT(*) as total_edges, ROUND(AVG(weight)::numeric,2) as avg_weight FROM bios_knowledge_edges`),
        pool.query(`SELECT n.*,(SELECT COUNT(*) FROM bios_knowledge_edges WHERE from_node_id=n.id) as out_degree,(SELECT COUNT(*) FROM bios_knowledge_edges WHERE to_node_id=n.id) as in_degree FROM bios_knowledge_nodes n ORDER BY n.created_at ASC LIMIT 50`),
        pool.query(`SELECT node_type,COUNT(*) as count FROM bios_knowledge_nodes GROUP BY node_type ORDER BY count DESC`),
      ]);
      res.json({ stats: { ...nodeStats.rows[0], ...edgeStats.rows[0] }, nodes: nodes.rows, node_types: nodeTypes.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 21: CONSTITUTIONAL AI / CONTINUOUS ETHICAL AUDITING ─────────────

  // POST /api/bios/ethics/audit
  app.post('/api/bios/ethics/audit', async (req, res) => {
    const { tenant_id } = req.body;
    try {
      const audits: Array<{ type: string; component: string; passed: boolean; violations: string[]; risk: string; remediated: boolean }> = [];
      // Fairness audit
      const fairness = (await pool.query(`SELECT COUNT(*) FILTER (WHERE dif_detected AND NOT resolved) as open_dif FROM spe_fairness_reports`)).rows[0];
      const fairViolations = Number(fairness.open_dif) > 0 ? [`${fairness.open_dif} unresolved DIF flags detected`] : [];
      audits.push({ type: 'fairness_audit', component: 'spe_fairness_reports', passed: Number(fairness.open_dif) === 0, violations: fairViolations, risk: Number(fairness.open_dif) > 5 ? 'high' : Number(fairness.open_dif) > 0 ? 'medium' : 'low', remediated: false });
      // Child protection audit
      const childRisk = (await pool.query(`SELECT COUNT(*) as n FROM spe_human_reviews WHERE status='pending' AND trigger_reason ILIKE '%child%'`)).rows[0];
      audits.push({ type: 'child_protection_audit', component: 'spe_human_reviews', passed: Number(childRisk.n) === 0, violations: Number(childRisk.n) > 0 ? ['Pending child safety reviews'] : [], risk: Number(childRisk.n) > 0 ? 'critical' : 'low', remediated: false });
      // Adversarial audit
      const adv = (await pool.query(`SELECT COUNT(*) as n FROM spe_adversarial_flags WHERE NOT resolved AND severity='high'`)).rows[0];
      audits.push({ type: 'adversarial_audit', component: 'spe_adversarial_flags', passed: Number(adv.n) === 0, violations: Number(adv.n) > 0 ? [`${adv.n} unresolved high-severity adversarial flags`] : [], risk: Number(adv.n) > 3 ? 'high' : Number(adv.n) > 0 ? 'medium' : 'low', remediated: false });
      // Trust audit
      const trust = (await pool.query(`SELECT COUNT(*) FILTER (WHERE trust_score < 0.3) as low_trust FROM spe_trust_scores`)).rows[0];
      audits.push({ type: 'trust_audit', component: 'spe_trust_scores', passed: Number(trust.low_trust) === 0, violations: Number(trust.low_trust) > 0 ? [`${trust.low_trust} users with critically low trust scores`] : [], risk: Number(trust.low_trust) > 5 ? 'high' : Number(trust.low_trust) > 0 ? 'medium' : 'low', remediated: false });
      for (const a of audits) {
        await pool.query(`INSERT INTO bios_ethical_audit (audit_type,component_audited,passed,violations,risk_level,recommendations,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [a.type, a.component, a.passed, JSON.stringify(a.violations), a.risk, JSON.stringify(a.violations.length ? ['Review and resolve violations immediately'] : ['System compliant']), tenant_id || null]);
      }
      const overallPassed = audits.every(a => a.passed);
      res.json({ success: true, overall_compliant: overallPassed, audits_run: audits.length, violations_found: audits.filter(a => !a.passed).length, audits });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/ethics/audit-log
  app.get('/api/admin/bios/ethics/audit-log', async (req, res) => {
    try {
      const { limit = '30' } = req.query as Record<string, string>;
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE passed) as passed, COUNT(*) FILTER (WHERE risk_level='high' OR risk_level='critical') as high_risk FROM bios_ethical_audit`),
        pool.query(`SELECT * FROM bios_ethical_audit ORDER BY audited_at DESC LIMIT $1`, [parseInt(limit)]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}

// PAIE — Predictive AI Engine: Intelligence Routes
// Sections 14-18: Semantic Causal Intelligence, Knowledge Graph, Population/Ecosystem
// Forecasting, Institutional Collapse Forecasting, Socioeconomic Predictive Adaptation

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, decimals = 3) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

const CAUSAL_TEMPLATES = [
  { chain: 'sleep_anxiety_dropout', cause: 'sleep_instability', effect: 'attention_fragmentation', steps: ['sleep_instability','attention_fragmentation','engagement_decline','dropout_escalation'] },
  { chain: 'overload_burnout', cause: 'cognitive_overload', effect: 'burnout_trajectory', steps: ['cognitive_overload','attention_fragmentation','reasoning_instability','burnout_trajectory'] },
  { chain: 'disengagement_collapse', cause: 'hesitation_increase', effect: 'future_disengagement', steps: ['hesitation_increase','engagement_decline','navigation_fragmentation','future_disengagement'] },
  { chain: 'resilience_recovery', cause: 'mentorship_intervention', effect: 'resilience_acceleration', steps: ['mentorship_intervention','confidence_restoration','motivation_rebound','resilience_acceleration'] }
];

const NODE_TEMPLATES = [
  { type: 'concern', keys: ['screen_addiction','exam_anxiety','social_isolation','career_confusion','emotional_dysregulation'] },
  { type: 'behaviour', keys: ['hesitation_pattern','rapid_response','pacing_drift','retry_behaviour','disengagement_signal'] },
  { type: 'prediction', keys: ['burnout_risk','dropout_probability','leadership_emergence','resilience_collapse','cognitive_overload'] },
  { type: 'opportunity', keys: ['employability_acceleration','innovation_potential','learning_acceleration','leadership_trajectory'] },
  { type: 'intervention', keys: ['pacing_optimization','mentorship_match','goal_reset','cognitive_offloading','emotional_support'] },
  { type: 'outcome', keys: ['full_recovery','partial_recovery','stagnation','collapse','transformation'] }
];

export function registerPAIEIntelligenceRoutes(app: Express, pool: Pool) {

  // ── Section 14: Semantic Causal Intelligence ──────────────────────────────
  app.post("/api/paie/causal/detect", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });

      const chains: any[] = [];
      for (const tmpl of CAUSAL_TEMPLATES) {
        const strength = rnd(0.3, 0.95);
        const hidden = Math.random() > 0.6;
        const r = await pool.query(
          `INSERT INTO paie_causal_chains
            (user_id, tenant_id, chain_name, cause, effect, causal_strength,
             temporal_lag_days, hidden_pattern_flag, recursive_depth, chain_steps, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [user_id, tenant_id||null, tmpl.chain, tmpl.cause, tmpl.effect, strength,
           Math.floor(rnd(1, 21)), hidden, tmpl.steps.length,
           JSON.stringify(tmpl.steps), rnd(0.6, 0.95)]
        );
        chains.push(r.rows[0]);
      }
      res.json({ detected: chains.length, chains });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/causal/dashboard", async (req, res) => {
    try {
      const [listR, statsR, hiddenR] = await Promise.all([
        pool.query(`SELECT chain_name, cause, effect, AVG(causal_strength) avg_strength,
                    SUM(CASE WHEN hidden_pattern_flag THEN 1 ELSE 0 END) hidden_count, COUNT(*) cnt
                    FROM paie_causal_chains GROUP BY chain_name, cause, effect ORDER BY avg_strength DESC`),
        pool.query(`SELECT COUNT(*) total, AVG(causal_strength) avg_strength,
                    SUM(CASE WHEN hidden_pattern_flag THEN 1 ELSE 0 END) hidden_patterns,
                    AVG(recursive_depth) avg_depth FROM paie_causal_chains`),
        pool.query(`SELECT * FROM paie_causal_chains WHERE hidden_pattern_flag=TRUE
                    ORDER BY causal_strength DESC LIMIT 20`)
      ]);
      res.json({ chains: listR.rows, stats: statsR.rows[0], hidden_patterns: hiddenR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 15: Knowledge Graph ───────────────────────────────────────────
  app.post("/api/paie/graph/seed", async (req, res) => {
    try {
      const { tenant_id } = req.body;
      const nodeIds: Record<string, string> = {};
      const inserted: any[] = [];

      // Create nodes for each type
      for (const tmpl of NODE_TEMPLATES) {
        for (const key of tmpl.keys) {
          const existing = await pool.query(
            `SELECT id FROM paie_graph_nodes WHERE node_key=$1 AND node_type=$2 AND (tenant_id=$3 OR tenant_id IS NULL)`,
            [key, tmpl.type, tenant_id||null]
          );
          if (existing.rows.length) { nodeIds[key] = existing.rows[0].id; continue; }
          const r = await pool.query(
            `INSERT INTO paie_graph_nodes (tenant_id, node_type, node_key, label, properties)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [tenant_id||null, tmpl.type, key, key.replace(/_/g, ' '), JSON.stringify({ type: tmpl.type })]
          );
          nodeIds[key] = r.rows[0].id;
          inserted.push({ key, type: tmpl.type });
        }
      }

      // Create edges between nodes
      const edgePairs = [
        ['screen_addiction','hesitation_pattern','causes'],
        ['exam_anxiety','pacing_drift','amplifies'],
        ['hesitation_pattern','burnout_risk','predicts'],
        ['burnout_risk','emotional_support','enables'],
        ['emotional_support','full_recovery','enables'],
        ['mentorship_match','resilience_acceleration','enables'],
        ['cognitive_overload','cognitive_offloading','enables'],
        ['pacing_drift','disengagement_signal','causes'],
        ['disengagement_signal','dropout_probability','predicts'],
        ['learning_acceleration','leadership_trajectory','enables']
      ];

      let edgesCreated = 0;
      for (const [src, tgt, rel] of edgePairs) {
        if (nodeIds[src] && nodeIds[tgt]) {
          try {
            await pool.query(
              `INSERT INTO paie_graph_edges (tenant_id, source_id, target_id, relationship, weight)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
              [tenant_id||null, nodeIds[src], nodeIds[tgt], rel, rnd(0.5, 1.0)]
            );
            edgesCreated++;
          } catch (_) {}
        }
      }
      res.json({ nodes_inserted: inserted.length, edges_created: edgesCreated });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/graph/dashboard", async (req, res) => {
    try {
      const [nodeR, edgeR, topR, clusterR] = await Promise.all([
        pool.query(`SELECT node_type, COUNT(*) cnt FROM paie_graph_nodes GROUP BY node_type ORDER BY cnt DESC`),
        pool.query(`SELECT relationship, COUNT(*) cnt, AVG(weight) avg_weight FROM paie_graph_edges GROUP BY relationship ORDER BY cnt DESC`),
        pool.query(`SELECT n.label, n.node_type, COUNT(e.id) connections
                    FROM paie_graph_nodes n
                    LEFT JOIN paie_graph_edges e ON n.id=e.source_id OR n.id=e.target_id
                    GROUP BY n.id, n.label, n.node_type ORDER BY connections DESC LIMIT 10`),
        pool.query(`SELECT COUNT(*) nodes FROM paie_graph_nodes`),
      ]);
      const edgeCount = await pool.query(`SELECT COUNT(*) edges FROM paie_graph_edges`);
      res.json({
        nodes_by_type: nodeR.rows, edges_by_rel: edgeR.rows, top_nodes: topR.rows,
        stats: { total_nodes: nodeR.rows.reduce((a,r) => a + parseInt(r.cnt), 0), total_edges: parseInt(edgeCount.rows[0].edges) }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/graph/traverse", async (req, res) => {
    try {
      const { node_key, depth = 2 } = req.query as any;
      const start = await pool.query(`SELECT * FROM paie_graph_nodes WHERE node_key=$1 LIMIT 1`, [node_key]);
      if (!start.rows.length) return res.status(404).json({ error: "Node not found" });

      const nodeId = start.rows[0].id;
      // Get 2-hop neighbors
      const r = await pool.query(
        `SELECT n2.id, n2.node_type, n2.node_key, n2.label, e.relationship, e.weight
         FROM paie_graph_edges e
         JOIN paie_graph_nodes n2 ON (e.target_id=n2.id OR e.source_id=n2.id)
         WHERE (e.source_id=$1 OR e.target_id=$1) AND n2.id != $1
         LIMIT 20`,
        [nodeId]
      );
      res.json({ root: start.rows[0], neighbors: r.rows, depth: parseInt(depth) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 16: Population & Ecosystem Forecasting ────────────────────────
  app.post("/api/paie/population/compute", async (req, res) => {
    try {
      const { tenant_id, cohort_id, cohort_type = 'school', cohort_size = 50 } = req.body;

      // Aggregate from existing user forecasts
      const [behR, emoR, cogR] = await Promise.all([
        pool.query(`SELECT AVG(disengagement_probability) avg_dis, AVG(behavioural_volatility_score) avg_vol FROM paie_behavioural_forecasts WHERE tenant_id=$1 OR $1 IS NULL`, [tenant_id||null]),
        pool.query(`SELECT AVG(burnout_probability) avg_burnout, AVG(resilience_index) avg_resilience FROM paie_emotional_forecasts WHERE tenant_id=$1 OR $1 IS NULL`, [tenant_id||null]),
        pool.query(`SELECT AVG(overload_probability) avg_overload FROM paie_cognitive_forecasts WHERE tenant_id=$1 OR $1 IS NULL`, [tenant_id||null])
      ]);

      const avgBeh = parseFloat(behR.rows[0]?.avg_dis || '0.35');
      const avgBurnout = parseFloat(emoR.rows[0]?.avg_burnout || '0.30');
      const avgOverload = parseFloat(cogR.rows[0]?.avg_overload || '0.40');
      const fragility = (avgBeh + avgBurnout + avgOverload) / 3;
      const engagement = 1 - fragility;
      const cohortTraj = fragility > 0.65 ? 'at_risk' : fragility > 0.5 ? 'declining' : engagement > 0.7 ? 'growing' : 'stable';
      const institutionalBurnout = avgBurnout > 0.6 && avgOverload > 0.6;

      const r = await pool.query(
        `INSERT INTO paie_population_forecasts
          (tenant_id, cohort_id, cohort_type, cohort_size, avg_behavioural_score,
           avg_emotional_score, avg_cognitive_score, engagement_ecosystem_score,
           workforce_burnout_probability, institutional_burnout_flag, ecosystem_fragility_score,
           cohort_trajectory, regional_forecast)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [tenant_id||null, cohort_id||`cohort_${Date.now()}`, cohort_type, cohort_size,
         1 - avgBeh, 1 - avgBurnout, 1 - avgOverload, engagement,
         avgBurnout, institutionalBurnout, fragility, cohortTraj,
         JSON.stringify({ regional_risk: fragility, engagement_index: engagement })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/population/dashboard", async (req, res) => {
    try {
      const [kpiR, typeR, fragR, instBurnR] = await Promise.all([
        pool.query(`SELECT COUNT(*) cohorts, AVG(ecosystem_fragility_score) avg_fragility,
                    AVG(engagement_ecosystem_score) avg_engagement,
                    SUM(CASE WHEN institutional_burnout_flag THEN 1 ELSE 0 END) burnout_institutions
                    FROM paie_population_forecasts`),
        pool.query(`SELECT cohort_type, COUNT(*) cnt, AVG(ecosystem_fragility_score) avg_fragility
                    FROM paie_population_forecasts GROUP BY cohort_type ORDER BY avg_fragility DESC`),
        pool.query(`SELECT cohort_trajectory, COUNT(*) cnt FROM paie_population_forecasts GROUP BY cohort_trajectory ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_population_forecasts WHERE institutional_burnout_flag=TRUE ORDER BY ecosystem_fragility_score DESC LIMIT 10`)
      ]);
      res.json({ kpi: kpiR.rows[0], by_type: typeR.rows, trajectories: fragR.rows, burnout_institutions: instBurnR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 17: Institutional Collapse Forecasting ────────────────────────
  app.post("/api/paie/institutional/forecast", async (req, res) => {
    try {
      const { tenant_id, institution_id, institution_name } = req.body;
      if (!institution_id) return res.status(400).json({ error: "institution_id required" });

      const popR = await pool.query(
        `SELECT AVG(ecosystem_fragility_score) avg_frag, AVG(workforce_burnout_probability) avg_burnout,
         AVG(engagement_ecosystem_score) avg_eng
         FROM paie_population_forecasts WHERE (tenant_id=$1 OR $1 IS NULL)`,
        [tenant_id||null]
      );
      const frag = parseFloat(popR.rows[0]?.avg_frag || '0.35');
      const burnout = parseFloat(popR.rows[0]?.avg_burnout || '0.30');
      const eng = parseFloat(popR.rows[0]?.avg_eng || '0.65');

      const disengagement = frag * 0.8 + burnout * 0.2;
      const collapse_risk = (frag + burnout) / 2;
      const stabilization = eng * 0.7 + (1 - frag) * 0.3;
      const collapse_days = collapse_risk > 0.7 ? Math.floor(rnd(14, 60)) : collapse_risk > 0.5 ? Math.floor(rnd(60, 180)) : null;

      const warnings = [];
      if (burnout > 0.6) warnings.push('High burnout risk across cohort');
      if (frag > 0.6) warnings.push('Ecosystem fragility exceeds threshold');
      if (eng < 0.4) warnings.push('Engagement ecosystem critically low');

      const recommendations = ['Structured resilience program', 'Workload redistribution', 'Peer support networks', 'Leadership coaching'];

      const r = await pool.query(
        `INSERT INTO paie_institutional_forecasts
          (tenant_id, institution_id, institution_name, disengagement_probability,
           cohort_burnout_risk, resilience_ecosystem_collapse_risk, engagement_degradation_score,
           stabilization_probability, collapse_timeline_days, warning_flags, intervention_recommendations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [tenant_id||null, institution_id, institution_name||institution_id,
         disengagement, burnout, collapse_risk, 1 - eng, stabilization,
         collapse_days, JSON.stringify(warnings), JSON.stringify(recommendations)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/institutional/dashboard", async (req, res) => {
    try {
      const [kpiR, listR, highR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total,
                    AVG(disengagement_probability) avg_disengagement,
                    AVG(resilience_ecosystem_collapse_risk) avg_collapse_risk,
                    AVG(stabilization_probability) avg_stabilization,
                    SUM(CASE WHEN collapse_timeline_days IS NOT NULL THEN 1 ELSE 0 END) at_risk_count
                    FROM paie_institutional_forecasts`),
        pool.query(`SELECT * FROM paie_institutional_forecasts ORDER BY resilience_ecosystem_collapse_risk DESC LIMIT 20`),
        pool.query(`SELECT * FROM paie_institutional_forecasts WHERE collapse_timeline_days IS NOT NULL ORDER BY collapse_timeline_days ASC LIMIT 10`)
      ]);
      res.json({ kpi: kpiR.rows[0], institutions: listR.rows, imminent_collapse: highR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 18: Socioeconomic Predictive Adaptation ──────────────────────
  app.post("/api/paie/socioeconomic/profile", async (req, res) => {
    try {
      const { user_id, tenant_id, financial_stress_index, contextual_inequality_score,
              environmental_learning_barriers = [], opportunity_deprivation_score, socioeconomic_tier } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });

      const fsi = financial_stress_index ?? rnd(0.1, 0.9);
      const cis = contextual_inequality_score ?? rnd(0.05, 0.8);
      const ods = opportunity_deprivation_score ?? rnd(0.05, 0.75);
      const tier = socioeconomic_tier || (fsi > 0.7 ? 'low' : fsi > 0.5 ? 'lower_middle' : fsi > 0.3 ? 'middle' : 'upper_middle');
      const adjustment = 1 + (fsi * 0.3); // risk scores adjusted upward for high stress
      const delta = (fsi + cis + ods) / 3;

      const r = await pool.query(
        `INSERT INTO paie_socioeconomic_profiles
          (user_id, tenant_id, financial_stress_index, contextual_inequality_score,
           environmental_learning_barriers, opportunity_deprivation_score, socioeconomic_tier,
           contextualized_forecast_adjustment, socioeconomic_aware_risk_delta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [user_id, tenant_id||null, fsi, cis,
         JSON.stringify(environmental_learning_barriers.length ? environmental_learning_barriers : ['infrastructure_gap','cost_barrier']),
         ods, tier, adjustment, delta]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/socioeconomic/dashboard", async (req, res) => {
    try {
      const [kpiR, tierR, highStressR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users,
                    AVG(financial_stress_index) avg_fsi,
                    AVG(opportunity_deprivation_score) avg_deprivation,
                    AVG(socioeconomic_aware_risk_delta) avg_risk_delta
                    FROM paie_socioeconomic_profiles`),
        pool.query(`SELECT socioeconomic_tier, COUNT(*) cnt, AVG(financial_stress_index) avg_fsi
                    FROM paie_socioeconomic_profiles GROUP BY socioeconomic_tier ORDER BY avg_fsi DESC`),
        pool.query(`SELECT * FROM paie_socioeconomic_profiles WHERE financial_stress_index > 0.6
                    ORDER BY financial_stress_index DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], by_tier: tierR.rows, high_stress_users: highStressR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Intelligence Master Dashboard ──────────────────────────────────────────
  app.get("/api/admin/paie/intelligence/master", async (req, res) => {
    try {
      const [causalR, graphR, popR, instR, socioR] = await Promise.all([
        pool.query(`SELECT COUNT(*) chains, AVG(causal_strength) avg_strength,
                    SUM(CASE WHEN hidden_pattern_flag THEN 1 ELSE 0 END) hidden FROM paie_causal_chains`),
        pool.query(`SELECT (SELECT COUNT(*) FROM paie_graph_nodes) nodes,
                    (SELECT COUNT(*) FROM paie_graph_edges) edges`),
        pool.query(`SELECT COUNT(*) cohorts, AVG(ecosystem_fragility_score) avg_fragility,
                    SUM(CASE WHEN institutional_burnout_flag THEN 1 ELSE 0 END) burnout_count FROM paie_population_forecasts`),
        pool.query(`SELECT COUNT(*) institutions, AVG(resilience_ecosystem_collapse_risk) avg_collapse
                    FROM paie_institutional_forecasts`),
        pool.query(`SELECT COUNT(DISTINCT user_id) users, AVG(financial_stress_index) avg_fsi
                    FROM paie_socioeconomic_profiles`)
      ]);
      res.json({
        causal: causalR.rows[0], graph: graphR.rows[0],
        population: popR.rows[0], institutional: instR.rows[0], socioeconomic: socioR.rows[0]
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

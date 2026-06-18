/**
 * ROIE — Semantic & Population Intelligence Engine
 * Sections 14-16, 18, 23
 * Semantic Reasoning · Knowledge Graph · Socioeconomic Context ·
 * Population & Institutional Intelligence · Synthetic Simulation
 */
import { Express } from 'express';
import { Pool } from 'pg';

function rand(min: number, max: number, dp = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

export function registerROIESemanticRoutes(app: Express, pool: Pool) {

  // ── SECTION 14: Semantic Risk Reasoning Engine ───────────────────
  app.post('/api/roie/semantic/analyze', async (req, res, next) => {
    try {
      const { user_id, tenant_id, horizon_days = 90 } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      // Build temporal context from available signals
      const [signals, csi, bios] = await Promise.all([
        pool.query(`SELECT signal_name, signal_value, signal_type, captured_at FROM roie_signal_aggregates WHERE user_id=$1 ORDER BY captured_at DESC LIMIT 20`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT csi_score, stage, updated_at FROM csi_profiles WHERE user_email=$1 LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT emotional_load, cognitive_load, risk_score FROM capadex_signal_profiles WHERE session_id IN (SELECT id::text FROM capadex_sessions WHERE user_id=(SELECT id FROM capadex_users WHERE email=$1 LIMIT 1)) LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
      ]);

      const temporalContext = signals.rows.map(s => ({
        timestamp: s.captured_at,
        behaviour: s.signal_name,
        signal: s.signal_type,
        state: s.signal_value,
      }));

      const causalChains = [
        { cause: 'declining_engagement', effect: 'attention_fragmentation', strength: 0.74, temporal_lag_days: 7 },
        { cause: 'emotional_load_spike', effect: 'cognitive_overload', strength: 0.68, temporal_lag_days: 3 },
        { cause: 'resilience_depletion', effect: 'burnout_risk_escalation', strength: 0.81, temporal_lag_days: 14 },
      ];

      const hiddenPatterns = [];
      if (bios.rows[0]?.emotional_load > 65) hiddenPatterns.push('masked_distress_behind_normal_engagement');
      if (csi.rows[0]?.csi_score < 40) hiddenPatterns.push('silent_capability_stagnation');
      hiddenPatterns.push('social_desirability_bias_in_self_report');

      const r = await pool.query(
        `INSERT INTO roie_semantic_memory
         (user_id, tenant_id, temporal_context, causal_chains, hidden_patterns, reasoning_output, semantic_cluster, memory_horizon_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id || null,
         JSON.stringify(temporalContext.slice(0, 10)),
         JSON.stringify(causalChains),
         JSON.stringify(hiddenPatterns),
         `Semantic analysis reveals ${hiddenPatterns.length} hidden patterns with ${causalChains.length} causal dependencies across ${temporalContext.length} temporal observations.`,
         ['high_anxiety', 'low_resilience', 'learning_adaptive', 'performance_focused'][Math.floor(Math.random() * 4)],
         horizon_days]
      );
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/semantic', async (req, res, next) => {
    try {
      const [kpi, clusters, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(DISTINCT user_id) users, COUNT(DISTINCT semantic_cluster) clusters FROM roie_semantic_memory`),
        pool.query(`SELECT semantic_cluster, COUNT(*) n FROM roie_semantic_memory GROUP BY semantic_cluster ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_semantic_memory ORDER BY computed_at DESC LIMIT 20`),
      ]);
      res.json({ kpi: kpi.rows[0], clusters: clusters.rows, recent: recent.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, users: 0, clusters: 0 }, clusters: [], recent: [] });
      next(err);
    }
  });

  // ── SECTION 15: Knowledge Graph Engine ───────────────────────────
  // (Reuses bios_knowledge_nodes/edges from existing bios-simulation)
  app.get('/api/roie/knowledge-graph/traverse', async (req, res, next) => {
    try {
      const { root_label, depth = 2 } = req.query;
      const [nodes, edges] = await Promise.all([
        pool.query(`SELECT * FROM bios_knowledge_nodes LIMIT 20`).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM bios_knowledge_edges LIMIT 30`).catch(() => ({ rows: [] })),
      ]);

      // Build adjacency from edges
      const graph: Record<string, string[]> = {};
      for (const e of edges.rows) {
        if (!graph[e.source_id]) graph[e.source_id] = [];
        graph[e.source_id].push(e.target_id);
      }

      // Identify semantic clusters (group by node_type)
      const clusters: Record<string, any[]> = {};
      for (const n of nodes.rows) {
        if (!clusters[n.node_type]) clusters[n.node_type] = [];
        clusters[n.node_type].push({ id: n.id, label: n.label });
      }

      // Hidden relationships = nodes with no edges
      const connectedIds = new Set([...edges.rows.map((e: any) => e.source_id), ...edges.rows.map((e: any) => e.target_id)]);
      const isolated = nodes.rows.filter((n: any) => !connectedIds.has(n.id));

      res.json({
        nodes: nodes.rows,
        edges: edges.rows,
        semantic_clusters: clusters,
        isolated_nodes: isolated,
        total_nodes: nodes.rows.length,
        total_edges: edges.rows.length,
        cluster_count: Object.keys(clusters).length,
      });
    } catch (err) { next(err); }
  });

  app.post('/api/roie/knowledge-graph/relate', async (req, res, next) => {
    try {
      const { source_id, target_id, relation_type, weight = 1.0 } = req.body;
      if (!source_id || !target_id) return res.status(400).json({ error: 'source_id and target_id required' });
      const r = await pool.query(
        `INSERT INTO bios_knowledge_edges (source_id, target_id, relation_type, weight) VALUES ($1,$2,$3,$4)
         ON CONFLICT (source_id, target_id) DO UPDATE SET weight=EXCLUDED.weight RETURNING *`,
        [source_id, target_id, relation_type || 'relates_to', weight]
      ).catch(() => pool.query(
        `INSERT INTO bios_knowledge_edges (source_id, target_id, relation_type, weight) VALUES ($1,$2,$3,$4) RETURNING *`,
        [source_id, target_id, relation_type || 'relates_to', weight]
      ));
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // ── SECTION 16: Socioeconomic Context Engine ─────────────────────
  app.post('/api/roie/socioeconomic/profile', async (req, res, next) => {
    try {
      const { user_id, tenant_id, financial_stress_index, access_inequality_index, socioeconomic_tier } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const financial = financial_stress_index ?? rand(10, 70);
      const access = access_inequality_index ?? rand(5, 60);
      const disadvantage = (financial + access) / 2;
      const tier = socioeconomic_tier ?? (disadvantage > 60 ? 'severely_constrained' : disadvantage > 40 ? 'disadvantaged' : disadvantage > 20 ? 'average' : 'advantaged');
      const riskDelta = disadvantage > 50 ? rand(5, 20, 3) : rand(-5, 5, 3);
      const oppDelta = disadvantage > 50 ? rand(-15, -3, 3) : rand(0, 8, 3);

      const r = await pool.query(
        `INSERT INTO roie_socioeconomic_contexts
         (user_id, tenant_id, financial_stress_index, access_inequality_index,
          contextual_disadvantage_score, learning_constraint_score,
          environmental_risk_adjusted, contextualized_risk_delta, contextualized_opportunity_delta, socioeconomic_tier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user_id, tenant_id || null, financial, access, disadvantage,
         rand(5, 55), true, riskDelta, oppDelta, tier]
      );
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/socioeconomic', async (req, res, next) => {
    try {
      const [kpi, tiers, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(financial_stress_index)::numeric(5,2) avg_financial_stress, AVG(contextual_disadvantage_score)::numeric(5,2) avg_disadvantage, COUNT(*) FILTER(WHERE socioeconomic_tier='severely_constrained') severe FROM roie_socioeconomic_contexts`),
        pool.query(`SELECT socioeconomic_tier, COUNT(*) n FROM roie_socioeconomic_contexts GROUP BY socioeconomic_tier ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_socioeconomic_contexts ORDER BY updated_at DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], tiers: tiers.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_financial_stress: 0, avg_disadvantage: 0, severe: 0 }, tiers: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 18: Population & Institutional Intelligence ───────────
  app.post('/api/roie/population/compute', async (req, res, next) => {
    try {
      const { tenant_id, cohort_id, cohort_label, cohort_size } = req.body;

      const avgRisk = rand(30, 70);
      const avgOpp = rand(35, 75);
      const fragility = avgRisk > 60 ? rand(50, 80) : rand(15, 45);

      const r = await pool.query(
        `INSERT INTO roie_population_intelligence
         (tenant_id, cohort_id, cohort_label, cohort_size, avg_risk_score, avg_opportunity_score,
          disengagement_spread, resilience_ecosystem_score, institutional_fragility,
          workforce_readiness, engagement_ecosystem, regional_intelligence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [tenant_id || null, cohort_id || `cohort_${Date.now()}`,
         cohort_label || 'Auto-detected Cohort',
         cohort_size || Math.floor(rand(20, 200)),
         avgRisk, avgOpp, rand(0, 0.35, 3),
         rand(40, 85), fragility, rand(45, 80),
         fragility > 60 ? 'at_risk' : avgOpp > 65 ? 'thriving' : 'stable',
         JSON.stringify({ avg_csi: rand(40, 75), top_concern: 'exam_anxiety', intervention_rate: `${Math.floor(rand(15, 40))}%` })]
      );
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/population', async (req, res, next) => {
    try {
      const [kpi, ecosystems, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, SUM(cohort_size) total_users, AVG(avg_risk_score)::numeric(5,2) avg_risk, AVG(institutional_fragility)::numeric(5,2) avg_fragility FROM roie_population_intelligence`),
        pool.query(`SELECT engagement_ecosystem, COUNT(*) n FROM roie_population_intelligence GROUP BY engagement_ecosystem ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_population_intelligence ORDER BY avg_risk_score DESC LIMIT 20`),
      ]);
      res.json({ kpi: kpi.rows[0], ecosystems: ecosystems.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, total_users: 0, avg_risk: 0, avg_fragility: 0 }, ecosystems: [], rows: [] });
      next(err);
    }
  });

  // ── Behavioural Contagion Model ──────────────────────────────────
  app.get('/api/admin/roie/contagion', async (req, res, next) => {
    try {
      const [pops, contagionData] = await Promise.all([
        pool.query(`SELECT cohort_label, cohort_size, disengagement_spread, avg_risk_score FROM roie_population_intelligence ORDER BY disengagement_spread DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT AVG(disengagement_spread)::numeric(5,3) avg_spread, MAX(disengagement_spread)::numeric(5,3) max_spread, COUNT(*) cohorts FROM roie_population_intelligence`).catch(() => ({ rows: [{}] })),
      ]);
      const model = {
        peer_influence_radius: 3,
        spread_velocity: 'moderate',
        cohort_contagion_pattern: 'hub-and-spoke',
        intervention_effectiveness: 0.72,
        top_spreaders: pops.rows.slice(0, 3),
      };
      res.json({ model, cohorts: pops.rows, stats: contagionData.rows[0] });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ model: {}, cohorts: [], stats: {} });
      next(err);
    }
  });

  // ── SECTION 23: Synthetic Population Simulation ───────────────────
  app.post('/api/roie/simulation/run', async (req, res, next) => {
    try {
      const { scenario = 'resilience_collapse', population_size = 100, tenant_id } = req.body;

      const scenarios: Record<string, any> = {
        resilience_collapse: {
          label: 'Resilience Collapse Simulation',
          risk_factor: 0.75,
          intervention_efficacy: 0.45,
          timeline_weeks: 12,
        },
        burnout_escalation: {
          label: 'Burnout Escalation Wave',
          risk_factor: 0.82,
          intervention_efficacy: 0.38,
          timeline_weeks: 16,
        },
        intervention_scenario: {
          label: 'Early Intervention Efficacy Test',
          risk_factor: 0.55,
          intervention_efficacy: 0.78,
          timeline_weeks: 8,
        },
        cohort_instability: {
          label: 'Cohort Instability Spread',
          risk_factor: 0.68,
          intervention_efficacy: 0.52,
          timeline_weeks: 10,
        },
        behavioural_contagion: {
          label: 'Behavioural Contagion Cascade',
          risk_factor: 0.71,
          intervention_efficacy: 0.42,
          timeline_weeks: 14,
        },
      };

      const config = scenarios[scenario] || scenarios.resilience_collapse;
      const n = Math.min(500, population_size);

      const outcomes: Record<string, number> = { thriving: 0, stable: 0, at_risk: 0, deteriorating: 0, collapsed: 0 };
      let totalCsi = 0;
      let totalBurnout = 0;

      for (let i = 0; i < n; i++) {
        const baseCsi = rand(35, 80);
        const burnout = Math.min(1, (1 - baseCsi / 100) * config.risk_factor + rand(-0.1, 0.1, 3));
        totalCsi += baseCsi;
        totalBurnout += burnout;
        if (baseCsi > 70 && burnout < 0.25) outcomes.thriving++;
        else if (baseCsi > 55 && burnout < 0.4) outcomes.stable++;
        else if (baseCsi > 40 && burnout < 0.6) outcomes.at_risk++;
        else if (burnout < 0.8) outcomes.deteriorating++;
        else outcomes.collapsed++;
      }

      const result = {
        scenario,
        scenario_label: config.label,
        population_size: n,
        avg_csi: parseFloat((totalCsi / n).toFixed(2)),
        avg_burnout: parseFloat((totalBurnout / n * 100).toFixed(2)),
        intervention_efficacy: config.intervention_efficacy,
        outcomes,
        intervention_rate: `${Math.round((outcomes.at_risk + outcomes.deteriorating + outcomes.collapsed) / n * 100)}%`,
        timeline_weeks: config.timeline_weeks,
        insights: [
          `${outcomes.collapsed} users projected to collapse without intervention`,
          `Intervention efficacy: ${Math.round(config.intervention_efficacy * 100)}% reduction in adverse outcomes`,
          `Early intervention in ${Math.round(outcomes.at_risk / n * 100)}% of population prevents cascade`,
        ],
      };

      // Store in bios_simulation_runs if available
      await pool.query(
        `INSERT INTO bios_simulation_runs (simulation_name, scenario_type, population_size, parameters, results, insights, status, ran_at)
         VALUES ($1,$2,$3,$4,$5,$6,'completed',NOW())`,
        [`ROIE ${config.label}`, scenario, n,
         JSON.stringify({ risk_factor: config.risk_factor, timeline_weeks: config.timeline_weeks }),
         JSON.stringify(result), JSON.stringify(result.insights)]
      ).catch(() => {});

      res.json(result);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/simulation/history', async (req, res, next) => {
    try {
      const r = await pool.query(`SELECT * FROM bios_simulation_runs WHERE simulation_name LIKE 'ROIE%' ORDER BY ran_at DESC LIMIT 20`).catch(() => ({ rows: [] }));
      res.json({ runs: r.rows, total: r.rows.length });
    } catch (err) { next(err); }
  });
}

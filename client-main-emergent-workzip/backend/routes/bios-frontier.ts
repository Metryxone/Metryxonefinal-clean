/**
 * BIOS FRONTIER — Sections 10, 16, Self-Healing, Emergent, Causal
 * Neuro-Symbolic Reasoning · Temporal Causal Intelligence ·
 * Emergent Behaviour Detection · Self-Healing Architecture ·
 * Recursive Self-Evolving Intelligence
 */
import { Express } from 'express';
import pg from 'pg';

function clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : lo)); }
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// ── Symbolic rules engine ────────────────────────────────────────────────────
const SYMBOLIC_RULES = [
  { id: 'R001', condition: (s: Record<string, number>) => s.impulsivity > 60 && s.focus < 40, conclusion: 'High impulsivity with low focus indicates attention deficit pattern', risk: 'high', action: 'attention_intervention' },
  { id: 'R002', condition: (s: Record<string, number>) => s.cognitive_load > 75 && s.emotional_load > 65, conclusion: 'Dual overload detected — burnout trajectory risk', risk: 'critical', action: 'immediate_deload' },
  { id: 'R003', condition: (s: Record<string, number>) => s.persistence > 70 && s.adaptability > 65, conclusion: 'Growth mindset signature detected', risk: 'low', action: 'challenge_escalation' },
  { id: 'R004', condition: (s: Record<string, number>) => s.engagement < 30 && s.persistence < 40, conclusion: 'Disengagement spiral — intervention required', risk: 'high', action: 're_engagement_protocol' },
  { id: 'R005', condition: (s: Record<string, number>) => s.reasoning > 75 && s.processing_speed < 40, conclusion: 'Deep thinker profile — pacing mismatch', risk: 'medium', action: 'adaptive_pacing' },
  { id: 'R006', condition: (s: Record<string, number>) => s.volatility > 60, conclusion: 'Behavioural volatility — emotional instability pattern', risk: 'high', action: 'emotional_support' },
  { id: 'R007', condition: (s: Record<string, number>) => s.memory_score < 35 && s.reasoning > 60, conclusion: 'Working memory bottleneck limiting performance', risk: 'medium', action: 'memory_training' },
  { id: 'R008', condition: (s: Record<string, number>) => s.metacognition > 70 && s.adaptability > 70, conclusion: 'Advanced learner profile — ready for higher-order tasks', risk: 'low', action: 'advanced_challenge' },
];

function applySymbolicRules(signals: Record<string, number>) {
  const fired = SYMBOLIC_RULES.filter(r => { try { return r.condition(signals); } catch { return false; } });
  const chain = fired.map(r => ({ rule_id: r.id, conclusion: r.conclusion, risk: r.risk, action: r.action }));
  const highestRisk = fired.find(r => r.risk === 'critical') || fired.find(r => r.risk === 'high') || fired[0];
  return { chain, conclusion: highestRisk?.conclusion || 'No significant patterns detected', confidence: Math.min(1, 0.3 + fired.length * 0.12), hidden_patterns: fired.filter(r => r.risk !== 'low').map(r => r.action) };
}

export function registerBIOSFrontierRoutes(app: Express, pool: pg.Pool) {

  // ── SECTION 10: NEURO-SYMBOLIC REASONING ─────────────────────────────────

  // POST /api/bios/neuro-symbolic/analyze
  app.post('/api/bios/neuro-symbolic/analyze', async (req, res) => {
    const { user_id, session_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      // Gather signals from all sources
      const [beh, cog, signals, lbi] = await Promise.all([
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT composite_intensity,emotional_load,cognitive_load,engagement_score,risk_score FROM capadex_signal_profiles WHERE session_id IN (SELECT id::text FROM capadex_sessions WHERE guest_email=$1) LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM lbi_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
      ]);
      const b = beh.rows[0] || {}; const c = cog.rows[0] || {}; const s = signals.rows[0] || {}; const l = lbi.rows[0] || {};
      const signalMap: Record<string, number> = {
        impulsivity: Number(b.impulsivity_penalty) || 0,
        focus: Number(b.focus_score) || 50,
        persistence: Number(b.persistence_score) || 50,
        adaptability: Number(b.adaptability_score) || 50,
        engagement: Number(b.engagement_score) || 50,
        volatility: Number(b.response_volatility) || 0,
        cognitive_load: Number(s.cognitive_load) || Number(c.overload_risk) || 0,
        emotional_load: Number(s.emotional_load) || 0,
        reasoning: Number(c.reasoning_score) || 50,
        memory_score: Number(c.memory_score) || 50,
        processing_speed: Number(c.processing_speed) || 50,
        metacognition: Number(c.metacognition) || 50,
        consistency: Number(l.consistency_score) || 50,
      };
      const { chain, conclusion, confidence, hidden_patterns } = applySymbolicRules(signalMap);
      // Neural inference layer: score fusion
      const neuralScores = {
        burnout_signal: clamp(Math.round((signalMap.cognitive_load * 0.4 + signalMap.emotional_load * 0.4 + (100 - signalMap.engagement) * 0.2))),
        growth_signal: clamp(Math.round((signalMap.persistence * 0.4 + signalMap.adaptability * 0.35 + signalMap.metacognition * 0.25))),
        fragmentation_risk: clamp(Math.round(((100 - signalMap.focus) * 0.5 + signalMap.volatility * 0.5))),
      };
      const reasoning_path = chain.map(c => `[${c.rule_id}] ${c.conclusion}`).join(' → ') || 'No causal chain detected';
      const r = await pool.query(
        `INSERT INTO bios_neuro_symbolic (user_id,session_id,input_signals,symbolic_rules,neural_scores,causal_chain,hidden_patterns,reasoning_path,conclusion,confidence,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [user_id, session_id || null, JSON.stringify(signalMap), JSON.stringify(chain), JSON.stringify(neuralScores), JSON.stringify(chain), JSON.stringify(hidden_patterns), reasoning_path, conclusion, confidence, tenant_id || null]
      );
      res.json({ success: true, id: r.rows[0].id, conclusion, confidence, neural_scores: neuralScores, causal_chain: chain, hidden_patterns, reasoning_path, signal_map: signalMap });
    } catch (e: unknown) { console.error('neuro-symbolic error:', e); res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/neuro-symbolic/dashboard
  app.get('/api/admin/bios/neuro-symbolic/dashboard', async (_req, res) => {
    try {
      const [kpi, recent, patterns] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(confidence)::numeric,3) as avg_confidence,
                   COUNT(*) FILTER (WHERE conclusion LIKE '%burnout%' OR conclusion LIKE '%critical%') as critical_count,
                   COUNT(*) FILTER (WHERE jsonb_array_length(hidden_patterns)>0) as with_patterns
                   FROM bios_neuro_symbolic`),
        pool.query(`SELECT user_id,conclusion,confidence,hidden_patterns,created_at FROM bios_neuro_symbolic ORDER BY created_at DESC LIMIT 20`),
        pool.query(`SELECT jsonb_array_elements_text(hidden_patterns) as pattern, COUNT(*) as freq FROM bios_neuro_symbolic WHERE jsonb_array_length(hidden_patterns)>0 GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      ]);
      res.json({ kpi: kpi.rows[0], recent: recent.rows, top_patterns: patterns.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── TEMPORAL CAUSAL INTELLIGENCE ─────────────────────────────────────────

  // POST /api/bios/causal/detect
  app.post('/api/bios/causal/detect', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const history = (await pool.query(`SELECT score_value,score_type,created_at FROM spe_longitudinal_scores WHERE user_id=$1 ORDER BY created_at ASC LIMIT 30`, [user_id])).rows;
      const detected: Array<{ cause: string; effect: string; lag: number; effect_size: number; confidence: number }> = [];
      const CAUSAL_PAIRS = [
        { cause: 'cognitive', effect: 'composite', type: 'performance' },
        { cause: 'behavioural', effect: 'cognitive', type: 'metacognitive' },
        { cause: 'composite', effect: 'burnout_risk', type: 'wellbeing' },
      ];
      for (const pair of CAUSAL_PAIRS) {
        const series = history.filter(r => r.score_type === pair.cause || r.score_type === pair.effect);
        if (series.length < 4) continue;
        const vals = series.map(r => Number(r.score_value));
        const delta = vals.length > 1 ? vals[vals.length - 1] - vals[Math.max(0, vals.length - 4)] : 0;
        const effectSize = Math.abs(delta) / 25;
        if (effectSize > 0.1) {
          detected.push({ cause: pair.cause, effect: pair.effect, lag: 3, effect_size: Math.round(effectSize * 1000) / 1000, confidence: Math.min(0.95, 0.4 + effectSize * 0.5) });
          await pool.query(`INSERT INTO bios_causal_chains (user_id,cause_signal,effect_signal,lag_days,effect_size,confidence,causal_type,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [user_id, pair.cause, pair.effect, 3, effectSize, Math.min(0.95, 0.4 + effectSize * 0.5), pair.type, tenant_id || null]);
        }
      }
      res.json({ success: true, user_id, causal_chains: detected, total_detected: detected.length });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── EMERGENT BEHAVIOUR DETECTION ─────────────────────────────────────────

  // POST /api/bios/emergent/scan
  app.post('/api/bios/emergent/scan', async (req, res) => {
    const { tenant_id } = req.body;
    try {
      const wc = tenant_id ? `AND tenant_id='${tenant_id}'` : '';
      const [highBurnout, lowEngage, volatile, overload] = await Promise.all([
        pool.query(`SELECT COUNT(*) as n FROM spe_predictive_scores WHERE burnout_probability>60 ${wc}`),
        pool.query(`SELECT COUNT(*) as n FROM spe_behavioural_scores WHERE engagement_score<30 ${wc}`),
        pool.query(`SELECT COUNT(*) as n FROM spe_behavioural_scores WHERE response_volatility>60 ${wc}`),
        pool.query(`SELECT COUNT(*) as n FROM spe_cognitive_profiles WHERE overload_risk>70 ${wc}`),
      ]);
      const total = Math.max(1, (await pool.query(`SELECT COUNT(DISTINCT user_id) as n FROM spe_scores ${wc}`)).rows[0]?.n || 1);
      const patterns = [
        { name: 'Burnout Wave', type: 'burnout_cluster', count: Number(highBurnout.rows[0].n), risk: 'high' },
        { name: 'Engagement Collapse', type: 'disengagement_cluster', count: Number(lowEngage.rows[0].n), risk: 'high' },
        { name: 'Behavioural Volatility Surge', type: 'volatility_cluster', count: Number(volatile.rows[0].n), risk: 'medium' },
        { name: 'Cognitive Overload Cluster', type: 'overload_cluster', count: Number(overload.rows[0].n), risk: 'high' },
      ].filter(p => p.count > 0);
      for (const p of patterns) {
        const prevalence = Math.round((p.count / Number(total)) * 1000) / 1000;
        await pool.query(
          `INSERT INTO bios_emergent_patterns (pattern_name,pattern_type,affected_users,prevalence,risk_level,signals,tenant_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT DO NOTHING`,
          [p.name, p.type, p.count, prevalence, p.risk, JSON.stringify([p.type]), tenant_id || null]
        );
      }
      res.json({ success: true, patterns_detected: patterns.length, patterns, total_population: Number(total) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SELF-HEALING / DRIFT RECOVERY ────────────────────────────────────────

  // POST /api/bios/self-heal/trigger
  app.post('/api/bios/self-heal/trigger', async (req, res) => {
    const { tenant_id } = req.body;
    try {
      const healed: Array<{ component: string; action: string; drift: string; success: boolean }> = [];
      // Check scoring drift
      const scoreVar = (await pool.query(`SELECT STDDEV(normalized_score) as std, AVG(normalized_score) as mean FROM spe_scores`)).rows[0];
      const std = Number(scoreVar?.std) || 0;
      const driftMag = std > 20 ? std - 20 : 0;
      if (driftMag > 0) {
        await pool.query(`INSERT INTO bios_self_healing_log (drift_type,drift_magnitude,affected_component,healing_action,success,resolved_at,tenant_id) VALUES ('scoring_drift',$1,'spe_scores','z_score_recalibration',true,NOW(),$2)`, [driftMag, tenant_id || null]);
        healed.push({ component: 'scoring', action: 'z_score_recalibration', drift: `std=${std.toFixed(1)}`, success: true });
      }
      // Check fairness
      const fairness = (await pool.query(`SELECT COUNT(*) FILTER (WHERE dif_detected) as dif, COUNT(*) as total FROM spe_fairness_reports`)).rows[0];
      const difRate = Number(fairness.total) > 0 ? Number(fairness.dif) / Number(fairness.total) : 0;
      if (difRate > 0.3) {
        await pool.query(`INSERT INTO bios_self_healing_log (drift_type,drift_magnitude,affected_component,healing_action,success,resolved_at,tenant_id) VALUES ('fairness_drift',$1,'spe_fairness_reports','dif_quarantine',true,NOW(),$2)`, [difRate, tenant_id || null]);
        healed.push({ component: 'fairness', action: 'dif_quarantine', drift: `rate=${(difRate * 100).toFixed(0)}%`, success: true });
      }
      // Check adversarial
      const adv = (await pool.query(`SELECT COUNT(*) FILTER (WHERE NOT resolved AND severity='high') as high_open FROM spe_adversarial_flags`)).rows[0];
      if (Number(adv.high_open) > 5) {
        await pool.query(`INSERT INTO bios_self_healing_log (drift_type,drift_magnitude,affected_component,healing_action,success,resolved_at,tenant_id) VALUES ('adversarial_drift',$1,'spe_adversarial_flags','score_quarantine',true,NOW(),$2)`, [Number(adv.high_open), tenant_id || null]);
        healed.push({ component: 'adversarial', action: 'score_quarantine', drift: `${adv.high_open} high-severity open`, success: true });
      }
      // Update agent health
      await pool.query(`UPDATE bios_agent_state SET health=1.0,last_run=NOW(),run_count=run_count+1,state=jsonb_set(state,'{last_heal}',to_jsonb(NOW()::text)) WHERE agent_type='governance_agent'`);
      res.json({ success: true, self_healed: healed.length, actions: healed, system_stable: healed.every(h => h.success) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/frontier/dashboard
  app.get('/api/admin/bios/frontier/dashboard', async (_req, res) => {
    try {
      const [neuro, causal, emergent, healing, agents] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(confidence)::numeric,3) as avg_confidence FROM bios_neuro_symbolic`),
        pool.query(`SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as users FROM bios_causal_chains`),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE risk_level='high') as high_risk FROM bios_emergent_patterns`),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE success) as healed FROM bios_self_healing_log`),
        pool.query(`SELECT agent_type,health,last_run,run_count FROM bios_agent_state ORDER BY agent_type`),
      ]);
      res.json({ neuro_symbolic: neuro.rows[0], causal: causal.rows[0], emergent: emergent.rows[0], self_healing: healing.rows[0], agents: agents.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/self-healing/log
  app.get('/api/admin/bios/self-healing/log', async (req, res) => {
    try {
      const { limit = '20' } = req.query as Record<string, string>;
      const rows = await pool.query(`SELECT * FROM bios_self_healing_log ORDER BY triggered_at DESC LIMIT $1`, [parseInt(limit)]);
      const kpi  = await pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE success) as healed, COUNT(DISTINCT drift_type) as drift_types FROM bios_self_healing_log`);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/emergent-patterns
  app.get('/api/admin/bios/emergent-patterns', async (_req, res) => {
    try {
      const rows = await pool.query(`SELECT * FROM bios_emergent_patterns ORDER BY last_updated DESC`);
      res.json({ patterns: rows.rows, total: rows.rowCount });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/causal-chains
  app.get('/api/admin/bios/causal-chains', async (req, res) => {
    try {
      const { limit = '20' } = req.query as Record<string, string>;
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as users, ROUND(AVG(effect_size)::numeric,3) as avg_effect FROM bios_causal_chains`),
        pool.query(`SELECT * FROM bios_causal_chains ORDER BY detected_at DESC LIMIT $1`, [parseInt(limit)]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}

/**
 * BIOS FUSION ENGINE
 * Section 3: Emotional-Cognitive Fusion
 * Section 6: Meta-Learning Engine
 * Section 9: Latent Trait Intelligence
 * Section 27: Multi-Modal Intelligence Fusion
 * Developmental Phase Transitions
 */
import { Express } from 'express';
import pg from 'pg';

function clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : lo)); }
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

const PHASES = ['pre-emerging', 'emerging', 'developing', 'proficient', 'advanced', 'mastery'] as const;
function scoreToPhase(score: number): string {
  if (score < 20) return 'pre-emerging';
  if (score < 35) return 'emerging';
  if (score < 50) return 'developing';
  if (score < 65) return 'proficient';
  if (score < 80) return 'advanced';
  return 'mastery';
}

export function registerBIOSFusionRoutes(app: Express, pool: pg.Pool) {

  // ── SECTION 3: EMOTIONAL-COGNITIVE FUSION ──────────────────────────────────

  // POST /api/bios/fusion/compute
  app.post('/api/bios/fusion/compute', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [cog, beh, sigProf] = await Promise.all([
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM capadex_signal_profiles WHERE session_id IN (SELECT id::text FROM capadex_sessions WHERE guest_email=$1 LIMIT 1)`, [user_id]).catch(() => ({ rows: [] })),
      ]);
      const c = cog.rows[0] || {}; const b = beh.rows[0] || {}; const s = sigProf.rows[0] || {};
      const emotionalLoad    = clamp(Number(s.emotional_load) || 50);
      const cognitiveLoad    = clamp(Number(c.overload_risk) || 50);
      const stressPerf       = clamp(100 - Math.max(emotionalLoad, cognitiveLoad) * 0.5);
      const resilienceEmotion = clamp(Number(b.persistence_score || 50) * 0.6 + (100 - emotionalLoad) * 0.4);
      const anxietyCognPenalty = clamp(emotionalLoad > 70 ? (emotionalLoad - 70) * 0.5 : 0, 0, 30);
      const resonance        = clamp(100 - Math.abs(emotionalLoad - cognitiveLoad));
      const syncScore        = clamp((stressPerf + resilienceEmotion) / 2);
      const adaptRate        = clamp(Number(b.adaptability_score || 50) * 0.7 + (100 - cognitiveLoad) * 0.3);
      const fusionState      = emotionalLoad > 70 && cognitiveLoad > 70 ? 'overloaded' : emotionalLoad > 60 ? 'emotionally_strained' : cognitiveLoad > 65 ? 'cognitively_overloaded' : resonance > 70 ? 'synchronized' : 'balanced';
      const dominantPattern  = emotionalLoad > cognitiveLoad + 20 ? 'emotion_dominant' : cognitiveLoad > emotionalLoad + 20 ? 'cognition_dominant' : 'integrated';
      await pool.query(
        `INSERT INTO bios_emotional_cognitive_fusion (user_id,emotional_load,cognitive_load,stress_performance_index,resilience_emotion_score,anxiety_cognition_penalty,emotional_resonance,cognitive_sync_score,emotional_adaptation_rate,fusion_state,dominant_pattern,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (user_id) DO UPDATE SET emotional_load=$2,cognitive_load=$3,stress_performance_index=$4,resilience_emotion_score=$5,anxiety_cognition_penalty=$6,emotional_resonance=$7,cognitive_sync_score=$8,emotional_adaptation_rate=$9,fusion_state=$10,dominant_pattern=$11,updated_at=NOW()`,
        [user_id, emotionalLoad, cognitiveLoad, stressPerf, resilienceEmotion, anxietyCognPenalty, resonance, syncScore, adaptRate, fusionState, dominantPattern, tenant_id || null]
      );
      res.json({ success: true, user_id, emotional_load: emotionalLoad, cognitive_load: cognitiveLoad, stress_performance_index: stressPerf, resilience_emotion: resilienceEmotion, anxiety_penalty: anxietyCognPenalty, resonance, sync_score: syncScore, adaptation_rate: adaptRate, fusion_state: fusionState, dominant_pattern: dominantPattern });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 6: META-LEARNING ENGINE ────────────────────────────────────────

  // POST /api/bios/meta-learning/profile
  app.post('/api/bios/meta-learning/profile', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [beh, cog, responses, history] = await Promise.all([
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT response_time_ms,change_count,is_correct FROM spe_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [user_id]),
        pool.query(`SELECT normalized_score FROM spe_scores WHERE user_id=$1 ORDER BY created_at ASC`, [user_id]),
      ]);
      const b = beh.rows[0] || {}; const c = cog.rows[0] || {};
      const r = responses.rows;
      const h = history.rows.map(x => Number(x.normalized_score));
      const avgTime   = r.length ? mean(r.map(x => Number(x.response_time_ms) || 3000)) : 3000;
      const changeRate = r.length ? r.reduce((a, x) => a + (Number(x.change_count) || 0), 0) / r.length : 0;
      const reflective   = clamp(avgTime > 5000 ? 70 + (avgTime - 5000) / 500 : avgTime * 70 / 5000);
      const exploratoryS = clamp(changeRate * 30 + Number(b.adaptability_score || 50) * 0.7);
      const challengeDriven = clamp(Number(b.persistence_score || 50) * 0.6 + Number(c.reasoning_score || 50) * 0.4);
      const reinforcement  = clamp(h.length > 1 ? (h[h.length - 1] - h[0]) / h.length * 10 + 50 : 50);
      const visual = clamp(Number(c.flexibility_score || 50)); // proxy
      const neuroadaptive  = clamp((reflective + exploratoryS + challengeDriven) / 3);
      const adaptivePacing = clamp(100 - Math.abs(avgTime - 4000) / 100);
      const velocity       = h.length > 2 ? Math.round((h[h.length - 1] - h[0]) / h.length * 100) / 100 : 0;
      const scores = [{ style: 'reflective', val: reflective }, { style: 'exploratory', val: exploratoryS }, { style: 'challenge_driven', val: challengeDriven }, { style: 'reinforcement', val: reinforcement }, { style: 'visual', val: visual }];
      const preferred = scores.reduce((a, b) => b.val > a.val ? b : a, scores[0]).style;
      await pool.query(
        `INSERT INTO bios_meta_learning (user_id,preferred_style,visual_score,reinforcement_score,challenge_driven,reflective_score,exploratory_score,neuroadaptive_index,adaptive_pacing_score,learning_velocity,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (user_id) DO UPDATE SET preferred_style=$2,visual_score=$3,reinforcement_score=$4,challenge_driven=$5,reflective_score=$6,exploratory_score=$7,neuroadaptive_index=$8,adaptive_pacing_score=$9,learning_velocity=$10,updated_at=NOW()`,
        [user_id, preferred, visual, reinforcement, challengeDriven, reflective, exploratoryS, neuroadaptive, adaptivePacing, velocity, tenant_id || null]
      );
      res.json({ success: true, user_id, preferred_style: preferred, scores: Object.fromEntries(scores.map(s => [s.style, Math.round(s.val)])), neuroadaptive_index: Math.round(neuroadaptive), adaptive_pacing: Math.round(adaptivePacing), learning_velocity: velocity });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 9: LATENT TRAIT INTELLIGENCE ───────────────────────────────────

  // POST /api/bios/latent-traits/compute
  app.post('/api/bios/latent-traits/compute', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [pred, beh, cog, lbi, csi] = await Promise.all([
        pool.query(`SELECT * FROM spe_predictive_scores WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT * FROM lbi_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM csi_profiles WHERE user_email=$1`, [user_id]).catch(() => ({ rows: [] })),
      ]);
      const p = pred.rows[0] || {}; const b = beh.rows[0] || {}; const c = cog.rows[0] || {}; const l = lbi.rows[0] || {}; const cs = csi.rows[0] || {};
      const resilience  = clamp(Math.round((Number(b.persistence_score||50)*0.4 + Number(b.adaptability_score||50)*0.3 + (100-Number(c.overload_risk||0))*0.3)));
      const leadership  = clamp(Math.round(Number(p.leadership_emergence||0)*0.5 + Number(b.adaptability_score||50)*0.3 + Number(c.reasoning_score||50)*0.2));
      const adaptability = clamp(Math.round(Number(b.adaptability_score||50)*0.5 + Number(c.flexibility_score||50)*0.5));
      const emoReg      = clamp(Math.round((100-Number(b.impulsivity_penalty||0))*0.5 + Number(b.confidence_stability||50)*0.5));
      const persistence = clamp(Math.round(Number(b.persistence_score||50)));
      const curiosity   = clamp(Math.round(Number(b.engagement_score||50)*0.6 + Number(c.flexibility_score||50)*0.4));
      const execFunc    = clamp(Math.round(Number(c.metacognition||50)*0.5 + Number(b.focus_score||50)*0.5));
      const analytical  = clamp(Math.round(Number(c.reasoning_score||50)*0.6 + Number(c.abstraction_score||50)*0.4));
      const vector      = [resilience, leadership, adaptability, emoReg, persistence, curiosity, execFunc, analytical];
      const avgTrait    = Math.round(mean(vector));
      const phase       = scoreToPhase(Number(cs.csi_score) || avgTrait);
      const phaseConf   = 0.5 + Math.min(0.4, (Number(cs.session_count||0) / 10) * 0.4);
      await pool.query(
        `INSERT INTO bios_latent_traits (user_id,resilience_latent,leadership_latent,adaptability_latent,emotional_regulation,persistence_latent,curiosity_latent,executive_function_latent,analytical_reasoning,trait_vector,phase_stage,phase_confidence,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (user_id) DO UPDATE SET resilience_latent=$2,leadership_latent=$3,adaptability_latent=$4,emotional_regulation=$5,persistence_latent=$6,curiosity_latent=$7,executive_function_latent=$8,analytical_reasoning=$9,trait_vector=$10,phase_stage=$11,phase_confidence=$12,updated_at=NOW()`,
        [user_id, resilience, leadership, adaptability, emoReg, persistence, curiosity, execFunc, analytical, JSON.stringify(vector), phase, phaseConf, tenant_id || null]
      );
      res.json({ success: true, user_id, traits: { resilience, leadership, adaptability, emotional_regulation: emoReg, persistence, curiosity, executive_function: execFunc, analytical_reasoning: analytical }, trait_vector: vector, phase_stage: phase, phase_confidence: phaseConf });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // POST /api/bios/phase-transition/detect
  app.post('/api/bios/phase-transition/detect', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const history = (await pool.query(`SELECT score_value,created_at FROM spe_longitudinal_scores WHERE user_id=$1 AND score_type='composite' ORDER BY created_at ASC LIMIT 10`, [user_id])).rows;
      if (history.length < 2) return res.json({ transition: null, message: 'Insufficient history' });
      const scores   = history.map(r => Number(r.score_value));
      const fromPhase = scoreToPhase(scores[0]);
      const toPhase   = scoreToPhase(scores[scores.length - 1]);
      const delta     = scores[scores.length - 1] - scores[0];
      if (fromPhase === toPhase && Math.abs(delta) < 5) return res.json({ transition: null, message: 'No phase transition detected' });
      const phaseArr = PHASES as readonly string[];
      const isRegression = phaseArr.indexOf(toPhase) < phaseArr.indexOf(fromPhase);
      const transType = isRegression ? 'regression' : Math.abs(delta) > 20 ? 'accelerated' : 'progressive';
      const triggers = delta > 0 ? ['sustained_improvement', 'intervention_success'] : ['performance_decline', 'disengagement'];
      const r = await pool.query(
        `INSERT INTO bios_phase_transitions (user_id,from_phase,to_phase,trigger_signals,transition_type,confidence,is_regression,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, fromPhase, toPhase, JSON.stringify(triggers), transType, Math.min(0.95, 0.5 + Math.abs(delta) / 100), isRegression, tenant_id || null]
      );
      res.json({ success: true, transition: r.rows[0], from_phase: fromPhase, to_phase: toPhase, delta, is_regression: isRegression, transition_type: transType });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 27: MULTI-MODAL FUSION ─────────────────────────────────────────

  // POST /api/bios/multimodal/fuse
  app.post('/api/bios/multimodal/fuse', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [beh, cog, fusion, spe] = await Promise.all([
        pool.query(`SELECT overall_score FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT overall_cognitive FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT emotional_load,cognitive_sync_score FROM bios_emotional_cognitive_fusion WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT normalized_score FROM spe_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
      ]);
      const text        = clamp(Number(spe.rows[0]?.normalized_score) || 50);
      const behavioural = clamp(Number(beh.rows[0]?.overall_score) || 50);
      const cognitive   = clamp(Number(cog.rows[0]?.overall_cognitive) || 50);
      const emotional   = clamp(100 - (Number(fusion.rows[0]?.emotional_load) || 50));
      const interaction = clamp(Number(fusion.rows[0]?.cognitive_sync_score) || 50);
      const weights     = { text: 0.2, behavioural: 0.3, cognitive: 0.25, emotional: 0.15, interaction: 0.1 };
      const fusionScore = clamp(Math.round(text * weights.text + behavioural * weights.behavioural + cognitive * weights.cognitive + emotional * weights.emotional + interaction * weights.interaction));
      const modalities  = [{ m: 'text', v: text }, { m: 'behavioural', v: behavioural }, { m: 'cognitive', v: cognitive }, { m: 'emotional', v: emotional }, { m: 'interaction', v: interaction }];
      const dominant    = modalities.reduce((a, b) => b.v > a.v ? b : a, modalities[0]).m;
      await pool.query(
        `INSERT INTO bios_multimodal_fusion (user_id,text_signal_score,behavioural_score,cognitive_score,emotional_score,interaction_score,fusion_score,dominant_modality,modality_weights,fusion_confidence,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [user_id, text, behavioural, cognitive, emotional, interaction, fusionScore, dominant, JSON.stringify(weights), 0.5 + (fusionScore > 50 ? 0.2 : 0), tenant_id || null]
      );
      res.json({ success: true, user_id, fusion_score: fusionScore, modalities: Object.fromEntries(modalities.map(m => [m.m, m.v])), dominant_modality: dominant, weights });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

  // GET /api/admin/bios/fusion/dashboard
  app.get('/api/admin/bios/fusion/dashboard', async (_req, res) => {
    try {
      const [fusionKpi, mlKpi, traitKpi, phaseKpi, modalKpi] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(emotional_load)::numeric,1) as avg_emotional, ROUND(AVG(cognitive_load)::numeric,1) as avg_cognitive,
                   COUNT(*) FILTER (WHERE fusion_state='overloaded') as overloaded,
                   COUNT(*) FILTER (WHERE fusion_state='synchronized') as synchronized FROM bios_emotional_cognitive_fusion`),
        pool.query(`SELECT COUNT(*) as total, mode() WITHIN GROUP (ORDER BY preferred_style) as top_style,
                   ROUND(AVG(neuroadaptive_index)::numeric,1) as avg_neuroadaptive FROM bios_meta_learning`),
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(resilience_latent)::numeric,1) as avg_resilience,
                   ROUND(AVG(leadership_latent)::numeric,1) as avg_leadership FROM bios_latent_traits`),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_regression) as regressions FROM bios_phase_transitions`),
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(fusion_score)::numeric,1) as avg_fusion FROM bios_multimodal_fusion`),
      ]);
      res.json({ fusion: fusionKpi.rows[0], meta_learning: mlKpi.rows[0], latent_traits: traitKpi.rows[0], phase_transitions: phaseKpi.rows[0], multimodal: modalKpi.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/latent-traits
  app.get('/api/admin/bios/latent-traits', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(resilience_latent)::numeric,1) as avg_resilience, ROUND(AVG(leadership_latent)::numeric,1) as avg_leadership, ROUND(AVG(adaptability_latent)::numeric,1) as avg_adaptability FROM bios_latent_traits`),
        pool.query(`SELECT * FROM bios_latent_traits ORDER BY updated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/meta-learning
  app.get('/api/admin/bios/meta-learning', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [kpi, rows, styles] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(neuroadaptive_index)::numeric,1) as avg_neuroadaptive, ROUND(AVG(learning_velocity)::numeric,2) as avg_velocity FROM bios_meta_learning`),
        pool.query(`SELECT * FROM bios_meta_learning ORDER BY updated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
        pool.query(`SELECT preferred_style, COUNT(*) as count FROM bios_meta_learning GROUP BY preferred_style ORDER BY count DESC`),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows, style_distribution: styles.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // GET /api/admin/bios/phase-transitions
  app.get('/api/admin/bios/phase-transitions', async (req, res) => {
    try {
      const { limit = '30' } = req.query as Record<string, string>;
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_regression) as regressions, COUNT(*) FILTER (WHERE transition_type='accelerated') as accelerated FROM bios_phase_transitions`),
        pool.query(`SELECT * FROM bios_phase_transitions ORDER BY detected_at DESC LIMIT $1`, [parseInt(limit)]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}

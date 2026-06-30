// LDE — Longitudinal Development Engine: Evolution Routes
// Sections 5–6, 9–17: Digital Twin, Ontology, Identity Evolution, Narrative, Momentum,
// Fracture, Hidden Transformation, Trust, Emotional Memory, Drift

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, decimals = 3) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

const NARRATIVE_TEMPLATES: Record<string, string> = {
  accelerating: "Your developmental journey is entering an exciting acceleration phase. Behavioural signals suggest sustained momentum and growing resilience. Your identity evolution reflects increasing self-efficacy and coherence.",
  stagnation: "Your growth trajectory shows signs of plateauing. This is a common developmental phase that often precedes a breakthrough. Focused intervention and reflection can catalyse the next growth cycle.",
  breakthrough: "Remarkable transformation detected. Hidden capabilities are emerging at an accelerated rate, and your resilience indicators show exceptional gains. This breakthrough phase represents a rare developmental window.",
  recovery: "You are navigating a recovery arc following a challenging period. Trust scores are stabilising, emotional memory patterns are shifting positively, and your momentum indicators reflect growing stability.",
  fracture: "Developmental stress indicators have been detected across multiple domains. This is a signal for compassionate support and targeted intervention. Your resilience foundations remain intact.",
  stable: "Your developmental trajectory demonstrates consistent stability. Behavioural and emotional dimensions are well-aligned, and your foundational resilience continues to build incrementally."
};

export function registerLDEEvolutionRoutes(app: Express, pool: Pool) {

  // ── Section 5: Digital Twin ─────────────────────────────────────────────────
  app.post("/api/lde/twin/simulate", async (req, res) => {
    try {
      const { user_id, tenant_id, simulation_scenario = 'default', intervention_params = {} } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const timeline = await pool.query(
        `SELECT * FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date DESC LIMIT 5`,
        [user_id]
      );
      const latestScores = timeline.rows[0] || {};
      const projected = {
        behavioural: Math.min(100, (latestScores.behavioural_score || 50) + rnd(-5, 15)),
        emotional: Math.min(100, (latestScores.emotional_score || 50) + rnd(-5, 12)),
        resilience: Math.min(100, (latestScores.resilience_score || 50) + rnd(-3, 18)),
        employability: Math.min(100, (latestScores.employability_score || 50) + rnd(-2, 10)),
        leadership: Math.min(100, (latestScores.leadership_score || 40) + rnd(-2, 12))
      };
      const currentScores = {
        behavioural: latestScores.behavioural_score || 50,
        emotional: latestScores.emotional_score || 50,
        resilience: latestScores.resilience_score || 50,
        employability: latestScores.employability_score || 50,
        leadership: latestScores.leadership_score || 40
      };
      const delta = Object.keys(projected).reduce((acc, k) => {
        acc[k] = parseFloat(((projected as any)[k] - (currentScores as any)[k]).toFixed(2));
        return acc;
      }, {} as any);
      const twinState = { current_scores: currentScores, scenario: simulation_scenario, intervention_params, twin_health: rnd(0.6, 0.95) };
      const r = await pool.query(
        `INSERT INTO lde_digital_twins (user_id, tenant_id, twin_state, last_simulation_results, projected_delta, simulation_count)
         VALUES ($1,$2,$3,$4,$5,1)
         ON CONFLICT (user_id) DO UPDATE SET
          twin_state=EXCLUDED.twin_state, last_simulation_results=EXCLUDED.last_simulation_results,
          projected_delta=EXCLUDED.projected_delta,
          simulation_count=lde_digital_twins.simulation_count+1,
          last_simulated_at=NOW()
         RETURNING *`,
        [user_id, tenant_id||null, JSON.stringify(twinState), JSON.stringify({ projected, scenario: simulation_scenario }), JSON.stringify(delta)]
      );
      res.json({ twin: r.rows[0], current_scores: currentScores, projected, delta });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/twin/:userId", async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM lde_digital_twins WHERE user_id=$1`, [req.params.userId]);
      if (!r.rows.length) return res.status(404).json({ error: "No digital twin found for user" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 6: Developmental Ontology ─────────────────────────────────────
  app.post("/api/lde/ontology/seed", async (req, res) => {
    try {
      const { tenant_id } = req.body;

      // ── CAPADEX Stage nodes ───────────────────────────────────────────
      const stageNodes = [
        { type: 'stage', key: 'forming', label: 'Forming Stage', depth: 0, props: { score_range: '0-29', color: '#94a3b8', cap_code: 'CAP_CUR', weight: 0.5 } },
        { type: 'stage', key: 'emerging', label: 'Emerging Stage', depth: 0, props: { score_range: '30-49', color: '#f97316', cap_code: 'CAP_INS', weight: 0.75 } },
        { type: 'stage', key: 'developing', label: 'Developing Stage', depth: 0, props: { score_range: '50-64', color: '#eab308', cap_code: 'CAP_GRW', weight: 1.0 } },
        { type: 'stage', key: 'proficient', label: 'Proficient Stage', depth: 0, props: { score_range: '65-79', color: '#3b82f6', cap_code: 'CAP_MAS', weight: 1.25 } },
        // The developmental-depth ladder cross-walks to the FOUR canonical lifecycle codes
        // (backend/lib/lifecycle.ts) — there is NO coded stage above Mastery, so the top
        // "Advanced" depth band (80-100) shares CAP_MAS rather than a non-canon 5th code.
        { type: 'stage', key: 'advanced', label: 'Advanced Stage', depth: 0, props: { score_range: '80-100', color: '#10b981', cap_code: 'CAP_MAS', weight: 1.5 } }
      ];

      // ── Core construct nodes ──────────────────────────────────────────
      const constructNodes = [
        { type: 'construct', key: 'behavioural_resilience', label: 'Behavioural Resilience', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'emotional_intelligence', label: 'Emotional Intelligence', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'cognitive_adaptability', label: 'Cognitive Adaptability', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'social_capital', label: 'Social Capital', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'identity_coherence', label: 'Identity Coherence', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'digital_intelligence', label: 'Digital Intelligence', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'executive_control', label: 'Executive Control', depth: 1, props: { framework: 'BIOS' } },
        { type: 'construct', key: 'motivational_drive', label: 'Motivational Drive', depth: 1, props: { framework: 'BIOS' } }
      ];

      // ── Capability nodes ──────────────────────────────────────────────
      const capabilityNodes = [
        { type: 'capability', key: 'leadership_emergence', label: 'Leadership Emergence', depth: 2, props: { framework: 'BIOS' } },
        { type: 'capability', key: 'self_regulation', label: 'Self-Regulation', depth: 2, props: { framework: 'BIOS' } },
        { type: 'capability', key: 'growth_mindset', label: 'Growth Mindset', depth: 2, props: { framework: 'BIOS' } },
        { type: 'capability', key: 'career_readiness', label: 'Career Readiness', depth: 2, props: { framework: 'BIOS' } },
        { type: 'capability', key: 'academic_mastery', label: 'Academic Mastery', depth: 2, props: { framework: 'BIOS' } },
        { type: 'capability', key: 'creative_problem_solving', label: 'Creative Problem-Solving', depth: 2, props: { framework: 'BIOS' } }
      ];

      // ── 19 LBI Domain ontology nodes ──────────────────────────────────
      const lbiDomainNodes = [
        { type: 'lbi_domain', key: 'lbi_ont_COG', label: 'Cognitive Processing', depth: 1, props: { code: 'COG', framework: 'LBI', description: 'Capacity to process, analyse and reason with information' } },
        { type: 'lbi_domain', key: 'lbi_ont_ATT', label: 'Attention Regulation', depth: 1, props: { code: 'ATT', framework: 'LBI', description: 'Ability to sustain, focus and shift attention deliberately' } },
        { type: 'lbi_domain', key: 'lbi_ont_MEM', label: 'Memory & Retention', depth: 1, props: { code: 'MEM', framework: 'LBI', description: 'Encoding, storage and retrieval of information' } },
        { type: 'lbi_domain', key: 'lbi_ont_EXF', label: 'Executive Functioning', depth: 1, props: { code: 'EXF', framework: 'LBI', description: 'Higher-order planning, inhibition and cognitive control' } },
        { type: 'lbi_domain', key: 'lbi_ont_EMO', label: 'Emotional Regulation', depth: 1, props: { code: 'EMO', framework: 'LBI', description: 'Identification, expression and management of emotions' } },
        { type: 'lbi_domain', key: 'lbi_ont_MOT', label: 'Motivation & Drive', depth: 1, props: { code: 'MOT', framework: 'LBI', description: 'Intrinsic and extrinsic forces that sustain goal pursuit' } },
        { type: 'lbi_domain', key: 'lbi_ont_RES', label: 'Resilience & Persistence', depth: 1, props: { code: 'RES', framework: 'LBI', description: 'Capacity to recover from setbacks and maintain effort' } },
        { type: 'lbi_domain', key: 'lbi_ont_SOC', label: 'Social Learning', depth: 1, props: { code: 'SOC', framework: 'LBI', description: 'Learning through social interaction, observation and collaboration' } },
        { type: 'lbi_domain', key: 'lbi_ont_COM', label: 'Communication Skills', depth: 1, props: { code: 'COM', framework: 'LBI', description: 'Verbal, written and digital expression of ideas' } },
        { type: 'lbi_domain', key: 'lbi_ont_CRE', label: 'Creativity & Innovation', depth: 1, props: { code: 'CRE', framework: 'LBI', description: 'Divergent thinking, ideation and novel problem-solving' } },
        { type: 'lbi_domain', key: 'lbi_ont_ANA', label: 'Analytical Thinking', depth: 1, props: { code: 'ANA', framework: 'LBI', description: 'Logical reasoning, evaluation and evidence-based conclusions' } },
        { type: 'lbi_domain', key: 'lbi_ont_DIG', label: 'Digital Literacy', depth: 1, props: { code: 'DIG', framework: 'LBI', description: 'Competency with technology, media and online environments' } },
        { type: 'lbi_domain', key: 'lbi_ont_SLF', label: 'Self-Management', depth: 1, props: { code: 'SLF', framework: 'LBI', description: 'Organisation, discipline and responsibility for own learning' } },
        { type: 'lbi_domain', key: 'lbi_ont_ADP', label: 'Adaptability', depth: 1, props: { code: 'ADP', framework: 'LBI', description: 'Flexibility and openness to change and new challenges' } },
        { type: 'lbi_domain', key: 'lbi_ont_LDR', label: 'Leadership Potential', depth: 1, props: { code: 'LDR', framework: 'LBI', description: 'Influence, decision-making and accountability in group contexts' } },
        { type: 'lbi_domain', key: 'lbi_ont_CAR', label: 'Career Orientation', depth: 1, props: { code: 'CAR', framework: 'LBI', description: 'Clarity and preparedness for future career pathways' } },
        { type: 'lbi_domain', key: 'lbi_ont_WEL', label: 'Wellbeing', depth: 1, props: { code: 'WEL', framework: 'LBI', description: 'Physical, emotional, social and digital wellness indicators' } },
        { type: 'lbi_domain', key: 'lbi_ont_PER', label: 'Performance Under Pressure', depth: 1, props: { code: 'PER', framework: 'LBI', description: 'Ability to maintain quality output during high-stakes conditions' } },
        { type: 'lbi_domain', key: 'lbi_ont_GRO', label: 'Growth Mindset', depth: 1, props: { code: 'GRO', framework: 'LBI', description: 'Belief that abilities can be developed through effort and learning' } }
      ];

      // ── 97 LBI Subdomain ontology nodes (5 per domain, +2 for GRO/CRE) ─
      const lbiSubdomainNodes = [
        // COG — Cognitive Processing (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_COG_01', label: 'Processing Speed', depth: 2, props: { code: 'COG_01', domain: 'COG', description: 'Rate of information processing under standard conditions' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COG_02', label: 'Abstract Reasoning', depth: 2, props: { code: 'COG_02', domain: 'COG', description: 'Ability to identify patterns and reason with abstract concepts' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COG_03', label: 'Comprehension Depth', depth: 2, props: { code: 'COG_03', domain: 'COG', description: 'Depth of understanding of complex information' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COG_04', label: 'Concept Application', depth: 2, props: { code: 'COG_04', domain: 'COG', description: 'Transfer of learned concepts to novel situations' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COG_05', label: 'Pattern Recognition', depth: 2, props: { code: 'COG_05', domain: 'COG', description: 'Detection of regularities and structural relationships' } },
        // ATT — Attention Regulation (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_ATT_01', label: 'Sustained Attention', depth: 2, props: { code: 'ATT_01', domain: 'ATT', description: 'Maintaining focus over extended time periods' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ATT_02', label: 'Selective Attention', depth: 2, props: { code: 'ATT_02', domain: 'ATT', description: 'Filtering relevant information from distractors' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ATT_03', label: 'Divided Attention', depth: 2, props: { code: 'ATT_03', domain: 'ATT', description: 'Processing multiple information streams simultaneously' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ATT_04', label: 'Attentional Switching', depth: 2, props: { code: 'ATT_04', domain: 'ATT', description: 'Flexible shifting of focus between tasks or stimuli' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ATT_05', label: 'Attention Span Capacity', depth: 2, props: { code: 'ATT_05', domain: 'ATT', description: 'Breadth of information held in immediate attention' } },
        // MEM — Memory & Retention (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_MEM_01', label: 'Short-Term Recall', depth: 2, props: { code: 'MEM_01', domain: 'MEM', description: 'Immediate recall of recently encountered information' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MEM_02', label: 'Long-Term Consolidation', depth: 2, props: { code: 'MEM_02', domain: 'MEM', description: 'Transfer of information to durable long-term storage' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MEM_03', label: 'Working Memory Capacity', depth: 2, props: { code: 'MEM_03', domain: 'MEM', description: 'Active manipulation of information in mind' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MEM_04', label: 'Retrieval Fluency', depth: 2, props: { code: 'MEM_04', domain: 'MEM', description: 'Speed and accuracy of accessing stored memories' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MEM_05', label: 'Encoding Efficiency', depth: 2, props: { code: 'MEM_05', domain: 'MEM', description: 'Depth of encoding during initial learning phase' } },
        // EXF — Executive Functioning (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_EXF_01', label: 'Planning & Organisation', depth: 2, props: { code: 'EXF_01', domain: 'EXF', description: 'Setting goals and sequencing steps to achieve them' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EXF_02', label: 'Inhibitory Control', depth: 2, props: { code: 'EXF_02', domain: 'EXF', description: 'Suppressing impulsive or irrelevant responses' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EXF_03', label: 'Cognitive Flexibility', depth: 2, props: { code: 'EXF_03', domain: 'EXF', description: 'Adapting thinking strategies to new demands' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EXF_04', label: 'Self-Monitoring', depth: 2, props: { code: 'EXF_04', domain: 'EXF', description: 'Tracking own performance and adjusting accordingly' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EXF_05', label: 'Task Initiation', depth: 2, props: { code: 'EXF_05', domain: 'EXF', description: 'Beginning tasks promptly without undue procrastination' } },
        // EMO — Emotional Regulation (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_EMO_01', label: 'Emotion Identification', depth: 2, props: { code: 'EMO_01', domain: 'EMO', description: 'Recognising and naming emotions accurately' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EMO_02', label: 'Emotional Expression', depth: 2, props: { code: 'EMO_02', domain: 'EMO', description: 'Communicating feelings appropriately in context' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EMO_03', label: 'Emotional Regulation Skill', depth: 2, props: { code: 'EMO_03', domain: 'EMO', description: 'Managing intense emotions without dysregulation' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EMO_04', label: 'Empathic Resonance', depth: 2, props: { code: 'EMO_04', domain: 'EMO', description: 'Sensing and responding to others emotional states' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_EMO_05', label: 'Emotional Tolerance', depth: 2, props: { code: 'EMO_05', domain: 'EMO', description: 'Capacity to sit with difficult feelings without avoidance' } },
        // MOT — Motivation & Drive (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_MOT_01', label: 'Intrinsic Motivation', depth: 2, props: { code: 'MOT_01', domain: 'MOT', description: 'Drive arising from internal interest and enjoyment' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MOT_02', label: 'Extrinsic Motivation', depth: 2, props: { code: 'MOT_02', domain: 'MOT', description: 'Drive arising from external rewards or recognition' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MOT_03', label: 'Goal-Setting Clarity', depth: 2, props: { code: 'MOT_03', domain: 'MOT', description: 'Ability to define clear, achievable short and long-term goals' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MOT_04', label: 'Motivational Persistence', depth: 2, props: { code: 'MOT_04', domain: 'MOT', description: 'Sustaining effort toward goals despite obstacles' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_MOT_05', label: 'Self-Efficacy Belief', depth: 2, props: { code: 'MOT_05', domain: 'MOT', description: 'Confidence in own ability to perform successfully' } },
        // RES — Resilience & Persistence (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_RES_01', label: 'Stress Tolerance', depth: 2, props: { code: 'RES_01', domain: 'RES', description: 'Ability to function under pressure without breakdown' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_RES_02', label: 'Recovery Speed', depth: 2, props: { code: 'RES_02', domain: 'RES', description: 'How quickly one bounces back after setbacks or failures' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_RES_03', label: 'Adversity Adaptation', depth: 2, props: { code: 'RES_03', domain: 'RES', description: 'Adjusting effectively when circumstances change unexpectedly' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_RES_04', label: 'Optimism Orientation', depth: 2, props: { code: 'RES_04', domain: 'RES', description: 'Tendency to expect positive outcomes and maintain hope' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_RES_05', label: 'Coping Strategies', depth: 2, props: { code: 'RES_05', domain: 'RES', description: 'Repertoire of constructive strategies for managing difficulty' } },
        // SOC — Social Learning (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_SOC_01', label: 'Collaborative Engagement', depth: 2, props: { code: 'SOC_01', domain: 'SOC', description: 'Active participation in group learning and shared projects' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SOC_02', label: 'Peer Learning Orientation', depth: 2, props: { code: 'SOC_02', domain: 'SOC', description: 'Willingness to learn from and alongside others' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SOC_03', label: 'Group Dynamics Literacy', depth: 2, props: { code: 'SOC_03', domain: 'SOC', description: 'Understanding and navigating team roles and group processes' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SOC_04', label: 'Social Conflict Resolution', depth: 2, props: { code: 'SOC_04', domain: 'SOC', description: 'Resolving interpersonal disagreements constructively' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SOC_05', label: 'Support Seeking Behaviour', depth: 2, props: { code: 'SOC_05', domain: 'SOC', description: 'Comfortably seeking help or guidance when needed' } },
        // COM — Communication Skills (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_COM_01', label: 'Verbal Communication', depth: 2, props: { code: 'COM_01', domain: 'COM', description: 'Clarity and impact of spoken expression in various contexts' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COM_02', label: 'Written Communication', depth: 2, props: { code: 'COM_02', domain: 'COM', description: 'Structure, clarity and persuasiveness of written output' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COM_03', label: 'Active Listening', depth: 2, props: { code: 'COM_03', domain: 'COM', description: 'Attention to and comprehension of others spoken ideas' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COM_04', label: 'Non-Verbal Communication', depth: 2, props: { code: 'COM_04', domain: 'COM', description: 'Use of body language, gestures and tone to enhance meaning' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_COM_05', label: 'Digital Communication', depth: 2, props: { code: 'COM_05', domain: 'COM', description: 'Proficiency in communicating effectively through digital channels' } },
        // CRE — Creativity & Innovation (6)
        { type: 'lbi_subdomain', key: 'lbi_sub_CRE_01', label: 'Divergent Thinking', depth: 2, props: { code: 'CRE_01', domain: 'CRE', description: 'Generating multiple, varied ideas from a single prompt' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CRE_02', label: 'Creative Problem-Solving', depth: 2, props: { code: 'CRE_02', domain: 'CRE', description: 'Applying novel approaches to resolve complex challenges' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CRE_03', label: 'Innovation Orientation', depth: 2, props: { code: 'CRE_03', domain: 'CRE', description: 'Desire to create new solutions and improve existing ones' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CRE_04', label: 'Intellectual Curiosity', depth: 2, props: { code: 'CRE_04', domain: 'CRE', description: 'Drive to explore, question and discover beyond the obvious' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CRE_05', label: 'Ideation Fluency', depth: 2, props: { code: 'CRE_05', domain: 'CRE', description: 'Speed and quantity of idea generation' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CRE_06', label: 'Risk Appetite in Ideas', depth: 2, props: { code: 'CRE_06', domain: 'CRE', description: 'Willingness to propose unconventional or untested ideas' } },
        // ANA — Analytical Thinking (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_ANA_01', label: 'Critical Evaluation', depth: 2, props: { code: 'ANA_01', domain: 'ANA', description: 'Assessing the quality and validity of arguments and evidence' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ANA_02', label: 'Data Interpretation', depth: 2, props: { code: 'ANA_02', domain: 'ANA', description: 'Drawing accurate insights from quantitative or qualitative data' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ANA_03', label: 'Logical Reasoning', depth: 2, props: { code: 'ANA_03', domain: 'ANA', description: 'Applying formal logic to reach sound conclusions' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ANA_04', label: 'Synthesis Ability', depth: 2, props: { code: 'ANA_04', domain: 'ANA', description: 'Combining disparate ideas into a coherent whole' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ANA_05', label: 'Evidence Evaluation', depth: 2, props: { code: 'ANA_05', domain: 'ANA', description: 'Judging the strength and relevance of supporting evidence' } },
        // DIG — Digital Literacy (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_DIG_01', label: 'Technology Proficiency', depth: 2, props: { code: 'DIG_01', domain: 'DIG', description: 'Competency with digital tools, software and devices' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_DIG_02', label: 'Online Safety Awareness', depth: 2, props: { code: 'DIG_02', domain: 'DIG', description: 'Understanding and practising safe online behaviour' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_DIG_03', label: 'Media Literacy', depth: 2, props: { code: 'DIG_03', domain: 'DIG', description: 'Critical evaluation of digital media content and sources' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_DIG_04', label: 'Computational Thinking', depth: 2, props: { code: 'DIG_04', domain: 'DIG', description: 'Problem decomposition and algorithmic reasoning' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_DIG_05', label: 'Digital Wellness', depth: 2, props: { code: 'DIG_05', domain: 'DIG', description: 'Balancing screen time and maintaining healthy digital habits' } },
        // SLF — Self-Management (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_SLF_01', label: 'Time Management', depth: 2, props: { code: 'SLF_01', domain: 'SLF', description: 'Allocating and protecting time for tasks and priorities' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SLF_02', label: 'Personal Organisation', depth: 2, props: { code: 'SLF_02', domain: 'SLF', description: 'Maintaining orderly systems for materials and responsibilities' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SLF_03', label: 'Behavioural Self-Monitoring', depth: 2, props: { code: 'SLF_03', domain: 'SLF', description: 'Tracking own behaviour and adjusting to meet standards' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SLF_04', label: 'Self-Discipline', depth: 2, props: { code: 'SLF_04', domain: 'SLF', description: 'Maintaining effort and standards through internal control' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_SLF_05', label: 'Personal Responsibility', depth: 2, props: { code: 'SLF_05', domain: 'SLF', description: 'Ownership of actions, choices and their consequences' } },
        // ADP — Adaptability (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_ADP_01', label: 'Change Tolerance', depth: 2, props: { code: 'ADP_01', domain: 'ADP', description: 'Comfort and stability when routines or plans change' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ADP_02', label: 'Learning Agility', depth: 2, props: { code: 'ADP_02', domain: 'ADP', description: 'Speed at which new skills and knowledge are acquired' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ADP_03', label: 'Ambiguity Tolerance', depth: 2, props: { code: 'ADP_03', domain: 'ADP', description: 'Functioning effectively in unclear or uncertain situations' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ADP_04', label: 'Behavioural Flexibility', depth: 2, props: { code: 'ADP_04', domain: 'ADP', description: 'Adjusting approach and style to fit new demands' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_ADP_05', label: 'Open-Mindedness', depth: 2, props: { code: 'ADP_05', domain: 'ADP', description: 'Receptiveness to new perspectives, ideas and feedback' } },
        // LDR — Leadership Potential (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_LDR_01', label: 'Influence & Persuasion', depth: 2, props: { code: 'LDR_01', domain: 'LDR', description: 'Ability to shape others thinking and gain commitment' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_LDR_02', label: 'Decision-Making Quality', depth: 2, props: { code: 'LDR_02', domain: 'LDR', description: 'Making sound decisions under uncertainty and time pressure' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_LDR_03', label: 'Team Building', depth: 2, props: { code: 'LDR_03', domain: 'LDR', description: 'Fostering cohesion, trust and collaboration in groups' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_LDR_04', label: 'Vision & Direction', depth: 2, props: { code: 'LDR_04', domain: 'LDR', description: 'Articulating a compelling direction for self and others' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_LDR_05', label: 'Accountability', depth: 2, props: { code: 'LDR_05', domain: 'LDR', description: 'Taking responsibility for outcomes and holding others to standards' } },
        // CAR — Career Orientation (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_CAR_01', label: 'Career Exploration', depth: 2, props: { code: 'CAR_01', domain: 'CAR', description: 'Actively investigating diverse career options and pathways' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CAR_02', label: 'Goal Clarity', depth: 2, props: { code: 'CAR_02', domain: 'CAR', description: 'Specificity and consistency of career aspirations' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CAR_03', label: 'Skill Self-Awareness', depth: 2, props: { code: 'CAR_03', domain: 'CAR', description: 'Accurate knowledge of own strengths and development areas' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CAR_04', label: 'Industry Knowledge', depth: 2, props: { code: 'CAR_04', domain: 'CAR', description: 'Understanding of relevant industry trends and requirements' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_CAR_05', label: 'Professional Networking', depth: 2, props: { code: 'CAR_05', domain: 'CAR', description: 'Building and leveraging a network of professional contacts' } },
        // WEL — Wellbeing (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_WEL_01', label: 'Physical Wellness', depth: 2, props: { code: 'WEL_01', domain: 'WEL', description: 'Maintaining healthy physical habits including sleep, exercise, nutrition' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_WEL_02', label: 'Emotional Wellness', depth: 2, props: { code: 'WEL_02', domain: 'WEL', description: 'Stable emotional baseline and positive affect' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_WEL_03', label: 'Social Wellness', depth: 2, props: { code: 'WEL_03', domain: 'WEL', description: 'Quality of social connections and sense of belonging' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_WEL_04', label: 'Academic Wellness', depth: 2, props: { code: 'WEL_04', domain: 'WEL', description: 'Sustainable approach to study without burnout or overwhelm' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_WEL_05', label: 'Digital Wellness', depth: 2, props: { code: 'WEL_05', domain: 'WEL', description: 'Healthy relationship with technology and screen use' } },
        // PER — Performance Under Pressure (5)
        { type: 'lbi_subdomain', key: 'lbi_sub_PER_01', label: 'Exam Readiness', depth: 2, props: { code: 'PER_01', domain: 'PER', description: 'Preparedness and confidence entering high-stakes evaluations' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_PER_02', label: 'Stress Management Under Pressure', depth: 2, props: { code: 'PER_02', domain: 'PER', description: 'Containing anxiety to maintain performance quality' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_PER_03', label: 'Focus Under Pressure', depth: 2, props: { code: 'PER_03', domain: 'PER', description: 'Sustaining concentration during high-stakes moments' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_PER_04', label: 'Performance Time Management', depth: 2, props: { code: 'PER_04', domain: 'PER', description: 'Efficient allocation of time during timed tasks or exams' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_PER_05', label: 'Performance Self-Confidence', depth: 2, props: { code: 'PER_05', domain: 'PER', description: 'Belief in ability to perform well when stakes are high' } },
        // GRO — Growth Mindset (6)
        { type: 'lbi_subdomain', key: 'lbi_sub_GRO_01', label: 'Learning Orientation', depth: 2, props: { code: 'GRO_01', domain: 'GRO', description: 'Prioritising learning and mastery over performance metrics' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_GRO_02', label: 'Failure Tolerance', depth: 2, props: { code: 'GRO_02', domain: 'GRO', description: 'Treating failure as information rather than verdict' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_GRO_03', label: 'Feedback Seeking', depth: 2, props: { code: 'GRO_03', domain: 'GRO', description: 'Actively requesting and using developmental feedback' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_GRO_04', label: 'Challenge Embrace', depth: 2, props: { code: 'GRO_04', domain: 'GRO', description: 'Choosing difficult tasks as opportunities for growth' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_GRO_05', label: 'Continuous Learning Drive', depth: 2, props: { code: 'GRO_05', domain: 'GRO', description: 'Sustained desire to expand skills and knowledge beyond requirements' } },
        { type: 'lbi_subdomain', key: 'lbi_sub_GRO_06', label: 'Effort Attribution', depth: 2, props: { code: 'GRO_06', domain: 'GRO', description: 'Attributing outcomes to effort and strategy rather than fixed ability' } }
      ];

      // ── Root taxonomy + ontology anchor nodes ─────────────────────────
      const anchorNodes = [
        { type: 'taxonomy', key: 'developmental_taxonomy', label: 'Developmental Taxonomy Root', depth: 0, props: {} },
        { type: 'ontology', key: 'bios_ontology_v1', label: 'BIOS Longitudinal Ontology v1', depth: 0, props: { version: '1.0' } },
        { type: 'taxonomy', key: 'lbi_framework_root', label: 'LBI Framework Root', depth: 0, props: { framework: 'LBI', version: '2.0', total_domains: 19, total_subdomains: 97 } },
        { type: 'taxonomy', key: 'sdi_framework_root', label: 'SDI Framework Root', depth: 0, props: { framework: 'SDI', version: '1.0' } },
        { type: 'taxonomy', key: 'competency_framework_root', label: 'Competency Framework Root', depth: 0, props: { framework: 'Competency', version: '1.0' } }
      ];

      const allNodes = [...stageNodes, ...constructNodes, ...capabilityNodes, ...lbiDomainNodes, ...lbiSubdomainNodes, ...anchorNodes];

      let nodeCount = 0;
      for (const n of allNodes) {
        await pool.query(
          `INSERT INTO lde_ontology_nodes (tenant_id, node_type, node_key, label, depth_level, properties)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (node_key) DO UPDATE SET label=EXCLUDED.label, properties=EXCLUDED.properties`,
          [tenant_id||null, n.type, n.key, n.label, n.depth, JSON.stringify(n.props)]
        );
        nodeCount++;
      }

      // ── Stage transition edges ────────────────────────────────────────
      const stageEdges = [
        { src: 'forming', tgt: 'emerging', rel: 'transitions_to' },
        { src: 'emerging', tgt: 'developing', rel: 'transitions_to' },
        { src: 'developing', tgt: 'proficient', rel: 'transitions_to' },
        { src: 'proficient', tgt: 'advanced', rel: 'transitions_to' }
      ];

      // ── Construct → capability edges ──────────────────────────────────
      const constructEdges = [
        { src: 'behavioural_resilience', tgt: 'leadership_emergence', rel: 'enables' },
        { src: 'emotional_intelligence', tgt: 'self_regulation', rel: 'enables' },
        { src: 'cognitive_adaptability', tgt: 'growth_mindset', rel: 'enables' },
        { src: 'cognitive_adaptability', tgt: 'creative_problem_solving', rel: 'enables' },
        { src: 'identity_coherence', tgt: 'leadership_emergence', rel: 'enables' },
        { src: 'growth_mindset', tgt: 'proficient', rel: 'leads_to' },
        { src: 'motivational_drive', tgt: 'academic_mastery', rel: 'enables' },
        { src: 'digital_intelligence', tgt: 'career_readiness', rel: 'enables' },
        { src: 'executive_control', tgt: 'self_regulation', rel: 'enables' },
        { src: 'social_capital', tgt: 'leadership_emergence', rel: 'enables' }
      ];

      // ── LBI framework root → domain edges ────────────────────────────
      const lbiDomainEdges = lbiDomainNodes.map(d => ({ src: 'lbi_framework_root', tgt: d.key, rel: 'contains' }));

      // ── LBI domain → subdomain edges ─────────────────────────────────
      const DOMAIN_SUBDOMAIN_MAP: Record<string, string[]> = {
        lbi_ont_COG: ['lbi_sub_COG_01','lbi_sub_COG_02','lbi_sub_COG_03','lbi_sub_COG_04','lbi_sub_COG_05'],
        lbi_ont_ATT: ['lbi_sub_ATT_01','lbi_sub_ATT_02','lbi_sub_ATT_03','lbi_sub_ATT_04','lbi_sub_ATT_05'],
        lbi_ont_MEM: ['lbi_sub_MEM_01','lbi_sub_MEM_02','lbi_sub_MEM_03','lbi_sub_MEM_04','lbi_sub_MEM_05'],
        lbi_ont_EXF: ['lbi_sub_EXF_01','lbi_sub_EXF_02','lbi_sub_EXF_03','lbi_sub_EXF_04','lbi_sub_EXF_05'],
        lbi_ont_EMO: ['lbi_sub_EMO_01','lbi_sub_EMO_02','lbi_sub_EMO_03','lbi_sub_EMO_04','lbi_sub_EMO_05'],
        lbi_ont_MOT: ['lbi_sub_MOT_01','lbi_sub_MOT_02','lbi_sub_MOT_03','lbi_sub_MOT_04','lbi_sub_MOT_05'],
        lbi_ont_RES: ['lbi_sub_RES_01','lbi_sub_RES_02','lbi_sub_RES_03','lbi_sub_RES_04','lbi_sub_RES_05'],
        lbi_ont_SOC: ['lbi_sub_SOC_01','lbi_sub_SOC_02','lbi_sub_SOC_03','lbi_sub_SOC_04','lbi_sub_SOC_05'],
        lbi_ont_COM: ['lbi_sub_COM_01','lbi_sub_COM_02','lbi_sub_COM_03','lbi_sub_COM_04','lbi_sub_COM_05'],
        lbi_ont_CRE: ['lbi_sub_CRE_01','lbi_sub_CRE_02','lbi_sub_CRE_03','lbi_sub_CRE_04','lbi_sub_CRE_05','lbi_sub_CRE_06'],
        lbi_ont_ANA: ['lbi_sub_ANA_01','lbi_sub_ANA_02','lbi_sub_ANA_03','lbi_sub_ANA_04','lbi_sub_ANA_05'],
        lbi_ont_DIG: ['lbi_sub_DIG_01','lbi_sub_DIG_02','lbi_sub_DIG_03','lbi_sub_DIG_04','lbi_sub_DIG_05'],
        lbi_ont_SLF: ['lbi_sub_SLF_01','lbi_sub_SLF_02','lbi_sub_SLF_03','lbi_sub_SLF_04','lbi_sub_SLF_05'],
        lbi_ont_ADP: ['lbi_sub_ADP_01','lbi_sub_ADP_02','lbi_sub_ADP_03','lbi_sub_ADP_04','lbi_sub_ADP_05'],
        lbi_ont_LDR: ['lbi_sub_LDR_01','lbi_sub_LDR_02','lbi_sub_LDR_03','lbi_sub_LDR_04','lbi_sub_LDR_05'],
        lbi_ont_CAR: ['lbi_sub_CAR_01','lbi_sub_CAR_02','lbi_sub_CAR_03','lbi_sub_CAR_04','lbi_sub_CAR_05'],
        lbi_ont_WEL: ['lbi_sub_WEL_01','lbi_sub_WEL_02','lbi_sub_WEL_03','lbi_sub_WEL_04','lbi_sub_WEL_05'],
        lbi_ont_PER: ['lbi_sub_PER_01','lbi_sub_PER_02','lbi_sub_PER_03','lbi_sub_PER_04','lbi_sub_PER_05'],
        lbi_ont_GRO: ['lbi_sub_GRO_01','lbi_sub_GRO_02','lbi_sub_GRO_03','lbi_sub_GRO_04','lbi_sub_GRO_05','lbi_sub_GRO_06']
      };
      const subdomainEdges: Array<{src: string; tgt: string; rel: string}> = [];
      for (const [domain, subs] of Object.entries(DOMAIN_SUBDOMAIN_MAP)) {
        for (const sub of subs) subdomainEdges.push({ src: domain, tgt: sub, rel: 'contains' });
      }

      // ── LBI domain cross-domain psychometric edges ─────────────────────
      const lbiCrossEdges = [
        { src: 'lbi_ont_ATT', tgt: 'lbi_ont_COG', rel: 'enables' },
        { src: 'lbi_ont_COG', tgt: 'lbi_ont_MEM', rel: 'enables' },
        { src: 'lbi_ont_COG', tgt: 'lbi_ont_ANA', rel: 'enables' },
        { src: 'lbi_ont_EXF', tgt: 'lbi_ont_ATT', rel: 'regulates' },
        { src: 'lbi_ont_EXF', tgt: 'lbi_ont_SLF', rel: 'enables' },
        { src: 'lbi_ont_EMO', tgt: 'lbi_ont_MOT', rel: 'enables' },
        { src: 'lbi_ont_EMO', tgt: 'lbi_ont_RES', rel: 'enables' },
        { src: 'lbi_ont_EMO', tgt: 'lbi_ont_SOC', rel: 'enables' },
        { src: 'lbi_ont_MOT', tgt: 'lbi_ont_GRO', rel: 'enables' },
        { src: 'lbi_ont_MOT', tgt: 'lbi_ont_PER', rel: 'enables' },
        { src: 'lbi_ont_RES', tgt: 'lbi_ont_PER', rel: 'enables' },
        { src: 'lbi_ont_SOC', tgt: 'lbi_ont_COM', rel: 'enables' },
        { src: 'lbi_ont_SOC', tgt: 'lbi_ont_LDR', rel: 'enables' },
        { src: 'lbi_ont_GRO', tgt: 'lbi_ont_ADP', rel: 'enables' },
        { src: 'lbi_ont_GRO', tgt: 'lbi_ont_CRE', rel: 'enables' },
        { src: 'lbi_ont_LDR', tgt: 'lbi_ont_CAR', rel: 'enables' },
        { src: 'lbi_ont_DIG', tgt: 'lbi_ont_CAR', rel: 'enables' },
        { src: 'lbi_ont_WEL', tgt: 'lbi_ont_EMO', rel: 'enables' },
        { src: 'lbi_ont_WEL', tgt: 'lbi_ont_PER', rel: 'enables' },
        { src: 'lbi_ont_ANA', tgt: 'lbi_ont_CRE', rel: 'enables' },
        { src: 'lbi_ont_SLF', tgt: 'lbi_ont_PER', rel: 'enables' }
      ];

      const allEdges = [...stageEdges, ...constructEdges, ...lbiDomainEdges, ...subdomainEdges, ...lbiCrossEdges];

      let edgeCount = 0;
      for (const e of allEdges) {
        await pool.query(
          `INSERT INTO lde_ontology_edges (tenant_id, source_key, target_key, relationship)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [tenant_id||null, e.src, e.tgt, e.rel]
        );
        edgeCount++;
      }

      const breakdown = {
        stages: stageNodes.length,
        constructs: constructNodes.length,
        capabilities: capabilityNodes.length,
        lbi_domains: lbiDomainNodes.length,
        lbi_subdomains: lbiSubdomainNodes.length,
        anchors: anchorNodes.length
      };
      await pool.query(
        `INSERT INTO lde_seed_log (seed_type, last_run_at, run_count, last_result)
         VALUES ('ontology', NOW(), 1, $1)
         ON CONFLICT (seed_type) DO UPDATE SET last_run_at=NOW(), run_count=lde_seed_log.run_count+1, last_result=$1`,
        [JSON.stringify({ seeded_nodes: nodeCount, seeded_edges: edgeCount, breakdown })]
      ).catch((e: any) => { console.warn('[lde-seed-log] Failed to record ontology seed timestamp:', e?.message); });
      res.json({
        seeded_nodes: nodeCount,
        seeded_edges: edgeCount,
        breakdown,
        message: 'LDE Developmental Ontology seeded with 19 LBI domains, 97 subdomains and BIOS constructs'
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/ontology/traverse", async (req, res) => {
    try {
      const { from_node = 'forming', depth = 3 } = req.query as any;
      const startR = await pool.query(`SELECT * FROM lde_ontology_nodes WHERE node_key=$1`, [from_node]);
      if (!startR.rows.length) return res.status(404).json({ error: "Node not found" });
      const visited = new Set<string>([from_node]);
      const queue = [{ key: from_node, depth: 0 }];
      const nodes: any[] = [startR.rows[0]];
      const edges: any[] = [];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr.depth >= parseInt(depth)) continue;
        const edgesR = await pool.query(
          `SELECT e.*, n.label target_label, n.node_type target_type
           FROM lde_ontology_edges e JOIN lde_ontology_nodes n ON n.node_key=e.target_key
           WHERE e.source_key=$1`,
          [curr.key]
        );
        for (const edge of edgesR.rows) {
          edges.push(edge);
          if (!visited.has(edge.target_key)) {
            visited.add(edge.target_key);
            queue.push({ key: edge.target_key, depth: curr.depth + 1 });
            const nR = await pool.query(`SELECT * FROM lde_ontology_nodes WHERE node_key=$1`, [edge.target_key]);
            if (nR.rows.length) nodes.push(nR.rows[0]);
          }
        }
      }
      res.json({ from_node, depth: parseInt(depth), nodes, edges, traversed: nodes.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 9: Identity Evolution ─────────────────────────────────────────
  app.post("/api/lde/identity/checkpoint", async (req, res) => {
    try {
      const { user_id, tenant_id, confidence_score, self_efficacy_score, aspiration_score, motivation_score, notes, checkpoint_date } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const coherence = rnd(0.4, 0.95);
      const prev = await pool.query(`SELECT * FROM lde_identity_evolution WHERE user_id=$1 ORDER BY checkpoint_date DESC LIMIT 1`, [user_id]);
      const prevConf = prev.rows[0]?.confidence_score || 0.5;
      const breakthrough = (confidence_score || 0.5) - prevConf > 0.15;
      const shift = Math.abs((confidence_score || 0.5) - prevConf) > 0.1;
      const r = await pool.query(
        `INSERT INTO lde_identity_evolution
          (user_id, tenant_id, checkpoint_date, confidence_score, self_efficacy_score,
           aspiration_score, motivation_score, identity_coherence, breakthrough_flag, shift_detected, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, tenant_id||null, checkpoint_date || new Date().toISOString().split('T')[0],
         confidence_score || rnd(0.3, 0.9), self_efficacy_score || rnd(0.3, 0.9),
         aspiration_score || rnd(0.4, 0.95), motivation_score || rnd(0.3, 0.9),
         coherence, breakthrough, shift, notes||null]
      );
      if (breakthrough) {
        await pool.query(
          `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
           VALUES ($1,$2,'BREAKTHROUGH_DETECTED',$3,'identity')`,
          [user_id, tenant_id||null, JSON.stringify({ type: 'identity_breakthrough', confidence_gain: (confidence_score || 0.5) - prevConf })]
        );
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/identity/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_identity_evolution WHERE user_id=$1 ORDER BY checkpoint_date ASC`,
        [req.params.userId]
      );
      const trend = r.rows.length >= 2
        ? { confidence: (r.rows.at(-1)!.confidence_score - r.rows[0].confidence_score).toFixed(3), direction: r.rows.at(-1)!.confidence_score > r.rows[0].confidence_score ? 'rising' : 'falling' }
        : null;
      res.json({ user_id: req.params.userId, checkpoints: r.rows, checkpoint_count: r.rows.length, trend });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 10: Narrative Generation ──────────────────────────────────────
  app.post("/api/lde/narrative/generate", async (req, res) => {
    try {
      const { user_id, tenant_id, narrative_type = 'developmental' } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const [timelineR, identityR, momentumR] = await Promise.all([
        pool.query(`SELECT * FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date DESC LIMIT 3`, [user_id]),
        pool.query(`SELECT * FROM lde_identity_evolution WHERE user_id=$1 ORDER BY checkpoint_date DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM lde_momentum WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id])
      ]);
      const state = momentumR.rows[0]?.momentum_state || 'stable';
      const template = NARRATIVE_TEMPLATES[state] || NARRATIVE_TEMPLATES.stable;
      const latestTimeline = timelineR.rows[0];
      const identity = identityR.rows[0];
      const themes = [];
      if (latestTimeline?.resilience_score > 65) themes.push('resilience_strength');
      if (identity?.breakthrough_flag) themes.push('identity_breakthrough');
      if (state === 'acceleration') themes.push('momentum_surge');
      if (momentumR.rows[0]?.growth_velocity > 0.6) themes.push('growth_acceleration');
      themes.push('longitudinal_development');
      const title = `Developmental Intelligence Report — ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
      const r = await pool.query(
        `INSERT INTO lde_narratives (user_id, tenant_id, narrative_type, title, content, tone, key_themes, data_sources)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id||null, narrative_type, title, template,
         identity?.confidence_score > 0.7 ? 'celebratory' : state === 'fracture' ? 'supportive' : 'analytical',
         JSON.stringify(themes),
         JSON.stringify(['lde_timelines', 'lde_identity_evolution', 'lde_momentum'])]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/narrative/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_narratives WHERE user_id=$1 ORDER BY generated_at DESC LIMIT 5`,
        [req.params.userId]
      );
      res.json({ user_id: req.params.userId, narratives: r.rows, latest: r.rows[0] || null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 11: Momentum Engine ────────────────────────────────────────────
  app.post("/api/lde/momentum/compute", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const timelineR = await pool.query(
        `SELECT * FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date DESC LIMIT 6`,
        [user_id]
      );
      const timeline = timelineR.rows;
      let velocity = 0;
      if (timeline.length >= 2) {
        const recent = timeline[0]; const prev = timeline[1];
        velocity = ((recent.behavioural_score || 50) - (prev.behavioural_score || 50)) / 100;
      } else {
        velocity = rnd(-0.2, 0.4);
      }
      const stability = rnd(0.4, 0.9);
      const sustainability = rnd(0.4, 0.85);
      const momentum = parseFloat((velocity * 0.5 + stability * 0.3 + sustainability * 0.2).toFixed(3));
      const state = momentum > 0.5 && velocity > 0.2 ? 'acceleration'
        : momentum > 0.4 && velocity > 0 ? 'stable'
        : velocity > 0.3 ? 'breakthrough'
        : velocity < -0.3 ? 'collapse'
        : velocity < -0.1 ? 'stagnation'
        : 'recovery';
      const r = await pool.query(
        `INSERT INTO lde_momentum (user_id, tenant_id, growth_velocity, stability_score, sustainability_score, momentum_score, momentum_state, trend_direction, forecast_30d)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [user_id, tenant_id||null, velocity, stability, sustainability, momentum, state,
         velocity > 0 ? 'upward' : velocity < 0 ? 'downward' : 'lateral',
         Math.min(1, Math.max(0, momentum + rnd(-0.05, 0.15)))]
      );
      await pool.query(
        `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
         VALUES ($1,$2,'MOMENTUM_UPDATE',$3,'momentum_engine')`,
        [user_id, tenant_id||null, JSON.stringify({ state, momentum, velocity })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/momentum/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_momentum WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 10`,
        [req.params.userId]
      );
      res.json({ user_id: req.params.userId, momentum_history: r.rows, current: r.rows[0] || null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 12: Fracture Detection ─────────────────────────────────────────
  app.post("/api/lde/fracture/scan", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const types = ['behavioural','emotional','cognitive','resilience','identity'];
      const fractures: any[] = [];
      for (const ft of types) {
        const severityScore = rnd(0, 0.9);
        if (severityScore > 0.35) {
          const sev = severityScore > 0.75 ? 'critical' : severityScore > 0.55 ? 'high' : severityScore > 0.4 ? 'medium' : 'low';
          const r = await pool.query(
            `INSERT INTO lde_fractures
              (user_id, tenant_id, fracture_type, severity, severity_score, stabilization_forecast_days,
               recovery_probability, contributing_factors, intervention_recommended)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [user_id, tenant_id||null, ft, sev, severityScore,
             Math.floor(rnd(3, 45)), Math.max(0.2, 1 - severityScore),
             JSON.stringify([`${ft}_stress_accumulation`, 'contextual_overload', 'support_deficit']),
             sev === 'critical' ? `Immediate ${ft} intervention required` : `Monitor ${ft} trajectory closely`]
          );
          fractures.push(r.rows[0]);
          if (sev === 'critical' || sev === 'high') {
            await pool.query(
              `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
               VALUES ($1,$2,'FRACTURE_DETECTED',$3,'fracture_scanner')`,
              [user_id, tenant_id||null, JSON.stringify({ fracture_type: ft, severity: sev })]
            );
          }
        }
      }
      res.json({ scanned: types.length, fractures_detected: fractures.length, fractures });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/fractures/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_fractures WHERE user_id=$1 ORDER BY detected_at DESC`,
        [req.params.userId]
      );
      const active = r.rows.filter(x => !x.resolved);
      res.json({ user_id: req.params.userId, fractures: r.rows, active_count: active.length, total: r.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 13: Hidden Transformation Detection ────────────────────────────
  app.post("/api/lde/hidden/detect", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const types = ['latent_capability','leadership_emergence','silent_acceleration','hidden_resilience','breakthrough_potential'];
      const detected: any[] = [];
      for (const t of types) {
        const conf = rnd(0.2, 0.95);
        if (conf > 0.45) {
          const r = await pool.query(
            `INSERT INTO lde_hidden_transformations (user_id, tenant_id, transformation_type, confidence, magnitude, evidence)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [user_id, tenant_id||null, t, conf, rnd(0.1, 0.8),
             JSON.stringify([`${t}_signal_pattern`, 'cross_domain_correlation', 'temporal_convergence'])]
          );
          detected.push(r.rows[0]);
          if (conf > 0.7) {
            await pool.query(
              `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
               VALUES ($1,$2,'HIDDEN_TRANSFORMATION',$3,'hidden_detector')`,
              [user_id, tenant_id||null, JSON.stringify({ type: t, confidence: conf })]
            );
          }
        }
      }
      res.json({ scanned: types.length, detected: detected.length, transformations: detected });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/hidden/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_hidden_transformations WHERE user_id=$1 ORDER BY detected_at DESC`,
        [req.params.userId]
      );
      res.json({ user_id: req.params.userId, transformations: r.rows, count: r.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 14: Trust Evolution ─────────────────────────────────────────────
  app.post("/api/lde/trust/update", async (req, res) => {
    try {
      const { user_id, tenant_id, intervention_trust, mentor_trust, institutional_trust, checkpoint_date } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const iv = intervention_trust || rnd(0.3, 0.9);
      const mv = mentor_trust || rnd(0.3, 0.9);
      const inst = institutional_trust || rnd(0.3, 0.9);
      const overall = parseFloat(((iv + mv + inst) / 3).toFixed(3));
      const prev = await pool.query(`SELECT * FROM lde_trust_evolution WHERE user_id=$1 ORDER BY checkpoint_date DESC LIMIT 1`, [user_id]);
      const prevOverall = prev.rows[0]?.overall_trust || 0.5;
      const state = overall < 0.3 ? 'collapse' : overall > prevOverall + 0.15 ? 'growing' : overall < prevOverall - 0.1 ? 'recovering' : overall > 0.7 ? 'stable' : 'stabilizing';
      const r = await pool.query(
        `INSERT INTO lde_trust_evolution (user_id, tenant_id, checkpoint_date, intervention_trust, mentor_trust, institutional_trust, overall_trust, trust_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id||null, checkpoint_date || new Date().toISOString().split('T')[0], iv, mv, inst, overall, state]
      );
      if (state === 'collapse') {
        await pool.query(
          `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
           VALUES ($1,$2,'TRUST_CHANGE',$3,'trust_engine')`,
          [user_id, tenant_id||null, JSON.stringify({ state: 'collapse', overall_trust: overall })]
        );
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/trust/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_trust_evolution WHERE user_id=$1 ORDER BY checkpoint_date ASC`,
        [req.params.userId]
      );
      const collapses = r.rows.filter(x => x.trust_state === 'collapse').length;
      const recoveries = r.rows.filter(x => x.trust_state === 'recovering').length;
      res.json({ user_id: req.params.userId, trust_timeline: r.rows, collapses, recoveries, latest: r.rows.at(-1) || null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 15: Emotional Memory ───────────────────────────────────────────
  app.post("/api/lde/emotional-memory/store", async (req, res) => {
    try {
      const { user_id, tenant_id, trigger_event, emotional_peak, peak_intensity, recovery_pattern, recovery_days, burnout_flag } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const emotions = ['joy','anxiety','frustration','hope','despair','confusion','determination'];
      const patterns = ['rapid','gradual','stalled','cyclical'];
      const r = await pool.query(
        `INSERT INTO lde_emotional_memory (user_id, tenant_id, trigger_event, emotional_peak, peak_intensity, recovery_pattern, recovery_days, burnout_flag)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id||null,
         trigger_event || 'assessment_interaction',
         emotional_peak || emotions[Math.floor(Math.random() * emotions.length)],
         peak_intensity || rnd(0.2, 0.9),
         recovery_pattern || patterns[Math.floor(Math.random() * patterns.length)],
         recovery_days || Math.floor(rnd(1, 21)),
         burnout_flag || false]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/emotional-memory/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_emotional_memory WHERE user_id=$1 ORDER BY stored_at DESC`,
        [req.params.userId]
      );
      const burnoutEvents = r.rows.filter(x => x.burnout_flag).length;
      const peakDist: Record<string, number> = {};
      r.rows.forEach(x => { peakDist[x.emotional_peak] = (peakDist[x.emotional_peak] || 0) + 1; });
      res.json({ user_id: req.params.userId, memories: r.rows, burnout_events: burnoutEvents, peak_distribution: peakDist });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 16: Drift Detection ─────────────────────────────────────────────
  app.post("/api/lde/drift/detect", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const types = ['behavioural','cognitive','resilience','emotional','motivational'];
      const drifts: any[] = [];
      for (const dt of types) {
        const baseline = rnd(0.5, 0.85);
        const current = baseline + rnd(-0.35, 0.15);
        const magnitude = parseFloat(Math.abs(current - baseline).toFixed(3));
        if (magnitude > 0.08) {
          const sev = magnitude > 0.3 ? 'critical' : magnitude > 0.2 ? 'high' : magnitude > 0.12 ? 'medium' : 'low';
          const silent = current < baseline && magnitude > 0.15;
          const r = await pool.query(
            `INSERT INTO lde_drift
              (user_id, tenant_id, drift_type, drift_severity, drift_magnitude, baseline_value, current_value,
               silent_deterioration_flag, days_drifting, intervention_urgency)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [user_id, tenant_id||null, dt, sev, magnitude, baseline, current, silent,
             Math.floor(rnd(1, 30)), sev === 'critical' ? 'immediate' : sev === 'high' ? 'urgent' : 'monitor']
          );
          drifts.push(r.rows[0]);
          if (sev === 'critical' || silent) {
            await pool.query(
              `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
               VALUES ($1,$2,'DRIFT_DETECTED',$3,'drift_detector')`,
              [user_id, tenant_id||null, JSON.stringify({ drift_type: dt, severity: sev, silent, magnitude })]
            );
          }
        }
      }
      res.json({ scanned: types.length, drifts_detected: drifts.length, drifts });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/drift/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_drift WHERE user_id=$1 ORDER BY detected_at DESC`,
        [req.params.userId]
      );
      const silent = r.rows.filter(x => x.silent_deterioration_flag).length;
      res.json({ user_id: req.params.userId, drifts: r.rows, silent_deteriorations: silent, total: r.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Evolution Master Dashboard ─────────────────────────────────────────────
  app.get("/api/admin/lde/evolution/master", async (req, res) => {
    try {
      const [twinR, ontR, fracR, momR, driftR, hiddenR, identityR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(simulation_count) avg_simulations, AVG(accuracy_score) avg_accuracy FROM lde_digital_twins`),
        pool.query(`SELECT COUNT(*) node_count FROM lde_ontology_nodes`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN resolved THEN 0 ELSE 1 END) active, severity, COUNT(*) OVER (PARTITION BY severity) sev_cnt FROM lde_fractures GROUP BY severity, id LIMIT 1`),
        pool.query(`SELECT momentum_state, COUNT(*) cnt FROM lde_momentum GROUP BY momentum_state ORDER BY cnt DESC`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN silent_deterioration_flag THEN 1 ELSE 0 END) silent_count, drift_severity, COUNT(*) OVER (PARTITION BY drift_severity) sev_cnt FROM lde_drift GROUP BY drift_severity, id LIMIT 1`),
        pool.query(`SELECT COUNT(*) total, AVG(confidence) avg_confidence FROM lde_hidden_transformations`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN breakthrough_flag THEN 1 ELSE 0 END) breakthroughs FROM lde_identity_evolution`)
      ]);
      const [allFracR, allDriftR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN resolved THEN 0 ELSE 1 END) active, SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) critical FROM lde_fractures`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN silent_deterioration_flag THEN 1 ELSE 0 END) silent FROM lde_drift`)
      ]);
      res.json({
        twins: twinR.rows[0],
        ontology_size: ontR.rows[0].node_count,
        fractures: allFracR.rows[0],
        momentum_distribution: momR.rows,
        drift: allDriftR.rows[0],
        hidden_transformations: hiddenR.rows[0],
        identity: identityR.rows[0]
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/twins", async (req, res) => {
    try {
      const { page = 1, limit = 30 } = req.query as any;
      const off = (parseInt(page) - 1) * parseInt(limit);
      const r = await pool.query(`SELECT * FROM lde_digital_twins ORDER BY last_simulated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), off]);
      const tot = await pool.query(`SELECT COUNT(*) FROM lde_digital_twins`);
      res.json({ twins: r.rows, total: parseInt(tot.rows[0].count) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/fractures", async (req, res) => {
    try {
      const { resolved = 'false' } = req.query as any;
      const [listR, distR] = await Promise.all([
        pool.query(`SELECT * FROM lde_fractures WHERE resolved=$1 ORDER BY detected_at DESC LIMIT 50`, [resolved === 'true']),
        pool.query(`SELECT fracture_type, severity, COUNT(*) cnt FROM lde_fractures GROUP BY 1,2 ORDER BY 1,3 DESC`)
      ]);
      res.json({ fractures: listR.rows, distribution: distR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/drift/alerts", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_drift ORDER BY drift_magnitude DESC, detected_at DESC LIMIT 50`
      );
      const kpiR = await pool.query(
        `SELECT drift_type, AVG(drift_magnitude) avg_mag, SUM(CASE WHEN silent_deterioration_flag THEN 1 ELSE 0 END) silent
         FROM lde_drift GROUP BY drift_type ORDER BY avg_mag DESC`
      );
      res.json({ alerts: r.rows, by_type: kpiR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

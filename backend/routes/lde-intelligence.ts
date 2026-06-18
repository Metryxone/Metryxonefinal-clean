// LDE — Longitudinal Development Engine: Intelligence Routes
// Sections 18–25: Knowledge Graph, Semantic Reasoning, Benchmarking, Cohort,
// Multi-Generational, Federated, Simulation, Meta-Longitudinal

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, decimals = 3) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Canonical psychometric nodes are always tenant_id=null (global, shared constructs).
// tenant-scoped custom nodes should use unique key prefixes (e.g. "tenant_<id>_<key>").
async function upsertNode(pool: Pool, _tenantId: string|null, type: string, key: string, label: string, properties: any = {}): Promise<string|null> {
  const r = await pool.query(
    `INSERT INTO lde_knowledge_graph_nodes (tenant_id, node_type, node_key, label, properties)
     VALUES (NULL,$1,$2,$3,$4)
     ON CONFLICT (node_key) DO UPDATE SET
       node_type = EXCLUDED.node_type,
       label = EXCLUDED.label,
       properties = EXCLUDED.properties
     RETURNING id`,
    [type, key, label, JSON.stringify(properties)]
  );
  return r.rows[0]?.id ?? null;
}

// Returns true when a row was actually inserted (not a no-op conflict skip).
// Propagates DB errors — callers must handle or let them bubble to the route error handler.
async function upsertEdge(pool: Pool, _tenantId: string|null, srcId: string, tgtId: string, rel: string, weight: number, confidence = 0.8): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO lde_knowledge_graph_edges (tenant_id, source_id, target_id, relationship, weight, confidence)
     VALUES (NULL,$1,$2,$3,$4,$5)
     ON CONFLICT (source_id, target_id, relationship) DO NOTHING
     RETURNING id`,
    [srcId, tgtId, rel, weight, confidence]
  );
  return r.rows.length > 0;
}

// ─── Subdomain name → canonical LBI graph node key (exported for shared use) ─
export const SUBDOMAIN_TO_LBI: Array<[RegExp, string]> = [
  [/attent|focus|concentrat/i,                  'lbi_att'],
  [/cognit|process|reason|intellect/i,          'lbi_cog'],
  [/memor|retent|recall|encod/i,                'lbi_mem'],
  [/execut|planning|inhibit|self.?control/i,    'lbi_exf'],
  [/emotion|affect|feeling|mood|regulat/i,      'lbi_emo'],
  [/motiv|drive|goal|aspir|intrinsic/i,         'lbi_mot'],
  [/resilien|persist|persever|grit|recover/i,   'lbi_res'],
  [/social|collabor|cooperat|peer|group/i,      'lbi_soc'],
  [/communicat|express|verbal|language/i,       'lbi_com'],
  [/creativ|innovat|divergent|ideation/i,       'lbi_cre'],
  [/analytic|critical.?think|logic|evaluat/i,   'lbi_ana'],
  [/digital|technolog|screen|online|media/i,    'lbi_dig'],
  [/self.?manage|organis|disciplin|responsib/i, 'lbi_slf'],
  [/adapt|flex|change|cope|coping/i,            'lbi_adp'],
  [/leader|influence|decision|authority/i,      'lbi_ldr'],
  [/career|occupat|professional|vocation/i,     'lbi_car'],
  [/wellbeing|wellness|health|stress|burnout/i, 'lbi_wel'],
  [/performance|pressure|high.?stake|deliver/i, 'lbi_per'],
  [/growth.?mindset|mindset|belief|develop/i,   'lbi_gro'],
];

function mapSubdomainToLBIKey(subdomainName: string): string | null {
  for (const [pattern, key] of SUBDOMAIN_TO_LBI) {
    if (pattern.test(subdomainName)) return key;
  }
  return null;
}

// ─── Ensure lde_user_graph_activations table exists ──────────────────────────
async function ensureActivationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lde_user_graph_activations (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email      text NOT NULL,
      session_id      uuid,
      node_id         uuid,
      node_key        text NOT NULL,
      node_label      text,
      node_type       text,
      activation_score numeric DEFAULT 0,
      activation_type  text DEFAULT 'subdomain',
      activated_at    timestamptz DEFAULT now(),
      UNIQUE (user_email, session_id, node_key)
    );
    CREATE INDEX IF NOT EXISTS idx_lde_uga_email   ON lde_user_graph_activations(user_email);
    CREATE INDEX IF NOT EXISTS idx_lde_uga_session ON lde_user_graph_activations(session_id);
    CREATE INDEX IF NOT EXISTS idx_lde_uga_score   ON lde_user_graph_activations(activation_score);
  `);
}

/**
 * Activate knowledge graph nodes for a completed CAPADEX session.
 * Maps concern → concern_category node, and each subdomain score → LBI domain node.
 * Called non-blocking from postCompletionHooks.
 */
export async function activateGraphNodes(
  pool: Pool,
  email: string,
  sessionId: string,
  concernName: string,
  subdomainScores: Record<string, number>
): Promise<void> {
  await ensureActivationsTable(pool);

  const emailLower = email.toLowerCase().trim();

  // Helper: upsert one activation record
  async function activateNode(nodeKey: string, score: number, type: string) {
    const nodeR = await pool.query(
      `SELECT id, label, node_type FROM lde_knowledge_graph_nodes WHERE node_key = $1 LIMIT 1`,
      [nodeKey]
    );
    const node = nodeR.rows[0];
    if (!node) return;
    await pool.query(`
      INSERT INTO lde_user_graph_activations
        (user_email, session_id, node_id, node_key, node_label, node_type, activation_score, activation_type)
      VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_email, session_id, node_key) DO UPDATE SET
        activation_score = GREATEST(EXCLUDED.activation_score, lde_user_graph_activations.activation_score),
        activated_at = now()
    `, [emailLower, sessionId, node.id, nodeKey, node.label, node.node_type, score, type]);
  }

  // 1. Activate concern category node
  const CONCERN_CAT_MAP: Record<string, string> = {
    digital: 'concern_digital', academic: 'concern_academics',
    emotional: 'concern_emotional', behavioural: 'concern_behavior',
    social: 'concern_social', career: 'concern_career', general: 'concern_betterment',
  };
  const concernCat = (() => {
    const l = concernName.toLowerCase();
    if (/screen|phone|gaming|social.?media|digital|internet/.test(l)) return 'digital';
    if (/study|exam|homework|academic|school|grade|learning/.test(l)) return 'academic';
    if (/anxiety|stress|emotion|mood|depress|worry|fear|loneli|mental/.test(l)) return 'emotional';
    if (/focus|attent|distract|concentrat|procrastinat|impulsiv/.test(l)) return 'behavioural';
    if (/social|peer|friend|relation|communicat|conflict|bully/.test(l)) return 'social';
    if (/career|job|employ|skill|workplace/.test(l)) return 'career';
    return 'general';
  })();
  const concernNodeKey = CONCERN_CAT_MAP[concernCat];
  if (concernNodeKey) await activateNode(concernNodeKey, 100, 'concern');

  // 2. Activate LBI domain nodes based on subdomain scores
  const activatedLBIKeys = new Set<string>();
  for (const [subdomainName, score] of Object.entries(subdomainScores)) {
    const lbiKey = mapSubdomainToLBIKey(subdomainName);
    if (lbiKey) {
      await activateNode(lbiKey, score, 'subdomain');
      activatedLBIKeys.add(lbiKey);
    }
  }

  // 3. For low-scoring domains (<50), also activate recommended intervention nodes
  const lowScoringEntries = Object.entries(subdomainScores).filter(([, s]) => s < 50);
  for (const [subdomainName] of lowScoringEntries) {
    const lbiKey = mapSubdomainToLBIKey(subdomainName);
    if (!lbiKey) continue;
    const lbiNodeR = await pool.query(
      `SELECT id FROM lde_knowledge_graph_nodes WHERE node_key = $1 LIMIT 1`, [lbiKey]
    );
    if (!lbiNodeR.rows[0]) continue;
    const interventionR = await pool.query(
      `SELECT n.node_key, e.weight FROM lde_knowledge_graph_edges e
       JOIN lde_knowledge_graph_nodes n ON n.id = e.source_id
       WHERE e.target_id = $1 AND n.node_type = 'Intervention'
       ORDER BY e.weight DESC LIMIT 2`,
      [lbiNodeR.rows[0].id]
    );
    for (const intNode of interventionR.rows) {
      await activateNode(intNode.node_key, intNode.weight * 100, 'intervention');
    }
  }
}

/**
 * Get graph-recommended interventions for a set of low-scoring LBI keys.
 * Returns a map keyed by LBI node key so callers can look up the intervention
 * for each specific domain without index mismatches.
 */
export async function getGraphInterventions(
  pool: Pool,
  lbiKeys: string[]
): Promise<Record<string, { key: string; label: string; weight: number }>> {
  if (lbiKeys.length === 0) return {};
  const result: Record<string, { key: string; label: string; weight: number }> = {};
  for (const lbiKey of lbiKeys) {
    const nodeR = await pool.query(
      `SELECT id FROM lde_knowledge_graph_nodes WHERE node_key = $1 LIMIT 1`, [lbiKey]
    );
    if (!nodeR.rows[0]) continue;
    const intR = await pool.query(
      `SELECT n.node_key, n.label, e.weight
       FROM lde_knowledge_graph_edges e
       JOIN lde_knowledge_graph_nodes n ON n.id = e.source_id
       WHERE e.target_id = $1 AND n.node_type = 'Intervention'
       ORDER BY e.weight DESC LIMIT 1`,
      [nodeR.rows[0].id]
    );
    if (intR.rows[0]) {
      result[lbiKey] = {
        key: intR.rows[0].node_key,
        label: intR.rows[0].label,
        weight: parseFloat(intR.rows[0].weight),
      };
    }
  }
  return result;
}

export function registerLDEIntelligenceRoutes(app: Express, pool: Pool) {

  // ── Section 18: Knowledge Graph ─────────────────────────────────────────────
  app.post("/api/lde/graph/seed", async (req, res) => {
    try {
      const { tenant_id } = req.body;
      const tid = tenant_id || null;

      // ── Temporal anchor nodes ─────────────────────────────────────────
      const temporalNodes = [
        { type: 'Time', key: 'time_origin', label: 'Temporal Origin' },
        { type: 'Time', key: 'time_30d', label: '30-Day Window' },
        { type: 'Time', key: 'time_90d', label: '90-Day Window' },
        { type: 'Time', key: 'time_180d', label: '180-Day Window' },
        { type: 'Time', key: 'time_365d', label: '1-Year Window' }
      ];

      // ── Core behavioural signal nodes ─────────────────────────────────
      const behaviourNodes = [
        { type: 'Behaviour', key: 'beh_engagement', label: 'Engagement Behaviour' },
        { type: 'Behaviour', key: 'beh_persistence', label: 'Persistence Behaviour' },
        { type: 'Behaviour', key: 'beh_avoidance', label: 'Avoidance Behaviour' },
        { type: 'Behaviour', key: 'beh_impulsivity', label: 'Impulsivity Behaviour' },
        { type: 'Behaviour', key: 'beh_compliance', label: 'Compliance Behaviour' },
        { type: 'Behaviour', key: 'beh_proactivity', label: 'Proactivity Behaviour' }
      ];

      // ── Emotional state nodes ─────────────────────────────────────────
      const emotionNodes = [
        { type: 'Emotion', key: 'emo_anxiety', label: 'Anxiety State' },
        { type: 'Emotion', key: 'emo_motivation', label: 'Motivational State' },
        { type: 'Emotion', key: 'emo_resilience', label: 'Resilience State' },
        { type: 'Emotion', key: 'emo_burnout', label: 'Burnout State' },
        { type: 'Emotion', key: 'emo_confidence', label: 'Confidence State' },
        { type: 'Emotion', key: 'emo_frustration', label: 'Frustration State' },
        { type: 'Emotion', key: 'emo_curiosity', label: 'Curiosity State' }
      ];

      // ── Cognitive state nodes ─────────────────────────────────────────
      const cognitionNodes = [
        { type: 'Cognition', key: 'cog_overload', label: 'Cognitive Overload' },
        { type: 'Cognition', key: 'cog_clarity', label: 'Cognitive Clarity' },
        { type: 'Cognition', key: 'cog_load_high', label: 'High Cognitive Load' },
        { type: 'Cognition', key: 'cog_load_low', label: 'Low Cognitive Load' },
        { type: 'Cognition', key: 'cog_executive_function', label: 'Executive Function' },
        { type: 'Cognition', key: 'cog_working_memory', label: 'Working Memory Capacity' }
      ];

      // ── LBI Domain nodes (19 LBI domains) ────────────────────────────
      const lbiDomainNodes = [
        { type: 'LBI_Domain', key: 'lbi_cog', label: 'Cognitive Processing', props: { code: 'COG', framework: 'LBI', description: 'Capacity to process, analyse and reason with information' } },
        { type: 'LBI_Domain', key: 'lbi_att', label: 'Attention Regulation', props: { code: 'ATT', framework: 'LBI', description: 'Ability to sustain, focus and shift attention deliberately' } },
        { type: 'LBI_Domain', key: 'lbi_mem', label: 'Memory & Retention', props: { code: 'MEM', framework: 'LBI', description: 'Encoding, storage and retrieval of information' } },
        { type: 'LBI_Domain', key: 'lbi_exf', label: 'Executive Functioning', props: { code: 'EXF', framework: 'LBI', description: 'Higher-order planning, inhibition and cognitive control' } },
        { type: 'LBI_Domain', key: 'lbi_emo', label: 'Emotional Regulation', props: { code: 'EMO', framework: 'LBI', description: 'Identification, expression and management of emotions' } },
        { type: 'LBI_Domain', key: 'lbi_mot', label: 'Motivation & Drive', props: { code: 'MOT', framework: 'LBI', description: 'Intrinsic and extrinsic forces that sustain goal pursuit' } },
        { type: 'LBI_Domain', key: 'lbi_res', label: 'Resilience & Persistence', props: { code: 'RES', framework: 'LBI', description: 'Capacity to recover from setbacks and maintain effort' } },
        { type: 'LBI_Domain', key: 'lbi_soc', label: 'Social Learning', props: { code: 'SOC', framework: 'LBI', description: 'Learning through social interaction, observation and collaboration' } },
        { type: 'LBI_Domain', key: 'lbi_com', label: 'Communication Skills', props: { code: 'COM', framework: 'LBI', description: 'Verbal, written and digital expression of ideas' } },
        { type: 'LBI_Domain', key: 'lbi_cre', label: 'Creativity & Innovation', props: { code: 'CRE', framework: 'LBI', description: 'Divergent thinking, ideation and novel problem-solving' } },
        { type: 'LBI_Domain', key: 'lbi_ana', label: 'Analytical Thinking', props: { code: 'ANA', framework: 'LBI', description: 'Logical reasoning, evaluation and evidence-based conclusions' } },
        { type: 'LBI_Domain', key: 'lbi_dig', label: 'Digital Literacy', props: { code: 'DIG', framework: 'LBI', description: 'Competency with technology, media and online environments' } },
        { type: 'LBI_Domain', key: 'lbi_slf', label: 'Self-Management', props: { code: 'SLF', framework: 'LBI', description: 'Organisation, discipline and responsibility for own learning' } },
        { type: 'LBI_Domain', key: 'lbi_adp', label: 'Adaptability', props: { code: 'ADP', framework: 'LBI', description: 'Flexibility and openness to change and new challenges' } },
        { type: 'LBI_Domain', key: 'lbi_ldr', label: 'Leadership Potential', props: { code: 'LDR', framework: 'LBI', description: 'Influence, decision-making and accountability in group contexts' } },
        { type: 'LBI_Domain', key: 'lbi_car', label: 'Career Orientation', props: { code: 'CAR', framework: 'LBI', description: 'Clarity and preparedness for future career pathways' } },
        { type: 'LBI_Domain', key: 'lbi_wel', label: 'Wellbeing', props: { code: 'WEL', framework: 'LBI', description: 'Physical, emotional, social and digital wellness indicators' } },
        { type: 'LBI_Domain', key: 'lbi_per', label: 'Performance Under Pressure', props: { code: 'PER', framework: 'LBI', description: 'Ability to maintain quality output during high-stakes conditions' } },
        { type: 'LBI_Domain', key: 'lbi_gro', label: 'Growth Mindset', props: { code: 'GRO', framework: 'LBI', description: 'Belief that abilities can be developed through effort and learning' } }
      ];

      // ── SDI Domain nodes (Social Development Index) ───────────────────
      const sdiDomainNodes = [
        { type: 'SDI_Domain', key: 'sdi_self_awareness', label: 'Self-Awareness', props: { framework: 'SDI', description: 'Recognition of own emotions, strengths and impact on others' } },
        { type: 'SDI_Domain', key: 'sdi_self_regulation', label: 'Self-Regulation', props: { framework: 'SDI', description: 'Managing impulses and adapting to changing demands' } },
        { type: 'SDI_Domain', key: 'sdi_social_awareness', label: 'Social Awareness', props: { framework: 'SDI', description: 'Reading social cues and understanding group dynamics' } },
        { type: 'SDI_Domain', key: 'sdi_social_skills', label: 'Social Skills', props: { framework: 'SDI', description: 'Building and maintaining productive interpersonal relationships' } },
        { type: 'SDI_Domain', key: 'sdi_relationship_mgmt', label: 'Relationship Management', props: { framework: 'SDI', description: 'Nurturing long-term connections and collaborative outcomes' } },
        { type: 'SDI_Domain', key: 'sdi_empathy', label: 'Empathy', props: { framework: 'SDI', description: 'Understanding and sharing the feelings of others' } },
        { type: 'SDI_Domain', key: 'sdi_communication', label: 'Communication', props: { framework: 'SDI', description: 'Clarity, assertiveness and active listening in exchanges' } },
        { type: 'SDI_Domain', key: 'sdi_collaboration', label: 'Collaboration', props: { framework: 'SDI', description: 'Working synergistically toward shared objectives' } },
        { type: 'SDI_Domain', key: 'sdi_conflict_resolution', label: 'Conflict Resolution', props: { framework: 'SDI', description: 'Navigating disagreements constructively and restoring harmony' } },
        { type: 'SDI_Domain', key: 'sdi_leadership', label: 'Leadership', props: { framework: 'SDI', description: 'Guiding groups and inspiring collective effort' } }
      ];

      // ── Competency Domain nodes ───────────────────────────────────────
      const competencyDomainNodes = [
        { type: 'Competency_Domain', key: 'comp_cognitive_agility', label: 'Cognitive Agility', props: { framework: 'Competency', description: 'Rapid mental switching and adaptive problem-solving' } },
        { type: 'Competency_Domain', key: 'comp_emotional_intelligence', label: 'Emotional Intelligence', props: { framework: 'Competency', description: 'Integrated emotional self-awareness and social fluency' } },
        { type: 'Competency_Domain', key: 'comp_social_intelligence', label: 'Social Intelligence', props: { framework: 'Competency', description: 'Reading complex social environments and influencing outcomes' } },
        { type: 'Competency_Domain', key: 'comp_digital_literacy', label: 'Digital Literacy', props: { framework: 'Competency', description: 'Proficiency with digital tools, data and online citizenship' } },
        { type: 'Competency_Domain', key: 'comp_critical_thinking', label: 'Critical Thinking', props: { framework: 'Competency', description: 'Systematic analysis, argumentation and evidence evaluation' } },
        { type: 'Competency_Domain', key: 'comp_adaptability', label: 'Adaptability & Flexibility', props: { framework: 'Competency', description: 'Thriving in ambiguous, changing and complex environments' } },
        { type: 'Competency_Domain', key: 'comp_leadership', label: 'Leadership Potential', props: { framework: 'Competency', description: 'Demonstrated capacity to lead, inspire and take ownership' } },
        { type: 'Competency_Domain', key: 'comp_career_readiness', label: 'Career Readiness', props: { framework: 'Competency', description: 'Preparedness for workplace expectations and professional growth' } }
      ];

      // ── CAPADEX Concern Category nodes ────────────────────────────────
      const concernCategoryNodes = [
        { type: 'Concern_Category', key: 'concern_focus', label: 'Focus & Attention', props: { category: 'Focus', capadex_category: 'cognitive' } },
        { type: 'Concern_Category', key: 'concern_academics', label: 'Academic Performance', props: { category: 'Academics', capadex_category: 'academic' } },
        { type: 'Concern_Category', key: 'concern_emotional', label: 'Emotional Wellbeing', props: { category: 'Emotional', capadex_category: 'emotional' } },
        { type: 'Concern_Category', key: 'concern_social', label: 'Social Relationships', props: { category: 'Social', capadex_category: 'social' } },
        { type: 'Concern_Category', key: 'concern_digital', label: 'Digital Habits', props: { category: 'Digital', capadex_category: 'digital' } },
        { type: 'Concern_Category', key: 'concern_mental_health', label: 'Mental Health', props: { category: 'Mental Health', capadex_category: 'emotional' } },
        { type: 'Concern_Category', key: 'concern_behavior', label: 'Behaviour & Conduct', props: { category: 'Behavior', capadex_category: 'behavioural' } },
        { type: 'Concern_Category', key: 'concern_career', label: 'Career & Future', props: { category: 'Career', capadex_category: 'career' } },
        { type: 'Concern_Category', key: 'concern_habits', label: 'Habits & Routine', props: { category: 'Habits', capadex_category: 'behavioural' } },
        { type: 'Concern_Category', key: 'concern_learning', label: 'Learning Style', props: { category: 'Learning', capadex_category: 'cognitive' } },
        { type: 'Concern_Category', key: 'concern_cognitive', label: 'Cognitive Development', props: { category: 'Cognitive', capadex_category: 'cognitive' } },
        { type: 'Concern_Category', key: 'concern_family', label: 'Family Dynamics', props: { category: 'Family', capadex_category: 'social' } },
        { type: 'Concern_Category', key: 'concern_parenting', label: 'Parenting Challenges', props: { category: 'Parenting', capadex_category: 'social' } },
        { type: 'Concern_Category', key: 'concern_health', label: 'Physical Health', props: { category: 'Health', capadex_category: 'emotional' } },
        { type: 'Concern_Category', key: 'concern_future_skills', label: 'Future Skills', props: { category: 'Future Skills', capadex_category: 'digital' } },
        { type: 'Concern_Category', key: 'concern_board_exams', label: 'Board Exam Pressure', props: { category: 'Board Exams', capadex_category: 'academic' } },
        { type: 'Concern_Category', key: 'concern_betterment', label: 'Self-Improvement', props: { category: 'Betterment', capadex_category: 'career' } },
        { type: 'Concern_Category', key: 'concern_environment', label: 'Environmental Stressors', props: { category: 'Environment', capadex_category: 'emotional' } }
      ];

      // ── Expanded Intervention nodes ───────────────────────────────────
      const interventionNodes = [
        { type: 'Intervention', key: 'int_mentorship', label: 'Mentorship Intervention', props: { effectiveness: 0.88, modality: 'one-on-one' } },
        { type: 'Intervention', key: 'int_assessment', label: 'Assessment Intervention', props: { effectiveness: 0.80, modality: 'psychometric' } },
        { type: 'Intervention', key: 'int_cognitive_coaching', label: 'Cognitive Coaching', props: { effectiveness: 0.85, modality: 'structured' } },
        { type: 'Intervention', key: 'int_emotional_support', label: 'Emotional Support Therapy', props: { effectiveness: 0.90, modality: 'counselling' } },
        { type: 'Intervention', key: 'int_social_skills_training', label: 'Social Skills Training', props: { effectiveness: 0.82, modality: 'group' } },
        { type: 'Intervention', key: 'int_career_counselling', label: 'Career Counselling', props: { effectiveness: 0.87, modality: 'one-on-one' } },
        { type: 'Intervention', key: 'int_digital_wellness', label: 'Digital Wellness Program', props: { effectiveness: 0.78, modality: 'self-directed' } },
        { type: 'Intervention', key: 'int_academic_tutoring', label: 'Academic Tutoring', props: { effectiveness: 0.83, modality: 'structured' } },
        { type: 'Intervention', key: 'int_mindfulness', label: 'Mindfulness & Attention Training', props: { effectiveness: 0.86, modality: 'practice-based' } },
        { type: 'Intervention', key: 'int_group_therapy', label: 'Group Therapy', props: { effectiveness: 0.75, modality: 'group' } },
        { type: 'Intervention', key: 'int_parental_guidance', label: 'Parental Guidance', props: { effectiveness: 0.72, modality: 'family' } },
        { type: 'Intervention', key: 'int_peer_support', label: 'Peer Support Program', props: { effectiveness: 0.74, modality: 'peer' } },
        { type: 'Intervention', key: 'int_habit_coaching', label: 'Habit Formation Coaching', props: { effectiveness: 0.80, modality: 'behavioural' } },
        { type: 'Intervention', key: 'int_study_skills', label: 'Study Skills Workshop', props: { effectiveness: 0.79, modality: 'group' } }
      ];

      // ── Outcome & Trajectory nodes ─────────────────────────────────────
      const outcomeNodes = [
        { type: 'Outcome', key: 'out_growth', label: 'Growth Outcome' },
        { type: 'Outcome', key: 'out_stagnation', label: 'Stagnation Outcome' },
        { type: 'Outcome', key: 'out_breakthrough', label: 'Breakthrough Outcome' },
        { type: 'Outcome', key: 'out_dropout_risk', label: 'Dropout Risk Outcome' },
        { type: 'Outcome', key: 'out_career_readiness', label: 'Career Readiness Outcome' },
        { type: 'Outcome', key: 'out_academic_success', label: 'Academic Success Outcome' },
        { type: 'Trajectory', key: 'traj_accelerating', label: 'Accelerating Trajectory' },
        { type: 'Trajectory', key: 'traj_collapsing', label: 'Collapsing Trajectory' },
        { type: 'Trajectory', key: 'traj_recovering', label: 'Recovery Trajectory' },
        { type: 'Trajectory', key: 'traj_stable', label: 'Stable Trajectory' },
        { type: 'Signal', key: 'sig_weak', label: 'Weak Signal' },
        { type: 'Signal', key: 'sig_strong', label: 'Strong Signal' },
        { type: 'Signal', key: 'sig_early_warning', label: 'Early Warning Signal' },
        { type: 'Signal', key: 'sig_crisis', label: 'Crisis Signal' }
      ];

      const allNodeSeeds = [
        ...temporalNodes, ...behaviourNodes, ...emotionNodes, ...cognitionNodes,
        ...lbiDomainNodes, ...sdiDomainNodes, ...competencyDomainNodes,
        ...concernCategoryNodes, ...interventionNodes, ...outcomeNodes
      ];

      // ── Upsert all nodes ──────────────────────────────────────────────
      interface NodeSeed { type: string; key: string; label: string; props?: Record<string, unknown> }
      const nodeMap: Record<string, string> = {};
      let nc = 0;
      for (const n of allNodeSeeds as NodeSeed[]) {
        const id = await upsertNode(pool, null, n.type, n.key, n.label, n.props ?? {});
        if (id) { nodeMap[n.key] = id; nc++; }
      }

      // Helper to add edge if both nodes exist — returns true if actually inserted this run
      let ec = 0;
      async function edge(src: string, tgt: string, rel: string, weight: number, confidence = 0.8) {
        if (nodeMap[src] && nodeMap[tgt]) {
          const inserted = await upsertEdge(pool, null, nodeMap[src], nodeMap[tgt], rel, weight, confidence);
          if (inserted) ec++;
        }
      }

      // ── Temporal edges ────────────────────────────────────────────────
      await edge('time_origin', 'beh_engagement', 'precedes', 1.0);
      await edge('time_30d', 'time_90d', 'precedes', 1.0);
      await edge('time_90d', 'time_180d', 'precedes', 1.0);
      await edge('time_180d', 'time_365d', 'precedes', 1.0);

      // ── Psychometric causal edges: LBI domain → LBI domain ───────────
      await edge('lbi_att', 'lbi_cog', 'enables', 0.80);          // attention enables cognitive processing
      await edge('lbi_cog', 'lbi_mem', 'enables', 0.75);          // cognitive processing enables memory
      await edge('lbi_cog', 'lbi_ana', 'enables', 0.78);          // cognitive processing enables analytical thinking
      await edge('lbi_exf', 'lbi_att', 'regulates', 0.85);        // executive function regulates attention
      await edge('lbi_exf', 'lbi_slf', 'enables', 0.80);          // executive function enables self-management
      await edge('lbi_exf', 'lbi_per', 'enables', 0.75);          // executive function enables performance under pressure
      await edge('lbi_exf', 'lbi_mot', 'enables', 0.70);          // executive function enables motivation
      await edge('lbi_emo', 'lbi_mot', 'enables', 0.72);          // emotional regulation enables motivation
      await edge('lbi_emo', 'lbi_res', 'enables', 0.68);          // emotional regulation enables resilience
      await edge('lbi_emo', 'lbi_soc', 'enables', 0.65);          // emotional regulation enables social learning
      await edge('lbi_emo', 'lbi_com', 'enables', 0.60);          // emotional regulation enables communication
      await edge('lbi_mot', 'lbi_gro', 'enables', 0.82);          // motivation enables growth mindset
      await edge('lbi_mot', 'lbi_per', 'enables', 0.72);          // motivation enables performance
      await edge('lbi_mot', 'lbi_car', 'enables', 0.65);          // motivation enables career orientation
      await edge('lbi_res', 'lbi_per', 'enables', 0.85);          // resilience enables performance under pressure
      await edge('lbi_res', 'lbi_emo', 'stabilises', 0.68);       // resilience stabilises emotional state
      await edge('lbi_res', 'lbi_adp', 'enables', 0.72);          // resilience enables adaptability
      await edge('lbi_soc', 'lbi_com', 'enables', 0.78);          // social learning enables communication
      await edge('lbi_soc', 'lbi_ldr', 'enables', 0.68);          // social learning enables leadership
      await edge('lbi_soc', 'lbi_adp', 'enables', 0.65);          // social learning enables adaptability
      await edge('lbi_gro', 'lbi_adp', 'enables', 0.78);          // growth mindset enables adaptability
      await edge('lbi_gro', 'lbi_car', 'enables', 0.68);          // growth mindset enables career orientation
      await edge('lbi_gro', 'lbi_cre', 'enables', 0.72);          // growth mindset enables creativity
      await edge('lbi_ldr', 'lbi_car', 'enables', 0.72);          // leadership enables career
      await edge('lbi_dig', 'lbi_car', 'enables', 0.62);          // digital literacy enables career
      await edge('lbi_dig', 'lbi_cre', 'enables', 0.60);          // digital literacy enables creativity
      await edge('lbi_wel', 'lbi_emo', 'enables', 0.82);          // wellbeing enables emotional regulation
      await edge('lbi_wel', 'lbi_per', 'enables', 0.62);          // wellbeing enables performance
      await edge('lbi_wel', 'lbi_mot', 'enables', 0.65);          // wellbeing enables motivation
      await edge('lbi_ana', 'lbi_cre', 'enables', 0.70);          // analytical thinking enables creativity
      await edge('lbi_ana', 'lbi_car', 'enables', 0.65);          // analytical thinking enables career
      await edge('lbi_slf', 'lbi_per', 'enables', 0.78);          // self-management enables performance
      await edge('lbi_slf', 'lbi_mot', 'enables', 0.70);          // self-management enables motivation
      await edge('lbi_mem', 'lbi_per', 'enables', 0.68);          // memory enables performance
      await edge('lbi_adp', 'lbi_car', 'enables', 0.68);          // adaptability enables career

      // ── LBI domain → cognitive/behaviour/emotion state edges ─────────
      await edge('lbi_att', 'cog_overload', 'mediates', 0.78);
      await edge('lbi_exf', 'cog_executive_function', 'defines', 0.92);
      await edge('lbi_mem', 'cog_working_memory', 'defines', 0.90);
      await edge('lbi_emo', 'emo_anxiety', 'regulates', 0.80);
      await edge('lbi_emo', 'emo_confidence', 'enables', 0.75);
      await edge('lbi_mot', 'emo_motivation', 'defines', 0.90);
      await edge('lbi_res', 'emo_resilience', 'defines', 0.90);
      await edge('lbi_wel', 'emo_burnout', 'prevents', 0.75);
      await edge('lbi_gro', 'emo_curiosity', 'fosters', 0.80);
      await edge('lbi_slf', 'beh_persistence', 'enables', 0.82);
      await edge('lbi_mot', 'beh_engagement', 'drives', 0.85);
      await edge('lbi_exf', 'beh_impulsivity', 'suppresses', 0.80);

      // ── SDI ↔ LBI cross-framework causal edges ────────────────────────
      await edge('sdi_self_regulation', 'lbi_exf', 'correlates', 0.82);
      await edge('sdi_self_awareness', 'lbi_emo', 'correlates', 0.80);
      await edge('sdi_social_skills', 'lbi_soc', 'correlates', 0.88);
      await edge('sdi_empathy', 'lbi_soc', 'enables', 0.75);
      await edge('sdi_empathy', 'lbi_com', 'enables', 0.72);
      await edge('sdi_collaboration', 'lbi_soc', 'correlates', 0.85);
      await edge('sdi_leadership', 'lbi_ldr', 'correlates', 0.90);
      await edge('sdi_communication', 'lbi_com', 'correlates', 0.88);
      await edge('sdi_conflict_resolution', 'lbi_adp', 'enables', 0.72);
      await edge('sdi_relationship_mgmt', 'lbi_soc', 'enables', 0.78);

      // ── Competency ↔ LBI cross-framework edges ────────────────────────
      await edge('comp_cognitive_agility', 'lbi_cog', 'subsumes', 0.85);
      await edge('comp_cognitive_agility', 'lbi_adp', 'subsumes', 0.78);
      await edge('comp_emotional_intelligence', 'lbi_emo', 'subsumes', 0.88);
      await edge('comp_social_intelligence', 'lbi_soc', 'subsumes', 0.85);
      await edge('comp_digital_literacy', 'lbi_dig', 'subsumes', 0.90);
      await edge('comp_critical_thinking', 'lbi_ana', 'subsumes', 0.85);
      await edge('comp_critical_thinking', 'lbi_cog', 'subsumes', 0.78);
      await edge('comp_adaptability', 'lbi_adp', 'subsumes', 0.90);
      await edge('comp_leadership', 'lbi_ldr', 'subsumes', 0.88);
      await edge('comp_career_readiness', 'lbi_car', 'subsumes', 0.90);

      // ── CAPADEX concern category → LBI domain edges ───────────────────
      await edge('concern_focus', 'lbi_att', 'maps_to', 0.92);
      await edge('concern_focus', 'lbi_exf', 'maps_to', 0.85);
      await edge('concern_focus', 'lbi_cog', 'maps_to', 0.80);
      await edge('concern_academics', 'lbi_mem', 'maps_to', 0.85);
      await edge('concern_academics', 'lbi_cog', 'maps_to', 0.80);
      await edge('concern_academics', 'lbi_mot', 'maps_to', 0.72);
      await edge('concern_emotional', 'lbi_emo', 'maps_to', 0.92);
      await edge('concern_emotional', 'lbi_res', 'maps_to', 0.80);
      await edge('concern_social', 'lbi_soc', 'maps_to', 0.92);
      await edge('concern_social', 'lbi_com', 'maps_to', 0.82);
      await edge('concern_digital', 'lbi_dig', 'maps_to', 0.92);
      await edge('concern_digital', 'lbi_slf', 'maps_to', 0.72);
      await edge('concern_mental_health', 'lbi_wel', 'maps_to', 0.90);
      await edge('concern_mental_health', 'lbi_emo', 'maps_to', 0.85);
      await edge('concern_mental_health', 'lbi_res', 'maps_to', 0.78);
      await edge('concern_behavior', 'lbi_slf', 'maps_to', 0.88);
      await edge('concern_behavior', 'lbi_exf', 'maps_to', 0.82);
      await edge('concern_career', 'lbi_car', 'maps_to', 0.92);
      await edge('concern_career', 'lbi_ldr', 'maps_to', 0.75);
      await edge('concern_career', 'lbi_mot', 'maps_to', 0.72);
      await edge('concern_habits', 'lbi_slf', 'maps_to', 0.88);
      await edge('concern_habits', 'lbi_exf', 'maps_to', 0.80);
      await edge('concern_learning', 'lbi_cog', 'maps_to', 0.88);
      await edge('concern_learning', 'lbi_mem', 'maps_to', 0.82);
      await edge('concern_learning', 'lbi_adp', 'maps_to', 0.72);
      await edge('concern_cognitive', 'lbi_cog', 'maps_to', 0.90);
      await edge('concern_cognitive', 'lbi_exf', 'maps_to', 0.82);
      await edge('concern_cognitive', 'lbi_ana', 'maps_to', 0.78);
      await edge('concern_family', 'lbi_soc', 'maps_to', 0.80);
      await edge('concern_family', 'lbi_emo', 'maps_to', 0.78);
      await edge('concern_parenting', 'lbi_soc', 'maps_to', 0.75);
      await edge('concern_health', 'lbi_wel', 'maps_to', 0.88);
      await edge('concern_future_skills', 'lbi_dig', 'maps_to', 0.85);
      await edge('concern_future_skills', 'lbi_cre', 'maps_to', 0.80);
      await edge('concern_future_skills', 'lbi_adp', 'maps_to', 0.78);
      await edge('concern_board_exams', 'lbi_per', 'maps_to', 0.92);
      await edge('concern_board_exams', 'lbi_att', 'maps_to', 0.82);
      await edge('concern_board_exams', 'lbi_mot', 'maps_to', 0.75);
      await edge('concern_betterment', 'lbi_gro', 'maps_to', 0.90);
      await edge('concern_betterment', 'lbi_mot', 'maps_to', 0.82);
      await edge('concern_environment', 'lbi_adp', 'maps_to', 0.85);
      await edge('concern_environment', 'lbi_res', 'maps_to', 0.78);

      // ── Intervention → LBI domain effectiveness edges ─────────────────
      await edge('int_cognitive_coaching', 'lbi_cog', 'improves', 0.88);
      await edge('int_cognitive_coaching', 'lbi_exf', 'improves', 0.82);
      await edge('int_cognitive_coaching', 'lbi_att', 'improves', 0.78);
      await edge('int_emotional_support', 'lbi_emo', 'improves', 0.92);
      await edge('int_emotional_support', 'lbi_res', 'improves', 0.78);
      await edge('int_emotional_support', 'lbi_wel', 'improves', 0.80);
      await edge('int_social_skills_training', 'lbi_soc', 'improves', 0.88);
      await edge('int_social_skills_training', 'lbi_com', 'improves', 0.82);
      await edge('int_career_counselling', 'lbi_car', 'improves', 0.90);
      await edge('int_career_counselling', 'lbi_mot', 'improves', 0.72);
      await edge('int_career_counselling', 'lbi_ldr', 'improves', 0.68);
      await edge('int_digital_wellness', 'lbi_dig', 'improves', 0.85);
      await edge('int_digital_wellness', 'lbi_wel', 'improves', 0.75);
      await edge('int_digital_wellness', 'lbi_slf', 'improves', 0.70);
      await edge('int_academic_tutoring', 'lbi_mem', 'improves', 0.82);
      await edge('int_academic_tutoring', 'lbi_cog', 'improves', 0.72);
      await edge('int_academic_tutoring', 'lbi_per', 'improves', 0.75);
      await edge('int_mindfulness', 'lbi_att', 'improves', 0.88);
      await edge('int_mindfulness', 'lbi_emo', 'improves', 0.82);
      await edge('int_mindfulness', 'lbi_per', 'improves', 0.78);
      await edge('int_mindfulness', 'lbi_wel', 'improves', 0.80);
      await edge('int_group_therapy', 'lbi_emo', 'improves', 0.78);
      await edge('int_group_therapy', 'lbi_soc', 'improves', 0.72);
      await edge('int_group_therapy', 'lbi_res', 'improves', 0.68);
      await edge('int_parental_guidance', 'lbi_wel', 'improves', 0.72);
      await edge('int_parental_guidance', 'lbi_emo', 'improves', 0.68);
      await edge('int_peer_support', 'lbi_soc', 'improves', 0.78);
      await edge('int_peer_support', 'lbi_mot', 'improves', 0.68);
      await edge('int_peer_support', 'lbi_res', 'improves', 0.65);
      await edge('int_habit_coaching', 'lbi_slf', 'improves', 0.85);
      await edge('int_habit_coaching', 'lbi_exf', 'improves', 0.78);
      await edge('int_habit_coaching', 'lbi_mot', 'improves', 0.72);
      await edge('int_study_skills', 'lbi_mem', 'improves', 0.80);
      await edge('int_study_skills', 'lbi_slf', 'improves', 0.78);
      await edge('int_study_skills', 'lbi_per', 'improves', 0.72);
      await edge('int_mentorship', 'emo_motivation', 'enables', 0.90);
      await edge('int_mentorship', 'lbi_ldr', 'improves', 0.82);
      await edge('int_mentorship', 'lbi_car', 'improves', 0.80);
      await edge('int_assessment', 'cog_clarity', 'enables', 0.78);
      await edge('int_assessment', 'lbi_gro', 'enables', 0.72);

      // ── Intervention → outcome edges ──────────────────────────────────
      await edge('int_emotional_support', 'out_growth', 'leads_to', 0.82);
      await edge('int_career_counselling', 'out_career_readiness', 'leads_to', 0.90);
      await edge('int_academic_tutoring', 'out_academic_success', 'leads_to', 0.85);
      await edge('int_cognitive_coaching', 'out_breakthrough', 'leads_to', 0.72);
      await edge('int_mindfulness', 'traj_stable', 'leads_to', 0.80);
      await edge('int_mentorship', 'traj_accelerating', 'leads_to', 0.82);
      await edge('int_peer_support', 'traj_recovering', 'leads_to', 0.72);

      // ── LBI domain → outcome edges ────────────────────────────────────
      await edge('lbi_per', 'out_academic_success', 'predicts', 0.82);
      await edge('lbi_car', 'out_career_readiness', 'predicts', 0.88);
      await edge('lbi_res', 'out_growth', 'predicts', 0.80);
      await edge('lbi_mot', 'out_growth', 'predicts', 0.78);
      await edge('lbi_gro', 'out_breakthrough', 'predicts', 0.75);
      await edge('lbi_wel', 'out_dropout_risk', 'mitigates', 0.75);
      await edge('lbi_slf', 'traj_accelerating', 'predicts', 0.72);
      await edge('beh_persistence', 'out_growth', 'causes', 0.85);
      await edge('beh_engagement', 'out_growth', 'causes', 0.90);
      await edge('beh_avoidance', 'out_dropout_risk', 'increases', 0.78);

      // ── Signal → state edges ──────────────────────────────────────────
      await edge('sig_weak', 'emo_anxiety', 'predicts', 0.62);
      await edge('sig_strong', 'traj_accelerating', 'predicts', 0.72);
      await edge('sig_early_warning', 'emo_burnout', 'indicates', 0.80);
      await edge('sig_crisis', 'out_dropout_risk', 'indicates', 0.88);
      await edge('emo_anxiety', 'cog_overload', 'amplifies', 0.78);
      await edge('cog_overload', 'beh_avoidance', 'causes', 0.72);
      await edge('emo_burnout', 'traj_collapsing', 'leads_to', 0.82);
      await edge('emo_motivation', 'beh_engagement', 'enables', 0.82);
      await edge('cog_clarity', 'traj_accelerating', 'leads_to', 0.72);

      // ── Trajectory → outcome edges ────────────────────────────────────
      await edge('traj_accelerating', 'out_breakthrough', 'leads_to', 0.78);
      await edge('traj_collapsing', 'out_dropout_risk', 'leads_to', 0.82);
      await edge('traj_recovering', 'out_growth', 'leads_to', 0.75);

      const breakdown = {
        temporal: temporalNodes.length,
        behaviour: behaviourNodes.length,
        emotion: emotionNodes.length,
        cognition: cognitionNodes.length,
        lbi_domains: lbiDomainNodes.length,
        sdi_domains: sdiDomainNodes.length,
        competency_domains: competencyDomainNodes.length,
        concern_categories: concernCategoryNodes.length,
        interventions: interventionNodes.length,
        outcomes_trajectories: outcomeNodes.length
      };
      await pool.query(
        `INSERT INTO lde_seed_log (seed_type, last_run_at, run_count, last_result)
         VALUES ('knowledge_graph', NOW(), 1, $1)
         ON CONFLICT (seed_type) DO UPDATE SET last_run_at=NOW(), run_count=lde_seed_log.run_count+1, last_result=$1`,
        [JSON.stringify({ seeded_nodes: nc, new_edges_this_run: ec, breakdown })]
      ).catch((e: any) => { console.warn('[lde-seed-log] Failed to record knowledge_graph seed timestamp:', e?.message); });
      res.json({
        seeded_nodes: nc,
        new_edges_this_run: ec,
        breakdown,
        note: 'seeded_nodes is always total upserted (idempotent); new_edges_this_run counts only newly inserted edges',
        message: 'LDE Knowledge Graph seeded with MetryxOne domain expertise'
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Sync graph nodes from live DB tables (lbi_domains, sdi_domains, competency_domains) ─
  app.post("/api/lde/graph/seed/domains", async (req, res) => {
    try {
      let nc = 0; let ec = 0; let skippedLinks = 0;
      const nodeMap: Record<string, string> = {};

      // Pull existing canonical graph node map for cross-linking
      const existingNodes = await pool.query(`SELECT node_key, id FROM lde_knowledge_graph_nodes WHERE tenant_id IS NULL`);
      for (const row of existingNodes.rows) nodeMap[row.node_key] = row.id;

      // Sync LBI domains — nodes are canonical (tenant_id=null)
      try {
        const lbiDomains = await pool.query(`SELECT domain_code, domain_name, description FROM lbi_domains WHERE status='Active' OR status IS NULL ORDER BY display_order`);
        for (const d of lbiDomains.rows) {
          const key = `lbi_db_${d.domain_code.toLowerCase()}`;
          const id = await upsertNode(pool, null, 'LBI_Domain', key, d.domain_name, { code: d.domain_code, framework: 'LBI', source: 'db', description: d.description });
          if (id) { nodeMap[key] = id; nc++; }
        }
      } catch { /* table may not exist yet */ }

      // Sync LBI subdomains and link to parent domain
      try {
        const lbiSubs = await pool.query(
          `SELECT s.subdomain_code, s.subdomain_name, s.description, d.domain_code
           FROM lbi_subdomains s JOIN lbi_domains d ON d.id = s.domain_id
           WHERE s.status='Active' OR s.status IS NULL ORDER BY s.display_order`
        );
        for (const s of lbiSubs.rows) {
          const key = `lbi_sub_${s.subdomain_code.toLowerCase()}`;
          const parentKey = `lbi_db_${s.domain_code.toLowerCase()}`;
          const id = await upsertNode(pool, null, 'LBI_Subdomain', key, s.subdomain_name, { code: s.subdomain_code, parent: s.domain_code, framework: 'LBI', source: 'db' });
          if (id) {
            nodeMap[key] = id; nc++;
            if (nodeMap[parentKey]) {
              const inserted = await upsertEdge(pool, null, nodeMap[parentKey], id, 'contains', 1.0);
              if (inserted) ec++;
            }
          }
        }
      } catch { /* table may not exist yet */ }

      // Sync SDI domains
      try {
        const sdiDomains = await pool.query(`SELECT domain_code, domain_name, description FROM sdi_domains WHERE is_active=true ORDER BY display_order`);
        for (const d of sdiDomains.rows) {
          const key = `sdi_db_${d.domain_code.toLowerCase()}`;
          const id = await upsertNode(pool, null, 'SDI_Domain', key, d.domain_name, { code: d.domain_code, framework: 'SDI', source: 'db', description: d.description });
          if (id) { nodeMap[key] = id; nc++; }
        }
      } catch { /* table may not exist yet */ }

      // Sync SDI subdomains
      try {
        const sdiSubs = await pool.query(`SELECT subdomain_code, subdomain_name, description, domain_code FROM sdi_subdomains WHERE is_active=true ORDER BY display_order`);
        for (const s of sdiSubs.rows) {
          const key = `sdi_sub_${s.subdomain_code.toLowerCase()}`;
          const parentKey = `sdi_db_${s.domain_code.toLowerCase()}`;
          const id = await upsertNode(pool, null, 'SDI_Subdomain', key, s.subdomain_name, { code: s.subdomain_code, parent: s.domain_code, framework: 'SDI', source: 'db' });
          if (id) {
            nodeMap[key] = id; nc++;
            if (nodeMap[parentKey]) {
              const inserted = await upsertEdge(pool, null, nodeMap[parentKey], id, 'contains', 1.0);
              if (inserted) ec++;
            } else { skippedLinks++; }
          }
        }
      } catch { /* table may not exist yet */ }

      // Sync Competency domains
      try {
        const compDomains = await pool.query(`SELECT code, name, description FROM competency_domains WHERE is_active=true ORDER BY display_order`);
        for (const d of compDomains.rows) {
          const key = `comp_db_${d.code.toLowerCase()}`;
          const id = await upsertNode(pool, null, 'Competency_Domain', key, d.name, { code: d.code, framework: 'Competency', source: 'db', description: d.description });
          if (id) { nodeMap[key] = id; nc++; }
        }
      } catch { /* table may not exist yet */ }

      // Sync Competency items
      try {
        const compItems = await pool.query(
          `SELECT c.code, c.name, c.description, d.code AS domain_code
           FROM competencies c JOIN competency_domains d ON d.id = c.domain_id
           WHERE c.is_active=true ORDER BY c.display_order`
        );
        for (const c of compItems.rows) {
          const key = `comp_item_${c.code.toLowerCase()}`;
          const parentKey = `comp_db_${c.domain_code.toLowerCase()}`;
          const id = await upsertNode(pool, null, 'Competency', key, c.name, { code: c.code, parent: c.domain_code, framework: 'Competency', source: 'db' });
          if (id) {
            nodeMap[key] = id; nc++;
            if (nodeMap[parentKey]) {
              const inserted = await upsertEdge(pool, null, nodeMap[parentKey], id, 'contains', 1.0);
              if (inserted) ec++;
            } else { skippedLinks++; }
          }
        }
      } catch { /* table may not exist yet */ }

      await pool.query(
        `INSERT INTO lde_seed_log (seed_type, last_run_at, run_count, last_result)
         VALUES ('domain_sync', NOW(), 1, $1)
         ON CONFLICT (seed_type) DO UPDATE SET last_run_at=NOW(), run_count=lde_seed_log.run_count+1, last_result=$1`,
        [JSON.stringify({ synced_nodes: nc, new_edges_this_run: ec, skipped_links_missing_parent: skippedLinks })]
      ).catch((e: any) => { console.warn('[lde-seed-log] Failed to record domain_sync seed timestamp:', e?.message); });
      res.json({
        synced_nodes: nc,
        new_edges_this_run: ec,
        skipped_links_missing_parent: skippedLinks,
        message: 'Graph synced from live domain tables'
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/lde/graph/link", async (req, res) => {
    try {
      const { tenant_id, source_key, target_key, relationship, weight = 1.0, temporal_lag_days = 0, confidence = 0.7 } = req.body;
      if (!source_key || !target_key || !relationship) return res.status(400).json({ error: "source_key, target_key, relationship required" });
      const [srcR, tgtR] = await Promise.all([
        pool.query(`SELECT id FROM lde_knowledge_graph_nodes WHERE node_key=$1`, [source_key]),
        pool.query(`SELECT id FROM lde_knowledge_graph_nodes WHERE node_key=$1`, [target_key])
      ]);
      if (!srcR.rows[0] || !tgtR.rows[0]) return res.status(404).json({ error: "One or both nodes not found" });
      const r = await pool.query(
        `INSERT INTO lde_knowledge_graph_edges (tenant_id, source_id, target_id, relationship, weight, temporal_lag_days, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET
           weight = GREATEST(EXCLUDED.weight, lde_knowledge_graph_edges.weight),
           confidence = GREATEST(EXCLUDED.confidence, lde_knowledge_graph_edges.confidence),
           temporal_lag_days = EXCLUDED.temporal_lag_days
         RETURNING *, (xmax = 0) AS inserted`,
        [tenant_id||null, srcR.rows[0].id, tgtR.rows[0].id, relationship, weight, temporal_lag_days, confidence]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/graph/traverse", async (req, res) => {
    try {
      const { from_key = 'beh_engagement', depth = 2, relationship } = req.query as any;
      const startR = await pool.query(`SELECT * FROM lde_knowledge_graph_nodes WHERE node_key=$1`, [from_key]);
      if (!startR.rows[0]) return res.status(404).json({ error: "Node not found" });
      const visited = new Set<string>([startR.rows[0].id]);
      const queue = [{ id: startR.rows[0].id, d: 0 }];
      const nodes: any[] = [startR.rows[0]];
      const edges: any[] = [];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr.d >= parseInt(depth)) continue;
        const relCondition = relationship ? `AND e.relationship=$2` : '';
        const params = relationship ? [curr.id, relationship] : [curr.id];
        const edgesR = await pool.query(
          `SELECT e.*, n.node_key, n.label, n.node_type FROM lde_knowledge_graph_edges e
           JOIN lde_knowledge_graph_nodes n ON n.id=e.target_id
           WHERE e.source_id=$1 ${relCondition} ORDER BY e.weight DESC`,
          params
        );
        for (const edge of edgesR.rows) {
          edges.push(edge);
          if (!visited.has(edge.target_id)) {
            visited.add(edge.target_id);
            queue.push({ id: edge.target_id, d: curr.d + 1 });
            const nR = await pool.query(`SELECT * FROM lde_knowledge_graph_nodes WHERE id=$1`, [edge.target_id]);
            if (nR.rows[0]) nodes.push(nR.rows[0]);
          }
        }
      }
      res.json({ from_key, depth: parseInt(depth), nodes, edges, traversed_nodes: nodes.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Concern-based graph traversal: maps any CAPADEX concern to a graph node ─
  app.get("/api/lde/graph/traverse/concern", async (req, res) => {
    try {
      const { concern, category, depth = 3 } = req.query as any;
      if (!concern && !category) return res.status(400).json({ error: "concern or category query param required" });

      // Map concern text / category to concern category node key
      const CATEGORY_MAP: Record<string, string> = {
        'focus': 'concern_focus', 'attention': 'concern_focus',
        'academics': 'concern_academics', 'academic': 'concern_academics', 'study': 'concern_academics',
        'emotional': 'concern_emotional', 'emotion': 'concern_emotional', 'feelings': 'concern_emotional',
        'social': 'concern_social', 'friends': 'concern_social', 'relationships': 'concern_social',
        'digital': 'concern_digital', 'screen': 'concern_digital', 'phone': 'concern_digital', 'internet': 'concern_digital',
        'mental health': 'concern_mental_health', 'mental': 'concern_mental_health', 'anxiety': 'concern_mental_health', 'depression': 'concern_mental_health',
        'behavior': 'concern_behavior', 'behaviour': 'concern_behavior', 'conduct': 'concern_behavior',
        'career': 'concern_career', 'job': 'concern_career', 'future': 'concern_career',
        'habits': 'concern_habits', 'routine': 'concern_habits',
        'learning': 'concern_learning',
        'cognitive': 'concern_cognitive', 'cognition': 'concern_cognitive', 'thinking': 'concern_cognitive',
        'family': 'concern_family',
        'parenting': 'concern_parenting',
        'health': 'concern_health', 'wellness': 'concern_health',
        'future skills': 'concern_future_skills', 'skills': 'concern_future_skills',
        'board exams': 'concern_board_exams', 'exams': 'concern_board_exams', 'exam': 'concern_board_exams',
        'betterment': 'concern_betterment', 'improvement': 'concern_betterment',
        'environment': 'concern_environment', 'stress': 'concern_environment'
      };

      const input = ((concern || category) as string).toLowerCase().trim();

      // 1. Exact key match
      let nodeKey: string | undefined = CATEGORY_MAP[input];

      // 2. Fuzzy keyword overlap — only accept when bestScore > 0 (at least one keyword matched)
      if (!nodeKey) {
        let bestMatch = ''; let bestScore = 0;
        for (const [kw, key] of Object.entries(CATEGORY_MAP)) {
          if (input.includes(kw) && kw.length > bestScore) { bestMatch = key; bestScore = kw.length; }
          else if (kw.includes(input) && input.length > bestScore) { bestMatch = key; bestScore = input.length; }
        }
        if (bestScore > 0) nodeKey = bestMatch;
      }

      // 3. DB label partial match (covers live-seeded concern nodes not in CATEGORY_MAP)
      let startNode: { rows: Record<string, unknown>[] };
      if (nodeKey) {
        startNode = await pool.query(`SELECT * FROM lde_knowledge_graph_nodes WHERE node_key=$1`, [nodeKey]);
      } else {
        startNode = { rows: [] };
      }
      if (!startNode.rows[0]) {
        startNode = await pool.query(
          `SELECT * FROM lde_knowledge_graph_nodes WHERE LOWER(label) LIKE $1 ORDER BY node_type LIMIT 1`,
          [`%${input}%`]
        );
      }

      // 4. No confident mapping — return 422 rather than silently resolving to an unrelated node
      if (!startNode.rows[0]) {
        return res.status(422).json({
          error: "No graph node could be confidently mapped to this concern",
          concern,
          category,
          hint: "Try a keyword such as: focus, anxiety, social, digital, career, habits, learning, exams, emotional"
        });
      }

      const startNodeRow = startNode.rows[0];
      const depthInt = Math.min(parseInt(depth) || 3, 5);

      // BFS traversal from concern node
      const visited = new Set<string>([startNodeRow.id]);
      const queue = [{ id: startNodeRow.id, d: 0 }];
      const nodes: any[] = [startNodeRow];
      const edgesList: any[] = [];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr.d >= depthInt) continue;
        const edgesR = await pool.query(
          `SELECT e.*, n.node_key, n.label, n.node_type, n.properties FROM lde_knowledge_graph_edges e
           JOIN lde_knowledge_graph_nodes n ON n.id=e.target_id
           WHERE e.source_id=$1 ORDER BY e.weight DESC LIMIT 20`,
          [curr.id]
        );
        for (const edge of edgesR.rows) {
          edgesList.push(edge);
          if (!visited.has(edge.target_id)) {
            visited.add(edge.target_id);
            queue.push({ id: edge.target_id, d: curr.d + 1 });
            const nR = await pool.query(`SELECT * FROM lde_knowledge_graph_nodes WHERE id=$1`, [edge.target_id]);
            if (nR.rows[0]) nodes.push(nR.rows[0]);
          }
        }
      }

      // Reverse-hop: find interventions that point TO any discovered LBI nodes.
      // Intervention edges are modeled as intervention→LBI ("improves"), so they are
      // never reached by outbound-only BFS. We query them directly.
      const lbiNodeIds = nodes.filter(n => n.node_type === 'LBI_Domain').map(n => n.id);
      let reverseInterventions: Record<string, unknown>[] = [];
      if (lbiNodeIds.length > 0) {
        const intR = await pool.query(
          `SELECT DISTINCT n.*, e.weight AS edge_weight, e.relationship AS edge_rel
           FROM lde_knowledge_graph_edges e
           JOIN lde_knowledge_graph_nodes n ON n.id = e.source_id
           WHERE e.target_id = ANY($1::uuid[])
             AND n.node_type = 'Intervention'
           ORDER BY e.weight DESC LIMIT 5`,
          [lbiNodeIds]
        );
        reverseInterventions = intR.rows;
        for (const iNode of reverseInterventions) {
          if (!nodes.find(x => x.id === iNode.id)) nodes.push(iNode);
        }
      }

      // Classify traversal results into a semantic reasoning summary
      const lbiNodes = nodes.filter(n => n.node_type === 'LBI_Domain');
      const interventionNodes = nodes.filter(n => n.node_type === 'Intervention');
      const outcomeNodes = nodes.filter(n => n.node_type === 'Outcome' || n.node_type === 'Trajectory');

      const reasoningPath = [
        { step: 1, label: 'Concern identified', node: startNodeRow.label, key: startNodeRow.node_key },
        ...lbiNodes.slice(0, 3).map((n, i) => ({ step: i + 2, label: 'Psychometric domain activated', node: n.label, key: n.node_key, properties: n.properties })),
        ...interventionNodes.slice(0, 2).map((n, i) => ({ step: lbiNodes.slice(0, 3).length + i + 2, label: 'Recommended intervention', node: n.label, key: n.node_key, properties: n.properties })),
        ...outcomeNodes.slice(0, 1).map((n, i) => ({ step: nodes.length - 1, label: 'Expected outcome pathway', node: n.label, key: n.node_key }))
      ];

      res.json({
        concern_input: concern || category,
        resolved_node_key: startNodeRow.node_key,
        resolved_label: startNodeRow.label,
        depth: depthInt,
        traversed_nodes: nodes.length,
        nodes,
        edges: edgesList,
        reasoning_path: reasoningPath,
        lbi_domains_activated: lbiNodes.map(n => ({ key: n.node_key, label: n.label })),
        recommended_interventions: interventionNodes.map(n => ({ key: n.node_key, label: n.label, properties: n.properties })),
        outcome_pathways: outcomeNodes.map(n => ({ key: n.node_key, label: n.label, type: n.node_type }))
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Full graph fetch: all nodes + edges for visual explorer ───────────────
  app.get("/api/lde/graph/nodes", async (req, res) => {
    try {
      const { node_type, relationship } = req.query as any;
      const nodeCondition = node_type ? `WHERE tenant_id IS NULL AND node_type = $1` : `WHERE tenant_id IS NULL`;
      const nodeParams = node_type ? [node_type] : [];
      const nodesR = await pool.query(
        `SELECT id, node_key, node_type, label, properties FROM lde_knowledge_graph_nodes ${nodeCondition} ORDER BY node_type, label`,
        nodeParams
      );
      const edgeCondition = relationship ? `WHERE e.relationship = $1` : ``;
      const edgeParams = relationship ? [relationship] : [];
      const edgesR = await pool.query(
        `SELECT e.id, e.source_id, e.target_id, e.relationship, e.weight, e.confidence, e.temporal_lag_days
         FROM lde_knowledge_graph_edges e
         JOIN lde_knowledge_graph_nodes s ON s.id = e.source_id AND s.tenant_id IS NULL
         JOIN lde_knowledge_graph_nodes t ON t.id = e.target_id AND t.tenant_id IS NULL
         ${edgeCondition}
         ORDER BY e.weight DESC`,
        edgeParams
      );
      const nodeIds = new Set(nodesR.rows.map((n: any) => n.id));
      const filteredEdges = edgesR.rows.filter((e: any) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));
      const nodeTypes = [...new Set(nodesR.rows.map((n: any) => n.node_type))].sort();
      const relTypes = [...new Set(edgesR.rows.map((e: any) => e.relationship))].sort();
      res.json({
        nodes: nodesR.rows,
        edges: filteredEdges,
        stats: { node_count: nodesR.rows.length, edge_count: filteredEdges.length, node_types: nodeTypes, relationship_types: relTypes }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 19: Semantic Causal Reasoning ─────────────────────────────────
  app.post("/api/lde/semantic/reason", async (req, res) => {
    try {
      const { user_id, tenant_id, inference_type = 'temporal' } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const chainTemplates: Record<string, any[]> = {
        temporal: [
          { step: 1, analysis: 'Temporal feature extraction', signal: 'behavioural_trajectory', confidence: rnd(0.6, 0.9) },
          { step: 2, analysis: 'Intervention dependency mapping', signal: 'causal_chain', confidence: rnd(0.65, 0.92) },
          { step: 3, analysis: 'Longitudinal inference computation', signal: 'developmental_projection', confidence: rnd(0.7, 0.95) }
        ],
        longitudinal: [
          { step: 1, analysis: 'Cross-session pattern recognition', signal: 'session_pattern', confidence: rnd(0.55, 0.85) },
          { step: 2, analysis: 'Developmental arc detection', signal: 'arc_classification', confidence: rnd(0.6, 0.9) },
          { step: 3, analysis: 'Long-range trajectory inference', signal: 'future_state', confidence: rnd(0.65, 0.92) }
        ]
      };
      const steps = chainTemplates[inference_type] || chainTemplates.temporal;
      const causalInputs = ['behavioural_evolution', 'intervention_history', 'emotional_trajectory', 'resilience_pattern'];
      const causalOutputs = ['developmental_forecast', 'risk_classification', 'opportunity_detection', 'intervention_recommendation'];
      const r = await pool.query(
        `INSERT INTO lde_semantic_chains (user_id, tenant_id, chain_name, reasoning_steps, causal_inputs, causal_outputs, inference_type, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id||null, `${inference_type}_chain_${Date.now()}`,
         JSON.stringify(steps), JSON.stringify(causalInputs), JSON.stringify(causalOutputs),
         inference_type, steps.reduce((a, s) => a + s.confidence, 0) / steps.length]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/semantic/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_semantic_chains WHERE user_id=$1 ORDER BY generated_at DESC LIMIT 10`,
        [req.params.userId]
      );
      res.json({ user_id: req.params.userId, chains: r.rows, count: r.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 20: Benchmarking ─────────────────────────────────────────────────
  app.post("/api/lde/benchmark/compute", async (req, res) => {
    try {
      const { user_id, tenant_id, benchmark_types = ['cohort','institution','age_band'] } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const results: any[] = [];
      for (const bt of benchmark_types) {
        const r = await pool.query(
          `INSERT INTO lde_benchmarks
            (user_id, tenant_id, benchmark_type, percentile_overall, percentile_behavioural,
             percentile_resilience, percentile_emotional, percentile_developmental, cohort_size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [user_id, tenant_id||null, bt,
           rnd(10, 95), rnd(10, 95), rnd(10, 95), rnd(10, 95), rnd(10, 95),
           Math.floor(rnd(50, 5000))]
        );
        results.push(r.rows[0]);
      }
      res.json({ computed: results.length, benchmarks: results });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/benchmark/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_benchmarks WHERE user_id=$1 ORDER BY computed_at DESC`,
        [req.params.userId]
      );
      res.json({ user_id: req.params.userId, benchmarks: r.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 21: Cohort Intelligence ────────────────────────────────────────
  app.post("/api/lde/cohort/update", async (req, res) => {
    try {
      const { tenant_id, cohort_id, cohort_name, cohort_type, member_count, avg_resilience_score, avg_engagement_score } = req.body;
      if (!cohort_id) return res.status(400).json({ error: "cohort_id required" });
      const sysDeterioration = (avg_resilience_score || 0.5) < 0.4 && (avg_engagement_score || 0.5) < 0.4;
      const trajDist = {
        accelerating: Math.floor(rnd(0.05, 0.25) * (member_count || 100)),
        stable: Math.floor(rnd(0.3, 0.5) * (member_count || 100)),
        stagnating: Math.floor(rnd(0.1, 0.25) * (member_count || 100)),
        declining: Math.floor(rnd(0.05, 0.2) * (member_count || 100))
      };
      const r = await pool.query(
        `INSERT INTO lde_cohort_profiles (tenant_id, cohort_id, cohort_name, cohort_type, member_count, avg_resilience_score, avg_engagement_score, systemic_deterioration_flag, trajectory_distribution)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (cohort_id) DO UPDATE SET
          cohort_name=EXCLUDED.cohort_name, member_count=EXCLUDED.member_count,
          avg_resilience_score=EXCLUDED.avg_resilience_score, avg_engagement_score=EXCLUDED.avg_engagement_score,
          systemic_deterioration_flag=EXCLUDED.systemic_deterioration_flag,
          trajectory_distribution=EXCLUDED.trajectory_distribution, updated_at=NOW()
         RETURNING *`,
        [tenant_id||null, cohort_id, cohort_name || cohort_id, cohort_type || 'school',
         member_count || 100, avg_resilience_score || rnd(0.4, 0.85), avg_engagement_score || rnd(0.4, 0.85),
         sysDeterioration, JSON.stringify(trajDist)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/cohorts", async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query as any;
      const off = (parseInt(page) - 1) * parseInt(limit);
      const [listR, kpiR] = await Promise.all([
        pool.query(`SELECT * FROM lde_cohort_profiles ORDER BY updated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), off]),
        pool.query(`SELECT COUNT(*) total, AVG(avg_resilience_score) avg_resilience, AVG(avg_engagement_score) avg_engagement,
                    SUM(CASE WHEN systemic_deterioration_flag THEN 1 ELSE 0 END) deteriorating FROM lde_cohort_profiles`)
      ]);
      res.json({ cohorts: listR.rows, kpi: kpiR.rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 22: Multi-Generational Intelligence ────────────────────────────
  app.post("/api/lde/multigenerational/record", async (req, res) => {
    try {
      const { tenant_id, generation_label, cohort_year, population_size, avg_capability_score, workforce_readiness_score, resilience_shift, digital_adaptation_score, trend_summary } = req.body;
      if (!generation_label) return res.status(400).json({ error: "generation_label required" });
      const r = await pool.query(
        `INSERT INTO lde_multigenerational (tenant_id, generation_label, cohort_year, population_size, avg_capability_score, workforce_readiness_score, resilience_shift, digital_adaptation_score, trend_summary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [tenant_id||null, generation_label, cohort_year || new Date().getFullYear(),
         population_size || Math.floor(rnd(1000, 100000)),
         avg_capability_score || rnd(0.4, 0.8), workforce_readiness_score || rnd(0.4, 0.85),
         resilience_shift || rnd(-0.2, 0.3), digital_adaptation_score || rnd(0.5, 0.95),
         JSON.stringify(trend_summary || { direction: 'improving', key_driver: 'digital_literacy' })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/multigenerational", async (req, res) => {
    try {
      const [listR, kpiR] = await Promise.all([
        pool.query(`SELECT * FROM lde_multigenerational ORDER BY cohort_year DESC, recorded_at DESC LIMIT 30`),
        pool.query(`SELECT generation_label, AVG(avg_capability_score) avg_capability, AVG(workforce_readiness_score) avg_workforce,
                    AVG(resilience_shift) avg_resilience_shift, COUNT(*) records FROM lde_multigenerational GROUP BY generation_label ORDER BY avg_capability DESC`)
      ]);
      res.json({ records: listR.rows, by_generation: kpiR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 23: Federated Learning (Simulated) ────────────────────────────
  app.post("/api/lde/federated/sync", async (req, res) => {
    try {
      const { tenant_id, node_name, institution_type, privacy_noise_level = 0.1 } = req.body;
      if (!node_name) return res.status(400).json({ error: "node_name required" });
      const noiseLevel = Math.min(0.5, Math.max(0.01, privacy_noise_level));
      const rawIntelligence = {
        avg_behavioural_score: rnd(0.4, 0.85),
        avg_resilience: rnd(0.4, 0.85),
        avg_cognitive: rnd(0.4, 0.85),
        cohort_size: Math.floor(rnd(50, 5000))
      };
      const noisyIntelligence = Object.keys(rawIntelligence).reduce((acc, k) => {
        const val = (rawIntelligence as any)[k];
        acc[k] = typeof val === 'number' && val < 5 ? Math.max(0, Math.min(1, val + (Math.random() - 0.5) * noiseLevel)) : val;
        return acc;
      }, {} as any);
      const r = await pool.query(
        `INSERT INTO lde_federated_nodes (tenant_id, node_name, institution_type, privacy_noise_level, aggregated_intelligence, sync_status, last_sync_at)
         VALUES ($1,$2,$3,$4,$5,'synced',NOW())
         ON CONFLICT (node_name) DO UPDATE SET
          privacy_noise_level=EXCLUDED.privacy_noise_level, aggregated_intelligence=EXCLUDED.aggregated_intelligence,
          sync_status='synced', last_sync_at=NOW()
         RETURNING *`,
        [tenant_id||null, node_name, institution_type || 'school', noiseLevel, JSON.stringify(noisyIntelligence)]
      );
      res.json({ node: r.rows[0], raw_intelligence: rawIntelligence, noised_intelligence: noisyIntelligence, privacy_noise_applied: noiseLevel });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/federated", async (req, res) => {
    try {
      const [listR, kpiR] = await Promise.all([
        pool.query(`SELECT * FROM lde_federated_nodes ORDER BY last_sync_at DESC`),
        pool.query(`SELECT sync_status, COUNT(*) cnt FROM lde_federated_nodes GROUP BY sync_status`)
      ]);
      res.json({ nodes: listR.rows, by_status: kpiR.rows, total: listR.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 24: Longitudinal Simulation ───────────────────────────────────
  app.post("/api/lde/simulation/run", async (req, res) => {
    try {
      const { tenant_id, simulation_name, simulation_type = 'developmental_trajectory', input_params = {}, population_size = 100 } = req.body;
      if (!simulation_name) return res.status(400).json({ error: "simulation_name required" });
      const r = await pool.query(
        `INSERT INTO lde_simulations (tenant_id, simulation_name, simulation_type, input_params, population_size, status)
         VALUES ($1,$2,$3,$4,$5,'running') RETURNING *`,
        [tenant_id||null, simulation_name, simulation_type, JSON.stringify(input_params), population_size]
      );
      const simId = r.rows[0].id;
      const outcomes = {
        breakthrough_count: Math.floor(population_size * rnd(0.05, 0.2)),
        stagnation_count: Math.floor(population_size * rnd(0.1, 0.3)),
        burnout_count: Math.floor(population_size * rnd(0.05, 0.2)),
        recovery_count: Math.floor(population_size * rnd(0.1, 0.25)),
        growth_count: Math.floor(population_size * rnd(0.2, 0.45))
      };
      const trajDist = { accelerating: rnd(0.1, 0.35), stable: rnd(0.3, 0.5), declining: rnd(0.05, 0.25), recovering: rnd(0.05, 0.2) };
      const updated = await pool.query(
        `UPDATE lde_simulations SET status='completed', completed_at=NOW(),
         scenario_outcomes=$1, trajectory_distribution=$2, robustness_score=$3, fairness_score=$4
         WHERE id=$5 RETURNING *`,
        [JSON.stringify(outcomes), JSON.stringify(trajDist), rnd(0.65, 0.95), rnd(0.7, 0.98), simId]
      );
      res.json(updated.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/simulations", async (req, res) => {
    try {
      const { status, type } = req.query as any;
      const conditions: string[] = [];
      if (status) conditions.push(`status='${status}'`);
      if (type) conditions.push(`simulation_type='${type}'`);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const [listR, kpiR] = await Promise.all([
        pool.query(`SELECT * FROM lde_simulations ${where} ORDER BY created_at DESC LIMIT 30`),
        pool.query(`SELECT simulation_type, COUNT(*) cnt, AVG(robustness_score) avg_robustness FROM lde_simulations GROUP BY simulation_type`)
      ]);
      res.json({ simulations: listR.rows, by_type: kpiR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 25: Meta-Longitudinal Health Check ─────────────────────────────
  app.post("/api/lde/meta/check", async (req, res) => {
    try {
      const { tenant_id, model_name = 'lde_core' } = req.body;
      const drift = rnd(0.05, 0.5);
      const instability = rnd(0.05, 0.45);
      const degradation = rnd(0.05, 0.4);
      const selfHeal = drift > 0.35 || instability > 0.35;
      const health = Math.max(0.3, 1 - (drift + instability + degradation) / 3);
      const correction = selfHeal ? { recalibration: true, method: 'temporal_drift_correction', magnitude: rnd(0.05, 0.2) } : {};
      const r = await pool.query(
        `INSERT INTO lde_meta_predictions (tenant_id, model_name, temporal_drift, trajectory_instability, calibration_degradation, self_healing_triggered, health_score, correction_applied)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tenant_id||null, model_name, drift, instability, degradation, selfHeal, health, JSON.stringify(correction)]
      );
      if (selfHeal) {
        await pool.query(
          `INSERT INTO lde_events (event_type, event_payload, source)
           VALUES ('DRIFT_DETECTED',$1,'meta_health_check')`,
          [JSON.stringify({ model_name, drift, self_healing: true })]
        );
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Personalised user path: concern → domains → interventions → outcomes ─────
  // Auth: caller must be authenticated (Passport session). Enforces that a regular
  // user can only fetch their own path; a super_admin may fetch any user's path.
  app.get("/api/lde/graph/user/:email/path", async (req: any, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const email = decodeURIComponent(req.params.email).toLowerCase().trim();
      const callerEmail = (req.user?.email || '').toLowerCase().trim();
      const callerRoles: string[] = req.user?.roles || [];
      const isSuperAdmin = callerRoles.includes('super_admin') || req.user?.role === 'super_admin';
      if (!isSuperAdmin && callerEmail !== email) {
        return res.status(403).json({ error: 'Access denied: you may only view your own graph path' });
      }

      // 1. Fetch all completed sessions for this user
      const { rows: sessions } = await pool.query(`
        SELECT id, stage_code, concern_name, score FROM capadex_sessions
        WHERE LOWER(guest_email) = $1 AND status = 'completed'
        ORDER BY created_at DESC
      `, [email]);

      if (sessions.length === 0) {
        return res.status(404).json({ error: 'No completed sessions found for this user' });
      }

      // 2. Pull subdomain scores from reports
      const sessionIds = sessions.map((s: any) => s.id);
      const { rows: reports } = await pool.query(`
        SELECT subdomains FROM capadex_reports
        WHERE session_id = ANY($1::uuid[]) AND subdomains IS NOT NULL
      `, [sessionIds]);

      const domainScores: Record<string, number> = {};
      for (const rep of reports) {
        const subs: any[] = Array.isArray(rep.subdomains) ? rep.subdomains : [];
        for (const sub of subs) {
          const name  = (sub.subdomain_name || sub.subdomain_code || '').trim();
          const score = parseFloat(sub.avg_score ?? '0');
          if (name && (!domainScores[name] || score > domainScores[name])) {
            domainScores[name] = score;
          }
        }
      }

      // 3. Build activated node list from graph
      const { rows: activations } = await pool.query(`
        SELECT node_key, node_label, node_type, activation_score, activation_type, activated_at
        FROM lde_user_graph_activations
        WHERE user_email = $1
        ORDER BY activated_at DESC
      `, [email]);

      // 4. Map subdomain scores → LBI keys for graph traversal
      const lbiKeyToScore: Record<string, number> = {};
      for (const [subName, score] of Object.entries(domainScores)) {
        const lbiKey = mapSubdomainToLBIKey(subName);
        if (lbiKey) {
          if (!lbiKeyToScore[lbiKey] || score > lbiKeyToScore[lbiKey]) {
            lbiKeyToScore[lbiKey] = score;
          }
        }
      }

      // 5. Traverse graph from concern node → LBI domains → interventions → outcomes
      const CONCERN_CAT_MAP: Record<string, string> = {
        digital: 'concern_digital', academic: 'concern_academics',
        emotional: 'concern_emotional', behavioural: 'concern_behavior',
        social: 'concern_social', career: 'concern_career', general: 'concern_betterment',
      };
      const primaryConcernName = sessions[0]?.concern_name || '';
      const concernCat = (() => {
        const l = primaryConcernName.toLowerCase();
        if (/screen|phone|gaming|social.?media|digital|internet/.test(l)) return 'digital';
        if (/study|exam|homework|academic|school|grade|learning/.test(l)) return 'academic';
        if (/anxiety|stress|emotion|mood|depress|worry|fear|loneli|mental/.test(l)) return 'emotional';
        if (/focus|attent|distract|concentrat|procrastinat|impulsiv/.test(l)) return 'behavioural';
        if (/social|peer|friend|relation|communicat|conflict|bully/.test(l)) return 'social';
        if (/career|job|employ|skill|workplace/.test(l)) return 'career';
        return 'general';
      })();
      const concernNodeKey = CONCERN_CAT_MAP[concernCat];

      const allLBIKeys = Object.keys(lbiKeyToScore);
      const pathNodes: any[] = [];
      const pathEdges: any[] = [];
      const visitedIds = new Set<string>();

      // Seed path with concern-category node (root of concern → domain traversal)
      let concernGraphNode: any = null;
      if (concernNodeKey) {
        const cnR = await pool.query(
          `SELECT * FROM lde_knowledge_graph_nodes WHERE node_key = $1 LIMIT 1`, [concernNodeKey]
        );
        if (cnR.rows[0]) {
          concernGraphNode = cnR.rows[0];
          visitedIds.add(concernGraphNode.id);
          pathNodes.push({ ...concernGraphNode, traversal_role: 'concern_root' });
        }
      }

      for (const lbiKey of allLBIKeys.slice(0, 8)) {
        const nodeR = await pool.query(
          `SELECT * FROM lde_knowledge_graph_nodes WHERE node_key = $1 LIMIT 1`, [lbiKey]
        );
        if (!nodeR.rows[0]) continue;
        const lbiNode = nodeR.rows[0];
        if (!visitedIds.has(lbiNode.id)) {
          visitedIds.add(lbiNode.id);
          pathNodes.push({ ...lbiNode, user_score: lbiKeyToScore[lbiKey] });
          // Add concern → LBI edge from the knowledge graph if it exists
          if (concernGraphNode) {
            const concernEdgeR = await pool.query(
              `SELECT e.id, e.relationship, e.weight FROM lde_knowledge_graph_edges e
               WHERE e.source_id = $1 AND e.target_id = $2 LIMIT 1`,
              [concernGraphNode.id, lbiNode.id]
            );
            if (concernEdgeR.rows[0]) {
              pathEdges.push({ ...concernEdgeR.rows[0], source_id: concernGraphNode.id, target_id: lbiNode.id });
            } else {
              // Synthesised edge: concern maps to this domain via user's scores
              pathEdges.push({ source_id: concernGraphNode.id, target_id: lbiNode.id, relationship: 'maps_to', weight: 1.0, synthesised: true });
            }
          }
        }

        // Outbound edges from LBI node (→ outcomes, trajectories)
        const outEdges = await pool.query(
          `SELECT e.*, n.node_key AS tgt_key, n.label AS tgt_label, n.node_type AS tgt_type, n.properties AS tgt_properties
           FROM lde_knowledge_graph_edges e
           JOIN lde_knowledge_graph_nodes n ON n.id = e.target_id
           WHERE e.source_id = $1
             AND n.node_type IN ('Outcome','Trajectory','Emotion','Behaviour')
           ORDER BY e.weight DESC LIMIT 3`,
          [lbiNode.id]
        );
        for (const edge of outEdges.rows) {
          pathEdges.push(edge);
          if (!visitedIds.has(edge.target_id)) {
            visitedIds.add(edge.target_id);
            pathNodes.push({ id: edge.target_id, node_key: edge.tgt_key, label: edge.tgt_label, node_type: edge.tgt_type, properties: edge.tgt_properties });
          }
        }

        // Reverse-hop: interventions that improve this LBI node
        const intEdges = await pool.query(
          `SELECT e.*, n.node_key AS src_key, n.label AS src_label, n.node_type AS src_type, n.properties AS src_properties
           FROM lde_knowledge_graph_edges e
           JOIN lde_knowledge_graph_nodes n ON n.id = e.source_id
           WHERE e.target_id = $1 AND n.node_type = 'Intervention'
           ORDER BY e.weight DESC LIMIT 2`,
          [lbiNode.id]
        );
        for (const edge of intEdges.rows) {
          if (!visitedIds.has(edge.source_id)) {
            visitedIds.add(edge.source_id);
            pathNodes.push({ id: edge.source_id, node_key: edge.src_key, label: edge.src_label, node_type: edge.src_type, properties: edge.src_properties });
          }
          pathEdges.push({ ...edge, source_id: edge.source_id, target_id: lbiNode.id });
        }
      }

      // 6. Classify nodes for the response summary
      const lbiNodes       = pathNodes.filter(n => n.node_type === 'LBI_Domain');
      const interventions  = pathNodes.filter(n => n.node_type === 'Intervention');
      const outcomes       = pathNodes.filter(n => n.node_type === 'Outcome' || n.node_type === 'Trajectory');
      const lowScoring     = lbiNodes.filter(n => (n.user_score ?? 100) < 50);
      const highScoring    = lbiNodes.filter(n => (n.user_score ?? 0) >= 65);

      // 7. Build reasoning path narrative
      const primarySession = sessions[0];
      const reasoningPath = [
        { step: 1, label: 'User identified',    detail: email },
        { step: 2, label: 'Sessions analysed',  detail: `${sessions.length} completed session(s)` },
        { step: 3, label: 'Domains activated',  detail: `${lbiNodes.length} LBI domain(s) mapped from subdomain scores` },
        ...lowScoring.slice(0, 2).map((n, i) => ({
          step: 4 + i,
          label: 'Low-scoring domain → interventions linked',
          detail: `${n.label} (score: ${Math.round(n.user_score ?? 0)}) → intervention pathways identified`,
          node_key: n.node_key,
          score: n.user_score
        })),
        ...highScoring.slice(0, 1).map((n, i) => ({
          step: 6 + i,
          label: 'High-scoring domain → positive outcome predicted',
          detail: `${n.label} (score: ${Math.round(n.user_score ?? 0)}) → growth pathway`,
          node_key: n.node_key,
          score: n.user_score
        }))
      ];

      res.json({
        user_email: email,
        sessions_count: sessions.length,
        primary_concern: primarySession?.concern_name,
        overall_score: parseFloat(primarySession?.score ?? '0'),
        domain_scores: domainScores,
        lbi_key_scores: lbiKeyToScore,
        graph_activations: activations,
        path_nodes: pathNodes,
        path_edges: pathEdges,
        reasoning_path: reasoningPath,
        summary: {
          lbi_domains_activated: lbiNodes.length,
          low_scoring_domains: lowScoring.map(n => ({ key: n.node_key, label: n.label, score: n.user_score })),
          high_scoring_domains: highScoring.map(n => ({ key: n.node_key, label: n.label, score: n.user_score })),
          recommended_interventions: interventions.slice(0, 5).map(n => ({ key: n.node_key, label: n.label, properties: n.properties })),
          outcome_pathways: outcomes.slice(0, 3).map(n => ({ key: n.node_key, label: n.label, type: n.node_type }))
        }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Intelligence Master Dashboard ───────────────────────────────────────────
  app.get("/api/admin/lde/intelligence/master", async (req, res) => {
    try {
      const [graphR, semR, benchR, cohortR, fedR, simR, metaR, seedLogR] = await Promise.all([
        pool.query(`SELECT (SELECT COUNT(*) FROM lde_knowledge_graph_nodes) node_count, (SELECT COUNT(*) FROM lde_knowledge_graph_edges) edge_count`),
        pool.query(`SELECT COUNT(*) total, AVG(confidence) avg_confidence FROM lde_semantic_chains`),
        pool.query(`SELECT COUNT(DISTINCT user_id) users_benchmarked, AVG(percentile_overall) avg_percentile FROM lde_benchmarks`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN systemic_deterioration_flag THEN 1 ELSE 0 END) deteriorating FROM lde_cohort_profiles`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN sync_status='synced' THEN 1 ELSE 0 END) synced FROM lde_federated_nodes`),
        pool.query(`SELECT COUNT(*) total, AVG(robustness_score) avg_robustness FROM lde_simulations`),
        pool.query(`SELECT AVG(health_score) avg_health, SUM(CASE WHEN self_healing_triggered THEN 1 ELSE 0 END) self_heals FROM lde_meta_predictions`),
        pool.query(`SELECT seed_type, last_run_at, run_count FROM lde_seed_log WHERE seed_type IN ('knowledge_graph','ontology','domain_sync')`).catch(() => ({ rows: [] }))
      ]);
      const seedMap: Record<string, any> = {};
      for (const row of seedLogR.rows) seedMap[row.seed_type] = row;
      res.json({
        knowledge_graph: graphR.rows[0],
        semantic_chains: semR.rows[0],
        benchmarks: benchR.rows[0],
        cohorts: cohortR.rows[0],
        federated_nodes: fedR.rows[0],
        simulations: simR.rows[0],
        meta_health: metaR.rows[0],
        seed_timestamps: {
          last_graph_seed_at: seedMap['knowledge_graph']?.last_run_at || null,
          last_ontology_seed_at: seedMap['ontology']?.last_run_at || null,
          last_domain_sync_at: seedMap['domain_sync']?.last_run_at || null,
          graph_run_count: seedMap['knowledge_graph']?.run_count || 0,
          ontology_run_count: seedMap['ontology']?.run_count || 0,
          domain_sync_run_count: seedMap['domain_sync']?.run_count || 0
        }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

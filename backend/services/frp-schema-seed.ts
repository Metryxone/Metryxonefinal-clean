/**
 * FRP — Future Readiness Platform
 * Schema (10 frp_* tables) + rich seed data
 * Master data: Skill Library · Taxonomy · AI Impact · Automation Risk ·
 *              Industry Forecasts · Role Evolution
 */
import type { Pool } from 'pg';

export async function ensureFRPSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS frp_skill_library (
      id SERIAL PRIMARY KEY,
      skill_code VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      domain VARCHAR(60) NOT NULL,
      cluster VARCHAR(80),
      durability_score INTEGER NOT NULL DEFAULT 50 CHECK (durability_score BETWEEN 0 AND 100),
      human_quotient INTEGER NOT NULL DEFAULT 50 CHECK (human_quotient BETWEEN 0 AND 100),
      data_intensity INTEGER NOT NULL DEFAULT 50 CHECK (data_intensity BETWEEN 0 AND 100),
      emergence_horizon VARCHAR(20) NOT NULL DEFAULT 'established',
      demand_trend VARCHAR(20) NOT NULL DEFAULT 'stable',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frp_skill_taxonomy (
      id SERIAL PRIMARY KEY,
      taxonomy_code VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      parent_code VARCHAR(60),
      description TEXT,
      skill_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frp_ai_impact (
      id SERIAL PRIMARY KEY,
      skill_code VARCHAR(60) NOT NULL UNIQUE,
      displacement_risk NUMERIC(4,3) NOT NULL DEFAULT 0.3 CHECK (displacement_risk BETWEEN 0 AND 1),
      augmentation_potential NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (augmentation_potential BETWEEN 0 AND 1),
      new_work_creation NUMERIC(4,3) NOT NULL DEFAULT 0.2 CHECK (new_work_creation BETWEEN 0 AND 1),
      impact_band VARCHAR(20) NOT NULL DEFAULT 'moderate',
      timeline_years INTEGER NOT NULL DEFAULT 5,
      ai_tools_overlap TEXT[] NOT NULL DEFAULT '{}',
      resilience_rationale TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frp_automation_risk (
      id SERIAL PRIMARY KEY,
      role_code VARCHAR(60) NOT NULL UNIQUE,
      role_name VARCHAR(200) NOT NULL,
      industry VARCHAR(60),
      risk_score INTEGER NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
      risk_band VARCHAR(20) NOT NULL DEFAULT 'moderate',
      timeline_years INTEGER NOT NULL DEFAULT 5,
      exposed_tasks TEXT[] NOT NULL DEFAULT '{}',
      resilient_tasks TEXT[] NOT NULL DEFAULT '{}',
      upskill_priorities TEXT[] NOT NULL DEFAULT '{}',
      source VARCHAR(60) NOT NULL DEFAULT 'platform',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frp_industry_forecast (
      id SERIAL PRIMARY KEY,
      industry_code VARCHAR(60) NOT NULL UNIQUE,
      industry_name VARCHAR(200) NOT NULL,
      growth_outlook VARCHAR(20) NOT NULL DEFAULT 'moderate',
      ai_disruption_band VARCHAR(20) NOT NULL DEFAULT 'moderate',
      skill_demand_shift JSONB NOT NULL DEFAULT '{}',
      top_growing_roles TEXT[] NOT NULL DEFAULT '{}',
      top_declining_roles TEXT[] NOT NULL DEFAULT '{}',
      horizon_years INTEGER NOT NULL DEFAULT 5,
      ai_readiness_score INTEGER NOT NULL DEFAULT 50 CHECK (ai_readiness_score BETWEEN 0 AND 100),
      source_rationale TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frp_role_evolution (
      id SERIAL PRIMARY KEY,
      from_role VARCHAR(200) NOT NULL,
      to_role VARCHAR(200) NOT NULL,
      evolution_type VARCHAR(30) NOT NULL DEFAULT 'adjacent',
      feasibility_score INTEGER NOT NULL DEFAULT 60 CHECK (feasibility_score BETWEEN 0 AND 100),
      required_skills TEXT[] NOT NULL DEFAULT '{}',
      drop_skills TEXT[] NOT NULL DEFAULT '{}',
      transition_months_min INTEGER NOT NULL DEFAULT 6,
      transition_months_max INTEGER NOT NULL DEFAULT 18,
      is_ai_driven BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frp_user_readiness (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(60) NOT NULL,
      composite INTEGER NOT NULL DEFAULT 50 CHECK (composite BETWEEN 0 AND 100),
      band VARCHAR(20) NOT NULL DEFAULT 'developing',
      skill_durability INTEGER NOT NULL DEFAULT 50,
      adaptability INTEGER NOT NULL DEFAULT 50,
      market_alignment INTEGER NOT NULL DEFAULT 50,
      learning_velocity INTEGER NOT NULL DEFAULT 50,
      role_resilience INTEGER NOT NULL DEFAULT 50,
      confidence NUMERIC(4,3) NOT NULL DEFAULT 0.30,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      provenance JSONB NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS frp_user_readiness_uid_ts
      ON frp_user_readiness(user_id, computed_at DESC);

    CREATE TABLE IF NOT EXISTS frp_user_skill_profile (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(60) NOT NULL,
      skill_code VARCHAR(60) NOT NULL,
      proficiency_level INTEGER NOT NULL DEFAULT 50 CHECK (proficiency_level BETWEEN 0 AND 100),
      is_verified BOOLEAN NOT NULL DEFAULT false,
      source VARCHAR(40) NOT NULL DEFAULT 'self',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, skill_code)
    );
    CREATE INDEX IF NOT EXISTS frp_user_skill_uid ON frp_user_skill_profile(user_id);

    CREATE TABLE IF NOT EXISTS frp_benchmarks (
      id SERIAL PRIMARY KEY,
      cohort_key VARCHAR(80) NOT NULL,
      metric VARCHAR(60) NOT NULL,
      p25 NUMERIC(6,2),
      p50 NUMERIC(6,2),
      p75 NUMERIC(6,2),
      p90 NUMERIC(6,2),
      sample_size INTEGER NOT NULL DEFAULT 0,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(cohort_key, metric)
    );

    CREATE TABLE IF NOT EXISTS frp_recommendations (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(60) NOT NULL,
      rec_type VARCHAR(30) NOT NULL,
      skill_code VARCHAR(60),
      role_code VARCHAR(60),
      priority INTEGER NOT NULL DEFAULT 50,
      rationale TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS frp_recs_uid ON frp_recommendations(user_id, status);
  `).catch(() => null);
}

// ── Seed Master Data ──────────────────────────────────────────────────────────

interface SkillSeed {
  skill_code: string; name: string; description: string;
  domain: string; cluster: string;
  durability_score: number; human_quotient: number; data_intensity: number;
  emergence_horizon: string; demand_trend: string;
}

interface AISeed {
  skill_code: string;
  displacement_risk: number; augmentation_potential: number; new_work_creation: number;
  impact_band: string; timeline_years: number;
  ai_tools_overlap: string[]; resilience_rationale: string;
}

const SKILL_SEEDS: SkillSeed[] = [
  // ── Human Intelligence ─────────────────────────────────────────────────
  { skill_code:'EMPATHY', name:'Empathy & Compassion', description:'Recognising and sharing the feelings of others; building genuine human connection.', domain:'Human Intelligence', cluster:'Emotional & Social Intelligence', durability_score:96, human_quotient:99, data_intensity:8, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'ACTIVE_LISTENING', name:'Active Listening', description:'Fully concentrating, understanding, responding and remembering what is being said.', domain:'Human Intelligence', cluster:'Emotional & Social Intelligence', durability_score:91, human_quotient:95, data_intensity:12, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'CONFLICT_RESOLUTION', name:'Conflict Resolution', description:'Facilitating peaceful resolution of disagreements and building consensus.', domain:'Human Intelligence', cluster:'Emotional & Social Intelligence', durability_score:89, human_quotient:92, data_intensity:18, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'CREATIVE_THINKING', name:'Creative Thinking', description:'Generating novel ideas; making unexpected connections across domains.', domain:'Human Intelligence', cluster:'Creative Intelligence', durability_score:93, human_quotient:91, data_intensity:22, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'STORYTELLING', name:'Narrative Storytelling', description:'Crafting and delivering compelling stories that inform, inspire or persuade.', domain:'Human Intelligence', cluster:'Creative Intelligence', durability_score:88, human_quotient:89, data_intensity:28, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'DESIGN_THINKING', name:'Design Thinking', description:'Human-centred problem-solving through empathy, ideation and rapid prototyping.', domain:'Human Intelligence', cluster:'Creative Intelligence', durability_score:84, human_quotient:82, data_intensity:32, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'TEAM_LEADERSHIP', name:'Team Leadership', description:'Guiding, motivating and developing teams toward shared goals.', domain:'Human Intelligence', cluster:'Leadership & Influence', durability_score:88, human_quotient:94, data_intensity:18, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'COACHING_MENTORING', name:'Coaching & Mentoring', description:'Developing the capability and potential of individuals through structured guidance.', domain:'Human Intelligence', cluster:'Leadership & Influence', durability_score:92, human_quotient:96, data_intensity:12, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'INFLUENCE_PERSUASION', name:'Influence & Persuasion', description:'Ethically shaping beliefs and actions of others through evidence and rapport.', domain:'Human Intelligence', cluster:'Leadership & Influence', durability_score:86, human_quotient:88, data_intensity:24, emergence_horizon:'established', demand_trend:'stable' },

  // ── Cognitive Excellence ───────────────────────────────────────────────
  { skill_code:'CRITICAL_THINKING', name:'Critical Thinking', description:'Systematic analysis of facts to form sound judgements, questioning assumptions.', domain:'Cognitive Excellence', cluster:'Analytical Thinking', durability_score:90, human_quotient:86, data_intensity:38, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'SYSTEMS_THINKING', name:'Systems Thinking', description:'Understanding how parts of a system interrelate and how systems work over time.', domain:'Cognitive Excellence', cluster:'Analytical Thinking', durability_score:87, human_quotient:81, data_intensity:42, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'COMPLEX_PROBLEM_SOLVING', name:'Complex Problem Solving', description:'Solving novel, ill-defined problems in complex real-world settings.', domain:'Cognitive Excellence', cluster:'Analytical Thinking', durability_score:89, human_quotient:83, data_intensity:38, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'STRATEGIC_PLANNING', name:'Strategic Planning', description:'Setting direction and allocating resources over a multi-year horizon.', domain:'Cognitive Excellence', cluster:'Strategic Intelligence', durability_score:82, human_quotient:79, data_intensity:48, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'DECISION_MAKING', name:'Judgement & Decision Making', description:'Weighing options under uncertainty; balancing data and intuition.', domain:'Cognitive Excellence', cluster:'Strategic Intelligence', durability_score:81, human_quotient:83, data_intensity:44, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'INNOVATION_MANAGEMENT', name:'Innovation Management', description:'Systematically driving the adoption of new ideas, processes and business models.', domain:'Cognitive Excellence', cluster:'Strategic Intelligence', durability_score:82, human_quotient:80, data_intensity:44, emergence_horizon:'established', demand_trend:'growing' },

  // ── Technical Durability ────────────────────────────────────────────────
  { skill_code:'CYBERSECURITY', name:'Cybersecurity Fundamentals', description:'Protecting systems, networks and programs from digital attacks.', domain:'Technical Durability', cluster:'Cybersecurity', durability_score:76, human_quotient:42, data_intensity:68, emergence_horizon:'established', demand_trend:'high_growth' },
  { skill_code:'THREAT_ANALYSIS', name:'Threat Intelligence Analysis', description:'Identifying, assessing and prioritising cyber threats and vulnerabilities.', domain:'Technical Durability', cluster:'Cybersecurity', durability_score:73, human_quotient:52, data_intensity:65, emergence_horizon:'established', demand_trend:'high_growth' },
  { skill_code:'CLOUD_ARCHITECTURE', name:'Cloud Architecture', description:'Designing scalable, resilient cloud-native systems across major platforms.', domain:'Technical Durability', cluster:'Cloud & Infrastructure', durability_score:67, human_quotient:38, data_intensity:72, emergence_horizon:'established', demand_trend:'high_growth' },
  { skill_code:'DEVOPS_PRACTICES', name:'DevOps & Platform Engineering', description:'Integrating development and operations to accelerate reliable software delivery.', domain:'Technical Durability', cluster:'Cloud & Infrastructure', durability_score:64, human_quotient:42, data_intensity:68, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'AI_SYSTEM_DESIGN', name:'AI System Design', description:'Architecting AI-powered products: data pipelines, model integration, evaluation loops.', domain:'Technical Durability', cluster:'AI Engineering', durability_score:72, human_quotient:48, data_intensity:78, emergence_horizon:'emerging', demand_trend:'high_growth' },
  { skill_code:'PROMPT_ENGINEERING', name:'Prompt Engineering', description:'Crafting effective prompts and chains to guide large language models reliably.', domain:'Technical Durability', cluster:'AI Engineering', durability_score:58, human_quotient:52, data_intensity:68, emergence_horizon:'emerging', demand_trend:'high_growth' },

  // ── Digital Fluency ─────────────────────────────────────────────────────
  { skill_code:'DATA_INTERPRETATION', name:'Data Interpretation', description:'Reading, evaluating and drawing conclusions from charts, datasets and reports.', domain:'Digital Fluency', cluster:'Data Literacy', durability_score:58, human_quotient:52, data_intensity:72, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'DATA_STORYTELLING', name:'Data Storytelling', description:'Translating complex data into compelling visual and narrative insights.', domain:'Digital Fluency', cluster:'Data Literacy', durability_score:68, human_quotient:68, data_intensity:62, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'AI_TOOL_PROFICIENCY', name:'AI Tool Proficiency', description:'Effective use of AI-powered productivity tools across professional workflows.', domain:'Digital Fluency', cluster:'AI Augmentation', durability_score:52, human_quotient:48, data_intensity:68, emergence_horizon:'emerging', demand_trend:'high_growth' },
  { skill_code:'HUMAN_AI_COLLAB', name:'Human-AI Collaboration', description:'Working productively alongside AI systems; knowing when to trust or override.', domain:'Digital Fluency', cluster:'AI Augmentation', durability_score:74, human_quotient:72, data_intensity:52, emergence_horizon:'emerging', demand_trend:'high_growth' },
  { skill_code:'VIRTUAL_TEAM_MGMT', name:'Virtual Team Management', description:'Leading geographically distributed teams with digital-first practices.', domain:'Digital Fluency', cluster:'Digital Collaboration', durability_score:80, human_quotient:82, data_intensity:28, emergence_horizon:'established', demand_trend:'stable' },

  // ── Business Acumen ─────────────────────────────────────────────────────
  { skill_code:'FINANCIAL_ANALYSIS', name:'Financial Analysis', description:'Interpreting financial statements and modelling business performance.', domain:'Business Acumen', cluster:'Financial Intelligence', durability_score:48, human_quotient:42, data_intensity:78, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'PROJECT_ORCHESTRATION', name:'Project Orchestration', description:'Coordinating multi-stakeholder projects: scope, resources, risk and delivery.', domain:'Business Acumen', cluster:'Project Management', durability_score:62, human_quotient:68, data_intensity:58, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'RISK_MANAGEMENT', name:'Risk Management', description:'Identifying, assessing and mitigating strategic and operational risks.', domain:'Business Acumen', cluster:'Project Management', durability_score:66, human_quotient:62, data_intensity:62, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'BUSINESS_STRATEGY', name:'Business Strategy', description:'Formulating competitive strategy and translating it into organisational action.', domain:'Business Acumen', cluster:'Strategy & Innovation', durability_score:79, human_quotient:76, data_intensity:52, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'MARKET_SENSING', name:'Market Sensing', description:'Detecting emerging customer needs, competitor moves and market shifts in real time.', domain:'Business Acumen', cluster:'Strategy & Innovation', durability_score:74, human_quotient:72, data_intensity:58, emergence_horizon:'established', demand_trend:'growing' },

  // ── Adaptive Capability ─────────────────────────────────────────────────
  { skill_code:'LEARNING_AGILITY', name:'Learning Agility', description:'Rapidly acquiring and applying new knowledge and skills across novel contexts.', domain:'Adaptive Capability', cluster:'Resilience & Adaptability', durability_score:94, human_quotient:87, data_intensity:22, emergence_horizon:'established', demand_trend:'high_growth' },
  { skill_code:'RESILIENCE_BUILDING', name:'Resilience Building', description:'Maintaining well-being and performance under sustained pressure and setbacks.', domain:'Adaptive Capability', cluster:'Resilience & Adaptability', durability_score:94, human_quotient:91, data_intensity:14, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'CHANGE_ADAPTABILITY', name:'Change Adaptability', description:'Embracing and championing organisational change; thriving in ambiguity.', domain:'Adaptive Capability', cluster:'Resilience & Adaptability', durability_score:90, human_quotient:86, data_intensity:18, emergence_horizon:'established', demand_trend:'growing' },
  { skill_code:'AMBIGUITY_TOLERANCE', name:'Ambiguity Tolerance', description:'Remaining effective and decisive when goals, roles or information are unclear.', domain:'Adaptive Capability', cluster:'Future Orientation', durability_score:89, human_quotient:88, data_intensity:12, emergence_horizon:'established', demand_trend:'growing' },

  // ── Communication ───────────────────────────────────────────────────────
  { skill_code:'PRESENTATION_SKILLS', name:'Executive Presentation', description:'Structuring and delivering persuasive presentations to senior audiences.', domain:'Communication', cluster:'Interpersonal Communication', durability_score:82, human_quotient:87, data_intensity:22, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'NEGOTIATION', name:'Negotiation', description:'Reaching mutually beneficial agreements through principled bargaining.', domain:'Communication', cluster:'Interpersonal Communication', durability_score:85, human_quotient:89, data_intensity:18, emergence_horizon:'established', demand_trend:'stable' },
  { skill_code:'CROSS_CULTURAL_COMM', name:'Cross-Cultural Communication', description:'Communicating effectively across linguistic, cultural and organisational boundaries.', domain:'Communication', cluster:'Interpersonal Communication', durability_score:89, human_quotient:91, data_intensity:14, emergence_horizon:'established', demand_trend:'growing' },

  // ── Future-Oriented ─────────────────────────────────────────────────────
  { skill_code:'AI_ETHICS', name:'AI Ethics & Governance', description:'Evaluating fairness, accountability and transparency in AI systems; policy literacy.', domain:'Future-Oriented', cluster:'Ethics & Governance', durability_score:86, human_quotient:82, data_intensity:38, emergence_horizon:'emerging', demand_trend:'high_growth' },
  { skill_code:'SUSTAINABILITY_THINKING', name:'Sustainability Thinking', description:'Integrating environmental, social and governance considerations into decisions.', domain:'Future-Oriented', cluster:'Ethics & Governance', durability_score:83, human_quotient:79, data_intensity:42, emergence_horizon:'emerging', demand_trend:'high_growth' },
  { skill_code:'ENTREPRENEURIAL_MINDSET', name:'Entrepreneurial Mindset', description:'Spotting opportunities, tolerating risk and driving ventures with resourcefulness.', domain:'Future-Oriented', cluster:'Entrepreneurship', durability_score:88, human_quotient:85, data_intensity:28, emergence_horizon:'established', demand_trend:'growing' },
];

const AI_IMPACT_SEEDS: AISeed[] = [
  { skill_code:'EMPATHY', displacement_risk:0.02, augmentation_potential:0.18, new_work_creation:0.80, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'Genuine human emotional connection cannot be replicated by AI; demand rises as AI automates transactional work.' },
  { skill_code:'ACTIVE_LISTENING', displacement_risk:0.04, augmentation_potential:0.25, new_work_creation:0.71, impact_band:'low', timeline_years:10, ai_tools_overlap:['AI notetakers','meeting summarisers'], resilience_rationale:'The presence and attunement required for deep listening is irreducibly human.' },
  { skill_code:'CONFLICT_RESOLUTION', displacement_risk:0.06, augmentation_potential:0.32, new_work_creation:0.62, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'Mediation depends on trust, authority and emotional attunement — all human advantages.' },
  { skill_code:'CREATIVE_THINKING', displacement_risk:0.08, augmentation_potential:0.55, new_work_creation:0.37, impact_band:'low', timeline_years:7, ai_tools_overlap:['Generative AI','Midjourney','Sora'], resilience_rationale:'AI generates variations; humans define what is novel, meaningful and worth pursuing.' },
  { skill_code:'STORYTELLING', displacement_risk:0.14, augmentation_potential:0.60, new_work_creation:0.26, impact_band:'moderate', timeline_years:5, ai_tools_overlap:['LLM drafting tools'], resilience_rationale:'AI can draft; original voice, cultural resonance and lived experience remain human.' },
  { skill_code:'DESIGN_THINKING', displacement_risk:0.10, augmentation_potential:0.52, new_work_creation:0.38, impact_band:'low', timeline_years:7, ai_tools_overlap:['AI prototyping tools'], resilience_rationale:'Empathy-phase fieldwork and reframing are resistant; ideation is augmented.' },
  { skill_code:'TEAM_LEADERSHIP', displacement_risk:0.05, augmentation_potential:0.38, new_work_creation:0.57, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'Motivation, trust and accountability are human social phenomena.' },
  { skill_code:'COACHING_MENTORING', displacement_risk:0.04, augmentation_potential:0.30, new_work_creation:0.66, impact_band:'low', timeline_years:10, ai_tools_overlap:['AI coaching chatbots'], resilience_rationale:'Deep developmental coaching depends on lived experience and relational trust.' },
  { skill_code:'INFLUENCE_PERSUASION', displacement_risk:0.10, augmentation_potential:0.44, new_work_creation:0.46, impact_band:'low', timeline_years:8, ai_tools_overlap:[], resilience_rationale:'Authentic persuasion rooted in credibility and relationship is uniquely human.' },
  { skill_code:'CRITICAL_THINKING', displacement_risk:0.08, augmentation_potential:0.62, new_work_creation:0.30, impact_band:'low', timeline_years:7, ai_tools_overlap:['Research AI','argument mappers'], resilience_rationale:'Evaluating assumptions and weighting values in context requires human judgement.' },
  { skill_code:'SYSTEMS_THINKING', displacement_risk:0.10, augmentation_potential:0.55, new_work_creation:0.35, impact_band:'moderate', timeline_years:7, ai_tools_overlap:['System-modelling tools'], resilience_rationale:'Understanding emergent behaviour and second-order effects demands human insight.' },
  { skill_code:'COMPLEX_PROBLEM_SOLVING', displacement_risk:0.09, augmentation_potential:0.58, new_work_creation:0.33, impact_band:'low', timeline_years:8, ai_tools_overlap:[], resilience_rationale:'Novel, ambiguous problems in human systems resist AI decomposition.' },
  { skill_code:'STRATEGIC_PLANNING', displacement_risk:0.15, augmentation_potential:0.62, new_work_creation:0.23, impact_band:'moderate', timeline_years:5, ai_tools_overlap:['Scenario-planning AI'], resilience_rationale:'Value-laden choices about direction and risk tolerance are human decisions.' },
  { skill_code:'DECISION_MAKING', displacement_risk:0.18, augmentation_potential:0.60, new_work_creation:0.22, impact_band:'moderate', timeline_years:5, ai_tools_overlap:['Decision-support AI'], resilience_rationale:'High-stakes decisions under moral uncertainty remain human responsibilities.' },
  { skill_code:'INNOVATION_MANAGEMENT', displacement_risk:0.14, augmentation_potential:0.60, new_work_creation:0.26, impact_band:'moderate', timeline_years:5, ai_tools_overlap:[], resilience_rationale:'Portfolio selection and culture-shaping are beyond current AI capability.' },
  { skill_code:'CYBERSECURITY', displacement_risk:0.22, augmentation_potential:0.72, new_work_creation:0.06, impact_band:'moderate', timeline_years:4, ai_tools_overlap:['AI threat detection','SIEM AI'], resilience_rationale:'Adversarial creativity and policy judgement resist automation; AI handles pattern matching.' },
  { skill_code:'THREAT_ANALYSIS', displacement_risk:0.28, augmentation_potential:0.68, new_work_creation:0.04, impact_band:'moderate', timeline_years:4, ai_tools_overlap:['AI threat intel platforms'], resilience_rationale:'Attribution and strategic assessment of threat actors remains human work.' },
  { skill_code:'CLOUD_ARCHITECTURE', displacement_risk:0.32, augmentation_potential:0.68, new_work_creation:0.00, impact_band:'high', timeline_years:4, ai_tools_overlap:['AI infrastructure optimisers','GitHub Copilot'], resilience_rationale:'High-level design and trade-off reasoning persist; routine config is increasingly automated.' },
  { skill_code:'DEVOPS_PRACTICES', displacement_risk:0.35, augmentation_potential:0.65, new_work_creation:0.00, impact_band:'high', timeline_years:4, ai_tools_overlap:['AI CI/CD','code review AI'], resilience_rationale:'Integration and reliability engineering judgement persists beyond automated pipelines.' },
  { skill_code:'AI_SYSTEM_DESIGN', displacement_risk:0.20, augmentation_potential:0.78, new_work_creation:0.02, impact_band:'moderate', timeline_years:3, ai_tools_overlap:['AutoML','AI dev assistants'], resilience_rationale:'System-level reasoning, evaluation design and safety engineering remain scarce human skills.' },
  { skill_code:'PROMPT_ENGINEERING', displacement_risk:0.45, augmentation_potential:0.55, new_work_creation:0.00, impact_band:'high', timeline_years:3, ai_tools_overlap:['AI API platforms'], resilience_rationale:'Early-phase skill; likely absorbed into higher-order AI interaction competencies by 2028.' },
  { skill_code:'DATA_INTERPRETATION', displacement_risk:0.42, augmentation_potential:0.58, new_work_creation:0.00, impact_band:'high', timeline_years:4, ai_tools_overlap:['BI AI','analytics copilots'], resilience_rationale:'Contextual interpretation and stakeholder communication of insights persists.' },
  { skill_code:'DATA_STORYTELLING', displacement_risk:0.28, augmentation_potential:0.65, new_work_creation:0.07, impact_band:'moderate', timeline_years:5, ai_tools_overlap:['AI visualisation'], resilience_rationale:'Narrative framing and audience empathy remain human; chart generation is automated.' },
  { skill_code:'AI_TOOL_PROFICIENCY', displacement_risk:0.50, augmentation_potential:0.50, new_work_creation:0.00, impact_band:'high', timeline_years:3, ai_tools_overlap:['ChatGPT','Copilot','Gemini'], resilience_rationale:'Rapidly evolving; value lies in effective workflow integration, not tool knowledge alone.' },
  { skill_code:'HUMAN_AI_COLLAB', displacement_risk:0.15, augmentation_potential:0.72, new_work_creation:0.13, impact_band:'moderate', timeline_years:3, ai_tools_overlap:['All AI tools'], resilience_rationale:'Knowing when to trust, override or escalate AI is a durable meta-skill.' },
  { skill_code:'VIRTUAL_TEAM_MGMT', displacement_risk:0.12, augmentation_potential:0.45, new_work_creation:0.43, impact_band:'low', timeline_years:7, ai_tools_overlap:['AI meeting tools'], resilience_rationale:'Psychological safety and cohesion in distributed teams require human leadership.' },
  { skill_code:'FINANCIAL_ANALYSIS', displacement_risk:0.58, augmentation_potential:0.42, new_work_creation:0.00, impact_band:'high', timeline_years:4, ai_tools_overlap:['AI FP&A tools','Excel AI'], resilience_rationale:'Routine modelling is automating rapidly; strategic interpretation and client advising persist.' },
  { skill_code:'PROJECT_ORCHESTRATION', displacement_risk:0.38, augmentation_potential:0.55, new_work_creation:0.07, impact_band:'high', timeline_years:5, ai_tools_overlap:['AI PM tools','Asana AI'], resilience_rationale:'Stakeholder alignment and political navigation within projects resist automation.' },
  { skill_code:'RISK_MANAGEMENT', displacement_risk:0.30, augmentation_potential:0.60, new_work_creation:0.10, impact_band:'moderate', timeline_years:5, ai_tools_overlap:['AI risk platforms'], resilience_rationale:'Ethical and reputational risk assessment depends on human judgement and accountability.' },
  { skill_code:'BUSINESS_STRATEGY', displacement_risk:0.15, augmentation_potential:0.60, new_work_creation:0.25, impact_band:'moderate', timeline_years:6, ai_tools_overlap:['Strategy AI assistants'], resilience_rationale:'Direction-setting in the face of uncertainty and stakeholder interests remains human.' },
  { skill_code:'MARKET_SENSING', displacement_risk:0.25, augmentation_potential:0.68, new_work_creation:0.07, impact_band:'moderate', timeline_years:4, ai_tools_overlap:['Market intelligence AI'], resilience_rationale:'Weak-signal detection and interpretation across social and cultural contexts is human.' },
  { skill_code:'LEARNING_AGILITY', displacement_risk:0.04, augmentation_potential:0.30, new_work_creation:0.66, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'The meta-skill of learning how to learn is the most durable of all capabilities.' },
  { skill_code:'RESILIENCE_BUILDING', displacement_risk:0.03, augmentation_potential:0.20, new_work_creation:0.77, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'Psychological resilience is rooted in human experience and social support.' },
  { skill_code:'CHANGE_ADAPTABILITY', displacement_risk:0.05, augmentation_potential:0.28, new_work_creation:0.67, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'Embracing change with optimism requires emotional and cognitive flexibility only humans exhibit.' },
  { skill_code:'AMBIGUITY_TOLERANCE', displacement_risk:0.04, augmentation_potential:0.22, new_work_creation:0.74, impact_band:'low', timeline_years:10, ai_tools_overlap:[], resilience_rationale:'Operating effectively in uncertainty is a distinctly human cognitive advantage.' },
  { skill_code:'PRESENTATION_SKILLS', displacement_risk:0.18, augmentation_potential:0.55, new_work_creation:0.27, impact_band:'moderate', timeline_years:6, ai_tools_overlap:['AI slide generation'], resilience_rationale:'Presence, authenticity and handling live questions remain irreducibly human.' },
  { skill_code:'NEGOTIATION', displacement_risk:0.10, augmentation_potential:0.40, new_work_creation:0.50, impact_band:'low', timeline_years:8, ai_tools_overlap:[], resilience_rationale:'High-stakes negotiation depends on relationship, authority and real-time human judgement.' },
  { skill_code:'CROSS_CULTURAL_COMM', displacement_risk:0.06, augmentation_potential:0.28, new_work_creation:0.66, impact_band:'low', timeline_years:10, ai_tools_overlap:['Translation AI'], resilience_rationale:'Cultural nuance, trust-building and non-verbal reading across cultures remain human advantages.' },
  { skill_code:'AI_ETHICS', displacement_risk:0.05, augmentation_potential:0.45, new_work_creation:0.50, impact_band:'low', timeline_years:5, ai_tools_overlap:[], resilience_rationale:'Governance and ethical adjudication of AI systems is a new and growing human responsibility.' },
  { skill_code:'SUSTAINABILITY_THINKING', displacement_risk:0.08, augmentation_potential:0.52, new_work_creation:0.40, impact_band:'low', timeline_years:6, ai_tools_overlap:['ESG analytics AI'], resilience_rationale:'Value trade-offs and stakeholder advocacy in sustainability are human responsibilities.' },
  { skill_code:'ENTREPRENEURIAL_MINDSET', displacement_risk:0.06, augmentation_potential:0.42, new_work_creation:0.52, impact_band:'low', timeline_years:8, ai_tools_overlap:[], resilience_rationale:'Risk appetite, vision and the will to build are human traits; AI accelerates execution.' },
];

type AutomationRiskSeed = Omit<Parameters<Pool['query']>[0], never> & {
  role_code: string; role_name: string; industry: string;
  risk_score: number; risk_band: string; timeline_years: number;
  exposed_tasks: string[]; resilient_tasks: string[]; upskill_priorities: string[];
};

const AUTOMATION_RISK_SEEDS = [
  // Low risk (0–24)
  { role_code:'PSYCHOTHERAPIST', role_name:'Psychotherapist / Counsellor', industry:'healthcare', risk_score:10, risk_band:'low', timeline_years:15, exposed_tasks:['Admin documentation','appointment scheduling'], resilient_tasks:['Therapeutic alliance','trauma-informed listening','clinical judgement','crisis response','existential processing'], upskill_priorities:['AI-assisted documentation','digital mental health tools','cultural competency'] },
  { role_code:'OCCUPATIONAL_THERAPIST', role_name:'Occupational Therapist', industry:'healthcare', risk_score:14, risk_band:'low', timeline_years:15, exposed_tasks:['Assessment reporting','home visit scheduling'], resilient_tasks:['Functional assessment','rehabilitation planning','patient motivation','family coaching','adaptive equipment fitting'], upskill_priorities:['Telehealth platforms','AI rehabilitation tools'] },
  { role_code:'CREATIVE_DIRECTOR', role_name:'Creative Director', industry:'creative', risk_score:18, risk_band:'low', timeline_years:12, exposed_tasks:['Initial concept generation','asset resizing'], resilient_tasks:['Brand vision','cultural judgement','client relationship','quality arbitration','talent development'], upskill_priorities:['Generative AI art direction','AI-augmented creative workflow'] },
  { role_code:'HEAD_TEACHER', role_name:'Head Teacher / School Principal', industry:'education', risk_score:20, risk_band:'low', timeline_years:15, exposed_tasks:['Timetabling','routine communications'], resilient_tasks:['Staff development','safeguarding','community trust','pedagogical leadership','crisis management'], upskill_priorities:['EdTech leadership','data-informed school improvement'] },
  { role_code:'SOCIAL_WORKER', role_name:'Social Worker', industry:'government', risk_score:22, risk_band:'low', timeline_years:12, exposed_tasks:['Case documentation','referral coordination'], resilient_tasks:['Safeguarding judgement','family engagement','advocacy','trauma-informed care','court testimony'], upskill_priorities:['Digital case management','AI-assisted risk assessment tools'] },
  // Moderate-low (25–44)
  { role_code:'SOFTWARE_ENGINEER', role_name:'Software Engineer', industry:'technology', risk_score:28, risk_band:'moderate_low', timeline_years:5, exposed_tasks:['Boilerplate code writing','unit test generation','documentation'], resilient_tasks:['System architecture','debugging complex systems','stakeholder translation','security reasoning','code review'], upskill_priorities:['AI-augmented development','system design','cloud architecture'] },
  { role_code:'HR_BUSINESS_PARTNER', role_name:'HR Business Partner', industry:'business_services', risk_score:32, risk_band:'moderate_low', timeline_years:7, exposed_tasks:['Job description drafting','policy Q&A','leave calculations'], resilient_tasks:['Organisational dynamics','mediation','talent strategy','change facilitation','executive advising'], upskill_priorities:['People analytics','AI-assisted recruitment','workforce planning tools'] },
  { role_code:'NURSE_PRACTITIONER', role_name:'Nurse Practitioner', industry:'healthcare', risk_score:22, risk_band:'low', timeline_years:10, exposed_tasks:['Prescription refills','routine documentation'], resilient_tasks:['Clinical judgement','patient advocacy','complex symptom assessment','care coordination','end-of-life care'], upskill_priorities:['Clinical AI tools','telehealth delivery','genomic medicine literacy'] },
  { role_code:'PRODUCT_MANAGER', role_name:'Product Manager', industry:'technology', risk_score:30, risk_band:'moderate_low', timeline_years:6, exposed_tasks:['Backlog grooming','status reporting','meeting notes'], resilient_tasks:['User empathy','stakeholder alignment','prioritisation judgement','vision setting','cross-functional leadership'], upskill_priorities:['AI product strategy','data-driven decision making','AI ethics in products'] },
  { role_code:'MARKETING_MANAGER', role_name:'Marketing Manager', industry:'business_services', risk_score:35, risk_band:'moderate_low', timeline_years:5, exposed_tasks:['Ad copy drafting','A/B test setup','basic analytics reports'], resilient_tasks:['Brand strategy','customer insight','campaign judgement','agency management','budget negotiation'], upskill_priorities:['AI-powered marketing tools','growth analytics','content strategy with AI'] },
  { role_code:'TEACHER', role_name:'Teacher (Secondary)', industry:'education', risk_score:38, risk_band:'moderate_low', timeline_years:8, exposed_tasks:['Grading routine work','lesson plan drafting','parent update emails'], resilient_tasks:['Student motivation','differentiated instruction','social-emotional development','classroom culture','pastoral care'], upskill_priorities:['AI-assisted differentiation','EdTech integration','data-driven instruction'] },
  // Moderate (45–64)
  { role_code:'DATA_ANALYST', role_name:'Data Analyst', industry:'technology', risk_score:42, risk_band:'moderate', timeline_years:4, exposed_tasks:['SQL query writing','standard reporting','data cleaning'], resilient_tasks:['Business question framing','stakeholder communication','data storytelling','hypothesis design','domain interpretation'], upskill_priorities:['Machine learning fundamentals','AI analytics platforms','advanced data visualisation'] },
  { role_code:'FINANCIAL_ANALYST', role_name:'Financial Analyst', industry:'finance', risk_score:55, risk_band:'moderate', timeline_years:4, exposed_tasks:['Financial modelling','variance reporting','data aggregation'], resilient_tasks:['Client advisory','deal judgement','market narrative','board communication','valuation debate'], upskill_priorities:['AI-augmented financial modelling','ESG analysis','strategic finance'] },
  { role_code:'CONTENT_WRITER', role_name:'Content Writer', industry:'creative', risk_score:50, risk_band:'moderate', timeline_years:3, exposed_tasks:['First draft generation','SEO meta descriptions','social captions'], resilient_tasks:['Brand voice','editorial judgement','subject-matter interviews','audience empathy','strategic narrative'], upskill_priorities:['AI-augmented content creation','content strategy','multimedia storytelling'] },
  { role_code:'LEGAL_ASSOCIATE', role_name:'Legal Associate', industry:'legal', risk_score:48, risk_band:'moderate', timeline_years:5, exposed_tasks:['Contract review','legal research','due diligence summaries'], resilient_tasks:['Client relationship','negotiation strategy','ethical judgement','court advocacy','deal structuring'], upskill_priorities:['Legal AI tools','contract management platforms','AI ethics in law'] },
  { role_code:'ACCOUNTANT', role_name:'Accountant', industry:'finance', risk_score:60, risk_band:'moderate', timeline_years:4, exposed_tasks:['Transaction categorisation','reconciliations','standard tax returns','compliance checklists'], resilient_tasks:['Tax strategy','audit judgement','client advisory','regulatory interpretation','business advisory'], upskill_priorities:['AI accounting platforms','advisory services','financial consulting'] },
  // High (65–80)
  { role_code:'CUSTOMER_SERVICE_REP', role_name:'Customer Service Representative', industry:'retail', risk_score:70, risk_band:'high', timeline_years:3, exposed_tasks:['FAQ responses','order tracking','refund processing','appointment booking','account queries'], resilient_tasks:['Complex complaint resolution','emotional de-escalation','VIP relationship management'], upskill_priorities:['AI-human handoff management','customer experience design','emotional intelligence'] },
  { role_code:'BOOKKEEPER', role_name:'Bookkeeper', industry:'finance', risk_score:78, risk_band:'high', timeline_years:3, exposed_tasks:['Transaction entry','bank reconciliation','invoicing','payroll processing','expense categorisation'], resilient_tasks:['Client relationship','exception investigation','advisory on anomalies'], upskill_priorities:['Cloud accounting software','financial operations strategy','business advisory'] },
  { role_code:'PARALEGAL', role_name:'Paralegal', industry:'legal', risk_score:65, risk_band:'high', timeline_years:4, exposed_tasks:['Document review','legal research','contract summarisation','case file management'], resilient_tasks:['Witness coordination','deposition preparation','client liaison'], upskill_priorities:['Legal AI platforms','e-discovery tools','legal operations management'] },
  { role_code:'SALES_DEV_REP', role_name:'Sales Development Representative', industry:'business_services', risk_score:68, risk_band:'high', timeline_years:3, exposed_tasks:['Cold outreach sequences','lead list building','meeting scheduling','CRM data entry'], resilient_tasks:['Complex prospect conversation','objection handling','relationship nurturing'], upskill_priorities:['AI sales tools','consultative selling','revenue intelligence platforms'] },
  // Critical (81–100)
  { role_code:'DATA_ENTRY_CLERK', role_name:'Data Entry Clerk', industry:'business_services', risk_score:88, risk_band:'critical', timeline_years:2, exposed_tasks:['Manual data entry','form processing','record transfer','data validation','spreadsheet population'], resilient_tasks:['Exception handling requiring contextual judgement'], upskill_priorities:['Data quality management','process automation tools','analytical skills'] },
  { role_code:'DOCUMENT_PROCESSOR', role_name:'Document Processor', industry:'business_services', risk_score:85, risk_band:'critical', timeline_years:2, exposed_tasks:['Document classification','data extraction','form completion','filing and indexing','compliance stamping'], resilient_tasks:['Complex case review','policy interpretation'], upskill_priorities:['RPA tools','document AI platforms','process design'] },
  { role_code:'SCHEDULING_COORDINATOR', role_name:'Scheduling Coordinator', industry:'business_services', risk_score:80, risk_band:'critical', timeline_years:3, exposed_tasks:['Calendar management','appointment booking','reminder sending','resource allocation','routine rescheduling'], resilient_tasks:['Complex stakeholder coordination','crisis rescheduling','VIP management'], upskill_priorities:['Operations intelligence','project coordination','strategic scheduling'] },
  { role_code:'LOAN_PROCESSOR', role_name:'Loan Processor', industry:'finance', risk_score:82, risk_band:'critical', timeline_years:3, exposed_tasks:['Application data entry','document checklist verification','standard underwriting data gathering','compliance form completion'], resilient_tasks:['Complex case assessment','customer edge-case resolution'], upskill_priorities:['Credit advisory','financial coaching','relationship banking'] },
  { role_code:'BASIC_CODER', role_name:'Junior Script / Basic Coder', industry:'technology', risk_score:75, risk_band:'high', timeline_years:3, exposed_tasks:['Boilerplate CRUD code','config scripts','basic test writing','documentation','data migration scripts'], resilient_tasks:['Problem framing','requirements clarification'], upskill_priorities:['AI-augmented development','system design thinking','product engineering'] },
];

const INDUSTRY_FORECAST_SEEDS = [
  { industry_code:'technology', industry_name:'Technology & Software', growth_outlook:'strong', ai_disruption_band:'transformative', skill_demand_shift:{ rising:['AI System Design','Cybersecurity','Human-AI Collaboration','AI Ethics','Cloud Architecture'], declining:['Basic Coding','Manual QA Testing','Data Entry'], stable:['System Architecture','Engineering Leadership'] }, top_growing_roles:['AI Product Engineer','ML Platform Engineer','Cybersecurity Architect','AI Ethics Officer','Cloud Solutions Architect'], top_declining_roles:['Junior Boilerplate Coder','Manual QA Tester','IT Help Desk Tier 1'], horizon_years:5, ai_readiness_score:85, source_rationale:'WEF Future of Jobs 2025; OECD digital outlook 2024; internal construct mapping.' },
  { industry_code:'healthcare', industry_name:'Healthcare & Life Sciences', growth_outlook:'exceptional', ai_disruption_band:'moderate', skill_demand_shift:{ rising:['Human-AI Collaboration','Data Interpretation','Empathy','AI Ethics','Telehealth Delivery'], declining:['Manual Record Entry','Basic Diagnostic Coding'], stable:['Clinical Judgement','Patient Advocacy','Care Coordination'] }, top_growing_roles:['Clinical AI Specialist','Nurse Practitioner','Health Data Scientist','Patient Experience Designer','Telemedicine Clinician'], top_declining_roles:['Medical Transcriptionist','Routine Lab Technician'], horizon_years:5, ai_readiness_score:55, source_rationale:'McKinsey Global Institute; NHS Digital workforce report.' },
  { industry_code:'finance', industry_name:'Financial Services & Banking', growth_outlook:'moderate', ai_disruption_band:'high', skill_demand_shift:{ rising:['AI Ethics','Risk Management','Strategic Finance','Client Advisory','Data Storytelling'], declining:['Bookkeeping','Routine Compliance Processing','Manual Reconciliation'], stable:['Regulatory Interpretation','Investment Judgement'] }, top_growing_roles:['AI-Augmented Financial Advisor','Risk Intelligence Analyst','CFO Technology Advisor','ESG Finance Specialist'], top_declining_roles:['Bookkeeper','Loan Processor','Routine Compliance Analyst'], horizon_years:5, ai_readiness_score:70, source_rationale:'McKinsey Future of Finance; World Economic Forum Financial Services report.' },
  { industry_code:'education', industry_name:'Education & Training', growth_outlook:'moderate', ai_disruption_band:'moderate', skill_demand_shift:{ rising:['Learning Design','AI Literacy','Coaching & Mentoring','Social-Emotional Learning','Data-Driven Instruction'], declining:['Routine Assessment Marking','Standard Lesson Delivery'], stable:['Pedagogical Leadership','Student Welfare','Community Engagement'] }, top_growing_roles:['Learning Experience Designer','AI Literacy Educator','Student Success Coach','EdTech Integration Specialist'], top_declining_roles:['Routine Test Marker','Basic Admin Support'], horizon_years:5, ai_readiness_score:45, source_rationale:'UNESCO AI in Education report 2024; OECD Education at a Glance.' },
  { industry_code:'creative', industry_name:'Creative Industries & Media', growth_outlook:'strong', ai_disruption_band:'transformative', skill_demand_shift:{ rising:['AI Art Direction','Human-AI Creative Collaboration','IP Strategy','AI Ethics','Audience Intelligence'], declining:['Stock Illustration','Basic Video Editing','Template Design'], stable:['Brand Vision','Cultural Judgement','Talent Direction'] }, top_growing_roles:['AI Creative Director','Generative Media Producer','Brand Intelligence Strategist','Content Experience Designer'], top_declining_roles:['Stock Photo Illustrator','Basic Video Editor','Template Graphic Designer'], horizon_years:5, ai_readiness_score:65, source_rationale:'Nesta Creative Industries Foresight; Adobe AI Creative Economy report.' },
  { industry_code:'legal', industry_name:'Legal Services', growth_outlook:'stable', ai_disruption_band:'high', skill_demand_shift:{ rising:['Legal Tech Proficiency','AI Ethics','Client Advisory','Strategic Negotiation'], declining:['Document Review','Legal Research Compilation','Contract Summarisation'], stable:['Court Advocacy','Deal Judgement','Regulatory Strategy'] }, top_growing_roles:['Legal Technology Specialist','AI Contract Counsel','Legal Operations Manager','Regulatory AI Advisor'], top_declining_roles:['Junior Document Reviewer','Paralegal (routine)','Legal Researcher (routine)'], horizon_years:5, ai_readiness_score:55, source_rationale:'Thomson Reuters Future of Professionals 2024; Harvard Law AI report.' },
  { industry_code:'manufacturing', industry_name:'Manufacturing & Industry', growth_outlook:'declining', ai_disruption_band:'transformative', skill_demand_shift:{ rising:['Robotics Supervision','AI System Design','Cybersecurity','Sustainability Thinking','Maintenance Intelligence'], declining:['Manual Assembly','Quality Inspection (routine)','Inventory Counting'], stable:['Process Engineering','Safety Management','Supply Chain Strategy'] }, top_growing_roles:['Robotics Technician','Manufacturing AI Specialist','Supply Chain Intelligence Analyst','Sustainability Engineer'], top_declining_roles:['Manual Assembly Operative','Routine Quality Inspector','Inventory Clerk'], horizon_years:5, ai_readiness_score:60, source_rationale:'Deloitte Manufacturing Industry 2025; World Manufacturing Forum.' },
  { industry_code:'retail', industry_name:'Retail & E-Commerce', growth_outlook:'moderate', ai_disruption_band:'high', skill_demand_shift:{ rising:['Customer Experience Design','AI Tool Proficiency','Data Storytelling','Supply Chain Intelligence','Personalisation Strategy'], declining:['Cashier (routine)','Warehouse Picking','Basic Customer Service Queries'], stable:['Store Operations Leadership','Buyer Relationship','Visual Merchandising'] }, top_growing_roles:['Customer Experience Designer','Retail AI Analyst','Omnichannel Experience Manager','Personalisation Strategist'], top_declining_roles:['Routine Cashier','Basic Customer Service Agent','Warehouse Picker (routine)'], horizon_years:5, ai_readiness_score:58, source_rationale:'Euromonitor Retail Technology; McKinsey Retail AI report.' },
  { industry_code:'logistics', industry_name:'Logistics & Supply Chain', growth_outlook:'strong', ai_disruption_band:'high', skill_demand_shift:{ rising:['AI System Design','Risk Management','Data Interpretation','Sustainability Thinking','Autonomous Systems Oversight'], declining:['Manual Dispatch Coordination','Routine Route Planning','Basic Freight Documentation'], stable:['Supplier Relationship','Customs & Trade Expertise','Warehouse Strategy'] }, top_growing_roles:['Supply Chain Intelligence Analyst','Autonomous Logistics Supervisor','Trade Compliance Specialist','Sustainability Supply Chain Manager'], top_declining_roles:['Routine Dispatch Coordinator','Manual Route Planner','Basic Freight Clerk'], horizon_years:5, ai_readiness_score:62, source_rationale:'Gartner Supply Chain Technology report; DHL Future of Logistics.' },
  { industry_code:'government', industry_name:'Government & Public Sector', growth_outlook:'stable', ai_disruption_band:'low', skill_demand_shift:{ rising:['AI Ethics','Sustainability Thinking','Change Adaptability','Policy Intelligence','Data Interpretation'], declining:['Form Processing','Routine Enquiry Handling','Manual Record Keeping'], stable:['Policy Judgement','Democratic Accountability','Community Engagement','Crisis Management'] }, top_growing_roles:['Policy AI Advisor','Digital Government Specialist','Public Data Scientist','Civic Tech Manager'], top_declining_roles:['Routine Form Processor','Manual Record Keeper','Basic Public Enquiry Agent'], horizon_years:5, ai_readiness_score:32, source_rationale:'OECD Government AI Readiness Index; GDS AI in Government framework.' },
];

const ROLE_EVOLUTION_SEEDS = [
  // ── Technology ──────────────────────────────────────────────────────────────
  { from_role:'Software Engineer', to_role:'AI Product Engineer', evolution_type:'specialize', feasibility_score:80, required_skills:['AI System Design','Prompt Engineering','Human-AI Collaboration','Product thinking'], drop_skills:['Routine boilerplate coding'], transition_months_min:6, transition_months_max:12, is_ai_driven:true },
  { from_role:'Software Engineer', to_role:'Engineering Manager', evolution_type:'uplevel', feasibility_score:72, required_skills:['Team Leadership','Systems Thinking','Strategic Planning','Coaching & Mentoring'], drop_skills:['Deep individual coding'], transition_months_min:12, transition_months_max:24, is_ai_driven:false },
  { from_role:'Data Analyst', to_role:'ML Engineer', evolution_type:'uplevel', feasibility_score:68, required_skills:['AI System Design','Cloud Architecture','DevOps Practices','Python ML frameworks'], drop_skills:['Dashboard reporting'], transition_months_min:12, transition_months_max:24, is_ai_driven:true },
  { from_role:'Data Analyst', to_role:'Data Strategist', evolution_type:'adjacent', feasibility_score:76, required_skills:['Business Strategy','Data Storytelling','Influence & Persuasion','Market Sensing'], drop_skills:['Routine SQL reports'], transition_months_min:9, transition_months_max:15, is_ai_driven:false },
  { from_role:'Junior Script / Basic Coder', to_role:'Software Engineer', evolution_type:'uplevel', feasibility_score:74, required_skills:['Systems Thinking','DevOps Practices','Cloud Architecture','Complex Problem Solving'], drop_skills:['Script-only work'], transition_months_min:12, transition_months_max:18, is_ai_driven:false },
  { from_role:'DevOps Engineer', to_role:'Platform Engineering Lead', evolution_type:'uplevel', feasibility_score:75, required_skills:['Cloud Architecture','Team Leadership','AI System Design','Strategic Planning'], drop_skills:['Manual pipeline maintenance'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  // ── Finance ──────────────────────────────────────────────────────────────────
  { from_role:'Financial Analyst', to_role:'AI-Augmented Financial Advisor', evolution_type:'adjacent', feasibility_score:82, required_skills:['AI Tool Proficiency','Client Advisory','Financial Analysis','Data Storytelling'], drop_skills:['Manual Modelling'], transition_months_min:9, transition_months_max:15, is_ai_driven:true },
  { from_role:'Financial Analyst', to_role:'Investment Intelligence Analyst', evolution_type:'specialize', feasibility_score:70, required_skills:['AI System Design','Data Interpretation','Market Sensing','Risk Management'], drop_skills:['Standard variance reporting'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  { from_role:'Accountant', to_role:'Finance Business Partner', evolution_type:'adjacent', feasibility_score:68, required_skills:['Business Strategy','Data Storytelling','Influence & Persuasion','Decision Making'], drop_skills:['Routine reconciliations'], transition_months_min:12, transition_months_max:20, is_ai_driven:false },
  { from_role:'Accountant', to_role:'CFO Technology Advisor', evolution_type:'uplevel', feasibility_score:52, required_skills:['Business Strategy','AI Ethics','Innovation Management','Strategic Planning'], drop_skills:['Routine compliance filing'], transition_months_min:24, transition_months_max:48, is_ai_driven:false },
  { from_role:'Bookkeeper', to_role:'Financial Operations Manager', evolution_type:'uplevel', feasibility_score:62, required_skills:['Business Strategy','Risk Management','Team Leadership','Cloud accounting platforms'], drop_skills:['Manual transaction entry'], transition_months_min:12, transition_months_max:18, is_ai_driven:false },
  { from_role:'Loan Processor', to_role:'Credit Advisory Specialist', evolution_type:'pivot', feasibility_score:60, required_skills:['Client Advisory','Risk Management','Financial Analysis','Coaching & Mentoring'], drop_skills:['Application data entry'], transition_months_min:12, transition_months_max:18, is_ai_driven:false },
  // ── Marketing & Sales ────────────────────────────────────────────────────────
  { from_role:'Marketing Manager', to_role:'Growth Intelligence Manager', evolution_type:'adjacent', feasibility_score:76, required_skills:['Market Sensing','Data Storytelling','AI Tool Proficiency','Entrepreneurial Mindset'], drop_skills:['Manual campaign execution'], transition_months_min:9, transition_months_max:15, is_ai_driven:true },
  { from_role:'Content Writer', to_role:'AI Content Strategist', evolution_type:'adjacent', feasibility_score:78, required_skills:['AI Tool Proficiency','Market Sensing','Data Storytelling','Brand Strategy'], drop_skills:['Volume content production'], transition_months_min:6, transition_months_max:12, is_ai_driven:true },
  { from_role:'Content Writer', to_role:'Brand Narrative Director', evolution_type:'uplevel', feasibility_score:65, required_skills:['Storytelling','Influence & Persuasion','Strategic Planning','Creative Thinking'], drop_skills:['SEO meta copy'], transition_months_min:18, transition_months_max:30, is_ai_driven:false },
  { from_role:'Sales Development Representative', to_role:'Revenue Intelligence Analyst', evolution_type:'adjacent', feasibility_score:65, required_skills:['Data Interpretation','Market Sensing','AI Tool Proficiency','Business Strategy'], drop_skills:['Cold outreach volume'], transition_months_min:9, transition_months_max:18, is_ai_driven:true },
  { from_role:'Sales Development Representative', to_role:'Account Executive', evolution_type:'uplevel', feasibility_score:78, required_skills:['Negotiation','Client Advisory','Storytelling','Complex Problem Solving'], drop_skills:['Outbound prospecting'], transition_months_min:9, transition_months_max:15, is_ai_driven:false },
  // ── HR & Operations ──────────────────────────────────────────────────────────
  { from_role:'HR Business Partner', to_role:'People Analytics Lead', evolution_type:'adjacent', feasibility_score:72, required_skills:['Data Interpretation','Data Storytelling','AI Tool Proficiency','Business Strategy'], drop_skills:['Administrative HR processing'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  { from_role:'HR Business Partner', to_role:'Organisational Development Consultant', evolution_type:'adjacent', feasibility_score:74, required_skills:['Coaching & Mentoring','Systems Thinking','Change Adaptability','Influence & Persuasion'], drop_skills:['Transactional HR'], transition_months_min:12, transition_months_max:18, is_ai_driven:false },
  { from_role:'Scheduling Coordinator', to_role:'Operations Intelligence Analyst', evolution_type:'pivot', feasibility_score:60, required_skills:['Data Interpretation','Systems Thinking','AI Tool Proficiency','Risk Management'], drop_skills:['Manual calendar management'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  { from_role:'Data Entry Clerk', to_role:'Data Quality Analyst', evolution_type:'uplevel', feasibility_score:58, required_skills:['Data Interpretation','Critical Thinking','AI Tool Proficiency','Process Improvement'], drop_skills:['Manual data entry'], transition_months_min:9, transition_months_max:15, is_ai_driven:false },
  { from_role:'Document Processor', to_role:'Intelligent Automation Specialist', evolution_type:'pivot', feasibility_score:62, required_skills:['AI Tool Proficiency','Systems Thinking','Project Orchestration','Risk Management'], drop_skills:['Manual document handling'], transition_months_min:9, transition_months_max:15, is_ai_driven:true },
  // ── Education & Social ───────────────────────────────────────────────────────
  { from_role:'Teacher (Secondary)', to_role:'Learning Experience Designer', evolution_type:'adjacent', feasibility_score:80, required_skills:['Design Thinking','AI Tool Proficiency','Coaching & Mentoring','Data Interpretation'], drop_skills:['Classroom delivery'], transition_months_min:6, transition_months_max:12, is_ai_driven:true },
  { from_role:'Teacher (Secondary)', to_role:'Student Success Coach', evolution_type:'adjacent', feasibility_score:82, required_skills:['Coaching & Mentoring','Empathy','Data Interpretation','Resilience Building'], drop_skills:['Subject instruction'], transition_months_min:6, transition_months_max:12, is_ai_driven:false },
  { from_role:'Social Worker', to_role:'Community Intelligence Designer', evolution_type:'adjacent', feasibility_score:72, required_skills:['Design Thinking','Data Interpretation','Empathy','Sustainability Thinking'], drop_skills:['Routine case documentation'], transition_months_min:12, transition_months_max:18, is_ai_driven:false },
  { from_role:'Head Teacher / School Principal', to_role:'EdTech Integration Lead', evolution_type:'adjacent', feasibility_score:68, required_skills:['AI Tool Proficiency','Innovation Management','Change Adaptability','Strategic Planning'], drop_skills:['Routine administration'], transition_months_min:9, transition_months_max:15, is_ai_driven:true },
  // ── Legal & Compliance ───────────────────────────────────────────────────────
  { from_role:'Paralegal', to_role:'Legal Technology Specialist', evolution_type:'pivot', feasibility_score:68, required_skills:['AI Tool Proficiency','AI Ethics','Project Orchestration','Legal tech platforms'], drop_skills:['Document review'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  { from_role:'Legal Associate', to_role:'AI Contract Counsel', evolution_type:'specialize', feasibility_score:73, required_skills:['AI Ethics','AI Tool Proficiency','Risk Management','Negotiation'], drop_skills:['Routine contract review'], transition_months_min:9, transition_months_max:15, is_ai_driven:true },
  { from_role:'Legal Associate', to_role:'Legal Operations Manager', evolution_type:'adjacent', feasibility_score:70, required_skills:['Project Orchestration','Business Strategy','Change Adaptability','Data Interpretation'], drop_skills:['Billable legal work'], transition_months_min:12, transition_months_max:18, is_ai_driven:false },
  // ── Customer Experience ──────────────────────────────────────────────────────
  { from_role:'Customer Service Representative', to_role:'Customer Experience Designer', evolution_type:'pivot', feasibility_score:70, required_skills:['Design Thinking','Empathy','Data Interpretation','Journey Mapping'], drop_skills:['Ticket resolution'], transition_months_min:9, transition_months_max:15, is_ai_driven:true },
  { from_role:'Customer Service Representative', to_role:'Customer Success Manager', evolution_type:'uplevel', feasibility_score:72, required_skills:['Coaching & Mentoring','Negotiation','Market Sensing','Client Advisory'], drop_skills:['Inbound volume handling'], transition_months_min:6, transition_months_max:12, is_ai_driven:false },
  // ── Healthcare ───────────────────────────────────────────────────────────────
  { from_role:'Nurse Practitioner', to_role:'Clinical AI Specialist', evolution_type:'specialize', feasibility_score:66, required_skills:['AI Tool Proficiency','Data Interpretation','Human-AI Collaboration','AI Ethics'], drop_skills:['Routine prescription refills'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  { from_role:'Occupational Therapist', to_role:'Rehabilitation Technology Designer', evolution_type:'adjacent', feasibility_score:63, required_skills:['Design Thinking','AI Tool Proficiency','Data Interpretation','Human-AI Collaboration'], drop_skills:['Manual equipment fitting'], transition_months_min:12, transition_months_max:18, is_ai_driven:true },
  // ── Cross-domain senior paths ────────────────────────────────────────────────
  { from_role:'Product Manager', to_role:'Chief Product Officer', evolution_type:'uplevel', feasibility_score:55, required_skills:['Strategic Planning','Innovation Management','Team Leadership','Influence & Persuasion'], drop_skills:['Day-to-day backlog management'], transition_months_min:24, transition_months_max:48, is_ai_driven:false },
  { from_role:'Creative Director', to_role:'AI Creative Director', evolution_type:'specialize', feasibility_score:77, required_skills:['AI Tool Proficiency','Human-AI Collaboration','Entrepreneurial Mindset','AI Ethics'], drop_skills:['Manual asset production'], transition_months_min:6, transition_months_max:12, is_ai_driven:true },
];

export async function seedFRPData(pool: Pool): Promise<void> {
  // Taxonomy domains + clusters
  const taxonomyRows = [
    { taxonomy_code:'HUMAN_INTELLIGENCE', name:'Human Intelligence', level:1, parent_code:null, description:'Skills rooted in emotional, social and creative human capacity — highly resistant to automation.' },
    { taxonomy_code:'COGNITIVE_EXCELLENCE', name:'Cognitive Excellence', level:1, parent_code:null, description:'Higher-order thinking skills: analysis, strategy and complex problem solving.' },
    { taxonomy_code:'TECHNICAL_DURABILITY', name:'Technical Durability', level:1, parent_code:null, description:'Technical skills with enduring value as AI augments but does not fully replace deep expertise.' },
    { taxonomy_code:'DIGITAL_FLUENCY', name:'Digital Fluency', level:1, parent_code:null, description:'Skills for working effectively in digital and AI-augmented environments.' },
    { taxonomy_code:'BUSINESS_ACUMEN', name:'Business Acumen', level:1, parent_code:null, description:'Commercial and organisational skills for value creation and decision making.' },
    { taxonomy_code:'ADAPTIVE_CAPABILITY', name:'Adaptive Capability', level:1, parent_code:null, description:'Meta-skills for thriving in change, uncertainty and lifelong learning.' },
    { taxonomy_code:'COMMUNICATION', name:'Communication', level:1, parent_code:null, description:'Human communication and persuasion skills across contexts and cultures.' },
    { taxonomy_code:'FUTURE_ORIENTED', name:'Future-Oriented', level:1, parent_code:null, description:'Emerging skills for navigating AI, sustainability and entrepreneurship.' },
    { taxonomy_code:'HI_ESI', name:'Emotional & Social Intelligence', level:2, parent_code:'HUMAN_INTELLIGENCE', description:'Empathy, listening and interpersonal attunement.' },
    { taxonomy_code:'HI_CREATIVE', name:'Creative Intelligence', level:2, parent_code:'HUMAN_INTELLIGENCE', description:'Originality, storytelling and design thinking.' },
    { taxonomy_code:'HI_LEADERSHIP', name:'Leadership & Influence', level:2, parent_code:'HUMAN_INTELLIGENCE', description:'Leading, coaching and influencing others.' },
    { taxonomy_code:'CE_ANALYTICAL', name:'Analytical Thinking', level:2, parent_code:'COGNITIVE_EXCELLENCE', description:'Critical, systems and complex problem solving.' },
    { taxonomy_code:'CE_STRATEGIC', name:'Strategic Intelligence', level:2, parent_code:'COGNITIVE_EXCELLENCE', description:'Planning, decision making and innovation management.' },
    { taxonomy_code:'TD_CYBER', name:'Cybersecurity', level:2, parent_code:'TECHNICAL_DURABILITY', description:'Security fundamentals and threat analysis.' },
    { taxonomy_code:'TD_CLOUD', name:'Cloud & Infrastructure', level:2, parent_code:'TECHNICAL_DURABILITY', description:'Cloud architecture and DevOps practices.' },
    { taxonomy_code:'TD_AI_ENG', name:'AI Engineering', level:2, parent_code:'TECHNICAL_DURABILITY', description:'AI system design and prompt engineering.' },
    { taxonomy_code:'DF_DATA', name:'Data Literacy', level:2, parent_code:'DIGITAL_FLUENCY', description:'Data interpretation and storytelling.' },
    { taxonomy_code:'DF_AI_AUG', name:'AI Augmentation', level:2, parent_code:'DIGITAL_FLUENCY', description:'AI tool proficiency and human-AI collaboration.' },
    { taxonomy_code:'DF_COLLAB', name:'Digital Collaboration', level:2, parent_code:'DIGITAL_FLUENCY', description:'Virtual team management and digital communication.' },
    { taxonomy_code:'BA_FINANCE', name:'Financial Intelligence', level:2, parent_code:'BUSINESS_ACUMEN', description:'Financial analysis and budget management.' },
    { taxonomy_code:'BA_PM', name:'Project Management', level:2, parent_code:'BUSINESS_ACUMEN', description:'Project orchestration and risk management.' },
    { taxonomy_code:'BA_STRATEGY', name:'Strategy & Innovation', level:2, parent_code:'BUSINESS_ACUMEN', description:'Business strategy and market sensing.' },
    { taxonomy_code:'AC_RESILIENCE', name:'Resilience & Adaptability', level:2, parent_code:'ADAPTIVE_CAPABILITY', description:'Learning agility, resilience and change adaptability.' },
    { taxonomy_code:'AC_FUTURE', name:'Future Orientation', level:2, parent_code:'ADAPTIVE_CAPABILITY', description:'Ambiguity tolerance and trend sensing.' },
    { taxonomy_code:'CO_INTERPERSONAL', name:'Interpersonal Communication', level:2, parent_code:'COMMUNICATION', description:'Presentation, negotiation and cross-cultural communication.' },
    { taxonomy_code:'FO_ETHICS', name:'Ethics & Governance', level:2, parent_code:'FUTURE_ORIENTED', description:'AI ethics and sustainability thinking.' },
    { taxonomy_code:'FO_ENTRE', name:'Entrepreneurship', level:2, parent_code:'FUTURE_ORIENTED', description:'Entrepreneurial mindset and opportunity recognition.' },
  ];

  for (const row of taxonomyRows) {
    await pool.query(
      `INSERT INTO frp_skill_taxonomy (taxonomy_code, name, level, parent_code, description)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (taxonomy_code) DO NOTHING`,
      [row.taxonomy_code, row.name, row.level, row.parent_code, row.description],
    ).catch(() => null);
  }

  for (const s of SKILL_SEEDS) {
    await pool.query(
      `INSERT INTO frp_skill_library
         (skill_code,name,description,domain,cluster,durability_score,human_quotient,data_intensity,emergence_horizon,demand_trend)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (skill_code) DO NOTHING`,
      [s.skill_code,s.name,s.description,s.domain,s.cluster,s.durability_score,s.human_quotient,s.data_intensity,s.emergence_horizon,s.demand_trend],
    ).catch(() => null);
  }

  for (const a of AI_IMPACT_SEEDS) {
    await pool.query(
      `INSERT INTO frp_ai_impact
         (skill_code,displacement_risk,augmentation_potential,new_work_creation,impact_band,timeline_years,ai_tools_overlap,resilience_rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (skill_code) DO NOTHING`,
      [a.skill_code,a.displacement_risk,a.augmentation_potential,a.new_work_creation,a.impact_band,a.timeline_years,a.ai_tools_overlap,a.resilience_rationale],
    ).catch(() => null);
  }

  for (const r of AUTOMATION_RISK_SEEDS) {
    await pool.query(
      `INSERT INTO frp_automation_risk
         (role_code,role_name,industry,risk_score,risk_band,timeline_years,exposed_tasks,resilient_tasks,upskill_priorities)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (role_code) DO NOTHING`,
      [r.role_code,r.role_name,r.industry,r.risk_score,r.risk_band,r.timeline_years,r.exposed_tasks,r.resilient_tasks,r.upskill_priorities],
    ).catch(() => null);
  }

  for (const f of INDUSTRY_FORECAST_SEEDS) {
    await pool.query(
      `INSERT INTO frp_industry_forecast
         (industry_code,industry_name,growth_outlook,ai_disruption_band,skill_demand_shift,top_growing_roles,top_declining_roles,horizon_years,ai_readiness_score,source_rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (industry_code) DO NOTHING`,
      [f.industry_code,f.industry_name,f.growth_outlook,f.ai_disruption_band,JSON.stringify(f.skill_demand_shift),f.top_growing_roles,f.top_declining_roles,f.horizon_years,f.ai_readiness_score,f.source_rationale],
    ).catch(() => null);
  }

  for (const e of ROLE_EVOLUTION_SEEDS) {
    await pool.query(
      `INSERT INTO frp_role_evolution
         (from_role,to_role,evolution_type,feasibility_score,required_skills,drop_skills,transition_months_min,transition_months_max,is_ai_driven)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [e.from_role,e.to_role,e.evolution_type,e.feasibility_score,e.required_skills,e.drop_skills,e.transition_months_min,e.transition_months_max,e.is_ai_driven],
    ).catch(() => null);
  }

  // Update taxonomy skill counts
  await pool.query(`
    UPDATE frp_skill_taxonomy t SET skill_count = (
      SELECT COUNT(*) FROM frp_skill_library s
      WHERE s.cluster = t.name OR s.domain = t.name
    )
  `).catch(() => null);

  // ── Gap 1: construct_key linkage — maps each FRP skill to the CAPADEX construct vocabulary
  // Lazy ADD COLUMN (idempotent) then bulk UPDATE via CASE. Allows the AI Navigator, Skills
  // Planner, and WC-3 outcome models to activate against real CAPADEX session signals.
  await pool.query(`
    ALTER TABLE frp_skill_library ADD COLUMN IF NOT EXISTS construct_key VARCHAR(80);
  `).catch(() => null);

  await pool.query(`
    UPDATE frp_skill_library SET construct_key = CASE skill_code
      WHEN 'CRITICAL_THINKING'     THEN 'CRITICAL_THINKING'
      WHEN 'COMPLEX_PROBLEM_SOLVING' THEN 'CRITICAL_THINKING'
      WHEN 'SYSTEMS_THINKING'      THEN 'CRITICAL_THINKING'
      WHEN 'DATA_INTERPRETATION'   THEN 'CRITICAL_THINKING'
      WHEN 'FINANCIAL_ANALYSIS'    THEN 'CRITICAL_THINKING'
      WHEN 'SUSTAINABILITY_THINKING' THEN 'CRITICAL_THINKING'
      WHEN 'AI_ETHICS'             THEN 'CRITICAL_THINKING'
      WHEN 'THREAT_ANALYSIS'       THEN 'CRITICAL_THINKING'
      WHEN 'RESILIENCE_BUILDING'   THEN 'RESILIENCE'
      WHEN 'CHANGE_ADAPTABILITY'   THEN 'RESILIENCE'
      WHEN 'AMBIGUITY_TOLERANCE'   THEN 'RESILIENCE'
      WHEN 'CREATIVE_THINKING'     THEN 'CREATIVITY'
      WHEN 'DESIGN_THINKING'       THEN 'CREATIVITY'
      WHEN 'INNOVATION_MANAGEMENT' THEN 'CREATIVITY'
      WHEN 'COMMUNICATION'         THEN 'COMMUNICATION'
      WHEN 'PRESENTATION_SKILLS'   THEN 'COMMUNICATION'
      WHEN 'STORYTELLING'          THEN 'COMMUNICATION'
      WHEN 'DATA_STORYTELLING'     THEN 'COMMUNICATION'
      WHEN 'ACTIVE_LISTENING'      THEN 'COMMUNICATION'
      WHEN 'NEGOTIATION'           THEN 'COMMUNICATION'
      WHEN 'INFLUENCE_PERSUASION'  THEN 'COMMUNICATION'
      WHEN 'SOCIAL_CONFIDENCE'     THEN 'SOCIAL_CONFIDENCE'
      WHEN 'TEAM_LEADERSHIP'       THEN 'SOCIAL_CONFIDENCE'
      WHEN 'VIRTUAL_TEAM_MGMT'     THEN 'SOCIAL_CONFIDENCE'
      WHEN 'CONFLICT_RESOLUTION'   THEN 'SOCIAL_CONFIDENCE'
      WHEN 'COACHING_MENTORING'    THEN 'SOCIAL_CONFIDENCE'
      WHEN 'CROSS_CULTURAL_COMM'   THEN 'SOCIAL_CONFIDENCE'
      WHEN 'EMPATHY'               THEN 'SOCIAL_CONFIDENCE'
      WHEN 'LEARNING_AGILITY'      THEN 'LEARNING_DRIVE'
      WHEN 'STRATEGIC_PLANNING'    THEN 'GOAL_ORIENTATION'
      WHEN 'BUSINESS_STRATEGY'     THEN 'GOAL_ORIENTATION'
      WHEN 'PROJECT_ORCHESTRATION' THEN 'GOAL_ORIENTATION'
      WHEN 'DECISION_MAKING'       THEN 'IMPULSE_CONTROL'
      WHEN 'RISK_MANAGEMENT'       THEN 'IMPULSE_CONTROL'
      WHEN 'ENTREPRENEURIAL_MINDSET' THEN 'INTRINSIC_MOTIVATION'
      WHEN 'MARKET_SENSING'        THEN 'SKILL_AWARENESS'
      WHEN 'HUMAN_AI_COLLAB'       THEN 'SKILL_AWARENESS'
      WHEN 'AI_TOOL_PROFICIENCY'   THEN 'SKILL_AWARENESS'
      WHEN 'PROMPT_ENGINEERING'    THEN 'SKILL_AWARENESS'
      WHEN 'AI_SYSTEM_DESIGN'      THEN 'SKILL_AWARENESS'
      WHEN 'CLOUD_ARCHITECTURE'    THEN 'SKILL_AWARENESS'
      WHEN 'CYBERSECURITY'         THEN 'SKILL_AWARENESS'
      WHEN 'DEVOPS_PRACTICES'      THEN 'SKILL_AWARENESS'
      ELSE NULL
    END
    WHERE construct_key IS NULL;
  `).catch(() => null);

  // Seed synthetic baseline benchmarks (day-one fallback)
  await seedSyntheticBenchmarks(pool);
}

/**
 * Seed synthetic baseline benchmark percentiles.
 * Used as a fallback when global_30d cohort has <5 real users.
 * Values reflect realistic population distributions derived from the
 * default signal scores and expected spread across skill-maturity levels.
 * sample_size=0 signals "synthetic" to the UI.
 */
async function seedSyntheticBenchmarks(pool: Pool): Promise<void> {
  const rows: Array<{ metric: string; p25: number; p50: number; p75: number; p90: number }> = [
    { metric: 'composite',         p25: 37, p50: 47, p75: 60, p90: 73 },
    { metric: 'skill_durability',  p25: 34, p50: 44, p75: 58, p90: 71 },
    { metric: 'adaptability',      p25: 40, p50: 50, p75: 64, p90: 77 },
    { metric: 'market_alignment',  p25: 33, p50: 42, p75: 56, p90: 69 },
    { metric: 'learning_velocity', p25: 35, p50: 45, p75: 59, p90: 72 },
    { metric: 'role_resilience',   p25: 40, p50: 52, p75: 66, p90: 79 },
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO frp_benchmarks (cohort_key, metric, p25, p50, p75, p90, sample_size)
       VALUES ('baseline_synthetic', $1, $2, $3, $4, $5, 0)
       ON CONFLICT (cohort_key, metric) DO NOTHING`,
      [r.metric, r.p25, r.p50, r.p75, r.p90],
    ).catch(() => null);
  }
}

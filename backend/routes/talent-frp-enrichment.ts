/**
 * D13 Supplement — Future Readiness Platform Enrichment
 * Adds: automation risk per RF, AI readiness scores per user,
 * future competency mapping tied to blueprints.
 * Additive + flag-gated: FF_FUTURE_READINESS=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_FUTURE_READINESS';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;
const getCached = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < CACHE_TTL ? e.data as T : null; };
const setCache = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });
const bustCache = () => cache.clear();

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS frp_automation_risk (
      id SERIAL PRIMARY KEY,
      rf_name TEXT NOT NULL UNIQUE,
      blueprint_key TEXT,
      automation_risk_level TEXT CHECK (automation_risk_level IN ('very_high','high','medium','low','very_low')) DEFAULT 'medium',
      automation_risk_score NUMERIC(5,4) DEFAULT 0.5,
      tasks_at_risk TEXT[] DEFAULT '{}',
      protected_tasks TEXT[] DEFAULT '{}',
      human_advantage TEXT[] DEFAULT '{}',
      oxfam_probability NUMERIC(5,4),
      mckinsey_displacement_pct NUMERIC(5,2),
      time_horizon_years INTEGER DEFAULT 5,
      mitigation_strategies TEXT[] DEFAULT '{}',
      last_updated TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_frp_ar_rf ON frp_automation_risk(rf_name);
    CREATE TABLE IF NOT EXISTS frp_ai_readiness_scores (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL UNIQUE,
      overall_ai_readiness NUMERIC(5,2),
      ai_literacy_score NUMERIC(5,2),
      digital_fluency_score NUMERIC(5,2),
      learning_agility_score NUMERIC(5,2),
      adaptation_score NUMERIC(5,2),
      ai_readiness_band TEXT CHECK (ai_readiness_band IN ('ai_native','ai_proficient','ai_developing','ai_resistant','ai_unassessed')) DEFAULT 'ai_unassessed',
      ai_tool_proficiency TEXT[] DEFAULT '{}',
      recommended_ai_upskills TEXT[] DEFAULT '{}',
      computed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_frp_airs_email ON frp_ai_readiness_scores(user_email);
    CREATE TABLE IF NOT EXISTS frp_future_competency_map (
      id SERIAL PRIMARY KEY,
      blueprint_key TEXT NOT NULL,
      current_competency TEXT NOT NULL,
      future_competency TEXT NOT NULL,
      transition_type TEXT CHECK (transition_type IN ('augment','replace','emerge','evolve')) DEFAULT 'evolve',
      time_horizon_years INTEGER DEFAULT 3,
      ai_impact TEXT,
      critical_for_future BOOLEAN DEFAULT false,
      reskill_investment_weeks INTEGER DEFAULT 8,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(blueprint_key, current_competency, future_competency)
    );
    CREATE INDEX IF NOT EXISTS idx_frp_fcm_blueprint ON frp_future_competency_map(blueprint_key);
  `);
  schemaReady = true;
}

const AUTOMATION_RISK_DATA = [
  { rf_name: 'Software Engineering', blueprint_key: 'software_engineering', automation_risk_level: 'medium', automation_risk_score: 0.35, tasks_at_risk: ['Boilerplate code writing','Basic bug fixing','Documentation generation','Standard testing'], protected_tasks: ['System architecture design','Complex problem solving','Security review','User experience design','Stakeholder communication'], human_advantage: ['Creative architecture','Ethical decision-making','Context understanding','Novel problem types'], oxfam_probability: 0.22, mckinsey_displacement_pct: 15, time_horizon_years: 5, mitigation_strategies: ['Master AI-augmented development (Copilot, Cursor)','Shift toward architecture and system design','Build AI/ML engineering skills','Develop product and user empathy'] },
  { rf_name: 'Data & Analytics', blueprint_key: 'data_science', automation_risk_level: 'medium', automation_risk_score: 0.38, tasks_at_risk: ['Standard report generation','Basic data cleaning','SQL query writing','Dashboard maintenance'], protected_tasks: ['Experiment design','Insight storytelling','Business problem framing','Novel model development','Ethics review'], human_advantage: ['Business context','Causal reasoning','Stakeholder communication','Research design'], oxfam_probability: 0.25, mckinsey_displacement_pct: 18, time_horizon_years: 4, mitigation_strategies: ['Develop causal inference expertise','Build data storytelling skills','Focus on novel ML research','Strengthen business acumen'] },
  { rf_name: 'Operations', blueprint_key: 'operations_management', automation_risk_level: 'high', automation_risk_score: 0.58, tasks_at_risk: ['Inventory management','Scheduling','Standard compliance checks','Routine quality inspection','Basic procurement'], protected_tasks: ['Exception management','Vendor relationship management','Crisis response','Strategic redesign','Culture building'], human_advantage: ['Relationship management','Crisis judgement','Ethical oversight','Stakeholder navigation'], oxfam_probability: 0.47, mckinsey_displacement_pct: 32, time_horizon_years: 5, mitigation_strategies: ['Develop digital transformation leadership','Build AI and robotics oversight skills','Focus on exception management and judgement','Strengthen strategic operations capability'] },
  { rf_name: 'Sales & Business Development', blueprint_key: 'sales_leadership', automation_risk_level: 'medium', automation_risk_score: 0.32, tasks_at_risk: ['Lead scoring','Initial outreach drafting','CRM data entry','Standard proposals','Price calculation'], protected_tasks: ['Complex enterprise negotiation','Executive relationship management','New market development','Custom solution design','Trust building'], human_advantage: ['Empathy and trust','Complex negotiation','Executive relationships','Bespoke solutioning'], oxfam_probability: 0.18, mckinsey_displacement_pct: 12, time_horizon_years: 5, mitigation_strategies: ['Master AI-powered sales tools','Elevate to strategic account management','Build executive relationship skills','Develop consultative selling capability'] },
  { rf_name: 'Marketing', blueprint_key: 'cross_functional', automation_risk_level: 'high', automation_risk_score: 0.52, tasks_at_risk: ['Content creation','SEO optimisation','Ad copy writing','A/B test execution','Report generation'], protected_tasks: ['Brand strategy','Audience insight mining','Creative direction','Campaign storytelling','Partnership development'], human_advantage: ['Brand creativity','Cultural intelligence','Strategic positioning','Authentic storytelling'], oxfam_probability: 0.38, mckinsey_displacement_pct: 25, time_horizon_years: 4, mitigation_strategies: ['Develop AI-augmented marketing skills','Build brand strategy and creative direction','Master marketing analytics interpretation','Focus on storytelling and audience empathy'] },
  { rf_name: 'Finance & Accounting', blueprint_key: 'executive_leadership', automation_risk_level: 'high', automation_risk_score: 0.62, tasks_at_risk: ['Bookkeeping','Standard reconciliation','Basic financial reporting','Tax preparation','Compliance monitoring'], protected_tasks: ['Strategic financial advice','M&A judgement','Investor relations','Complex tax strategy','Board reporting'], human_advantage: ['Judgement in uncertainty','Stakeholder trust','Complex advisory','Strategic interpretation'], oxfam_probability: 0.55, mckinsey_displacement_pct: 40, time_horizon_years: 5, mitigation_strategies: ['Develop strategic finance advisory skills','Build technology and analytics proficiency','Focus on FP&A and business partnering','Strengthen stakeholder communication'] },
  { rf_name: 'Human Resources', blueprint_key: 'people_leadership', automation_risk_level: 'medium', automation_risk_score: 0.40, tasks_at_risk: ['Resume screening','Standard onboarding','Basic policy queries','Routine compliance','Payroll processing'], protected_tasks: ['Culture transformation','Executive coaching','Conflict resolution','Org design','DEI strategy'], human_advantage: ['Human empathy','Culture judgement','Ethical oversight','Interpersonal trust'], oxfam_probability: 0.28, mckinsey_displacement_pct: 20, time_horizon_years: 5, mitigation_strategies: ['Build people analytics expertise','Develop OD and culture transformation skills','Master AI-augmented recruiting','Focus on coaching and leadership development'] },
  { rf_name: 'Project & Programme Management', blueprint_key: 'project_management', automation_risk_level: 'medium', automation_risk_score: 0.42, tasks_at_risk: ['Status reporting','Risk registry maintenance','Meeting scheduling','Resource tracking','Standard documentation'], protected_tasks: ['Stakeholder alignment','Cross-team conflict resolution','Adaptive planning','Scope negotiation','Executive communication'], human_advantage: ['Political navigation','Ambiguity management','Stakeholder trust','Complex trade-off judgement'], oxfam_probability: 0.30, mckinsey_displacement_pct: 22, time_horizon_years: 5, mitigation_strategies: ['Master AI project management tools','Develop programme strategy skills','Build stakeholder influence capability','Focus on agile transformation leadership'] },
  { rf_name: 'Customer Success', blueprint_key: 'customer_success', automation_risk_level: 'medium', automation_risk_score: 0.35, tasks_at_risk: ['Standard onboarding sequences','Health score monitoring','Basic query resolution','Usage reporting','Renewal administration'], protected_tasks: ['Executive sponsor relationships','Complex account recovery','Strategic expansion planning','Product advocacy','Escalation resolution'], human_advantage: ['Empathy and trust','Strategic advisory','Executive relationships','Complex recovery'], oxfam_probability: 0.20, mckinsey_displacement_pct: 14, time_horizon_years: 5, mitigation_strategies: ['Develop strategic account advisory skills','Build executive relationship capability','Master AI-powered CS platforms','Focus on complex problem-solving'] },
  { rf_name: 'Product Management', blueprint_key: 'product_management', automation_risk_level: 'low', automation_risk_score: 0.22, tasks_at_risk: ['User story writing','Backlog prioritisation','Competitive analysis','Sprint report generation'], protected_tasks: ['Product vision','Customer insight mining','Trade-off decisions','Stakeholder alignment','Innovation strategy'], human_advantage: ['Strategic vision','Empathy and insight','Political navigation','Creative innovation'], oxfam_probability: 0.10, mckinsey_displacement_pct: 8, time_horizon_years: 5, mitigation_strategies: ['Master AI-augmented product discovery','Build AI product strategy skills','Develop platform and ecosystem thinking','Strengthen data-driven decision making'] },
  { rf_name: 'Strategy & Consulting', blueprint_key: 'executive_leadership', automation_risk_level: 'low', automation_risk_score: 0.18, tasks_at_risk: ['Data gathering','Standard benchmarking','Report formatting','Literature review'], protected_tasks: ['Problem framing','Client relationship','Insight synthesis','Implementation advisory','Stakeholder influence'], human_advantage: ['Judgement','Client trust','Creative synthesis','Novel problem types'], oxfam_probability: 0.08, mckinsey_displacement_pct: 6, time_horizon_years: 7, mitigation_strategies: ['Integrate AI into analysis workflows','Develop AI strategy advisory capability','Build data science collaboration skills','Focus on client relationship and influence'] },
  { rf_name: 'Executive Leadership', blueprint_key: 'executive_leadership', automation_risk_level: 'very_low', automation_risk_score: 0.08, tasks_at_risk: ['Board report drafting','Data analysis for decisions'], protected_tasks: ['Strategic direction','Culture leadership','Major decisions','Board governance','Crisis leadership','Vision and purpose'], human_advantage: ['Judgement','Vision','Trust','Ethical leadership','Accountability'], oxfam_probability: 0.04, mckinsey_displacement_pct: 3, time_horizon_years: 10, mitigation_strategies: ['Embrace AI-augmented decision making','Build AI governance expertise','Develop digital transformation leadership','Stay current on technology implications'] },
  { rf_name: 'Legal & Compliance', blueprint_key: 'cross_functional', automation_risk_level: 'medium', automation_risk_score: 0.42, tasks_at_risk: ['Contract review','Standard compliance checks','Legal research','Document drafting','Routine due diligence'], protected_tasks: ['Complex legal strategy','Regulatory advocacy','Dispute resolution','Ethical judgement','Client advisory'], human_advantage: ['Judgement','Ethical reasoning','Relationship trust','Novel case types'], oxfam_probability: 0.32, mckinsey_displacement_pct: 22, time_horizon_years: 5, mitigation_strategies: ['Master legal tech and AI review tools','Build regulatory strategy expertise','Develop client advisory and advocacy skills','Focus on complex and novel cases'] },
  { rf_name: 'Research & Development', blueprint_key: 'data_science', automation_risk_level: 'low', automation_risk_score: 0.20, tasks_at_risk: ['Literature review','Standard data analysis','Lab documentation','Patent search'], protected_tasks: ['Hypothesis generation','Experimental design','Novel discovery','Cross-domain synthesis','Scientific judgement'], human_advantage: ['Creativity','Scientific intuition','Novel discovery','Cross-domain insight'], oxfam_probability: 0.12, mckinsey_displacement_pct: 8, time_horizon_years: 7, mitigation_strategies: ['Use AI to accelerate literature review and synthesis','Build computational science skills','Develop cross-disciplinary thinking','Focus on hypothesis-driven discovery'] },
  { rf_name: 'Supply Chain', blueprint_key: 'operations_management', automation_risk_level: 'very_high', automation_risk_score: 0.72, tasks_at_risk: ['Demand forecasting','Inventory optimisation','Supplier selection','Standard procurement','Logistics routing'], protected_tasks: ['Supplier relationship','Crisis response','Strategic sourcing','Geopolitical navigation','Sustainability integration'], human_advantage: ['Relationship management','Geopolitical judgement','Crisis response','Ethical sourcing'], oxfam_probability: 0.60, mckinsey_displacement_pct: 48, time_horizon_years: 5, mitigation_strategies: ['Master AI supply chain platforms','Build geopolitical and resilience expertise','Develop sustainability and ESG competency','Focus on strategic sourcing and supplier development'] },
];

const FUTURE_COMPETENCY_MAP = [
  { blueprint_key: 'software_engineering', current_competency: 'Code Writing', future_competency: 'AI-Augmented Development', transition_type: 'evolve', time_horizon_years: 2, ai_impact: 'AI copilots automate boilerplate; humans direct architecture and review AI output', critical_for_future: true, reskill_investment_weeks: 4 },
  { blueprint_key: 'software_engineering', current_competency: 'Manual Testing', future_competency: 'AI Test Orchestration', transition_type: 'replace', time_horizon_years: 3, ai_impact: 'AI generates and executes test cases; humans define coverage strategy', critical_for_future: true, reskill_investment_weeks: 6 },
  { blueprint_key: 'data_science', current_competency: 'Manual Data Cleaning', future_competency: 'AI Data Pipeline Orchestration', transition_type: 'replace', time_horizon_years: 2, ai_impact: 'AI automates cleaning; humans design data architecture and quality frameworks', critical_for_future: true, reskill_investment_weeks: 4 },
  { blueprint_key: 'data_science', current_competency: 'Statistical Analysis', future_competency: 'Causal AI Reasoning', transition_type: 'augment', time_horizon_years: 4, ai_impact: 'AI handles computation; humans design causal models and interpret results', critical_for_future: true, reskill_investment_weeks: 12 },
  { blueprint_key: 'executive_leadership', current_competency: 'Strategic Analysis', future_competency: 'AI-Augmented Strategy', transition_type: 'augment', time_horizon_years: 3, ai_impact: 'AI provides market intelligence and scenario modelling; humans apply judgement', critical_for_future: true, reskill_investment_weeks: 8 },
  { blueprint_key: 'people_leadership', current_competency: 'Performance Management', future_competency: 'AI-Assisted People Analytics', transition_type: 'augment', time_horizon_years: 3, ai_impact: 'AI surfaces performance patterns; humans interpret and have conversations', critical_for_future: true, reskill_investment_weeks: 6 },
  { blueprint_key: 'operations_management', current_competency: 'Manual Process Management', future_competency: 'Intelligent Process Automation', transition_type: 'replace', time_horizon_years: 3, ai_impact: 'AI/robots handle routine processes; humans manage exceptions and design new processes', critical_for_future: true, reskill_investment_weeks: 8 },
  { blueprint_key: 'future_readiness_blueprint', current_competency: 'Digital Literacy', future_competency: 'AI Collaboration Mastery', transition_type: 'evolve', time_horizon_years: 2, ai_impact: 'Baseline digital literacy evolves to daily AI tool proficiency as table stakes', critical_for_future: true, reskill_investment_weeks: 4 },
  { blueprint_key: 'sales_leadership', current_competency: 'Lead Generation', future_competency: 'AI-Powered Pipeline Intelligence', transition_type: 'augment', time_horizon_years: 2, ai_impact: 'AI qualifies and scores leads; humans focus on relationship development', critical_for_future: true, reskill_investment_weeks: 4 },
  { blueprint_key: 'product_management', current_competency: 'Manual User Research', future_competency: 'AI-Augmented Discovery', transition_type: 'augment', time_horizon_years: 3, ai_impact: 'AI synthesises feedback at scale; humans interpret and frame strategic insights', critical_for_future: true, reskill_investment_weeks: 6 },
];

async function seedFRPEnrichment(pool: Pool): Promise<void> {
  const existing = await pool.query<{ cnt: string }>('SELECT COUNT(*)::int AS cnt FROM frp_automation_risk');
  if (Number(existing.rows[0]?.cnt) >= AUTOMATION_RISK_DATA.length) return;
  for (const r of AUTOMATION_RISK_DATA) {
    await pool.query(`INSERT INTO frp_automation_risk(rf_name,blueprint_key,automation_risk_level,automation_risk_score,tasks_at_risk,protected_tasks,human_advantage,oxfam_probability,mckinsey_displacement_pct,time_horizon_years,mitigation_strategies) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(rf_name) DO NOTHING`,
      [r.rf_name, r.blueprint_key, r.automation_risk_level, r.automation_risk_score, r.tasks_at_risk, r.protected_tasks, r.human_advantage, r.oxfam_probability, r.mckinsey_displacement_pct, r.time_horizon_years, r.mitigation_strategies]);
  }
  for (const m of FUTURE_COMPETENCY_MAP) {
    await pool.query(`INSERT INTO frp_future_competency_map(blueprint_key,current_competency,future_competency,transition_type,time_horizon_years,ai_impact,critical_for_future,reskill_investment_weeks) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(blueprint_key,current_competency,future_competency) DO NOTHING`,
      [m.blueprint_key, m.current_competency, m.future_competency, m.transition_type, m.time_horizon_years, m.ai_impact, m.critical_for_future, m.reskill_investment_weeks]);
  }
}

async function computeAIReadiness(pool: Pool, email: string): Promise<any> {
  const [lbi, mei, frp] = await Promise.all([
    pool.query('SELECT overall_lbi FROM lbi_scores WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_ei FROM mei_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT future_readiness_index,ai_readiness_score FROM frp_user_snapshots WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
  ]);
  const lbiScore = lbi.rows[0] ? Number(lbi.rows[0].overall_lbi) : null;
  const eiScore = mei.rows[0] ? Number(mei.rows[0].overall_ei) : null;
  const frpData = frp.rows[0];

  const aiLiteracy = frpData?.ai_readiness_score ? Number(frpData.ai_readiness_score) : null;
  const digitalFluency = frpData?.future_readiness_index ? Number(frpData.future_readiness_index) : null;
  const learningAgility = lbiScore;
  const adaptation = eiScore ? Math.min(100, eiScore * 0.9 + (lbiScore || 50) * 0.1) : null;

  const available = [aiLiteracy, digitalFluency, learningAgility, adaptation].filter(v => v !== null);
  if (!available.length) return { user_email: email, overall_ai_readiness: null, ai_readiness_band: 'ai_unassessed' };

  const overall = Math.round(available.reduce((a, b) => a! + b!, 0)! / available.length);
  let band = 'ai_developing';
  if (overall >= 80) band = 'ai_native';
  else if (overall >= 65) band = 'ai_proficient';
  else if (overall >= 45) band = 'ai_developing';
  else if (overall > 0) band = 'ai_resistant';

  const upskills = overall < 50 ? ['AI for Everyone (Coursera)','Digital Literacy Fundamentals','Prompt Engineering Basics'] : overall < 70 ? ['AI-Augmented Workflows','Advanced Prompt Engineering','AI Tool Certification'] : ['AI Strategy for Leaders','Generative AI Architecture','AI Ethics and Governance'];

  await pool.query(`INSERT INTO frp_ai_readiness_scores(user_email,overall_ai_readiness,ai_literacy_score,digital_fluency_score,learning_agility_score,adaptation_score,ai_readiness_band,recommended_ai_upskills) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_email) DO UPDATE SET overall_ai_readiness=$2,ai_literacy_score=$3,digital_fluency_score=$4,learning_agility_score=$5,adaptation_score=$6,ai_readiness_band=$7,recommended_ai_upskills=$8,computed_at=NOW()`,
    [email, overall, aiLiteracy, digitalFluency, learningAgility, adaptation, band, upskills]).catch(() => {});

  return { user_email: email, overall_ai_readiness: overall, ai_literacy_score: aiLiteracy, digital_fluency_score: digitalFluency, learning_agility_score: learningAgility, adaptation_score: adaptation, ai_readiness_band: band, recommended_ai_upskills: upskills };
}

export function registerTalentFRPEnrichmentRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).then(() => seedFRPEnrichment(pool)).catch(() => {});

  // GET /api/admin/frp/automation-risk — all RF automation risks
  app.get('/api/admin/frp/automation-risk', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('automation_risk');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [rows, summary] = await Promise.all([
        pool.query("SELECT * FROM frp_automation_risk ORDER BY risk_score DESC NULLS LAST"),
        pool.query(`SELECT COUNT(*) FILTER (WHERE risk_band IN ('very_high','high')) as high_risk_rfs, COUNT(*) FILTER (WHERE risk_band IN ('low','very_low')) as low_risk_rfs, ROUND(AVG(risk_score)::numeric,3) as avg_risk_score FROM frp_automation_risk`),
      ]);
      const result = { automation_risks: rows.rows, summary: summary.rows[0] };
      setCache('automation_risk', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/frp/automation-risk/:rf_name — single RF automation risk
  app.get('/api/admin/frp/automation-risk/:rf_name', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const rfName = decodeURIComponent(req.params.rf_name);
      const r = await pool.query('SELECT * FROM frp_automation_risk WHERE rf_name=$1', [rfName]);
      if (!r.rows[0]) return res.status(404).json({ error: 'RF not found' });
      const futuremap = await pool.query('SELECT * FROM frp_future_competency_map WHERE blueprint_key=$1 ORDER BY time_horizon_years', [r.rows[0].blueprint_key]);
      res.json({ automation_risk: r.rows[0], future_competency_transitions: futuremap.rows });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/frp/ai-readiness — all user AI readiness scores
  app.get('/api/admin/frp/ai-readiness', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('ai_readiness_list');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [rows, dist, kpi] = await Promise.all([
        pool.query('SELECT * FROM frp_ai_readiness_scores ORDER BY overall_ai_readiness DESC LIMIT 100'),
        pool.query('SELECT ai_readiness_band, COUNT(*) as cnt FROM frp_ai_readiness_scores GROUP BY ai_readiness_band ORDER BY cnt DESC'),
        pool.query(`SELECT COUNT(*)::int as total, ROUND(AVG(overall_ai_readiness)::numeric,1) as avg_ai_readiness, COUNT(*) FILTER (WHERE ai_readiness_band IN ('ai_native','ai_proficient')) as ai_ready_count FROM frp_ai_readiness_scores`),
      ]);
      const result = { scores: rows.rows, band_distribution: dist.rows, kpi: kpi.rows[0] };
      setCache('ai_readiness_list', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // POST /api/frp/ai-readiness/compute/:email — compute for user
  app.post('/api/frp/ai-readiness/compute/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const result = await computeAIReadiness(pool, email);
      bustCache(); res.json({ ok: true, ...result });
    } catch (err) { res.status(500).json({ error: 'compute failed' }); }
  });

  // POST /api/admin/frp/ai-readiness/compute-all
  app.post('/api/admin/frp/ai-readiness/compute-all', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'AI readiness computation started' });
    (async () => {
      const users = await pool.query('SELECT DISTINCT user_email FROM talent_role_scores LIMIT 500').catch(() => ({ rows: [] }));
      let done = 0;
      for (const u of users.rows) { try { await computeAIReadiness(pool, u.user_email); done++; } catch { /* skip */ } }
      console.log(`[frp-enrichment] AI readiness computed for ${done} users`);
    })();
  });

  // GET /api/admin/frp/future-competency-map — future competency transitions
  app.get('/api/admin/frp/future-competency-map', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('future_comp_map');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { blueprint_key } = req.query as Record<string, string>;
      const rows = await pool.query(`SELECT * FROM frp_future_competency_map ${blueprint_key ? 'WHERE blueprint_key=$1' : ''} ORDER BY time_horizon_years, critical_for_future DESC`, blueprint_key ? [blueprint_key] : []);
      const result = { transitions: rows.rows, count: rows.rows.length };
      setCache('future_comp_map', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/frp/future-readiness-report/:email — user future readiness summary
  app.get('/api/frp/future-readiness-report/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const [aiReadiness, scores, automationRisks] = await Promise.all([
        pool.query('SELECT * FROM frp_ai_readiness_scores WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
        pool.query('SELECT rf_name FROM talent_role_scores WHERE user_email=$1 ORDER BY composite_score DESC LIMIT 5', [email]).catch(() => ({ rows: [] })),
        pool.query('SELECT rf_name, automation_risk_level, automation_risk_score, mitigation_strategies FROM frp_automation_risk WHERE rf_name=ANY($1) ORDER BY automation_risk_score DESC', [scores.rows.map((s: any) => s.rf_name)]).catch(() => ({ rows: [] })),
      ]);
      const futureMaps = await pool.query('SELECT * FROM frp_future_competency_map WHERE blueprint_key=ANY($1) AND critical_for_future=true ORDER BY time_horizon_years', [['executive_leadership','software_engineering','data_science']]).catch(() => ({ rows: [] }));
      res.json({ email, ai_readiness: aiReadiness.rows[0] || null, automation_risks: automationRisks.rows, future_competency_transitions: futureMaps.rows, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-frp-enrichment] D13 routes registered — automation risk/AI readiness/future competency map seeded');
}

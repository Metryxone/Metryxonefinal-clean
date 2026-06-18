/**
 * Talent Foundation — Phase 2: Role Level Profiles
 * Career level definitions within each role family.
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

const LEVELS = ['junior', 'mid', 'senior', 'lead', 'executive'] as const;
type Level = typeof LEVELS[number];

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rp_level_profiles (
        id SERIAL PRIMARY KEY,
        rf_id INTEGER NOT NULL REFERENCES rf_master(id) ON DELETE CASCADE,
        level TEXT NOT NULL CHECK (level IN ('junior','mid','senior','lead','executive')),
        title_examples TEXT[] DEFAULT '{}',
        experience_years_min INTEGER DEFAULT 0,
        experience_years_max INTEGER,
        key_responsibilities TEXT[] DEFAULT '{}',
        must_have_skills TEXT[] DEFAULT '{}',
        nice_to_have_skills TEXT[] DEFAULT '{}',
        competency_thresholds JSONB DEFAULT '{}',
        salary_band_min INTEGER,
        salary_band_max INTEGER,
        headcount_ratio NUMERIC(4,2) DEFAULT 1.0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(rf_id, level)
      );
      CREATE INDEX IF NOT EXISTS idx_rp_level_rf_id ON rp_level_profiles(rf_id);
    `);
    schemaReady = true;
    console.log('[talent-level-profiles] schema ready');
    await seedLevelProfiles(pool);
  } catch (e) {
    console.error('[talent-level-profiles] ensureSchema error:', e);
  }
}

const LEVEL_CONFIG: Record<Level, { yMin: number; yMax: number | null; ratio: number }> = {
  junior:    { yMin: 0,  yMax: 2,    ratio: 3.0 },
  mid:       { yMin: 2,  yMax: 5,    ratio: 2.5 },
  senior:    { yMin: 5,  yMax: 8,    ratio: 1.5 },
  lead:      { yMin: 8,  yMax: 12,   ratio: 0.8 },
  executive: { yMin: 12, yMax: null, ratio: 0.2 },
};

const THRESHOLD_BY_LEVEL: Record<Level, number> = {
  junior: 35, mid: 50, senior: 65, lead: 78, executive: 88,
};

const RF_SEED: Array<{
  name: string;
  levels: Record<Level, { titles: string[]; responsibilities: string[]; must: string[]; nice: string[]; salMin: number; salMax: number }>;
}> = [
  {
    name: 'Software Engineering',
    levels: {
      junior:    { titles: ['Junior Developer','Associate Engineer','Graduate Engineer'], responsibilities: ['Write clean code to spec','Fix bugs and write tests','Participate in code review'], must: ['Programming fundamentals','Version control (Git)','Basic debugging'], nice: ['CI/CD basics','Cloud fundamentals'], salMin: 400000, salMax: 700000 },
      mid:       { titles: ['Software Engineer','Backend Engineer','Full Stack Developer'], responsibilities: ['Design and implement features','Lead technical discussions','Mentor juniors'], must: ['System design basics','Testing practices','API design'], nice: ['Cloud services','Performance optimisation'], salMin: 700000, salMax: 1200000 },
      senior:    { titles: ['Senior Engineer','Senior Software Developer','Staff Engineer'], responsibilities: ['Architect scalable solutions','Drive technical standards','Cross-team collaboration'], must: ['Distributed systems','Advanced architecture patterns','Technical leadership'], nice: ['ML/AI fundamentals','Security engineering'], salMin: 1200000, salMax: 2000000 },
      lead:      { titles: ['Tech Lead','Principal Engineer','Engineering Manager'], responsibilities: ['Own technical roadmap','Build and grow the team','Align engineering with business'], must: ['Team leadership','Strategic technical planning','Stakeholder management'], nice: ['P&L awareness','External partnerships'], salMin: 2000000, salMax: 3200000 },
      executive: { titles: ['VP Engineering','CTO','Engineering Director'], responsibilities: ['Set engineering vision','Drive org-wide transformation','Board and investor communication'], must: ['Executive leadership','Enterprise architecture vision','M&A technical diligence'], nice: ['IPO readiness','Global delivery models'], salMin: 3200000, salMax: 6000000 },
    },
  },
  {
    name: 'Data Science & Analytics',
    levels: {
      junior:    { titles: ['Junior Data Analyst','Data Analyst','Associate Data Scientist'], responsibilities: ['Clean and explore datasets','Build dashboards and reports','Support senior analysts'], must: ['SQL','Excel/Python basics','Data visualisation'], nice: ['Statistics basics','BI tools'], salMin: 350000, salMax: 650000 },
      mid:       { titles: ['Data Scientist','Analytics Engineer','ML Engineer'], responsibilities: ['Build predictive models','Design data pipelines','Translate data to business insights'], must: ['Machine learning','Python/R proficiency','Statistical analysis'], nice: ['Deep learning','A/B testing'], salMin: 700000, salMax: 1300000 },
      senior:    { titles: ['Senior Data Scientist','Lead Data Engineer','Principal Analyst'], responsibilities: ['Architect data platforms','Define modelling strategies','Influence product decisions with data'], must: ['MLOps','Advanced ML algorithms','Data governance'], nice: ['Causal inference','NLP/Computer Vision'], salMin: 1300000, salMax: 2200000 },
      lead:      { titles: ['Head of Analytics','Data Science Manager','Principal Data Scientist'], responsibilities: ['Build data science capability','Set analytics strategy','Partner with executive leadership'], must: ['Team leadership','Analytics strategy','Roadmap ownership'], nice: ['Data monetisation','AI product strategy'], salMin: 2200000, salMax: 3500000 },
      executive: { titles: ['Chief Data Officer','VP Data Science','Director of AI'], responsibilities: ['Enterprise data strategy','AI governance and ethics','Board-level data reporting'], must: ['Executive leadership','AI/data strategy','Regulatory data compliance'], nice: ['Data product commercialisation','Global data ops'], salMin: 3500000, salMax: 7000000 },
    },
  },
  {
    name: 'Product Management',
    levels: {
      junior:    { titles: ['Associate Product Manager','Product Analyst','Junior PM'], responsibilities: ['Support product discovery','Write user stories','Manage backlog hygiene'], must: ['User research basics','Agile/Scrum','Data-driven mindset'], nice: ['Wireframing tools','SQL basics'], salMin: 450000, salMax: 750000 },
      mid:       { titles: ['Product Manager','Digital Product Manager'], responsibilities: ['Own product roadmap','Drive cross-functional delivery','Define OKRs and track metrics'], must: ['Product strategy','Stakeholder management','Go-to-market planning'], nice: ['A/B testing','Competitive analysis'], salMin: 800000, salMax: 1400000 },
      senior:    { titles: ['Senior PM','Group Product Manager','Principal PM'], responsibilities: ['Lead multiple product lines','Influence engineering and design','Mentor junior PMs'], must: ['Platform thinking','Executive communication','Market analysis'], nice: ['Pricing strategy','Partnership development'], salMin: 1400000, salMax: 2400000 },
      lead:      { titles: ['Director of Product','VP Product Management','Head of Product'], responsibilities: ['Set product vision and strategy','Build high-performing PM team','Drive revenue through product'], must: ['Product portfolio management','P&L ownership','Board-level communication'], nice: ['M&A product integration','Platform ecosystem strategy'], salMin: 2400000, salMax: 4000000 },
      executive: { titles: ['Chief Product Officer','EVP Product','Chief Experience Officer'], responsibilities: ['Company-wide product vision','Investor and board engagement','Market category leadership'], must: ['Executive leadership','Global product strategy','Innovation pipeline management'], nice: ['IPO/M&A readiness','Ecosystem partnerships'], salMin: 4000000, salMax: 8000000 },
    },
  },
  {
    name: 'Sales Leadership',
    levels: {
      junior:    { titles: ['Sales Development Rep','Business Development Rep','Inside Sales Rep'], responsibilities: ['Prospect and qualify leads','Meet activity targets','Maintain CRM hygiene'], must: ['Communication skills','Cold outreach','CRM basics (Salesforce)'], nice: ['Industry knowledge','Social selling'], salMin: 300000, salMax: 600000 },
      mid:       { titles: ['Account Executive','Sales Executive','Business Development Manager'], responsibilities: ['Manage full sales cycle','Close deals against quota','Build client relationships'], must: ['Consultative selling','Negotiation','Pipeline management'], nice: ['Solution selling','Enterprise sales'], salMin: 600000, salMax: 1200000 },
      senior:    { titles: ['Senior AE','Regional Sales Manager','Enterprise Account Manager'], responsibilities: ['Manage strategic accounts','Coach junior reps','Drive regional revenue'], must: ['Enterprise deal management','Revenue forecasting','Team leadership'], nice: ['Partner ecosystem management','Executive selling'], salMin: 1200000, salMax: 2200000 },
      lead:      { titles: ['Head of Sales','VP Sales','Sales Director'], responsibilities: ['Build and scale sales team','Own revenue targets','Develop go-to-market strategy'], must: ['Sales operations','Team building','GTM strategy'], nice: ['International expansion','Investor reporting'], salMin: 2200000, salMax: 4000000 },
      executive: { titles: ['Chief Revenue Officer','EVP Sales','Global Head of Sales'], responsibilities: ['Company revenue strategy','Board-level commercial reporting','M&A commercial diligence'], must: ['Executive leadership','Global sales operations','Board communication'], nice: ['Category creation','PE/VC commercial leadership'], salMin: 4000000, salMax: 8000000 },
    },
  },
  {
    name: 'Customer Success',
    levels: {
      junior:    { titles: ['Customer Success Associate','Onboarding Specialist','Support Analyst'], responsibilities: ['Onboard new customers','Handle basic escalations','Track health scores'], must: ['Customer communication','Product knowledge','CRM basics'], nice: ['Data analysis','Training delivery'], salMin: 300000, salMax: 550000 },
      mid:       { titles: ['Customer Success Manager','Account Manager','Client Success Manager'], responsibilities: ['Manage account portfolio','Drive adoption and expansion','Prevent churn proactively'], must: ['Relationship management','Success planning','Upsell/cross-sell techniques'], nice: ['Business reviews','Health scoring systems'], salMin: 550000, salMax: 1000000 },
      senior:    { titles: ['Senior CSM','Strategic CSM','Enterprise Success Manager'], responsibilities: ['Manage strategic enterprise accounts','Influence product roadmap with customer feedback','Mentor junior CSMs'], must: ['Executive relationship management','ROI articulation','Renewal negotiation'], nice: ['Customer advisory board management','Success maturity models'], salMin: 1000000, salMax: 1800000 },
      lead:      { titles: ['Head of Customer Success','Director of CS','VP Customer Success'], responsibilities: ['Build CS team and playbooks','Own NRR and churn metrics','Partner with Sales and Product'], must: ['Team leadership','CS operations','Retention strategy'], nice: ['Community building','CS tooling strategy'], salMin: 1800000, salMax: 3200000 },
      executive: { titles: ['Chief Customer Officer','EVP Customer Experience'], responsibilities: ['Company-wide customer strategy','Board-level retention reporting','Customer-led growth initiatives'], must: ['Executive leadership','CX strategy','Commercial acumen'], nice: ['Customer data monetisation','Global CS operations'], salMin: 3200000, salMax: 6000000 },
    },
  },
  {
    name: 'Operations Management',
    levels: {
      junior:    { titles: ['Operations Analyst','Operations Associate','Process Analyst'], responsibilities: ['Support daily operations','Analyse operational data','Document processes'], must: ['Data analysis','Process documentation','Excel/Google Sheets'], nice: ['Lean basics','Project coordination'], salMin: 300000, salMax: 550000 },
      mid:       { titles: ['Operations Manager','Process Manager','Supply Chain Manager'], responsibilities: ['Manage operational workflows','Drive process improvements','Coordinate cross-functional teams'], must: ['Process optimisation','Team coordination','KPI management'], nice: ['ERP systems','Lean Six Sigma'], salMin: 600000, salMax: 1100000 },
      senior:    { titles: ['Senior Operations Manager','Head of Operations','Supply Chain Director'], responsibilities: ['Own operational P&L','Lead improvement projects','Build operational capability'], must: ['Operations strategy','Advanced analytics','Change management'], nice: ['Automation/RPA','International operations'], salMin: 1100000, salMax: 2000000 },
      lead:      { titles: ['VP Operations','Operations Director','COO (SME)'], responsibilities: ['Set operational vision','Drive organisation-wide efficiency','Report to executive team'], must: ['Executive leadership','Operations transformation','Board communication'], nice: ['M&A integration','Global supply chain'], salMin: 2000000, salMax: 3800000 },
      executive: { titles: ['Chief Operating Officer','EVP Operations'], responsibilities: ['Company operational strategy','Board and investor reporting','Enterprise transformation'], must: ['Executive leadership','Enterprise operations','Strategic transformation'], nice: ['PE portfolio operations','Global delivery'], salMin: 3800000, salMax: 8000000 },
    },
  },
  {
    name: 'Finance & Accounting',
    levels: {
      junior:    { titles: ['Junior Accountant','Finance Analyst','Accounts Executive'], responsibilities: ['Bookkeeping and reconciliation','Support month-end close','Prepare basic reports'], must: ['Accounting fundamentals','Tally/ERP basics','Excel'], nice: ['GST/TDS basics','Financial modelling basics'], salMin: 280000, salMax: 520000 },
      mid:       { titles: ['Finance Manager','Senior Accountant','Financial Analyst'], responsibilities: ['Lead month-end close','Prepare financial statements','Support budgeting'], must: ['Financial reporting','Tax compliance','Budget management'], nice: ['Financial modelling','ERP systems'], salMin: 600000, salMax: 1100000 },
      senior:    { titles: ['Senior Finance Manager','Controller','Finance Business Partner'], responsibilities: ['Own financial planning and analysis','Drive cost optimisation','Support strategic decisions with financial insight'], must: ['Advanced financial modelling','Management accounting','Regulatory reporting'], nice: ['M&A financial diligence','International accounting'], salMin: 1100000, salMax: 2000000 },
      lead:      { titles: ['Finance Director','Head of Finance','CFO (SME)'], responsibilities: ['Set financial strategy','Own investor relations','Lead finance function'], must: ['Strategic finance','Board reporting','Capital markets'], nice: ['IPO readiness','PE-backed finance'], salMin: 2000000, salMax: 3800000 },
      executive: { titles: ['Chief Financial Officer','EVP Finance'], responsibilities: ['Company financial strategy','Board and investor engagement','M&A and capital allocation'], must: ['Executive leadership','Capital markets expertise','Corporate governance'], nice: ['Public company experience','Global treasury'], salMin: 3800000, salMax: 8000000 },
    },
  },
  {
    name: 'Human Resources & People',
    levels: {
      junior:    { titles: ['HR Executive','Talent Acquisition Coordinator','People Operations Analyst'], responsibilities: ['Coordinate recruitment process','Maintain HRMS data','Support onboarding'], must: ['HR fundamentals','Communication skills','HRMS basics'], nice: ['Labour law basics','Employer branding'], salMin: 280000, salMax: 520000 },
      mid:       { titles: ['HR Manager','Talent Acquisition Manager','People Business Partner'], responsibilities: ['Drive recruitment and retention','Manage employee lifecycle','Support culture initiatives'], must: ['HR policies','Talent acquisition','Performance management'], nice: ['HRBP methodology','People analytics'], salMin: 600000, salMax: 1100000 },
      senior:    { titles: ['Senior HR Manager','HR Business Partner','Learning & Development Manager'], responsibilities: ['Drive people strategy for a business unit','Lead L&D programmes','Support leadership development'], must: ['Strategic HRBP','Change management','Compensation & benefits'], nice: ['OD interventions','HR analytics'], salMin: 1100000, salMax: 2000000 },
      lead:      { titles: ['HR Director','Head of People','VP Human Resources'], responsibilities: ['Own talent strategy','Build people culture','Report to executive team'], must: ['People strategy','Executive partnership','HR transformation'], nice: ['Global HR','DEI strategy'], salMin: 2000000, salMax: 3500000 },
      executive: { titles: ['Chief People Officer','CHRO','EVP People & Culture'], responsibilities: ['Company people strategy','Board-level workforce reporting','Culture and values leadership'], must: ['Executive leadership','Workforce strategy','Board communication'], nice: ['Global people operations','Future of work strategy'], salMin: 3500000, salMax: 7000000 },
    },
  },
  {
    name: 'Marketing & Growth',
    levels: {
      junior:    { titles: ['Marketing Executive','Growth Analyst','Digital Marketing Associate'], responsibilities: ['Execute campaigns','Track performance metrics','Create content assets'], must: ['Digital marketing fundamentals','Analytics tools','Content creation'], nice: ['SEO/SEM basics','Social media strategy'], salMin: 300000, salMax: 600000 },
      mid:       { titles: ['Marketing Manager','Growth Manager','Brand Manager'], responsibilities: ['Plan and execute marketing strategy','Manage agency relationships','Own campaign budgets'], must: ['Campaign management','Brand management','Data-driven marketing'], nice: ['Marketing automation','Partnership marketing'], salMin: 650000, salMax: 1200000 },
      senior:    { titles: ['Senior Marketing Manager','Head of Growth','Product Marketing Manager'], responsibilities: ['Drive demand generation strategy','Own marketing P&L','Lead cross-functional campaigns'], must: ['Growth strategy','Marketing analytics','GTM planning'], nice: ['ABM strategy','International marketing'], salMin: 1200000, salMax: 2200000 },
      lead:      { titles: ['Marketing Director','VP Marketing','Head of Brand'], responsibilities: ['Set marketing vision','Own brand strategy','Build marketing team'], must: ['Marketing leadership','Revenue-led marketing','Team building'], nice: ['IPO marketing','Category creation'], salMin: 2200000, salMax: 4000000 },
      executive: { titles: ['Chief Marketing Officer','EVP Marketing'], responsibilities: ['Company marketing strategy','Board-level brand reporting','Market category leadership'], must: ['Executive leadership','Global brand strategy','P&L ownership'], nice: ['Public company CMO experience','M&A brand integration'], salMin: 4000000, salMax: 8000000 },
    },
  },
  {
    name: 'Executive Leadership',
    levels: {
      junior:    { titles: ['Business Analyst','Strategy Analyst','Chief of Staff Analyst'], responsibilities: ['Support strategy projects','Prepare board presentations','Competitive research'], must: ['Business analysis','Presentation skills','Stakeholder communication'], nice: ['Financial modelling','Consulting toolkit'], salMin: 500000, salMax: 900000 },
      mid:       { titles: ['Strategy Manager','Chief of Staff','Business Development Manager'], responsibilities: ['Lead strategic initiatives','Manage board communications','Drive cross-functional programmes'], must: ['Strategic thinking','Executive communication','Project leadership'], nice: ['M&A basics','Investor relations'], salMin: 1000000, salMax: 1800000 },
      senior:    { titles: ['Senior Strategy Manager','Head of Strategy','Director Strategy'], responsibilities: ['Own strategic planning process','Advise C-suite','Drive M&A and partnerships'], must: ['Corporate strategy','Executive advisory','Capital allocation'], nice: ['Board management','PE-backed leadership'], salMin: 1800000, salMax: 3200000 },
      lead:      { titles: ['VP Strategy','Managing Director','Business Unit Head'], responsibilities: ['Lead business unit P&L','Set unit strategy','Report to CEO'], must: ['P&L management','Board communication','Organisational leadership'], nice: ['M&A integration','Global operations'], salMin: 3200000, salMax: 6000000 },
      executive: { titles: ['CEO','MD','Country Head','President'], responsibilities: ['Company vision and strategy','Board and investor leadership','Stakeholder management'], must: ['Executive leadership','Corporate governance','Capital markets'], nice: ['Public company experience','Global leadership'], salMin: 6000000, salMax: 15000000 },
    },
  },
  {
    name: 'Manufacturing Operations',
    levels: {
      junior:    { titles: ['Production Executive','Quality Analyst','Manufacturing Associate'], responsibilities: ['Monitor production lines','Maintain quality records','Support shift supervisors'], must: ['Manufacturing basics','Quality control','Safety awareness'], nice: ['Lean tools (5S)','ERP basics'], salMin: 240000, salMax: 450000 },
      mid:       { titles: ['Production Manager','Quality Manager','Plant Manager (small)'], responsibilities: ['Manage shift operations','Drive OEE improvement','Coordinate maintenance'], must: ['Production planning','Lean/Six Sigma','Team management'], nice: ['TPM','APQP'], salMin: 500000, salMax: 950000 },
      senior:    { titles: ['Senior Plant Manager','Manufacturing Excellence Manager','Operations Head'], responsibilities: ['Run end-to-end plant operations','Drive continuous improvement','Manage vendor relationships'], must: ['Plant P&L','Advanced lean','Supply chain coordination'], nice: ['Industry 4.0','ISO/TS certifications'], salMin: 950000, salMax: 1800000 },
      lead:      { titles: ['Plant Director','VP Manufacturing','Head of Operations'], responsibilities: ['Multi-plant oversight','Capital investment decisions','Workforce strategy'], must: ['Multi-site operations','CapEx planning','Executive reporting'], nice: ['Global manufacturing','M&A plant integration'], salMin: 1800000, salMax: 3500000 },
      executive: { titles: ['Chief Operations Officer','EVP Manufacturing'], responsibilities: ['Global manufacturing strategy','Board operations reporting','Sustainability and ESG in operations'], must: ['Executive leadership','Global operations','ESG compliance'], nice: ['Industry 4.0 transformation','Global supply chain'], salMin: 3500000, salMax: 7000000 },
    },
  },
  {
    name: 'Project & Programme Management',
    levels: {
      junior:    { titles: ['Project Coordinator','PMO Analyst','Junior Project Manager'], responsibilities: ['Maintain project plans','Track milestones','Prepare status reports'], must: ['Project management basics','MS Project/Jira','Communication skills'], nice: ['Agile/Scrum basics','Risk tracking'], salMin: 300000, salMax: 580000 },
      mid:       { titles: ['Project Manager','Programme Coordinator','Scrum Master'], responsibilities: ['Lead project delivery','Manage project budget','Coordinate stakeholders'], must: ['Project lifecycle management','Risk management','Budget tracking'], nice: ['PMP/PRINCE2','Stakeholder mapping'], salMin: 600000, salMax: 1100000 },
      senior:    { titles: ['Senior PM','Programme Manager','Delivery Manager'], responsibilities: ['Manage complex programmes','Govern multiple projects','Drive PMO standards'], must: ['Programme governance','Change management','Executive reporting'], nice: ['Agile at scale','Vendor management'], salMin: 1100000, salMax: 2000000 },
      lead:      { titles: ['PMO Head','Director of Projects','VP Delivery'], responsibilities: ['Build and run PMO','Set delivery standards','Own portfolio outcomes'], must: ['PMO leadership','Portfolio management','Transformation delivery'], nice: ['PPM tooling strategy','M&A programme integration'], salMin: 2000000, salMax: 3800000 },
      executive: { titles: ['Chief Transformation Officer','EVP Programme Delivery'], responsibilities: ['Enterprise transformation strategy','Board-level programme reporting','Organisational change leadership'], must: ['Executive leadership','Enterprise change management','Board communication'], nice: ['Digital transformation','Global programme delivery'], salMin: 3800000, salMax: 7000000 },
    },
  },
  {
    name: 'Legal & Compliance',
    levels: {
      junior:    { titles: ['Legal Executive','Compliance Analyst','Junior Lawyer'], responsibilities: ['Draft basic contracts','Monitor regulatory updates','Maintain compliance records'], must: ['Contract basics','Legal research','Regulatory awareness'], nice: ['Corporate law basics','LLB/LLM'], salMin: 350000, salMax: 650000 },
      mid:       { titles: ['Legal Manager','Compliance Manager','In-House Counsel'], responsibilities: ['Draft and review contracts','Manage regulatory filings','Advise on business legal matters'], must: ['Contract negotiation','Regulatory compliance','Legal advisory'], nice: ['SEBI/RBI regulations','Data privacy law'], salMin: 700000, salMax: 1300000 },
      senior:    { titles: ['Senior Legal Counsel','Head of Compliance','Principal Counsel'], responsibilities: ['Own legal risk for a business unit','Manage litigation','Lead regulatory engagement'], must: ['Litigation management','Regulatory strategy','Executive legal advisory'], nice: ['International law','M&A legal diligence'], salMin: 1300000, salMax: 2400000 },
      lead:      { titles: ['General Counsel','Legal Director','Head of Legal & Compliance'], responsibilities: ['Own company legal strategy','Board governance','Manage legal team'], must: ['Corporate governance','Board advisory','Legal team leadership'], nice: ['IPO legal readiness','Global legal operations'], salMin: 2400000, salMax: 4500000 },
      executive: { titles: ['Chief Legal Officer','CLO','Company Secretary'], responsibilities: ['Company legal strategy','Board secretarial','Regulatory and government relations'], must: ['Executive leadership','Corporate law','Board management'], nice: ['Public company CLO experience','International arbitration'], salMin: 4500000, salMax: 8000000 },
    },
  },
  {
    name: 'Research & Innovation',
    levels: {
      junior:    { titles: ['Research Associate','Innovation Analyst','R&D Associate'], responsibilities: ['Conduct literature reviews','Support experiments','Document research findings'], must: ['Research methodology','Technical writing','Data collection'], nice: ['Patent awareness','Domain specialisation'], salMin: 350000, salMax: 650000 },
      mid:       { titles: ['Research Scientist','Innovation Manager','R&D Manager'], responsibilities: ['Design and conduct research','Publish findings','Collaborate with academia'], must: ['Experimental design','Technical analysis','Grant writing'], nice: ['IP management','Industry partnerships'], salMin: 700000, salMax: 1400000 },
      senior:    { titles: ['Senior Scientist','Principal Researcher','Innovation Lead'], responsibilities: ['Lead research programmes','Drive IP strategy','Advise product on innovation'], must: ['Research leadership','IP portfolio','Technology scouting'], nice: ['Start-up collaboration','Government grants'], salMin: 1400000, salMax: 2600000 },
      lead:      { titles: ['R&D Director','Head of Innovation','Chief Scientist'], responsibilities: ['Own R&D roadmap','Build innovation culture','Board science advisory'], must: ['R&D P&L','Technology strategy','Academic partnerships'], nice: ['Spin-out creation','CVC investment thesis'], salMin: 2600000, salMax: 5000000 },
      executive: { titles: ['Chief Technology Officer','Chief Innovation Officer','EVP R&D'], responsibilities: ['Company innovation strategy','Technology horizon scanning','Board technology reporting'], must: ['Executive leadership','Technology strategy','Innovation ecosystem'], nice: ['Deep tech commercialisation','Global R&D network'], salMin: 5000000, salMax: 10000000 },
    },
  },
  {
    name: 'Healthcare Clinical',
    levels: {
      junior:    { titles: ['Junior Doctor','Resident','Clinical Officer'], responsibilities: ['Patient history and examination','Support senior clinicians','Maintain clinical records'], must: ['Clinical assessment','Patient communication','Medical knowledge'], nice: ['EMR systems','Clinical protocols'], salMin: 500000, salMax: 900000 },
      mid:       { titles: ['Medical Officer','Registrar','Clinician'], responsibilities: ['Independent patient management','Perform clinical procedures','Contribute to ward rounds'], must: ['Clinical decision-making','Procedural competency','Team collaboration'], nice: ['Specialty certification','Research participation'], salMin: 900000, salMax: 1600000 },
      senior:    { titles: ['Senior Registrar','Consultant','Specialist'], responsibilities: ['Lead patient care teams','Mentor junior doctors','Drive clinical quality'], must: ['Clinical leadership','Specialty expertise','Quality improvement'], nice: ['Academic research','National committee participation'], salMin: 1600000, salMax: 3000000 },
      lead:      { titles: ['Head of Department','Clinical Director','Medical Director (unit)'], responsibilities: ['Manage clinical department','Set clinical standards','Engage with hospital management'], must: ['Clinical management','Department P&L','Medical governance'], nice: ['Hospital strategy','Academic leadership'], salMin: 3000000, salMax: 5500000 },
      executive: { titles: ['Medical Superintendent','Chief Medical Officer','Hospital Director'], responsibilities: ['Hospital clinical strategy','Board medical reporting','Regulatory and accreditation'], must: ['Executive leadership','Healthcare governance','Quality and patient safety strategy'], nice: ['NABH/JCI accreditation','Hospital network leadership'], salMin: 5500000, salMax: 12000000 },
    },
  },
];

async function seedLevelProfiles(pool: Pool): Promise<void> {
  try {
    const { rows: ex } = await pool.query('SELECT COUNT(*) FROM rp_level_profiles');
    if (Number(ex[0].count) > 0) return;

    const { rows: rfRows } = await pool.query('SELECT id, name FROM rf_master');
    const rfByName: Record<string, number> = {};
    rfRows.forEach((r: any) => { rfByName[r.name] = r.id; });

    for (const rf of RF_SEED) {
      const rfId = rfByName[rf.name];
      if (!rfId) continue;
      for (const level of LEVELS) {
        const cfg = LEVEL_CONFIG[level];
        const lvl = rf.levels[level];
        const threshold = THRESHOLD_BY_LEVEL[level];
        await pool.query(
          `INSERT INTO rp_level_profiles(rf_id,level,title_examples,experience_years_min,experience_years_max,key_responsibilities,must_have_skills,nice_to_have_skills,competency_thresholds,salary_band_min,salary_band_max,headcount_ratio)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(rf_id,level) DO NOTHING`,
          [rfId, level, lvl.titles, cfg.yMin, cfg.yMax, lvl.responsibilities, lvl.must, lvl.nice,
           JSON.stringify({ primary_blueprint: threshold, secondary_blueprint: Math.max(25, threshold - 15) }),
           lvl.salMin, lvl.salMax, cfg.ratio]
        );
      }
    }
    console.log('[talent-level-profiles] seed complete — 75 level profiles');
  } catch (e) {
    console.error('[talent-level-profiles] seed error:', e);
  }
}

function gate(res: Response): boolean {
  if (!flagOn()) { res.status(503).json({ error: 'Feature not enabled' }); return false; }
  return true;
}

export function registerTalentLevelProfileRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  app.use(async (_req, _res, next) => { await ensureSchema(pool); next(); });

  // ── User reads ─────────────────────────────────────────────────────────────
  app.get('/api/talent/role-families/:rfId/level-profiles', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const rfId = parseInt(req.params.rfId);
      if (isNaN(rfId)) return void res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(`SELECT * FROM rp_level_profiles WHERE rf_id=$1 AND is_active=true ORDER BY CASE level WHEN 'junior' THEN 1 WHEN 'mid' THEN 2 WHEN 'senior' THEN 3 WHEN 'lead' THEN 4 WHEN 'executive' THEN 5 END`, [rfId]);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Admin reads ────────────────────────────────────────────────────────────
  app.get('/api/admin/talent/level-profiles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const rfId = req.query.rf_id ? parseInt(req.query.rf_id as string) : null;
      const level = req.query.level as string | undefined;
      let q = `SELECT lp.*, rf.name AS rf_name FROM rp_level_profiles lp JOIN rf_master rf ON rf.id=lp.rf_id WHERE 1=1`;
      const params: any[] = [];
      if (rfId) { params.push(rfId); q += ` AND lp.rf_id=$${params.length}`; }
      if (level) { params.push(level); q += ` AND lp.level=$${params.length}`; }
      q += ` ORDER BY rf.name, CASE lp.level WHEN 'junior' THEN 1 WHEN 'mid' THEN 2 WHEN 'senior' THEN 3 WHEN 'lead' THEN 4 WHEN 'executive' THEN 5 END`;
      const { rows } = await pool.query(q, params);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/admin/talent/level-profiles/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query('SELECT lp.*, rf.name AS rf_name FROM rp_level_profiles lp JOIN rf_master rf ON rf.id=lp.rf_id WHERE lp.id=$1', [id]);
      if (!rows.length) return void res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/talent/level-profiles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rf_id, level, title_examples, experience_years_min, experience_years_max, key_responsibilities, must_have_skills, nice_to_have_skills, competency_thresholds, salary_band_min, salary_band_max } = req.body;
      if (!rf_id || !level) return void res.status(400).json({ error: 'rf_id and level required' });
      if (!LEVELS.includes(level)) return void res.status(400).json({ error: `level must be one of: ${LEVELS.join(', ')}` });
      const { rows } = await pool.query(
        `INSERT INTO rp_level_profiles(rf_id,level,title_examples,experience_years_min,experience_years_max,key_responsibilities,must_have_skills,nice_to_have_skills,competency_thresholds,salary_band_min,salary_band_max)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [rf_id, level, title_examples||[], experience_years_min||0, experience_years_max, key_responsibilities||[], must_have_skills||[], nice_to_have_skills||[], JSON.stringify(competency_thresholds||{}), salary_band_min, salary_band_max]
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return void res.status(409).json({ error: 'Level profile already exists for this role family + level' });
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.put('/api/admin/talent/level-profiles/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      const { title_examples, experience_years_min, experience_years_max, key_responsibilities, must_have_skills, nice_to_have_skills, competency_thresholds, salary_band_min, salary_band_max, is_active } = req.body;
      const { rows } = await pool.query(
        `UPDATE rp_level_profiles SET title_examples=$1,experience_years_min=$2,experience_years_max=$3,key_responsibilities=$4,must_have_skills=$5,nice_to_have_skills=$6,competency_thresholds=$7,salary_band_min=$8,salary_band_max=$9,is_active=$10,updated_at=NOW() WHERE id=$11 RETURNING *`,
        [title_examples||[], experience_years_min||0, experience_years_max, key_responsibilities||[], must_have_skills||[], nice_to_have_skills||[], JSON.stringify(competency_thresholds||{}), salary_band_min, salary_band_max, is_active!==false, id]
      );
      if (!rows.length) return void res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/talent/level-profiles/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      await pool.query('DELETE FROM rp_level_profiles WHERE id=$1', [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  app.get('/api/admin/talent/level-profiles/summary', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT rf.name AS rf_name,
          COUNT(lp.id)::int AS level_count,
          array_agg(lp.level ORDER BY CASE lp.level WHEN 'junior' THEN 1 WHEN 'mid' THEN 2 WHEN 'senior' THEN 3 WHEN 'lead' THEN 4 WHEN 'executive' THEN 5 END) AS levels_present,
          MIN(lp.salary_band_min) AS sal_min,
          MAX(lp.salary_band_max) AS sal_max
        FROM rf_master rf
        LEFT JOIN rp_level_profiles lp ON lp.rf_id = rf.id AND lp.is_active = true
        GROUP BY rf.id, rf.name
        ORDER BY rf.name
      `);
      res.json({ families: rows, total_profiles: rows.reduce((s: number, r: any) => s + r.level_count, 0) });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  console.log('[talent-level-profiles] routes registered — /api/talent/*/level-profiles + /api/admin/talent/level-profiles');
}

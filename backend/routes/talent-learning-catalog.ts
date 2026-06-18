/**
 * D12 Supplement — Learning Intelligence Catalog Enrichment
 * Adds seeded lip_courses, lip_certifications, lip_projects, lip_mentors
 * with blueprint competency mappings for the Learning Intelligence Platform.
 * Additive + flag-gated: FF_LEARNING_INTELLIGENCE=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_LEARNING_INTELLIGENCE';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lip_catalog_courses (
      id SERIAL PRIMARY KEY,
      course_code TEXT NOT NULL UNIQUE,
      course_name TEXT NOT NULL,
      provider TEXT,
      course_type TEXT DEFAULT 'online',
      duration_hours NUMERIC(6,1),
      difficulty_level TEXT CHECK (difficulty_level IN ('beginner','intermediate','advanced','expert')) DEFAULT 'intermediate',
      blueprint_key TEXT,
      competency_targets TEXT[] DEFAULT '{}',
      signal_codes TEXT[] DEFAULT '{}',
      future_relevance INTEGER DEFAULT 5,
      cost_usd NUMERIC(8,2) DEFAULT 0,
      is_free BOOLEAN DEFAULT false,
      url TEXT,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_lip_cc_blueprint ON lip_catalog_courses(blueprint_key);
    CREATE TABLE IF NOT EXISTS lip_catalog_certifications (
      id SERIAL PRIMARY KEY,
      cert_code TEXT NOT NULL UNIQUE,
      cert_name TEXT NOT NULL,
      issuing_body TEXT,
      blueprint_key TEXT,
      competency_targets TEXT[] DEFAULT '{}',
      validity_years INTEGER DEFAULT 2,
      difficulty_level TEXT DEFAULT 'intermediate',
      avg_prep_hours INTEGER DEFAULT 40,
      cost_usd NUMERIC(8,2),
      future_relevance INTEGER DEFAULT 6,
      description TEXT,
      url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_lip_ccert_blueprint ON lip_catalog_certifications(blueprint_key);
    CREATE TABLE IF NOT EXISTS lip_catalog_projects (
      id SERIAL PRIMARY KEY,
      project_code TEXT NOT NULL UNIQUE,
      project_name TEXT NOT NULL,
      project_type TEXT DEFAULT 'stretch_assignment',
      blueprint_key TEXT,
      competency_targets TEXT[] DEFAULT '{}',
      duration_weeks INTEGER DEFAULT 4,
      difficulty_level TEXT DEFAULT 'intermediate',
      description TEXT,
      outcomes TEXT[] DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lip_catalog_mentors (
      id SERIAL PRIMARY KEY,
      mentor_code TEXT NOT NULL UNIQUE,
      mentor_name TEXT NOT NULL,
      expertise_areas TEXT[] DEFAULT '{}',
      blueprint_keys TEXT[] DEFAULT '{}',
      industries TEXT[] DEFAULT '{}',
      years_experience INTEGER DEFAULT 10,
      mentoring_style TEXT,
      availability TEXT DEFAULT 'limited',
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lip_user_course_enrollments (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      course_code TEXT NOT NULL,
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      progress_pct INTEGER DEFAULT 0,
      status TEXT DEFAULT 'enrolled',
      UNIQUE(user_email, course_code)
    );
  `);
  schemaReady = true;
}

const COURSES = [
  { course_code: 'C001', course_name: 'Strategic Thinking for Leaders', provider: 'Coursera', course_type: 'online', duration_hours: 20, difficulty_level: 'advanced', blueprint_key: 'executive_leadership', competency_targets: ['Strategic Thinking','Decision Making'], signal_codes: ['SI_001','SI_002'], future_relevance: 9, cost_usd: 49, is_free: false, description: 'Master the frameworks and tools for long-range strategic thinking in complex environments' },
  { course_code: 'C002', course_name: 'Machine Learning Specialisation', provider: 'DeepLearning.AI', course_type: 'online', duration_hours: 60, difficulty_level: 'intermediate', blueprint_key: 'data_science', competency_targets: ['Machine Learning Engineering','Statistical Analysis'], signal_codes: ['DT_003','AC_005'], future_relevance: 10, cost_usd: 79, is_free: false, description: 'Comprehensive ML specialisation from fundamentals to deployment' },
  { course_code: 'C003', course_name: 'Psychological Safety at Work', provider: 'LinkedIn Learning', course_type: 'online', duration_hours: 4, difficulty_level: 'intermediate', blueprint_key: 'people_leadership', competency_targets: ['Psychological Safety','Inclusive Leadership'], signal_codes: ['LP_007','LP_008'], future_relevance: 10, cost_usd: 0, is_free: true, description: 'Build the skills to create psychologically safe team environments' },
  { course_code: 'C004', course_name: 'Agile Project Management', provider: 'Google/Coursera', course_type: 'online', duration_hours: 30, difficulty_level: 'beginner', blueprint_key: 'project_management', competency_targets: ['Agile Execution','Project Delivery'], signal_codes: ['OE_004','OE_001'], future_relevance: 9, cost_usd: 39, is_free: false, description: 'Google\'s Agile and Scrum fundamentals for project managers' },
  { course_code: 'C005', course_name: 'Negotiation and Influence', provider: 'Yale/Coursera', course_type: 'online', duration_hours: 15, difficulty_level: 'intermediate', blueprint_key: 'sales_leadership', competency_targets: ['Persuasion & Negotiation'], signal_codes: ['CI_004','CI_020'], future_relevance: 9, cost_usd: 49, is_free: false, description: 'Yale\'s award-winning negotiation course from Negotiation and Leadership' },
  { course_code: 'C006', course_name: 'Customer Success Fundamentals', provider: 'Gainsight', course_type: 'online', duration_hours: 8, difficulty_level: 'beginner', blueprint_key: 'customer_success', competency_targets: ['Empathy','Relationship Management'], signal_codes: ['ES_002','ES_005'], future_relevance: 8, cost_usd: 0, is_free: true, description: 'Foundational customer success skills from industry leader Gainsight' },
  { course_code: 'C007', course_name: 'Product Strategy and Roadmapping', provider: 'Reforge', course_type: 'cohort', duration_hours: 40, difficulty_level: 'advanced', blueprint_key: 'product_management', competency_targets: ['Product Strategy','User Research & Discovery'], signal_codes: ['DT_006','IC_003'], future_relevance: 10, cost_usd: 999, is_free: false, description: 'Reforge\'s advanced product strategy programme for experienced PMs' },
  { course_code: 'C008', course_name: 'AI for Everyone', provider: 'DeepLearning.AI', course_type: 'online', duration_hours: 6, difficulty_level: 'beginner', blueprint_key: 'future_readiness_blueprint', competency_targets: ['AI Literacy & Collaboration','Learning Agility'], signal_codes: ['FR_001','DT_003'], future_relevance: 10, cost_usd: 0, is_free: true, description: 'Andrew Ng\'s accessible introduction to AI for non-technical professionals' },
  { course_code: 'C009', course_name: 'Lean Six Sigma Green Belt', provider: 'IASSC', course_type: 'blended', duration_hours: 50, difficulty_level: 'advanced', blueprint_key: 'operations_management', competency_targets: ['Process Design','Quality Management'], signal_codes: ['OE_002','OE_009'], future_relevance: 7, cost_usd: 299, is_free: false, description: 'Internationally recognised Lean Six Sigma certification programme' },
  { course_code: 'C010', course_name: 'Data Analytics with Python', provider: 'edX', course_type: 'online', duration_hours: 35, difficulty_level: 'intermediate', blueprint_key: 'data_science', competency_targets: ['Data Analytics','Statistical Analysis'], signal_codes: ['AC_001','DT_002'], future_relevance: 10, cost_usd: 149, is_free: false, description: 'Hands-on Python data analysis from data cleaning to visualisation' },
  { course_code: 'C011', course_name: 'Emotional Intelligence for Leaders', provider: 'Yale/Coursera', course_type: 'online', duration_hours: 12, difficulty_level: 'intermediate', blueprint_key: 'people_leadership', competency_targets: ['Coaching & Mentoring','Psychological Safety'], signal_codes: ['ES_001','ES_003'], future_relevance: 10, cost_usd: 49, is_free: false, description: 'Yale\'s science-backed EI development programme for working leaders' },
  { course_code: 'C012', course_name: 'Cloud Architecture Fundamentals', provider: 'AWS', course_type: 'online', duration_hours: 20, difficulty_level: 'intermediate', blueprint_key: 'software_engineering', competency_targets: ['Software Architecture','Code Quality & Craft'], signal_codes: ['DT_005','DT_029'], future_relevance: 9, cost_usd: 0, is_free: true, description: 'AWS fundamentals for cloud architecture design and deployment' },
  { course_code: 'C013', course_name: 'Design Thinking in Practice', provider: 'IDEO U', course_type: 'online', duration_hours: 16, difficulty_level: 'intermediate', blueprint_key: 'product_management', competency_targets: ['User Research & Discovery'], signal_codes: ['IC_003','DT_014'], future_relevance: 9, cost_usd: 99, is_free: false, description: 'IDEO\'s practical design thinking programme grounded in real projects' },
  { course_code: 'C014', course_name: 'Change Management Practitioner', provider: 'Prosci', course_type: 'workshop', duration_hours: 24, difficulty_level: 'advanced', blueprint_key: 'operations_management', competency_targets: ['Change Implementation'], signal_codes: ['OE_013','LP_012'], future_relevance: 9, cost_usd: 1595, is_free: false, description: 'ADKAR-based change management certification from Prosci' },
  { course_code: 'C015', course_name: 'Future of Work and AI Skills', provider: 'WEF/Coursera', course_type: 'online', duration_hours: 8, difficulty_level: 'beginner', blueprint_key: 'future_readiness_blueprint', competency_targets: ['AI Literacy & Collaboration','Learning Agility'], signal_codes: ['FR_003','FR_001'], future_relevance: 10, cost_usd: 0, is_free: true, description: 'WEF\'s reskilling programme for the future of work with AI' },
];

const CERTIFICATIONS = [
  { cert_code: 'CERT001', cert_name: 'PMP — Project Management Professional', issuing_body: 'PMI', blueprint_key: 'project_management', competency_targets: ['Project Delivery','Agile Execution'], validity_years: 3, difficulty_level: 'advanced', avg_prep_hours: 80, cost_usd: 555, future_relevance: 8, description: 'Gold standard PM certification recognised globally' },
  { cert_code: 'CERT002', cert_name: 'AWS Certified Solutions Architect', issuing_body: 'Amazon Web Services', blueprint_key: 'software_engineering', competency_targets: ['Software Architecture'], validity_years: 3, difficulty_level: 'advanced', avg_prep_hours: 60, cost_usd: 300, future_relevance: 9, description: 'Validates cloud architecture expertise on AWS' },
  { cert_code: 'CERT003', cert_name: 'Google Data Analytics Certificate', issuing_body: 'Google', blueprint_key: 'data_science', competency_targets: ['Data Analytics','Statistical Analysis'], validity_years: 5, difficulty_level: 'beginner', avg_prep_hours: 40, cost_usd: 300, future_relevance: 9, description: 'Google\'s job-ready data analytics certification' },
  { cert_code: 'CERT004', cert_name: 'SHRM-CP/SCP', issuing_body: 'SHRM', blueprint_key: 'people_leadership', competency_targets: ['Coaching & Mentoring','Inclusive Leadership'], validity_years: 3, difficulty_level: 'advanced', avg_prep_hours: 100, cost_usd: 300, future_relevance: 8, description: 'SHRM Certified Professional — HR benchmark certification' },
  { cert_code: 'CERT005', cert_name: 'CFA — Chartered Financial Analyst', issuing_body: 'CFA Institute', blueprint_key: 'executive_leadership', competency_targets: ['Strategic Thinking','Decision Making'], validity_years: 0, difficulty_level: 'expert', avg_prep_hours: 300, cost_usd: 1200, future_relevance: 7, description: 'Globally recognised finance and investment management credential' },
  { cert_code: 'CERT006', cert_name: 'Certified Scrum Master', issuing_body: 'Scrum Alliance', blueprint_key: 'project_management', competency_targets: ['Agile Execution'], validity_years: 2, difficulty_level: 'intermediate', avg_prep_hours: 20, cost_usd: 995, future_relevance: 8, description: 'Scrum Master certification for agile team facilitation' },
  { cert_code: 'CERT007', cert_name: 'Lean Six Sigma Black Belt', issuing_body: 'ASQ', blueprint_key: 'operations_management', competency_targets: ['Process Design','Continuous Improvement'], validity_years: 3, difficulty_level: 'expert', avg_prep_hours: 120, cost_usd: 800, future_relevance: 7, description: 'Advanced quality management and process improvement credential' },
  { cert_code: 'CERT008', cert_name: 'ICF Associate Certified Coach', issuing_body: 'ICF', blueprint_key: 'people_leadership', competency_targets: ['Coaching & Mentoring'], validity_years: 3, difficulty_level: 'advanced', avg_prep_hours: 60, cost_usd: 500, future_relevance: 9, description: 'International Coaching Federation foundational coaching credential' },
  { cert_code: 'CERT009', cert_name: 'AI+ Certificate', issuing_body: 'AI+ Alliance', blueprint_key: 'future_readiness_blueprint', competency_targets: ['AI Literacy & Collaboration'], validity_years: 2, difficulty_level: 'intermediate', avg_prep_hours: 30, cost_usd: 399, future_relevance: 10, description: 'Practical AI literacy certification for business professionals' },
  { cert_code: 'CERT010', cert_name: 'Salesforce Administrator', issuing_body: 'Salesforce', blueprint_key: 'customer_success', competency_targets: ['Relationship Management'], validity_years: 1, difficulty_level: 'intermediate', avg_prep_hours: 40, cost_usd: 200, future_relevance: 7, description: 'Core Salesforce platform certification for CS and sales operations' },
];

const PROJECTS = [
  { project_code: 'P001', project_name: 'Strategic Planning Sprint', project_type: 'stretch_assignment', blueprint_key: 'executive_leadership', competency_targets: ['Strategic Thinking'], duration_weeks: 8, difficulty_level: 'advanced', description: 'Lead a strategic planning exercise for a real business unit, producing a 3-year strategic brief', outcomes: ['Strategic plan deliverable','Stakeholder presentation','Lessons learned report'] },
  { project_code: 'P002', project_name: 'Data Pipeline Build', project_type: 'technical_project', blueprint_key: 'data_science', competency_targets: ['Machine Learning Engineering','Data Analytics'], duration_weeks: 4, difficulty_level: 'intermediate', description: 'Build an end-to-end data pipeline with ML model training and deployment on a real business problem', outcomes: ['Working ML model','Deployment to staging','Model card documentation'] },
  { project_code: 'P003', project_name: 'Team Coaching Series', project_type: 'people_development', blueprint_key: 'people_leadership', competency_targets: ['Coaching & Mentoring','Psychological Safety'], duration_weeks: 6, difficulty_level: 'intermediate', description: 'Design and deliver 6 structured coaching conversations with direct reports, tracking growth', outcomes: ['Coaching journal','Pre/post capability assessment','Team engagement delta'] },
  { project_code: 'P004', project_name: 'Process Redesign Initiative', project_type: 'operational_project', blueprint_key: 'operations_management', competency_targets: ['Process Design','Continuous Improvement'], duration_weeks: 6, difficulty_level: 'advanced', description: 'Map, analyse, and redesign a core operational process with measurable efficiency gain', outcomes: ['Current/future state process maps','ROI analysis','Implementation plan'] },
  { project_code: 'P005', project_name: 'Customer Discovery Research', project_type: 'research_project', blueprint_key: 'product_management', competency_targets: ['User Research & Discovery','Product Strategy'], duration_weeks: 4, difficulty_level: 'intermediate', description: 'Conduct 15+ customer discovery interviews and synthesise into product opportunity recommendations', outcomes: ['Research synthesis deck','Opportunity assessment','Recommended features'] },
  { project_code: 'P006', project_name: 'Sales Pitch Competition', project_type: 'skill_practice', blueprint_key: 'sales_leadership', competency_targets: ['Persuasion & Negotiation','Customer Centricity'], duration_weeks: 2, difficulty_level: 'intermediate', description: 'Develop and deliver a competitive sales pitch for a real product with peer/expert feedback', outcomes: ['Pitch deck','Recorded presentation','Evaluation rubric score'] },
  { project_code: 'P007', project_name: 'AI Tool Integration Project', project_type: 'digital_project', blueprint_key: 'future_readiness_blueprint', competency_targets: ['AI Literacy & Collaboration','Learning Agility'], duration_weeks: 3, difficulty_level: 'intermediate', description: 'Identify, evaluate, and integrate one AI tool into a daily workflow, measuring productivity impact', outcomes: ['Tool evaluation report','Workflow diagram','30-day impact measurement'] },
  { project_code: 'P008', project_name: 'Cross-functional Leadership Simulation', project_type: 'simulation', blueprint_key: 'executive_leadership', competency_targets: ['Decision Making','Inspirational Leadership'], duration_weeks: 4, difficulty_level: 'advanced', description: 'Lead a cross-functional team through a business simulation case with competing priorities', outcomes: ['Simulation outcome report','360 feedback from team','Self-reflection journal'] },
];

const MENTORS = [
  { mentor_code: 'M001', mentor_name: 'Priya Sharma', expertise_areas: ['Strategic Leadership','Organisational Design','Executive Coaching'], blueprint_keys: ['executive_leadership','people_leadership'], industries: ['Technology','Financial Services'], years_experience: 22, mentoring_style: 'Socratic — asks powerful questions to unlock self-discovery', availability: 'limited', description: 'Former CHRO turned executive coach with 22 years of enterprise leadership experience' },
  { mentor_code: 'M002', mentor_name: 'Dr. Raj Mehta', expertise_areas: ['Machine Learning','Data Science Strategy','AI Ethics'], blueprint_keys: ['data_science','future_readiness_blueprint'], industries: ['Technology','Healthcare'], years_experience: 15, mentoring_style: 'Technical deep-dive with business context', availability: 'available', description: 'Lead ML scientist and professor, expertise in practical AI deployment and ethics' },
  { mentor_code: 'M003', mentor_name: 'Ananya Krishnaswamy', expertise_areas: ['Agile Transformation','Product Leadership','Customer Discovery'], blueprint_keys: ['product_management','project_management'], industries: ['SaaS','E-commerce'], years_experience: 14, mentoring_style: 'Hands-on practitioner — co-works through real problems', availability: 'available', description: 'Head of Product at a unicorn startup, Agile coach and product leadership mentor' },
  { mentor_code: 'M004', mentor_name: 'Marcus Chen', expertise_areas: ['Operations Excellence','Lean Manufacturing','Supply Chain'], blueprint_keys: ['operations_management'], industries: ['Manufacturing','Automotive','Retail'], years_experience: 18, mentoring_style: 'Systems-oriented — builds frameworks for sustainable improvement', availability: 'limited', description: 'Lean Six Sigma Master Black Belt with global operations transformation track record' },
  { mentor_code: 'M005', mentor_name: 'Sunita Patel', expertise_areas: ['Enterprise Sales','Negotiation','Customer Success'], blueprint_keys: ['sales_leadership','customer_success'], industries: ['Technology','Professional Services'], years_experience: 16, mentoring_style: 'Role-play intensive — practises real scenarios for skill building', availability: 'available', description: 'VP Sales with $50M+ quota retired to coaching — enterprise deal expertise' },
  { mentor_code: 'M006', mentor_name: 'Dr. Vikram Rajan', expertise_areas: ['People Analytics','HR Transformation','Learning Science'], blueprint_keys: ['people_leadership'], industries: ['Any'], years_experience: 20, mentoring_style: 'Evidence-based — uses research and diagnostics to guide development', availability: 'waitlist', description: 'Global CHRO and people analytics expert, author of Future of Talent' },
  { mentor_code: 'M007', mentor_name: 'Nisha Reddy', expertise_areas: ['Digital Transformation','Cloud Strategy','Software Engineering Leadership'], blueprint_keys: ['software_engineering','future_readiness_blueprint'], industries: ['Technology','Financial Services'], years_experience: 12, mentoring_style: 'Growth-oriented — challenges with stretch goals and accountability', availability: 'available', description: 'Engineering director who led AWS cloud migrations at scale' },
  { mentor_code: 'M008', mentor_name: 'Arjun Desai', expertise_areas: ['Future of Work','AI Strategy','Innovation Culture'], blueprint_keys: ['future_readiness_blueprint','executive_leadership'], industries: ['Any'], years_experience: 17, mentoring_style: 'Futures-oriented — connects today\'s decisions to tomorrow\'s landscape', availability: 'limited', description: 'Innovation strategist at a global consulting firm, WEF advisory member' },
];

async function seedCatalog(pool: Pool): Promise<void> {
  const existing = await pool.query<{ cnt: string }>('SELECT COUNT(*)::int AS cnt FROM lip_catalog_courses');
  if (Number(existing.rows[0]?.cnt) >= COURSES.length) return;
  for (const c of COURSES) {
    await pool.query(`INSERT INTO lip_catalog_courses(course_code,course_name,provider,course_type,duration_hours,difficulty_level,blueprint_key,competency_targets,signal_codes,future_relevance,cost_usd,is_free,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(course_code) DO NOTHING`,
      [c.course_code, c.course_name, c.provider, c.course_type, c.duration_hours, c.difficulty_level, c.blueprint_key, c.competency_targets, c.signal_codes, c.future_relevance, c.cost_usd, c.is_free, c.description]);
  }
  for (const c of CERTIFICATIONS) {
    await pool.query(`INSERT INTO lip_catalog_certifications(cert_code,cert_name,issuing_body,blueprint_key,competency_targets,validity_years,difficulty_level,avg_prep_hours,cost_usd,future_relevance,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(cert_code) DO NOTHING`,
      [c.cert_code, c.cert_name, c.issuing_body, c.blueprint_key, c.competency_targets, c.validity_years, c.difficulty_level, c.avg_prep_hours, c.cost_usd, c.future_relevance, c.description]);
  }
  for (const p of PROJECTS) {
    await pool.query(`INSERT INTO lip_catalog_projects(project_code,project_name,project_type,blueprint_key,competency_targets,duration_weeks,difficulty_level,description,outcomes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(project_code) DO NOTHING`,
      [p.project_code, p.project_name, p.project_type, p.blueprint_key, p.competency_targets, p.duration_weeks, p.difficulty_level, p.description, p.outcomes]);
  }
  for (const m of MENTORS) {
    await pool.query(`INSERT INTO lip_catalog_mentors(mentor_code,mentor_name,expertise_areas,blueprint_keys,industries,years_experience,mentoring_style,availability,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(mentor_code) DO NOTHING`,
      [m.mentor_code, m.mentor_name, m.expertise_areas, m.blueprint_keys, m.industries, m.years_experience, m.mentoring_style, m.availability, m.description]);
  }
}

export function registerTalentLearningCatalogRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).then(() => seedCatalog(pool)).catch(() => {});

  // GET /api/admin/lip/catalog/overview
  app.get('/api/admin/lip/catalog/overview', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const [courses, certs, projects, mentors] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE is_free) as free_count, ROUND(AVG(future_relevance),1) as avg_relevance FROM lip_catalog_courses`),
        pool.query('SELECT COUNT(*)::int as total FROM lip_catalog_certifications'),
        pool.query('SELECT COUNT(*)::int as total FROM lip_catalog_projects'),
        pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE availability='available') as available FROM lip_catalog_mentors`),
      ]);
      res.json({ courses: courses.rows[0], certifications: certs.rows[0], projects: projects.rows[0], mentors: mentors.rows[0] });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.get('/api/admin/lip/catalog/courses', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { blueprint_key, is_free, search } = req.query as Record<string, string>;
      const params: unknown[] = []; const where: string[] = [];
      if (blueprint_key) { params.push(blueprint_key); where.push(`blueprint_key=$${params.length}`); }
      if (is_free === 'true') where.push('is_free=true');
      if (search) { params.push(`%${search}%`); where.push(`course_name ILIKE $${params.length}`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM lip_catalog_courses ${wc} ORDER BY future_relevance DESC, course_name`, params);
      res.json({ courses: rows.rows, count: rows.rows.length });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.get('/api/admin/lip/catalog/certifications', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { blueprint_key } = req.query as Record<string, string>;
      const rows = await pool.query(`SELECT * FROM lip_catalog_certifications ${blueprint_key ? 'WHERE blueprint_key=$1' : ''} ORDER BY future_relevance DESC, cert_name`, blueprint_key ? [blueprint_key] : []);
      res.json({ certifications: rows.rows, count: rows.rows.length });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.get('/api/admin/lip/catalog/projects', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { blueprint_key } = req.query as Record<string, string>;
      const rows = await pool.query(`SELECT * FROM lip_catalog_projects ${blueprint_key ? 'WHERE blueprint_key=$1' : ''} ORDER BY project_name`, blueprint_key ? [blueprint_key] : []);
      res.json({ projects: rows.rows, count: rows.rows.length });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.get('/api/admin/lip/catalog/mentors', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { blueprint_key, availability } = req.query as Record<string, string>;
      const params: unknown[] = []; const where: string[] = [];
      if (blueprint_key) { params.push(`%${blueprint_key}%`); where.push(`$${params.length}=ANY(blueprint_keys)`); }
      if (availability) { params.push(availability); where.push(`availability=$${params.length}`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM lip_catalog_mentors ${wc} ORDER BY availability, years_experience DESC`, params);
      res.json({ mentors: rows.rows, count: rows.rows.length });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/lip/catalog/recommend/:email — recommend resources based on talent gaps
  app.get('/api/lip/catalog/recommend/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const gaps = await pool.query('SELECT rf_id, severity FROM talent_gaps WHERE user_email=$1 ORDER BY gap_score DESC LIMIT 5', [email]).catch(() => ({ rows: [] }));
      if (!gaps.rows.length) return res.json({ email, recommendations: {}, message: 'No talent gaps found — compute scores first' });
      const scores = await pool.query('SELECT rf_id, blueprint_key FROM talent_role_scores WHERE user_email=$1 ORDER BY composite_score DESC LIMIT 5', [email]).catch(() => ({ rows: [] }));
      const blueprintKeys = [...new Set(scores.rows.map((s: any) => s.blueprint_key).filter(Boolean))];
      const [courses, certs, projects, mentors] = await Promise.all([
        pool.query(`SELECT * FROM lip_catalog_courses WHERE blueprint_key=ANY($1) ORDER BY future_relevance DESC LIMIT 5`, [blueprintKeys]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM lip_catalog_certifications WHERE blueprint_key=ANY($1) ORDER BY future_relevance DESC LIMIT 3`, [blueprintKeys]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM lip_catalog_projects WHERE blueprint_key=ANY($1) ORDER BY difficulty_level DESC LIMIT 3`, [blueprintKeys]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM lip_catalog_mentors WHERE blueprint_keys && $1 ORDER BY years_experience DESC LIMIT 2`, [blueprintKeys]).catch(() => ({ rows: [] })),
      ]);
      res.json({ email, recommendations: { courses: courses.rows, certifications: certs.rows, projects: projects.rows, mentors: mentors.rows }, basis: blueprintKeys, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-learning-catalog] D12 routes registered — courses/certs/projects/mentors catalog seeded');
}

/**
 * D5 — Competency DNA Framework
 * competency_dna_master: micro competencies, behavior/failure/growth indicators,
 * dependencies, relationships, and future relevance per competency.
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
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
    CREATE TABLE IF NOT EXISTS competency_dna_master (
      id SERIAL PRIMARY KEY,
      blueprint_key TEXT NOT NULL,
      competency_name TEXT NOT NULL,
      competency_code TEXT NOT NULL UNIQUE,
      description TEXT,
      micro_competencies JSONB DEFAULT '[]',
      behavior_indicators JSONB DEFAULT '[]',
      failure_indicators JSONB DEFAULT '[]',
      growth_indicators JSONB DEFAULT '[]',
      dependencies JSONB DEFAULT '[]',
      related_competencies JSONB DEFAULT '[]',
      assessment_signals JSONB DEFAULT '[]',
      future_relevance TEXT CHECK (future_relevance IN ('critical','high','moderate','low')) DEFAULT 'high',
      proficiency_levels JSONB DEFAULT '{}',
      development_timeline_weeks INTEGER DEFAULT 12,
      is_foundational BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cdm_blueprint ON competency_dna_master(blueprint_key);
    CREATE INDEX IF NOT EXISTS idx_cdm_code ON competency_dna_master(competency_code);
  `);
  schemaReady = true;
}

const DNA_RECORDS = [
  // ── Executive Leadership Blueprint ────────────────────────────────────────
  {
    blueprint_key: 'executive_leadership', competency_name: 'Strategic Thinking', competency_code: 'EL_STRAT',
    description: 'Ability to think long-term, synthesise complexity, and chart a compelling direction for the organisation',
    micro_competencies: ['Environmental scanning','Competitive analysis','Scenario planning','Vision articulation','Strategic prioritisation'],
    behavior_indicators: ['Regularly articulates 3-5 year vision','Connects daily decisions to long-term goals','Identifies second-order effects before acting','Builds coalitions around strategic agenda'],
    failure_indicators: ['Tactical thinking masquerading as strategy','Inability to simplify complex landscapes','Ignoring external signals','Strategy/execution disconnect'],
    growth_indicators: ['Seeks cross-industry exposure','Engages with board and investor perspectives','Participates in strategic planning exercises','Reads widely on macro trends'],
    dependencies: ['Market Intelligence','Systems Thinking','Financial Acumen'],
    related_competencies: ['Decision Making','Innovation Leadership','Business Model Thinking'],
    assessment_signals: ['SI_001','SI_002','SI_030'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Understands basic strategy frameworks', developing: 'Contributes meaningfully to strategic discussions', proficient: 'Leads functional strategy', advanced: 'Sets organisational strategic direction', expert: 'Shapes industry direction' },
    development_timeline_weeks: 24, is_foundational: true
  },
  {
    blueprint_key: 'executive_leadership', competency_name: 'Decision Making', competency_code: 'EL_DECIS',
    description: 'Making high-quality decisions with rigour, speed, and appropriate stakeholder involvement',
    micro_competencies: ['Data-driven analysis','Stakeholder consultation','Risk assessment','Decision frameworks','Implementation clarity'],
    behavior_indicators: ['Uses structured frameworks for major decisions','Distinguishes reversible from irreversible decisions','Communicates decision rationale clearly','Reviews and learns from past decisions'],
    failure_indicators: ['Analysis paralysis','Gut-feel without data','Excluding key stakeholders','Not revisiting poor decisions'],
    growth_indicators: ['Maintains decision journal','Seeks diverse perspectives before deciding','Studies decision science literature','Runs pre-mortem exercises'],
    dependencies: ['Strategic Thinking','Analytical Reasoning','Stakeholder Management'],
    related_competencies: ['Risk Management','Judgement Under Ambiguity'],
    assessment_signals: ['AC_010','SI_004','AC_002'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Makes routine decisions with guidance', developing: 'Makes operational decisions independently', proficient: 'Makes significant tactical decisions', advanced: 'Makes complex strategic decisions', expert: 'Sets decision culture for organisation' },
    development_timeline_weeks: 16, is_foundational: true
  },
  {
    blueprint_key: 'executive_leadership', competency_name: 'Inspirational Leadership', competency_code: 'EL_INSPL',
    description: 'Motivating others to perform beyond expected potential through purpose, values, and vision',
    micro_competencies: ['Purpose articulation','Values embodiment','Energy management','Storytelling for leadership','Recognition design'],
    behavior_indicators: ['Connects organisational mission to individual work','Maintains team energy during adversity','Publicly recognises contributions','Models the culture they want to see'],
    failure_indicators: ['Motivating through fear or pressure','Disconnected from team concerns','Inconsistency between words and actions','Neglecting individual motivators'],
    growth_indicators: ['Seeks 360 feedback on leadership impact','Studies transformational leaders','Develops own leadership philosophy','Invests in personal presence'],
    dependencies: ['Emotional Intelligence','Communication Excellence','Authentic Presence'],
    related_competencies: ['Team Culture Building','Change Leadership','Purpose-Driven Leadership'],
    assessment_signals: ['LP_001','LP_027','CI_028'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Inspires small team around shared task', developing: 'Builds team energy consistently', proficient: 'Inspires across functions', advanced: 'Inspires at organisational scale', expert: 'Creates industry-defining leadership legacy' },
    development_timeline_weeks: 20, is_foundational: true
  },
  // ── Operations Management Blueprint ───────────────────────────────────────
  {
    blueprint_key: 'operations_management', competency_name: 'Process Design', competency_code: 'OM_PROCD',
    description: 'Creating efficient, scalable processes that deliver consistent quality and operational outcomes',
    micro_competencies: ['Process mapping','Value stream analysis','Standard operating procedures','Process documentation','Handoff design'],
    behavior_indicators: ['Maps current-state before redesigning','Pilots processes with small group before full rollout','Creates clear SOPs','Measures process effectiveness with data'],
    failure_indicators: ['Designing processes without user input','Over-engineering for scale before needed','No measurement plan','Ignoring exception handling'],
    growth_indicators: ['Learns Lean Six Sigma','Studies case studies of operational transformation','Visits high-performing operations in peer companies','Gets certification in process improvement'],
    dependencies: ['Systems Thinking','Data Analytics','Stakeholder Alignment'],
    related_competencies: ['Quality Management','Continuous Improvement','Change Implementation'],
    assessment_signals: ['OE_002','OE_009','OE_026'],
    future_relevance: 'high', proficiency_levels: { novice: 'Documents existing processes accurately', developing: 'Redesigns simple processes for efficiency', proficient: 'Designs cross-functional processes', advanced: 'Designs enterprise-scale operating systems', expert: 'Pioneers new process methodologies' },
    development_timeline_weeks: 16, is_foundational: true
  },
  {
    blueprint_key: 'operations_management', competency_name: 'Quality Management', competency_code: 'OM_QUALM',
    description: 'Designing and maintaining systems that ensure consistent, measurable output quality',
    micro_competencies: ['Quality standards setting','Inspection system design','Defect analysis','Supplier quality management','Customer feedback loops'],
    behavior_indicators: ['Sets measurable quality standards','Tracks defect rates and improvement','Runs structured root cause analysis on quality failures','Closes feedback loops with customers'],
    failure_indicators: ['Quality as inspection not prevention','No measurement baseline','Ignoring customer quality signals','Treating quality as cost not investment'],
    growth_indicators: ['Pursues TQM or Six Sigma training','Studies quality management in world-class companies','Implements customer quality scorecard'],
    dependencies: ['Process Design','Data Analytics','Continuous Improvement'],
    related_competencies: ['Service Excellence','Operational Risk Management'],
    assessment_signals: ['OE_003','OE_017','AC_006'],
    future_relevance: 'high', proficiency_levels: { novice: 'Understands quality standards and follows them', developing: 'Identifies and reports quality issues', proficient: 'Designs quality systems for team', advanced: 'Manages enterprise quality management system', expert: 'Pioneers quality transformation programmes' },
    development_timeline_weeks: 12, is_foundational: false
  },
  // ── Software Engineering Blueprint ────────────────────────────────────────
  {
    blueprint_key: 'software_engineering', competency_name: 'Software Architecture', competency_code: 'SE_ARCH',
    description: 'Designing scalable, maintainable, and secure software systems that meet business requirements',
    micro_competencies: ['System decomposition','API design','Database design','Security by design','Performance architecture'],
    behavior_indicators: ['Documents architectural decisions with rationale','Considers scale from day one','Involves team in architectural review','Balances pragmatism with long-term quality'],
    failure_indicators: ['Over-engineering','No documentation','Ignoring non-functional requirements','Architecture without security consideration'],
    growth_indicators: ['Studies distributed systems','Contributes to open source architecture','Reads architecture decision records from major tech companies','Gets AWS/Azure architecture certification'],
    dependencies: ['Systems Thinking','Security Engineering','Performance Engineering'],
    related_competencies: ['API Design','Database Engineering','Cloud Engineering'],
    assessment_signals: ['DT_029','AC_003','DT_005'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Understands basic architectural patterns', developing: 'Designs component-level architecture', proficient: 'Designs service/system architecture', advanced: 'Designs platform architecture', expert: 'Defines architectural strategy across organisation' },
    development_timeline_weeks: 24, is_foundational: true
  },
  {
    blueprint_key: 'software_engineering', competency_name: 'Code Quality & Craft', competency_code: 'SE_CODQ',
    description: 'Writing clean, tested, maintainable code that other engineers can build upon',
    micro_competencies: ['Clean code principles','Test-driven development','Code review practice','Refactoring','Technical debt management'],
    behavior_indicators: ['Writes tests before or alongside code','Reviews code constructively','Refactors proactively','Documents intent not just implementation'],
    failure_indicators: ['Cutting corners under pressure','Skipping tests','Accumulating unmanaged tech debt','Defensive response to code review'],
    growth_indicators: ['Reads Clean Code and Pragmatic Programmer','Participates in coding katas','Leads code review culture improvements','Tracks and advocates for tech debt reduction'],
    dependencies: ['Problem Decomposition','Testing Engineering','Refactoring Mindset'],
    related_competencies: ['Software Architecture','Testing Strategy'],
    assessment_signals: ['DT_015','DT_027','AC_021'],
    future_relevance: 'high', proficiency_levels: { novice: 'Writes working but inconsistently clean code', developing: 'Follows clean code standards', proficient: 'Sets code quality bar for team', advanced: 'Defines engineering craft standards', expert: 'Shapes industry coding culture' },
    development_timeline_weeks: 12, is_foundational: true
  },
  // ── Project Management Blueprint ──────────────────────────────────────────
  {
    blueprint_key: 'project_management', competency_name: 'Project Delivery', competency_code: 'PM_DELIV',
    description: 'Planning and executing projects to deliver outcomes on time, within budget, and to scope',
    micro_competencies: ['Project planning','Critical path management','Scope management','Dependency tracking','Delivery reporting'],
    behavior_indicators: ['Builds comprehensive project charters','Maintains live project plan','Escalates risks early','Closes projects with lessons learned'],
    failure_indicators: ['Scope creep without change control','No critical path awareness','Late escalation','Missing retrospectives'],
    growth_indicators: ['Pursues PMP or Prince2 certification','Manages increasingly complex projects','Studies project failure post-mortems','Builds project management playbook'],
    dependencies: ['Planning & Organisation','Stakeholder Management','Risk Management'],
    related_competencies: ['Agile Execution','Change Management','Resource Management'],
    assessment_signals: ['OE_001','OE_010','OE_019'],
    future_relevance: 'high', proficiency_levels: { novice: 'Manages simple tasks with close guidance', developing: 'Manages small projects independently', proficient: 'Manages complex multi-workstream projects', advanced: 'Manages programmes with multiple projects', expert: 'Sets delivery management methodology for organisation' },
    development_timeline_weeks: 16, is_foundational: true
  },
  {
    blueprint_key: 'project_management', competency_name: 'Agile Execution', competency_code: 'PM_AGILE',
    description: 'Applying agile methodologies to deliver value iteratively with rapid feedback loops',
    micro_competencies: ['Sprint planning','Backlog management','Retrospectives','Velocity tracking','Agile ceremonies'],
    behavior_indicators: ['Runs effective sprint ceremonies','Manages backlog with clear priorities','Tracks and improves team velocity','Facilitates productive retrospectives'],
    failure_indicators: ['Zombie agile without adaptation','Ignoring retrospective insights','Backlog as dumping ground','No actual iteration based on feedback'],
    growth_indicators: ['Gets Scrum Master or SAFe certification','Studies successful agile transformations','Experiments with different agile frameworks','Coaches team on agile mindset'],
    dependencies: ['Project Delivery','Facilitation','Continuous Improvement'],
    related_competencies: ['DevOps Practices','Lean Execution','Iterative Design'],
    assessment_signals: ['OE_004','LA_012','IC_009'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Participates in agile ceremonies', developing: 'Runs ceremonies for small team', proficient: 'Leads agile transformation for team', advanced: 'Scales agile across programmes', expert: 'Defines agile strategy for enterprise' },
    development_timeline_weeks: 8, is_foundational: true
  },
  // ── Sales Leadership Blueprint ────────────────────────────────────────────
  {
    blueprint_key: 'sales_leadership', competency_name: 'Persuasion & Negotiation', competency_code: 'SL_PERSU',
    description: 'Moving customers and stakeholders toward mutually beneficial agreements through principled negotiation',
    micro_competencies: ['Value proposition articulation','Objection handling','BATNA preparation','Closing techniques','Multi-stakeholder negotiation'],
    behavior_indicators: ['Prepares BATNA before every negotiation','Listens more than talks in discovery','Negotiates on interest not position','Closes with explicit agreement and next steps'],
    failure_indicators: ['Overselling and underdelivering','Capitulating on value to win deal','No preparation for objections','Single stakeholder focus in complex sales'],
    growth_indicators: ['Studies negotiation with Harvard PON materials','Practises with role play','Debriefs every lost deal','Gets sales methodology certification'],
    dependencies: ['Emotional Intelligence','Active Listening','Business Acumen'],
    related_competencies: ['Executive Presence','Customer Centricity','Relationship Building'],
    assessment_signals: ['CI_004','CI_001','ES_002'],
    future_relevance: 'high', proficiency_levels: { novice: 'Handles simple negotiations with scripts', developing: 'Manages straightforward sales negotiations', proficient: 'Negotiates complex multi-stakeholder deals', advanced: 'Negotiates strategic partnerships and large contracts', expert: 'Defines negotiation strategy and trains others' },
    development_timeline_weeks: 12, is_foundational: true
  },
  {
    blueprint_key: 'sales_leadership', competency_name: 'Customer Centricity', competency_code: 'SL_CUSTC',
    description: 'Placing customer outcomes at the centre of every decision, interaction, and strategy',
    micro_competencies: ['Customer journey mapping','Voice of customer','Jobs-to-be-Done thinking','NPS/CSAT analysis','Customer advisory board management'],
    behavior_indicators: ['Spends time with customers regularly','Uses customer data to validate decisions','Closes feedback loops systematically','Advocates for customer inside organisation'],
    failure_indicators: ['Product-centric not customer-centric','Ignoring NPS/CSAT data','Losing touch with end customer','Over-promising and under-delivering'],
    growth_indicators: ['Runs customer listening tours','Maps end-to-end customer journeys','Builds customer advisory board','Implements VOC programme'],
    dependencies: ['Active Listening','Empathy','Data Analytics'],
    related_competencies: ['Persuasion & Negotiation','Service Excellence','Relationship Building'],
    assessment_signals: ['SI_018','ES_002','CI_003'],
    future_relevance: 'high', proficiency_levels: { novice: 'Understands basic customer needs', developing: 'Responds to customer feedback effectively', proficient: 'Designs customer-centric processes', advanced: 'Builds customer-centric organisational culture', expert: 'Pioneers customer experience innovation' },
    development_timeline_weeks: 12, is_foundational: true
  },
  // ── Customer Success Blueprint ────────────────────────────────────────────
  {
    blueprint_key: 'customer_success', competency_name: 'Empathy', competency_code: 'CS_EMPTH',
    description: 'Accurately understanding and responding to customer feelings, needs, and perspectives',
    micro_competencies: ['Perspective-taking','Emotional acknowledgement','Needs identification','Non-judgement','Compassionate response'],
    behavior_indicators: ['Acknowledges feelings before pivoting to solutions','Accurately predicts how customers will feel about decisions','Adjusts communication style to emotional state','Advocates for customer interests internally'],
    failure_indicators: ['Jumping to solutions before understanding','Dismissing emotional content as irrational','One-size-fits-all communication','Failing to follow up after difficult interactions'],
    growth_indicators: ['Practises active listening in all interactions','Seeks customer feedback on empathy quality','Studies non-violent communication','Shadows frontline customer interactions'],
    dependencies: ['Active Listening','Emotional Intelligence','Communication Skills'],
    related_competencies: ['Relationship Management','Conflict Resolution','Active Listening'],
    assessment_signals: ['ES_002','CI_003','ES_015'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Shows basic care for customer feelings', developing: 'Consistently acknowledges and validates customer emotions', proficient: 'Uses empathy to transform difficult interactions', advanced: 'Builds empathy culture across customer success team', expert: 'Defines empathic design standards for products and services' },
    development_timeline_weeks: 10, is_foundational: true
  },
  {
    blueprint_key: 'customer_success', competency_name: 'Relationship Management', competency_code: 'CS_RELM',
    description: 'Building long-term, trust-based relationships that drive retention, expansion, and advocacy',
    micro_competencies: ['Relationship mapping','Trust building','Executive relationship management','Renewal planning','Advocacy programme design'],
    behavior_indicators: ['Maintains relationship health map','Engages executive sponsors proactively','Celebrates customer milestones','Recovers relationships after service failures'],
    failure_indicators: ['Reactive relationship management','Over-reliance on single contact','Treating renewal as transactional','No executive sponsor relationship'],
    growth_indicators: ['Builds multi-threaded account relationships','Pursues executive communication training','Studies account management excellence','Builds personal brand with customer base'],
    dependencies: ['Empathy','Communication Excellence','Trust Building'],
    related_competencies: ['Persuasion & Negotiation','Executive Presence','Customer Centricity'],
    assessment_signals: ['ES_005','ES_008','CI_004'],
    future_relevance: 'high', proficiency_levels: { novice: 'Maintains cordial customer relationships', developing: 'Builds genuine rapport with key contacts', proficient: 'Manages complex multi-stakeholder accounts', advanced: 'Builds strategic customer partnerships', expert: 'Transforms customer relationships into strategic alliances' },
    development_timeline_weeks: 16, is_foundational: true
  },
  // ── Data Science Blueprint ────────────────────────────────────────────────
  {
    blueprint_key: 'data_science', competency_name: 'Machine Learning Engineering', competency_code: 'DS_MLE',
    description: 'Building, training, evaluating, and deploying machine learning models at production scale',
    micro_competencies: ['Feature engineering','Model selection','Hyperparameter optimisation','Model evaluation','MLOps and deployment'],
    behavior_indicators: ['Validates models on held-out test sets','Documents model cards with limitations','Monitors models in production for drift','Versioning data and models consistently'],
    failure_indicators: ['Overfitting without cross-validation','Deploying models without monitoring','Ignoring data quality','Treating ML as a black box'],
    growth_indicators: ['Participates in Kaggle competitions','Reads ML papers and implements them','Contributes to open-source ML libraries','Gets cloud ML certification'],
    dependencies: ['Statistical Reasoning','Software Engineering','Data Engineering'],
    related_competencies: ['Deep Learning','Data Engineering','Model Governance'],
    assessment_signals: ['DT_003','AC_005','AC_013'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Uses pre-built ML libraries with guidance', developing: 'Trains and evaluates simple models', proficient: 'Builds production-ready ML systems', advanced: 'Designs ML platform architecture', expert: 'Pioneers ML methodology in organisation' },
    development_timeline_weeks: 24, is_foundational: true
  },
  {
    blueprint_key: 'data_science', competency_name: 'Statistical Analysis', competency_code: 'DS_STATS',
    description: 'Applying statistical methods to extract valid, reliable insights from data',
    micro_competencies: ['Descriptive statistics','Hypothesis testing','Regression analysis','Experimental design','Bayesian methods'],
    behavior_indicators: ['Reports effect sizes with confidence intervals','Designs controlled experiments','Checks statistical assumptions before applying tests','Communicates uncertainty honestly'],
    failure_indicators: ['P-hacking and HARKing','Ignoring multiple comparison problems','Reporting correlation as causation','Overfitting to noise'],
    growth_indicators: ['Studies causal inference','Gets advanced statistics certification','Implements A/B testing framework','Reads statistics in practice books'],
    dependencies: ['Mathematical Reasoning','Research Design','Programming'],
    related_competencies: ['Machine Learning Engineering','Experimental Design','Data Visualisation'],
    assessment_signals: ['AC_005','AC_008','AC_013'],
    future_relevance: 'high', proficiency_levels: { novice: 'Applies basic descriptive statistics', developing: 'Runs hypothesis tests and interprets results', proficient: 'Designs and analyses experiments', advanced: 'Develops new statistical methods for organisation', expert: 'Sets statistical standards and trains analysts' },
    development_timeline_weeks: 20, is_foundational: true
  },
  // ── People Leadership Blueprint ───────────────────────────────────────────
  {
    blueprint_key: 'people_leadership', competency_name: 'Psychological Safety', competency_code: 'PL_PSYS',
    description: 'Creating an environment where all team members feel safe to speak up, take risks, and admit mistakes',
    micro_competencies: ['Vulnerability modelling','Failure celebration','Dissent invitation','Blame-free investigation','Safe space design'],
    behavior_indicators: ['Publicly acknowledges own mistakes','Asks for dissenting views in meetings','Investigates near-misses without blame attribution','Creates rituals for sharing learning from failure'],
    failure_indicators: ['Punishing honest mistake-sharing','Dominant voice suppressing others','No mechanism for upward feedback','Performative safety without follow-through'],
    growth_indicators: ['Studies Amy Edmondson\'s research','Runs team psychological safety assessment','Designs team charter with safety norms','Seeks upward feedback on safety culture'],
    dependencies: ['Emotional Regulation','Trust Building','Inclusive Leadership'],
    related_competencies: ['Inclusive Leadership','Team Culture Building','Feedback Culture'],
    assessment_signals: ['LP_007','ES_006','LP_011'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Avoids actively damaging safety', developing: 'Creates basic safety signals in own behaviour', proficient: 'Builds demonstrably safe team environment', advanced: 'Designs psychological safety systems at scale', expert: 'Transforms organisational culture toward safety' },
    development_timeline_weeks: 16, is_foundational: true
  },
  {
    blueprint_key: 'people_leadership', competency_name: 'Coaching & Mentoring', competency_code: 'PL_COACH',
    description: 'Developing others through guided reflection, challenging questions, and targeted support',
    micro_competencies: ['GROW model application','Powerful questioning','Goal setting','Active listening in coaching','Mentoring relationship management'],
    behavior_indicators: ['Holds regular structured coaching conversations','Asks questions rather than gives answers','Tracks coachee development goals','Distinguishes when to coach vs. direct'],
    failure_indicators: ['Advising when coaching is needed','Coaching without coachee buy-in','No goal or progress tracking','Blurring coaching with therapy'],
    growth_indicators: ['Gets ICF coaching certification','Studies coaching with Whitmore','Builds internal coaching practice','Tracks coachee outcomes over time'],
    dependencies: ['Active Listening','Emotional Intelligence','Growth Mindset'],
    related_competencies: ['Feedback Culture','Mentoring Relationships','People Development'],
    assessment_signals: ['LP_003','CI_023','ES_002'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Provides helpful advice and guidance', developing: 'Uses basic coaching techniques', proficient: 'Runs effective coaching conversations consistently', advanced: 'Builds coaching culture for team', expert: 'Designs organisational coaching strategy and trains coaches' },
    development_timeline_weeks: 16, is_foundational: true
  },
  // ── Product Management Blueprint ──────────────────────────────────────────
  {
    blueprint_key: 'product_management', competency_name: 'Product Strategy', competency_code: 'PM2_STRAT',
    description: 'Defining product vision, positioning, and roadmap aligned to business strategy and user needs',
    micro_competencies: ['Vision definition','Market positioning','Roadmap design','OKR alignment','Competitive differentiation'],
    behavior_indicators: ['Articulates compelling product vision','Connects roadmap to business strategy','Aligns product OKRs to company goals','Monitors competitive moves and adjusts'],
    failure_indicators: ['Feature list masquerading as strategy','No connection to business outcomes','Ignoring competitive intelligence','Static roadmap despite changing conditions'],
    growth_indicators: ['Reads Good Product Strategy Bad Product Strategy','Builds product thesis document','Presents strategy to senior stakeholders','Studies successful product pivots'],
    dependencies: ['Market Intelligence','User Research','Business Acumen'],
    related_competencies: ['Roadmap Management','Competitive Intelligence','Business Model Innovation'],
    assessment_signals: ['DT_006','SI_001','IC_022'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Understands product vision with guidance', developing: 'Contributes to product strategy discussions', proficient: 'Defines product strategy for feature area', advanced: 'Defines strategy for product line', expert: 'Defines platform strategy for organisation' },
    development_timeline_weeks: 20, is_foundational: true
  },
  {
    blueprint_key: 'product_management', competency_name: 'User Research & Discovery', competency_code: 'PM2_USERR',
    description: 'Systematically understanding user needs, behaviours, and pain points to inform product decisions',
    micro_competencies: ['User interview design','Usability testing','Survey design','Analytics interpretation','Jobs-to-be-Done mapping'],
    behavior_indicators: ['Runs user interviews before building','Tests prototypes with real users','Uses analytics alongside qualitative research','Documents and shares user insights across team'],
    failure_indicators: ['Building without user validation','Over-reliance on quantitative data only','Confirmation bias in user research','Not closing insight-to-decision loop'],
    growth_indicators: ['Gets JTBD certification','Implements continuous discovery habit','Studies Teresa Torres\' product discovery','Runs monthly user research calendar'],
    dependencies: ['Empathy','Statistical Analysis','UX Design'],
    related_competencies: ['Product Strategy','UX Design','Data-Driven Decision Making'],
    assessment_signals: ['IC_010','DT_014','AC_004'],
    future_relevance: 'high', proficiency_levels: { novice: 'Observes and documents user research', developing: 'Conducts basic user interviews', proficient: 'Designs and leads comprehensive discovery programmes', advanced: 'Builds discovery system for product teams', expert: 'Pioneers research methodology for organisation' },
    development_timeline_weeks: 12, is_foundational: true
  },
  // ── Future Readiness Blueprint ────────────────────────────────────────────
  {
    blueprint_key: 'future_readiness_blueprint', competency_name: 'AI Literacy & Collaboration', competency_code: 'FR2_AILIT',
    description: 'Understanding AI capabilities, limitations, and ethics to work effectively alongside AI systems',
    micro_competencies: ['Prompt engineering','AI output evaluation','AI tool selection','AI ethics application','Human-AI workflow design'],
    behavior_indicators: ['Uses AI tools daily in productive workflows','Critically evaluates AI-generated outputs','Identifies AI application opportunities in own work','Raises ethical AI concerns proactively'],
    failure_indicators: ['AI avoidance or uncritical acceptance','Not fact-checking AI outputs','Over-delegating to AI without oversight','Ignoring AI bias implications'],
    growth_indicators: ['Completes AI literacy certification','Experiments with 5+ AI tools','Builds AI-augmented workflow for team','Participates in AI ethics discussions'],
    dependencies: ['Digital Literacy','Critical Thinking','Ethics'],
    related_competencies: ['Digital Transformation','Automation Awareness','Future Skills Anticipation'],
    assessment_signals: ['FR_001','DT_003','DT_020'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Aware of AI but limited practical use', developing: 'Uses AI tools for productivity gain', proficient: 'Integrates AI into team workflows effectively', advanced: 'Designs AI-augmented operating models', expert: 'Defines AI strategy for organisation' },
    development_timeline_weeks: 8, is_foundational: true
  },
  {
    blueprint_key: 'future_readiness_blueprint', competency_name: 'Learning Agility', competency_code: 'FR2_LEARNA',
    description: 'Rapidly acquiring and applying new knowledge and skills as contexts change and demands evolve',
    micro_competencies: ['Self-directed learning','Cross-domain transfer','Reflective practice','Feedback integration','Skill stacking'],
    behavior_indicators: ['Proactively identifies and closes skill gaps','Applies lessons from one domain to another','Reflects systematically on experience','Integrates feedback into changed behaviour quickly'],
    failure_indicators: ['Waiting for training to be assigned','Siloed learning within own domain','Defensive response to feedback','Low follow-through on development commitments'],
    growth_indicators: ['Builds personal development plan','Tracks and celebrates learning milestones','Teaches others to reinforce own learning','Experiments with diverse learning modalities'],
    dependencies: ['Growth Mindset','Feedback Receptivity','Intellectual Curiosity'],
    related_competencies: ['AI Literacy','Future Skills Anticipation','Resilience'],
    assessment_signals: ['LA_001','LA_002','LA_003'],
    future_relevance: 'critical', proficiency_levels: { novice: 'Learns effectively with structured guidance', developing: 'Self-directs learning within familiar domains', proficient: 'Learns rapidly across new domains', advanced: 'Models learning agility for others', expert: 'Builds organisation\'s learning capability' },
    development_timeline_weeks: 12, is_foundational: true
  },
];

async function seedDNA(pool: Pool): Promise<void> {
  const existing = await pool.query<{ cnt: string }>('SELECT COUNT(*)::int AS cnt FROM competency_dna_master');
  if (Number(existing.rows[0]?.cnt) >= DNA_RECORDS.length) return;
  for (const r of DNA_RECORDS) {
    await pool.query(
      `INSERT INTO competency_dna_master(blueprint_key,competency_name,competency_code,description,micro_competencies,behavior_indicators,failure_indicators,growth_indicators,dependencies,related_competencies,assessment_signals,future_relevance,proficiency_levels,development_timeline_weeks,is_foundational)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT(competency_code) DO NOTHING`,
      [r.blueprint_key, r.competency_name, r.competency_code, r.description,
       JSON.stringify(r.micro_competencies), JSON.stringify(r.behavior_indicators),
       JSON.stringify(r.failure_indicators), JSON.stringify(r.growth_indicators),
       JSON.stringify(r.dependencies), JSON.stringify(r.related_competencies),
       JSON.stringify(r.assessment_signals), r.future_relevance,
       JSON.stringify(r.proficiency_levels), r.development_timeline_weeks, r.is_foundational]
    );
  }
}

export function registerCompetencyDNARoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).then(() => seedDNA(pool)).catch(() => {});

  // GET /api/admin/talent/competency-dna — list
  app.get('/api/admin/talent/competency-dna', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cacheKey = `cdna_${JSON.stringify(req.query)}`;
    const cached = getCached(cacheKey);
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { blueprint_key, search, page = '1', limit = '25' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const where: string[] = [];
      if (blueprint_key) { params.push(blueprint_key); where.push(`blueprint_key=$${params.length}`); }
      if (search) { params.push(`%${search}%`); where.push(`(competency_name ILIKE $${params.length} OR competency_code ILIKE $${params.length})`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [countRes, rows, bps, kpi] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM competency_dna_master ${wc}`, params),
        pool.query(`SELECT * FROM competency_dna_master ${wc} ORDER BY blueprint_key, competency_name LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), offset]),
        pool.query(`SELECT blueprint_key, COUNT(*) as competency_count, ROUND(AVG(development_timeline_weeks),0) as avg_dev_weeks FROM competency_dna_master GROUP BY blueprint_key ORDER BY blueprint_key`),
        pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE is_foundational) as foundational_count, COUNT(*) FILTER (WHERE future_relevance='critical') as critical_count FROM competency_dna_master`),
      ]);
      const result = { total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, blueprints: bps.rows, kpi: kpi.rows[0] };
      setCache(cacheKey, result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/competency-dna/:code — single DNA record
  app.get('/api/admin/talent/competency-dna/:code', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const r = await pool.query('SELECT * FROM competency_dna_master WHERE competency_code=$1', [req.params.code]);
      if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
      const signals = await pool.query(
        `SELECT s.signal_code, s.signal_name, s.category, s.future_relevance
         FROM ti_signal_master s WHERE s.signal_code = ANY($1::text[])`,
        [r.rows[0].assessment_signals]
      ).catch(() => ({ rows: [] }));
      res.json({ dna: r.rows[0], linked_signals: signals.rows });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // POST /api/admin/talent/competency-dna — create
  app.post('/api/admin/talent/competency-dna', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { blueprint_key, competency_name, competency_code, description, micro_competencies, behavior_indicators, failure_indicators, growth_indicators, dependencies, related_competencies, assessment_signals, future_relevance, proficiency_levels, development_timeline_weeks, is_foundational } = req.body;
    if (!blueprint_key || !competency_name || !competency_code) return res.status(400).json({ error: 'blueprint_key, competency_name, competency_code required' });
    try {
      const r = await pool.query(
        `INSERT INTO competency_dna_master(blueprint_key,competency_name,competency_code,description,micro_competencies,behavior_indicators,failure_indicators,growth_indicators,dependencies,related_competencies,assessment_signals,future_relevance,proficiency_levels,development_timeline_weeks,is_foundational)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [blueprint_key, competency_name, competency_code, description,
         JSON.stringify(micro_competencies || []), JSON.stringify(behavior_indicators || []),
         JSON.stringify(failure_indicators || []), JSON.stringify(growth_indicators || []),
         JSON.stringify(dependencies || []), JSON.stringify(related_competencies || []),
         JSON.stringify(assessment_signals || []), future_relevance || 'high',
         JSON.stringify(proficiency_levels || {}), development_timeline_weeks || 12, is_foundational || false]
      );
      bustCache(); res.json({ ok: true, dna: r.rows[0] });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // PATCH /api/admin/talent/competency-dna/:code — update
  app.patch('/api/admin/talent/competency-dna/:code', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const jsonFields = ['micro_competencies','behavior_indicators','failure_indicators','growth_indicators','dependencies','related_competencies','assessment_signals','proficiency_levels'];
    const scalarFields = ['description','future_relevance','development_timeline_weeks','is_foundational'];
    const updates: string[] = []; const params: unknown[] = [];
    for (const f of [...jsonFields, ...scalarFields]) {
      if (req.body[f] !== undefined) {
        params.push(jsonFields.includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
        updates.push(`${f}=$${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'no fields to update' });
    params.push(req.params.code);
    try {
      const r = await pool.query(`UPDATE competency_dna_master SET ${updates.join(',')},updated_at=NOW() WHERE competency_code=$${params.length} RETURNING *`, params);
      bustCache(); res.json({ ok: true, dna: r.rows[0] });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // GET /api/admin/talent/competency-dna/blueprint/:key — all DNA for a blueprint
  app.get('/api/admin/talent/competency-dna/blueprint/:key', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await pool.query('SELECT * FROM competency_dna_master WHERE blueprint_key=$1 ORDER BY is_foundational DESC, competency_name', [req.params.key]);
      res.json({ blueprint_key: req.params.key, competencies: rows.rows, count: rows.rows.length });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/talent/competency-dna/gap-guidance/:email — gap-specific DNA for a user
  app.get('/api/talent/competency-dna/gap-guidance/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const gaps = await pool.query('SELECT * FROM talent_gaps WHERE user_email=$1 ORDER BY gap_score DESC LIMIT 5', [email]).catch(() => ({ rows: [] }));
      if (!gaps.rows.length) return res.json({ email, guidance: [], message: 'No talent gaps found — compute scores first' });
      const blueprintKeys = [...new Set(gaps.rows.map((g: any) => g.rf_id))];
      const dna = await pool.query('SELECT * FROM competency_dna_master WHERE blueprint_key=ANY($1) AND is_foundational=true ORDER BY development_timeline_weeks', [blueprintKeys]).catch(() => ({ rows: [] }));
      res.json({ email, gaps: gaps.rows, development_guidance: dna.rows, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-competency-dna] D5 routes registered — competency DNA framework seeded');
}

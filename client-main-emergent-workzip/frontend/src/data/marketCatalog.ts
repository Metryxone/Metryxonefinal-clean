// ============================================================================
// MetryxOne — Curated market catalog (40 roles)
// Demand / salary / growth figures are normalized indices (0-100) for India 2025-26
// derived from publicly published Naukri JobSpeak, NASSCOM, BLS Occupational
// Outlook trend curves. Refresh quarterly via scripts/refresh-market.ts.
// ============================================================================

export type RoleFamily =
  | 'engineering' | 'data' | 'design' | 'product' | 'marketing'
  | 'sales' | 'finance' | 'operations' | 'hr' | 'consulting';

export interface Competency {
  id: string;
  label: string;
  domain: 'technical' | 'analytical' | 'communication' | 'leadership' | 'creative' | 'execution' | 'behavioral';
}

export interface MarketRole {
  id: string;
  title: string;
  family: RoleFamily;
  /** 0-100, demand index — higher = more open positions */
  demandScore: number;
  /** 0-100, demand growth over 36 months */
  growth36mo: number;
  /** Indian Rupees, 50th percentile annual */
  salaryP50: number;
  /** 0-100, automation displacement risk over 5 years */
  automationRisk: number;
  /** Required competencies with target proficiency 0-5 */
  competencies: { id: string; required: 1 | 2 | 3 | 4 | 5 }[];
  /** Critical skill keywords used for keyword-based JD fitment */
  skills: string[];
  /** Adjacent role IDs that have high skill overlap — used for switchability */
  adjacentRoles: string[];
  /** Behavioral target — 0-100 ideal score on each axis */
  behavioralTarget: { drive: number; collaboration: number; creativity: number; rigor: number; resilience: number };
}

export const COMPETENCY_DOMAINS: Competency[] = [
  // Technical
  { id: 'programming',      label: 'Programming',         domain: 'technical' },
  { id: 'systems-design',   label: 'Systems Design',      domain: 'technical' },
  { id: 'cloud',            label: 'Cloud & DevOps',      domain: 'technical' },
  { id: 'data-engineering', label: 'Data Engineering',    domain: 'technical' },
  { id: 'security',         label: 'Security',            domain: 'technical' },
  // Analytical
  { id: 'data-analysis',    label: 'Data Analysis',       domain: 'analytical' },
  { id: 'statistics',       label: 'Statistics & ML',     domain: 'analytical' },
  { id: 'business-acumen',  label: 'Business Acumen',     domain: 'analytical' },
  { id: 'research',         label: 'Research',            domain: 'analytical' },
  // Communication
  { id: 'writing',          label: 'Writing',             domain: 'communication' },
  { id: 'presentation',     label: 'Presentation',        domain: 'communication' },
  { id: 'stakeholder-mgmt', label: 'Stakeholder Mgmt',    domain: 'communication' },
  // Leadership
  { id: 'people-mgmt',      label: 'People Management',   domain: 'leadership' },
  { id: 'strategy',         label: 'Strategic Thinking',  domain: 'leadership' },
  { id: 'mentoring',        label: 'Mentoring',           domain: 'leadership' },
  // Creative
  { id: 'design-thinking',  label: 'Design Thinking',     domain: 'creative' },
  { id: 'visual-design',    label: 'Visual Design',       domain: 'creative' },
  { id: 'storytelling',     label: 'Storytelling',        domain: 'creative' },
  // Execution
  { id: 'project-mgmt',     label: 'Project Management',  domain: 'execution' },
  { id: 'process',          label: 'Process Excellence',  domain: 'execution' },
  { id: 'negotiation',      label: 'Negotiation',         domain: 'execution' },
  // Behavioral
  { id: 'drive',            label: 'Drive & Ownership',   domain: 'behavioral' },
  { id: 'collaboration',    label: 'Collaboration',       domain: 'behavioral' },
  { id: 'resilience',       label: 'Resilience',          domain: 'behavioral' },
];

export const MARKET_CATALOG: MarketRole[] = [
  // ── Engineering ─────────────────────────────────────────────────────────
  { id: 'fe-engineer', title: 'Frontend Engineer', family: 'engineering',
    demandScore: 82, growth36mo: 58, salaryP50: 1400000, automationRisk: 28,
    competencies: [
      { id: 'programming', required: 4 }, { id: 'systems-design', required: 3 },
      { id: 'visual-design', required: 3 }, { id: 'collaboration', required: 4 },
    ],
    skills: ['react','typescript','javascript','css','tailwind','vite','redux','accessibility','testing'],
    adjacentRoles: ['fullstack-engineer','mobile-engineer','ui-designer','product-designer'],
    behavioralTarget: { drive: 70, collaboration: 80, creativity: 70, rigor: 75, resilience: 65 } },
  { id: 'be-engineer', title: 'Backend Engineer', family: 'engineering',
    demandScore: 88, growth36mo: 62, salaryP50: 1600000, automationRisk: 25,
    competencies: [
      { id: 'programming', required: 4 }, { id: 'systems-design', required: 4 },
      { id: 'cloud', required: 3 }, { id: 'security', required: 2 },
    ],
    skills: ['nodejs','python','java','postgresql','redis','docker','kubernetes','rest','graphql'],
    adjacentRoles: ['fullstack-engineer','devops-engineer','data-engineer','solution-architect'],
    behavioralTarget: { drive: 75, collaboration: 70, creativity: 55, rigor: 90, resilience: 70 } },
  { id: 'fullstack-engineer', title: 'Full-Stack Engineer', family: 'engineering',
    demandScore: 90, growth36mo: 65, salaryP50: 1700000, automationRisk: 30,
    competencies: [
      { id: 'programming', required: 4 }, { id: 'systems-design', required: 3 },
      { id: 'cloud', required: 3 }, { id: 'collaboration', required: 4 },
    ],
    skills: ['react','nodejs','typescript','postgresql','aws','docker','rest','graphql'],
    adjacentRoles: ['fe-engineer','be-engineer','mobile-engineer'],
    behavioralTarget: { drive: 78, collaboration: 78, creativity: 65, rigor: 80, resilience: 72 } },
  { id: 'mobile-engineer', title: 'Mobile Engineer', family: 'engineering',
    demandScore: 70, growth36mo: 45, salaryP50: 1500000, automationRisk: 35,
    competencies: [
      { id: 'programming', required: 4 }, { id: 'systems-design', required: 3 },
      { id: 'visual-design', required: 2 },
    ],
    skills: ['react-native','swift','kotlin','flutter','ios','android','mobile-perf'],
    adjacentRoles: ['fe-engineer','fullstack-engineer'],
    behavioralTarget: { drive: 72, collaboration: 70, creativity: 65, rigor: 80, resilience: 68 } },
  { id: 'devops-engineer', title: 'DevOps / Platform Engineer', family: 'engineering',
    demandScore: 85, growth36mo: 70, salaryP50: 1900000, automationRisk: 22,
    competencies: [
      { id: 'cloud', required: 5 }, { id: 'systems-design', required: 4 },
      { id: 'security', required: 3 }, { id: 'process', required: 3 },
    ],
    skills: ['aws','gcp','kubernetes','terraform','ansible','ci-cd','linux','observability'],
    adjacentRoles: ['be-engineer','sre','cloud-architect','solution-architect'],
    behavioralTarget: { drive: 75, collaboration: 72, creativity: 50, rigor: 92, resilience: 80 } },
  { id: 'sre', title: 'Site Reliability Engineer', family: 'engineering',
    demandScore: 78, growth36mo: 60, salaryP50: 2100000, automationRisk: 20,
    competencies: [
      { id: 'cloud', required: 5 }, { id: 'systems-design', required: 4 },
      { id: 'data-analysis', required: 3 }, { id: 'resilience', required: 4 },
    ],
    skills: ['kubernetes','observability','prometheus','grafana','incident-response','linux','python'],
    adjacentRoles: ['devops-engineer','be-engineer','cloud-architect'],
    behavioralTarget: { drive: 80, collaboration: 70, creativity: 50, rigor: 95, resilience: 90 } },
  { id: 'security-engineer', title: 'Security Engineer', family: 'engineering',
    demandScore: 80, growth36mo: 75, salaryP50: 2000000, automationRisk: 18,
    competencies: [
      { id: 'security', required: 5 }, { id: 'systems-design', required: 3 },
      { id: 'programming', required: 3 }, { id: 'process', required: 4 },
    ],
    skills: ['penetration-testing','threat-modeling','iam','sast','dast','cloud-security','siem'],
    adjacentRoles: ['devops-engineer','be-engineer','cloud-architect'],
    behavioralTarget: { drive: 78, collaboration: 65, creativity: 55, rigor: 95, resilience: 80 } },
  { id: 'cloud-architect', title: 'Cloud Architect', family: 'engineering',
    demandScore: 75, growth36mo: 55, salaryP50: 2800000, automationRisk: 25,
    competencies: [
      { id: 'cloud', required: 5 }, { id: 'systems-design', required: 5 },
      { id: 'strategy', required: 3 }, { id: 'stakeholder-mgmt', required: 3 },
    ],
    skills: ['aws','gcp','azure','well-architected','networking','cost-optimization'],
    adjacentRoles: ['devops-engineer','sre','solution-architect'],
    behavioralTarget: { drive: 80, collaboration: 78, creativity: 60, rigor: 90, resilience: 78 } },
  { id: 'qa-engineer', title: 'QA / Test Engineer', family: 'engineering',
    demandScore: 60, growth36mo: 30, salaryP50: 1100000, automationRisk: 55,
    competencies: [
      { id: 'process', required: 4 }, { id: 'programming', required: 3 },
    ],
    skills: ['selenium','playwright','cypress','test-automation','jira','api-testing'],
    adjacentRoles: ['be-engineer','devops-engineer'],
    behavioralTarget: { drive: 65, collaboration: 75, creativity: 50, rigor: 90, resilience: 70 } },

  // ── Data ────────────────────────────────────────────────────────────────
  { id: 'data-analyst', title: 'Data Analyst', family: 'data',
    demandScore: 78, growth36mo: 50, salaryP50: 1100000, automationRisk: 50,
    competencies: [
      { id: 'data-analysis', required: 4 }, { id: 'statistics', required: 3 },
      { id: 'business-acumen', required: 3 }, { id: 'storytelling', required: 3 },
    ],
    skills: ['sql','python','excel','tableau','powerbi','statistics','etl'],
    adjacentRoles: ['ds','data-engineer','bi-analyst','product-analyst'],
    behavioralTarget: { drive: 70, collaboration: 75, creativity: 60, rigor: 85, resilience: 65 } },
  { id: 'ds', title: 'Data Scientist', family: 'data',
    demandScore: 85, growth36mo: 68, salaryP50: 1800000, automationRisk: 40,
    competencies: [
      { id: 'statistics', required: 5 }, { id: 'programming', required: 4 },
      { id: 'data-analysis', required: 4 }, { id: 'business-acumen', required: 3 },
    ],
    skills: ['python','sql','ml','pandas','scikit-learn','tensorflow','pytorch','statistics'],
    adjacentRoles: ['ml-engineer','data-analyst','ai-engineer'],
    behavioralTarget: { drive: 75, collaboration: 70, creativity: 75, rigor: 90, resilience: 70 } },
  { id: 'ml-engineer', title: 'Machine Learning Engineer', family: 'data',
    demandScore: 88, growth36mo: 78, salaryP50: 2400000, automationRisk: 28,
    competencies: [
      { id: 'programming', required: 5 }, { id: 'statistics', required: 4 },
      { id: 'systems-design', required: 4 }, { id: 'cloud', required: 3 },
    ],
    skills: ['python','pytorch','tensorflow','mlops','kubernetes','aws-sagemaker','feature-store','llm'],
    adjacentRoles: ['ds','ai-engineer','be-engineer','data-engineer'],
    behavioralTarget: { drive: 80, collaboration: 70, creativity: 75, rigor: 92, resilience: 75 } },
  { id: 'ai-engineer', title: 'AI / GenAI Engineer', family: 'data',
    demandScore: 95, growth36mo: 92, salaryP50: 2600000, automationRisk: 15,
    competencies: [
      { id: 'programming', required: 4 }, { id: 'statistics', required: 4 },
      { id: 'systems-design', required: 4 }, { id: 'research', required: 3 },
    ],
    skills: ['llm','rag','langchain','vector-db','prompt-engineering','python','openai','embeddings'],
    adjacentRoles: ['ml-engineer','ds','be-engineer'],
    behavioralTarget: { drive: 85, collaboration: 70, creativity: 85, rigor: 85, resilience: 75 } },
  { id: 'data-engineer', title: 'Data Engineer', family: 'data',
    demandScore: 82, growth36mo: 65, salaryP50: 1700000, automationRisk: 30,
    competencies: [
      { id: 'data-engineering', required: 5 }, { id: 'programming', required: 4 },
      { id: 'cloud', required: 3 }, { id: 'systems-design', required: 3 },
    ],
    skills: ['python','sql','airflow','spark','kafka','snowflake','dbt','aws'],
    adjacentRoles: ['be-engineer','ml-engineer','data-analyst'],
    behavioralTarget: { drive: 75, collaboration: 70, creativity: 60, rigor: 90, resilience: 72 } },
  { id: 'bi-analyst', title: 'BI Analyst', family: 'data',
    demandScore: 65, growth36mo: 35, salaryP50: 1000000, automationRisk: 55,
    competencies: [
      { id: 'data-analysis', required: 4 }, { id: 'business-acumen', required: 4 },
      { id: 'storytelling', required: 4 },
    ],
    skills: ['powerbi','tableau','sql','excel','dax','dashboards'],
    adjacentRoles: ['data-analyst','product-analyst'],
    behavioralTarget: { drive: 65, collaboration: 75, creativity: 60, rigor: 80, resilience: 60 } },

  // ── Design ──────────────────────────────────────────────────────────────
  { id: 'ux-designer', title: 'UX Designer', family: 'design',
    demandScore: 70, growth36mo: 48, salaryP50: 1300000, automationRisk: 35,
    competencies: [
      { id: 'design-thinking', required: 5 }, { id: 'research', required: 4 },
      { id: 'visual-design', required: 3 }, { id: 'collaboration', required: 4 },
    ],
    skills: ['figma','user-research','wireframing','prototyping','usability-testing','design-systems'],
    adjacentRoles: ['product-designer','ui-designer','ux-researcher'],
    behavioralTarget: { drive: 70, collaboration: 85, creativity: 90, rigor: 75, resilience: 65 } },
  { id: 'product-designer', title: 'Product Designer', family: 'design',
    demandScore: 78, growth36mo: 55, salaryP50: 1600000, automationRisk: 30,
    competencies: [
      { id: 'design-thinking', required: 5 }, { id: 'visual-design', required: 4 },
      { id: 'business-acumen', required: 3 }, { id: 'storytelling', required: 4 },
    ],
    skills: ['figma','design-systems','interaction-design','prototyping','user-research','product-thinking'],
    adjacentRoles: ['ux-designer','ui-designer','ux-researcher'],
    behavioralTarget: { drive: 75, collaboration: 85, creativity: 90, rigor: 78, resilience: 70 } },
  { id: 'ui-designer', title: 'UI / Visual Designer', family: 'design',
    demandScore: 60, growth36mo: 35, salaryP50: 1000000, automationRisk: 50,
    competencies: [
      { id: 'visual-design', required: 5 }, { id: 'design-thinking', required: 3 },
    ],
    skills: ['figma','illustrator','typography','color-theory','design-systems','motion'],
    adjacentRoles: ['product-designer','ux-designer'],
    behavioralTarget: { drive: 65, collaboration: 75, creativity: 95, rigor: 70, resilience: 60 } },
  { id: 'ux-researcher', title: 'UX Researcher', family: 'design',
    demandScore: 55, growth36mo: 42, salaryP50: 1500000, automationRisk: 30,
    competencies: [
      { id: 'research', required: 5 }, { id: 'data-analysis', required: 3 },
      { id: 'storytelling', required: 4 }, { id: 'stakeholder-mgmt', required: 4 },
    ],
    skills: ['user-interviews','surveys','usability','synthesis','statistics','dovetail'],
    adjacentRoles: ['ux-designer','product-analyst'],
    behavioralTarget: { drive: 70, collaboration: 85, creativity: 75, rigor: 85, resilience: 70 } },

  // ── Product ─────────────────────────────────────────────────────────────
  { id: 'pm', title: 'Product Manager', family: 'product',
    demandScore: 80, growth36mo: 55, salaryP50: 2200000, automationRisk: 18,
    competencies: [
      { id: 'business-acumen', required: 5 }, { id: 'stakeholder-mgmt', required: 5 },
      { id: 'strategy', required: 4 }, { id: 'data-analysis', required: 3 },
    ],
    skills: ['roadmapping','user-research','prioritization','ab-testing','sql','okr','jira'],
    adjacentRoles: ['product-analyst','program-manager','pmm','strategy-consultant'],
    behavioralTarget: { drive: 88, collaboration: 90, creativity: 80, rigor: 80, resilience: 80 } },
  { id: 'product-analyst', title: 'Product Analyst', family: 'product',
    demandScore: 68, growth36mo: 50, salaryP50: 1300000, automationRisk: 38,
    competencies: [
      { id: 'data-analysis', required: 4 }, { id: 'business-acumen', required: 4 },
      { id: 'statistics', required: 3 },
    ],
    skills: ['sql','amplitude','mixpanel','python','ab-testing','statistics'],
    adjacentRoles: ['pm','data-analyst','ds'],
    behavioralTarget: { drive: 75, collaboration: 78, creativity: 65, rigor: 85, resilience: 70 } },
  { id: 'program-manager', title: 'Technical Program Manager', family: 'product',
    demandScore: 65, growth36mo: 40, salaryP50: 2400000, automationRisk: 22,
    competencies: [
      { id: 'project-mgmt', required: 5 }, { id: 'stakeholder-mgmt', required: 5 },
      { id: 'systems-design', required: 3 },
    ],
    skills: ['program-management','jira','agile','risk-management','cross-functional'],
    adjacentRoles: ['pm','project-manager'],
    behavioralTarget: { drive: 85, collaboration: 90, creativity: 60, rigor: 88, resilience: 80 } },

  // ── Marketing ───────────────────────────────────────────────────────────
  { id: 'pmm', title: 'Product Marketing Manager', family: 'marketing',
    demandScore: 65, growth36mo: 45, salaryP50: 1900000, automationRisk: 28,
    competencies: [
      { id: 'storytelling', required: 5 }, { id: 'business-acumen', required: 4 },
      { id: 'writing', required: 4 }, { id: 'stakeholder-mgmt', required: 4 },
    ],
    skills: ['positioning','messaging','launch','competitive-research','content','sales-enablement'],
    adjacentRoles: ['pm','content-marketer','growth-marketer'],
    behavioralTarget: { drive: 80, collaboration: 85, creativity: 85, rigor: 70, resilience: 72 } },
  { id: 'growth-marketer', title: 'Growth Marketer', family: 'marketing',
    demandScore: 70, growth36mo: 55, salaryP50: 1500000, automationRisk: 30,
    competencies: [
      { id: 'data-analysis', required: 4 }, { id: 'business-acumen', required: 4 },
      { id: 'writing', required: 3 },
    ],
    skills: ['seo','sem','paid-ads','analytics','ab-testing','funnel','crm'],
    adjacentRoles: ['pmm','content-marketer','digital-marketer'],
    behavioralTarget: { drive: 88, collaboration: 75, creativity: 80, rigor: 80, resilience: 80 } },
  { id: 'content-marketer', title: 'Content Marketer', family: 'marketing',
    demandScore: 55, growth36mo: 35, salaryP50: 900000, automationRisk: 60,
    competencies: [
      { id: 'writing', required: 5 }, { id: 'storytelling', required: 4 },
      { id: 'research', required: 3 },
    ],
    skills: ['copywriting','seo','content-strategy','editing','social','email'],
    adjacentRoles: ['pmm','growth-marketer'],
    behavioralTarget: { drive: 70, collaboration: 70, creativity: 90, rigor: 70, resilience: 65 } },
  { id: 'digital-marketer', title: 'Digital Marketing Specialist', family: 'marketing',
    demandScore: 62, growth36mo: 30, salaryP50: 800000, automationRisk: 65,
    competencies: [
      { id: 'data-analysis', required: 3 }, { id: 'writing', required: 3 },
    ],
    skills: ['google-ads','meta-ads','seo','analytics','email','crm'],
    adjacentRoles: ['growth-marketer','content-marketer'],
    behavioralTarget: { drive: 75, collaboration: 70, creativity: 70, rigor: 70, resilience: 70 } },

  // ── Sales ───────────────────────────────────────────────────────────────
  { id: 'ae', title: 'Account Executive', family: 'sales',
    demandScore: 70, growth36mo: 35, salaryP50: 1800000, automationRisk: 25,
    competencies: [
      { id: 'negotiation', required: 5 }, { id: 'stakeholder-mgmt', required: 5 },
      { id: 'storytelling', required: 4 },
    ],
    skills: ['saas-sales','crm','salesforce','pipeline','closing','discovery'],
    adjacentRoles: ['sdr','sales-engineer','customer-success'],
    behavioralTarget: { drive: 95, collaboration: 80, creativity: 70, rigor: 75, resilience: 90 } },
  { id: 'sdr', title: 'Sales Development Rep', family: 'sales',
    demandScore: 75, growth36mo: 30, salaryP50: 700000, automationRisk: 50,
    competencies: [
      { id: 'writing', required: 3 }, { id: 'negotiation', required: 3 },
      { id: 'resilience', required: 4 },
    ],
    skills: ['outbound','cold-email','linkedin','crm','prospecting','salesforce'],
    adjacentRoles: ['ae','customer-success'],
    behavioralTarget: { drive: 92, collaboration: 75, creativity: 70, rigor: 70, resilience: 92 } },
  { id: 'customer-success', title: 'Customer Success Manager', family: 'sales',
    demandScore: 72, growth36mo: 45, salaryP50: 1400000, automationRisk: 30,
    competencies: [
      { id: 'stakeholder-mgmt', required: 5 }, { id: 'business-acumen', required: 4 },
      { id: 'project-mgmt', required: 3 },
    ],
    skills: ['account-management','retention','crm','onboarding','renewal','upsell'],
    adjacentRoles: ['ae','pm'],
    behavioralTarget: { drive: 80, collaboration: 92, creativity: 70, rigor: 78, resilience: 80 } },

  // ── Finance ─────────────────────────────────────────────────────────────
  { id: 'financial-analyst', title: 'Financial Analyst', family: 'finance',
    demandScore: 60, growth36mo: 28, salaryP50: 1100000, automationRisk: 55,
    competencies: [
      { id: 'data-analysis', required: 4 }, { id: 'business-acumen', required: 4 },
      { id: 'process', required: 3 },
    ],
    skills: ['excel','financial-modeling','sql','powerbi','accounting','valuation'],
    adjacentRoles: ['fpa-analyst','data-analyst','consultant'],
    behavioralTarget: { drive: 72, collaboration: 70, creativity: 55, rigor: 92, resilience: 70 } },
  { id: 'fpa-analyst', title: 'FP&A Analyst', family: 'finance',
    demandScore: 58, growth36mo: 32, salaryP50: 1300000, automationRisk: 50,
    competencies: [
      { id: 'data-analysis', required: 4 }, { id: 'business-acumen', required: 5 },
      { id: 'storytelling', required: 3 },
    ],
    skills: ['budgeting','forecasting','excel','sql','financial-modeling','variance-analysis'],
    adjacentRoles: ['financial-analyst','consultant'],
    behavioralTarget: { drive: 75, collaboration: 75, creativity: 60, rigor: 92, resilience: 72 } },

  // ── Operations / HR / Consulting ────────────────────────────────────────
  { id: 'ops-manager', title: 'Operations Manager', family: 'operations',
    demandScore: 65, growth36mo: 30, salaryP50: 1400000, automationRisk: 35,
    competencies: [
      { id: 'process', required: 5 }, { id: 'people-mgmt', required: 4 },
      { id: 'data-analysis', required: 3 },
    ],
    skills: ['process-improvement','six-sigma','vendor-mgmt','sla','excel'],
    adjacentRoles: ['program-manager','consultant','project-manager'],
    behavioralTarget: { drive: 80, collaboration: 82, creativity: 60, rigor: 88, resilience: 80 } },
  { id: 'project-manager', title: 'Project Manager', family: 'operations',
    demandScore: 62, growth36mo: 28, salaryP50: 1300000, automationRisk: 32,
    competencies: [
      { id: 'project-mgmt', required: 5 }, { id: 'stakeholder-mgmt', required: 4 },
    ],
    skills: ['pmp','agile','scrum','jira','msproject','risk'],
    adjacentRoles: ['program-manager','ops-manager'],
    behavioralTarget: { drive: 80, collaboration: 88, creativity: 60, rigor: 85, resilience: 78 } },
  { id: 'hrbp', title: 'HR Business Partner', family: 'hr',
    demandScore: 55, growth36mo: 25, salaryP50: 1500000, automationRisk: 30,
    competencies: [
      { id: 'people-mgmt', required: 4 }, { id: 'stakeholder-mgmt', required: 5 },
      { id: 'business-acumen', required: 3 },
    ],
    skills: ['hrbp','employee-relations','talent','okr','workday','culture'],
    adjacentRoles: ['talent-acquisition','people-ops'],
    behavioralTarget: { drive: 75, collaboration: 92, creativity: 65, rigor: 78, resilience: 80 } },
  { id: 'talent-acquisition', title: 'Talent Acquisition Lead', family: 'hr',
    demandScore: 60, growth36mo: 30, salaryP50: 1200000, automationRisk: 40,
    competencies: [
      { id: 'stakeholder-mgmt', required: 4 }, { id: 'negotiation', required: 4 },
    ],
    skills: ['recruiting','sourcing','linkedin-recruiter','ats','interviewing','employer-brand'],
    adjacentRoles: ['hrbp','sdr'],
    behavioralTarget: { drive: 82, collaboration: 88, creativity: 70, rigor: 75, resilience: 80 } },
  { id: 'people-ops', title: 'People Operations Specialist', family: 'hr',
    demandScore: 50, growth36mo: 25, salaryP50: 900000, automationRisk: 50,
    competencies: [
      { id: 'process', required: 4 }, { id: 'stakeholder-mgmt', required: 3 },
    ],
    skills: ['hris','workday','onboarding','policy','compliance','payroll'],
    adjacentRoles: ['hrbp','ops-manager'],
    behavioralTarget: { drive: 70, collaboration: 85, creativity: 55, rigor: 88, resilience: 72 } },
  { id: 'consultant', title: 'Management Consultant', family: 'consulting',
    demandScore: 70, growth36mo: 40, salaryP50: 2500000, automationRisk: 25,
    competencies: [
      { id: 'business-acumen', required: 5 }, { id: 'storytelling', required: 5 },
      { id: 'data-analysis', required: 4 }, { id: 'stakeholder-mgmt', required: 4 },
    ],
    skills: ['strategy','financial-modeling','market-research','powerpoint','excel','frameworks'],
    adjacentRoles: ['strategy-consultant','financial-analyst','pm'],
    behavioralTarget: { drive: 90, collaboration: 85, creativity: 80, rigor: 88, resilience: 88 } },
  { id: 'strategy-consultant', title: 'Strategy Consultant', family: 'consulting',
    demandScore: 60, growth36mo: 38, salaryP50: 3000000, automationRisk: 22,
    competencies: [
      { id: 'strategy', required: 5 }, { id: 'business-acumen', required: 5 },
      { id: 'storytelling', required: 5 },
    ],
    skills: ['corporate-strategy','m&a','market-analysis','financial-modeling','presentation'],
    adjacentRoles: ['consultant','pm'],
    behavioralTarget: { drive: 92, collaboration: 80, creativity: 85, rigor: 88, resilience: 90 } },

  // ── Additional high-demand roles ────────────────────────────────────────
  { id: 'solution-architect', title: 'Solution Architect', family: 'engineering',
    demandScore: 78, growth36mo: 50, salaryP50: 2700000, automationRisk: 22,
    competencies: [
      { id: 'systems-design', required: 5 }, { id: 'cloud', required: 4 },
      { id: 'stakeholder-mgmt', required: 4 }, { id: 'business-acumen', required: 3 },
    ],
    skills: ['enterprise-architecture','aws','azure','gcp','integration','rest','soap','microservices'],
    adjacentRoles: ['cloud-architect','be-engineer','consultant'],
    behavioralTarget: { drive: 78, collaboration: 82, creativity: 65, rigor: 88, resilience: 75 } },
  { id: 'sales-engineer', title: 'Sales Engineer', family: 'sales',
    demandScore: 72, growth36mo: 45, salaryP50: 2200000, automationRisk: 20,
    competencies: [
      { id: 'programming', required: 3 }, { id: 'storytelling', required: 4 },
      { id: 'stakeholder-mgmt', required: 5 }, { id: 'negotiation', required: 4 },
    ],
    skills: ['saas','technical-demo','poc','rfp','salesforce','api','integration','pre-sales'],
    adjacentRoles: ['ae','be-engineer','customer-success','consultant'],
    behavioralTarget: { drive: 88, collaboration: 88, creativity: 75, rigor: 80, resilience: 85 } },
];

export function findRoleById(id: string): MarketRole | undefined {
  return MARKET_CATALOG.find(r => r.id === id);
}

export function findRoleByTitle(title: string): MarketRole | undefined {
  if (!title) return undefined;
  const t = title.toLowerCase();
  return MARKET_CATALOG.find(r =>
    r.title.toLowerCase() === t ||
    r.title.toLowerCase().includes(t) ||
    t.includes(r.title.toLowerCase())
  );
}

export function getCompetency(id: string): Competency | undefined {
  return COMPETENCY_DOMAINS.find(c => c.id === id);
}

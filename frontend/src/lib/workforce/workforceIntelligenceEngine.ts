/**
 * Workforce Intelligence Engine — Phase 5
 * Labor market demand tracking, automation risk, emerging roles,
 * skill evolution, AI disruption analysis.
 */

/* ── Skill evolution catalog ────────────────────────────────────────── */
export type SkillStatus = 'emerging' | 'accelerating' | 'stable' | 'plateauing' | 'declining';

export interface SkillSignal {
  skill:           string;
  status:          SkillStatus;
  demandIndex:     number;    // 0-100
  growthRate:      number;    // % per year
  aiDisruptionRisk:number;    // 0-100 (risk of this skill being automated)
  halfLife:        number;    // years before 50% of practitioners need to upskill
  adjacentSkills:  string[];
  industries:      string[];
}

export const SKILL_SIGNALS: SkillSignal[] = [
  { skill:'Python',           status:'stable',       demandIndex:92, growthRate:12, aiDisruptionRisk:15, halfLife:4, adjacentSkills:['Machine Learning','Data Engineering','LLMs'],     industries:['Engineering','Data','AI','Finance'] },
  { skill:'LLMs / GenAI',     status:'accelerating', demandIndex:95, growthRate:85, aiDisruptionRisk:8,  halfLife:1.5, adjacentSkills:['Python','RAG','Langchain','Prompt Engineering'], industries:['Engineering','Product','Finance','Healthcare'] },
  { skill:'Prompt Engineering',status:'emerging',    demandIndex:72, growthRate:120,aiDisruptionRisk:50, halfLife:1,   adjacentSkills:['LLMs / GenAI','Python','NLP'],                  industries:['Engineering','Marketing','Consulting'] },
  { skill:'RAG / Vector DBs', status:'emerging',     demandIndex:68, growthRate:140,aiDisruptionRisk:12, halfLife:2,   adjacentSkills:['LLMs / GenAI','Python','Embeddings'],            industries:['Engineering','AI','Data'] },
  { skill:'Cloud Architecture',status:'accelerating',demandIndex:88, growthRate:22, aiDisruptionRisk:10, halfLife:3,   adjacentSkills:['AWS','Kubernetes','Terraform'],                  industries:['Engineering','Finance','Healthcare'] },
  { skill:'Kubernetes',       status:'stable',       demandIndex:82, growthRate:18, aiDisruptionRisk:20, halfLife:3.5, adjacentSkills:['Docker','CI/CD','Cloud Architecture'],           industries:['Engineering'] },
  { skill:'Rust',             status:'emerging',     demandIndex:55, growthRate:45, aiDisruptionRisk:18, halfLife:5,   adjacentSkills:['C++','Systems Programming','WASM'],              industries:['Engineering','Fintech','Security'] },
  { skill:'TypeScript',       status:'stable',       demandIndex:88, growthRate:20, aiDisruptionRisk:22, halfLife:4,   adjacentSkills:['JavaScript','React','Node.js'],                  industries:['Engineering','Product'] },
  { skill:'SQL',              status:'stable',       demandIndex:85, growthRate:5,  aiDisruptionRisk:38, halfLife:6,   adjacentSkills:['Data Analysis','Python','Data Engineering'],     industries:['Data','Engineering','Finance','Operations'] },
  { skill:'Excel / Sheets',   status:'plateauing',   demandIndex:72, growthRate:-5, aiDisruptionRisk:65, halfLife:3,   adjacentSkills:['SQL','Power BI','Python'],                       industries:['Finance','Operations','HR','Marketing'] },
  { skill:'Power BI / Tableau',status:'stable',      demandIndex:70, growthRate:8,  aiDisruptionRisk:45, halfLife:3.5, adjacentSkills:['SQL','Excel / Sheets','Python'],                industries:['Data','Finance','Operations'] },
  { skill:'MLOps',            status:'accelerating', demandIndex:80, growthRate:55, aiDisruptionRisk:10, halfLife:2.5, adjacentSkills:['Machine Learning','Python','Kubernetes','Docker'],industries:['Engineering','AI','Data'] },
  { skill:'Cybersecurity',    status:'accelerating', demandIndex:89, growthRate:30, aiDisruptionRisk:12, halfLife:2,   adjacentSkills:['IAM','Penetration Testing','SIEM'],              industries:['Engineering','Finance','Government','Healthcare'] },
  { skill:'Product Strategy', status:'stable',       demandIndex:72, growthRate:10, aiDisruptionRisk:28, halfLife:5,   adjacentSkills:['Roadmapping','Agile','OKRs'],                    industries:['Product','Consulting','Engineering'] },
  { skill:'People Management',status:'stable',       demandIndex:70, growthRate:8,  aiDisruptionRisk:18, halfLife:7,   adjacentSkills:['Coaching','Strategy','OKRs'],                    industries:['Leadership'] },
  { skill:'Solidity / Web3',  status:'plateauing',   demandIndex:42, growthRate:-15,aiDisruptionRisk:30, halfLife:2,   adjacentSkills:['Rust','Ethereum','Smart Contracts'],             industries:['Fintech','Crypto'] },
  { skill:'Data Governance',  status:'emerging',     demandIndex:62, growthRate:40, aiDisruptionRisk:25, halfLife:4,   adjacentSkills:['SQL','Privacy','Data Engineering'],              industries:['Finance','Healthcare','Government'] },
  { skill:'Agile / Scrum',    status:'stable',       demandIndex:75, growthRate:5,  aiDisruptionRisk:30, halfLife:5,   adjacentSkills:['Product Strategy','OKRs','Leadership'],          industries:['Engineering','Product','Consulting'] },
  { skill:'System Design',    status:'stable',       demandIndex:84, growthRate:15, aiDisruptionRisk:14, halfLife:5,   adjacentSkills:['Cloud Architecture','Programming','Architecture'],industries:['Engineering'] },
  { skill:'Leadership',       status:'stable',       demandIndex:68, growthRate:8,  aiDisruptionRisk:10, halfLife:8,   adjacentSkills:['People Management','Strategy','Coaching'],       industries:['All'] },
];

/* ── Emerging roles catalog ─────────────────────────────────────────── */
export interface EmergingRole {
  id:             string;
  title:          string;
  family:         string;
  emergenceHorizon:'now' | '12mo' | '24mo' | '36mo';
  demandScore:    number;    // 0-100
  salaryP50Range: string;
  growthRate:     number;    // % growth per year
  requiredSkills: string[];
  displacedRoles: string[];
  aiNative:       boolean;
  description:    string;
}

export const EMERGING_ROLES: EmergingRole[] = [
  { id:'ai-engineer',    title:'AI Engineer',              family:'Engineering', emergenceHorizon:'now',  demandScore:93, salaryP50Range:'₹18–75 LPA', growthRate:45, requiredSkills:['Python','LLMs / GenAI','RAG / Vector DBs','System Design'],      displacedRoles:['Data Scientist','ML Engineer (classic)'], aiNative:true,  description:'Builds and deploys LLM-powered applications, agentic systems, and RAG pipelines.' },
  { id:'llm-ops',        title:'LLMOps Engineer',          family:'Engineering', emergenceHorizon:'12mo', demandScore:78, salaryP50Range:'₹20–80 LPA', growthRate:90, requiredSkills:['Python','LLMs / GenAI','MLOps','Kubernetes'],                   displacedRoles:['MLOps Engineer (legacy)'],                aiNative:true,  description:'Manages LLM lifecycle, evaluation, fine-tuning, and production observability.' },
  { id:'ai-product-mgr', title:'AI Product Manager',       family:'Product',     emergenceHorizon:'12mo', demandScore:75, salaryP50Range:'₹18–60 LPA', growthRate:60, requiredSkills:['Product Strategy','LLMs / GenAI','Prompt Engineering','Agile'],   displacedRoles:['Traditional Product Manager'],            aiNative:true,  description:'Builds AI-native products with deep understanding of model capabilities and UX.' },
  { id:'red-team',       title:'AI Red Team Specialist',   family:'Security',    emergenceHorizon:'24mo', demandScore:65, salaryP50Range:'₹15–55 LPA', growthRate:70, requiredSkills:['Cybersecurity','LLMs / GenAI','Penetration Testing','Python'],   displacedRoles:[],                                         aiNative:true,  description:'Adversarially tests AI systems for safety, bias, and security vulnerabilities.' },
  { id:'data-gov',       title:'Data Governance Officer',  family:'Data',        emergenceHorizon:'now',  demandScore:68, salaryP50Range:'₹12–40 LPA', growthRate:40, requiredSkills:['Data Governance','SQL','Privacy','Data Engineering'],             displacedRoles:['Data Analyst (legacy)'],                  aiNative:false, description:'Ensures data quality, lineage, privacy, and regulatory compliance at scale.' },
  { id:'prompt-eng',     title:'Prompt Engineer',          family:'Engineering', emergenceHorizon:'now',  demandScore:72, salaryP50Range:'₹10–45 LPA', growthRate:120,requiredSkills:['Prompt Engineering','LLMs / GenAI','Python','NLP'],              displacedRoles:[],                                         aiNative:true,  description:'Designs, tests, and optimises prompts for production AI workflows.' },
  { id:'cyber-ai',       title:'AI-augmented Security Analyst',family:'Security', emergenceHorizon:'12mo', demandScore:80, salaryP50Range:'₹14–50 LPA', growthRate:55, requiredSkills:['Cybersecurity','LLMs / GenAI','SIEM','Python'],               displacedRoles:['Manual Security Analyst'],                aiNative:true,  description:'Uses AI tools to detect threats, automate response, and hunt vulnerabilities.' },
  { id:'ai-trainer',     title:'AI Trainer / RLHF Specialist',family:'AI',      emergenceHorizon:'now',  demandScore:65, salaryP50Range:'₹8–30 LPA',  growthRate:80, requiredSkills:['LLMs / GenAI','Data Annotation','Python','NLP'],               displacedRoles:[],                                         aiNative:true,  description:'Labels, evaluates, and generates training data for LLM fine-tuning via RLHF.' },
  { id:'platform-eng',   title:'Platform Engineer',        family:'Engineering', emergenceHorizon:'now',  demandScore:85, salaryP50Range:'₹18–65 LPA', growthRate:35, requiredSkills:['Kubernetes','Cloud Architecture','Terraform','CI/CD','System Design'],displacedRoles:['DevOps Engineer (generalist)'],          aiNative:false, description:'Builds internal developer platforms, self-service infra, and golden paths.' },
  { id:'quant-ml',       title:'Quantitative ML Engineer', family:'Finance',     emergenceHorizon:'24mo', demandScore:70, salaryP50Range:'₹25–100 LPA',growthRate:30, requiredSkills:['Python','Machine Learning','Statistics','System Design','Finance'],displacedRoles:['Quantitative Analyst (classic)'],        aiNative:true,  description:'Combines quant finance with ML to build trading, risk, and portfolio models.' },
];

/* ── AI disruption model ─────────────────────────────────────────── */
export interface AIDisruptionSignal {
  taskType:      string;
  disruptionRisk:number;    // 0-100
  timeline:      '1-2yr' | '2-5yr' | '5-10yr' | '10yr+';
  affectedRoles: string[];
  replacedBy:    string;
  description:   string;
}

export const AI_DISRUPTION_SIGNALS: AIDisruptionSignal[] = [
  { taskType:'Data Entry & Manual Reporting', disruptionRisk:92, timeline:'1-2yr',  affectedRoles:['Data Analyst','Finance Analyst','HR Ops'], replacedBy:'AI-powered ETL + auto-reporting',   description:'Structured data entry and periodic report generation are fully automatable today.' },
  { taskType:'Basic Code Review',             disruptionRisk:75, timeline:'2-5yr',  affectedRoles:['Junior Engineer','QA Engineer'],           replacedBy:'LLM-based code review agents',       description:'Pattern-based code review and style checking increasingly AI-handled.' },
  { taskType:'Customer Support (Tier 1)',     disruptionRisk:88, timeline:'1-2yr',  affectedRoles:['Support Agent','Call Centre'],             replacedBy:'LLM chatbots + RAG pipelines',        description:'First-line support is rapidly being replaced by LLM agents with knowledge bases.' },
  { taskType:'Content Writing (generic)',     disruptionRisk:70, timeline:'1-2yr',  affectedRoles:['Copywriter','Content Analyst'],            replacedBy:'GenAI content tools',                description:'Generic content creation is heavily automated; original insight remains human.' },
  { taskType:'Document Summarisation',        disruptionRisk:90, timeline:'1-2yr',  affectedRoles:['Legal Researcher','Analyst','Consultant'], replacedBy:'LLM summarisation tools',            description:'Summarising contracts, reports, and research papers is near-fully automatable.' },
  { taskType:'System Architecture Design',    disruptionRisk:22, timeline:'10yr+',  affectedRoles:['Cloud Architect','Principal Engineer'],    replacedBy:'AI-assisted (not replaced)',          description:'Complex trade-off-heavy design work remains deeply human for 10+ years.' },
  { taskType:'Complex Stakeholder Negotiation',disruptionRisk:8, timeline:'10yr+', affectedRoles:['Executive','BD Leader','PM'],              replacedBy:'Not automatable',                    description:'High-EI negotiation with contextual judgment resists automation indefinitely.' },
  { taskType:'Spreadsheet Analysis & Modelling',disruptionRisk:65,timeline:'2-5yr',affectedRoles:['Finance Analyst','Business Analyst'],      replacedBy:'AI spreadsheet copilots',            description:'Formula-heavy modelling increasingly AI-assisted; strategic interpretation human.' },
  { taskType:'Technical Recruitment Screening',disruptionRisk:80,timeline:'2-5yr', affectedRoles:['Technical Recruiter'],                    replacedBy:'AI CV screening + coding assessors',  description:'Resume screening and initial coding tests are increasingly AI-handled.' },
  { taskType:'Basic SQL Query Writing',       disruptionRisk:72, timeline:'2-5yr',  affectedRoles:['Data Analyst','Business Analyst'],        replacedBy:'Text-to-SQL AI tools',               description:'Natural language to SQL is production-ready; complex query design remains human.' },
];

/* ── Labor market trend catalog ─────────────────────────────────────── */
export interface MarketTrend {
  id:          string;
  title:       string;
  type:        'demand-shift' | 'skill-evolution' | 'ai-disruption' | 'org-change' | 'geographic';
  impact:      'high' | 'medium' | 'low';
  horizon:     '6mo' | '12mo' | '24mo' | '36mo';
  industries:  string[];
  description: string;
  implications:string[];
}

export const LABOR_MARKET_TRENDS: MarketTrend[] = [
  { id:'llm-native', title:'LLM-Native Development is the New Baseline', type:'skill-evolution', impact:'high', horizon:'12mo', industries:['Engineering','Product','Consulting'], description:'By mid-2025, LLM integration is expected in 60%+ of engineering job descriptions.', implications:['Python + LLM skills now minimum viable','Prompt engineering shifts from niche to commodity','Classic ML roles bifurcating into AI engineering and MLOps'] },
  { id:'ai-tax', title:'AI Productivity Tax on Head Count', type:'org-change', impact:'high', horizon:'12mo', industries:['Engineering','Finance','Marketing','HR'], description:'Orgs using AI tooling report 20–40% productivity gain per head; reducing headcount growth.', implications:['Hiring freezes in automatable roles','Fewer junior roles — senior bar rises','Output per person expected to increase 30%+'] },
  { id:'security-surge', title:'Cybersecurity Demand Outpaces Supply by 4M Globally', type:'demand-shift', impact:'high', horizon:'24mo', industries:['Engineering','Finance','Government','Healthcare'], description:'Cybersecurity vacancies growing 3× faster than talent pipeline.', implications:['Salaries up 25–40% over 3 years','AI-augmented security roles emerging','Upskilling existing engineers into security is viable'] },
  { id:'rust-rise', title:'Rust Adoption Accelerating in Systems & Fintech', type:'skill-evolution', impact:'medium', horizon:'24mo', industries:['Engineering','Fintech','Security'], description:'Rust adoption up 65% YoY in production systems (Linux kernel, Android, fintech infra).', implications:['C++ roles gradually being replaced','Systems engineers upskilling to Rust','Rust + WASM enabling new web use cases'] },
  { id:'data-gov-reg', title:'Data Governance Mandates Going Live (DPDPA, GDPR Enforcement)', type:'org-change', impact:'high', horizon:'12mo', industries:['Finance','Healthcare','Government','Tech'], description:'India DPDPA enforcement and EU AI Act creating new compliance roles.', implications:['Data governance roles increasing 40%+ YoY','Privacy engineers emerging','Legal + tech hybrid roles gaining premium'] },
  { id:'platform-eng', title:'Platform Engineering Replacing DevOps Generalists', type:'demand-shift', impact:'medium', horizon:'18mo', industries:['Engineering'], description:'Companies building Internal Developer Platforms (IDPs) — platform engineers building golden paths.', implications:['DevOps roles bifurcating into Platform Eng vs SRE','IDP tooling expertise valued','Backstage, Port, Cortex skill demand up'] },
  { id:'remote-normalization', title:'Hybrid Work Normalises Global Talent Competition', type:'geographic', impact:'medium', horizon:'6mo', industries:['All'], description:'Indian talent increasingly competing with Southeast Asia, Eastern Europe for global remote roles.', implications:['Salary anchoring against global benchmarks','English communication skills now gatekeeping global roles','Time zone overlap premium for EMEA/US orgs'] },
];

/* ── Engine functions ─────────────────────────────────────────────── */
export interface SkillEvolutionReport {
  emerging:    SkillSignal[];
  accelerating:SkillSignal[];
  stable:      SkillSignal[];
  plateauing:  SkillSignal[];
  declining:   SkillSignal[];
  topOpportunities: SkillSignal[];   // high demand + high growth + low disruption
  criticalToLearn:  SkillSignal[];   // high growth + user doesn't have
  riskExposure:     SkillSignal[];   // declining or high disruption risk
}

export function analyseSkillEvolution(userSkills: string[] = []): SkillEvolutionReport {
  const normalise = (s: string) => s.toLowerCase().trim();
  const userSet   = new Set(userSkills.map(normalise));

  const byStatus = (status: SkillStatus) => SKILL_SIGNALS.filter(s => s.status === status);

  const topOpps = SKILL_SIGNALS
    .filter(s => s.demandIndex >= 70 && s.growthRate >= 20 && s.aiDisruptionRisk <= 30)
    .sort((a, b) => (b.demandIndex + b.growthRate) - (a.demandIndex + a.growthRate))
    .slice(0, 5);

  const criticalToLearn = SKILL_SIGNALS
    .filter(s => !userSet.has(normalise(s.skill)) && s.growthRate >= 30 && s.demandIndex >= 65)
    .sort((a, b) => b.growthRate - a.growthRate)
    .slice(0, 5);

  const riskExposure = SKILL_SIGNALS
    .filter(s => userSet.has(normalise(s.skill)) && (s.status === 'declining' || s.status === 'plateauing' || s.aiDisruptionRisk >= 55))
    .sort((a, b) => b.aiDisruptionRisk - a.aiDisruptionRisk);

  return {
    emerging:    byStatus('emerging'),
    accelerating:byStatus('accelerating'),
    stable:      byStatus('stable'),
    plateauing:  byStatus('plateauing'),
    declining:   byStatus('declining'),
    topOpportunities:topOpps, criticalToLearn, riskExposure,
  };
}

export interface AIDisruptionReport {
  signals:      AIDisruptionSignal[];
  avgRisk:      number;
  criticalTasks:AIDisruptionSignal[];   // risk >= 75
  safeTasks:    AIDisruptionSignal[];   // risk <= 30
  userExposure: { task:string; risk:number; affectedRole:boolean }[];
}

export function assessAIDisruption(userRoles: string[] = []): AIDisruptionReport {
  const userRoleSet = new Set(userRoles.map(r => r.toLowerCase()));
  const avgRisk = Math.round(AI_DISRUPTION_SIGNALS.reduce((s, d) => s + d.disruptionRisk, 0) / AI_DISRUPTION_SIGNALS.length);
  const critical = AI_DISRUPTION_SIGNALS.filter(s => s.disruptionRisk >= 75);
  const safe     = AI_DISRUPTION_SIGNALS.filter(s => s.disruptionRisk <= 30);
  const exposure = AI_DISRUPTION_SIGNALS.map(s => ({
    task:         s.taskType,
    risk:         s.disruptionRisk,
    affectedRole: s.affectedRoles.some(r => userRoleSet.has(r.toLowerCase())),
  })).filter(e => e.affectedRole);
  return { signals:AI_DISRUPTION_SIGNALS, avgRisk, criticalTasks:critical, safeTasks:safe, userExposure:exposure };
}

export interface EmergingRoleReport {
  roles:         EmergingRole[];
  aiNative:      EmergingRole[];
  byHorizon:     Record<EmergingRole['emergenceHorizon'], EmergingRole[]>;
  topOpportunity:EmergingRole;
  userFit:       { role:EmergingRole; matchScore:number; missingSkills:string[] }[];
}

export function analyseEmergingRoles(userSkills: string[] = []): EmergingRoleReport {
  const normalise = (s: string) => s.toLowerCase().trim();
  const userSet   = new Set(userSkills.map(normalise));
  const byHorizon: Record<EmergingRole['emergenceHorizon'], EmergingRole[]> = { now:[], '12mo':[], '24mo':[], '36mo':[] };
  for (const r of EMERGING_ROLES) byHorizon[r.emergenceHorizon].push(r);

  const userFit = EMERGING_ROLES.map(role => {
    const match   = role.requiredSkills.filter(s => userSet.has(normalise(s))).length;
    const missing = role.requiredSkills.filter(s => !userSet.has(normalise(s)));
    return { role, matchScore:Math.round((match / Math.max(1, role.requiredSkills.length)) * 100), missingSkills:missing };
  }).sort((a, b) => b.matchScore - a.matchScore);

  return {
    roles:EMERGING_ROLES, aiNative:EMERGING_ROLES.filter(r => r.aiNative),
    byHorizon,
    topOpportunity:[...EMERGING_ROLES].sort((a,b) => b.demandScore * b.growthRate - a.demandScore * a.growthRate)[0],
    userFit,
  };
}

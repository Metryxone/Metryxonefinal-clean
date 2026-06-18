/**
 * Predictive Workforce Intelligence Engine — Phase 5
 * Forecasts future skill demand, org gaps, emerging role clusters,
 * and transformation risk over 12/24/36-month horizons.
 */

import type { OrgMember }            from './enterpriseIntelligenceEngine';
import type { WorkforceCapabilityMap } from './enterpriseIntelligenceEngine';
import { SKILL_SIGNALS, EMERGING_ROLES, AI_DISRUPTION_SIGNALS } from './workforceIntelligenceEngine';

/* ── Future skill demand forecast ─────────────────────────────────── */
export interface SkillDemandForecast {
  skill:           string;
  currentDemand:   number;     // 0-100
  forecast12mo:    number;
  forecast24mo:    number;
  forecast36mo:    number;
  growthTrajectory:'exponential' | 'linear' | 'plateau' | 'declining';
  confidencePct:   number;     // how confident (0-100)
  urgency:         'act-now' | 'plan-ahead' | 'monitor' | 'deprioritise';
  aiImpact:        'amplified' | 'disrupted' | 'neutral';
  orgGap?:         number;     // if org context provided: current org avg vs forecasted demand
}

export interface SkillDemandReport {
  forecasts:       SkillDemandForecast[];
  criticalUpskill: SkillDemandForecast[];   // urgency = act-now
  watchList:       SkillDemandForecast[];   // exponential trajectory
  deprioritise:    SkillDemandForecast[];   // declining
  marketSummary:   string;
}

function project(current: number, growthRate: number, months: number): number {
  const annualGrowth = growthRate / 100;
  const years        = months / 12;
  return Math.min(100, Math.round(current * Math.pow(1 + annualGrowth, years)));
}

export function forecastSkillDemand(
  orgCompetencyAvgs: Record<string, number> = {},   // competencyId → avg level 0-5
): SkillDemandReport {
  const forecasts: SkillDemandForecast[] = SKILL_SIGNALS.map(sig => {
    const f12 = project(sig.demandIndex, sig.growthRate, 12);
    const f24 = project(sig.demandIndex, sig.growthRate, 24);
    const f36 = project(sig.demandIndex, sig.growthRate, 36);

    const trajectory: SkillDemandForecast['growthTrajectory'] =
      sig.growthRate >= 60  ? 'exponential' :
      sig.growthRate >= 10  ? 'linear'      :
      sig.growthRate >= -5  ? 'plateau'     : 'declining';

    const urgency: SkillDemandForecast['urgency'] =
      trajectory === 'exponential' && sig.demandIndex >= 65 ? 'act-now'      :
      trajectory === 'linear'      && sig.demandIndex >= 55 ? 'plan-ahead'   :
      trajectory === 'plateau'                              ? 'monitor'      : 'deprioritise';

    const aiImpact: SkillDemandForecast['aiImpact'] =
      sig.aiDisruptionRisk >= 55  ? 'disrupted' :
      sig.aiDisruptionRisk <= 20  ? 'amplified' : 'neutral';

    const confidence = Math.max(50, 95 - Math.abs(sig.growthRate) * 0.3);

    return { skill:sig.skill, currentDemand:sig.demandIndex, forecast12mo:f12, forecast24mo:f24, forecast36mo:f36, trajectory, confidencePct:Math.round(confidence), urgency, aiImpact };
  }).sort((a, b) => b.forecast12mo - a.forecast12mo);

  return {
    forecasts,
    criticalUpskill:forecasts.filter(f => f.urgency === 'act-now'),
    watchList:      forecasts.filter(f => f.trajectory === 'exponential'),
    deprioritise:   forecasts.filter(f => f.urgency === 'deprioritise'),
    marketSummary:  `${forecasts.filter(f=>f.urgency==='act-now').length} skills require immediate upskilling. ${forecasts.filter(f=>f.trajectory==='exponential').length} on exponential growth trajectory. ${forecasts.filter(f=>f.aiImpact==='amplified').length} skills are AI-amplified (growing in importance with AI adoption).`,
  };
}

/* ── Organizational gap analysis ─────────────────────────────────── */
export type GapSeverity = 'critical' | 'significant' | 'moderate' | 'minimal' | 'surplus';

export interface OrgGap {
  competencyId:  string;
  currentAvg:    number;     // org average 0-5
  requiredLevel: number;     // target 0-5
  gap:           number;     // requiredLevel - currentAvg (positive = deficit)
  severity:      GapSeverity;
  affectedDepts: string[];
  headcountEquivalent: number;   // how many people need to upskill
  closingStrategies: string[];
  timeToClose:   number;     // months at average learning velocity
}

export interface OrgGapAnalysis {
  gaps:              OrgGap[];
  criticalGaps:      OrgGap[];
  surpluses:         OrgGap[];
  overallGapScore:   number;   // 0-100 (higher = larger aggregate gap)
  priorityInvestment:string[];   // top 3 areas to invest
  closingPlan: {
    quick:  OrgGap[];   // closable < 6 months
    medium: OrgGap[];   // 6-18 months
    long:   OrgGap[];   // 18+ months
  };
}

function gapSeverity(gap: number): GapSeverity {
  if (gap < -0.5) return 'surplus';
  if (gap <= 0)   return 'minimal';
  if (gap <= 0.8) return 'moderate';
  if (gap <= 1.5) return 'significant';
  return 'critical';
}

export function analyseOrgGaps(
  org:            OrgMember[],
  capabilityMap:  WorkforceCapabilityMap,
  targetLevels:   Record<string, number>,   // competencyId → required level 0-5
): OrgGapAnalysis {
  const n = Math.max(1, org.length);
  const gaps: OrgGap[] = Object.entries(targetLevels).map(([compId, required]) => {
    // Avg from org
    const levels     = org.map(m => m.competencyLevels[compId] ?? 0);
    const currentAvg = Math.round((levels.reduce((s,v)=>s+v,0)/n) * 10) / 10;
    const gap        = Math.round((required - currentAvg) * 10) / 10;
    const sev        = gapSeverity(gap);
    const depts      = capabilityMap.departments.filter(d => (d.avgCompetency[compId]??0) < required).map(d=>d.department);
    const belowCount = levels.filter(v => v < required).length;
    const timeToClose= gap <= 0 ? 0 : Math.round(gap * 8);   // ~8 months per level
    const strategies: string[] = [];
    if (sev === 'critical')    strategies.push(`Immediate senior hire for ${compId}`, `Intensive bootcamp program (3 months)`);
    else if (sev === 'significant') strategies.push(`Structured upskilling program (6 months)`, `Mentorship pairing with existing experts`);
    else if (sev === 'moderate')    strategies.push(`Online learning sprints (L&D budget allocation)`, `On-the-job stretch assignments`);
    else                            strategies.push(`Maintain current trajectory`, `Monitor quarterly`);
    return { competencyId:compId, currentAvg, requiredLevel:required, gap, severity:sev, affectedDepts:depts, headcountEquivalent:belowCount, closingStrategies:strategies, timeToClose };
  }).sort((a, b) => b.gap - a.gap);

  const criticalGaps = gaps.filter(g => g.severity === 'critical' || g.severity === 'significant');
  const surpluses    = gaps.filter(g => g.severity === 'surplus');
  const overallGap   = Math.min(100, Math.round(gaps.filter(g=>g.gap>0).reduce((s,g)=>s+g.gap,0) * 10));
  const priority     = criticalGaps.slice(0,3).map(g => g.competencyId);

  return {
    gaps, criticalGaps, surpluses, overallGapScore:overallGap, priorityInvestment:priority,
    closingPlan:{
      quick:  gaps.filter(g => g.gap > 0 && g.timeToClose <= 6),
      medium: gaps.filter(g => g.gap > 0 && g.timeToClose > 6  && g.timeToClose <= 18),
      long:   gaps.filter(g => g.gap > 0 && g.timeToClose > 18),
    },
  };
}

/* ── Emerging role clusters ───────────────────────────────────────── */
export interface RoleCluster {
  id:           string;
  name:         string;
  description:  string;
  roles:        { title:string; horizon:string; demandScore:number }[];
  drivingTrend: string;
  convergingSkills: string[];
  orgReadiness: number;    // 0-100 (how ready the org is to hire/reskill for this cluster)
  urgency:      'act-now' | 'plan-12mo' | 'plan-24mo' | 'monitor';
  hiringImplication: string;
}

export const ROLE_CLUSTERS: RoleCluster[] = [
  {
    id:'ai-native-engineering',
    name:'AI-Native Engineering',
    description:'A cluster of roles built around LLM integration, AI systems, and intelligent automation — converging from ML engineering, software engineering, and data science.',
    roles:[
      { title:'AI Engineer',         horizon:'now',  demandScore:93 },
      { title:'LLMOps Engineer',     horizon:'12mo', demandScore:78 },
      { title:'AI Product Manager',  horizon:'12mo', demandScore:75 },
      { title:'Prompt Engineer',     horizon:'now',  demandScore:72 },
    ],
    drivingTrend:'Proliferation of LLM APIs and AI-native product architecture',
    convergingSkills:['Python','LLMs / GenAI','RAG / Vector DBs','MLOps','System Design'],
    orgReadiness:0, urgency:'act-now',
    hiringImplication:'Hire 1–2 AI engineers immediately. Reskill top SWEs with LLM fundamentals within 6 months.',
  },
  {
    id:'ai-security',
    name:'AI-Augmented Security',
    description:'Cybersecurity roles evolving to use AI for threat detection, automated response, and adversarial testing of AI systems.',
    roles:[
      { title:'AI-Augmented Security Analyst', horizon:'12mo', demandScore:80 },
      { title:'AI Red Team Specialist',         horizon:'24mo', demandScore:65 },
      { title:'AI Governance Officer',          horizon:'24mo', demandScore:60 },
    ],
    drivingTrend:'AI Act compliance + AI-powered cyberattacks driving demand for AI-literate security',
    convergingSkills:['Cybersecurity','LLMs / GenAI','Python','SIEM','Penetration Testing'],
    orgReadiness:0, urgency:'plan-12mo',
    hiringImplication:'Upskill existing security team with AI tooling. Plan for AI Red Team hire in 12–18 months.',
  },
  {
    id:'data-governance-privacy',
    name:'Data Governance & Privacy Engineering',
    description:'Roles emerging from DPDPA/GDPR enforcement, data mesh adoption, and AI training data compliance requirements.',
    roles:[
      { title:'Data Governance Officer',      horizon:'now',  demandScore:68 },
      { title:'Privacy Engineer',             horizon:'12mo', demandScore:62 },
      { title:'AI Trainer / RLHF Specialist', horizon:'now',  demandScore:65 },
    ],
    drivingTrend:'Regulatory mandates (DPDPA, GDPR) + AI training data transparency requirements',
    convergingSkills:['Data Governance','SQL','Privacy','Data Engineering','Python'],
    orgReadiness:0, urgency:'plan-12mo',
    hiringImplication:'Create a Data Governance function if not present. One senior hire can bootstrap this capability.',
  },
  {
    id:'platform-infrastructure',
    name:'Platform & Internal Developer Experience',
    description:'Platform engineering emerging from DevOps to build Internal Developer Platforms (IDPs) — self-service golden paths for engineering teams.',
    roles:[
      { title:'Platform Engineer',          horizon:'now',  demandScore:85 },
      { title:'Developer Experience Engineer', horizon:'12mo', demandScore:70 },
    ],
    drivingTrend:'Engineering productivity mandates + Backstage/Port adoption + DevOps maturity',
    convergingSkills:['Kubernetes','Cloud Architecture','Terraform','CI/CD','System Design'],
    orgReadiness:0, urgency:'plan-12mo',
    hiringImplication:'Restructure DevOps team into Platform Eng and SRE. Hire one Platform Lead.',
  },
  {
    id:'quantitative-ai-finance',
    name:'Quantitative AI & Finance Engineering',
    description:'Convergence of quant finance, ML, and risk systems — roles that combine Python ML with financial modelling at production scale.',
    roles:[
      { title:'Quantitative ML Engineer',  horizon:'24mo', demandScore:70 },
      { title:'AI Risk Analyst',           horizon:'24mo', demandScore:62 },
    ],
    drivingTrend:'Fintech AI adoption + algorithmic trading growth + regulatory AI risk requirements',
    convergingSkills:['Python','Machine Learning','Statistics','System Design','Finance'],
    orgReadiness:0, urgency:'plan-24mo',
    hiringImplication:'Target candidates from IIT/IISc quant programs with ML exposure. Plan for 18-month hiring horizon.',
  },
];

export function computeClusterReadiness(
  cluster:  RoleCluster,
  org:      OrgMember[],
): RoleCluster {
  const n = Math.max(1, org.length);
  const skillScores = cluster.convergingSkills.map(skill => {
    // Rough proxy: look for programming/cloud/statistics/security as the underlying competencies
    const compProxy: Record<string,string> = { 'Python':'programming', 'TypeScript':'programming', 'LLMs / GenAI':'statistics', 'Kubernetes':'cloud', 'AWS':'cloud', 'Terraform':'cloud', 'Cybersecurity':'security', 'Machine Learning':'statistics', 'MLOps':'cloud', 'System Design':'systems-design', 'SQL':'data-analysis' };
    const compId = compProxy[skill];
    if (!compId) return 30;
    const levels = org.map(m => m.competencyLevels[compId] ?? 0);
    const avg    = levels.reduce((s,v)=>s+v,0) / n;
    return Math.min(100, Math.round(avg * 20));
  });
  const readiness = Math.round(skillScores.reduce((s,v)=>s+v,0) / Math.max(1,skillScores.length));
  return { ...cluster, orgReadiness:readiness };
}

export function detectEmergingRoleClusters(org: OrgMember[] = []): RoleCluster[] {
  return ROLE_CLUSTERS.map(c => computeClusterReadiness(c, org)).sort((a,b)=>b.orgReadiness-a.orgReadiness);
}

/* ── Transformation risk forecast ─────────────────────────────────── */
export type TransformationRiskType = 'capability' | 'adoption' | 'leadership' | 'cultural' | 'competitive' | 'regulatory';

export interface TransformationRisk {
  type:         TransformationRiskType;
  title:        string;
  probability:  number;   // 0-100
  impact:       number;   // 0-100
  riskScore:    number;   // probability × impact / 100
  horizon:      '6mo' | '12mo' | '24mo' | '36mo';
  earlyWarnings:string[];
  mitigations:  string[];
  narrative:    string;
}

export interface TransformationRiskReport {
  risks:            TransformationRisk[];
  compositeRisk:    number;
  riskMatrix:       { type:string; probability:number; impact:number; riskScore:number }[];
  topRisk:          TransformationRisk;
  mitigationPriorities:string[];
  narrative:        string;
}

export function assessTransformationRisk(
  org:          OrgMember[],
  capabilityMap:WorkforceCapabilityMap,
): TransformationRiskReport {
  const n = Math.max(1, org.length);
  const avgEI      = Math.round(org.reduce((s,m)=>s+m.eiScore,0)/n);
  const avgComp    = capabilityMap.orgOverallScore;
  const hiPotPct   = Math.round(org.filter(m=>m.potential==='high').length/n*100);
  const retRiskPct = Math.round(org.filter(m=>m.retentionRisk==='high').length/n*100);
  const seniorPct  = Math.round(org.filter(m=>['senior','lead','principal','director'].includes(m.level)).length/n*100);

  const risks: TransformationRisk[] = [
    {
      type:'capability',
      title:'Capability Gap Derails Transformation',
      probability:Math.max(10, 100 - avgComp), impact:85,
      riskScore:Math.round(Math.max(10,100-avgComp)*85/100),
      horizon:'12mo',
      earlyWarnings:['Transformation KPIs consistently missed','Teams unable to adopt new tooling','High dependency on external consultants'],
      mitigations:['Structured upskilling program for critical competencies','Hire 2–3 senior experts to bootstrap capability','Embed L&D into project teams'],
      narrative:`With an org capability score of ${avgComp}/100, ${100-avgComp}% probability that capability gaps will slow or derail transformation milestones.`,
    },
    {
      type:'adoption',
      title:'Low AI Tooling Adoption',
      probability:Math.max(15, 90 - avgComp), impact:75,
      riskScore:Math.round(Math.max(15,90-avgComp)*75/100),
      horizon:'12mo',
      earlyWarnings:['AI tool licenses unused','Teams reverting to manual processes','Low experimentation rate in sprints'],
      mitigations:['AI Literacy program (mandatory 8h)','Designated "AI Champion" per team','Monthly AI innovation showcases'],
      narrative:'Low digital literacy creates adoption resistance — transformation ROI at risk.',
    },
    {
      type:'leadership',
      title:'Leadership Pipeline Cannot Support Scale',
      probability:Math.max(10, 80 - seniorPct*0.8), impact:80,
      riskScore:Math.round(Math.max(10,80-seniorPct*0.8)*80/100),
      horizon:'18mo',
      earlyWarnings:['Senior roles unfilled for 60+ days','Leadership team overloaded','Strategy cascade not reaching teams'],
      mitigations:['Leadership accelerator program','Senior hire plan for Q2','Promote 2 high-potentials into lead roles this quarter'],
      narrative:`Senior density at ${seniorPct}% — leadership bandwidth may constrain transformation execution.`,
    },
    {
      type:'cultural',
      title:'Cultural Resistance to Change',
      probability:Math.max(20, 90 - hiPotPct - (avgEI/100*30)), impact:70,
      riskScore:Math.round(Math.max(20,90-hiPotPct-(avgEI/100*30))*70/100),
      horizon:'6mo',
      earlyWarnings:['Transformation survey NPS dropping','Key voices publicly sceptical','Innovation sprints producing no outputs'],
      mitigations:['Change champions program','Transparent communication on "why"','Early wins showcased org-wide'],
      narrative:`Cultural readiness is ${hiPotPct}% high-potential density + ${avgEI} avg EI — potential for resistance if change is not managed.`,
    },
    {
      type:'competitive',
      title:'Talent Competition Accelerates Attrition',
      probability:Math.min(90, retRiskPct * 2), impact:80,
      riskScore:Math.round(Math.min(90,retRiskPct*2)*80/100),
      horizon:'12mo',
      earlyWarnings:['Exit interviews citing compensation','Competing offers increasing','Key roles open 90+ days'],
      mitigations:['Market-rate salary benchmarking','Retention bonus for critical roles','Accelerated career path for high performers'],
      narrative:`${retRiskPct}% of the workforce is at high retention risk — talent competition may accelerate departures during transformation uncertainty.`,
    },
    {
      type:'regulatory',
      title:'AI / Data Regulatory Compliance Risk',
      probability:65, impact:70,
      riskScore:Math.round(65*70/100),
      horizon:'12mo',
      earlyWarnings:['No data governance function','AI tools deployed without risk assessment','No DPDPA compliance roadmap'],
      mitigations:['Appoint Data Protection Officer','AI governance policy within 90 days','DPDPA compliance audit this quarter'],
      narrative:'India DPDPA enforcement and AI Act compliance are active risk vectors. Non-compliance penalties and reputational risk are real.',
    },
  ].sort((a,b) => b.riskScore - a.riskScore);

  const composite = Math.round(risks.reduce((s,r)=>s+r.riskScore,0)/risks.length);
  const topRisk   = risks[0];
  const mitigations = risks.slice(0,3).map(r=>r.mitigations[0]);
  const narrative = `Composite transformation risk: ${composite}/100. Top risk: "${topRisk.title}" (score ${topRisk.riskScore}). Primary mitigation: ${topRisk.mitigations[0]}.`;

  return {
    risks, compositeRisk:composite,
    riskMatrix:risks.map(r=>({ type:r.type, probability:r.probability, impact:r.impact, riskScore:r.riskScore })),
    topRisk, mitigationPriorities:mitigations, narrative,
  };
}

/* ── Unified predictive report ───────────────────────────────────── */
export interface PredictiveWorkforceReport {
  skillDemand:     SkillDemandReport;
  orgGaps:         OrgGapAnalysis | null;
  roleClusters:    RoleCluster[];
  transformationRisk:TransformationRiskReport;
  horizonSummary: {
    '6mo':  string[];
    '12mo': string[];
    '24mo': string[];
    '36mo': string[];
  };
}

export function buildPredictiveReport(
  org:          OrgMember[],
  capabilityMap:WorkforceCapabilityMap,
  targetLevels: Record<string, number> = {},
): PredictiveWorkforceReport {
  const skillDemand       = forecastSkillDemand();
  const orgGaps           = Object.keys(targetLevels).length > 0 ? analyseOrgGaps(org, capabilityMap, targetLevels) : null;
  const roleClusters      = detectEmergingRoleClusters(org);
  const transformationRisk = assessTransformationRisk(org, capabilityMap);

  const h6  = skillDemand.criticalUpskill.slice(0,2).map(s=>`Upskill on ${s.skill} — demand index reaches ${s.forecast12mo}/100 within 12 months.`);
  const h12 = roleClusters.filter(c=>c.urgency==='act-now'||c.urgency==='plan-12mo').slice(0,2).map(c=>`Build ${c.name} capability: ${c.hiringImplication}`);
  const h24 = roleClusters.filter(c=>c.urgency==='plan-24mo').slice(0,1).map(c=>`Prepare for ${c.name} role cluster emergence.`);
  const h36 = ['Re-assess workforce composition against AI disruption landscape at 36-month checkpoint.'];

  return { skillDemand, orgGaps, roleClusters, transformationRisk, horizonSummary:{ '6mo':h6, '12mo':h12, '24mo':h24, '36mo':h36 } };
}

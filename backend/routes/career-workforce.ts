/**
 * Career Workforce Routes — Phase 5
 * Workforce & Enterprise Intelligence — all logic self-contained / inline.
 * Extends Phase 1 basic signals with full enterprise, graph, dashboard, and predictive intelligence.
 */

import type { Express } from 'express';

/* ── Types ──────────────────────────────────────────────────────────── */
interface WorkforceRole { id:string; title:string; family:string; demandScore:number; automationRisk:number; growth36mo:number; openingsIndex:number; avgSalary:string; trend:'hot'|'rising'|'stable'|'flat'|'cooling'; topSkills:string[] }
interface OrgMember { id:string; name:string; currentRole:string; department:string; level:'junior'|'mid'|'senior'|'lead'|'principal'|'director'|'vp'|'c-suite'; competencyLevels:Record<string,number>; eiScore:number; yearsExperience:number; yearsInRole:number; retentionRisk:'low'|'medium'|'high'; potential:'high'|'medium'|'low'; tags?:string[] }
interface CriticalRole { id:string; title:string; department:string; level:string; requiredCompetencies:Record<string,number>; minEI:number; minExperience:number; priority:'critical'|'high'|'medium' }

/* ── Workforce catalog ──────────────────────────────────────────────── */
const WORKFORCE_CATALOG: WorkforceRole[] = [
  { id:'swe',       title:'Software Engineer',       family:'Engineering', demandScore:88, automationRisk:22, growth36mo:24, openingsIndex:82, avgSalary:'₹8–35 LPA',  trend:'rising',  topSkills:['JavaScript','TypeScript','React','Node.js','SQL'] },
  { id:'ml-eng',    title:'ML Engineer',             family:'Engineering', demandScore:90, automationRisk:15, growth36mo:38, openingsIndex:89, avgSalary:'₹15–60 LPA', trend:'hot',     topSkills:['Python','TensorFlow','PyTorch','MLOps','SQL'] },
  { id:'ai-eng',    title:'AI Engineer',             family:'Engineering', demandScore:93, automationRisk:12, growth36mo:45, openingsIndex:93, avgSalary:'₹18–75 LPA', trend:'hot',     topSkills:['Python','LLMs','Langchain','RAG','System Design'] },
  { id:'cloud-arch',title:'Cloud Architect',         family:'Engineering', demandScore:86, automationRisk:16, growth36mo:30, openingsIndex:84, avgSalary:'₹20–80 LPA', trend:'hot',     topSkills:['AWS','Kubernetes','Terraform','Docker','Networking'] },
  { id:'cybersec',  title:'Cybersecurity Engineer',  family:'Engineering', demandScore:89, automationRisk:14, growth36mo:35, openingsIndex:87, avgSalary:'₹12–55 LPA', trend:'hot',     topSkills:['IAM','SIEM','Penetration Testing','OWASP','Python'] },
  { id:'devops',    title:'DevOps Engineer',         family:'Engineering', demandScore:82, automationRisk:20, growth36mo:28, openingsIndex:79, avgSalary:'₹10–38 LPA', trend:'rising',  topSkills:['Docker','Kubernetes','CI/CD','AWS','Terraform'] },
  { id:'ds',        title:'Data Scientist',          family:'Data',        demandScore:84, automationRisk:18, growth36mo:32, openingsIndex:81, avgSalary:'₹10–40 LPA', trend:'rising',  topSkills:['Python','Machine Learning','SQL','Statistics','Pandas'] },
  { id:'da',        title:'Data Analyst',            family:'Data',        demandScore:75, automationRisk:35, growth36mo:16, openingsIndex:65, avgSalary:'₹5–20 LPA',  trend:'stable',  topSkills:['SQL','Excel','Tableau','Python','Power BI'] },
  { id:'de',        title:'Data Engineer',           family:'Data',        demandScore:85, automationRisk:20, growth36mo:30, openingsIndex:82, avgSalary:'₹12–45 LPA', trend:'rising',  topSkills:['Spark','Kafka','Airflow','SQL','Python'] },
  { id:'pm',        title:'Product Manager',         family:'Product',     demandScore:76, automationRisk:25, growth36mo:20, openingsIndex:68, avgSalary:'₹12–50 LPA', trend:'stable',  topSkills:['Product Strategy','Agile','SQL','Analytics','Roadmapping'] },
  { id:'ux',        title:'UX Designer',             family:'Design',      demandScore:70, automationRisk:30, growth36mo:18, openingsIndex:60, avgSalary:'₹6–28 LPA',  trend:'stable',  topSkills:['Figma','User Research','Prototyping','Design Systems','Usability Testing'] },
  { id:'eng-mgr',   title:'Engineering Manager',     family:'Leadership',  demandScore:72, automationRisk:20, growth36mo:18, openingsIndex:62, avgSalary:'₹25–90 LPA', trend:'stable',  topSkills:['Leadership','System Design','People Management','OKRs','Strategy'] },
  { id:'marketing', title:'Marketing Manager',       family:'Marketing',   demandScore:65, automationRisk:42, growth36mo:12, openingsIndex:52, avgSalary:'₹7–25 LPA',  trend:'flat',    topSkills:['SEO','Analytics','Copywriting','Campaign Strategy','CRM'] },
  { id:'blockchain',title:'Blockchain Developer',    family:'Engineering', demandScore:52, automationRisk:28, growth36mo:15, openingsIndex:48, avgSalary:'₹12–50 LPA', trend:'cooling', topSkills:['Solidity','Ethereum','Web3.js','Smart Contracts','Rust'] },
];

/* ── Skill signals catalog ──────────────────────────────────────────── */
const SKILL_SIGNALS = [
  { skill:'Python',            status:'stable',       demandIndex:92, growthRate:12,  aiDisruptionRisk:15, halfLife:4   },
  { skill:'LLMs / GenAI',      status:'accelerating', demandIndex:95, growthRate:85,  aiDisruptionRisk:8,  halfLife:1.5 },
  { skill:'Prompt Engineering',status:'emerging',     demandIndex:72, growthRate:120, aiDisruptionRisk:50, halfLife:1   },
  { skill:'RAG / Vector DBs',  status:'emerging',     demandIndex:68, growthRate:140, aiDisruptionRisk:12, halfLife:2   },
  { skill:'Cloud Architecture',status:'accelerating', demandIndex:88, growthRate:22,  aiDisruptionRisk:10, halfLife:3   },
  { skill:'Kubernetes',        status:'stable',       demandIndex:82, growthRate:18,  aiDisruptionRisk:20, halfLife:3.5 },
  { skill:'Rust',              status:'emerging',     demandIndex:55, growthRate:45,  aiDisruptionRisk:18, halfLife:5   },
  { skill:'TypeScript',        status:'stable',       demandIndex:88, growthRate:20,  aiDisruptionRisk:22, halfLife:4   },
  { skill:'SQL',               status:'stable',       demandIndex:85, growthRate:5,   aiDisruptionRisk:38, halfLife:6   },
  { skill:'Excel / Sheets',    status:'plateauing',   demandIndex:72, growthRate:-5,  aiDisruptionRisk:65, halfLife:3   },
  { skill:'MLOps',             status:'accelerating', demandIndex:80, growthRate:55,  aiDisruptionRisk:10, halfLife:2.5 },
  { skill:'Cybersecurity',     status:'accelerating', demandIndex:89, growthRate:30,  aiDisruptionRisk:12, halfLife:2   },
  { skill:'Product Strategy',  status:'stable',       demandIndex:72, growthRate:10,  aiDisruptionRisk:28, halfLife:5   },
  { skill:'Data Governance',   status:'emerging',     demandIndex:62, growthRate:40,  aiDisruptionRisk:25, halfLife:4   },
  { skill:'Agile / Scrum',     status:'stable',       demandIndex:75, growthRate:5,   aiDisruptionRisk:30, halfLife:5   },
  { skill:'System Design',     status:'stable',       demandIndex:84, growthRate:15,  aiDisruptionRisk:14, halfLife:5   },
];

/* ── Emerging roles ─────────────────────────────────────────────────── */
const EMERGING_ROLES = [
  { id:'ai-engineer',    title:'AI Engineer',              horizon:'now',  demandScore:93, salaryRange:'₹18–75 LPA', growthRate:45, aiNative:true,  requiredSkills:['Python','LLMs / GenAI','RAG / Vector DBs','System Design'] },
  { id:'llmops',         title:'LLMOps Engineer',          horizon:'12mo', demandScore:78, salaryRange:'₹20–80 LPA', growthRate:90, aiNative:true,  requiredSkills:['Python','LLMs / GenAI','MLOps','Kubernetes'] },
  { id:'ai-pm',          title:'AI Product Manager',       horizon:'12mo', demandScore:75, salaryRange:'₹18–60 LPA', growthRate:60, aiNative:true,  requiredSkills:['Product Strategy','LLMs / GenAI','Prompt Engineering'] },
  { id:'red-team',       title:'AI Red Team Specialist',   horizon:'24mo', demandScore:65, salaryRange:'₹15–55 LPA', growthRate:70, aiNative:true,  requiredSkills:['Cybersecurity','LLMs / GenAI','Penetration Testing'] },
  { id:'data-gov',       title:'Data Governance Officer',  horizon:'now',  demandScore:68, salaryRange:'₹12–40 LPA', growthRate:40, aiNative:false, requiredSkills:['Data Governance','SQL','Privacy','Data Engineering'] },
  { id:'prompt-eng',     title:'Prompt Engineer',          horizon:'now',  demandScore:72, salaryRange:'₹10–45 LPA', growthRate:120,aiNative:true,  requiredSkills:['Prompt Engineering','LLMs / GenAI','Python'] },
  { id:'platform-eng',   title:'Platform Engineer',        horizon:'now',  demandScore:85, salaryRange:'₹18–65 LPA', growthRate:35, aiNative:false, requiredSkills:['Kubernetes','Cloud Architecture','Terraform','CI/CD'] },
];

/* ── AI disruption signals ──────────────────────────────────────────── */
const AI_DISRUPTION = [
  { taskType:'Data Entry & Manual Reporting', risk:92, timeline:'1-2yr',  affectedRoles:['Data Analyst','Finance Analyst'] },
  { taskType:'Basic Code Review',             risk:75, timeline:'2-5yr',  affectedRoles:['Junior Engineer','QA Engineer'] },
  { taskType:'Customer Support (Tier 1)',     risk:88, timeline:'1-2yr',  affectedRoles:['Support Agent','Call Centre'] },
  { taskType:'Content Writing (generic)',     risk:70, timeline:'1-2yr',  affectedRoles:['Copywriter','Content Analyst'] },
  { taskType:'Document Summarisation',        risk:90, timeline:'1-2yr',  affectedRoles:['Legal Researcher','Analyst'] },
  { taskType:'System Architecture Design',    risk:22, timeline:'10yr+',  affectedRoles:['Cloud Architect','Principal Engineer'] },
  { taskType:'Complex Stakeholder Negotiation',risk:8, timeline:'10yr+', affectedRoles:['Executive','BD Leader','PM'] },
  { taskType:'Basic SQL Query Writing',       risk:72, timeline:'2-5yr',  affectedRoles:['Data Analyst','Business Analyst'] },
];

/* ── Role clusters ──────────────────────────────────────────────────── */
const ROLE_CLUSTERS = [
  { id:'ai-native-engineering', name:'AI-Native Engineering', urgency:'act-now',   roles:['AI Engineer','LLMOps Engineer','Prompt Engineer'],  skills:['Python','LLMs / GenAI','RAG / Vector DBs','MLOps','System Design'], hiring:'Hire 1–2 AI engineers immediately. Reskill top SWEs with LLM fundamentals within 6 months.' },
  { id:'ai-security',           name:'AI-Augmented Security',  urgency:'plan-12mo', roles:['AI Security Analyst','AI Red Team Specialist'],      skills:['Cybersecurity','LLMs / GenAI','Python','SIEM'],                      hiring:'Upskill existing security team with AI tooling. Plan AI Red Team hire in 12–18 months.' },
  { id:'data-governance',       name:'Data Governance & Privacy', urgency:'plan-12mo',roles:['Data Governance Officer','Privacy Engineer'],        skills:['Data Governance','SQL','Privacy','Data Engineering'],               hiring:'Create a Data Governance function. One senior hire bootstraps this capability.' },
  { id:'platform-infra',        name:'Platform & Developer Experience', urgency:'plan-12mo',roles:['Platform Engineer','DevEx Engineer'],         skills:['Kubernetes','Cloud Architecture','Terraform','CI/CD'],              hiring:'Restructure DevOps into Platform Eng and SRE. Hire one Platform Lead.' },
  { id:'quant-ai-finance',      name:'Quantitative AI & Finance', urgency:'plan-24mo', roles:['Quantitative ML Engineer','AI Risk Analyst'],      skills:['Python','Machine Learning','Statistics','Finance'],                 hiring:'Target IIT/IISc quant candidates with ML exposure. 18-month hiring horizon.' },
];

/* ── Helpers ────────────────────────────────────────────────────────── */
function project(current: number, growthRate: number, months: number): number {
  return Math.min(100, Math.round(current * Math.pow(1 + growthRate / 100, months / 12)));
}

function computeSuccessionReadiness(member: OrgMember, role: CriticalRole): number {
  const reqComps = role.requiredCompetencies;
  let compScore = 0; let compCount = 0;
  for (const [id, req] of Object.entries(reqComps)) {
    const cur = member.competencyLevels[id] ?? 0;
    compScore += Math.min(1, cur / Math.max(1, req));
    compCount++;
  }
  const compR = compCount > 0 ? (compScore / compCount) * 50 : 25;
  const eiR   = Math.min(20, (member.eiScore / Math.max(1, role.minEI)) * 20);
  const expR  = Math.min(15, (member.yearsExperience / Math.max(1, role.minExperience)) * 15);
  const potB  = member.potential === 'high' ? 10 : member.potential === 'medium' ? 5 : 0;
  const retP  = member.retentionRisk === 'high' ? -8 : member.retentionRisk === 'medium' ? -3 : 0;
  return Math.min(100, Math.max(0, Math.round(compR + eiR + expR + potB + retP)));
}

function toTier(score: number): string {
  return score >= 80 ? 'ready-now' : score >= 60 ? '1-year' : score >= 40 ? '2-year' : 'not-ready';
}

/* ── Route registration ─────────────────────────────────────────────── */
export function registerCareerWorkforceRoutes(app: Express): void {

  /* ── Phase 1: Basic market signals (preserved) ── */
  app.get('/api/career/workforce/signals', (_req, res) => {
    const avg = (arr: number[]) => Math.round(arr.reduce((s,v)=>s+v,0)/arr.length);
    res.json({ success:true, signals:WORKFORCE_CATALOG, summary:{ marketIndex:avg(WORKFORCE_CATALOG.map(r=>r.demandScore)), avgGrowth:avg(WORKFORCE_CATALOG.map(r=>r.growth36mo)), avgAutomationRisk:avg(WORKFORCE_CATALOG.map(r=>r.automationRisk)), hotCount:WORKFORCE_CATALOG.filter(r=>r.trend==='hot').length, risingCount:WORKFORCE_CATALOG.filter(r=>r.trend==='rising').length } });
  });
  app.get('/api/career/workforce/hot-roles', (_req, res) => {
    res.json({ success:true, roles:[...WORKFORCE_CATALOG].sort((a,b)=>b.openingsIndex-a.openingsIndex).slice(0,6) });
  });
  app.get('/api/career/workforce/safe-roles', (_req, res) => {
    res.json({ success:true, roles:[...WORKFORCE_CATALOG].sort((a,b)=>a.automationRisk-b.automationRisk).slice(0,6) });
  });
  app.get('/api/career/workforce/risk-flags', (_req, res) => {
    res.json({ success:true, roles:WORKFORCE_CATALOG.filter(r=>r.automationRisk>=30).sort((a,b)=>b.automationRisk-a.automationRisk) });
  });
  app.get('/api/career/workforce/family/:family', (req, res) => {
    const roles = WORKFORCE_CATALOG.filter(r => r.family.toLowerCase() === req.params.family.toLowerCase());
    if (!roles.length) return res.status(404).json({ error:'Family not found' });
    res.json({ success:true, family:req.params.family, roles });
  });

  /* ══════════════════════════════════════════════════════════════════
     PHASE 5 — WORKFORCE INTELLIGENCE
  ══════════════════════════════════════════════════════════════════ */

  /* GET /api/career/workforce/skill-evolution */
  app.get('/api/career/workforce/skill-evolution', (req, res) => {
    const userSkills = String(req.query.skills ?? '').split(',').map(s=>s.trim()).filter(Boolean);
    const userSet    = new Set(userSkills.map(s=>s.toLowerCase()));
    const byStatus: Record<string,typeof SKILL_SIGNALS> = {};
    for (const s of SKILL_SIGNALS) {
      if (!byStatus[s.status]) byStatus[s.status] = [];
      byStatus[s.status].push(s);
    }
    const topOpps = SKILL_SIGNALS.filter(s=>s.demandIndex>=70&&s.growthRate>=20&&s.aiDisruptionRisk<=30).sort((a,b)=>(b.demandIndex+b.growthRate)-(a.demandIndex+a.growthRate)).slice(0,5);
    const criticalToLearn = SKILL_SIGNALS.filter(s=>!userSet.has(s.skill.toLowerCase())&&s.growthRate>=30&&s.demandIndex>=65).sort((a,b)=>b.growthRate-a.growthRate).slice(0,5);
    const riskExposure = SKILL_SIGNALS.filter(s=>userSet.has(s.skill.toLowerCase())&&(s.status==='declining'||s.status==='plateauing'||s.aiDisruptionRisk>=55));
    res.json({ byStatus, topOpportunities:topOpps, criticalToLearn, riskExposure, totalSkills:SKILL_SIGNALS.length });
  });

  /* GET /api/career/workforce/emerging-roles */
  app.get('/api/career/workforce/emerging-roles', (req, res) => {
    const userSkills = String(req.query.skills ?? '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const userSet    = new Set(userSkills);
    const byHorizon: Record<string,typeof EMERGING_ROLES> = {};
    for (const r of EMERGING_ROLES) {
      if (!byHorizon[r.horizon]) byHorizon[r.horizon] = [];
      byHorizon[r.horizon].push(r);
    }
    const userFit = EMERGING_ROLES.map(r => {
      const matches = r.requiredSkills.filter(s=>userSet.has(s.toLowerCase())).length;
      const missing = r.requiredSkills.filter(s=>!userSet.has(s.toLowerCase()));
      return { ...r, matchScore:Math.round(matches/Math.max(1,r.requiredSkills.length)*100), missingSkills:missing };
    }).sort((a,b)=>b.matchScore-a.matchScore);
    res.json({ roles:EMERGING_ROLES, byHorizon, aiNative:EMERGING_ROLES.filter(r=>r.aiNative), userFit });
  });

  /* GET /api/career/workforce/ai-disruption */
  app.get('/api/career/workforce/ai-disruption', (_req, res) => {
    const avg  = Math.round(AI_DISRUPTION.reduce((s,d)=>s+d.risk,0)/AI_DISRUPTION.length);
    res.json({ signals:AI_DISRUPTION, avgRisk:avg, criticalTasks:AI_DISRUPTION.filter(d=>d.risk>=75), safeTasks:AI_DISRUPTION.filter(d=>d.risk<=30) });
  });

  /* GET /api/career/workforce/labor-trends */
  app.get('/api/career/workforce/labor-trends', (_req, res) => {
    const trends = [
      { id:'llm-native', title:'LLM-Native Development is the New Baseline', type:'skill-evolution', impact:'high', horizon:'12mo', description:'By mid-2025, LLM integration expected in 60%+ of engineering JDs.', implications:['Python + LLM skills now minimum viable','Prompt engineering shifts niche→commodity','Classic ML roles bifurcating into AI engineering and MLOps'] },
      { id:'ai-tax',     title:'AI Productivity Tax on Head Count',           type:'org-change',      impact:'high', horizon:'12mo', description:'Orgs using AI report 20–40% productivity gain per head, reducing headcount growth.', implications:['Hiring freezes in automatable roles','Fewer junior roles — senior bar rises','Output per person expected to increase 30%+'] },
      { id:'cybersec-surge', title:'Cybersecurity Demand Outpaces Supply by 4M Globally', type:'demand-shift', impact:'high', horizon:'24mo', description:'Cybersecurity vacancies growing 3× faster than talent pipeline.', implications:['Salaries up 25–40% over 3 years','AI-augmented security roles emerging','Upskilling engineers into security is viable'] },
      { id:'data-gov-reg', title:'Data Governance Mandates Going Live (DPDPA, GDPR)', type:'org-change', impact:'high', horizon:'12mo', description:'India DPDPA enforcement and EU AI Act creating new compliance roles.', implications:['Data governance roles increasing 40%+ YoY','Privacy engineers emerging','Legal + tech hybrid roles gaining premium'] },
      { id:'platform-eng', title:'Platform Engineering Replacing DevOps Generalists', type:'demand-shift', impact:'medium', horizon:'18mo', description:'Companies building Internal Developer Platforms (IDPs).', implications:['DevOps bifurcating into Platform Eng vs SRE','IDP tooling expertise valued'] },
    ];
    res.json({ trends, highImpact:trends.filter(t=>t.impact==='high'), total:trends.length });
  });

  /* ══════════════════════════════════════════════════════════════════
     PHASE 5 — ENTERPRISE INTELLIGENCE
  ══════════════════════════════════════════════════════════════════ */

  /* POST /api/career/workforce/enterprise/succession */
  app.post('/api/career/workforce/enterprise/succession', (req, res) => {
    try {
      const { org, criticalRoles } = req.body as { org?:OrgMember[]; criticalRoles?:CriticalRole[] };
      if (!org?.length || !criticalRoles?.length) return res.status(400).json({ error:'org[] and criticalRoles[] required' });
      const plans = criticalRoles.map(role => {
        const candidates = org
          .filter(m => !['junior'].includes(m.level))
          .map(m => {
            const score = computeSuccessionReadiness(m, role);
            const tier  = toTier(score);
            const gaps  = Object.entries(role.requiredCompetencies).map(([id,req]) => ({ id, current:m.competencyLevels[id]??0, required:req, gap:Math.max(0,req-(m.competencyLevels[id]??0)) }));
            return { memberId:m.id, memberName:m.name, currentRole:m.currentRole, readinessScore:score, readinessTier:tier, competencyGaps:gaps.filter(g=>g.gap>0), eiGap:Math.max(0,role.minEI-m.eiScore), estimatedReadyInMonths:tier==='ready-now'?0:tier==='1-year'?12:tier==='2-year'?24:36 };
          })
          .sort((a,b)=>b.readinessScore-a.readinessScore)
          .slice(0,3);
        const readyNow    = candidates.filter(c=>c.readinessTier==='ready-now').length;
        const benchScore  = candidates.length ? Math.round(candidates.reduce((s,c)=>s+c.readinessScore,0)/candidates.length) : 0;
        const coverage    = readyNow>=2?'covered':readyNow>=1?'at-risk':'critical-gap';
        return { roleId:role.id, roleTitle:role.title, candidates, readyNowCount:readyNow, benchStrength:benchScore, coverageRisk:coverage, riskNarrative:coverage==='covered'?`${readyNow} ready-now candidates provide solid bench.`:coverage==='at-risk'?`Only ${readyNow} ready-now candidate — single point of failure.`:`No ready-now candidates — critical succession gap.` };
      });
      const overallCoverage = Math.round(plans.filter(p=>p.readyNowCount>=1).length/plans.length*100);
      res.json({ plans, overallCoverage, totalRoles:criticalRoles.length, criticalGaps:plans.filter(p=>p.coverageRisk==='critical-gap').length });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/enterprise/pipeline */
  app.post('/api/career/workforce/enterprise/pipeline', (req, res) => {
    try {
      const { org } = req.body as { org?:OrgMember[] };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const n = org.length;
      const tierDef: Record<string,string[]> = { 'N':['vp','c-suite'], 'N-1':['director','vp'], 'N-2':['principal','lead','senior'] };
      const layers = Object.entries(tierDef).map(([tier,levels]) => {
        const members = org.filter(m=>levels.includes(m.level));
        const mc = Math.max(1,members.length);
        const avgEI = Math.round(members.reduce((s,m)=>s+m.eiScore,0)/mc);
        const hiPot = members.filter(m=>m.potential==='high').length;
        const atRisk = members.filter(m=>m.retentionRisk==='high').length;
        return { tier, count:members.length, avgEI, highPotential:hiPot, atRiskCount:atRisk, benchScore:Math.min(100,Math.round(avgEI*0.4+(hiPot/mc)*60)), members:members.map(m=>({ id:m.id, name:m.name, role:m.currentRole, level:m.level, eiScore:m.eiScore, potential:m.potential, retentionRisk:m.retentionRisk })) };
      });
      const pipelineDepth = (layers[1]?.count??0)+(layers[2]?.count??0);
      const pipelineScore = Math.round(layers.reduce((s,l)=>s+l.benchScore,0)/3);
      const topTalent     = org.filter(m=>m.potential==='high').sort((a,b)=>b.eiScore-a.eiScore).slice(0,5);
      const atRisk        = org.filter(m=>m.potential==='high'&&m.retentionRisk==='high');
      const insights: string[] = [];
      if (atRisk.length)     insights.push(`${atRisk.length} high-potential employee(s) at high retention risk — immediate action required.`);
      if (pipelineScore<50)  insights.push('Pipeline health below threshold — accelerate leadership development.');
      if (pipelineDepth<3)   insights.push('Shallow pipeline (< 3 members at N-1/N-2) — succession risk elevated.');
      if (pipelineScore>=75) insights.push('Pipeline health strong — maintain development cadence, monitor retention.');
      res.json({ layers, pipelineDepth, pipelineScore, pipelineLabel:pipelineScore>=75?'strong':pipelineScore>=55?'moderate':'weak', topTalent:topTalent.map(m=>({id:m.id,name:m.name,role:m.currentRole,level:m.level,eiScore:m.eiScore})), atRiskHighPotential:atRisk.map(m=>({id:m.id,name:m.name,role:m.currentRole})), insights });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/enterprise/capability-map */
  app.post('/api/career/workforce/enterprise/capability-map', (req, res) => {
    try {
      const { org } = req.body as { org?:OrgMember[] };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const n    = Math.max(1,org.length);
      const depts = [...new Set(org.map(m=>m.department))];
      const departments = depts.map(dept => {
        const members = org.filter(m=>m.department===dept);
        const mc = Math.max(1,members.length);
        const allComps = [...new Set(members.flatMap(m=>Object.keys(m.competencyLevels)))];
        const avgComp: Record<string,number> = {};
        for (const id of allComps) { const vals=members.map(m=>m.competencyLevels[id]??0); avgComp[id]=Math.round(vals.reduce((s,v)=>s+v,0)/mc*10)/10; }
        const sorted = Object.entries(avgComp).sort(([,a],[,b])=>b-a);
        const overall = Math.round(Object.values(avgComp).reduce((s,v)=>s+v,0)/Math.max(1,Object.values(avgComp).length)*20);
        const eiAvg = Math.round(members.reduce((s,m)=>s+m.eiScore,0)/mc);
        const hiPotPct = Math.round(members.filter(m=>m.potential==='high').length/mc*100);
        return { department:dept, memberCount:members.length, avgCompetency:avgComp, overallScore:overall, topStrengths:sorted.slice(0,3).map(([k])=>k), criticalGaps:sorted.slice(-3).filter(([,v])=>v<2).map(([k])=>k), eiAvg, highPotentialPct:hiPotPct };
      });
      const orgScores = departments.map(d=>d.overallScore);
      const orgOverall = Math.round(orgScores.reduce((s,v)=>s+v,0)/Math.max(1,orgScores.length));
      const variance   = orgScores.reduce((s,v)=>s+Math.pow(v-orgOverall,2),0)/Math.max(1,orgScores.length);
      const balance    = Math.max(0,Math.round(100-Math.sqrt(variance)));
      const heatmap    = departments.flatMap(d=>Object.entries(d.avgCompetency).map(([comp,score])=>({ department:d.department, competency:comp, score, level:score>=3.5?'high':score>=2?'medium':'low' })));
      res.json({ departments, orgOverallScore:orgOverall, balanceScore:balance, heatmapData:heatmap, topDepartment:departments.sort((a,b)=>b.overallScore-a.overallScore)[0]?.department, orgStrengths:departments.flatMap(d=>d.topStrengths).slice(0,3), orgGaps:departments.flatMap(d=>d.criticalGaps).slice(0,3) });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/enterprise/transformation-readiness */
  app.post('/api/career/workforce/enterprise/transformation-readiness', (req, res) => {
    try {
      const { org } = req.body as { org?:OrgMember[] };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const n = Math.max(1,org.length);
      const digitalComps = ['programming','cloud','data-engineering','data-analysis','security'];
      const digitalScores = org.map(m=>digitalComps.map(c=>m.competencyLevels[c]??0).reduce((s,v)=>s+v,0)/digitalComps.length);
      const digital    = Math.min(100,Math.round(digitalScores.reduce((s,v)=>s+v,0)/n*20));
      const seniorPct  = org.filter(m=>['senior','lead','principal','director','vp','c-suite'].includes(m.level)).length/n;
      const agile      = Math.min(100,Math.round(50+seniorPct*50));
      const avgEI      = Math.round(org.reduce((s,m)=>s+m.eiScore,0)/n);
      const highRetRisk= org.filter(m=>m.retentionRisk==='high').length/n;
      const highPotPct = org.filter(m=>m.potential==='high').length/n;
      const cultural   = Math.min(100,Math.round(60-highRetRisk*50+highPotPct*40));
      const allComps   = [...new Set(org.flatMap(m=>Object.keys(m.competencyLevels)))];
      const orgAvgComp: Record<string,number> = {};
      for (const id of allComps) { const vals=org.map(m=>m.competencyLevels[id]??0); orgAvgComp[id]=vals.reduce((s,v)=>s+v,0)/n; }
      const technical  = Math.min(100,Math.round(Object.values(orgAvgComp).reduce((s,v)=>s+v,0)/Math.max(1,Object.values(orgAvgComp).length)*20));
      const leaderScore= Math.min(100,Math.round(50+seniorPct*30+highPotPct*20));
      const composite  = Math.round((digital+agile+leaderScore+cultural+technical)/5);
      const label      = composite>=75?'transformation-ready':composite>=55?'approaching-ready':composite>=35?'needs-investment':'not-ready';
      const dimensions = [
        { dimension:'digital',    score:digital,     band:digital>=75?'ready':digital>=55?'progressing':digital>=35?'developing':'at-risk' },
        { dimension:'agile',      score:agile,       band:agile>=75?'ready':agile>=55?'progressing':agile>=35?'developing':'at-risk' },
        { dimension:'leadership', score:leaderScore, band:leaderScore>=75?'ready':leaderScore>=55?'progressing':leaderScore>=35?'developing':'at-risk' },
        { dimension:'cultural',   score:cultural,    band:cultural>=75?'ready':cultural>=55?'progressing':cultural>=35?'developing':'at-risk' },
        { dimension:'technical',  score:technical,   band:technical>=75?'ready':technical>=55?'progressing':technical>=35?'developing':'at-risk' },
      ];
      const atRisk = dimensions.filter(d=>d.band==='at-risk').map(d=>d.dimension);
      const narrative = label==='transformation-ready'?`${composite}/100 — genuinely positioned to execute transformation. Key risk: maintain momentum.`:label==='approaching-ready'?`${composite}/100 — approaching readiness. Invest in ${atRisk.join(', ')||'weaker dimensions'} to close the gap.`:`${composite}/100 — structured investment required before transformation programs will succeed. Focus on ${atRisk[0]||'capability gaps'} first.`;
      res.json({ dimensions, compositeScore:composite, readinessLabel:label, atRiskDimensions:atRisk, estimatedMonthsToReady:label==='transformation-ready'?0:label==='approaching-ready'?6:label==='needs-investment'?18:36, narrative, orgContext:{ avgEI, totalMembers:n, highPotentialPct:Math.round(highPotPct*100), seniorPct:Math.round(seniorPct*100) } });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* ══════════════════════════════════════════════════════════════════
     PHASE 5 — KNOWLEDGE GRAPH
  ══════════════════════════════════════════════════════════════════ */

  /* GET /api/career/workforce/graph/snapshot */
  app.get('/api/career/workforce/graph/snapshot', (_req, res) => {
    const nodes = [
      ...['engineering','data','product','design','finance','security','ai','hr','marketing','operations'].map(id=>({ id:`ind:${id}`,type:'industry',label:id.charAt(0).toUpperCase()+id.slice(1) })),
      ...['programming','systems-design','cloud','data-engineering','security','data-analysis','statistics','business-acumen','writing','presentation','stakeholder-mgmt','people-mgmt','strategy','mentoring','innovation','project-mgmt','negotiation','collaboration','resilience','drive','adaptability'].map(id=>({ id:`comp:${id}`,type:'competency',label:id })),
      ...['swe','ml-eng','ai-eng','cloud-arch','cybersec','devops','ds','da','de','pm','ux','eng-mgr'].map(id=>({ id:`role:${id}`,type:'role',label:id })),
      ...['Python','TypeScript','SQL','AWS','Kubernetes','Machine Learning','LLMs / GenAI','Cybersecurity','Figma','Agile'].map(s=>({ id:`skill:${s}`,type:'skill',label:s })),
      ...['senior-ic','tech-lead','eng-manager','architect','cto','startup','researcher'].map(id=>({ id:`out:${id}`,type:'outcome',label:id })),
    ];
    const edges = [
      { from:'skill:Python',to:'comp:programming',type:'maps-to',weight:0.9 },
      { from:'skill:Python',to:'comp:statistics',type:'maps-to',weight:0.7 },
      { from:'skill:LLMs / GenAI',to:'comp:statistics',type:'maps-to',weight:0.7 },
      { from:'skill:AWS',to:'comp:cloud',type:'maps-to',weight:0.9 },
      { from:'skill:Kubernetes',to:'comp:cloud',type:'maps-to',weight:0.85 },
      { from:'skill:Cybersecurity',to:'comp:security',type:'maps-to',weight:0.95 },
      { from:'comp:programming',to:'role:swe',type:'requires',weight:0.9 },
      { from:'comp:statistics',to:'role:ml-eng',type:'requires',weight:0.9 },
      { from:'comp:cloud',to:'role:cloud-arch',type:'requires',weight:0.95 },
      { from:'comp:people-mgmt',to:'role:eng-mgr',type:'requires',weight:0.9 },
      { from:'role:swe',to:'ind:engineering',type:'belongs-to',weight:0.9 },
      { from:'role:ml-eng',to:'ind:ai',type:'belongs-to',weight:0.9 },
      { from:'comp:systems-design',to:'out:architect',type:'leads-to',weight:0.85 },
      { from:'comp:people-mgmt',to:'out:eng-manager',type:'leads-to',weight:0.9 },
      { from:'comp:strategy',to:'out:cto',type:'leads-to',weight:0.75 },
      { from:'role:swe',to:'role:ml-eng',type:'adjacent',weight:0.7 },
      { from:'role:swe',to:'role:devops',type:'adjacent',weight:0.7 },
      { from:'role:ml-eng',to:'role:ai-eng',type:'adjacent',weight:0.9 },
    ];
    res.json({ nodeCount:nodes.length, edgeCount:edges.length, nodesByType:{ industry:10,competency:21,role:12,skill:10,outcome:7 }, nodes, edges, summary:'Workforce ontology: People ↔ Skills ↔ Competencies ↔ Roles ↔ Industries ↔ Outcomes' });
  });

  /* POST /api/career/workforce/graph/adjacency */
  app.post('/api/career/workforce/graph/adjacency', (req, res) => {
    try {
      const { nodeId, depth } = req.body as { nodeId?:string; depth?:number };
      if (!nodeId) return res.status(400).json({ error:'nodeId required' });
      const roleAdj: Record<string,string[]> = {
        'role:swe':    ['role:ml-eng','role:devops','role:cloud-arch','role:eng-mgr'],
        'role:ml-eng': ['role:ai-eng','role:ds','role:swe'],
        'role:ai-eng': ['role:ml-eng','role:swe','role:ds'],
        'role:ds':     ['role:da','role:de','role:ml-eng'],
        'role:de':     ['role:da','role:ds'],
        'role:devops': ['role:cloud-arch','role:swe','role:cybersec'],
        'role:cloud-arch':['role:devops','role:swe'],
        'role:cybersec':  ['role:devops','role:swe'],
        'role:pm':     ['role:eng-mgr','role:ux'],
        'role:ux':     ['role:pm'],
        'role:eng-mgr':['role:swe','role:pm'],
        'role:da':     ['role:ds','role:de'],
      };
      const direct  = roleAdj[nodeId] ?? [];
      const depth2  = (depth??1) >= 2 ? [...new Set(direct.flatMap(r=>roleAdj[r]??[]).filter(r=>r!==nodeId&&!direct.includes(r)))] : [];
      res.json({ nodeId, directNeighbours:direct, depth2Neighbours:depth2, totalReachable:direct.length+depth2.length });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/graph/influence */
  app.post('/api/career/workforce/graph/influence', (req, res) => {
    try {
      const { skillId, changeType, magnitude } = req.body as { skillId?:string; changeType?:'improvement'|'disruption'; magnitude?:number };
      if (!skillId) return res.status(400).json({ error:'skillId required' });
      const mg = Math.min(1, Math.max(0, magnitude??0.8));
      const compProxy: Record<string,string[]> = {
        'Python':['programming','statistics','data-engineering'],'TypeScript':['programming'],'SQL':['data-analysis','data-engineering'],
        'AWS':['cloud'],'Kubernetes':['cloud'],'Machine Learning':['statistics'],'LLMs / GenAI':['statistics','data-engineering'],
        'Cybersecurity':['security'],'Agile':['project-mgmt'],'System Design':['systems-design'],
      };
      const affectedComps = compProxy[skillId] ?? [];
      const roleInfluence: Record<string,number[]> = {
        programming:['role:swe','role:ml-eng','role:ai-eng'],statistics:['role:ds','role:ml-eng','role:ai-eng'],
        cloud:['role:cloud-arch','role:devops'],security:['role:cybersec'],
        'data-engineering':['role:de','role:ds'],'data-analysis':['role:da','role:ds'],
        'systems-design':['role:swe','role:cloud-arch'],'project-mgmt':['role:pm','role:eng-mgr'],
      } as unknown as Record<string,number[]>;
      const affectedRoles = [...new Set(affectedComps.flatMap(c=>(roleInfluence[c]??[]) as string[]))];
      const decay = changeType==='disruption'?0.6:0.75;
      res.json({ sourceSkill:skillId, changeType, magnitude:mg, affected:[ ...affectedComps.map(c=>({ nodeId:`comp:${c}`, type:'competency', influenceScore:Math.round(mg*0.9*100), hops:1 })), ...affectedRoles.map(r=>({ nodeId:r, type:'role', influenceScore:Math.round(mg*decay*100), hops:2 })) ].sort((a,b)=>b.influenceScore-a.influenceScore) });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* ══════════════════════════════════════════════════════════════════
     PHASE 5 — ORGANIZATIONAL DASHBOARDS
  ══════════════════════════════════════════════════════════════════ */

  /* POST /api/career/workforce/dashboard/heatmap */
  app.post('/api/career/workforce/dashboard/heatmap', (req, res) => {
    try {
      const { org, targetLevels } = req.body as { org?:OrgMember[]; targetLevels?:Record<string,number> };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const target = targetLevels ?? {};
      const depts  = [...new Set(org.map(m=>m.department))];
      const allComps = [...new Set(org.flatMap(m=>Object.keys(m.competencyLevels)))];
      const cells = depts.flatMap(dept => {
        const members = org.filter(m=>m.department===dept);
        const mc = Math.max(1,members.length);
        return allComps.map(comp => {
          const levels = members.map(m=>m.competencyLevels[comp]??0);
          const avg    = Math.round(levels.reduce((s,v)=>s+v,0)/mc*10)/10;
          const tgt    = target[comp]??3;
          const heat   = Math.min(100,Math.round(avg/5*100));
          const band   = avg<1.5?'critical-gap':avg<2.5?'developing':avg<3.5?'adequate':avg<4.5?'strong':'exceptional';
          return { department:dept, competency:comp, avgLevel:avg, heat, band, memberCount:mc, aboveTarget:levels.filter(v=>v>=tgt).length, belowTarget:levels.filter(v=>v<tgt).length };
        });
      });
      const heats = cells.map(c=>c.heat);
      res.json({ cells, departments:depts, competencies:allComps, summary:{ totalCells:cells.length, gapCells:cells.filter(c=>c.band==='critical-gap').length, strongCells:cells.filter(c=>c.band==='strong'||c.band==='exceptional').length, avgHeat:heats.length?Math.round(heats.reduce((s,v)=>s+v,0)/heats.length):0 } });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/dashboard/readiness-map */
  app.post('/api/career/workforce/dashboard/readiness-map', (req, res) => {
    try {
      const { org, criticalRoles } = req.body as { org?:OrgMember[]; criticalRoles?:CriticalRole[] };
      if (!org?.length || !criticalRoles?.length) return res.status(400).json({ error:'org[] and criticalRoles[] required' });
      const matrix = criticalRoles.map(role => {
        const candidates = org.filter(m=>!['junior'].includes(m.level)).map(m => {
          const score = computeSuccessionReadiness(m, role);
          return { memberId:m.id, memberName:m.name, readinessScore:score, readinessTier:toTier(score), department:m.department };
        }).sort((a,b)=>b.readinessScore-a.readinessScore).slice(0,3);
        const readyNow = candidates.filter(c=>c.readinessTier==='ready-now').length;
        return { roleId:role.id, roleTitle:role.title, priority:role.priority, candidates, readyNow, coverageRisk:readyNow>=2?'covered':readyNow>=1?'at-risk':'critical-gap' };
      });
      const covered = matrix.filter(r=>r.readyNow>=1).length;
      res.json({ matrix, overallCoverage:Math.round(covered/matrix.length*100), coveredRoles:covered, criticalGapRoles:matrix.filter(r=>r.coverageRisk==='critical-gap').map(r=>r.roleTitle), insights:[...matrix.filter(r=>r.coverageRisk==='critical-gap').map(r=>`Critical gap: ${r.roleTitle} has no ready-now candidates.`),...(covered/matrix.length>=0.8?['Strong coverage (80%+) — focus on 1-year acceleration.']:[])] });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/dashboard/capability-graph */
  app.post('/api/career/workforce/dashboard/capability-graph', (req, res) => {
    try {
      const { org } = req.body as { org?:OrgMember[] };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const domainComps: Record<string,string[]> = { technical:['programming','systems-design','cloud','data-engineering','security'], analytical:['data-analysis','statistics','business-acumen','research'], communication:['writing','presentation','stakeholder-mgmt'], leadership:['people-mgmt','strategy','mentoring'], creative:['innovation','design-thinking'], execution:['project-mgmt','negotiation'], behavioral:['collaboration','resilience','drive','adaptability'] };
      const domains = Object.keys(domainComps);
      const n = Math.max(1,org.length);
      const depts = [...new Set(org.map(m=>m.department))];
      const nodes = depts.map(dept => {
        const members = org.filter(m=>m.department===dept);
        const mc = Math.max(1,members.length);
        const domainScores = Object.fromEntries(domains.map(d => {
          const comps = domainComps[d];
          const vals  = members.flatMap(m=>comps.map(c=>m.competencyLevels[c]??0));
          const avg   = vals.reduce((s,v)=>s+v,0)/vals.length;
          return [d, Math.min(100,Math.round(avg*20))];
        }));
        const overall = Math.round(Object.values(domainScores).reduce((s:number,v)=>s+(v as number),0)/domains.length);
        const eiAvg   = Math.round(members.reduce((s,m)=>s+m.eiScore,0)/mc);
        return { department:dept, memberCount:mc, domains:domainScores, overall, eiAvg, radarData:domains.map(d=>({ axis:d, value:domainScores[d] })) };
      });
      const orgAvg = Object.fromEntries(domains.map(d => [d, Math.round(nodes.reduce((s,node)=>s+(node.domains[d] as number),0)/Math.max(1,nodes.length))]));
      res.json({ nodes, orgRadar:domains.map(d=>({ axis:d, value:orgAvg[d] })), orgDomainAvg:orgAvg, topDepartment:nodes.sort((a,b)=>b.overall-a.overall)[0]?.department, gapDepartment:nodes.sort((a,b)=>a.overall-b.overall)[0]?.department, domainInsights:Object.entries(orgAvg).map(([d,score])=>({ domain:d, strength:score>=65?'org-strength':'org-gap', score, narrative:score>=65?`${d} is an org strength (${score}/100).`:`${d} is an org gap (${score}/100) — prioritise in L&D.` })).sort((a,b)=>a.score-b.score) });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/dashboard/risk-analysis */
  app.post('/api/career/workforce/dashboard/risk-analysis', (req, res) => {
    try {
      const { org } = req.body as { org?:OrgMember[] };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const n = Math.max(1,org.length);
      const risks: unknown[] = [];
      const roleCounts: Record<string,number> = {};
      for (const m of org) roleCounts[m.currentRole]=(roleCounts[m.currentRole]??0)+1;
      const topRole = Object.entries(roleCounts).sort(([,a],[,b])=>b-a)[0];
      if (topRole && topRole[1]/n>0.35) risks.push({ type:'concentration', severity:topRole[1]/n>0.5?'critical':'high', title:'Role Concentration Risk', description:`${Math.round(topRole[1]/n*100)}% of workforce in a single role (${topRole[0]}).`, affectedCount:topRole[1], score:Math.round(topRole[1]/n*100), mitigations:['Cross-train adjacent roles','Diversify hiring','Build rotation program'] });
      const atRisk = org.filter(m=>m.potential==='high'&&m.retentionRisk==='high');
      if (atRisk.length) risks.push({ type:'retention', severity:atRisk.length>=3?'critical':'high', title:'High-Potential Attrition Risk', description:`${atRisk.length} high-potential employees at elevated retention risk.`, affectedCount:atRisk.length, score:Math.min(100,atRisk.length*25), mitigations:['Salary benchmarking','Retention bonuses','Accelerated promotions'], atRiskMembers:atRisk.map(m=>({id:m.id,name:m.name,role:m.currentRole})) });
      const criticalComps = ['systems-design','security','cloud','statistics'];
      for (const comp of criticalComps) {
        const experts = org.filter(m=>(m.competencyLevels[comp]??0)>=4);
        if (experts.length<=1) risks.push({ type:'single-point-of-failure', severity:experts.length===0?'high':'critical', title:`SPOF: ${comp}`, description:experts.length===0?`No expert in ${comp}.`:`Only 1 expert in ${comp} (${experts[0]?.name}).`, affectedCount:experts.length, score:85, mitigations:['Knowledge transfer protocol','Hire backup expert','Document critical processes'] });
      }
      const lowAI = org.filter(m=>(m.competencyLevels['data-analysis']??0)+(m.competencyLevels['programming']??0)<2);
      if (lowAI.length/n>0.4) risks.push({ type:'ai-exposure', severity:'high', title:'Low AI Literacy Across Workforce', description:`${Math.round(lowAI.length/n*100)}% of workforce has minimal digital literacy — transformation risk.`, affectedCount:lowAI.length, score:70, mitigations:['Mandatory AI literacy program (8h)','Designated AI champions per team'] });
      const risksSorted = (risks as {score:number;severity:string}[]).sort((a,b)=>b.score-a.score);
      const overallRisk = risksSorted.length ? Math.round(risksSorted.reduce((s,r)=>s+r.score,0)/risksSorted.length) : 10;
      res.json({ risks:risksSorted, overallRiskScore:overallRisk, riskLabel:overallRisk>=75?'critical':overallRisk>=55?'elevated':overallRisk>=35?'moderate':'managed', criticalRisks:risksSorted.filter(r=>r.severity==='critical'), narrative:`Workforce risk score: ${overallRisk}/100. ${risksSorted.filter(r=>r.severity==='critical').length} critical risk(s) require immediate attention.` });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* ══════════════════════════════════════════════════════════════════
     PHASE 5 — PREDICTIVE WORKFORCE INTELLIGENCE
  ══════════════════════════════════════════════════════════════════ */

  /* GET /api/career/workforce/predictive/skill-demand */
  app.get('/api/career/workforce/predictive/skill-demand', (_req, res) => {
    const forecasts = SKILL_SIGNALS.map(s => {
      const f12 = project(s.demandIndex, s.growthRate, 12);
      const f24 = project(s.demandIndex, s.growthRate, 24);
      const f36 = project(s.demandIndex, s.growthRate, 36);
      const traj = s.growthRate>=60?'exponential':s.growthRate>=10?'linear':s.growthRate>=-5?'plateau':'declining';
      const urgency = traj==='exponential'&&s.demandIndex>=65?'act-now':traj==='linear'&&s.demandIndex>=55?'plan-ahead':traj==='plateau'?'monitor':'deprioritise';
      const ai = s.aiDisruptionRisk>=55?'disrupted':s.aiDisruptionRisk<=20?'amplified':'neutral';
      return { skill:s.skill, status:s.status, currentDemand:s.demandIndex, forecast12mo:f12, forecast24mo:f24, forecast36mo:f36, trajectory:traj, urgency, aiImpact:ai };
    }).sort((a,b)=>b.forecast12mo-a.forecast12mo);
    res.json({ forecasts, criticalUpskill:forecasts.filter(f=>f.urgency==='act-now'), watchList:forecasts.filter(f=>f.trajectory==='exponential'), deprioritise:forecasts.filter(f=>f.urgency==='deprioritise'), summary:`${forecasts.filter(f=>f.urgency==='act-now').length} skills require immediate upskilling. ${forecasts.filter(f=>f.trajectory==='exponential').length} on exponential growth trajectory.` });
  });

  /* POST /api/career/workforce/predictive/org-gaps */
  app.post('/api/career/workforce/predictive/org-gaps', (req, res) => {
    try {
      const { org, targetLevels } = req.body as { org?:OrgMember[]; targetLevels?:Record<string,number> };
      if (!org?.length || !targetLevels) return res.status(400).json({ error:'org[] and targetLevels{} required' });
      const n = Math.max(1,org.length);
      const gaps = Object.entries(targetLevels).map(([compId,required]) => {
        const levels    = org.map(m=>m.competencyLevels[compId]??0);
        const currentAvg= Math.round(levels.reduce((s,v)=>s+v,0)/n*10)/10;
        const gap       = Math.round((required-currentAvg)*10)/10;
        const sev       = gap>1.5?'critical':gap>0.8?'significant':gap>0?'moderate':gap<=-0.5?'surplus':'minimal';
        const timeToClose = gap<=0?0:Math.round(gap*8);
        const strats: string[] = gap>1.5?[`Immediate senior hire for ${compId}`,`Intensive bootcamp (3 months)`]:gap>0.8?[`Structured upskilling (6 months)`,`Mentorship pairing`]:gap>0?[`Online learning sprints`,`Stretch assignments`]:['Maintain trajectory'];
        return { competencyId:compId, currentAvg, requiredLevel:required, gap, severity:sev, headcountEquivalent:levels.filter(v=>v<required).length, closingStrategies:strats, timeToCloseMonths:timeToClose };
      }).sort((a,b)=>b.gap-a.gap);
      const critical = gaps.filter(g=>g.severity==='critical'||g.severity==='significant');
      const overall  = Math.min(100,Math.round(gaps.filter(g=>g.gap>0).reduce((s,g)=>s+g.gap,0)*10));
      res.json({ gaps, criticalGaps:critical, surpluses:gaps.filter(g=>g.severity==='surplus'), overallGapScore:overall, priorityInvestment:critical.slice(0,3).map(g=>g.competencyId), closingPlan:{ quick:gaps.filter(g=>g.gap>0&&g.timeToCloseMonths<=6), medium:gaps.filter(g=>g.gap>0&&g.timeToCloseMonths>6&&g.timeToCloseMonths<=18), long:gaps.filter(g=>g.gap>0&&g.timeToCloseMonths>18) } });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* GET /api/career/workforce/predictive/role-clusters */
  app.get('/api/career/workforce/predictive/role-clusters', (_req, res) => {
    res.json({ clusters:ROLE_CLUSTERS, actNow:ROLE_CLUSTERS.filter(c=>c.urgency==='act-now'), plan12mo:ROLE_CLUSTERS.filter(c=>c.urgency==='plan-12mo'), plan24mo:ROLE_CLUSTERS.filter(c=>c.urgency==='plan-24mo') });
  });

  /* POST /api/career/workforce/predictive/transformation-risk */
  app.post('/api/career/workforce/predictive/transformation-risk', (req, res) => {
    try {
      const { org } = req.body as { org?:OrgMember[] };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const n = Math.max(1,org.length);
      const avgEI      = Math.round(org.reduce((s,m)=>s+m.eiScore,0)/n);
      const allComps   = [...new Set(org.flatMap(m=>Object.keys(m.competencyLevels)))];
      const orgAvgComp: Record<string,number> = {};
      for (const id of allComps) { const vals=org.map(m=>m.competencyLevels[id]??0); orgAvgComp[id]=vals.reduce((s,v)=>s+v,0)/n; }
      const avgCompScore = Math.min(100,Math.round(Object.values(orgAvgComp).reduce((s,v)=>s+v,0)/Math.max(1,Object.values(orgAvgComp).length)*20));
      const hiPotPct   = org.filter(m=>m.potential==='high').length/n;
      const retRiskPct = org.filter(m=>m.retentionRisk==='high').length/n;
      const seniorPct  = org.filter(m=>['senior','lead','principal','director','vp','c-suite'].includes(m.level)).length/n;
      const risks = [
        { type:'capability',   title:'Capability Gap Derails Transformation',  probability:Math.max(10,100-avgCompScore), impact:85, horizon:'12mo', mitigations:['Structured upskilling','Hire senior experts','Embed L&D in project teams'] },
        { type:'adoption',     title:'Low AI Tooling Adoption',                probability:Math.max(15,90-avgCompScore),  impact:75, horizon:'12mo', mitigations:['AI Literacy program (8h mandatory)','AI Champions per team'] },
        { type:'leadership',   title:'Pipeline Cannot Support Scale',          probability:Math.max(10,80-seniorPct*80),  impact:80, horizon:'18mo', mitigations:['Leadership accelerator','Senior hire plan','Promote high-potentials'] },
        { type:'cultural',     title:'Cultural Resistance to Change',          probability:Math.max(20,90-hiPotPct*60-(avgEI/100*30)), impact:70, horizon:'6mo', mitigations:['Change champions','Transparent communication','Showcase early wins'] },
        { type:'retention',    title:'Talent Competition Accelerates Attrition',probability:Math.min(90,retRiskPct*200),  impact:80, horizon:'12mo', mitigations:['Market-rate benchmarking','Retention bonuses','Accelerated career paths'] },
        { type:'regulatory',   title:'AI/Data Regulatory Compliance Risk',     probability:65, impact:70, horizon:'12mo', mitigations:['Appoint DPO','AI governance policy (90 days)','DPDPA audit'] },
      ].map(r => ({ ...r, riskScore:Math.round(r.probability*r.impact/100) })).sort((a,b)=>b.riskScore-a.riskScore);
      const composite = Math.round(risks.reduce((s,r)=>s+r.riskScore,0)/risks.length);
      res.json({ risks, compositeRisk:composite, riskMatrix:risks.map(r=>({ type:r.type, probability:r.probability, impact:r.impact, riskScore:r.riskScore })), topRisk:risks[0], mitigationPriorities:risks.slice(0,3).map(r=>r.mitigations[0]), narrative:`Composite transformation risk: ${composite}/100. Top risk: "${risks[0]?.title}". Primary mitigation: ${risks[0]?.mitigations[0]}.` });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/workforce/predictive/full-report */
  app.post('/api/career/workforce/predictive/full-report', (req, res) => {
    try {
      const { org, targetLevels } = req.body as { org?:OrgMember[]; targetLevels?:Record<string,number> };
      if (!org?.length) return res.status(400).json({ error:'org[] required' });
      const n = Math.max(1,org.length);
      const skillForecasts = SKILL_SIGNALS.map(s => ({ skill:s.skill, urgency:s.growthRate>=60&&s.demandIndex>=65?'act-now':s.growthRate>=10&&s.demandIndex>=55?'plan-ahead':'monitor', forecast12mo:project(s.demandIndex,s.growthRate,12) })).filter(s=>s.urgency==='act-now').slice(0,5);
      const retRiskPct = Math.round(org.filter(m=>m.retentionRisk==='high').length/n*100);
      const hiPotPct   = Math.round(org.filter(m=>m.potential==='high').length/n*100);
      const avgEI      = Math.round(org.reduce((s,m)=>s+m.eiScore,0)/n);
      res.json({ criticalUpskillSkills:skillForecasts, roleClustersActNow:ROLE_CLUSTERS.filter(c=>c.urgency==='act-now'), horizonSummary:{ '6mo':skillForecasts.slice(0,2).map(s=>`Upskill on ${s.skill} — reaching ${s.forecast12mo}/100 demand in 12mo.`), '12mo':ROLE_CLUSTERS.filter(c=>c.urgency==='act-now'||c.urgency==='plan-12mo').slice(0,2).map(c=>`Build ${c.name} capability: ${c.hiring}`), '24mo':ROLE_CLUSTERS.filter(c=>c.urgency==='plan-24mo').map(c=>`Prepare for ${c.name} role cluster.`), '36mo':['Re-assess workforce vs AI disruption landscape at 36-month checkpoint.'] }, orgHealthSnapshot:{ totalMembers:n, avgEI, highPotentialPct:hiPotPct, retentionRiskPct:retRiskPct, watchSignal:retRiskPct>20?'Retention risk elevated':hiPotPct>=30?'Strong talent density':'Baseline health' } });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });
}

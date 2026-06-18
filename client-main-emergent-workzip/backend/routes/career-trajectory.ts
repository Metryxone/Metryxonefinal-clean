/**
 * Career Trajectory Routes — Phase 3
 * Adjacent role intelligence, role evolution, transformation probability,
 * future role forecasting. All logic self-contained / inline.
 */

import type { Express } from 'express';

/* ── Inline market catalog (abbreviated for trajectory logic) ─────── */
const MARKET_ROLES = [
  { id:'swe',           title:'Software Engineer',         family:'Engineering',  minEI:40, demandScore:90, automationRisk:25, salaryP50:22, competencies:[{id:'programming',req:4},{id:'systems-design',req:3},{id:'collaboration',req:3},{id:'cloud',req:2}] },
  { id:'senior-swe',    title:'Senior Software Engineer',  family:'Engineering',  minEI:55, demandScore:92, automationRisk:22, salaryP50:35, competencies:[{id:'programming',req:5},{id:'systems-design',req:4},{id:'cloud',req:3},{id:'drive',req:3},{id:'mentoring',req:2}] },
  { id:'tech-lead',     title:'Tech Lead',                 family:'Engineering',  minEI:65, demandScore:85, automationRisk:18, salaryP50:50, competencies:[{id:'programming',req:4},{id:'systems-design',req:5},{id:'people-mgmt',req:3},{id:'strategy',req:3},{id:'stakeholder-mgmt',req:3}] },
  { id:'eng-mgr',       title:'Engineering Manager',       family:'Leadership',   minEI:70, demandScore:80, automationRisk:15, salaryP50:65, competencies:[{id:'people-mgmt',req:4},{id:'strategy',req:4},{id:'stakeholder-mgmt',req:4},{id:'mentoring',req:3}] },
  { id:'ds',            title:'Data Scientist',            family:'Data',         minEI:45, demandScore:88, automationRisk:30, salaryP50:28, competencies:[{id:'statistics',req:4},{id:'programming',req:3},{id:'data-analysis',req:4},{id:'research',req:3}] },
  { id:'ml-eng',        title:'ML Engineer',               family:'Data',         minEI:55, demandScore:94, automationRisk:20, salaryP50:40, competencies:[{id:'programming',req:5},{id:'statistics',req:4},{id:'data-engineering',req:4},{id:'cloud',req:3}] },
  { id:'de',            title:'Data Engineer',             family:'Data',         minEI:45, demandScore:85, automationRisk:28, salaryP50:26, competencies:[{id:'data-engineering',req:4},{id:'programming',req:3},{id:'cloud',req:3},{id:'process',req:2}] },
  { id:'pm',            title:'Product Manager',           family:'Product',      minEI:60, demandScore:82, automationRisk:20, salaryP50:40, competencies:[{id:'strategy',req:4},{id:'stakeholder-mgmt',req:4},{id:'business-acumen',req:4},{id:'writing',req:3},{id:'collaboration',req:4}] },
  { id:'spm',           title:'Senior Product Manager',    family:'Product',      minEI:70, demandScore:80, automationRisk:18, salaryP50:60, competencies:[{id:'strategy',req:5},{id:'people-mgmt',req:3},{id:'business-acumen',req:5},{id:'data-analysis',req:3}] },
  { id:'ux',            title:'UX Designer',               family:'Design',       minEI:40, demandScore:78, automationRisk:22, salaryP50:18, competencies:[{id:'design-thinking',req:4},{id:'visual-design',req:4},{id:'research',req:3},{id:'storytelling',req:3}] },
  { id:'devops',        title:'DevOps Engineer',           family:'Engineering',  minEI:45, demandScore:86, automationRisk:32, salaryP50:24, competencies:[{id:'cloud',req:5},{id:'security',req:3},{id:'process',req:4},{id:'programming',req:3}] },
  { id:'security-eng',  title:'Security Engineer',         family:'Engineering',  minEI:50, demandScore:90, automationRisk:20, salaryP50:32, competencies:[{id:'security',req:5},{id:'programming',req:3},{id:'systems-design',req:3},{id:'process',req:3}] },
  { id:'ba',            title:'Business Analyst',          family:'Consulting',   minEI:40, demandScore:72, automationRisk:35, salaryP50:16, competencies:[{id:'business-acumen',req:4},{id:'data-analysis',req:3},{id:'writing',req:3},{id:'stakeholder-mgmt',req:3}] },
  { id:'consultant',    title:'Management Consultant',     family:'Consulting',   minEI:65, demandScore:75, automationRisk:28, salaryP50:50, competencies:[{id:'strategy',req:4},{id:'business-acumen',req:5},{id:'presentation',req:4},{id:'research',req:4}] },
  { id:'cto',           title:'CTO / VP Engineering',      family:'Leadership',   minEI:80, demandScore:70, automationRisk:10, salaryP50:120, competencies:[{id:'strategy',req:5},{id:'people-mgmt',req:5},{id:'systems-design',req:4},{id:'business-acumen',req:4}] },
] as const;

/* ── Genome adjacency map (abbreviated) ─────────────────────────── */
const ADJACENT: Record<string, string[]> = {
  'programming':    ['systems-design','data-engineering','cloud','security'],
  'systems-design': ['programming','cloud','strategy','security'],
  'cloud':          ['systems-design','security','data-engineering','process'],
  'data-engineering':['programming','statistics','cloud','data-analysis'],
  'security':       ['systems-design','cloud','programming','process'],
  'data-analysis':  ['statistics','business-acumen','research','data-engineering'],
  'statistics':     ['data-analysis','research','data-engineering'],
  'business-acumen':['strategy','stakeholder-mgmt','data-analysis','negotiation'],
  'research':       ['statistics','writing','data-analysis'],
  'writing':        ['storytelling','presentation','research'],
  'presentation':   ['writing','stakeholder-mgmt','storytelling'],
  'stakeholder-mgmt':['people-mgmt','strategy','presentation','negotiation'],
  'people-mgmt':    ['mentoring','strategy','stakeholder-mgmt'],
  'strategy':       ['business-acumen','people-mgmt','stakeholder-mgmt'],
  'mentoring':      ['people-mgmt','collaboration','resilience'],
  'design-thinking':['visual-design','storytelling','research'],
  'visual-design':  ['design-thinking','storytelling'],
  'storytelling':   ['writing','presentation','design-thinking'],
  'project-mgmt':   ['process','stakeholder-mgmt','people-mgmt'],
  'process':        ['project-mgmt','cloud','security'],
  'negotiation':    ['stakeholder-mgmt','business-acumen','strategy'],
  'drive':          ['resilience','collaboration'],
  'collaboration':  ['drive','people-mgmt','mentoring'],
  'resilience':     ['drive','mentoring'],
};

function adjacencyOverlap(userIds: string[], roleIds: string[]): number {
  if (!userIds.length || !roleIds.length) return 0;
  const adj = new Set<string>();
  userIds.forEach(id => ADJACENT[id]?.forEach(a => adj.add(a)));
  const overlap = roleIds.filter(id => userIds.includes(id) || adj.has(id)).length;
  return Math.round((overlap / roleIds.length) * 100);
}

function etaMonths(levels: Record<string, number>, role: typeof MARKET_ROLES[number], velMonthly = 0.15): number {
  const totalGap = role.competencies.reduce((s, rc) => s + Math.max(0, rc.req - (levels[rc.id] ?? 0)), 0);
  return Math.min(48, Math.max(1, Math.ceil(totalGap / Math.max(0.05, velMonthly) / 2)));
}

function switchability(levels: Record<string, number>, ei: number, role: typeof MARKET_ROLES[number]): number {
  const metReqs = role.competencies.filter(rc => (levels[rc.id] ?? 0) >= rc.req - 1).length;
  const reqRatio = metReqs / Math.max(1, role.competencies.length);
  const eiRatio  = Math.min(1, ei / Math.max(1, role.minEI));
  return Math.min(100, Math.round(reqRatio * 60 + eiRatio * 40));
}

function keyGaps(levels: Record<string, number>, role: typeof MARKET_ROLES[number]): string[] {
  return role.competencies
    .filter(rc => (levels[rc.id] ?? 0) < rc.req - 1)
    .sort((a, b) => b.req - a.req)
    .slice(0, 3)
    .map(rc => rc.id);
}

/* ── Route registration ───────────────────────────────────────────── */
export function registerCareerTrajectoryRoutes(app: Express): void {

  /* POST /api/career/trajectory/compute */
  app.post('/api/career/trajectory/compute', (req, res) => {
    try {
      const { competencyLevels: levels = {}, eiScore: ei = 50, velocityPerMonth = 0.15, topN = 6 } = req.body as {
        competencyLevels?: Record<string,number>; eiScore?: number; velocityPerMonth?: number; topN?: number;
      };

      const userCompIds = Object.entries(levels).filter(([,v]) => v >= 2).map(([k]) => k);

      const adjacentRoles = MARKET_ROLES.map(role => {
        const adj   = adjacencyOverlap(userCompIds, role.competencies.map(rc => rc.id));
        const sw    = switchability(levels, ei, role);
        const eta   = etaMonths(levels, role, velocityPerMonth);
        const gaps  = keyGaps(levels, role);
        const futRel= Math.round(role.demandScore * 0.7 + (100 - role.automationRisk) * 0.3);
        return { roleId:role.id, title:role.title, family:role.family, switchabilityScore:sw, adjacencyScore:adj, etaMonths:eta, demandScore:role.demandScore, automationRisk:role.automationRisk, futureRelevance:futRel, salaryP50:role.salaryP50, actionable:sw >= 40 && gaps.length <= 3, keyGaps:gaps };
      }).sort((a,b) => (b.switchabilityScore + b.adjacencyScore*0.5) - (a.switchabilityScore + a.adjacencyScore*0.5)).slice(0, topN);

      const horizons = [6,12,18,24,36];
      const trajectorySteps = horizons.map(mo => {
        const rolesAtEI = adjacentRoles.find(r => r.etaMonths <= mo);
        const eiAtPoint = Math.min(95, ei + velocityPerMonth * mo * 2.5);
        return { monthsFromNow:mo, label:mo<12?`${mo} months`:`${mo/12} year${mo===12?'':'s'}`, predictedRoleId:rolesAtEI?.roleId??'current', predictedRoleTitle:rolesAtEI?.title??'Current Role', requiredEI:Math.round(eiAtPoint), confidence:mo<=12?80:mo<=24?60:40, keyMilestones:rolesAtEI?.keyGaps.slice(0,2).map(g=>`Close ${g} gap`)??[] };
      });

      const forecasts = MARKET_ROLES.slice(0,topN).map(role => {
        const adj = adjacencyOverlap(userCompIds, role.competencies.map(rc=>rc.id));
        const sw  = switchability(levels, ei, role);
        const eta = etaMonths(levels, role, velocityPerMonth);
        const prob = Math.min(95, Math.round(sw*0.5 + adj*0.3 + (ei/100)*20));
        return { roleId:role.id, title:role.title, family:role.family, probability:prob, adjacencyScore:adj, etaMonths:eta, demandScore:role.demandScore, urgency:prob>=65&&role.demandScore>=80?'act-now':prob>=45?'plan-ahead':'watch', primaryBarrier:keyGaps(levels,role)[0]??'Profile completeness', primaryAccelerator:adj>=60?'Strong adjacency':sw>=60?'High switchability':'Market demand' };
      });

      const forecast12 = adjacentRoles.find(r=>r.etaMonths<=12&&r.actionable)??adjacentRoles[0]??null;
      const forecast36 = adjacentRoles.find(r=>r.etaMonths<=36&&r.actionable&&r.roleId!==forecast12?.roleId)??adjacentRoles[1]??null;

      const marketOpp = Math.round(
        (adjacentRoles.filter(r=>r.demandScore>=75).length/Math.max(1,adjacentRoles.length))*50 +
        (adjacentRoles.filter(r=>r.futureRelevance>=80).length/Math.max(1,adjacentRoles.length))*30 +
        (ei/100)*20
      );

      res.json({
        currentEI: ei,
        adjacentRoles, trajectorySteps,
        transformationForecasts: forecasts,
        forecastedRole12mo: forecast12,
        forecastedRole36mo: forecast36,
        mostLikelyPathLabel: forecast12 ? `Current → ${forecast12.title} (${forecast12.etaMonths}mo) → ${forecast36?.title??'…'}` : 'Build profile to unlock trajectory',
        roleEvolutionNarrative: forecast12 ? `${forecast12.title} is your most accessible next role (${forecast12.etaMonths} months). In 36 months, ${forecast36?.title??'a senior role'} becomes achievable.` : 'Complete your competency profile to unlock personalised trajectory intelligence.',
        marketOpportunityScore: Math.min(100, marketOpp),
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /* POST /api/career/trajectory/adjacent-roles */
  app.post('/api/career/trajectory/adjacent-roles', (req, res) => {
    try {
      const { competencyLevels: levels={}, eiScore: ei=50, topN=8 } = req.body as { competencyLevels?:Record<string,number>; eiScore?:number; topN?:number };
      const userCompIds = Object.entries(levels).filter(([,v])=>v>=2).map(([k])=>k);
      const adjacentRoles = MARKET_ROLES.map(role => {
        const adj = adjacencyOverlap(userCompIds, role.competencies.map(rc=>rc.id));
        const sw  = switchability(levels, ei, role);
        return { roleId:role.id, title:role.title, family:role.family, switchabilityScore:sw, adjacencyScore:adj, etaMonths:etaMonths(levels,role), demandScore:role.demandScore, automationRisk:role.automationRisk, actionable:sw>=40, keyGaps:keyGaps(levels,role) };
      }).sort((a,b)=>b.switchabilityScore-a.switchabilityScore).slice(0,topN);
      res.json({ adjacentRoles });
    } catch(e) { res.status(500).json({error:String(e)}); }
  });

  /* POST /api/career/trajectory/evolution */
  app.post('/api/career/trajectory/evolution', (req, res) => {
    try {
      const { competencyLevels: levels={}, eiScore: ei=50, horizonMonths=36 } = req.body as { competencyLevels?:Record<string,number>; eiScore?:number; horizonMonths?:number };
      const userCompIds = Object.entries(levels).filter(([,v])=>v>=2).map(([k])=>k);
      const horizons = [6,12,18,24,36].filter(h=>h<=horizonMonths);
      const adjRoles  = MARKET_ROLES.map(role=>({role, sw:switchability(levels,ei,role), eta:etaMonths(levels,role)})).sort((a,b)=>b.sw-a.sw);
      const steps = horizons.map(mo=>{
        const r = adjRoles.find(x=>x.eta<=mo);
        return { monthsFromNow:mo, label:mo<12?`${mo} months`:`${mo/12}yr`, predictedRoleTitle:r?.role.title??'Current Role', predictedRoleId:r?.role.id??'current', requiredEI:Math.round(Math.min(95,ei+mo*0.4)), confidence:mo<=12?80:mo<=24?60:40, keyMilestones:keyGaps(levels,r?.role??MARKET_ROLES[0]).slice(0,2).map(g=>`Close ${g} gap`) };
      });
      const narrative = adjRoles[0] ? `${adjRoles[0].role.title} is reachable in ~${adjRoles[0].eta} months at current pace.` : 'Build core competencies to unlock trajectory.';
      res.json({ steps, narrative });
    } catch(e) { res.status(500).json({error:String(e)}); }
  });

  /* POST /api/career/trajectory/probability */
  app.post('/api/career/trajectory/probability', (req, res) => {
    try {
      const { competencyLevels: levels={}, eiScore: ei=50, targetRoleId } = req.body as { competencyLevels?:Record<string,number>; eiScore?:number; targetRoleId?:string };
      const role = MARKET_ROLES.find(r=>r.id===targetRoleId);
      if (!role) return res.status(404).json({ error:'Role not found' });
      const userCompIds = Object.entries(levels).filter(([,v])=>v>=2).map(([k])=>k);
      const adj  = adjacencyOverlap(userCompIds, role.competencies.map(rc=>rc.id));
      const sw   = switchability(levels, ei, role);
      const eta  = etaMonths(levels, role);
      const prob = Math.min(95, Math.round(sw*0.5+adj*0.3+(ei/100)*20));
      const gaps = keyGaps(levels, role);
      res.json({ roleId:role.id, title:role.title, probability:prob, etaMonths:eta, adjacencyScore:adj, switchability:sw, barriers:gaps.map(g=>`Close ${g} gap`), accelerators: adj>=60?['Strong adjacency helps']:sw>=60?['High switchability']:['Market demand supports transition'] });
    } catch(e) { res.status(500).json({error:String(e)}); }
  });
}

/**
 * Organizational Dashboard Engine — Phase 5
 * Builds workforce heatmaps, leadership readiness maps,
 * organizational capability graphs, and workforce risk analysis.
 */

import type { OrgMember, CriticalRole, WorkforceCapabilityMap, DepartmentCapability } from './enterpriseIntelligenceEngine';
import { buildSuccessionPlan, type ReadinessTier } from './enterpriseIntelligenceEngine';

/* ── Workforce heatmap ───────────────────────────────────────────── */
export interface HeatCell {
  department:  string;
  competency:  string;
  avgLevel:    number;       // 0-5
  heat:        number;       // 0-100 normalised
  band:        'critical-gap' | 'developing' | 'adequate' | 'strong' | 'exceptional';
  memberCount: number;
  aboveTarget: number;       // count at or above target level
  belowTarget: number;
}

export interface WorkforceHeatmap {
  cells:           HeatCell[];
  departments:     string[];
  competencies:    string[];
  maxHeat:         number;
  minHeat:         number;
  criticalGapCells:HeatCell[];
  strongCells:     HeatCell[];
  summary: {
    totalCells:  number;
    gapCells:    number;
    strongCells: number;
    avgHeat:     number;
  };
}

export function buildWorkforceHeatmap(
  org:          OrgMember[],
  targetLevels: Record<string, number> = {},   // competencyId → target level 0-5
): WorkforceHeatmap {
  const departments = [...new Set(org.map(m => m.department))];
  const allCompIds  = [...new Set(org.flatMap(m => Object.keys(m.competencyLevels)))];

  const cells: HeatCell[] = [];
  for (const dept of departments) {
    const members = org.filter(m => m.department === dept);
    const n = Math.max(1, members.length);
    for (const comp of allCompIds) {
      const levels    = members.map(m => m.competencyLevels[comp] ?? 0);
      const avgLevel  = Math.round((levels.reduce((s, v) => s + v, 0) / n) * 10) / 10;
      const target    = targetLevels[comp] ?? 3;
      const heat      = Math.min(100, Math.round((avgLevel / 5) * 100));
      const band: HeatCell['band'] =
        avgLevel < 1.5       ? 'critical-gap' :
        avgLevel < 2.5       ? 'developing'   :
        avgLevel < 3.5       ? 'adequate'      :
        avgLevel < 4.5       ? 'strong'        : 'exceptional';
      const aboveTarget = levels.filter(v => v >= target).length;
      const belowTarget = levels.filter(v => v < target).length;
      cells.push({ department:dept, competency:comp, avgLevel, heat, band, memberCount:n, aboveTarget, belowTarget });
    }
  }

  const heats         = cells.map(c => c.heat);
  const criticalGaps  = cells.filter(c => c.band === 'critical-gap');
  const strongCells   = cells.filter(c => c.band === 'strong' || c.band === 'exceptional');
  const avgHeat       = heats.length > 0 ? Math.round(heats.reduce((s,v)=>s+v,0)/heats.length) : 0;

  return {
    cells, departments, competencies:allCompIds,
    maxHeat:Math.max(...heats, 0), minHeat:Math.min(...heats, 100),
    criticalGapCells:criticalGaps, strongCells,
    summary:{ totalCells:cells.length, gapCells:criticalGaps.length, strongCells:strongCells.length, avgHeat },
  };
}

/* ── Leadership readiness map ────────────────────────────────────── */
export interface ReadinessMapEntry {
  member:          OrgMember;
  role:            CriticalRole;
  readinessScore:  number;
  readinessTier:   ReadinessTier;
  topGaps:         { competencyId:string; gap:number }[];
  readyInMonths:   number;
}

export interface LeadershipReadinessMap {
  entries:         ReadinessMapEntry[];
  byRole:          Record<string, ReadinessMapEntry[]>;
  byMember:        Record<string, ReadinessMapEntry[]>;
  readyNowMatrix:  { roleId:string; roleTitle:string; readyNow:number; total:number; pct:number }[];
  overallCoverage: number;    // 0-100: % of roles with at least one ready-now candidate
  insights:        string[];
}

export function buildLeadershipReadinessMap(
  org:           OrgMember[],
  criticalRoles: CriticalRole[],
): LeadershipReadinessMap {
  const entries: ReadinessMapEntry[] = [];
  for (const role of criticalRoles) {
    const plans    = buildSuccessionPlan(org, role);
    for (const cand of plans.candidates) {
      entries.push({
        member:         cand.member,
        role,
        readinessScore: cand.readinessScore,
        readinessTier:  cand.readinessTier,
        topGaps:        cand.competencyGaps.sort((a,b)=>b.gap-a.gap).slice(0,3).map(g=>({ competencyId:g.id, gap:g.gap })),
        readyInMonths:  cand.estimatedReadyInMonths,
      });
    }
  }

  const byRole: Record<string, ReadinessMapEntry[]> = {};
  const byMember: Record<string, ReadinessMapEntry[]> = {};
  for (const e of entries) {
    if (!byRole[e.role.id])       byRole[e.role.id]       = [];
    if (!byMember[e.member.id])   byMember[e.member.id]   = [];
    byRole[e.role.id].push(e);
    byMember[e.member.id].push(e);
  }

  const readyNowMatrix = criticalRoles.map(role => {
    const roleEntries = byRole[role.id] ?? [];
    const readyNow    = roleEntries.filter(e => e.readinessTier === 'ready-now').length;
    return { roleId:role.id, roleTitle:role.title, readyNow, total:roleEntries.length, pct:Math.round((readyNow/Math.max(1,roleEntries.length))*100) };
  });

  const coveredRoles   = readyNowMatrix.filter(r => r.readyNow >= 1).length;
  const overallCoverage= Math.round((coveredRoles / Math.max(1, criticalRoles.length)) * 100);

  const insights: string[] = [];
  const uncovered = readyNowMatrix.filter(r => r.readyNow === 0);
  if (uncovered.length > 0) insights.push(`${uncovered.length} critical role(s) have zero ready-now candidates: ${uncovered.map(r=>r.roleTitle).join(', ')}.`);
  const multipleReady = readyNowMatrix.filter(r => r.readyNow >= 2);
  if (multipleReady.length > 0) insights.push(`${multipleReady.length} role(s) have strong bench (2+ ready-now): ${multipleReady.map(r=>r.roleTitle).join(', ')}.`);
  if (overallCoverage < 50) insights.push('Critical succession coverage below 50% — immediate leadership development investment required.');
  if (overallCoverage >= 80) insights.push('Succession coverage is healthy (80%+) — focus on accelerating 1-year candidates.');

  return { entries, byRole, byMember, readyNowMatrix, overallCoverage, insights };
}

/* ── Organizational capability graph ─────────────────────────────── */
export type CapabilityDomain = 'technical' | 'analytical' | 'communication' | 'leadership' | 'creative' | 'execution' | 'behavioral';

export interface OrgCapabilityNode {
  department:  string;
  memberCount: number;
  domains:     Record<CapabilityDomain, number>;   // 0-100 per domain
  overall:     number;
  eiAvg:       number;
  radarData:   { axis:string; value:number }[];
}

export interface OrgCapabilityGraph {
  nodes:          OrgCapabilityNode[];
  orgAvg:         Record<CapabilityDomain, number>;
  orgRadar:       { axis:string; value:number }[];
  topDepartment:  string;
  gapDepartment:  string;
  domainInsights: { domain:CapabilityDomain; strength:'org-strength'|'org-gap'; score:number; narrative:string }[];
}

const DOMAIN_COMP_MAP: Record<CapabilityDomain, string[]> = {
  technical:     ['programming','systems-design','cloud','data-engineering','security'],
  analytical:    ['data-analysis','statistics','business-acumen','research'],
  communication: ['writing','presentation','stakeholder-mgmt'],
  leadership:    ['people-mgmt','strategy','mentoring'],
  creative:      ['innovation','design-thinking','ux-design'],
  execution:     ['project-mgmt','negotiation'],
  behavioral:    ['collaboration','resilience','drive','adaptability'],
};

export function buildOrgCapabilityGraph(
  org:          OrgMember[],
  capabilityMap:WorkforceCapabilityMap,
): OrgCapabilityGraph {
  const domains: CapabilityDomain[] = ['technical','analytical','communication','leadership','creative','execution','behavioral'];

  function domainScore(avgComp: Record<string,number>, domain: CapabilityDomain): number {
    const comps  = DOMAIN_COMP_MAP[domain];
    const values = comps.map(c => avgComp[c] ?? 0);
    const avg    = values.reduce((s,v)=>s+v,0) / Math.max(1, values.length);
    return Math.min(100, Math.round(avg * 20));
  }

  const nodes: OrgCapabilityNode[] = capabilityMap.departments.map(dept => {
    const members = org.filter(m => m.department === dept.department);
    const eiAvg   = Math.round(members.reduce((s,m)=>s+m.eiScore,0) / Math.max(1,members.length));
    const domainScores: Record<CapabilityDomain, number> = {} as Record<CapabilityDomain, number>;
    for (const d of domains) domainScores[d] = domainScore(dept.avgCompetency, d);
    const overall   = Math.round(Object.values(domainScores).reduce((s,v)=>s+v,0) / domains.length);
    const radarData = domains.map(d => ({ axis:d, value:domainScores[d] }));
    return { department:dept.department, memberCount:dept.memberCount, domains:domainScores, overall, eiAvg, radarData };
  });

  const orgAvg: Record<CapabilityDomain, number> = {} as Record<CapabilityDomain, number>;
  for (const d of domains) {
    const vals = nodes.map(n => n.domains[d]);
    orgAvg[d]  = Math.round(vals.reduce((s,v)=>s+v,0) / Math.max(1,vals.length));
  }
  const orgRadar = domains.map(d => ({ axis:d, value:orgAvg[d] }));

  const sorted       = [...nodes].sort((a,b) => b.overall - a.overall);
  const topDept      = sorted[0]?.department ?? '';
  const gapDept      = sorted[sorted.length-1]?.department ?? '';

  const domainInsights = domains.map(d => {
    const score = orgAvg[d];
    const strength: 'org-strength'|'org-gap' = score >= 65 ? 'org-strength' : 'org-gap';
    const narrative = strength === 'org-strength'
      ? `${d} is an organisational strength (${score}/100) — leverage this in hiring and branding.`
      : `${d} is an organisational gap (${score}/100) — prioritise in L&D and hiring plans.`;
    return { domain:d, strength, score, narrative };
  }).sort((a,b) => a.score - b.score);

  return { nodes, orgAvg, orgRadar, topDepartment:topDept, gapDepartment:gapDept, domainInsights };
}

/* ── Workforce risk analysis ─────────────────────────────────────── */
export type RiskType = 'concentration' | 'single-point-of-failure' | 'retention' | 'skill-obsolescence' | 'pipeline-gap' | 'ai-exposure';

export interface WorkforceRisk {
  type:         RiskType;
  severity:     'critical' | 'high' | 'medium' | 'low';
  title:        string;
  description:  string;
  affectedRoles:string[];
  affectedCount:number;
  mitigations:  string[];
  score:        number;    // 0-100 risk score
}

export interface WorkforceRiskReport {
  risks:          WorkforceRisk[];
  overallRiskScore:number;   // 0-100
  riskLabel:      'critical' | 'elevated' | 'moderate' | 'managed';
  criticalRisks:  WorkforceRisk[];
  topMitigation:  string;
  narrative:      string;
}

const HIGH_AUTOMATION_ROLES = ['Data Analyst','Finance Analyst','HR Operations','Content Analyst','Marketing Analyst','Support Agent'];
const CRITICAL_SINGLE_COMPS = ['systems-design','security','cloud','statistics'];

export function buildWorkforceRiskReport(
  org:          OrgMember[],
  capabilityMap:WorkforceCapabilityMap,
): WorkforceRiskReport {
  const risks: WorkforceRisk[] = [];
  const n = Math.max(1, org.length);

  // 1. Role concentration risk
  const roleCounts: Record<string,number> = {};
  for (const m of org) roleCounts[m.currentRole] = (roleCounts[m.currentRole]??0) + 1;
  const topRole   = Object.entries(roleCounts).sort(([,a],[,b])=>b-a)[0];
  const concPct   = topRole ? topRole[1] / n : 0;
  if (concPct > 0.35) {
    risks.push({ type:'concentration', severity:concPct>0.5?'critical':'high', title:'Role Concentration Risk', description:`${Math.round(concPct*100)}% of the workforce is in a single role (${topRole?.[0]}). Disruption to this function has outsized org impact.`, affectedRoles:[topRole?.[0]??''], affectedCount:topRole?.[1]??0, mitigations:['Cross-train for adjacent roles','Diversify hiring pipeline','Build role rotation program'], score:Math.round(concPct*100) });
  }

  // 2. Single point of failure (critical comp with only 1 person at L4+)
  for (const comp of CRITICAL_SINGLE_COMPS) {
    const experts = org.filter(m => (m.competencyLevels[comp]??0) >= 4);
    if (experts.length === 1) {
      risks.push({ type:'single-point-of-failure', severity:'critical', title:`SPOF: ${comp}`, description:`Only 1 person (${experts[0].name}) has expert-level ${comp} capability. Their departure creates an immediate operational gap.`, affectedRoles:[experts[0].currentRole], affectedCount:1, mitigations:['Pair with a junior to transfer knowledge','Document critical processes','Hire a backup expert'], score:85 });
    } else if (experts.length === 0) {
      risks.push({ type:'single-point-of-failure', severity:'high', title:`Capability Gap: ${comp}`, description:`No one in the org has expert-level ${comp}. This is a critical gap for any technical transformation.`, affectedRoles:[], affectedCount:0, mitigations:['Immediate senior hire','Upskilling program for most promising candidates'], score:75 });
    }
  }

  // 3. Retention risk (high potential + high retention risk)
  const atRisk = org.filter(m => m.potential === 'high' && m.retentionRisk === 'high');
  if (atRisk.length > 0) {
    risks.push({ type:'retention', severity:atRisk.length>=3?'critical':'high', title:'High-Potential Attrition Risk', description:`${atRisk.length} high-potential employees have elevated retention risk — representing disproportionate value to the organisation.`, affectedRoles:[...new Set(atRisk.map(m=>m.currentRole))], affectedCount:atRisk.length, mitigations:['Individual retention conversations','Salary benchmarking and adjustment','Accelerated promotion paths','High-visibility project assignments'], score:Math.min(100, atRisk.length * 25) });
  }

  // 4. Skill obsolescence risk
  const obsRoles = org.filter(m => HIGH_AUTOMATION_ROLES.some(r => m.currentRole.toLowerCase().includes(r.toLowerCase())));
  if (obsRoles.length > 0) {
    risks.push({ type:'skill-obsolescence', severity:obsRoles.length/n>0.2?'high':'medium', title:'Automation Exposure in Workforce', description:`${obsRoles.length} employees are in roles with high AI/automation exposure. Without proactive reskilling, these roles face displacement risk within 2–4 years.`, affectedRoles:[...new Set(obsRoles.map(m=>m.currentRole))], affectedCount:obsRoles.length, mitigations:['AI literacy upskilling program','Role evolution roadmaps for at-risk positions','Internal mobility pathways to adjacent roles'], score:Math.min(100, Math.round(obsRoles.length/n*150)) });
  }

  // 5. Pipeline gap
  const directors = org.filter(m => ['director','vp','c-suite'].includes(m.level)).length;
  const seniors   = org.filter(m => ['senior','lead','principal'].includes(m.level)).length;
  if (seniors < directors * 2) {
    risks.push({ type:'pipeline-gap', severity:'medium', title:'Shallow Leadership Pipeline', description:`Pipeline ratio is ${seniors}:${directors} (senior:director). A healthy pipeline requires at least 2:1.`, affectedRoles:['Senior Engineer','Senior Analyst','Lead'], affectedCount:seniors, mitigations:['Promote high performers to lead roles','Hire experienced senior ICs','Run leadership development cohort'], score:55 });
  }

  // 6. AI exposure in org
  const lowAI = org.filter(m => (m.competencyLevels['data-analysis']??0) + (m.competencyLevels['programming']??0) < 2);
  if (lowAI.length / n > 0.4) {
    risks.push({ type:'ai-exposure', severity:'high', title:'Low AI Literacy Across Workforce', description:`${Math.round(lowAI.length/n*100)}% of the workforce has minimal programming or data literacy — limiting AI tool adoption and transformation readiness.`, affectedRoles:[...new Set(lowAI.map(m=>m.currentRole))].slice(0,5), affectedCount:lowAI.length, mitigations:['AI Literacy mandatory program (8h)','AI tool experimentation sprints','Buddy program pairing high/low literacy employees'], score:70 });
  }

  const criticalRisks = risks.filter(r => r.severity === 'critical');
  const overallRisk   = risks.length > 0 ? Math.round(risks.reduce((s,r)=>s+r.score,0) / risks.length) : 10;
  const riskLabel: WorkforceRiskReport['riskLabel'] = overallRisk >= 75 ? 'critical' : overallRisk >= 55 ? 'elevated' : overallRisk >= 35 ? 'moderate' : 'managed';
  const topMitigation = criticalRisks[0]?.mitigations[0] ?? risks[0]?.mitigations[0] ?? 'Continue monitoring workforce health indicators.';
  const narrative = `Workforce risk score: ${overallRisk}/100 (${riskLabel}). ${criticalRisks.length} critical risk(s) require immediate attention. Top priority: ${topMitigation}`;

  return { risks:risks.sort((a,b)=>b.score-a.score), overallRiskScore:overallRisk, riskLabel, criticalRisks, topMitigation, narrative };
}

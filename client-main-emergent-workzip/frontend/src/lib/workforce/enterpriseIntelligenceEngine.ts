/**
 * Enterprise Intelligence Engine — Phase 5
 * Succession readiness, leadership pipeline, workforce capability mapping,
 * transformation readiness analysis — for org-level inputs.
 */

/* ── Org member model ────────────────────────────────────────────── */
export interface OrgMember {
  id:             string;
  name:           string;
  currentRole:    string;
  department:     string;
  level:          'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp' | 'c-suite';
  competencyLevels:Record<string, number>;    // competencyId → 0-5
  eiScore:        number;                     // 0-100
  yearsExperience:number;
  yearsInRole:    number;
  retentionRisk:  'low' | 'medium' | 'high';
  potential:      'high' | 'medium' | 'low';
  tags?:          string[];
}

export interface CriticalRole {
  id:             string;
  title:          string;
  department:     string;
  level:          OrgMember['level'];
  requiredCompetencies:Record<string, number>;   // competencyId → min required level
  minEI:          number;
  minExperience:  number;
  priority:       'critical' | 'high' | 'medium';
}

/* ── Succession readiness ────────────────────────────────────────── */
export type ReadinessTier = 'ready-now' | '1-year' | '2-year' | 'not-ready';

export interface SuccessionCandidate {
  member:          OrgMember;
  readinessScore:  number;      // 0-100
  readinessTier:   ReadinessTier;
  competencyGaps:  { id:string; current:number; required:number; gap:number }[];
  strengths:       string[];
  developmentAreas:string[];
  eiGap:           number;
  experienceGap:   number;
  estimatedReadyInMonths: number;
}

export interface SuccessionPlan {
  role:             CriticalRole;
  candidates:       SuccessionCandidate[];   // top 3
  benchStrength:    number;   // 0-100 (how strong is the bench)
  coverageRisk:     'covered' | 'at-risk' | 'critical-gap';
  readyNowCount:    number;
  riskNarrative:    string;
}

function computeReadiness(member: OrgMember, role: CriticalRole): SuccessionCandidate {
  const reqComps = role.requiredCompetencies;
  const gaps: SuccessionCandidate['competencyGaps'] = [];
  let compScore = 0; let compCount = 0;
  for (const [compId, required] of Object.entries(reqComps)) {
    const current = member.competencyLevels[compId] ?? 0;
    const gap     = Math.max(0, required - current);
    gaps.push({ id:compId, current, required, gap });
    compScore += Math.min(1, current / required);
    compCount++;
  }
  const competencyReadiness = compCount > 0 ? (compScore / compCount) * 50 : 25;
  const eiReadiness         = Math.min(20, (member.eiScore / role.minEI) * 20);
  const expReadiness        = Math.min(15, (member.yearsExperience / role.minExperience) * 15);
  const potentialBonus      = member.potential === 'high' ? 10 : member.potential === 'medium' ? 5 : 0;
  const retentionPenalty    = member.retentionRisk === 'high' ? -8 : member.retentionRisk === 'medium' ? -3 : 0;
  const readinessScore      = Math.min(100, Math.max(0, Math.round(competencyReadiness + eiReadiness + expReadiness + potentialBonus + retentionPenalty)));

  const readinessTier: ReadinessTier =
    readinessScore >= 80 ? 'ready-now' :
    readinessScore >= 60 ? '1-year'    :
    readinessScore >= 40 ? '2-year'    : 'not-ready';

  const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g.gap, 0) / gaps.length : 0;
  const estimatedMonths = readinessTier === 'ready-now' ? 0 : readinessTier === '1-year' ? 12 : readinessTier === '2-year' ? 24 : 36;

  const strengths = gaps.filter(g => g.gap === 0).map(g => g.id);
  const devAreas  = gaps.sort((a, b) => b.gap - a.gap).slice(0, 3).map(g => g.id);

  return {
    member, readinessScore, readinessTier,
    competencyGaps:gaps, strengths, developmentAreas:devAreas,
    eiGap:       Math.max(0, role.minEI - member.eiScore),
    experienceGap:Math.max(0, role.minExperience - member.yearsExperience),
    estimatedReadyInMonths:estimatedMonths,
  };
}

export function buildSuccessionPlan(org: OrgMember[], role: CriticalRole): SuccessionPlan {
  const candidates = org
    .filter(m => m.id !== role.id && m.level !== 'junior')
    .map(m => computeReadiness(m, role))
    .sort((a, b) => b.readinessScore - a.readinessScore)
    .slice(0, 3);

  const readyNow       = candidates.filter(c => c.readinessTier === 'ready-now').length;
  const benchStrength  = candidates.length > 0 ? Math.round(candidates.reduce((s, c) => s + c.readinessScore, 0) / candidates.length) : 0;
  const coverageRisk: SuccessionPlan['coverageRisk'] = readyNow >= 2 ? 'covered' : readyNow >= 1 ? 'at-risk' : 'critical-gap';
  const riskNarrative  =
    coverageRisk === 'covered'      ? `${readyNow} ready-now candidate(s) provide solid bench coverage for ${role.title}.` :
    coverageRisk === 'at-risk'      ? `Only ${readyNow} ready-now candidate for ${role.title}. Single point of failure risk.` :
                                      `No ready-now candidates for ${role.title}. Critical succession gap — accelerate development pipeline.`;
  return { role, candidates, benchStrength, coverageRisk, readyNowCount:readyNow, riskNarrative };
}

/* ── Leadership pipeline ─────────────────────────────────────────── */
export type PipelineTier = 'N' | 'N-1' | 'N-2';

export interface PipelineLayer {
  tier:         PipelineTier;
  label:        string;
  members:      OrgMember[];
  count:        number;
  avgEI:        number;
  avgReadiness: number;    // 0-100
  highPotential:number;    // count with potential=high
  atRiskCount:  number;    // retention risk = high
  benchScore:   number;    // 0-100
}

export interface LeadershipPipeline {
  layers:        PipelineLayer[];
  pipelineDepth: number;    // total pipeline members across N-1 + N-2
  pipelineScore: number;    // 0-100 composite health
  topTalent:     OrgMember[];
  atRisk:        OrgMember[];   // high potential + high retention risk
  insights:      string[];
}

const TIER_LEVELS: Record<PipelineTier, OrgMember['level'][]> = {
  'N':   ['vp','c-suite'],
  'N-1': ['director','vp'],
  'N-2': ['principal','lead','senior'],
};

export function buildLeadershipPipeline(org: OrgMember[]): LeadershipPipeline {
  const layers: PipelineLayer[] = (['N','N-1','N-2'] as PipelineTier[]).map(tier => {
    const levels  = TIER_LEVELS[tier];
    const members = org.filter(m => levels.includes(m.level));
    const n       = Math.max(1, members.length);
    const avgEI   = Math.round(members.reduce((s, m) => s + m.eiScore, 0) / n);
    const hiPot   = members.filter(m => m.potential === 'high').length;
    const atRisk  = members.filter(m => m.retentionRisk === 'high').length;
    const benchScore = Math.min(100, Math.round(avgEI * 0.4 + (hiPot / n) * 60));
    return { tier, label:tier, members, count:members.length, avgEI, avgReadiness:benchScore, highPotential:hiPot, atRiskCount:atRisk, benchScore };
  });

  const pipelineDepth = (layers[1]?.count ?? 0) + (layers[2]?.count ?? 0);
  const pipelineScore = Math.round(layers.reduce((s, l) => s + l.benchScore, 0) / 3);

  const topTalent = org.filter(m => m.potential === 'high').sort((a, b) => b.eiScore - a.eiScore).slice(0, 5);
  const atRisk    = org.filter(m => m.potential === 'high' && m.retentionRisk === 'high');

  const insights: string[] = [];
  if (layers[0]?.count === 0) insights.push('No N-tier leaders in org — consider leadership structure review.');
  if (atRisk.length > 0)       insights.push(`${atRisk.length} high-potential employee(s) at high retention risk — immediate retention action needed.`);
  if (pipelineScore < 50)      insights.push('Pipeline health is below threshold — accelerate leadership development programs.');
  if (pipelineDepth < 3)       insights.push('Shallow pipeline (< 3 members at N-1/N-2) — succession risk is elevated.');
  if (pipelineScore >= 75)     insights.push('Pipeline health is strong — maintain development cadence and monitor retention signals.');

  return { layers, pipelineDepth, pipelineScore, topTalent, atRisk, insights };
}

/* ── Workforce capability map ─────────────────────────────────────── */
export interface DepartmentCapability {
  department:    string;
  memberCount:   number;
  avgCompetency: Record<string, number>;   // competencyId → avg level 0-5
  overallScore:  number;                   // 0-100
  topStrengths:  string[];
  criticalGaps:  string[];
  eiAvg:         number;
  highPotentialPct:number;
}

export interface WorkforceCapabilityMap {
  departments:     DepartmentCapability[];
  orgOverallScore: number;
  topOrgStrengths: string[];
  criticalOrgGaps: string[];
  balanceScore:    number;   // 0-100 (how evenly distributed capability is)
  heatmapData:     { department:string; competency:string; score:number; level:'low'|'medium'|'high' }[];
}

export function buildWorkforceCapabilityMap(
  org:           OrgMember[],
  targetCompetencies?:string[],
): WorkforceCapabilityMap {
  const depts = [...new Set(org.map(m => m.department))];
  const deptCaps: DepartmentCapability[] = depts.map(dept => {
    const members = org.filter(m => m.department === dept);
    const n       = Math.max(1, members.length);
    const allCompIds = [...new Set(members.flatMap(m => Object.keys(m.competencyLevels)))];
    const avgComp: Record<string, number> = {};
    for (const id of allCompIds) {
      const vals = members.map(m => m.competencyLevels[id] ?? 0);
      avgComp[id] = Math.round((vals.reduce((s, v) => s + v, 0) / n) * 10) / 10;
    }
    const overallScore = Math.round((Object.values(avgComp).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(avgComp).length)) * 20);
    const sorted       = Object.entries(avgComp).sort(([,a],[,b]) => b - a);
    const eiAvg        = Math.round(members.reduce((s, m) => s + m.eiScore, 0) / n);
    const hiPotPct     = Math.round((members.filter(m => m.potential === 'high').length / n) * 100);
    return { department:dept, memberCount:n, avgCompetency:avgComp, overallScore, topStrengths:sorted.slice(0,3).map(([k])=>k), criticalGaps:sorted.slice(-3).filter(([,v])=>v<2).map(([k])=>k), eiAvg, highPotentialPct:hiPotPct };
  });

  const orgScores = deptCaps.map(d => d.overallScore);
  const orgOverall = Math.round(orgScores.reduce((s,v)=>s+v,0) / Math.max(1, orgScores.length));
  const variance   = orgScores.reduce((s,v) => s + Math.pow(v - orgOverall, 2), 0) / Math.max(1, orgScores.length);
  const balanceScore = Math.max(0, Math.round(100 - Math.sqrt(variance)));

  const allStrengths   = deptCaps.flatMap(d => d.topStrengths);
  const strengthCounts: Record<string,number> = {};
  for (const s of allStrengths) strengthCounts[s] = (strengthCounts[s]??0) + 1;
  const topOrgStrengths = Object.entries(strengthCounts).sort(([,a],[,b])=>b-a).slice(0,3).map(([k])=>k);
  const allGaps = deptCaps.flatMap(d => d.criticalGaps);
  const gapCounts: Record<string,number> = {};
  for (const g of allGaps) gapCounts[g] = (gapCounts[g]??0) + 1;
  const criticalOrgGaps = Object.entries(gapCounts).sort(([,a],[,b])=>b-a).slice(0,3).map(([k])=>k);

  const heatmapData = deptCaps.flatMap(dc =>
    Object.entries(dc.avgCompetency).map(([comp, score]) => ({
      department:dc.department, competency:comp, score,
      level:(score >= 3.5 ? 'high' : score >= 2 ? 'medium' : 'low') as 'low'|'medium'|'high',
    }))
  );

  return { departments:deptCaps, orgOverallScore:orgOverall, topOrgStrengths, criticalOrgGaps, balanceScore, heatmapData };
}

/* ── Transformation readiness ─────────────────────────────────────── */
export type TransformationDimension = 'digital' | 'agile' | 'leadership' | 'cultural' | 'technical';

export interface TransformationReadinessScore {
  dimension:    TransformationDimension;
  score:        number;    // 0-100
  band:         'ready' | 'progressing' | 'developing' | 'at-risk';
  indicators:   string[];
  blockers:     string[];
  accelerators: string[];
}

export interface TransformationReadinessReport {
  dimensions:        TransformationReadinessScore[];
  compositeScore:    number;
  readinessLabel:    'transformation-ready' | 'approaching-ready' | 'needs-investment' | 'not-ready';
  criticalBlockers:  string[];
  topAccelerators:   string[];
  estimatedTimeToReady: number;   // months
  narrative:         string;
}

export function assessTransformationReadiness(
  org:            OrgMember[],
  capabilityMap:  WorkforceCapabilityMap,
  pipeline:       LeadershipPipeline,
): TransformationReadinessReport {
  const n = Math.max(1, org.length);

  // Digital readiness: avg of digital/AI competencies
  const digitalComps = ['programming','cloud','data-engineering','data-analysis','security'];
  const digitalScores = org.map(m => {
    const vals = digitalComps.map(c => m.competencyLevels[c] ?? 0);
    return vals.reduce((s,v)=>s+v,0) / digitalComps.length;
  });
  const digitalScore = Math.min(100, Math.round((digitalScores.reduce((s,v)=>s+v,0)/n) * 20));

  // Agile readiness: adoption of agile mindset proxied by level distribution
  const seniorPct = org.filter(m => ['senior','lead','principal','director','vp','c-suite'].includes(m.level)).length / n;
  const agileScore = Math.min(100, Math.round(50 + seniorPct * 50));

  // Leadership readiness: pipeline score
  const leadershipScore = pipeline.pipelineScore;

  // Cultural readiness: retention risk inverse + high potential pct
  const highRetentionRisk = org.filter(m => m.retentionRisk === 'high').length / n;
  const highPotPct        = org.filter(m => m.potential === 'high').length / n;
  const culturalScore     = Math.min(100, Math.round(60 - highRetentionRisk * 50 + highPotPct * 40));

  // Technical readiness: overall org competency score
  const technicalScore = capabilityMap.orgOverallScore;

  const buildScore = (dim: TransformationDimension, score: number): TransformationReadinessScore => {
    const band: TransformationReadinessScore['band'] = score >= 75 ? 'ready' : score >= 55 ? 'progressing' : score >= 35 ? 'developing' : 'at-risk';
    const indicatorMap: Record<TransformationDimension, string[]> = {
      digital:    ['AI/ML capability adoption','Cloud-native architecture adoption','Data literacy across teams'],
      agile:      ['Sprint cadence maturity','Cross-functional squad model','Retrospective culture'],
      leadership: ['Pipeline depth at N-1/N-2','High-potential development','Succession coverage'],
      cultural:   ['Retention of high performers','Psychological safety indicators','Innovation appetite'],
      technical:  ['Core competency levels','Learning velocity','Skills breadth vs depth'],
    };
    const blockerMap: Record<TransformationDimension, string[]> = {
      digital:    score<60?['Low AI/ML literacy','Legacy toolchain resistance']:[''],
      agile:      score<60?['Low senior/lead ratio','Waterfall-dominant delivery']:[''],
      leadership: score<60?['Shallow pipeline','High-pot attrition risk']:[''],
      cultural:   score<60?['High retention risk in key roles','Low high-potential density']:[''],
      technical:  score<60?['Competency gaps in critical domains','Slow learning velocity']:[''],
    };
    const accelMap: Record<TransformationDimension, string[]> = {
      digital:    ['AI tooling investment','Hackathons and innovation sprints'],
      agile:      ['Agile coaching program','Squad model restructuring'],
      leadership: ['Leadership accelerator programs','Stretch assignment cadence'],
      cultural:   ['Retention bonuses for high performers','Transparent career path framework'],
      technical:  ['Structured upskilling budget','External mentorship programs'],
    };
    return { dimension:dim, score, band, indicators:indicatorMap[dim], blockers:blockerMap[dim].filter(Boolean), accelerators:accelMap[dim] };
  };

  const dimensions: TransformationReadinessScore[] = [
    buildScore('digital',    digitalScore),
    buildScore('agile',      agileScore),
    buildScore('leadership', leadershipScore),
    buildScore('cultural',   culturalScore),
    buildScore('technical',  technicalScore),
  ];

  const composite = Math.round(dimensions.reduce((s,d)=>s+d.score,0)/5);
  const readinessLabel: TransformationReadinessReport['readinessLabel'] =
    composite >= 75 ? 'transformation-ready' : composite >= 55 ? 'approaching-ready' : composite >= 35 ? 'needs-investment' : 'not-ready';

  const criticalBlockers = dimensions.filter(d => d.band === 'at-risk').flatMap(d => d.blockers).slice(0,3);
  const topAccelerators  = dimensions.filter(d => d.band !== 'ready').flatMap(d => d.accelerators).slice(0,3);
  const estimatedMonths  = readinessLabel === 'transformation-ready' ? 0 : readinessLabel === 'approaching-ready' ? 6 : readinessLabel === 'needs-investment' ? 18 : 36;

  const narrative = readinessLabel === 'transformation-ready'
    ? `The organisation scores ${composite}/100 across transformation dimensions — genuinely positioned to execute strategic transformation. Key risk: maintain momentum and monitor cultural signals.`
    : readinessLabel === 'approaching-ready'
    ? `At ${composite}/100, the organisation is approaching transformation readiness. Targeted investment in ${dimensions.filter(d=>d.band==='developing'||d.band==='at-risk').map(d=>d.dimension).join(', ')} will close the gap in ~${estimatedMonths} months.`
    : `At ${composite}/100, the organisation requires structured investment before transformation programs will succeed. ${criticalBlockers[0] ?? 'Foundational capability gaps'} is the primary blocker.`;

  return { dimensions, compositeScore:composite, readinessLabel, criticalBlockers, topAccelerators, estimatedTimeToReady:estimatedMonths, narrative };
}

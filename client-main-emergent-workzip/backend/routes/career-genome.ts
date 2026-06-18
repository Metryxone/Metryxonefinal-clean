/**
 * Career Genome API Routes
 * Self-contained — all data and computation logic is inline.
 */

import type { Express } from 'express';

type Profile = Record<string, unknown>;

/* ── Compact genome (id → deps, adjacent, unlocks) ─────────────────── */
const GENOME: Record<string, { label:string; domain:string; prereqs:{id:string;min:number}[]; adjacent:string[]; unlocks:string[]; learnability:number; transferability:number; tier:1|2|3; weeks:number }> = {
  'programming':     { label:'Programming',         domain:'technical',     prereqs:[],                                                         adjacent:['systems-design','data-engineering','cloud','security'],        unlocks:['systems-design','data-engineering','security','cloud'], learnability:78, transferability:88, tier:1, weeks:16 },
  'systems-design':  { label:'Systems Design',      domain:'technical',     prereqs:[{id:'programming',min:2}],                                 adjacent:['programming','cloud','security','data-engineering'],          unlocks:['cloud','security','strategy'],                           learnability:58, transferability:75, tier:3, weeks:24 },
  'cloud':           { label:'Cloud & DevOps',      domain:'technical',     prereqs:[{id:'systems-design',min:2}],                              adjacent:['systems-design','security','programming','process'],          unlocks:['security','strategy'],                                   learnability:65, transferability:82, tier:2, weeks:20 },
  'data-engineering':{ label:'Data Engineering',    domain:'technical',     prereqs:[{id:'programming',min:3},{id:'data-analysis',min:1}],      adjacent:['programming','data-analysis','statistics','cloud'],           unlocks:['statistics'],                                            learnability:62, transferability:80, tier:2, weeks:20 },
  'security':        { label:'Security',            domain:'technical',     prereqs:[{id:'systems-design',min:2},{id:'programming',min:2}],     adjacent:['cloud','systems-design','process'],                           unlocks:['process'],                                               learnability:52, transferability:72, tier:3, weeks:28 },
  'data-analysis':   { label:'Data Analysis',       domain:'analytical',    prereqs:[],                                                         adjacent:['statistics','business-acumen','research','data-engineering'], unlocks:['statistics','business-acumen','research'],                learnability:80, transferability:90, tier:1, weeks:12 },
  'statistics':      { label:'Statistics & ML',     domain:'analytical',    prereqs:[{id:'data-analysis',min:2}],                               adjacent:['data-analysis','data-engineering','research','programming'],  unlocks:['research'],                                              learnability:55, transferability:76, tier:3, weeks:28 },
  'business-acumen': { label:'Business Acumen',     domain:'analytical',    prereqs:[{id:'data-analysis',min:1}],                               adjacent:['data-analysis','strategy','stakeholder-mgmt','negotiation'],  unlocks:['strategy','negotiation'],                                learnability:70, transferability:92, tier:2, weeks:16 },
  'research':        { label:'Research',            domain:'analytical',    prereqs:[],                                                         adjacent:['data-analysis','statistics','writing'],                       unlocks:['writing'],                                               learnability:74, transferability:86, tier:1, weeks:12 },
  'writing':         { label:'Writing',             domain:'communication', prereqs:[],                                                         adjacent:['presentation','storytelling','research'],                    unlocks:['storytelling','stakeholder-mgmt'],                        learnability:82, transferability:95, tier:1, weeks:10 },
  'presentation':    { label:'Presentation',        domain:'communication', prereqs:[{id:'writing',min:1}],                                     adjacent:['writing','storytelling','stakeholder-mgmt'],                 unlocks:['stakeholder-mgmt','storytelling','negotiation'],          learnability:76, transferability:93, tier:1, weeks:10 },
  'stakeholder-mgmt':{ label:'Stakeholder Mgmt',   domain:'communication', prereqs:[{id:'presentation',min:2},{id:'writing',min:2}],            adjacent:['presentation','strategy','negotiation','people-mgmt'],       unlocks:['strategy','people-mgmt'],                                learnability:62, transferability:88, tier:2, weeks:18 },
  'people-mgmt':     { label:'People Management',  domain:'leadership',    prereqs:[{id:'mentoring',min:2},{id:'collaboration',min:3}],         adjacent:['mentoring','strategy','stakeholder-mgmt','process'],         unlocks:['strategy'],                                              learnability:55, transferability:80, tier:3, weeks:32 },
  'strategy':        { label:'Strategic Thinking',  domain:'leadership',    prereqs:[{id:'business-acumen',min:3},{id:'stakeholder-mgmt',min:2}],adjacent:['people-mgmt','business-acumen','stakeholder-mgmt','negotiation'],unlocks:[],                                               learnability:48, transferability:85, tier:3, weeks:40 },
  'mentoring':       { label:'Mentoring',           domain:'leadership',    prereqs:[{id:'collaboration',min:2},{id:'resilience',min:2}],       adjacent:['people-mgmt','collaboration','resilience','presentation'],   unlocks:['people-mgmt'],                                           learnability:68, transferability:82, tier:2, weeks:20 },
  'design-thinking': { label:'Design Thinking',     domain:'creative',      prereqs:[],                                                         adjacent:['visual-design','storytelling','research','presentation'],    unlocks:['visual-design','storytelling'],                           learnability:84, transferability:90, tier:1, weeks:8  },
  'visual-design':   { label:'Visual Design',       domain:'creative',      prereqs:[{id:'design-thinking',min:2}],                             adjacent:['design-thinking','storytelling','presentation'],             unlocks:['storytelling'],                                          learnability:70, transferability:76, tier:2, weeks:18 },
  'storytelling':    { label:'Storytelling',        domain:'creative',      prereqs:[{id:'writing',min:2},{id:'presentation',min:2}],           adjacent:['writing','presentation','design-thinking','visual-design'],  unlocks:[],                                                        learnability:72, transferability:88, tier:2, weeks:14 },
  'project-mgmt':    { label:'Project Management',  domain:'execution',     prereqs:[{id:'process',min:2},{id:'collaboration',min:2}],          adjacent:['process','negotiation','stakeholder-mgmt','people-mgmt'],   unlocks:['negotiation','people-mgmt'],                             learnability:75, transferability:92, tier:2, weeks:16 },
  'process':         { label:'Process Excellence',  domain:'execution',     prereqs:[],                                                         adjacent:['project-mgmt','cloud','security','data-analysis'],          unlocks:['project-mgmt'],                                          learnability:80, transferability:88, tier:1, weeks:10 },
  'negotiation':     { label:'Negotiation',         domain:'execution',     prereqs:[{id:'presentation',min:2},{id:'stakeholder-mgmt',min:2}],  adjacent:['stakeholder-mgmt','strategy','business-acumen','people-mgmt'],unlocks:[],                                                      learnability:60, transferability:90, tier:2, weeks:20 },
  'drive':           { label:'Drive & Ownership',   domain:'behavioral',    prereqs:[],                                                         adjacent:['resilience','collaboration','process'],                      unlocks:['resilience'],                                            learnability:60, transferability:98, tier:1, weeks:8  },
  'collaboration':   { label:'Collaboration',       domain:'behavioral',    prereqs:[],                                                         adjacent:['drive','mentoring','project-mgmt','people-mgmt'],           unlocks:['mentoring','project-mgmt'],                              learnability:72, transferability:96, tier:1, weeks:8  },
  'resilience':      { label:'Resilience',          domain:'behavioral',    prereqs:[],                                                         adjacent:['drive','mentoring','cloud','security'],                      unlocks:['mentoring'],                                             learnability:55, transferability:95, tier:1, weeks:12 },
};

/* ── Future signals (condensed) ─────────────────────────────────────── */
const FUTURE: Record<string, { rel1:number; rel3:number; rel5:number; traj:string; aiImpact:string; salaryPct:number }> = {
  'programming':     { rel1:90, rel3:82, rel5:72, traj:'stable',   aiImpact:'augments',  salaryPct:18 },
  'systems-design':  { rel1:91, rel3:93, rel5:92, traj:'rising',   aiImpact:'augments',  salaryPct:28 },
  'cloud':           { rel1:90, rel3:92, rel5:90, traj:'rising',   aiImpact:'augments',  salaryPct:25 },
  'data-engineering':{ rel1:90, rel3:94, rel5:96, traj:'hot',      aiImpact:'creates',   salaryPct:30 },
  'security':        { rel1:93, rel3:96, rel5:97, traj:'hot',      aiImpact:'creates',   salaryPct:35 },
  'data-analysis':   { rel1:83, rel3:78, rel5:68, traj:'stable',   aiImpact:'augments',  salaryPct:12 },
  'statistics':      { rel1:88, rel3:92, rel5:93, traj:'hot',      aiImpact:'creates',   salaryPct:32 },
  'business-acumen': { rel1:82, rel3:85, rel5:88, traj:'rising',   aiImpact:'augments',  salaryPct:20 },
  'research':        { rel1:76, rel3:80, rel5:82, traj:'rising',   aiImpact:'augments',  salaryPct:14 },
  'writing':         { rel1:72, rel3:65, rel5:58, traj:'declining', aiImpact:'replaces',  salaryPct:5  },
  'presentation':    { rel1:82, rel3:84, rel5:85, traj:'stable',   aiImpact:'augments',  salaryPct:15 },
  'stakeholder-mgmt':{ rel1:80, rel3:84, rel5:86, traj:'rising',   aiImpact:'neutral',   salaryPct:22 },
  'people-mgmt':     { rel1:76, rel3:80, rel5:82, traj:'rising',   aiImpact:'neutral',   salaryPct:20 },
  'strategy':        { rel1:80, rel3:86, rel5:90, traj:'hot',      aiImpact:'augments',  salaryPct:35 },
  'mentoring':       { rel1:72, rel3:76, rel5:80, traj:'rising',   aiImpact:'neutral',   salaryPct:15 },
  'design-thinking': { rel1:82, rel3:88, rel5:90, traj:'hot',      aiImpact:'augments',  salaryPct:20 },
  'visual-design':   { rel1:68, rel3:60, rel5:55, traj:'declining', aiImpact:'replaces',  salaryPct:8  },
  'storytelling':    { rel1:78, rel3:82, rel5:86, traj:'rising',   aiImpact:'augments',  salaryPct:18 },
  'project-mgmt':    { rel1:72, rel3:65, rel5:58, traj:'stable',   aiImpact:'augments',  salaryPct:10 },
  'process':         { rel1:68, rel3:62, rel5:55, traj:'declining', aiImpact:'replaces',  salaryPct:6  },
  'negotiation':     { rel1:74, rel3:78, rel5:80, traj:'rising',   aiImpact:'neutral',   salaryPct:18 },
  'drive':           { rel1:90, rel3:92, rel5:94, traj:'hot',      aiImpact:'augments',  salaryPct:22 },
  'collaboration':   { rel1:88, rel3:88, rel5:90, traj:'stable',   aiImpact:'augments',  salaryPct:14 },
  'resilience':      { rel1:88, rel3:92, rel5:94, traj:'hot',      aiImpact:'augments',  salaryPct:18 },
};

/* ── Maturity levels (compact label+descriptor per level) ─────────── */
const MATURITY_LABELS: Record<string, [string,string,string,string,string]> = {
  'programming':     ['Aware','Practicing','Proficient','Advanced','Expert'],
  'systems-design':  ['Aware','Practicing','Proficient','Advanced','Expert'],
  'cloud':           ['Aware','Practicing','Proficient','Advanced','Expert'],
  'data-engineering':['Aware','Practicing','Proficient','Advanced','Expert'],
  'security':        ['Aware','Practicing','Proficient','Advanced','Expert'],
  'data-analysis':   ['Aware','Practicing','Proficient','Advanced','Expert'],
  'statistics':      ['Aware','Practicing','Proficient','Advanced','Expert'],
  'business-acumen': ['Aware','Practicing','Proficient','Advanced','Expert'],
  'research':        ['Aware','Practicing','Proficient','Advanced','Expert'],
  'writing':         ['Aware','Practicing','Proficient','Advanced','Expert'],
  'presentation':    ['Aware','Practicing','Proficient','Advanced','Expert'],
  'stakeholder-mgmt':['Aware','Practicing','Proficient','Advanced','Expert'],
  'people-mgmt':     ['Aware','Practicing','Proficient','Advanced','Expert'],
  'strategy':        ['Aware','Practicing','Proficient','Advanced','Expert'],
  'mentoring':       ['Aware','Practicing','Proficient','Advanced','Expert'],
  'design-thinking': ['Aware','Practicing','Proficient','Advanced','Expert'],
  'visual-design':   ['Aware','Practicing','Proficient','Advanced','Expert'],
  'storytelling':    ['Aware','Practicing','Proficient','Advanced','Expert'],
  'project-mgmt':    ['Aware','Practicing','Proficient','Advanced','Expert'],
  'process':         ['Aware','Practicing','Proficient','Advanced','Expert'],
  'negotiation':     ['Aware','Practicing','Proficient','Advanced','Expert'],
  'drive':           ['Aware','Practicing','Proficient','Advanced','Expert'],
  'collaboration':   ['Aware','Practicing','Proficient','Advanced','Expert'],
  'resilience':      ['Aware','Practicing','Proficient','Advanced','Expert'],
};

/* ── Computation helpers ─────────────────────────────────────────────── */
function getAdjacentWithin(id: string, hops = 2): string[] {
  const visited = new Set<string>([id]);
  let frontier  = [id];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    frontier.forEach(n => {
      (GENOME[n]?.adjacent ?? []).forEach(a => {
        if (!visited.has(a)) { visited.add(a); next.push(a); }
      });
    });
    frontier = next;
  }
  visited.delete(id);
  return [...visited];
}

function prereqsMet(id: string, levels: Record<string, number>): boolean {
  return (GENOME[id]?.prereqs ?? []).every(p => (levels[p.id] ?? 0) >= p.min);
}

function computeUnlockChain(levels: Record<string, number>): string[] {
  return Object.keys(GENOME).filter(id => prereqsMet(id, levels));
}

function buildGapSequence(current: Record<string, number>, target: Record<string, number>) {
  return Object.keys(GENOME)
    .map(id => {
      const cur = current[id] ?? 0;
      const tgt = target[id] ?? 0;
      return { id, label: GENOME[id].label, currentLevel: cur, targetLevel: tgt, gap: tgt - cur, prereqsMet: prereqsMet(id, current) };
    })
    .filter(g => g.gap > 0)
    .sort((a, b) => {
      if (a.prereqsMet !== b.prereqsMet) return a.prereqsMet ? -1 : 1;
      return b.gap - a.gap;
    });
}

/* ── Peer benchmarks ─────────────────────────────────────────────────── */
const PEER_NORMS: Record<string, { avg:number; p25:number; p50:number; p75:number; p90:number }> = {
  student:   { avg:22, p25:12, p50:22, p75:33, p90:44 },
  early:     { avg:38, p25:26, p50:38, p75:52, p90:64 },
  mid:       { avg:54, p25:40, p50:54, p75:68, p90:78 },
  senior:    { avg:67, p25:52, p50:67, p75:78, p90:86 },
  lead:      { avg:76, p25:62, p50:76, p75:86, p90:92 },
  executive: { avg:84, p25:72, p50:84, p75:92, p90:96 },
};
const GEO: Record<string, { label:string; mult:number }> = {
  bangalore:{ label:'Bangalore',  mult:1.30 }, mumbai:{ label:'Mumbai',     mult:1.25 },
  delhi:    { label:'Delhi NCR',  mult:1.20 }, hyderabad:{ label:'Hyderabad',mult:1.18 },
  pune:     { label:'Pune',       mult:1.12 }, chennai:{ label:'Chennai',   mult:1.10 },
  kolkata:  { label:'Kolkata',    mult:0.92 }, tier2:{ label:'Tier 2 City', mult:0.78 },
};
const IND_NORMS: Record<string, { avg:number; top:number; label:string }> = {
  tech:{ avg:58, top:74, label:'Technology' }, finance:{ avg:54, top:70, label:'Finance' },
  consulting:{ avg:62, top:78, label:'Consulting' }, startup:{ avg:55, top:72, label:'Startup' },
};

function detectStage(p: Profile): string {
  const exps     = (p?.experience as {years?:number;title?:string;current?:boolean}[]) ?? [];
  const yrs      = exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const title    = ((exps.find(e => e?.current) ?? exps[0])?.title ?? '').toLowerCase();
  if (yrs < 1)                                                                   return 'student';
  if (yrs < 3)                                                                   return 'early';
  if (/director|vp|head|principal|staff/.test(title))                            return 'executive';
  if (/lead|manager|architect|sr\.|senior/.test(title))                          return 'lead';
  if (yrs < 6)                                                                   return 'mid';
  if (yrs < 10)                                                                  return 'senior';
  return 'lead';
}

function pctFor(v: number, n: { p25:number; p50:number; p75:number; p90:number }): number {
  if (v >= n.p90) return 92; if (v >= n.p75) return 78;
  if (v >= n.p50) return 58; if (v >= n.p25) return 32; return 14;
}

function runBenchmarks(profile: Profile, eiScore: number, competencyLevels: Record<string,number>, industry: string, city: string) {
  const exps    = (profile?.experience as {years?:number}[]) ?? [];
  const expYrs  = exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const stage   = detectStage(profile);
  const norms   = PEER_NORMS[stage] ?? PEER_NORMS.mid;
  const geo     = GEO[city.toLowerCase()] ?? GEO.tier2;
  const indNorm = IND_NORMS[industry.toLowerCase()] ?? IND_NORMS.tech;

  const pct     = pctFor(eiScore, norms);
  const base    = eiScore >= 80 ? 28 : eiScore >= 65 ? 20 : eiScore >= 50 ? 13 : eiScore >= 35 ? 8 : 4;
  const expMult = Math.min(2.5, 1 + expYrs * 0.12);
  const salP50  = Math.round(base * expMult * geo.mult * 10) / 10;

  const domainGroups: Record<string, string[]> = {
    Technical:['programming','systems-design','cloud','data-engineering','security'],
    Analytical:['data-analysis','statistics','business-acumen','research'],
    Communication:['writing','presentation','stakeholder-mgmt'],
    Leadership:['people-mgmt','strategy','mentoring'],
    Creative:['design-thinking','visual-design','storytelling'],
    Execution:['project-mgmt','process','negotiation'],
    Behavioral:['drive','collaboration','resilience'],
  };
  const byDomain = Object.entries(domainGroups).map(([domain, ids]) => {
    const avg  = ids.reduce((s, id) => s + (competencyLevels[id] ?? 0), 0) / ids.length;
    const pctD = avg >= 4 ? 85 : avg >= 3 ? 70 : avg >= 2 ? 50 : avg >= 1 ? 30 : 10;
    return { domain, percentile: pctD, userLevel: Math.round(avg * 10) / 10, benchmarkLevel: 2.5 };
  });
  const overallPct = Math.round(byDomain.reduce((s, d) => s + d.percentile, 0) / byDomain.length);
  const expExpected = Math.min(82, 20 + expYrs * 7);

  return {
    peer: { stage, userEI: eiScore, peerAvgEI: norms.avg, percentile: pct, delta: eiScore - norms.avg,
      interpretation: pct >= 75 ? `Top ${100-pct}% among ${stage}-stage professionals` : pct >= 50 ? 'Above average' : 'Below average',
      peerCount: stage === 'student' ? 15000 : 42000 },
    geo: { city: geo.label, salaryMult: geo.mult, adjustedSalary: { p25: Math.round(salP50*0.70*10)/10, p50: salP50, p75: Math.round(salP50*1.35*10)/10, unit:'LPA' } },
    salary: { estimatedRange: { p25: Math.round(salP50*0.70*10)/10, p50: salP50, p75: Math.round(salP50*1.35*10)/10, unit:'LPA' },
      competitivenessScore: Math.min(100, Math.round((eiScore / Math.max(1, indNorm.avg)) * 80)),
      interpretation: eiScore >= indNorm.top ? 'Commands premium salary' : 'Competitive — targeted skills would unlock next band' },
    percentile: { overall: Math.min(99, overallPct), byDomain, topQuartile: overallPct >= 75,
      rank: overallPct >= 90 ? 'Elite' : overallPct >= 75 ? 'Top 25%' : overallPct >= 50 ? 'Above Average' : 'Average' },
    industry: { industry: indNorm.label, userEI: eiScore, industryAvgEI: indNorm.avg, industryTopEI: indNorm.top,
      delta: eiScore - indNorm.avg, standing: eiScore >= indNorm.top ? 'top' : eiScore >= indNorm.avg+8 ? 'above-avg' : eiScore >= indNorm.avg-8 ? 'avg' : 'below-avg' },
    experience: { expYears: expYrs, expectedEI: expExpected, actualEI: eiScore, delta: eiScore - expExpected,
      accelerated: eiScore >= expExpected + 10,
      interpretation: eiScore >= expExpected + 10 ? 'Ahead of the curve' : eiScore >= expExpected - 5 ? 'On track' : 'Lagging — close the gap' },
    summary: `${pct}th percentile among ${stage}-stage professionals · ${eiScore >= indNorm.top ? 'Top quartile' : 'Above avg'} in ${indNorm.label} · Est. ₹${salP50} LPA in ${geo.label}`,
  };
}

/* ── Success signature ───────────────────────────────────────────────── */
const CLUSTERS = [
  { id:'technical-elite',      label:'Technical Elite',       signature:['programming','systems-design','cloud','security'],                        demand:'elite',     earning:'premium'  },
  { id:'well-rounded-senior',  label:'Well-Rounded Senior',   signature:['programming','data-analysis','presentation','collaboration','project-mgmt'], demand:'very-strong',earning:'very-high'},
  { id:'communication-leader', label:'Communication Leader',  signature:['presentation','writing','stakeholder-mgmt','storytelling','strategy'],     demand:'strong',    earning:'very-high'},
  { id:'data-specialist',      label:'Data Specialist',       signature:['data-analysis','statistics','data-engineering','research'],                demand:'elite',     earning:'premium'  },
  { id:'emerging-talent',      label:'Emerging Talent',       signature:['drive','resilience','collaboration','programming'],                        demand:'strong',    earning:'high'     },
  { id:'leadership-track',     label:'Leadership Track',      signature:['people-mgmt','strategy','mentoring','stakeholder-mgmt','negotiation'],     demand:'very-strong',earning:'premium'  },
  { id:'creative-innovator',   label:'Creative Innovator',    signature:['design-thinking','visual-design','storytelling','research','presentation'],  demand:'strong',    earning:'high'     },
  { id:'operations-champion',  label:'Operations Champion',   signature:['process','project-mgmt','negotiation','collaboration','business-acumen'],  demand:'strong',    earning:'high'     },
];
const LEADERSHIP_LEVELS = [
  { level:1, label:'Individual Contributor', description:'Delivers personal results; developing depth', nextStep:'Build mentoring and project leadership' },
  { level:2, label:'Team Contributor',       description:'Influences immediate team; informal leadership', nextStep:'Formal people management or programme ownership' },
  { level:3, label:'Functional Leader',      description:'Manages a team or programme; sets direction', nextStep:'Senior leadership — leading leaders' },
  { level:4, label:'Organisational Leader',  description:'Shapes org-wide strategy; board-level impact', nextStep:'Industry leadership, board director, or founder' },
];

function runSuccessSignature(profile: Profile, levels: Record<string,number>, eiScore: number, targetFamily?: string) {
  const scores = CLUSTERS.map(c => {
    const fit = Math.round(c.signature.reduce((s, id) => s + ((levels[id] ?? 0) / 5), 0) / c.signature.length * 100);
    return { ...c, fit };
  }).sort((a, b) => b.fit - a.fit);

  const top = targetFamily
    ? scores.find(s => s.id.includes(targetFamily.slice(0, 4))) ?? scores[0]
    : scores[0];

  const l1 = (levels['drive']??0) + (levels['collaboration']??0);
  const l2 = (levels['mentoring']??0) + (levels['stakeholder-mgmt']??0);
  const l3 = (levels['people-mgmt']??0) + (levels['negotiation']??0);
  const l4 = (levels['strategy']??0) * 2;
  const lScore = Math.round(((l1+l2+l3+l4)/24)*100);
  const lLevel = l4 >= 6 ? 4 : l3 >= 5 && l2 >= 5 ? 3 : l2 >= 4 || l3 >= 2 ? 2 : 1;

  const beh   = (levels['drive']??0) + (levels['resilience']??0) + (levels['collaboration']??0);
  const tScore= Math.min(100, Math.round(beh/15*25 + (eiScore/100)*30 + l2/10*20 + l3/10*15 + ((levels['presentation']??0)+(levels['stakeholder-mgmt']??0))/10*10));

  let futureScore = 0;
  Object.entries(FUTURE).forEach(([id, sig]) => {
    if (sig.traj === 'hot' || sig.traj === 'rising') futureScore += ((levels[id]??0)/5)*10;
  });

  const pattern = Object.entries(GENOME).map(([id, g]) => {
    const lvl = levels[id] ?? 0;
    return { id, label: g.label, level: lvl, role: lvl >= 3.5 ? 'strength' : lvl >= 1.5 ? 'developing' : 'gap' };
  });

  return {
    cluster:                top,
    clusterFit:             top.fit,
    alternativeClusters:    scores.slice(1, 3).map(s => ({ cluster: s, fit: s.fit })),
    leadershipMaturity:     LEADERSHIP_LEVELS[lLevel - 1],
    leadershipScore:        lScore,
    transformationReadiness:{ score: tScore, label: tScore >= 75 ? 'ready' : tScore >= 55 ? 'near-ready' : tScore >= 35 ? 'developing' : 'early', probability: Math.min(95, tScore + 10), timelineMonths: tScore >= 75 ? 3 : tScore >= 55 ? 9 : tScore >= 35 ? 18 : 36 },
    competencyPattern:      pattern,
    futureAlignmentScore:   Math.min(100, Math.round(futureScore)),
    successProbability:     Math.min(95, Math.round((eiScore*0.3 + top.fit*0.25 + Math.min(100,futureScore)*0.25 + lScore*0.2) / 100 * 100)),
  };
}

/* ── Future readiness ────────────────────────────────────────────────── */
function computeFutureReadiness(levels: Record<string,number>, horizon: 1|3|5 = 3) {
  let wSum = 0, wTot = 0;
  const hot: string[] = [], risk: string[] = [];
  Object.entries(FUTURE).forEach(([id, sig]) => {
    const rel   = horizon === 1 ? sig.rel1 : horizon === 3 ? sig.rel3 : sig.rel5;
    const w     = rel / 100;
    const lvl   = levels[id] ?? 0;
    wSum       += (lvl / 5) * 100 * w;
    wTot       += w;
    if (sig.traj === 'hot' && lvl >= 3)      hot.push(id);
    if (sig.traj === 'declining' && lvl < 2) risk.push(id);
  });
  return { score: Math.round(wSum / Math.max(1, wTot)), hotCompetencies: hot, riskCompetencies: risk };
}

/* ── Route registration ──────────────────────────────────────────────── */
export function registerCareerGenomeRoutes(app: Express): void {

  app.get('/api/career/genome/graph', (_req, res) => {
    const genome = Object.entries(GENOME).map(([id, g]) => ({ id, ...g }));
    res.json({ success: true, genome });
  });

  app.get('/api/career/genome/adjacent/:id', (req, res) => {
    const hops    = Math.min(3, Number(req.query.hops) || 2);
    const adjacent = getAdjacentWithin(req.params.id, hops);
    res.json({ success: true, id: req.params.id, hops, adjacent });
  });

  app.get('/api/career/genome/maturity', (_req, res) => {
    const maturity = Object.entries(MATURITY_LABELS).map(([id, lbls]) => ({
      competencyId: id, label: GENOME[id]?.label ?? id,
      levels: lbls.map((l, i) => ({ level: i+1, label: l })),
    }));
    res.json({ success: true, maturity });
  });

  app.get('/api/career/genome/maturity/:id', (req, res) => {
    const id = req.params.id;
    const lbls = MATURITY_LABELS[id];
    if (!lbls) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, competencyId: id, label: GENOME[id]?.label, levels: lbls.map((l, i) => ({ level: i+1, label: l })) });
  });

  app.get('/api/career/genome/future-signals', (_req, res) => {
    const signals = Object.entries(FUTURE).map(([id, s]) => ({
      competencyId: id, label: GENOME[id]?.label ?? id,
      relevanceIn1Yr: s.rel1, relevanceIn3Yr: s.rel3, relevanceIn5Yr: s.rel5,
      growthTrajectory: s.traj, aiImpact: s.aiImpact, salaryPremium1Yr: s.salaryPct,
    })).sort((a, b) => b.relevanceIn3Yr - a.relevanceIn3Yr);
    res.json({ success: true, signals });
  });

  app.get('/api/career/genome/progression-paths', (_req, res) => {
    const paths = [
      { id:'engineering-track',    label:'Software Engineering',   family:'Engineering',  etaMonths:18 },
      { id:'data-science-track',   label:'Data Science & AI',      family:'Data',         etaMonths:20 },
      { id:'leadership-track',     label:'People & Org Leadership', family:'Leadership',   etaMonths:36 },
      { id:'product-track',        label:'Product Management',      family:'Product',      etaMonths:24 },
      { id:'design-track',         label:'UX / Product Design',     family:'Design',       etaMonths:18 },
      { id:'consulting-track',     label:'Consulting & Advisory',   family:'Consulting',   etaMonths:24 },
    ];
    res.json({ success: true, paths });
  });

  app.post('/api/career/genome/detect-path', (req, res) => {
    try {
      const { competencyLevels = {} } = req.body;
      const domScores: Record<string, number> = {};
      Object.entries(GENOME).forEach(([id, g]) => {
        const lvl = competencyLevels[id] ?? 0;
        domScores[g.domain] = (domScores[g.domain] ?? 0) + lvl;
      });
      const topDomain = Object.entries(domScores).sort(([,a],[,b]) => b-a)[0]?.[0] ?? 'technical';
      const pathMap: Record<string,string> = { technical:'engineering-track', analytical:'data-science-track', leadership:'leadership-track', creative:'design-track', execution:'operations-track', communication:'consulting-track', behavioral:'leadership-track' };
      res.json({ success: true, pathId: pathMap[topDomain] ?? 'engineering-track', topDomain, domainScores: domScores });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/genome/unlocks', (req, res) => {
    try {
      const { competencyLevels = {} } = req.body;
      res.json({ success: true, unlocked: computeUnlockChain(competencyLevels) });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/genome/gap-sequence', (req, res) => {
    try {
      const { currentLevels = {}, targetLevels = {} } = req.body;
      res.json({ success: true, sequence: buildGapSequence(currentLevels, targetLevels) });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/genome/benchmarks', (req, res) => {
    try {
      const { profile = {}, eiScore = 0, competencyLevels = {}, industry = 'tech', city = 'bangalore' } = req.body;
      res.json({ success: true, ...runBenchmarks(profile as Profile, eiScore, competencyLevels, industry, city) });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/genome/success-signature', (req, res) => {
    try {
      const { profile = {}, competencyLevels = {}, eiScore = 0, targetRoleFamily } = req.body;
      res.json({ success: true, ...runSuccessSignature(profile as Profile, competencyLevels, eiScore, targetRoleFamily) });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/genome/future-map', (req, res) => {
    try {
      const { competencyLevels = {}, eiScore = 0 } = req.body;
      const readiness = computeFutureReadiness(competencyLevels, 3);
      const hotIds    = Object.entries(FUTURE).filter(([,s]) => s.traj === 'hot').map(([id]) => id);
      const gaps      = hotIds.filter(id => (competencyLevels[id] ?? 0) < 2).slice(0, 5).map(id => ({
        competencyId: id, label: GENOME[id]?.label ?? id, priority: 'high', salaryPremium: FUTURE[id]?.salaryPct,
      }));
      res.json({
        success: true,
        futureReadinessScore: readiness.score,
        hotCompetencies:      readiness.hotCompetencies.map(id => ({ id, label: GENOME[id]?.label ?? id, rel3yr: FUTURE[id]?.rel3 })),
        riskCompetencies:     readiness.riskCompetencies.map(id => ({ id, label: GENOME[id]?.label ?? id })),
        priorityGaps:         gaps,
        eiScore,
      });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/genome/future-readiness', (req, res) => {
    try {
      const { competencyLevels = {}, horizon = 3 } = req.body;
      const result = computeFutureReadiness(competencyLevels, horizon as 1|3|5);
      res.json({ success: true, horizon, ...result });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });
}

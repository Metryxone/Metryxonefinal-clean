/**
 * Career Success Signature API Routes
 * Self-contained — all logic is inline.
 */

import type { Express } from 'express';

type Profile = Record<string, unknown>;

const CLUSTERS = [
  { id:'technical-elite',      label:'Technical Elite',       description:'Deep technical specialists — the architects and principals', signature:['programming','systems-design','cloud','security'],                        peakRoleFamilies:['engineering'],                        earning:'premium',  demand:'elite'      },
  { id:'well-rounded-senior',  label:'Well-Rounded Senior',   description:'Broad coverage across technical, analytical and communication', signature:['programming','data-analysis','presentation','collaboration','project-mgmt'], peakRoleFamilies:['engineering','product','consulting'],  earning:'very-high', demand:'very-strong' },
  { id:'communication-leader', label:'Communication Leader',  description:'Exceptional at influencing and building consensus',            signature:['presentation','writing','stakeholder-mgmt','storytelling','strategy'],     peakRoleFamilies:['consulting','marketing','product'],   earning:'very-high', demand:'strong'     },
  { id:'data-specialist',      label:'Data Specialist',       description:'Rigorous analytical thinkers with deep ML/stats expertise',    signature:['data-analysis','statistics','data-engineering','research'],                peakRoleFamilies:['data'],                               earning:'premium',  demand:'elite'      },
  { id:'emerging-talent',      label:'Emerging Talent',       description:'High drive and resilience with rapid skill development',        signature:['drive','resilience','collaboration','programming'],                        peakRoleFamilies:['engineering','product','data'],       earning:'high',    demand:'strong'     },
  { id:'leadership-track',     label:'Leadership Track',      description:'Strong people management and strategic competencies',          signature:['people-mgmt','strategy','mentoring','stakeholder-mgmt','negotiation'],     peakRoleFamilies:['leadership','consulting','operations'],earning:'premium',  demand:'very-strong'},
  { id:'creative-innovator',   label:'Creative Innovator',    description:'Design thinking and storytelling for human-centred problems',  signature:['design-thinking','visual-design','storytelling','research','presentation'], peakRoleFamilies:['design','marketing','product'],       earning:'high',    demand:'strong'     },
  { id:'operations-champion',  label:'Operations Champion',   description:'Process excellence and project delivery mastery',             signature:['process','project-mgmt','negotiation','collaboration','business-acumen'],  peakRoleFamilies:['operations','consulting'],            earning:'high',    demand:'strong'     },
];

const LEADERSHIP_LEVELS = [
  { level:1, label:'Individual Contributor', description:'Delivers personal results; developing technical and domain depth',   signature:'Owns tasks; learning collaboration and stakeholder basics', nextStep:'Develop mentoring habit and project leadership' },
  { level:2, label:'Team Contributor',       description:'Influences immediate team; informal leadership emerging',            signature:'Mentors peers; leads small initiatives; builds stakeholder trust', nextStep:'Formal people management or product/programme ownership' },
  { level:3, label:'Functional Leader',      description:'Manages a team or programme; develops strategy and culture',        signature:'Hires and grows talent; sets direction for a function', nextStep:'Senior leadership — leading leaders; board-level presence' },
  { level:4, label:'Organisational Leader',  description:'Shapes org-wide strategy and culture; board-level impact',         signature:'CEO/VP equivalent; market-facing leadership; talent ecosystem builder', nextStep:'Industry leadership, advisor, board director, or entrepreneur' },
];

function getExpYears(p: Profile): number {
  const exps = (p?.experience as {years?:number}[]) ?? [];
  return exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
}

function clusterFit(signature: string[], levels: Record<string,number>): number {
  return Math.round(signature.reduce((s, id) => s + ((levels[id] ?? 0) / 5), 0) / signature.length * 100);
}

function detectLeadershipLevel(levels: Record<string,number>): { level:number; score:number } {
  const l2 = (levels['mentoring']??0) + (levels['stakeholder-mgmt']??0);
  const l3 = (levels['people-mgmt']??0) + (levels['negotiation']??0);
  const l4 = (levels['strategy']??0) * 2;
  const l1 = (levels['drive']??0) + (levels['collaboration']??0);
  const score = Math.round(((l1+l2+l3+l4)/24)*100);
  const level  = l4 >= 6 ? 4 : l3 >= 5 && l2 >= 5 ? 3 : l2 >= 4 || l3 >= 2 ? 2 : 1;
  return { level, score };
}

function buildSignatureOutput(p: Profile, levels: Record<string,number>, eiScore: number, targetFamily?: string) {
  const expYrs = getExpYears(p);
  const withFit = CLUSTERS.map(c => ({ ...c, fit: clusterFit(c.signature, levels) })).sort((a, b) => b.fit - a.fit);
  const top = targetFamily
    ? withFit.find(c => c.peakRoleFamilies.some(f => f.toLowerCase().includes(targetFamily.toLowerCase()))) ?? withFit[0]
    : withFit[0];

  const { level: lLevel, score: lScore } = detectLeadershipLevel(levels);

  const beh   = (levels['drive']??0)+(levels['resilience']??0)+(levels['collaboration']??0);
  const tech  = (levels['programming']??0)+(levels['data-analysis']??0)+(levels['systems-design']??0);
  const lead  = (levels['people-mgmt']??0)+(levels['strategy']??0)+(levels['mentoring']??0);
  const comm  = (levels['presentation']??0)+(levels['stakeholder-mgmt']??0);
  const tScore = Math.min(100, Math.round(beh/15*25 + (eiScore/100)*30 + tech/15*20 + lead/15*15 + comm/10*10));

  const strengths: string[] = [];
  const barriers: string[] = [];
  if (beh >= 9)      strengths.push('Strong behavioural foundation');
  if (eiScore >= 60) strengths.push('Above-average employability index');
  if (lead >= 6)     strengths.push('Leadership competencies developing');
  if (eiScore < 40)  barriers.push('EI score below threshold');
  if (beh < 6)       barriers.push('Behavioural foundation gaps');
  if (expYrs < 2)    barriers.push('Limited experience signal');

  // Future alignment — hot/rising competencies
  const HOT_FUTURE = ['data-engineering','security','statistics','strategy','design-thinking','drive','resilience'];
  let futureScore = 0;
  HOT_FUTURE.forEach(id => { futureScore += ((levels[id]??0)/5)*10; });

  const pattern = Object.keys(levels).map(id => ({
    id, level: levels[id],
    role: levels[id] >= 3.5 ? 'strength' : levels[id] >= 1.5 ? 'developing' : 'gap',
  }));

  return {
    cluster:                top,
    clusterFit:             top.fit,
    alternativeClusters:    withFit.slice(1, 3).map(c => ({ cluster: c, fit: c.fit })),
    leadershipMaturity:     LEADERSHIP_LEVELS[lLevel - 1],
    leadershipScore:        lScore,
    transformationReadiness:{ score: tScore, label: tScore >= 75 ? 'ready' : tScore >= 55 ? 'near-ready' : tScore >= 35 ? 'developing' : 'early', probability: Math.min(95, tScore+10), timelineMonths: tScore >= 75 ? 3 : tScore >= 55 ? 9 : tScore >= 35 ? 18 : 36, strengths: strengths.slice(0,3), barriers: barriers.slice(0,3) },
    competencyPattern:      pattern,
    futureAlignmentScore:   Math.min(100, Math.round(futureScore)),
    successProbability:     Math.min(95, Math.round((eiScore*0.30 + top.fit*0.25 + Math.min(100,futureScore)*0.25 + lScore*0.20) / 100 * 100)),
  };
}

export function registerCareerSuccessRoutes(app: Express): void {

  app.get('/api/career/success/clusters', (_req, res) => {
    res.json({ success: true, clusters: CLUSTERS });
  });

  app.get('/api/career/success/leadership-levels', (_req, res) => {
    res.json({ success: true, levels: LEADERSHIP_LEVELS });
  });

  app.post('/api/career/success/analyze', (req, res) => {
    try {
      const { profile = {}, competencyLevels = {}, eiScore = 0, targetRoleFamily } = req.body;
      res.json({ success: true, ...buildSignatureOutput(profile as Profile, competencyLevels, eiScore, targetRoleFamily) });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/success/transformation', (req, res) => {
    try {
      const { profile = {}, competencyLevels = {}, eiScore = 0, targetRoleFamily } = req.body;
      const result = buildSignatureOutput(profile as Profile, competencyLevels, eiScore, targetRoleFamily);
      res.json({ success: true, transformationReadiness: result.transformationReadiness, leadershipMaturity: result.leadershipMaturity, leadershipScore: result.leadershipScore, clusterFit: result.clusterFit, cluster: result.cluster });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });

  app.post('/api/career/success/competency-pattern', (req, res) => {
    try {
      const { profile = {}, competencyLevels = {}, eiScore = 0 } = req.body;
      const result = buildSignatureOutput(profile as Profile, competencyLevels, eiScore);
      res.json({ success: true, competencyPattern: result.competencyPattern, futureAlignmentScore: result.futureAlignmentScore, successProbability: result.successProbability });
    } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
  });
}

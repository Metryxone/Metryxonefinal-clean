/**
 * Learning Velocity Engine
 * Measures growth acceleration, adaptability, execution consistency,
 * and improvement momentum from longitudinal snapshot data.
 */

import { COMPETENCY_DOMAINS } from '@/data/marketCatalog';
import type { CompetencySnapshot } from './longitudinalIntelligenceEngine';

/* ── Output types ─────────────────────────────────────────────────── */
export type VelocityBand = 'elite' | 'high' | 'moderate' | 'low' | 'stalled';

export interface VelocityMetric {
  id:              string;
  name:            string;
  value:           number;   // 0-100
  weight:          number;   // contribution to overall
  trend:           'accelerating' | 'steady' | 'slowing';
  badge?:          string;
  interpretation:  string;
}

export interface VelocityBottleneck {
  competencyId:  string;
  label:         string;
  domain:        string;
  reason:        'no-progress' | 'prerequisite-missing' | 'low-learnability' | 'stalled';
  currentLevel:  number;
  blockedSince:  number;    // months
  recommendation:string;
}

export interface VelocityAccelerator {
  competencyId:  string;
  label:         string;
  domain:        string;
  reason:        'fast-growth' | 'high-adjacency' | 'high-demand' | 'high-learnability';
  currentLevel:  number;
  velocity:      number;
  suggestion:    string;
}

export interface LearningVelocityOutput {
  overallVelocity:        number;          // 0-100
  velocityBand:           VelocityBand;
  growthAcceleration:     number;          // -100 to +100; positive = speeding up
  adaptabilityScore:      number;          // 0-100: breadth across domains
  executionConsistency:   number;          // 0-100: how uniform the progress is
  improvementMomentum:    number;          // 0-100: recent vs historical momentum
  metrics:                VelocityMetric[];
  projectedLevelsIn6Mo:   number;          // total level-gains expected in 6 months
  projectedEIGainIn6Mo:   number;          // EI points projected to gain
  bottlenecks:            VelocityBottleneck[];
  accelerators:           VelocityAccelerator[];
  velocityBandLabel:      string;
  coachingInsight:        string;
  nextFocusArea:          string;
}

/* ── Learnability scores (from genome) ─────────────────────────── */
const LEARNABILITY: Record<string, number> = {
  'programming':78,'systems-design':58,'cloud':65,'data-engineering':62,'security':52,
  'data-analysis':80,'statistics':55,'business-acumen':70,'research':74,
  'writing':82,'presentation':76,'stakeholder-mgmt':62,
  'people-mgmt':55,'strategy':48,'mentoring':68,
  'design-thinking':84,'visual-design':70,'storytelling':72,
  'project-mgmt':75,'process':80,'negotiation':60,
  'drive':60,'collaboration':72,'resilience':55,
};

/* ── Main engine ──────────────────────────────────────────────────── */
export interface LearningVelocityInput {
  snapshots:         CompetencySnapshot[];
  currentLevels:     Record<string, number>;
  currentEI:         number;
  targetEI?:         number;
}

export function runLearningVelocityEngine(input: LearningVelocityInput): LearningVelocityOutput {
  const { snapshots, currentLevels, currentEI } = input;
  const ordered   = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const hasHistory = ordered.length >= 2;

  /* ── Growth acceleration ──────────────────────────────────────── */
  let growthAcceleration = 0;
  let firstHalfVel = 0, secHalfVel = 0;

  if (hasHistory) {
    const mid   = Math.floor(ordered.length / 2);
    const first = ordered.slice(0, mid + 1);
    const sec   = ordered.slice(mid);

    const velHalf = (snaps: CompetencySnapshot[]) => {
      if (snaps.length < 2) return 0;
      const days = (snaps[snaps.length-1].timestamp - snaps[0].timestamp) / 86400000;
      const months = Math.max(0.1, days / 30.44);
      let totalDelta = 0;
      COMPETENCY_DOMAINS.forEach(c => {
        const from = snaps[0].competencyLevels[c.id] ?? 0;
        const to   = snaps[snaps.length-1].competencyLevels[c.id] ?? 0;
        totalDelta += to - from;
      });
      return totalDelta / months;
    };

    firstHalfVel = velHalf(first);
    secHalfVel   = velHalf(sec);
    growthAcceleration = Math.round(Math.max(-100, Math.min(100, (secHalfVel - firstHalfVel) * 20)));
  }

  /* ── Adaptability score (breadth across 7 domains) ────────────── */
  const domainGroups: Record<string, string[]> = {
    technical:['programming','systems-design','cloud','data-engineering','security'],
    analytical:['data-analysis','statistics','business-acumen','research'],
    communication:['writing','presentation','stakeholder-mgmt'],
    leadership:['people-mgmt','strategy','mentoring'],
    creative:['design-thinking','visual-design','storytelling'],
    execution:['project-mgmt','process','negotiation'],
    behavioral:['drive','collaboration','resilience'],
  };
  const domainsActive = Object.entries(domainGroups).filter(([, ids]) =>
    ids.some(id => (currentLevels[id] ?? 0) >= 2),
  ).length;
  const adaptabilityScore = Math.round((domainsActive / 7) * 100);

  /* ── Execution consistency ────────────────────────────────────── */
  let executionConsistency = 50;
  if (hasHistory) {
    const eiGains = ordered.slice(1).map((s, i) => s.eiScore - ordered[i].eiScore);
    const pos    = eiGains.filter(g => g >= 0).length;
    const total  = eiGains.length;
    const meanGain = eiGains.reduce((s, v) => s + v, 0) / Math.max(1, total);
    const variance = eiGains.reduce((s, g) => s + (g - meanGain) ** 2, 0) / Math.max(1, total);
    executionConsistency = Math.round(Math.min(100, (pos / total) * 60 + Math.max(0, 40 - Math.sqrt(variance) * 3)));
  }

  /* ── Improvement momentum (recent vs historical) ──────────────── */
  let improvementMomentum = 50;
  if (ordered.length >= 3) {
    const recentSnaps = ordered.slice(-2);
    const histSnaps   = ordered.slice(0, -1);
    const recentGain  = recentSnaps[1].eiScore - recentSnaps[0].eiScore;
    const historicAvg = histSnaps.slice(1).reduce((s, sn, i) => s + sn.eiScore - histSnaps[i].eiScore, 0) / Math.max(1, histSnaps.length - 1);
    improvementMomentum = Math.round(Math.min(100, Math.max(0, 50 + (recentGain - historicAvg) * 5)));
  } else if (hasHistory) {
    const gain = ordered[ordered.length-1].eiScore - ordered[0].eiScore;
    improvementMomentum = Math.round(Math.min(100, Math.max(0, 50 + gain * 2)));
  }

  /* ── Overall velocity ─────────────────────────────────────────── */
  const overallVelocity = Math.round(
    growthAcceleration * 0.25 + adaptabilityScore * 0.30 +
    executionConsistency * 0.25 + improvementMomentum * 0.20,
  );
  const absVelocity = Math.round((overallVelocity + 100) / 2);  // map -100..100 to 0..100

  const velocityBand: VelocityBand =
    absVelocity >= 80 ? 'elite' : absVelocity >= 65 ? 'high' :
    absVelocity >= 45 ? 'moderate' : absVelocity >= 25 ? 'low' : 'stalled';

  /* ── Metrics ────────────────────────────────────────────────────── */
  const metrics: VelocityMetric[] = [
    {
      id:'growth-accel', name:'Growth Acceleration', value: Math.round((growthAcceleration + 100) / 2),
      weight:0.25, trend: growthAcceleration > 10 ? 'accelerating' : growthAcceleration < -10 ? 'slowing' : 'steady',
      interpretation: growthAcceleration > 10 ? 'Learning pace is speeding up' : growthAcceleration < -10 ? 'Learning pace is slowing' : 'Consistent learning pace',
    },
    {
      id:'adaptability', name:'Adaptability', value: adaptabilityScore,
      weight:0.30, trend: domainsActive >= 5 ? 'accelerating' : domainsActive >= 3 ? 'steady' : 'slowing',
      badge: domainsActive >= 6 ? 'multi-domain' : undefined,
      interpretation: `Active in ${domainsActive}/7 competency domains`,
    },
    {
      id:'exec-consistency', name:'Execution Consistency', value: executionConsistency,
      weight:0.25, trend: executionConsistency >= 70 ? 'accelerating' : executionConsistency >= 45 ? 'steady' : 'slowing',
      interpretation: executionConsistency >= 70 ? 'Highly consistent improvement pattern' : executionConsistency >= 45 ? 'Moderate consistency' : 'Inconsistent progress — focus on one area',
    },
    {
      id:'improvement-momentum', name:'Improvement Momentum', value: improvementMomentum,
      weight:0.20, trend: improvementMomentum >= 60 ? 'accelerating' : improvementMomentum >= 40 ? 'steady' : 'slowing',
      interpretation: improvementMomentum >= 60 ? 'Recent momentum ahead of historical average' : improvementMomentum >= 40 ? 'Momentum in line with history' : 'Recent momentum below historical average',
    },
  ];

  /* ── Projected gains ─────────────────────────────────────────────── */
  const monthlyLevelGain = hasHistory
    ? COMPETENCY_DOMAINS.reduce((s, cd) => {
        const from = ordered[0].competencyLevels[cd.id] ?? 0;
        const to   = ordered[ordered.length-1].competencyLevels[cd.id] ?? 0;
        const months = Math.max(0.1, (ordered[ordered.length-1].timestamp - ordered[0].timestamp) / (30.44 * 86400000));
        return s + Math.max(0, (to - from) / months);
      }, 0)
    : 0.5;
  const projectedLevels6mo   = Math.round(monthlyLevelGain * 6 * 10) / 10;
  const projectedEIGain6mo   = Math.round(Math.min(30, (currentEI < 50 ? 8 : currentEI < 70 ? 5 : 3) * (absVelocity / 50)));

  /* ── Bottlenecks ─────────────────────────────────────────────────── */
  const bottlenecks: VelocityBottleneck[] = COMPETENCY_DOMAINS
    .filter(cd => (currentLevels[cd.id] ?? 0) < 2 && (LEARNABILITY[cd.id] ?? 60) < 65)
    .slice(0, 3)
    .map(cd => ({
      competencyId: cd.id, label: cd.label, domain: cd.domain,
      reason: 'low-learnability',
      currentLevel: currentLevels[cd.id] ?? 0,
      blockedSince: 2,
      recommendation: `Seek structured mentoring for ${cd.label} — complex to self-learn`,
    }));

  /* ── Accelerators ────────────────────────────────────────────────── */
  const accelerators: VelocityAccelerator[] = COMPETENCY_DOMAINS
    .filter(cd => (currentLevels[cd.id] ?? 0) >= 2 && (LEARNABILITY[cd.id] ?? 60) >= 75)
    .sort((a, b) => (LEARNABILITY[b.id] ?? 60) - (LEARNABILITY[a.id] ?? 60))
    .slice(0, 3)
    .map(cd => ({
      competencyId: cd.id, label: cd.label, domain: cd.domain,
      reason: 'high-learnability', currentLevel: currentLevels[cd.id] ?? 0,
      velocity: (LEARNABILITY[cd.id] ?? 60) / 100,
      suggestion: `Continue investing in ${cd.label} — high learnability, strong ROI`,
    }));

  /* ── Coaching insight ────────────────────────────────────────────── */
  const coaching =
    velocityBand === 'elite'    ? `Elite learning velocity. You are in the top 10% of learners — sustain the momentum and deepen in ${accelerators[0]?.label ?? 'your top area'}.` :
    velocityBand === 'high'     ? `Strong learning velocity. Focus on ${bottlenecks[0]?.label ?? 'consistency'} to push into elite range.` :
    velocityBand === 'moderate' ? `Moderate velocity. Add a structured learning routine to ${adaptabilityScore < 60 ? 'expand domain coverage' : 'deepen your top competencies'}.` :
    velocityBand === 'low'      ? `Velocity is below expectations. Consider a dedicated IDP and accountability partner.` :
    `Growth appears stalled. Start with one high-learnability competency and build momentum before expanding.`;

  const nextFocusArea = accelerators[0]?.label ?? bottlenecks[0]?.label ?? 'Core competency development';

  return {
    overallVelocity: absVelocity, velocityBand,
    growthAcceleration, adaptabilityScore,
    executionConsistency, improvementMomentum,
    metrics, projectedLevelsIn6Mo: projectedLevels6mo,
    projectedEIGainIn6Mo: projectedEIGain6mo,
    bottlenecks, accelerators,
    velocityBandLabel: velocityBand.charAt(0).toUpperCase() + velocityBand.slice(1).replace('-', ' '),
    coachingInsight: coaching, nextFocusArea,
  };
}

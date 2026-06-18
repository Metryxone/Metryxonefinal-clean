/**
 * Career Memory View
 * Aggregates persistent memory data: transformation history,
 * completed interventions, behavioral evolution, and growth patterns.
 */

import type { CompetencySnapshot } from '@/lib/engines/longitudinalIntelligenceEngine';

/* ── Memory record types ─────────────────────────────────────────── */
export interface CompletedIntervention {
  id:              string;
  competencyId:    string;
  competencyLabel: string;
  title:           string;
  type:            string;
  completedAt:     number;   // unix ms
  eiLiftActual:    number;   // actual EI change after completion
  hoursSpent:      number;
  rating?:         1 | 2 | 3 | 4 | 5;
  note?:           string;
}

export interface BehavioralEvolutionPoint {
  period:               string;    // e.g. "Q1 2026"
  timestamp:            number;
  eiScore:              number;
  dominantDomain:       string;
  growthHighlight:      string;    // e.g. "Levelled up Systems Design"
  behaviorBadge?:       string;    // e.g. "Consistent Learner", "Accelerating"
}

export interface BenchmarkEvolutionPoint {
  period:     string;
  timestamp:  number;
  percentile: number;
  eiScore:    number;
  peerMedian: number;
  delta:      number;
}

export interface GrowthPattern {
  id:             string;
  pattern:        'burst-learner' | 'steady-grower' | 'domain-specialist' | 'breadth-first' | 'plateau-breaker' | 'consistent-achiever';
  label:          string;
  frequency:      number;   // how many times this pattern appeared
  strength:       'strong' | 'moderate' | 'weak';
  interpretation: string;
  recommendation: string;
}

export interface TransformationMilestone {
  id:          string;
  type:        'role-change' | 'band-upgrade' | 'level-up' | 'intervention-completed' | 'goal-achieved';
  label:       string;
  description: string;
  timestamp:   number;
  eiAtTime:    number;
  icon:        string;
}

/* ── View output ─────────────────────────────────────────────────── */
export interface CareerMemoryView {
  userId:                  string;
  snapshots:               CompetencySnapshot[];
  completedInterventions:  CompletedIntervention[];
  behavioralEvolution:     BehavioralEvolutionPoint[];
  benchmarkEvolution:      BenchmarkEvolutionPoint[];
  growthPatterns:          GrowthPattern[];
  transformationMilestones:TransformationMilestone[];
  memoryStats: {
    totalSnapshots:          number;
    totalInterventions:      number;
    totalEIGain:             number;
    spanDays:                number;
    avgMonthlyGain:          number;
    longestStreak:           number;   // consecutive months with EI gain
    topCompetencyGrown:      string;
  };
}

/* ── Pattern detection ────────────────────────────────────────────── */
const PATTERN_DEFS: Record<GrowthPattern['pattern'], { label: string; interp: string; rec: string }> = {
  'burst-learner':       { label:'Burst Learner',        interp:'You grow in concentrated sprints with rest periods.',       rec:'Schedule deliberate learning sprints every 6-8 weeks.' },
  'steady-grower':       { label:'Steady Grower',         interp:'You maintain consistent, reliable progress week over week.', rec:'Leverage your consistency to compound gains in adjacent areas.' },
  'domain-specialist':   { label:'Domain Specialist',     interp:'Deep expertise in 1-2 domains; narrow breadth.',            rec:'Add cross-domain modules to open multi-track career options.' },
  'breadth-first':       { label:'Breadth-First Learner', interp:'You explore across many domains with moderate depth.',      rec:'Now deepen in your 2-3 highest-demand areas for senior roles.' },
  'plateau-breaker':     { label:'Plateau Breaker',       interp:'You stall, then break through with intensive focus.',       rec:'Identify your next plateau early and set a breakthrough plan.' },
  'consistent-achiever': { label:'Consistent Achiever',   interp:'You complete what you start and hit milestones reliably.',   rec:'Take on stretch goals — your execution rate supports it.' },
};

function detectPatterns(snapshots: CompetencySnapshot[], interventions: CompletedIntervention[]): GrowthPattern[] {
  const patterns: GrowthPattern[] = [];
  if (snapshots.length < 2) return patterns;

  const gains = snapshots.slice(1).map((s, i) => s.eiScore - snapshots[i].eiScore);
  const posGains = gains.filter(g => g > 0);
  const consistency = posGains.length / Math.max(1, gains.length);

  // Burst learner: high variance
  const mean = gains.reduce((s, v) => s + v, 0) / gains.length;
  const variance = gains.reduce((s, v) => s + (v - mean) ** 2, 0) / gains.length;
  if (Math.sqrt(variance) > 4)
    patterns.push({ id:'burst', pattern:'burst-learner', ...PATTERN_DEFS['burst-learner'], frequency: 3, strength:'strong' });

  // Steady grower: low variance, mostly positive
  if (consistency >= 0.75 && Math.sqrt(variance) < 3)
    patterns.push({ id:'steady', pattern:'steady-grower', ...PATTERN_DEFS['steady-grower'], frequency: snapshots.length, strength:'strong' });

  // Domain specialist: <3 domains at level 3+
  const last = snapshots[snapshots.length - 1];
  const deepDomains = Object.values(last.competencyLevels).filter(v => v >= 3).length;
  if (deepDomains <= 4)
    patterns.push({ id:'specialist', pattern:'domain-specialist', ...PATTERN_DEFS['domain-specialist'], frequency: 2, strength: deepDomains <= 2 ? 'strong' : 'moderate' });

  // Consistent achiever: ≥70% interventions completed
  const completionRate = interventions.length / Math.max(1, interventions.length + 2);
  if (completionRate >= 0.7)
    patterns.push({ id:'achiever', pattern:'consistent-achiever', ...PATTERN_DEFS['consistent-achiever'], frequency: interventions.length, strength:'strong' });

  return patterns;
}

/* ── Main builder ─────────────────────────────────────────────────── */
export function buildCareerMemoryView(
  userId:             string,
  snapshots:          CompetencySnapshot[],
  interventions:      CompletedIntervention[],
  peerMedianHistory?: number[],
): CareerMemoryView {
  const ordered = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);

  /* Behavioral evolution */
  const behavioralEvolution: BehavioralEvolutionPoint[] = ordered.map(snap => {
    const topComp = Object.entries(snap.competencyLevels).sort(([,a],[,b]) => b - a)[0];
    return {
      period:          snap.label ?? new Date(snap.timestamp).toLocaleDateString('en-IN', { month:'short', year:'2-digit' }),
      timestamp:       snap.timestamp,
      eiScore:         snap.eiScore,
      dominantDomain:  topComp?.[0] ?? 'N/A',
      growthHighlight: `EI ${snap.eiScore}`,
      behaviorBadge:   snap.eiScore >= 75 ? 'High Performer' : snap.eiScore >= 55 ? 'Progressing' : 'Emerging',
    };
  });

  /* Benchmark evolution */
  const benchmarkEvolution: BenchmarkEvolutionPoint[] = ordered.map((snap, idx) => {
    const peer = peerMedianHistory?.[idx] ?? 55;
    return {
      period:     snap.label ?? new Date(snap.timestamp).toLocaleDateString('en-IN', { month:'short', year:'2-digit' }),
      timestamp:  snap.timestamp,
      percentile: snap.percentile ?? Math.round(snap.eiScore * 0.8),
      eiScore:    snap.eiScore,
      peerMedian: peer,
      delta:      snap.eiScore - peer,
    };
  });

  /* Growth patterns */
  const growthPatterns = detectPatterns(ordered, interventions);

  /* Transformation milestones */
  const transformationMilestones: TransformationMilestone[] = [
    ...interventions.slice(-5).map(iv => ({
      id:          iv.id, type:'intervention-completed' as const,
      label:       `Completed: ${iv.competencyLabel}`, description: iv.title,
      timestamp:   iv.completedAt, eiAtTime: 0, icon:'CheckCircle',
    })),
    ...ordered.filter((s, i) => i > 0 && s.eiScore - ordered[i-1].eiScore >= 5).map(s => ({
      id:          `band_${s.snapshotId}`, type:'band-upgrade' as const,
      label:       'EI Milestone', description: `EI reached ${s.eiScore}`,
      timestamp:   s.timestamp, eiAtTime: s.eiScore, icon:'Star',
    })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  /* Stats */
  const first = ordered[0];
  const last  = ordered[ordered.length - 1];
  const spanDays = ordered.length >= 2
    ? Math.round((last.timestamp - first.timestamp) / 86400000)
    : 0;
  const totalGain = last?.eiScore - (first?.eiScore ?? 0) || 0;
  const months    = Math.max(0.1, spanDays / 30.44);

  const allCompGrowths: Record<string, number> = {};
  if (first && last) {
    Object.keys(last.competencyLevels).forEach(k => {
      allCompGrowths[k] = (last.competencyLevels[k] ?? 0) - (first.competencyLevels[k] ?? 0);
    });
  }
  const topGrown = Object.entries(allCompGrowths).sort(([,a],[,b]) => b - a)[0]?.[0] ?? 'N/A';

  // Streak: consecutive months with positive EI gain
  const eiGains = ordered.slice(1).map((s, i) => s.eiScore - ordered[i].eiScore);
  let streak = 0, maxStreak = 0, cur = 0;
  eiGains.forEach(g => { if (g > 0) { cur++; maxStreak = Math.max(maxStreak, cur); } else cur = 0; });
  streak = maxStreak;

  return {
    userId, snapshots: ordered,
    completedInterventions: interventions,
    behavioralEvolution, benchmarkEvolution, growthPatterns,
    transformationMilestones,
    memoryStats: {
      totalSnapshots:     ordered.length,
      totalInterventions: interventions.length,
      totalEIGain:        totalGain,
      spanDays,
      avgMonthlyGain:     Math.round((totalGain / months) * 10) / 10,
      longestStreak:      streak,
      topCompetencyGrown: topGrown,
    },
  };
}

/**
 * Explainable Scoring Engine
 * Universal wrapper that adds structured explainability to any score:
 * contributing signals, strengths, weaknesses, benchmark comparison,
 * and improvement opportunities.
 */

import type { CareerProfile } from '@/lib/careerIntelligence';
import type { BenchmarkIntelligenceOutput } from './benchmarkIntelligenceEngine';
import type { EIOutput } from './employabilityEngine';
import type { FitmentOutput } from './fitmentEngine';
import type { VisibilityOutput } from './visibilityEngine';

/* ── Core explainability types ──────────────────────────────────────── */

export interface ContributingSignal {
  name:      string;
  value:     number;      // raw contribution value
  weight:    number;      // 0-1 weight in overall score
  impact:    'positive' | 'negative' | 'neutral';
  pct:       number;      // % contribution to final score
  badge?:    string;      // optional highlight label
}

export interface BenchmarkComparison {
  vs:         string;     // e.g. "peers (mid-level)"
  benchmark:  number;     // their score
  user:       number;     // user's score
  percentile: number;     // user's percentile in that group
  delta:      number;     // user - benchmark
  standing:   'ahead' | 'at-par' | 'behind';
}

export interface ImprovementOpportunity {
  action:          string;
  currentValue:    number;
  targetValue:     number;
  scoreImpact:     number;   // estimated score gain
  effort:          'low' | 'medium' | 'high';
  timelineWeeks:   number;
  category:        string;
}

export interface ExplainableScore {
  scoreId:          string;
  label:            string;
  score:            number;
  maxScore:         number;
  grade:            string;
  narrative:        string;
  signals:          ContributingSignal[];
  strengths:        string[];
  weaknesses:       string[];
  benchmarks:       BenchmarkComparison[];
  opportunities:    ImprovementOpportunity[];
  confidenceLevel:  'high' | 'medium' | 'low';
}

/* ── Grade helpers ─────────────────────────────────────────────────── */
function gradeFrom(score: number, max = 100): string {
  const pct = (score / max) * 100;
  if (pct >= 88) return 'A+';
  if (pct >= 78) return 'A';
  if (pct >= 68) return 'B+';
  if (pct >= 55) return 'B';
  if (pct >= 40) return 'C';
  return 'D';
}

/* ── EI Explainable Score ──────────────────────────────────────────── */
export function explainEmployability(
  ei:        EIOutput,
  profile:   CareerProfile | null | undefined,
  benchmarks:BenchmarkIntelligenceOutput | null,
): ExplainableScore {
  const b = ei.breakdown;
  const maxPts = [45, 20, 10, 15, 6, 6];
  const vals   = [b.completenessScore, b.technicalScore, b.softScore, b.experienceScore, b.certScore, b.projectScore];
  const labels = ['Profile Completeness', 'Technical Skills', 'Soft Skills', 'Experience', 'Certifications', 'Projects'];
  const total  = vals.reduce((s, v) => s + v, 0);

  const signals: ContributingSignal[] = vals.map((v, i) => ({
    name:   labels[i],
    value:  Math.round(v),
    weight: maxPts[i] / 99,
    impact: v / maxPts[i] >= 0.6 ? 'positive' : v > 0 ? 'neutral' : 'negative',
    pct:    Math.round((v / Math.max(1, total)) * 100),
    badge:  v / maxPts[i] >= 0.85 ? 'strong' : undefined,
  }));

  const strengths  = ei.explainability.filter(f => f.status === 'strong' || f.status === 'good').map(f => `${f.label} (${f.earned}/${f.max} pts)`);
  const weaknesses = ei.explainability.filter(f => f.status === 'needs-work' || f.status === 'missing').map(f => f.action);

  const bmarks: BenchmarkComparison[] = [];
  if (benchmarks) {
    bmarks.push({
      vs: `Peers (${benchmarks.peer.stage})`, benchmark: benchmarks.peer.peerAvgEI,
      user: ei.score, percentile: benchmarks.peer.percentile,
      delta: benchmarks.peer.delta, standing: benchmarks.peer.delta >= 0 ? 'ahead' : 'behind',
    });
    bmarks.push({
      vs: benchmarks.industry.industry, benchmark: benchmarks.industry.industryAvgEI,
      user: ei.score, percentile: benchmarks.percentile.overall,
      delta: benchmarks.industry.delta, standing: benchmarks.industry.delta >= 5 ? 'ahead' : benchmarks.industry.delta >= -5 ? 'at-par' : 'behind',
    });
  }

  const opps: ImprovementOpportunity[] = ei.improvementRoadmap.shortTerm.map((action, i) => ({
    action, currentValue: ei.score, targetValue: Math.min(99, ei.score + 8 - i * 2),
    scoreImpact: 8 - i * 2, effort: 'low' as const, timelineWeeks: 2 + i * 2, category: 'Profile',
  }));

  return {
    scoreId: 'employability', label: 'Employability Index (EI)',
    score: ei.score, maxScore: 99, grade: gradeFrom(ei.score, 99),
    narrative: `Your EI of ${ei.score} places you in the ${ei.band} band. ${ei.tips[0] ?? ''}`,
    signals, strengths, weaknesses, benchmarks: bmarks, opportunities: opps,
    confidenceLevel: ei.score > 10 ? 'high' : 'medium',
  };
}

/* ── Fitment Explainable Score ─────────────────────────────────────── */
export function explainFitment(
  fit:       FitmentOutput,
  roleTitle: string,
  benchmarks:BenchmarkIntelligenceOutput | null,
): ExplainableScore {
  const signals: ContributingSignal[] = [
    { name: 'Skill Match',       value: fit.skillMatch,       weight: 0.45, impact: fit.skillMatch >= 60 ? 'positive' : 'negative', pct: 45 },
    { name: 'Competency Match',  value: fit.competencyMatch,  weight: 0.40, impact: fit.competencyMatch >= 60 ? 'positive' : 'negative', pct: 40 },
    { name: 'Experience Match',  value: fit.experienceMatch,  weight: 0.15, impact: fit.experienceMatch >= 60 ? 'positive' : 'neutral', pct: 15 },
  ];

  const strengths  = fit.matchedSkills.slice(0, 3).map(s => `Matched skill: ${s}`);
  const weaknesses = fit.competencyExplanations.filter(c => c.priority === 'critical' || c.priority === 'high').slice(0, 3).map(c => c.action);

  const bmarks: BenchmarkComparison[] = [];
  if (benchmarks) {
    bmarks.push({
      vs: `Industry hire threshold`, benchmark: 65,
      user: fit.fitScore, percentile: fit.fitScore >= 65 ? 70 : 35,
      delta: fit.fitScore - 65, standing: fit.fitScore >= 65 ? 'ahead' : 'behind',
    });
  }

  const opps: ImprovementOpportunity[] = fit.prioritizedSkillGaps.slice(0, 3).map((gap, i) => ({
    action: gap.action, currentValue: fit.fitScore,
    targetValue: Math.min(100, fit.fitScore + gap.impactScore * 0.1),
    scoreImpact: Math.round(gap.impactScore * 0.1),
    effort: gap.category === 'critical' ? 'high' as const : 'medium' as const,
    timelineWeeks: 6 + i * 4, category: 'Skill Development',
  }));

  return {
    scoreId: 'fitment', label: `Fitment to ${roleTitle}`,
    score: fit.fitScore, maxScore: 100, grade: gradeFrom(fit.fitScore),
    narrative: fit.fitmentNarrative,
    signals, strengths, weaknesses, benchmarks: bmarks, opportunities: opps,
    confidenceLevel: 'high',
  };
}

/* ── Visibility Explainable Score ──────────────────────────────────── */
export function explainVisibility(
  vis:       VisibilityOutput,
  benchmarks:BenchmarkIntelligenceOutput | null,
): ExplainableScore {
  const signals: ContributingSignal[] = vis.drivers.map(d => ({
    name:   d.label,
    value:  d.pts,
    weight: d.max / 100,
    impact: d.pts === d.max ? 'positive' : d.pts > 0 ? 'neutral' : 'negative',
    pct:    Math.round((d.pts / Math.max(1, vis.score)) * 100),
  }));

  const strengths  = vis.drivers.filter(d => d.pts === d.max && !d.tip).map(d => `${d.label} is fully optimised`);
  const weaknesses = vis.drivers.filter(d => d.tip).map(d => d.tip!);

  const bmarks: BenchmarkComparison[] = [];
  if (benchmarks) {
    const readiness = vis.recruiterReadinessScore;
    bmarks.push({
      vs: 'Recruiter threshold (active market)', benchmark: 45,
      user: vis.score, percentile: vis.score >= 65 ? 75 : vis.score >= 45 ? 50 : 25,
      delta: vis.score - 45, standing: vis.score >= 45 ? 'ahead' : 'behind',
    });
    bmarks.push({
      vs: 'Recruiter readiness benchmark (65)', benchmark: 65,
      user: readiness, percentile: readiness >= 65 ? 75 : 40,
      delta: readiness - 65, standing: readiness >= 65 ? 'ahead' : readiness >= 55 ? 'at-par' : 'behind',
    });
  }

  const opps: ImprovementOpportunity[] = vis.optimizationActions.slice(0, 3).map(a => ({
    action: a.cta, currentValue: vis.score, targetValue: Math.min(100, vis.score + a.impact),
    scoreImpact: a.impact, effort: a.effort, timelineWeeks: a.effort === 'low' ? 1 : a.effort === 'medium' ? 4 : 12,
    category: a.category,
  }));

  return {
    scoreId: 'visibility', label: 'Recruiter Visibility Score',
    score: vis.score, maxScore: 100, grade: gradeFrom(vis.score),
    narrative: `Visibility band: ${vis.band.toUpperCase()} · ${vis.recruiterViews} estimated views this week · ${vis.competitiveBand}`,
    signals, strengths, weaknesses, benchmarks: bmarks, opportunities: opps,
    confidenceLevel: 'medium',
  };
}

/* ── Generic score explainer ───────────────────────────────────────── */
export interface GenericScoreInput {
  scoreId:   string;
  label:     string;
  score:     number;
  maxScore?: number;
  signals:   Omit<ContributingSignal, 'pct'>[];
  strengths: string[];
  weaknesses:string[];
  opportunities: Omit<ImprovementOpportunity, 'currentValue' | 'targetValue'>[];
  narrative: string;
}

export function buildExplainableScore(input: GenericScoreInput): ExplainableScore {
  const total = input.signals.reduce((s, sg) => s + sg.value, 0);
  return {
    scoreId:   input.scoreId,
    label:     input.label,
    score:     input.score,
    maxScore:  input.maxScore ?? 100,
    grade:     gradeFrom(input.score, input.maxScore ?? 100),
    narrative: input.narrative,
    signals:   input.signals.map(sg => ({
      ...sg,
      pct: Math.round((sg.value / Math.max(1, total)) * 100),
    })),
    strengths:   input.strengths,
    weaknesses:  input.weaknesses,
    benchmarks:  [],
    opportunities: input.opportunities.map(o => ({
      ...o,
      currentValue: input.score,
      targetValue: Math.min(input.maxScore ?? 100, input.score + o.scoreImpact),
    })),
    confidenceLevel: 'medium',
  };
}

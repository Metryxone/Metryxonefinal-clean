/**
 * Success Signature Engine
 * Identifies high performer clusters, competency patterns,
 * leadership maturity signatures, and transformation readiness profiles.
 */

import type { CareerProfile } from '@/lib/careerIntelligence';
import { COMPETENCY_DOMAINS } from '@/data/marketCatalog';
import { COMPETENCY_GENOME } from '@/lib/competency-genome/genomeEngine';
import { FUTURE_COMPETENCY_MAP } from '@/lib/competency-genome/futureMapping';

export type ClusterId =
  | 'technical-elite'
  | 'well-rounded-senior'
  | 'communication-leader'
  | 'data-specialist'
  | 'emerging-talent'
  | 'leadership-track'
  | 'creative-innovator'
  | 'operations-champion';

export interface HighPerformerCluster {
  id:           ClusterId;
  label:        string;
  description:  string;
  signatureCompetencies: string[];
  peakRoleFamilies:      string[];
  earningPotential:      'high' | 'very-high' | 'premium';
  marketDemand:          'strong' | 'very-strong' | 'elite';
  keyStrengths:          string[];
  developmentFocus:      string[];
}

export const HIGH_PERFORMER_CLUSTERS: Record<ClusterId, HighPerformerCluster> = {
  'technical-elite': {
    id: 'technical-elite', label: 'Technical Elite',
    description: 'Deep technical specialists with systems-level thinking. The architects and principals who build the foundation.',
    signatureCompetencies: ['programming', 'systems-design', 'cloud', 'security'],
    peakRoleFamilies: ['engineering'],
    earningPotential: 'premium', marketDemand: 'elite',
    keyStrengths: ['Deep technical expertise', 'Problem-solving at scale', 'Code quality ownership'],
    developmentFocus: ['Stakeholder communication', 'Strategic thinking', 'Mentoring capacity'],
  },
  'well-rounded-senior': {
    id: 'well-rounded-senior', label: 'Well-Rounded Senior',
    description: 'Broad competency coverage across technical, analytical, and communication domains. The go-to person for cross-functional challenges.',
    signatureCompetencies: ['programming', 'data-analysis', 'presentation', 'collaboration', 'project-mgmt'],
    peakRoleFamilies: ['engineering', 'product', 'consulting'],
    earningPotential: 'very-high', marketDemand: 'very-strong',
    keyStrengths: ['Cross-functional effectiveness', 'Adaptability', 'Credibility across teams'],
    developmentFocus: ['Deepen one area to expert level', 'Build leadership signature'],
  },
  'communication-leader': {
    id: 'communication-leader', label: 'Communication Leader',
    description: 'Exceptional at influencing, presenting, and building stakeholder consensus. The trusted voice in the room.',
    signatureCompetencies: ['presentation', 'writing', 'stakeholder-mgmt', 'storytelling', 'strategy'],
    peakRoleFamilies: ['consulting', 'marketing', 'product'],
    earningPotential: 'very-high', marketDemand: 'strong',
    keyStrengths: ['Executive presence', 'Narrative building', 'Change management'],
    developmentFocus: ['Analytical depth', 'Technical fluency', 'Data-driven decisions'],
  },
  'data-specialist': {
    id: 'data-specialist', label: 'Data Specialist',
    description: 'Rigorous analytical thinkers with deep ML/statistical expertise. The evidence engine behind product and strategy.',
    signatureCompetencies: ['data-analysis', 'statistics', 'data-engineering', 'research'],
    peakRoleFamilies: ['data'],
    earningPotential: 'premium', marketDemand: 'elite',
    keyStrengths: ['Rigorous insight generation', 'Model building', 'Experimental design'],
    developmentFocus: ['Business translation of insights', 'Stakeholder communication', 'Leadership track'],
  },
  'emerging-talent': {
    id: 'emerging-talent', label: 'Emerging Talent',
    description: 'High drive and resilience with rapidly developing skills. The future stars with strong growth trajectory.',
    signatureCompetencies: ['drive', 'resilience', 'collaboration', 'programming'],
    peakRoleFamilies: ['engineering', 'product', 'data'],
    earningPotential: 'high', marketDemand: 'strong',
    keyStrengths: ['Learning velocity', 'Energy and initiative', 'Adaptability'],
    developmentFocus: ['Technical depth', 'Stakeholder presence', 'Structured thinking'],
  },
  'leadership-track': {
    id: 'leadership-track', label: 'Leadership Track',
    description: 'Strong people management and strategic competencies. Destined for managerial and executive roles.',
    signatureCompetencies: ['people-mgmt', 'strategy', 'mentoring', 'stakeholder-mgmt', 'negotiation'],
    peakRoleFamilies: ['leadership', 'consulting', 'operations'],
    earningPotential: 'premium', marketDemand: 'very-strong',
    keyStrengths: ['Talent development', 'Strategic vision', 'Organisational influence'],
    developmentFocus: ['Data fluency', 'Technical understanding', 'Financial acumen'],
  },
  'creative-innovator': {
    id: 'creative-innovator', label: 'Creative Innovator',
    description: 'Design thinking and storytelling paired with strong research. The human-centred problem solver.',
    signatureCompetencies: ['design-thinking', 'visual-design', 'storytelling', 'research', 'presentation'],
    peakRoleFamilies: ['design', 'marketing', 'product'],
    earningPotential: 'high', marketDemand: 'strong',
    keyStrengths: ['User empathy', 'Creative problem solving', 'Brand and narrative craft'],
    developmentFocus: ['Analytical skills', 'Business acumen', 'Scale and systems thinking'],
  },
  'operations-champion': {
    id: 'operations-champion', label: 'Operations Champion',
    description: 'Process excellence and project delivery mastery. The reliable executor who makes organisations efficient.',
    signatureCompetencies: ['process', 'project-mgmt', 'negotiation', 'collaboration', 'business-acumen'],
    peakRoleFamilies: ['operations', 'consulting'],
    earningPotential: 'high', marketDemand: 'strong',
    keyStrengths: ['Execution reliability', 'Process optimisation', 'Cross-team coordination'],
    developmentFocus: ['Strategic thinking', 'Digital skills', 'People leadership'],
  },
};

export interface LeadershipMaturity {
  level:         1 | 2 | 3 | 4;
  label:         string;
  description:   string;
  signature:     string;
  nextStep:      string;
}

export const LEADERSHIP_MATURITY_LEVELS: Record<1 | 2 | 3 | 4, LeadershipMaturity> = {
  1: {
    level: 1, label: 'Individual Contributor',
    description: 'Delivers personal results; developing technical and domain depth',
    signature: 'Owns tasks; learning collaboration and stakeholder basics',
    nextStep: 'Develop mentoring habit and project leadership',
  },
  2: {
    level: 2, label: 'Team Contributor',
    description: 'Influences immediate team; informal leadership emerging',
    signature: 'Mentors peers; leads small initiatives; builds stakeholder trust',
    nextStep: 'Formal people management or product/programme ownership',
  },
  3: {
    level: 3, label: 'Functional Leader',
    description: 'Manages a team or programme; develops strategy and culture',
    signature: 'Hires and grows talent; sets direction for a function',
    nextStep: 'Senior leadership — leading leaders; board-level presence',
  },
  4: {
    level: 4, label: 'Organisational Leader',
    description: 'Shapes organisation-wide strategy and culture; board-level impact',
    signature: 'CEO / VP equivalent; market-facing leadership; talent ecosystem builder',
    nextStep: 'Industry leadership, advisor, board director, or entrepreneur',
  },
};

export interface TransformationReadiness {
  score:           number;    // 0-100
  label:           'ready' | 'near-ready' | 'developing' | 'early';
  strengths:       string[];
  barriers:        string[];
  probability:     number;    // 0-100: success probability for major career shift
  timelineMonths:  number;
  keyActions:      string[];
}

export interface SuccessSignatureOutput {
  cluster:                HighPerformerCluster;
  clusterFit:             number;        // 0-100 match to assigned cluster
  alternativeClusters:    { cluster: HighPerformerCluster; fit: number }[];
  leadershipMaturity:     LeadershipMaturity;
  leadershipScore:        number;        // 0-100
  transformationReadiness:TransformationReadiness;
  competencyPattern:      { id: string; label: string; level: number; role: 'strength' | 'gap' | 'developing' }[];
  futureAlignmentScore:   number;        // 0-100: how aligned is the profile with future demand
  successProbability:     number;        // 0-100: P(top-quartile outcome in 3 years)
}

export interface SuccessSignatureInput {
  profile:          CareerProfile | null | undefined;
  competencyLevels: Record<string, number>;
  eiScore:          number;
  targetRoleFamily?:string;
}

function scoreClusterFit(levels: Record<string, number>, cluster: HighPerformerCluster): number {
  const sig = cluster.signatureCompetencies;
  const scores = sig.map(id => (levels[id] ?? 0) / 5);
  const avg = scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length);
  return Math.round(avg * 100);
}

function detectLeadershipLevel(levels: Record<string, number>): { level: 1 | 2 | 3 | 4; score: number } {
  const l1 = (levels['drive'] ?? 0) + (levels['collaboration'] ?? 0);
  const l2 = (levels['mentoring'] ?? 0) + (levels['stakeholder-mgmt'] ?? 0);
  const l3 = (levels['people-mgmt'] ?? 0) + (levels['negotiation'] ?? 0);
  const l4 = (levels['strategy'] ?? 0) * 2;

  const score = Math.round(((l1 + l2 + l3 + l4) / 24) * 100);

  let level: 1 | 2 | 3 | 4 = 1;
  if (l4 >= 6)                     level = 4;
  else if (l3 >= 5 && l2 >= 5)    level = 3;
  else if (l2 >= 4 || l3 >= 2)    level = 2;
  return { level, score };
}

function buildTransformationReadiness(
  levels: Record<string, number>,
  eiScore: number,
  expYears: number,
  targetFamily?: string,
): TransformationReadiness {
  const behavioral = (levels['drive'] ?? 0) + (levels['resilience'] ?? 0) + (levels['collaboration'] ?? 0);
  const technical  = (levels['programming'] ?? 0) + (levels['data-analysis'] ?? 0) + (levels['systems-design'] ?? 0);
  const leadership = (levels['people-mgmt'] ?? 0) + (levels['strategy'] ?? 0) + (levels['mentoring'] ?? 0);
  const comm       = (levels['presentation'] ?? 0) + (levels['stakeholder-mgmt'] ?? 0);

  const score = Math.round(
    behavioral / 15 * 25 +
    (eiScore / 100) * 30 +
    technical  / 15 * 20 +
    leadership / 15 * 15 +
    comm / 10 * 10,
  );

  const label: TransformationReadiness['label'] =
    score >= 75 ? 'ready' : score >= 55 ? 'near-ready' : score >= 35 ? 'developing' : 'early';

  const strengths: string[] = [];
  const barriers: string[] = [];
  const actions: string[] = [];

  if (behavioral >= 9) strengths.push('Strong behavioural foundation');
  if (eiScore >= 60)   strengths.push('Above-average employability index');
  if (leadership >= 6) strengths.push('Leadership competencies developing');
  if (comm >= 6)       strengths.push('Communication skills solid');

  if (eiScore < 40)    { barriers.push('Employability Index below threshold'); actions.push('Complete Competency Assessment and follow IDP'); }
  if (behavioral < 6)  { barriers.push('Behavioural foundation gaps'); actions.push('Develop drive and resilience through stretch assignments'); }
  if (comm < 4)        { barriers.push('Communication gaps for senior roles'); actions.push('Build presentation and stakeholder management skills'); }
  if (expYears < 2)    { barriers.push('Limited experience signal'); actions.push('Gain 18+ months of substantive work experience'); }

  return {
    score: Math.min(100, score),
    label,
    strengths: strengths.slice(0, 3),
    barriers:  barriers.slice(0, 3),
    probability: Math.min(95, score + 10),
    timelineMonths: label === 'ready' ? 3 : label === 'near-ready' ? 9 : label === 'developing' ? 18 : 36,
    keyActions: actions.slice(0, 3),
  };
}

export function runSuccessSignatureEngine(input: SuccessSignatureInput): SuccessSignatureOutput {
  const { competencyLevels: levels, eiScore, profile } = input;
  const expYears = (profile?.experience ?? []).reduce((s, e) => s + (Number(e?.years) || 1), 0);

  /* Cluster matching */
  const clusterScores = Object.values(HIGH_PERFORMER_CLUSTERS)
    .map(c => ({ cluster: c, fit: scoreClusterFit(levels, c) }))
    .sort((a, b) => b.fit - a.fit);

  /* If target role family is known, boost matching cluster */
  const top = input.targetRoleFamily
    ? clusterScores.find(cs => cs.cluster.peakRoleFamilies.includes(input.targetRoleFamily!)) ?? clusterScores[0]
    : clusterScores[0];

  /* Leadership maturity */
  const { level: lLevel, score: lScore } = detectLeadershipLevel(levels);

  /* Future alignment */
  let futureScore = 0;
  FUTURE_COMPETENCY_MAP.forEach(sig => {
    const lvl = levels[sig.competencyId] ?? 0;
    if (sig.growthTrajectory === 'hot' || sig.growthTrajectory === 'rising') {
      futureScore += (lvl / 5) * 10;
    }
  });
  const futureAlignmentScore = Math.min(100, Math.round(futureScore));

  /* Competency pattern */
  const pattern = COMPETENCY_DOMAINS.map(d => {
    const lvl = levels[d.id] ?? 0;
    const role: 'strength' | 'gap' | 'developing' =
      lvl >= 3.5 ? 'strength' : lvl >= 1.5 ? 'developing' : 'gap';
    return { id: d.id, label: d.label, level: lvl, role };
  });

  /* Success probability */
  const successProb = Math.round(
    (eiScore * 0.30 + top.fit * 0.25 + futureAlignmentScore * 0.25 + lScore * 0.20) / 100,
  ) * 100;

  /* Transformation readiness */
  const transformation = buildTransformationReadiness(levels, eiScore, expYears, input.targetRoleFamily);

  return {
    cluster:                top.cluster,
    clusterFit:             top.fit,
    alternativeClusters:    clusterScores.slice(1, 3),
    leadershipMaturity:     LEADERSHIP_MATURITY_LEVELS[lLevel],
    leadershipScore:        lScore,
    transformationReadiness:transformation,
    competencyPattern:      pattern,
    futureAlignmentScore,
    successProbability:     Math.min(95, successProb),
  };
}

import {
  computeVisibility,
  estimateRecruiterViews,
  type CareerProfile,
  type VisibilityBreakdown,
} from '@/lib/careerIntelligence';

export interface VisibilityInput {
  profile:               CareerProfile | null | undefined;
  eiScore:               number;
  isOpenToOpportunities: boolean;
}

export interface VisibilityAction {
  id:       string;
  label:    string;
  impact:   number;
  effort:   'low' | 'medium' | 'high';
  category: 'profile' | 'skills' | 'experience' | 'external';
  cta:      string;
}

export interface VisibilityOutput extends VisibilityBreakdown {
  recruiterViews:        number;
  viewTrend:             'up' | 'down' | 'flat';
  actionCount:           number;
  discoveryScore:        number;
  recruiterReadinessScore:number;
  optimizationActions:   VisibilityAction[];
  competitiveBand:       string;
}

function buildOptimizationActions(
  profile: CareerProfile | null | undefined,
  eiScore: number,
  vis: VisibilityBreakdown,
): VisibilityAction[] {
  const actions: VisibilityAction[] = [];
  const base   = profile?.competencyProfile?.completeness ?? 0;
  const tech   = (profile?.skills?.technical ?? []).length;
  const exp    = (profile?.experience ?? []).length;
  const certs  = (profile?.certifications ?? []).length;
  const hasLI  = !!profile?.personal?.linkedin;
  const hasGH  = !!profile?.personal?.github;
  const hasSumm= !!profile?.summary;

  if (!hasLI)
    actions.push({ id: 'add-linkedin', label: 'Add LinkedIn URL', impact: 5, effort: 'low', category: 'external',
      cta: 'Add your LinkedIn profile link to be discoverable across recruiter networks' });

  if (!hasSumm)
    actions.push({ id: 'add-summary', label: 'Write Professional Summary', impact: 5, effort: 'low', category: 'profile',
      cta: 'Write a 2-sentence summary highlighting your role and key strength' });

  if (base < 80)
    actions.push({ id: 'complete-profile', label: 'Complete Profile to 80%', impact: Math.round((80 - base) * 0.2), effort: 'medium', category: 'profile',
      cta: `Fill remaining sections to reach 80% completeness (currently ${base}%)` });

  if (tech < 8)
    actions.push({ id: 'add-skills', label: 'Add In-Demand Skills', impact: Math.min(15, (8 - tech) * 2), effort: 'low', category: 'skills',
      cta: `Add ${8 - tech} more technical skills to appear in more recruiter searches` });

  if (exp === 0)
    actions.push({ id: 'add-experience', label: 'Add Work Experience', impact: 15, effort: 'medium', category: 'experience',
      cta: 'Add at least one role — even internship or freelance work signals credibility' });

  if (certs === 0)
    actions.push({ id: 'add-cert', label: 'Earn a Certification', impact: 6, effort: 'high', category: 'profile',
      cta: 'An AWS, Google, or PMP certification validates your skills to recruiters' });

  if (!hasGH)
    actions.push({ id: 'add-github', label: 'Link GitHub Profile', impact: 4, effort: 'low', category: 'external',
      cta: 'A GitHub link signals technical initiative and gives recruiters proof of work' });

  if (eiScore < 60)
    actions.push({ id: 'boost-ei', label: 'Boost Employability Index', impact: 10, effort: 'medium', category: 'profile',
      cta: 'Complete the Competency Assessment and follow your IDP to lift your EI score' });

  return actions.sort((a, b) => b.impact - a.impact).slice(0, 6);
}

function computeDiscoveryScore(
  profile: CareerProfile | null | undefined,
  visScore: number,
): number {
  const tech   = (profile?.skills?.technical ?? []).length;
  const exp    = (profile?.experience ?? []).length;
  const hasLI  = !!profile?.personal?.linkedin;
  const hasGH  = !!profile?.personal?.github;
  const hasSumm= !!profile?.summary;

  const keywordDensity = Math.min(30, tech * 3);
  const externalLinks  = (hasLI ? 15 : 0) + (hasGH ? 10 : 0);
  const contentRich    = hasSumm ? 10 : 0;
  const expSignal      = Math.min(20, exp * 7);
  const visBoost       = Math.round(visScore * 0.15);

  return Math.min(100, keywordDensity + externalLinks + contentRich + expSignal + visBoost);
}

function computeRecruiterReadiness(
  profile: CareerProfile | null | undefined,
  eiScore: number,
  visScore: number,
): number {
  const base   = profile?.competencyProfile?.completeness ?? 0;
  const hasLI  = !!profile?.personal?.linkedin;
  const hasSumm= !!profile?.summary;
  const certs  = (profile?.certifications ?? []).length;
  const exp    = (profile?.experience ?? []).length;

  const completeness = Math.round(base * 0.30);
  const ei           = Math.round(eiScore * 0.25);
  const vis          = Math.round(visScore * 0.20);
  const profileRich  = (hasLI ? 8 : 0) + (hasSumm ? 7 : 0);
  const credSignal   = Math.min(10, certs * 4 + exp * 2);

  return Math.min(100, completeness + ei + vis + profileRich + credSignal);
}

function competitiveBandLabel(readiness: number): string {
  if (readiness >= 85) return 'Top 10% — highly competitive for recruiter outreach';
  if (readiness >= 70) return 'Top 25% — strong candidate profile';
  if (readiness >= 50) return 'Top 50% — competitive with moderate gaps';
  if (readiness >= 30) return 'Below average — significant profile gaps';
  return 'Early stage — focus on profile completeness first';
}

export function runVisibilityEngine(input: VisibilityInput): VisibilityOutput {
  const vis   = computeVisibility(input.profile, input.eiScore, input.isOpenToOpportunities);
  const views = estimateRecruiterViews(input.profile, input.eiScore, vis.score);

  const discoveryScore         = computeDiscoveryScore(input.profile, vis.score);
  const recruiterReadinessScore= computeRecruiterReadiness(input.profile, input.eiScore, vis.score);

  return {
    ...vis,
    recruiterViews:          views.thisWeek,
    viewTrend:               views.trend,
    actionCount:             vis.drivers.filter(d => d.tip).length,
    discoveryScore,
    recruiterReadinessScore,
    optimizationActions:     buildOptimizationActions(input.profile, input.eiScore, vis),
    competitiveBand:         competitiveBandLabel(recruiterReadinessScore),
  };
}

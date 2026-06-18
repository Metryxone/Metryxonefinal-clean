/**
 * Weekly Action Engine (Phase 5 — Part C).
 *
 * Pure, deterministic generator of the week's highest-ROI moves. Consumes the
 * aggregated Career Brain (skill gaps, CAPADEX patterns, market/job/interview
 * readiness) and returns AT MOST 5 tasks, ranked by return-on-investment
 * (impact ÷ effort, nudged by urgency).
 *
 * Outputs are developmental actions only — never hiring/promotion predictions.
 * No side effects, no I/O: same inputs → same plan.
 */
import type { CareerBrain } from '../services/useCareerBrain';

export type ActionEffort = 'low' | 'medium' | 'high';

export interface WeeklyAction {
  id: string;
  title: string;
  rationale: string;
  category: 'profile' | 'skills' | 'jobs' | 'interview' | 'market' | 'behavioural' | 'assessment';
  effort: ActionEffort;
  impact: number;        // 0–100
  roi: number;           // derived rank score
  deepLinkTab: string;   // a valid CareerBuilderPage TabId
}

export interface WeeklyActionContext {
  openJobs?: number;
  hasAssessment?: boolean;
}

const EFFORT_COST: Record<ActionEffort, number> = { low: 1, medium: 2, high: 3.2 };

function roi(impact: number, effort: ActionEffort, urgency = 1): number {
  return Number(((impact / EFFORT_COST[effort]) * urgency).toFixed(2));
}

/**
 * Build the week's plan. Candidates are generated from every readiness lever,
 * then the top 5 by ROI are returned (highest first).
 */
export function generateWeeklyActions(brain: CareerBrain, ctx: WeeklyActionContext = {}): WeeklyAction[] {
  const candidates: WeeklyAction[] = [];
  const push = (a: Omit<WeeklyAction, 'roi'> & { urgency?: number }) => {
    const { urgency = 1, ...rest } = a;
    candidates.push({ ...rest, roi: roi(rest.impact, rest.effort, urgency) });
  };

  // 1. Critical + important skill gaps (highest ROI lever).
  brain.skillGaps.slice(0, 3).forEach((g, i) => {
    const impact = g.category === 'critical' ? 92 - i * 4 : g.category === 'important' ? 74 - i * 4 : 58;
    push({
      id: `gap-${g.skill.replace(/\s+/g, '-').toLowerCase()}`,
      title: `Build evidence for ${g.skill}`,
      rationale: `${g.category === 'critical' ? 'Critical' : 'Key'} gap for ${brain.targetRole}. Closing it lifts your transition odds most.`,
      category: 'skills',
      effort: g.category === 'critical' ? 'medium' : 'low',
      impact,
      deepLinkTab: 'skills',
      urgency: g.category === 'critical' ? 1.15 : 1,
    });
  });

  // 2. Market readiness — apply when readiness is high but pipeline is empty.
  if (brain.marketReadiness >= 55 && (ctx.openJobs ?? 0) === 0) {
    push({
      id: 'apply-matched-role',
      title: 'Apply to one well-matched role',
      rationale: `Market readiness is ${brain.marketReadiness}% but you have no active applications — convert readiness into a pipeline.`,
      category: 'jobs',
      effort: 'medium',
      impact: 80,
      deepLinkTab: 'jobs',
      urgency: 1.2,
    });
  }

  // 3. Job pipeline in flight → push interview prep.
  if ((ctx.openJobs ?? 0) > 0) {
    push({
      id: 'interview-prep',
      title: 'Run an interview prep session',
      rationale: `You have ${ctx.openJobs} application(s) live. Interview readiness is ${brain.interviewReadiness}% — prep now to convert.`,
      category: 'interview',
      effort: 'medium',
      impact: brain.interviewReadiness < 60 ? 84 : 66,
      deepLinkTab: 'interview',
      urgency: 1.25,
    });
  }

  // 4. Behavioural constraint surfaced by CAPADEX → targeted micro-action.
  //    Prefer the adapter's named career constraint (specific + impact-framed); fall back
  //    to the top pattern. Low execution readiness raises both impact and urgency, since a
  //    behavioural drag is then the binding constraint on everything else this week.
  const namedConstraint = brain.behaviorProfile?.careerConstraints?.[0];
  const realPattern = brain.patterns[0];
  if (namedConstraint || realPattern) {
    const lowExec = brain.executionReadiness < 50;
    const title = namedConstraint
      ? `Work on: ${namedConstraint}`
      : `Address pattern: ${realPattern!.label || realPattern!.key}`;
    push({
      id: `behaviour-${(realPattern?.key || namedConstraint || 'pattern').toString().replace(/\s+/g, '-').toLowerCase().slice(0, 48)}`,
      title,
      rationale: `${brain.executionStyle}. Execution readiness is ${brain.executionReadiness}% — ${lowExec ? 'reducing this behavioural drag is the highest-leverage move this week' : 'a small adjustment here keeps your momentum compounding'}.`,
      category: 'behavioural',
      effort: 'low',
      impact: lowExec ? 82 : 70,
      deepLinkTab: 'behavioral-growth',
      urgency: lowExec ? 1.25 : 1.1,
    });
  }

  // 5. Profile completeness — foundational, high urgency when thin.
  const completeness = brain.dimensions.length; // proxy presence
  if (brain.coreBottleneck.includes('Incomplete profile') || (brain.riskFactors.some((r) => /profile evidence/i.test(r)))) {
    push({
      id: 'complete-profile',
      title: 'Complete your profile evidence',
      rationale: 'Thin profile evidence under-represents your strengths and weakens every recommendation downstream.',
      category: 'profile',
      effort: 'low',
      impact: 88,
      deepLinkTab: 'profile',
      urgency: 1.3,
    });
  }

  // 6. No assessment yet → run one (improves every signal).
  if (!ctx.hasAssessment && completeness === 0) {
    push({
      id: 'run-assessment',
      title: 'Take a competency assessment',
      rationale: 'A fresh assessment sharpens your signals and unlocks accurate gap + market analysis.',
      category: 'assessment',
      effort: 'medium',
      impact: 76,
      deepLinkTab: 'assessment',
      urgency: 1.1,
    });
  }

  // Dedupe by id, rank by ROI, cap at 5.
  const seen = new Set<string>();
  return candidates
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);
}

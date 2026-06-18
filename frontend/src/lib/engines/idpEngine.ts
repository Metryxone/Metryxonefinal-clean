import {
  buildIDP,
  inferCompetencyLevels,
  type CareerProfile,
  type IDPItem,
} from '@/lib/careerIntelligence';
import { COMPETENCY_DOMAINS, type MarketRole } from '@/data/marketCatalog';

export type { IDPItem };

export interface IDPInput {
  profile:    CareerProfile | null | undefined;
  targetRole: MarketRole;
  maxItems?:  number;
  progress?:  Record<string, 'pending' | 'in-progress' | 'done'>;
}

export interface IDPMilestone {
  week:         number;
  title:        string;
  itemIds:      string[];
  targetEILift: number;
  description:  string;
}

export interface IDPPhase {
  phase:         1 | 2 | 3;
  label:         string;
  theme:         string;
  weeks:         number;
  items:         IDPItem[];
  milestones:    IDPMilestone[];
  totalEILift:   number;
  totalHours:    number;
}

export interface GapPriorityItem {
  competencyId: string;
  label:        string;
  gap:          number;
  urgency:      'critical' | 'high' | 'medium';
}

export interface IDPOutput {
  items:            IDPItem[];
  totalHours:       number;
  totalEILift:      number;
  etaWeeks:         number;
  readyAt:          string;
  phases:           IDPPhase[];
  adaptiveSequence: string[];
  gapPriority:      GapPriorityItem[];
  completionPct:    number;
}

function roiScore(item: IDPItem): number {
  return item.eiLift / Math.max(1, item.hours);
}

function buildPhases(items: IDPItem[]): IDPPhase[] {
  if (!items.length) return [];

  const third  = Math.ceil(items.length / 3);
  const slices: IDPItem[][] = [
    items.slice(0, third),
    items.slice(third, third * 2),
    items.slice(third * 2),
  ];

  const themes = [
    { label: 'Foundation', theme: 'Close critical skill gaps and establish learning momentum' },
    { label: 'Growth',     theme: 'Build depth in key competencies and add portfolio evidence' },
    { label: 'Excellence', theme: 'Sharpen advanced skills and achieve market readiness' },
  ];

  return slices.map((slice, idx) => {
    const totalHours   = slice.reduce((s, i) => s + i.hours, 0);
    const totalEILift  = slice.reduce((s, i) => s + i.eiLift, 0);
    const phaseWeeks   = Math.ceil(totalHours / 10);
    const weekOffset   = slices.slice(0, idx).reduce((s, sl) =>
      s + Math.ceil(sl.reduce((h, i) => h + i.hours, 0) / 10), 0,
    );

    const midWeek    = weekOffset + Math.ceil(phaseWeeks / 2);
    const endWeek    = weekOffset + phaseWeeks;
    const half       = Math.ceil(slice.length / 2);
    const milestones: IDPMilestone[] = [
      {
        week:         midWeek,
        title:        `${themes[idx].label} Checkpoint`,
        itemIds:      slice.slice(0, half).map(i => i.id),
        targetEILift: slice.slice(0, half).reduce((s, i) => s + i.eiLift, 0),
        description:  `Complete first ${half} intervention${half > 1 ? 's' : ''} in this phase`,
      },
      {
        week:         endWeek,
        title:        `${themes[idx].label} Complete`,
        itemIds:      slice.map(i => i.id),
        targetEILift: totalEILift,
        description:  `All ${slice.length} ${themes[idx].label.toLowerCase()} interventions done`,
      },
    ];

    return {
      phase:       (idx + 1) as 1 | 2 | 3,
      label:       themes[idx].label,
      theme:       themes[idx].theme,
      weeks:       phaseWeeks,
      items:       slice,
      milestones,
      totalEILift,
      totalHours,
    };
  });
}

function buildGapPriority(
  profile: CareerProfile | null | undefined,
  role: MarketRole,
): GapPriorityItem[] {
  const levels = inferCompetencyLevels(profile);
  return role.competencies
    .map(rc => {
      const gap = rc.required - (levels[rc.id] ?? 0);
      if (gap <= 0.2) return null;
      const urgency: GapPriorityItem['urgency'] = gap >= 2.5 ? 'critical' : gap >= 1.5 ? 'high' : 'medium';
      const label = COMPETENCY_DOMAINS.find(c => c.id === rc.id)?.label ?? rc.id;
      return { competencyId: rc.id, label, gap: Math.round(gap * 10) / 10, urgency };
    })
    .filter(Boolean)
    .sort((a, b) => b!.gap - a!.gap) as GapPriorityItem[];
}

function computeCompletionPct(
  items: IDPItem[],
  progress: Record<string, 'pending' | 'in-progress' | 'done'> = {},
): number {
  if (!items.length) return 0;
  const done = items.filter(i => progress[i.id] === 'done').length;
  return Math.round((done / items.length) * 100);
}

export function runIDPEngine(input: IDPInput): IDPOutput {
  const items      = buildIDP(input.profile, input.targetRole, input.maxItems ?? 7);
  const totalHours = items.reduce((s, i) => s + i.hours, 0);
  const totalEILift= items.reduce((s, i) => s + i.eiLift, 0);
  const etaWeeks   = Math.ceil(totalHours / 10);
  const readyAt    = new Date(Date.now() + etaWeeks * 7 * 86400000)
    .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const adaptiveSequence = [...items]
    .sort((a, b) => roiScore(b) - roiScore(a))
    .map(i => i.id);

  return {
    items,
    totalHours,
    totalEILift,
    etaWeeks,
    readyAt,
    phases:           buildPhases(items),
    adaptiveSequence,
    gapPriority:      buildGapPriority(input.profile, input.targetRole),
    completionPct:    computeCompletionPct(items, input.progress),
  };
}

/**
 * Adaptive IDP 2.0 Engine
 * Dynamic intervention sequencing, milestone adaptation,
 * multiple transformation pathways, and predictive progression.
 */

import {
  buildIDP,
  type CareerProfile,
  type IDPItem,
} from '@/lib/careerIntelligence';
import { type MarketRole }    from '@/data/marketCatalog';
import { type IDPOutput, type IDPPhase } from './idpEngine';
import { type LearningVelocityOutput }   from './learningVelocityEngine';
import { buildGapSequence }              from '@/lib/competency-genome/genomeEngine';

/* ── Output types ─────────────────────────────────────────────────── */
export type InterventionType = 'course' | 'project' | 'mentoring' | 'practice' | 'reading' | 'certification' | 'stretch-assignment';
export type InterventionPriority = 'critical' | 'high' | 'medium' | 'low';
export type PathwayApproach = 'fast-track' | 'balanced' | 'deep-dive' | 'breadth-first';

export interface DynamicIntervention {
  id:                string;
  competencyId:      string;
  competencyLabel:   string;
  title:             string;
  type:              InterventionType;
  priority:          InterventionPriority;
  etaWeeks:          number;
  eiLift:            number;
  hours:             number;
  dependsOn:         string[];    // intervention IDs that must come first
  alternatives:      string[];    // alternative intervention IDs
  adapted:           boolean;     // true if modified from base IDP
  adaptationReason?: string;
  status:            'not-started' | 'in-progress' | 'completed' | 'skipped';
  urgencyFlag:       boolean;
  quickWin:          boolean;     // completable in ≤1 week
}

export interface AdaptedMilestone {
  id:            string;
  week:          number;
  originalWeek:  number;
  adapted:       boolean;
  title:         string;
  description:   string;
  targetEI:      number;
  interventionIds:string[];
  status:        'not-started' | 'on-track' | 'ahead' | 'behind' | 'at-risk' | 'completed';
  statusReason?: string;
}

export interface TransformationPathway {
  id:            string;
  label:         string;
  approach:      PathwayApproach;
  description:   string;
  totalWeeks:    number;
  totalHours:    number;
  totalEILift:   number;
  weeklyHours:   number;
  phases:        { phase: number; label: string; weeks: number; interventionIds: string[] }[];
  suitableFor:   string;
  tradeoffs:     string[];
  recommended:   boolean;
}

export interface AdaptiveIDPOutput {
  /* Interventions */
  interventions:           DynamicIntervention[];
  urgentInterventions:     DynamicIntervention[];
  quickWins:               DynamicIntervention[];

  /* Pathways */
  pathways:                TransformationPathway[];
  recommendedPathway:      TransformationPathway;

  /* Milestones */
  adaptedMilestones:       AdaptedMilestone[];

  /* Timeline */
  totalWeeks:              number;
  completionDate:          string;
  velocityAdjustedDate:    string;   // adjusted for actual learning speed
  weeksAheadOrBehind:      number;   // positive = ahead, negative = behind

  /* Progress */
  onTrack:                 boolean;
  completionPct:           number;
  eiLiftRemaining:         number;
  nextAction:              DynamicIntervention | null;

  /* Narrative */
  adaptationNarrative:     string;
  executiveSummary:        string;
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function weekDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildDynamicIntervention(
  item:     IDPItem,
  priority: InterventionPriority,
  adapted:  boolean,
  reason?:  string,
): DynamicIntervention {
  const hours = item.hours;
  return {
    id:               `int_${item.competency}_${Math.random().toString(36).slice(2,6)}`,
    competencyId:     item.competency,
    competencyLabel:  item.label,
    title:            item.action,
    type:             hours <= 4 ? 'practice' :
                      hours <= 8 ? 'course' :
                      hours <= 16 ? 'project' : 'certification',
    priority,
    etaWeeks:         Math.ceil(hours / 10),
    eiLift:           item.eiLift,
    hours,
    dependsOn:        [],
    alternatives:     [],
    adapted,
    adaptationReason: reason,
    status:           'not-started',
    urgencyFlag:      priority === 'critical',
    quickWin:         hours <= 8 && item.eiLift >= 2,
  };
}

function buildPathway(
  id:         string,
  approach:   PathwayApproach,
  label:      string,
  desc:       string,
  suitable:   string,
  tradeoffs:  string[],
  items:      IDPItem[],
  hoursPerWk: number,
): TransformationPathway {
  const totalHours  = items.reduce((s, i) => s + i.hours, 0);
  const totalEILift = items.reduce((s, i) => s + i.eiLift, 0);
  const totalWeeks  = Math.ceil(totalHours / hoursPerWk);
  const third       = Math.ceil(items.length / 3);
  const phases      = [
    { phase:1, label:'Foundation', weeks: Math.ceil(totalWeeks * 0.3), interventionIds: items.slice(0, third).map(i => `int_${i.competency}`) },
    { phase:2, label:'Growth',     weeks: Math.ceil(totalWeeks * 0.4), interventionIds: items.slice(third, third*2).map(i => `int_${i.competency}`) },
    { phase:3, label:'Excellence', weeks: Math.ceil(totalWeeks * 0.3), interventionIds: items.slice(third*2).map(i => `int_${i.competency}`) },
  ];
  return { id, label, approach, description: desc, totalWeeks, totalHours, totalEILift, weeklyHours: hoursPerWk, phases, suitableFor: suitable, tradeoffs, recommended: false };
}

/* ── Main engine ──────────────────────────────────────────────────── */
export interface AdaptiveIDPInput {
  profile:           CareerProfile | null | undefined;
  targetRole:        MarketRole;
  competencyLevels:  Record<string, number>;
  velocity?:         LearningVelocityOutput;
  progress?:         Record<string, 'pending' | 'in-progress' | 'done'>;
  maxItems?:         number;
}

export function runAdaptiveIDPEngine(input: AdaptiveIDPInput): AdaptiveIDPOutput {
  const { profile, targetRole, competencyLevels, velocity, progress } = input;

  /* Base IDP from existing engine */
  const baseItems: IDPItem[] = buildIDP(profile, targetRole, input.maxItems ?? 12);

  /* Velocity factor: adjust week estimates */
  const velocityBand    = velocity?.velocityBand ?? 'moderate';
  const velocityFactor  = { elite:0.6, high:0.75, moderate:1.0, low:1.3, stalled:1.6 }[velocityBand] ?? 1.0;
  const weeklyHours     = { elite:15, high:12, moderate:8, low:5, stalled:3 }[velocityBand] ?? 8;

  /* Gap sequence from genome — determine priority order */
  const gapSeq = buildGapSequence(
    competencyLevels,
    Object.fromEntries(targetRole.competencies.map(rc => [rc.id, rc.required])),
  );
  const priorityMap: Record<string, InterventionPriority> = {};
  gapSeq.forEach((g, i) => {
    priorityMap[g.id] = i === 0 ? 'critical' : i < 3 ? 'high' : i < 6 ? 'medium' : 'low';
  });

  /* Build dynamic interventions */
  const interventions: DynamicIntervention[] = baseItems.map(item => {
    const done     = progress?.[item.competency] === 'done';
    const inProg   = progress?.[item.competency] === 'in-progress';
    const adapted  = velocityBand !== 'moderate';
    const reason   = adapted ? `Adjusted for ${velocityBand} learning velocity` : undefined;
    const priority = priorityMap[item.competency] ?? 'medium';
    const dyn      = buildDynamicIntervention(item, priority, adapted, reason);
    if (done)   dyn.status = 'completed';
    if (inProg) dyn.status = 'in-progress';
    dyn.etaWeeks = Math.ceil(dyn.etaWeeks * velocityFactor);
    return dyn;
  });

  /* Reorder by genome gap priority */
  interventions.sort((a, b) => {
    const pOrder: Record<InterventionPriority, number> = { critical:0, high:1, medium:2, low:3 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  /* Add genome dependency edges */
  gapSeq.forEach(gap => {
    if (!gap.prereqsMet) {
      const blocked = interventions.find(i => i.competencyId === gap.id);
      if (blocked) {
        const prereqs = interventions.filter(i => gap.id !== i.competencyId && priorityMap[i.competencyId] === 'critical');
        blocked.dependsOn = prereqs.map(p => p.id).slice(0, 2);
        if (!blocked.adapted) {
          blocked.adapted = true;
          blocked.adaptationReason = 'Sequenced after prerequisite competencies';
        }
      }
    }
  });

  /* Build 3 pathways */
  const balancedItems = [...baseItems];
  const fastTrackItems= baseItems.filter(i => priorityMap[i.competency] === 'critical' || priorityMap[i.competency] === 'high').slice(0, 6);
  const deepItems     = baseItems.slice(0, 4);  // fewer, deeper

  const pathways: TransformationPathway[] = [
    {
      ...buildPathway('balanced','balanced','Balanced Path','Steady progression through all required competencies','Professionals with 8–12 hrs/week available',['Longer timeline (8–12 weeks more)','Thorough coverage reduces risk of gaps'],balancedItems, weeklyHours),
      recommended: velocityBand === 'moderate' || velocityBand === 'high',
    },
    {
      ...buildPathway('fast-track','fast-track','Fast Track','Focus on highest-impact competencies only','Professionals under time pressure or with strong foundations',['Skips depth in some competencies','Best for those with existing partial skill'],fastTrackItems, weeklyHours + 4),
      recommended: velocityBand === 'elite',
    },
    {
      ...buildPathway('deep-dive','deep-dive','Deep Dive','Thorough mastery of core competencies before breadth','Professionals aiming for senior/principal roles',['Significantly longer timeline','High daily commitment'],deepItems.slice(0,3), weeklyHours - 2),
      recommended: velocityBand === 'low' || velocityBand === 'stalled',
    },
  ];

  const recommended = pathways.find(p => p.recommended) ?? pathways[0];

  /* Milestones */
  let weekCursor = 0;
  const adaptedMilestones: AdaptedMilestone[] = interventions
    .filter(i => i.priority === 'critical' || i.priority === 'high')
    .slice(0, 5)
    .map((intervention, idx) => {
      weekCursor += intervention.etaWeeks;
      const originalWeek = Math.ceil(intervention.etaWeeks / velocityFactor) * (idx + 1);
      const adapted      = Math.abs(weekCursor - originalWeek) >= 2;
      const status: AdaptedMilestone['status'] =
        intervention.status === 'completed' ? 'completed' :
        weekCursor < originalWeek - 2 ? 'ahead' :
        weekCursor > originalWeek + 4 ? 'behind' :
        'on-track';
      return {
        id:              `ms_${idx + 1}`,
        week:            weekCursor,
        originalWeek,
        adapted,
        title:           `Level up ${intervention.competencyLabel}`,
        description:     intervention.title,
        targetEI:        Math.round(10 + idx * 5 + intervention.eiLift),
        interventionIds: [intervention.id],
        status,
        statusReason:    adapted ? `Adjusted ${weekCursor < originalWeek ? 'ahead' : 'behind'} plan for ${velocityBand} velocity` : undefined,
      };
    });

  /* Completion metrics */
  const completedCount = interventions.filter(i => i.status === 'completed').length;
  const completionPct  = Math.round((completedCount / Math.max(1, interventions.length)) * 100);
  const totalWeeks     = Math.ceil(recommended.totalHours / weeklyHours);
  const velAdjWeeks    = Math.ceil(totalWeeks * velocityFactor);
  const onTrack        = velAdjWeeks <= totalWeeks + 4;

  /* Next action */
  const nextAction = interventions.find(i => i.status === 'not-started' || i.status === 'in-progress') ?? null;

  /* Narratives */
  const adaptation = velocityBand !== 'moderate'
    ? `IDP adapted for ${velocityBand} learning velocity — timeline ${velocityFactor > 1 ? `extended by ${Math.round((velocityFactor - 1) * 100)}%` : `compressed by ${Math.round((1 - velocityFactor) * 100)}%`}.`
    : 'IDP on standard timeline.';

  const summary = `${recommended.label} selected — ${recommended.totalWeeks} weeks, ${recommended.totalHours}h total effort, +${recommended.totalEILift} EI pts projected. `
    + `${completionPct}% complete. Next: ${nextAction?.title ?? 'Start first intervention'}.`;

  return {
    interventions, pathways, recommendedPathway: recommended,
    adaptedMilestones,
    urgentInterventions: interventions.filter(i => i.urgencyFlag && i.status !== 'completed'),
    quickWins:           interventions.filter(i => i.quickWin && i.status !== 'completed').slice(0, 3),
    totalWeeks, completionDate: weekDate(totalWeeks),
    velocityAdjustedDate: weekDate(velAdjWeeks),
    weeksAheadOrBehind: totalWeeks - velAdjWeeks,
    onTrack, completionPct,
    eiLiftRemaining: interventions.filter(i => i.status !== 'completed').reduce((s, i) => s + i.eiLift, 0),
    nextAction, adaptationNarrative: adaptation, executiveSummary: summary,
  };
}

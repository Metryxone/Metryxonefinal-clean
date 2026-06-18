import type { GapItem } from './gapPrioritization.js';

export type InterventionType = 'course' | 'project' | 'mentorship' | 'reading' | 'coaching';

export interface InterventionRecommendation {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  gapLevel: string;
  interventionType: InterventionType;
  title: string;
  durationWeeks: number;
  expectedScoreGain: number;
  priority: number;
}

const INTERVENTION_CATALOG: Record<string, { type: InterventionType; title: string; durationWeeks: number; expectedGain: number }[]> = {
  COG: [
    { type: 'course', title: 'Critical Thinking & Analytical Reasoning', durationWeeks: 6, expectedGain: 12 },
    { type: 'project', title: 'Case Study Analysis Project', durationWeeks: 4, expectedGain: 8 },
    { type: 'reading', title: 'Problem Solving Frameworks Reading List', durationWeeks: 2, expectedGain: 5 },
  ],
  COM: [
    { type: 'course', title: 'Business Communication Masterclass', durationWeeks: 4, expectedGain: 10 },
    { type: 'coaching', title: 'Executive Presence Coaching', durationWeeks: 8, expectedGain: 15 },
    { type: 'project', title: 'Cross-functional Presentation Project', durationWeeks: 3, expectedGain: 7 },
  ],
  LEA: [
    { type: 'mentorship', title: 'Leadership Mentoring Programme', durationWeeks: 12, expectedGain: 18 },
    { type: 'course', title: 'Emerging Leaders Certification', durationWeeks: 8, expectedGain: 14 },
    { type: 'project', title: 'Team Lead Shadowing Project', durationWeeks: 6, expectedGain: 10 },
  ],
  EXE: [
    { type: 'course', title: 'Project Management Professional (PMP) Prep', durationWeeks: 10, expectedGain: 16 },
    { type: 'project', title: 'Deliver a Cross-Departmental Initiative', durationWeeks: 8, expectedGain: 12 },
    { type: 'coaching', title: 'Execution & Accountability Coaching', durationWeeks: 6, expectedGain: 9 },
  ],
  ADP: [
    { type: 'course', title: 'Agile Mindset & Change Readiness', durationWeeks: 4, expectedGain: 10 },
    { type: 'reading', title: 'Growth Mindset Literature Pack', durationWeeks: 2, expectedGain: 6 },
    { type: 'project', title: 'Innovation Sprint Challenge', durationWeeks: 3, expectedGain: 8 },
  ],
  TEC: [
    { type: 'course', title: 'Advanced Technical Skills Bootcamp', durationWeeks: 8, expectedGain: 18 },
    { type: 'project', title: 'Technical Architecture Deep Dive', durationWeeks: 6, expectedGain: 13 },
    { type: 'mentorship', title: 'Senior Engineer Mentorship', durationWeeks: 12, expectedGain: 20 },
  ],
  EIQ: [
    { type: 'course', title: 'Emotional Intelligence at Work', durationWeeks: 5, expectedGain: 11 },
    { type: 'coaching', title: 'EQ Coaching for Leaders', durationWeeks: 8, expectedGain: 14 },
    { type: 'reading', title: 'Self-Awareness & Empathy Reading Pack', durationWeeks: 2, expectedGain: 5 },
  ],
};

export function recommendInterventions(
  gaps: GapItem[],
  maxPerCompetency = 2
): InterventionRecommendation[] {
  const results: InterventionRecommendation[] = [];
  const actionableGaps = gaps.filter(g => g.gapLevel !== 'strength').slice(0, 15);

  for (const gap of actionableGaps) {
    const domainPrefix = gap.competencyCode.slice(0, 3);
    const catalog = INTERVENTION_CATALOG[domainPrefix] ?? INTERVENTION_CATALOG['COG'];
    const topN = catalog.slice(0, maxPerCompetency);
    for (const iv of topN) {
      results.push({
        competencyId: gap.competencyId,
        competencyCode: gap.competencyCode,
        competencyName: gap.competencyName,
        gapLevel: gap.gapLevel,
        interventionType: iv.type,
        title: iv.title,
        durationWeeks: iv.durationWeeks,
        expectedScoreGain: iv.expectedGain,
        priority: gap.priority,
      });
    }
  }

  return results.sort((a, b) => b.priority - a.priority || b.expectedScoreGain - a.expectedScoreGain);
}

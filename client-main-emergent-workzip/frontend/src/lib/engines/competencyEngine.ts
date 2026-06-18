import {
  inferCompetencyLevels,
  getUserSkillSet,
  type CareerProfile,
} from '@/lib/careerIntelligence';
import { COMPETENCY_DOMAINS } from '@/data/marketCatalog';

export interface CompetencyInput {
  profile: CareerProfile | null | undefined;
}

export interface CompetencyScore {
  id: string;
  label: string;
  level: number;
  maxLevel: 5;
  pct: number;
}

export interface CompetencyOutput {
  scores: CompetencyScore[];
  topStrengths: CompetencyScore[];
  topGaps: CompetencyScore[];
  overallAvg: number;
  skillCount: number;
}

export function runCompetencyEngine(input: CompetencyInput): CompetencyOutput {
  const levels = inferCompetencyLevels(input.profile);
  const skills = getUserSkillSet(input.profile);

  const scores: CompetencyScore[] = COMPETENCY_DOMAINS.map(d => ({
    id:       d.id,
    label:    d.label,
    level:    levels[d.id] ?? 0,
    maxLevel: 5,
    pct:      Math.round(((levels[d.id] ?? 0) / 5) * 100),
  }));

  const sorted = [...scores].sort((a, b) => b.level - a.level);
  const nonZero = sorted.filter(s => s.level > 0);
  const overallAvg = nonZero.length
    ? Math.round(nonZero.reduce((s, c) => s + c.pct, 0) / nonZero.length)
    : 0;

  return {
    scores,
    topStrengths: sorted.slice(0, 5),
    topGaps:      [...scores].sort((a, b) => a.level - b.level).filter(s => s.level < 3).slice(0, 5),
    overallAvg,
    skillCount:   skills.size,
  };
}

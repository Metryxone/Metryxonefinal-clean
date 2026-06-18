import {
  computeFitment,
  inferCompetencyLevels,
  switchability,
  type CareerProfile,
  type FitmentBreakdown,
} from '@/lib/careerIntelligence';
import { COMPETENCY_DOMAINS } from '@/data/marketCatalog';
import type { MarketRole } from '@/data/marketCatalog';

export interface FitmentInput {
  profile:    CareerProfile | null | undefined;
  targetRole: MarketRole;
}

export interface CompetencyExplanation {
  id:          string;
  label:       string;
  required:    number;
  actual:      number;
  gap:         number;
  coveragePct: number;
  priority:    'critical' | 'high' | 'medium' | 'low';
  action:      string;
}

export interface PrioritizedSkillGap {
  skill:        string;
  impactScore:  number;
  category:     'critical' | 'important' | 'nice-to-have';
  action:       string;
}

export interface FitmentOutput extends FitmentBreakdown {
  switchabilityScore:      number;
  summary:                 string;
  competencyExplanations:  CompetencyExplanation[];
  prioritizedSkillGaps:    PrioritizedSkillGap[];
  fitmentNarrative:        string;
  readinessLevel:          'hire-ready' | 'near-ready' | 'developing' | 'early-stage';
}

function buildSummary(f: FitmentBreakdown): string {
  if (f.fitScore >= 75) return 'Strong match — you meet most requirements for this role.';
  if (f.fitScore >= 50) return 'Good match — a few targeted improvements will get you there.';
  if (f.fitScore >= 30) return 'Moderate match — focus on the top missing skills and competency gaps.';
  return 'Early stage — significant upskilling needed before this role is within reach.';
}

function readinessFrom(fitScore: number): FitmentOutput['readinessLevel'] {
  if (fitScore >= 75) return 'hire-ready';
  if (fitScore >= 55) return 'near-ready';
  if (fitScore >= 35) return 'developing';
  return 'early-stage';
}

function buildCompetencyExplanations(
  profile: CareerProfile | null | undefined,
  role: MarketRole,
  levels: Record<string, number>,
): CompetencyExplanation[] {
  return role.competencies
    .map(rc => {
      const actual = Math.round((levels[rc.id] ?? 0) * 10) / 10;
      const gap    = Math.max(0, Math.round((rc.required - actual) * 10) / 10);
      const cov    = Math.round((Math.min(actual, rc.required) / Math.max(1, rc.required)) * 100);
      const label  = COMPETENCY_DOMAINS.find(c => c.id === rc.id)?.label ?? rc.id;

      let priority: CompetencyExplanation['priority'] = 'low';
      if (gap >= 2.5)      priority = 'critical';
      else if (gap >= 1.5) priority = 'high';
      else if (gap >= 0.5) priority = 'medium';

      const action = gap <= 0
        ? `${label} meets the requirement — maintain this competency`
        : gap < 1
          ? `Small gap in ${label} — one targeted project will close it`
          : gap < 2
            ? `Build ${label} through a structured course or certification`
            : `${label} needs significant development — prioritise this in your IDP`;

      return { id: rc.id, label, required: rc.required, actual, gap, coveragePct: cov, priority, action };
    })
    .sort((a, b) => b.gap - a.gap);
}

function buildPrioritizedSkillGaps(missingSkills: string[], role: MarketRole): PrioritizedSkillGap[] {
  const totalRequired = role.skills.length;
  return missingSkills.map((skill, i) => {
    const impactScore = Math.round(((totalRequired - i) / totalRequired) * 100);
    const category: PrioritizedSkillGap['category'] =
      i < 2 ? 'critical' : i < 4 ? 'important' : 'nice-to-have';
    return {
      skill,
      impactScore,
      category,
      action: `Add "${skill}" to your skills and back it with a project or course`,
    };
  });
}

function buildNarrative(f: FitmentBreakdown, sw: number, role: MarketRole): string {
  const parts: string[] = [];
  if (f.skillMatch >= 70)       parts.push(`strong skill alignment (${f.skillMatch}%)`);
  else if (f.skillMatch >= 40)  parts.push(`moderate skill overlap (${f.skillMatch}%)`);
  else                          parts.push(`skill gaps to address (${f.skillMatch}% match)`);

  if (f.competencyMatch >= 70)  parts.push(`competency depth is solid (${f.competencyMatch}%)`);
  else                          parts.push(`competency development needed (${f.competencyMatch}%)`);

  if (sw >= 70)                 parts.push(`high switchability from your current track (${sw}%)`);
  else if (sw >= 40)            parts.push(`moderate transition effort required`);
  else                          parts.push(`significant career pivot involved`);

  const missing = f.missingSkills.slice(0, 2);
  const missingNote = missing.length ? ` Key gaps: ${missing.join(', ')}.` : '';
  return `For ${role.title}: ${parts.join(', ')}.${missingNote}`;
}

export function runFitmentEngine(input: FitmentInput): FitmentOutput {
  const levels  = inferCompetencyLevels(input.profile);
  const fitment = computeFitment(input.profile, input.targetRole, levels);
  const sw      = switchability(
    (input.profile?.experience ?? []).find(e => e?.current)?.title ?? null,
    input.targetRole.id,
  );

  return {
    ...fitment,
    switchabilityScore:     sw,
    summary:                buildSummary(fitment),
    competencyExplanations: buildCompetencyExplanations(input.profile, input.targetRole, levels),
    prioritizedSkillGaps:   buildPrioritizedSkillGaps(fitment.missingSkills, input.targetRole),
    fitmentNarrative:       buildNarrative(fitment, sw, input.targetRole),
    readinessLevel:         readinessFrom(fitment.fitScore),
  };
}

/**
 * MX-302A — Career Launchpad & Experience Routing (frontend, pure)
 * ----------------------------------------------------------------------------
 * One-for-one mirror of backend/services/experience-routing.ts (the pure half).
 * Keep the two in sync: the stage list, stage→experience map and experience
 * config must match the backend, since the backend persists/audits the stage
 * and the frontend renders/routes from it.
 *
 * All four experiences map to REAL dedicated surfaces (Career Launchpad →
 * fresher-hub, Command Center → dashboard, Leadership Studio →
 * leadership-studio, Executive Studio → executive-studio) and are flagged
 * `available: true`. The senior/executive studios are unlocked only for the
 * stages that map to them.
 */

export type CareerStage =
  | 'student'
  | 'graduate'
  | 'postgraduate'
  | 'internship-seeker'
  | 'early-career'
  | 'mid-career'
  | 'senior-leadership'
  | 'executive';

export type ExperienceId =
  | 'launchpad'
  | 'command-center'
  | 'leadership-studio'
  | 'executive-studio';

export const CAREER_STAGES: { id: CareerStage; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'graduate', label: 'Graduate' },
  { id: 'postgraduate', label: 'Postgraduate' },
  { id: 'internship-seeker', label: 'Internship Seeker' },
  { id: 'early-career', label: 'Early-Career' },
  { id: 'mid-career', label: 'Mid-Career' },
  { id: 'senior-leadership', label: 'Senior / Leadership' },
  { id: 'executive', label: 'Executive' },
];

export interface ExperienceConfig {
  id: ExperienceId;
  label: string;
  /** Tab id within CareerBuilderPage this experience lands on. */
  targetTab: string;
  available: boolean;
  note?: string;
}

export const EXPERIENCES: Record<ExperienceId, ExperienceConfig> = {
  'launchpad': { id: 'launchpad', label: 'Career Launchpad', targetTab: 'fresher-hub', available: true },
  'command-center': { id: 'command-center', label: 'Career Command Center', targetTab: 'dashboard', available: true },
  'leadership-studio': {
    id: 'leadership-studio', label: 'Leadership Studio', targetTab: 'leadership-studio', available: true,
  },
  'executive-studio': {
    id: 'executive-studio', label: 'Executive Studio', targetTab: 'executive-studio', available: true,
  },
};

export const STAGE_TO_EXPERIENCE: Record<CareerStage, ExperienceId> = {
  'student': 'launchpad',
  'graduate': 'launchpad',
  'postgraduate': 'launchpad',
  'internship-seeker': 'launchpad',
  'early-career': 'launchpad',
  'mid-career': 'command-center',
  'senior-leadership': 'leadership-studio',
  'executive': 'executive-studio',
};

export function resolveExperience(stage: CareerStage): ExperienceConfig {
  return EXPERIENCES[STAGE_TO_EXPERIENCE[stage]];
}

const STAGE_IDS = new Set<string>(CAREER_STAGES.map((s) => s.id));
export function isCareerStage(v: unknown): v is CareerStage {
  return typeof v === 'string' && STAGE_IDS.has(v);
}

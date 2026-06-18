/**
 * CAPADEX Simulation — Persona Library (0C).
 *
 * The canonical set of simulated personas used to validate the live CAPADEX
 * pipeline before production. Each persona maps to a real concern string (the
 * concern resolver has a keyword fallback so these never 404), a track, an age
 * band, and a set of `conceptTokens` used to score whether the engine surfaces
 * on-topic questions / findings for that persona.
 *
 * Pure data + helpers. No DB, no side effects.
 */

export type SimTrack = 'Learner' | 'Professional' | 'Proxy';

export interface PersonaDef {
  /** Stable machine key. */
  key: string;
  /** Human label (matches the 0C spec wording). */
  label: string;
  /** Role descriptor surfaced in the dashboard. */
  role: string;
  /** Concern string passed to /session/start + /analyze. */
  concern: string;
  track: SimTrack;
  /** Canonical age band label (matches IntroPhase AGE_BANDS). */
  ageBand: string;
  /** Inclusive age range to sample a concrete age from. */
  ageRange: [number, number];
  /** Lowercase tokens an on-topic question / finding should mention. */
  conceptTokens: string[];
  /** Best-effort behavioural construct keys this concern should map to. */
  expectedConstructs: string[];
  /** Baseline struggle severity 0..1 (higher → more distress). */
  baseSeverity: number;
}

export const PERSONAS: PersonaDef[] = [
  {
    key: 'student_procrastination',
    label: 'Student with Procrastination',
    role: 'Student',
    concern: 'Procrastination',
    track: 'Learner',
    ageBand: '17-24',
    ageRange: [17, 23],
    conceptTokens: ['procrast', 'delay', 'avoid', 'deadline', 'postpone', 'task', 'start', 'distract', 'put off'],
    expectedConstructs: ['HABIT_FORMATION', 'GOAL_ORIENTATION', 'IMPULSE_CONTROL', 'DIGITAL_DISCIPLINE'],
    baseSeverity: 0.7,
  },
  {
    key: 'student_exam_anxiety',
    label: 'Student with Exam Anxiety',
    role: 'Student',
    concern: 'Exam Anxiety',
    track: 'Learner',
    ageBand: '14-17',
    ageRange: [14, 17],
    conceptTokens: ['exam', 'anxiet', 'test', 'nervous', 'fear', 'worry', 'pressure', 'panic', 'blank'],
    expectedConstructs: ['EXAM_PERFORMANCE', 'MENTAL_HEALTH', 'RESILIENCE'],
    baseSeverity: 0.72,
  },
  {
    key: 'founder_burnout',
    label: 'Founder with Burnout',
    role: 'Founder',
    concern: 'Burnout',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [28, 45],
    conceptTokens: ['burnout', 'exhaust', 'overwork', 'fatigue', 'energy', 'overwhelm', 'drained', 'rest', 'workload'],
    expectedConstructs: ['MENTAL_HEALTH', 'RESILIENCE'],
    baseSeverity: 0.78,
  },
  {
    key: 'founder_decision_fatigue',
    label: 'Founder with Decision Fatigue',
    role: 'Founder',
    concern: 'Decision Fatigue',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [28, 45],
    conceptTokens: ['decision', 'fatigue', 'choice', 'indecis', 'overwhelm', 'choose', 'second-guess', 'overthink'],
    expectedConstructs: ['CRITICAL_THINKING', 'IMPULSE_CONTROL', 'PROCESSING_SPEED'],
    baseSeverity: 0.66,
  },
  {
    key: 'teacher_imposter',
    label: 'Teacher with Imposter Syndrome',
    role: 'Teacher',
    concern: 'Imposter Syndrome',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [25, 45],
    conceptTokens: ['imposter', 'doubt', 'fraud', 'confidence', 'inadequa', 'self-worth', 'not good enough', 'undeserv'],
    expectedConstructs: ['SOCIAL_CONFIDENCE', 'MENTAL_HEALTH', 'SKILL_AWARENESS'],
    baseSeverity: 0.68,
  },
  {
    key: 'teacher_stress',
    label: 'Teacher with Stress',
    role: 'Teacher',
    concern: 'Stress Management',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [25, 45],
    conceptTokens: ['stress', 'overwhelm', 'pressure', 'tension', 'workload', 'cope', 'strain', 'relax'],
    expectedConstructs: ['MENTAL_HEALTH', 'RESILIENCE'],
    baseSeverity: 0.64,
  },
  {
    key: 'manager_conflict_avoidance',
    label: 'Manager with Conflict Avoidance',
    role: 'Manager',
    concern: 'Conflict Avoidance',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [30, 48],
    conceptTokens: ['conflict', 'avoid', 'confront', 'disagree', 'assert', 'difficult', 'tension', 'feedback', 'uncomfort'],
    expectedConstructs: ['COMMUNICATION', 'SOCIAL_CONFIDENCE', 'PEER_RELATIONS'],
    baseSeverity: 0.62,
  },
  {
    key: 'manager_delegation',
    label: 'Manager with Delegation Issues',
    role: 'Manager',
    concern: 'Delegation',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [30, 48],
    conceptTokens: ['delegat', 'control', 'trust', 'workload', 'micromanage', 'offload', 'hand over', 'let go', 'team'],
    expectedConstructs: ['COMMUNICATION', 'GOAL_ORIENTATION'],
    baseSeverity: 0.6,
  },
  {
    key: 'sales_performance_anxiety',
    label: 'Sales Leader with Performance Anxiety',
    role: 'Sales Leader',
    concern: 'Performance Anxiety',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [28, 47],
    conceptTokens: ['performance', 'anxiet', 'pressure', 'target', 'fear', 'underperform', 'quota', 'nervous', 'fail'],
    expectedConstructs: ['MENTAL_HEALTH', 'RESILIENCE', 'SOCIAL_CONFIDENCE'],
    baseSeverity: 0.7,
  },
  {
    key: 'professional_focus',
    label: 'Working Professional with Focus Problems',
    role: 'Working Professional',
    concern: 'Focus at Work',
    track: 'Professional',
    ageBand: '24-45',
    ageRange: [24, 45],
    conceptTokens: ['focus', 'distract', 'concentrat', 'attention', 'productiv', 'scatter', 'interrupt', 'drift', 'task'],
    expectedConstructs: ['DIGITAL_DISCIPLINE', 'HABIT_FORMATION', 'GOAL_ORIENTATION'],
    baseSeverity: 0.65,
  },
];

const BY_KEY: Record<string, PersonaDef> = Object.fromEntries(PERSONAS.map((p) => [p.key, p]));

export function getPersona(key: string): PersonaDef | undefined {
  return BY_KEY[key];
}

/** Normalise free text for token matching. */
export function normaliseText(s: unknown): string {
  return String(s ?? '').toLowerCase();
}

/** Does `text` mention any of the persona's concept tokens? */
export function isOnTopic(text: string, tokens: string[]): boolean {
  const t = normaliseText(text);
  return tokens.some((tok) => tok && t.includes(tok));
}

/**
 * Canonical Behavioural Construct Taxonomy — Single source of truth.
 * 36 named constructs. 30 of them are the home of the ~160 canonical concern
 * areas (many concern areas → one construct). The remaining constructs
 * (CAREER_GROWTH, plus the three reconciled keys CAREER_READINESS / COLLEGE_ADAPT /
 * EXAM_STRESS) are model- and intervention-grounded but do not yet own a concern
 * area — an honest, tracked coverage gap, not a defect.
 *
 * Reconciliation note (WC-3 Route Coverage Remediation): CAREER_READINESS,
 * COLLEGE_ADAPT and EXAM_STRESS were referenced by `wc3_outcome_models` and exist
 * in `intervention_library`, but were missing from this registry — so they could
 * never MATCH a runtime session construct (matching intersects against canonical
 * registry keys). Registering them here aligns the two vocabularies with no loss
 * (every key remains grounded in a real intervention).
 */

export type ConstructCluster =
  | 'Cognitive'
  | 'Self-Regulation'
  | 'Emotional'
  | 'Mental Wellbeing'
  | 'Motivation'
  | 'Social'
  | 'Digital'
  | 'Academic'
  | 'Career'
  | 'Family & Environment';

export interface BehaviouralConstruct {
  key: string;
  label: string;
  cluster: ConstructCluster;
  description: string;
  color: string;
}

export const CONSTRUCTS: BehaviouralConstruct[] = [
  // ─── Cognitive ────────────────────────────────────────────────────────────
  {
    key: 'ATTENTION_REGULATION',
    label: 'Attention Regulation',
    cluster: 'Cognitive',
    description: 'Ability to sustain, direct, and control attentional focus over time.',
    color: '#3B82F6',
  },
  {
    key: 'WORKING_MEMORY',
    label: 'Working Memory',
    cluster: 'Cognitive',
    description: 'Capacity to hold and manipulate information in mind for short-term use.',
    color: '#6366F1',
  },
  {
    key: 'PROCESSING_SPEED',
    label: 'Processing Speed',
    cluster: 'Cognitive',
    description: 'Rate at which cognitive tasks are completed accurately.',
    color: '#8B5CF6',
  },
  {
    key: 'CRITICAL_THINKING',
    label: 'Critical Thinking',
    cluster: 'Cognitive',
    description: 'Ability to analyse, evaluate, and apply reasoning to solve problems.',
    color: '#A855F7',
  },
  {
    key: 'CREATIVITY',
    label: 'Creativity & Curiosity',
    cluster: 'Cognitive',
    description: 'Drive to generate novel ideas and explore beyond the known.',
    color: '#D946EF',
  },

  // ─── Self-Regulation ─────────────────────────────────────────────────────
  {
    key: 'EXECUTIVE_FUNCTION',
    label: 'Executive Function',
    cluster: 'Self-Regulation',
    description: 'Planning, organisation, time management, and goal-directed behaviour.',
    color: '#F59E0B',
  },
  {
    key: 'IMPULSE_CONTROL',
    label: 'Impulse Control',
    cluster: 'Self-Regulation',
    description: 'Ability to resist immediate urges in favour of longer-term outcomes.',
    color: '#EF4444',
  },
  {
    key: 'PROCRASTINATION',
    label: 'Procrastination',
    cluster: 'Self-Regulation',
    description: 'Chronic delay of important tasks despite intention and awareness.',
    color: '#F97316',
  },
  {
    key: 'HABIT_FORMATION',
    label: 'Habit Formation',
    cluster: 'Self-Regulation',
    description: 'Capacity to build and sustain consistent behavioural routines.',
    color: '#84CC16',
  },

  // ─── Emotional ───────────────────────────────────────────────────────────
  {
    key: 'ANXIETY',
    label: 'Anxiety',
    cluster: 'Emotional',
    description: 'Persistent fear, worry, or apprehension that interferes with functioning.',
    color: '#EC4899',
  },
  {
    key: 'EMOTIONAL_REGULATION',
    label: 'Emotional Regulation',
    cluster: 'Emotional',
    description: 'Ability to manage and modulate emotional responses appropriately.',
    color: '#F43F5E',
  },
  {
    key: 'SELF_ESTEEM',
    label: 'Self-Esteem',
    cluster: 'Emotional',
    description: 'Sense of self-worth and confidence in one\'s own abilities.',
    color: '#FB7185',
  },
  {
    key: 'RESILIENCE',
    label: 'Resilience',
    cluster: 'Emotional',
    description: 'Capacity to recover from setbacks and adapt to adversity.',
    color: '#10B981',
  },

  // ─── Mental Wellbeing ────────────────────────────────────────────────────
  {
    key: 'STRESS_MANAGEMENT',
    label: 'Stress Management',
    cluster: 'Mental Wellbeing',
    description: 'Ability to cope with pressure, prevent burnout, and maintain equilibrium.',
    color: '#14B8A6',
  },
  {
    key: 'MENTAL_HEALTH',
    label: 'Mental Health',
    cluster: 'Mental Wellbeing',
    description: 'Overall psychological wellbeing including mood stability and emotional health.',
    color: '#06B6D4',
  },
  {
    key: 'PHYSICAL_WELLBEING',
    label: 'Physical Wellbeing',
    cluster: 'Mental Wellbeing',
    description: 'Sleep quality, energy regulation, physical activity, and nutritional habits.',
    color: '#0EA5E9',
  },

  // ─── Motivation ─────────────────────────────────────────────────────────
  {
    key: 'INTRINSIC_MOTIVATION',
    label: 'Intrinsic Motivation',
    cluster: 'Motivation',
    description: 'Internal drive to engage and persist without external pressure.',
    color: '#22C55E',
  },
  {
    key: 'GOAL_ORIENTATION',
    label: 'Goal Orientation',
    cluster: 'Motivation',
    description: 'Ability to set meaningful goals and sustain effort toward them.',
    color: '#4ADE80',
  },
  {
    key: 'LEARNING_DRIVE',
    label: 'Learning Drive',
    cluster: 'Motivation',
    description: 'Curiosity, openness, and enthusiasm for acquiring new knowledge.',
    color: '#86EFAC',
  },

  // ─── Social ──────────────────────────────────────────────────────────────
  {
    key: 'COMMUNICATION',
    label: 'Communication',
    cluster: 'Social',
    description: 'Clarity, confidence, and effectiveness in expressing thoughts verbally and in writing.',
    color: '#344E86',
  },
  {
    key: 'SOCIAL_CONFIDENCE',
    label: 'Social Confidence',
    cluster: 'Social',
    description: 'Ease and assertiveness in social situations and group environments.',
    color: '#4B6FBF',
  },
  {
    key: 'PEER_RELATIONS',
    label: 'Peer Relations',
    cluster: 'Social',
    description: 'Quality of relationships with peers, including teamwork and conflict navigation.',
    color: '#60A5FA',
  },
  {
    key: 'SAFETY_THREATS',
    label: 'Safety & Threat Exposure',
    cluster: 'Social',
    description: 'Exposure to bullying (online or offline) and inappropriate content.',
    color: '#DC2626',
  },

  // ─── Digital ────────────────────────────────────────────────────────────
  {
    key: 'DIGITAL_DEPENDENCY',
    label: 'Digital Dependency',
    cluster: 'Digital',
    description: 'Compulsive or excessive use of digital devices and platforms.',
    color: '#7C3AED',
  },
  {
    key: 'DIGITAL_DISCIPLINE',
    label: 'Digital Discipline',
    cluster: 'Digital',
    description: 'Ability to manage screen time and maintain healthy digital habits.',
    color: '#9333EA',
  },

  // ─── Academic ───────────────────────────────────────────────────────────
  {
    key: 'EXAM_PERFORMANCE',
    label: 'Exam Performance',
    cluster: 'Academic',
    description: 'Actual results and achievement levels in assessments and examinations.',
    color: '#0891B2',
  },
  {
    key: 'EXAM_READINESS',
    label: 'Exam Readiness',
    cluster: 'Academic',
    description: 'Preparation quality, strategy, and execution during examination conditions.',
    color: '#0E7490',
  },
  {
    key: 'LEARNING_APPROACH',
    label: 'Learning Approach',
    cluster: 'Academic',
    description: 'The quality and depth of learning strategies — from rote to deep understanding.',
    color: '#155E75',
  },
  {
    key: 'ACADEMIC_RECOVERY',
    label: 'Academic Recovery',
    cluster: 'Academic',
    description: 'Ability to regroup, re-strategise, and recover after academic setbacks.',
    color: '#1E3A5F',
  },
  {
    // WC-3 reconciled key: present in wc3_outcome_models (exam_readiness) +
    // intervention_library; registered here so it can MATCH a runtime session.
    key: 'EXAM_STRESS',
    label: 'Exam Stress',
    cluster: 'Academic',
    description: 'Stress and pressure tied specifically to examinations and high-stakes assessment.',
    color: '#0369A1',
  },
  {
    // WC-3 reconciled key: present in wc3_outcome_models (career_clarity) +
    // intervention_library; registered here so it can MATCH a runtime session.
    key: 'COLLEGE_ADAPT',
    label: 'College Adaptation',
    cluster: 'Academic',
    description: 'Adjustment to the academic, social, and independence demands of college / higher education.',
    color: '#164E63',
  },

  // ─── Career ─────────────────────────────────────────────────────────────
  {
    key: 'CAREER_CLARITY',
    label: 'Career Clarity',
    cluster: 'Career',
    description: 'Clarity about career direction, purpose, and aligned decision-making.',
    color: '#D97706',
  },
  {
    key: 'SKILL_AWARENESS',
    label: 'Skill Awareness',
    cluster: 'Career',
    description: 'Understanding of one\'s actual skills, strengths, and employability gaps.',
    color: '#B45309',
  },
  {
    key: 'CAREER_GROWTH',
    label: 'Career Growth',
    cluster: 'Career',
    description: 'Trajectory, advancement, and sense of progression in one\'s career — stagnation vs. momentum.',
    color: '#92400E',
  },
  {
    // WC-3 reconciled key: present in wc3_outcome_models (career_clarity,
    // employability_readiness) + intervention_library; registered here so it can
    // MATCH a runtime session.
    key: 'CAREER_READINESS',
    label: 'Career Readiness',
    cluster: 'Career',
    description: 'Preparedness to enter and succeed in the workforce — applied skills, job-search capability, and transition readiness.',
    color: '#A16207',
  },

  // ─── Family & Environment ────────────────────────────────────────────────
  {
    key: 'FAMILY_DYNAMICS',
    label: 'Family Dynamics',
    cluster: 'Family & Environment',
    description: 'Quality of family communication, parenting patterns, and home environment.',
    color: '#78716C',
  },
];

// Fast lookup map: construct key → construct object
export const CONSTRUCT_MAP: Record<string, BehaviouralConstruct> = Object.fromEntries(
  CONSTRUCTS.map(c => [c.key, c])
);

// Canonicalises an arbitrary construct key string for storage. Returns the
// canonical UPPER_SNAKE form if (and only if) the input maps to a registered
// CONSTRUCT_MAP entry. Returns null for unknown/invalid keys — callers MUST
// treat null as "no anchor" rather than persisting garbage values.
//
// Used by CAPADEX reverse-weighting prerequisites (Phase 1) to guarantee
// that `capadex_sessions.primary_construct_key` and
// `capadex_responses.concern_bucket` only ever hold canonical registry keys.
// This is what makes the planned Phase 2 per-bucket aggregation joinable
// against ontology edges without case-sensitivity surprises.
export function canonicalizeConstructKey(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Try as-is, uppercase, and uppercased-with-spaces-to-underscores (covers
  // most variants `detectCategory` or external callers can emit).
  const candidates = new Set<string>([
    trimmed,
    trimmed.toUpperCase(),
    trimmed.toUpperCase().replace(/[\s-]+/g, '_'),
  ]);
  for (const c of candidates) {
    if (CONSTRUCT_MAP[c]) return c;
  }
  return null;
}

// ─── Concern-to-Construct Mapping ────────────────────────────────────────────
// Maps concern area strings (lowercase, trimmed) → construct key.
// Covers all 160 canonical concern areas + common text variants.

export const CONCERN_TO_CONSTRUCT: Record<string, string> = {
  // ── Focus (1-10) ──────────────────────────────────────────────────────────
  'short attention span':                        'ATTENTION_REGULATION',
  'easily distracted':                           'ATTENTION_REGULATION',
  'screen distraction':                          'DIGITAL_DEPENDENCY',
  'inconsistent concentration':                  'ATTENTION_REGULATION',
  'difficulty completing tasks':                 'ATTENTION_REGULATION',
  'daydreaming':                                 'ATTENTION_REGULATION',
  'lack of mental stamina':                      'ATTENTION_REGULATION',
  'avoidance of difficult tasks':                'PROCRASTINATION',
  'no deep work ability':                        'ATTENTION_REGULATION',
  'over multitasking':                           'ATTENTION_REGULATION',

  // ── Academics (11-20) ─────────────────────────────────────────────────────
  'low marks':                                   'EXAM_PERFORMANCE',
  'sudden drop in performance':                  'EXAM_PERFORMANCE',
  'inconsistent results':                        'EXAM_PERFORMANCE',
  'exam fear':                                   'ANXIETY',
  'poor writing skills':                         'EXAM_READINESS',
  'slow writing speed':                          'EXAM_READINESS',
  'weak subject foundation':                     'LEARNING_APPROACH',
  'weak foundation in core subjects':            'LEARNING_APPROACH',
  'difficulty in math/science':                  'LEARNING_APPROACH',
  'rote learning dependency':                    'LEARNING_APPROACH',
  'homework resistance':                         'PROCRASTINATION',

  // ── Behavior (21-30) ──────────────────────────────────────────────────────
  'procrastination':                             'PROCRASTINATION',
  'lack of discipline':                          'IMPULSE_CONTROL',
  'irregular study habits':                      'HABIT_FORMATION',
  'no goal setting':                             'GOAL_ORIENTATION',
  'easily gives up':                             'RESILIENCE',
  'dependency on parents':                       'IMPULSE_CONTROL',
  'disorganized lifestyle':                      'EXECUTIVE_FUNCTION',
  'poor time management':                        'EXECUTIVE_FUNCTION',
  'avoidance behavior':                          'PROCRASTINATION',
  'lack of responsibility':                      'GOAL_ORIENTATION',

  // ── Emotional (31-40) ─────────────────────────────────────────────────────
  'low confidence':                              'SELF_ESTEEM',
  'fear of failure':                             'ANXIETY',
  'anxiety':                                     'ANXIETY',
  'mood swings':                                 'EMOTIONAL_REGULATION',
  'overthinking':                                'STRESS_MANAGEMENT',
  'stress':                                      'STRESS_MANAGEMENT',
  'negative thinking':                           'STRESS_MANAGEMENT',
  'fear of judgment':                            'ANXIETY',
  'comparison stress':                           'SELF_ESTEEM',
  'emotional sensitivity':                       'EMOTIONAL_REGULATION',

  // ── Mental Health (41-50) ─────────────────────────────────────────────────
  'test anxiety':                                'ANXIETY',
  'social anxiety':                              'ANXIETY',
  'lack of motivation':                          'INTRINSIC_MOTIVATION',
  'burnout':                                     'STRESS_MANAGEMENT',
  'low self-esteem':                             'SELF_ESTEEM',
  'emotional regulation issues':                 'EMOTIONAL_REGULATION',
  'withdrawal behavior':                         'MENTAL_HEALTH',
  'fear of speaking':                            'COMMUNICATION',
  'pressure from expectations':                  'STRESS_MANAGEMENT',
  'lack of mental resilience':                   'RESILIENCE',

  // ── Digital (51-60) ───────────────────────────────────────────────────────
  'screen addiction':                            'DIGITAL_DEPENDENCY',
  'gaming addiction':                            'DIGITAL_DEPENDENCY',
  'social media overuse':                        'DIGITAL_DEPENDENCY',
  'youtube addiction':                           'DIGITAL_DEPENDENCY',
  'late-night phone use':                        'DIGITAL_DISCIPLINE',
  'dopamine dependency':                         'DIGITAL_DEPENDENCY',
  'reduced offline engagement':                  'DIGITAL_DISCIPLINE',
  'academic neglect due to phone':               'DIGITAL_DISCIPLINE',
  'multitasking with devices':                   'DIGITAL_DISCIPLINE',
  'lack of digital discipline':                  'DIGITAL_DISCIPLINE',

  // ── Social (61-70) ────────────────────────────────────────────────────────
  'poor communication':                          'COMMUNICATION',
  'shyness':                                     'SOCIAL_CONFIDENCE',
  'lack of friends':                             'PEER_RELATIONS',
  'peer pressure':                               'PEER_RELATIONS',
  'conflict with peers':                         'PEER_RELATIONS',
  'poor listening skills':                       'COMMUNICATION',
  'low participation in class':                  'SOCIAL_CONFIDENCE',
  'fear of public speaking':                     'COMMUNICATION',
  'lack of teamwork':                            'PEER_RELATIONS',
  'social comparison':                           'SELF_ESTEEM',

  // ── Habits (71-80) ────────────────────────────────────────────────────────
  'poor sleep routine':                          'PHYSICAL_WELLBEING',
  'lack of physical activity':                   'PHYSICAL_WELLBEING',
  'poor diet habits':                            'PHYSICAL_WELLBEING',
  'no structured routine':                       'EXECUTIVE_FUNCTION',
  'lack of consistency':                         'HABIT_FORMATION',
  'low discipline':                              'IMPULSE_CONTROL',
  'poor hygiene':                                'PHYSICAL_WELLBEING',
  'lack of productivity habits':                 'EXECUTIVE_FUNCTION',
  'no habit formation':                          'HABIT_FORMATION',
  'irregular energy cycles':                     'PHYSICAL_WELLBEING',

  // ── Career (81-90) ────────────────────────────────────────────────────────
  'no career clarity':                           'CAREER_CLARITY',
  'too many interests':                          'CAREER_CLARITY',
  'external influence':                          'CAREER_CLARITY',
  'lack of exposure':                            'SKILL_AWARENESS',
  'unrealistic goals':                           'CAREER_CLARITY',
  'no long-term planning':                       'GOAL_ORIENTATION',
  'fear of wrong choice':                        'ANXIETY',
  'lack of skill awareness':                     'SKILL_AWARENESS',
  'no guidance':                                 'CAREER_CLARITY',
  'misalignment with abilities':                 'SKILL_AWARENESS',

  // ── Career Growth & Progression ───────────────────────────────────────────
  'career growth & progression':                 'CAREER_GROWTH',
  'career growth and progression':               'CAREER_GROWTH',
  'career growth':                               'CAREER_GROWTH',
  'career advancement':                          'CAREER_GROWTH',
  'career progression':                          'CAREER_GROWTH',
  'career stagnation':                           'CAREER_GROWTH',
  'feeling stuck at work':                       'CAREER_GROWTH',
  'stuck in career':                             'CAREER_GROWTH',
  'no promotion':                                'CAREER_GROWTH',
  'not getting promoted':                        'CAREER_GROWTH',
  'career plateau':                              'CAREER_GROWTH',
  'lack of career advancement':                  'CAREER_GROWTH',
  'professional growth':                         'CAREER_GROWTH',
  'career switch':                               'CAREER_GROWTH',
  'career change':                               'CAREER_GROWTH',

  // ── Family (91-100) ───────────────────────────────────────────────────────
  'lack of communication':                       'FAMILY_DYNAMICS',
  'parent-child conflict':                       'FAMILY_DYNAMICS',
  'over-expectation':                            'FAMILY_DYNAMICS',
  'lack of guidance':                            'FAMILY_DYNAMICS',
  'comparison with siblings':                    'FAMILY_DYNAMICS',
  'lack of monitoring':                          'FAMILY_DYNAMICS',
  'emotional disconnect':                        'FAMILY_DYNAMICS',
  'over-dependence on tuition':                  'FAMILY_DYNAMICS',
  'confusion about child\'s ability':            'FAMILY_DYNAMICS',
  'confusion about child\u2019s ability':        'FAMILY_DYNAMICS',
  'fear about future':                           'ANXIETY',

  // ── Learning (101-103) ────────────────────────────────────────────────────
  'learning disabilities (dyslexia, adhd, dysgraphia)': 'LEARNING_APPROACH',
  'poor comprehension skills':                   'WORKING_MEMORY',
  'memory retention issues':                     'WORKING_MEMORY',

  // ── Cognitive (104-106) ───────────────────────────────────────────────────
  'low problem-solving ability':                 'CRITICAL_THINKING',
  'lack of critical thinking':                   'CRITICAL_THINKING',
  'slow processing speed':                       'PROCESSING_SPEED',

  // ── Emotional extended (107-108) ──────────────────────────────────────────
  'anger issues':                                'EMOTIONAL_REGULATION',
  'lack of emotional intelligence':              'EMOTIONAL_REGULATION',

  // ── Mental Health extended (109-110) ──────────────────────────────────────
  'early signs of depression':                   'MENTAL_HEALTH',
  'panic attacks':                               'ANXIETY',

  // ── Digital extended (111-112) ────────────────────────────────────────────
  'exposure to inappropriate content':           'SAFETY_THREATS',
  'cyberbullying':                               'SAFETY_THREATS',

  // ── Social extended (113-115) ─────────────────────────────────────────────
  'bullying (offline)':                          'SAFETY_THREATS',
  'lack of assertiveness':                       'SOCIAL_CONFIDENCE',
  'influence of wrong peer group':               'PEER_RELATIONS',

  // ── Habits extended (116-117) ─────────────────────────────────────────────
  'addiction tendencies (beyond screens)':       'IMPULSE_CONTROL',
  'lack of self-control':                        'IMPULSE_CONTROL',

  // ── Career extended (118-120) ─────────────────────────────────────────────
  'lack of real-world skills':                   'SKILL_AWARENESS',
  'skill vs marks mismatch':                     'SKILL_AWARENESS',
  'fear of competition':                         'ANXIETY',

  // ── Parenting (121-124) ───────────────────────────────────────────────────
  'inconsistent parenting approach':             'FAMILY_DYNAMICS',
  'lack of parenting skills':                    'FAMILY_DYNAMICS',
  'overprotection':                              'FAMILY_DYNAMICS',
  'lack of boundaries':                          'FAMILY_DYNAMICS',

  // ── Environment (125-126) ─────────────────────────────────────────────────
  'school mismatch':                             'FAMILY_DYNAMICS',
  'academic pressure from school':               'STRESS_MANAGEMENT',

  // ── Health (127-128) ──────────────────────────────────────────────────────
  'frequent fatigue':                            'PHYSICAL_WELLBEING',
  'hormonal/teen changes impact':                'PHYSICAL_WELLBEING',

  // ── Future Skills (129-130) ───────────────────────────────────────────────
  'lack of creativity':                          'CREATIVITY',
  'lack of curiosity':                           'LEARNING_DRIVE',

  // ── Board Exams (131-145) ─────────────────────────────────────────────────
  'failure in board exams':                      'EXAM_PERFORMANCE',
  'compartment exam stress':                     'EXAM_PERFORMANCE',
  'low board percentage':                        'EXAM_PERFORMANCE',
  'unexpected poor results':                     'EXAM_PERFORMANCE',
  'exam performance vs preparation mismatch':    'EXAM_READINESS',
  'time mismanagement in board exam':            'EXAM_READINESS',
  'poor answer presentation':                    'EXAM_READINESS',
  'weak exam strategy':                          'EXAM_READINESS',
  'panic during board exam':                     'ANXIETY',
  'lack of revision strategy':                   'EXAM_READINESS',
  'syllabus completion gaps':                    'EXAM_READINESS',
  'overconfidence before exam':                  'RESILIENCE',
  'burnout before boards':                       'STRESS_MANAGEMENT',
  'external pressure (family/society)':          'STRESS_MANAGEMENT',
  'comparison after results':                    'SELF_ESTEEM',

  // ── Betterment (146-160) ──────────────────────────────────────────────────
  'lack of clarity about betterment exams':      'ACADEMIC_RECOVERY',
  'fear of repeating failure':                   'ANXIETY',
  'no strategy for improvement exam':            'ACADEMIC_RECOVERY',
  'time gap misuse':                             'ACADEMIC_RECOVERY',
  'lack of structured re-preparation':           'ACADEMIC_RECOVERY',
  'concept gaps not fixed':                      'ACADEMIC_RECOVERY',
  'psychological setback after failure':         'RESILIENCE',
  'social stigma of failure':                    'SELF_ESTEEM',
  'lack of motivation to retry':                 'INTRINSIC_MOTIVATION',
  'wrong study strategy repetition':             'ACADEMIC_RECOVERY',
  'lack of mentorship/guidance':                 'ACADEMIC_RECOVERY',
  'fear of career delay':                        'ANXIETY',
  'college admission uncertainty':               'ACADEMIC_RECOVERY',
  'peer progression pressure':                   'SELF_ESTEEM',
  'emotional recovery after failure':            'RESILIENCE',
};

/**
 * Look up the construct for a concern area string.
 * Returns the construct object or undefined if no match.
 */
/**
 * Normalise a concern area string before map lookup.
 * Converts to lowercase, trims whitespace, and collapses Unicode typographic
 * apostrophes/quotes to their plain ASCII equivalents so that strings coming
 * from the database (which may contain curly quotes) always hit the map.
 */
export function normalizeConcernKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"');  // curly double quotes → straight
}

export function lookupConstruct(concernArea: string): BehaviouralConstruct | undefined {
  const key = CONCERN_TO_CONSTRUCT[normalizeConcernKey(concernArea)];
  return key ? CONSTRUCT_MAP[key] : undefined;
}

/**
 * Derive a legacy category string from a construct key.
 * Used to keep backward-compatibility with the concern intelligence engine.
 */
export function constructToLegacyCategory(constructKey: string): string {
  const c = CONSTRUCT_MAP[constructKey];
  if (!c) return 'general';
  switch (c.cluster) {
    case 'Cognitive':         return 'academic';
    case 'Self-Regulation':   return 'behavioural';
    case 'Emotional':         return 'emotional';
    case 'Mental Wellbeing':  return 'emotional';
    case 'Motivation':        return 'behavioural';
    case 'Social':            return 'social';
    case 'Digital':           return 'digital';
    case 'Academic':          return 'academic';
    case 'Career':            return 'career';
    case 'Family & Environment': return 'social';
    default:                  return 'general';
  }
}

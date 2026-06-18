/**
 * Bridge-tag resolver — SINGLE SOURCE OF TRUTH (extracted 2026-05-31).
 *
 * Clarity questions are authored against only 56 canonical `master_bridge_tag`
 * buckets, but concerns carry 328 finer-grained `relational_bridge_tag` values.
 * The picker joins clarity.master_bridge_tag = concern.relational_bridge_tag, so
 * the 272 tags with no clarity rows dead-end unless remapped. `resolveCoveredBridgeTag`
 * maps EVERY orphan tag to its closest covered bucket so no concern loses curated
 * coverage. Resolution order:
 *   1. tag is itself covered             → use as-is        (route: covered_self)
 *   2. explicit override (hand-verified) → use override     (route: override)
 *   3. first matching keyword rule       → use rule target  (route: keyword)
 *   4. ultimate fallback                 → GENERAL_CONCERN   (route: general)
 * Every target is a confirmed member of COVERED_BRIDGE_TAGS.
 *
 * This module is imported by both the production picker
 * (`routes/capadex-concern-intelligence.ts`) and the read-only coverage tooling
 * (`services/coverage-registry-service.ts`) so the two can never drift.
 */

// The 56 bridge tags that actually carry curated clarity questions.
export const COVERED_BRIDGE_TAGS = new Set<string>([
  'EMOTIONAL_REGULATION','COMPETENCY_DEVELOPMENT','EMPLOYABILITY','SOCIAL_EMOTIONAL',
  'DISCIPLINE_HABITS','CAREER_GROWTH','CAREER_READINESS','EMOTIONAL_RECOVERY',
  'CONFIDENCE_SELF','HOLISTIC_DEVELOPMENT','WORKPLACE_ADAPTATION','MOTIVATION_VALUES',
  'ADJUSTMENT_COPING','THINKING_QUALITY','ACADEMIC_COGNITIVE','EXAMINATION_STRESS',
  'STRATEGIC_PREPARATION','LEADERSHIP_OWNERSHIP','LEARNING_ADAPTABILITY','LIFESTYLE_PRESSURE',
  'SELF_REFLECTION','ACADEMIC_IDENTITY','CONFIDENCE_DEVELOPMENT','COMMUNICATION_EXPRESSION',
  'LONG_TERM','GENERAL_CONCERN','CAREER_PSYCHOLOGY','PERSONAL_VISION','STEM_LEARNING',
  'CAREER_EXPECTATIONS','ADAPTIVE_LEADERSHIP','CAREER_IDENTITY','PERFORMANCE_REFLECTION',
  'ACADEMIC_TRANSITION','CONFIDENCE_BUILDING','LEARNING_DEPENDENCY','CAREER_EXPOSURE',
  'CLASSROOM_ENGAGEMENT','COMPETENCY_INTELLIGENCE','OVER_COMPLIANCE','COMPETITIVE_EXAM',
  'SELF_PERCEPTION','EMOTIONAL_IDENTITY','WORKPLACE_FIT','STUDENT_SUCCESS',
  'TRANSITION_READINESS','HIGHER_EDUCATION','IDENTITY_INTEGRATION','INSTRUCTIONAL_QUALITY',
  'LEADERSHIP_INFLUENCE','FUTURE_LEARNING','LEADERSHIP_READINESS','FOUNDATIONAL_LEARNING',
  'LEARNING_AWARENESS','LEARNING_QUALITY','MULTI_POTENTIALITY',
]);

export const GENERAL_FALLBACK_TAG = 'GENERAL_CONCERN';

// Hand-verified overrides where the keyword rules below would mis-route or not
// match at all. Keys are UPPER-cased bridge tags; every value is a member of
// COVERED_BRIDGE_TAGS.
//
// The block marked "2026-05-31" eliminates GENERAL_CONCERN reliance for the 31
// orphan tags (36 concerns) that previously fell through every keyword rule to
// the generic catch-all. Each target is the closest covered sibling bucket, so
// users get topically-relevant curated questions instead of generic ones.
export const ORPHAN_BRIDGE_TAG_FALLBACK: Record<string, string> = {
  // ── 2026-06-01: stop a student focus concern routing to career questions ──
  // `LEARNING_INTERVENTION` (the only concern on it is "Poor concentration
  // during classes", a student/academic focus issue) has ZERO clarity rows, so
  // it falls to the keyword rules — where the greedy /LEARNING|LEARNER/ rule
  // would map it to LEARNING_ADAPTABILITY, whose curated questions are
  // adult career/industry-adaptability ("adapting professionally", "industry
  // trends", "career stagnation"). That leaked career questions to a 10-year-old
  // (the family-level age gate can't catch it: LEARNING_ADAPTABILITY's master
  // rows are coincidentally student-aged). DISCIPLINE_HABITS is the correct
  // sibling — it carries the in-class attention/focus inventory ("Students
  // Unable to Sustain Attention in Class", "Difficulty Maintaining Focus During
  // Long Study Hours") and its master family overlaps young learners.
  LEARNING_INTERVENTION:      'DISCIPLINE_HABITS',
  CAREER_TRANSITION:          'CAREER_GROWTH',
  EXAMINATION_READINESS:      'EXAMINATION_STRESS',
  COLLABORATION_OWNERSHIP:    'LEADERSHIP_OWNERSHIP',
  STRATEGIC_LEADERSHIP:       'ADAPTIVE_LEADERSHIP',
  ADAPTIVE_LEARNING:          'LEARNING_ADAPTABILITY',
  INTERDISCIPLINARY_LEARNING: 'LEARNING_ADAPTABILITY',
  WORKPLACE_PERFORMANCE:      'WORKPLACE_ADAPTATION',
  ACADEMIC_PERFORMANCE:       'ACADEMIC_COGNITIVE',
  HELP_SEEKING:               'ADJUSTMENT_COPING',
  INQUIRY_CURIOSITY:          'THINKING_QUALITY',

  // ── 2026-05-31: retire GENERAL_CONCERN for these orphan tags ──────────────
  PERSONAL_EFFECTIVENESS:     'DISCIPLINE_HABITS',
  PERSONAL_INSIGHT:           'SELF_REFLECTION',
  FUTURE_ORIENTATION:         'PERSONAL_VISION',
  FINANCIAL_READINESS:        'CAREER_READINESS',
  VALUES_EXPLORATION:         'MOTIVATION_VALUES',
  VALUES_BASED:               'MOTIVATION_VALUES',
  PSYCHOLOGICAL_ADAPTATION:   'ADJUSTMENT_COPING',
  PERSONAL_POSITIONING:       'SELF_PERCEPTION',
  PERSONAL_EXPANSION:         'HOLISTIC_DEVELOPMENT',
  PERSONAL_BRANDING:          'CAREER_IDENTITY',
  PERFORMANCE_RESILIENCE:     'EMOTIONAL_REGULATION',
  PERFORMANCE_COACHING:       'PERFORMANCE_REFLECTION',
  PERFORMANCE_BEHAVIOR:       'DISCIPLINE_HABITS',
  PERFORMANCE_ANALYSIS:       'PERFORMANCE_REFLECTION',
  OWNERSHIP_ACCOUNTABILITY:   'LEADERSHIP_OWNERSHIP',
  LIFE_READINESS:             'TRANSITION_READINESS',
  INTERVENTION_INTELLIGENCE:  'STUDENT_SUCCESS',
  FEEDBACK_ADAPTATION:        'PERFORMANCE_REFLECTION',
  EXPLORATION_INHIBITION:     'CONFIDENCE_SELF',
  ENGAGEMENT_BEHAVIOR:        'CLASSROOM_ENGAGEMENT',
  COMPETITIVE_ADAPTATION:     'ADJUSTMENT_COPING',
  COLLEGE_ADAPTATION:         'ACADEMIC_TRANSITION',
  COGNITIVE_MAPPING:          'LEARNING_AWARENESS',
  COGNITIVE_AWARENESS:        'THINKING_QUALITY',
  BEHAVIOR_CORRECTION:        'DISCIPLINE_HABITS',
  BEHAVIORAL_REGULATION:      'DISCIPLINE_HABITS',
  BEHAVIORAL_AWARENESS:       'SELF_REFLECTION',
  ASSESSMENT_INTELLIGENCE:    'INSTRUCTIONAL_QUALITY',
  ADAPTIVE_DIAGNOSTICS:       'INSTRUCTIONAL_QUALITY',
  ADAPTABILITY_GUIDANCE:      'LEARNING_ADAPTABILITY',
  ADAPTABILITY_COACHING:      'LEARNING_ADAPTABILITY',
};

// Prioritised keyword rules — first hit wins, so order runs most-specific to
// most-generic. Every target is a member of COVERED_BRIDGE_TAGS.
export const BRIDGE_TAG_KEYWORD_RULES: Array<[RegExp, string]> = [
  [/EXAM|EXAMINATION/,                                                             'EXAMINATION_STRESS'],
  [/EMPLOY/,                                                                       'EMPLOYABILITY'],
  [/FACULTY|TEACHING|INSTRUCTION|PEDAGOG/,                                         'INSTRUCTIONAL_QUALITY'],
  [/CLASSROOM/,                                                                    'CLASSROOM_ENGAGEMENT'],
  [/LEADERSHIP|MANAGEMENT|TEAM|COLLABORAT|STRATEGIC|ORGANI[SZ]ATION|STAKEHOLDER/,  'LEADERSHIP_OWNERSHIP'],
  [/WORKPLACE|WORKFORCE|PLACEMENT/,                                                'WORKPLACE_ADAPTATION'],
  [/ANXIETY|STRESS|EMOTION|WELLNESS|WELLBEING|RECOVERY|STABILITY|MATURITY/,        'EMOTIONAL_REGULATION'],
  [/VOCATION|ENTREPRENEUR|INNOVATION/,                                             'CAREER_READINESS'],
  [/CAREER/,                                                                       'CAREER_READINESS'],
  [/INQUIRY|CURIOSITY|ANALYTIC|THINKING|PROBLEM|DECISION|REFLECT/,                 'THINKING_QUALITY'],
  [/ACADEMIC|SUBJECT|STEM|STUDY/,                                                  'ACADEMIC_COGNITIVE'],
  [/LEARNING|LEARNER/,                                                             'LEARNING_ADAPTABILITY'],
  [/SKILL|COMPETENC|CAPABILIT|TALENT|POTENTIAL|STRENGTH/,                          'COMPETENCY_DEVELOPMENT'],
  [/COMMUNICAT|EXPRESSION/,                                                        'COMMUNICATION_EXPRESSION'],
  [/SOCIAL|PEER|RELATIONSHIP|PARENT/,                                              'SOCIAL_EMOTIONAL'],
  [/MOTIVAT|PURPOSE|GOAL|ASPIRATION|VISION|PERSEVERANCE|GRIT/,                     'MOTIVATION_VALUES'],
  [/DISCIPLINE|HABIT|PRODUCTIVITY|ROUTINE|DIGITAL|TIME/,                           'DISCIPLINE_HABITS'],
  [/CONFIDENCE/,                                                                   'CONFIDENCE_SELF'],
  [/PERSONALITY|IDENTITY|SELF/,                                                    'SELF_PERCEPTION'],
  [/STUDENT/,                                                                      'STUDENT_SUCCESS'],
  [/TRANSITION|CHANGE/,                                                            'TRANSITION_READINESS'],
  [/DEVELOPMENT|GROWTH/,                                                           'HOLISTIC_DEVELOPMENT'],
  [/COPING|ADJUSTMENT/,                                                            'ADJUSTMENT_COPING'],
  [/LIFESTYLE|SUSTAINABILITY|BALANCE/,                                             'LIFESTYLE_PRESSURE'],
];

export type BridgeTagRoute = 'covered_self' | 'override' | 'keyword' | 'general' | 'none';

export interface BridgeTagResolution {
  target: string | null;
  route: BridgeTagRoute;
}

/**
 * Classify how a bridge tag resolves AND by which route. Mirrors
 * `resolveCoveredBridgeTag` exactly so the coverage tooling reports the true
 * runtime path. `route` is the tier that produced the target.
 */
export function classifyBridgeTagRoute(tag: string | null | undefined): BridgeTagResolution {
  const up = String(tag || '').toUpperCase().trim();
  if (!up) return { target: null, route: 'none' };
  if (COVERED_BRIDGE_TAGS.has(up)) return { target: up, route: 'covered_self' };
  const override = ORPHAN_BRIDGE_TAG_FALLBACK[up];
  if (override && COVERED_BRIDGE_TAGS.has(override)) return { target: override, route: 'override' };
  for (const [re, target] of BRIDGE_TAG_KEYWORD_RULES) {
    if (re.test(up) && COVERED_BRIDGE_TAGS.has(target)) return { target, route: 'keyword' };
  }
  if (COVERED_BRIDGE_TAGS.has(GENERAL_FALLBACK_TAG)) return { target: GENERAL_FALLBACK_TAG, route: 'general' };
  return { target: null, route: 'none' };
}

// Resolve any concern bridge tag to a covered clarity bucket (see block above).
// Returns null only if GENERAL_CONCERN itself is somehow absent (it isn't).
export function resolveCoveredBridgeTag(tag: string | null | undefined): string | null {
  return classifyBridgeTagRoute(tag).target;
}

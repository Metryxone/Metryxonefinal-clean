/**
   * CAPADEX L5C — Bridge Tag → Construct Crosswalk (deterministic, hand-verified).
   *
   * PURPOSE: the clarity question bank (30,638 questions, 325 distinct master_bridge_tag
   * values) had NO existing path to the 36-key behavioural construct registry — the only
   * concern→construct map (CONCERN_TO_CONSTRUCT, short-assessment keys) resolved just
   * 0.3% of clarity questions. This crosswalk supplies the missing
   * bridge_tag → construct hop so Outcome Projection can traverse the clarity bank.
   *
   * STATUS: ADDITIVE + INERT. This module is imported ONLY by the L5C measurement /
   * audit tooling. It is NOT wired into any runtime selection / scoring / projection
   * path. Wiring is a separate, approval-gated phase.
   *
   * GROUNDING / DISCIPLINE:
   *  - Targets are ONLY existing registry constructs (backend/data/behavioural-constructs.ts).
   *    No new constructs, signals, outcome models, or ontology are introduced.
   *  - status === 'HIGH_CONFIDENCE': one clear construct (exact-override or single
   *    substantive token / same-cluster tokens). Auto-projectable.
   *  - status === 'REVIEW_REQUIRED': multiple plausible constructs (`candidates`); NOT
   *    auto-mapped — needs human disambiguation before projection.
   *  - status === 'UNMAPPED': no single behavioural construct exists for the tag
   *    (institutional / operational / holistic). NOT forced — an honest coverage gap.
   *
   * Frequency-weighted coverage (n=30638): HIGH 67.5% ·
   * REVIEW 18.2% · UNMAPPED 14.4%.
   * See backend/audit/l5c/ for the full reports.
   */

  export type CrosswalkStatus = 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'UNMAPPED';

  export interface CrosswalkEntry {
    /** Canonical registry construct key, or null for REVIEW_REQUIRED / UNMAPPED. */
    construct: string | null;
    status: CrosswalkStatus;
    /** 0..1 — authoring confidence (0 for UNMAPPED). */
    confidence: number;
    /** Human-readable, traceable derivation of the decision. */
    reason: string;
    /** For REVIEW_REQUIRED: the plausible constructs a human must choose between. */
    candidates?: string[];
  }

  export const BRIDGE_TAG_CONSTRUCT_CROSSWALK: Record<string, CrosswalkEntry> = {
  "ACADEMIC_BEHAVIOR": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_CAREER": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | CAREER_CLARITY",
    "candidates": [
      "LEARNING_APPROACH",
      "CAREER_CLARITY"
    ]
  },
  "ACADEMIC_COGNITIVE": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | CRITICAL_THINKING",
    "candidates": [
      "LEARNING_APPROACH",
      "CRITICAL_THINKING"
    ]
  },
  "ACADEMIC_COUNSELLING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_DECISION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | CRITICAL_THINKING",
    "candidates": [
      "LEARNING_APPROACH",
      "CRITICAL_THINKING"
    ]
  },
  "ACADEMIC_EQUITY": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_GROWTH": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_IDENTITY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | SELF_ESTEEM",
    "candidates": [
      "LEARNING_APPROACH",
      "SELF_ESTEEM"
    ]
  },
  "ACADEMIC_OPERATIONS": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_PERFORMANCE": {
    "construct": "EXAM_PERFORMANCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_PERFORMANCE"
  },
  "ACADEMIC_PLANNING": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | EXECUTIVE_FUNCTION",
    "candidates": [
      "LEARNING_APPROACH",
      "EXECUTIVE_FUNCTION"
    ]
  },
  "ACADEMIC_READINESS": {
    "construct": "EXAM_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_READINESS"
  },
  "ACADEMIC_REFLECTION": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_RISK": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ACADEMIC → LEARNING_APPROACH"
  },
  "ACADEMIC_TRANSITION": {
    "construct": "COLLEGE_ADAPT",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → COLLEGE_ADAPT"
  },
  "ACCOUNTABILITY_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ACCOUNTABILITY,DEVELOPMENT]"
  },
  "ACCOUNTABILITY_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ACCOUNTABILITY,REFLECTION]"
  },
  "ADAPTABILITY_COACHING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ADAPTABILITY,COACHING]"
  },
  "ADAPTABILITY_GUIDANCE": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ADAPTABILITY,GUIDANCE]"
  },
  "ADAPTIVE_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ADAPTIVE,DEVELOPMENT]"
  },
  "ADAPTIVE_DIAGNOSTICS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ADAPTIVE,DIAGNOSTICS]"
  },
  "ADAPTIVE_GROWTH": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ADAPTIVE,GROWTH]"
  },
  "ADAPTIVE_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "ADAPTIVE_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "ADAPTIVE_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ADAPTIVE,REFLECTION]"
  },
  "ADJUSTMENT_COPING": {
    "construct": "STRESS_MANAGEMENT",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COPING → STRESS_MANAGEMENT"
  },
  "ALTERNATIVE_CAREER": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "ANALYTICAL_DEVELOPMENT": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ANALYTICAL → CRITICAL_THINKING"
  },
  "ASPIRATIONAL_CLARITY": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ASPIRATIONAL → GOAL_ORIENTATION"
  },
  "ASPIRATIONAL_DEVELOPMENT": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ASPIRATIONAL → GOAL_ORIENTATION"
  },
  "ASSESSMENT_INTELLIGENCE": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ASSESSMENT,INTELLIGENCE]"
  },
  "ATTENTION_REFLECTION": {
    "construct": "ATTENTION_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ATTENTION → ATTENTION_REGULATION"
  },
  "BALANCED_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [BALANCED,REFLECTION]"
  },
  "BEHAVIOR_CORRECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [BEHAVIOR,CORRECTION]"
  },
  "BEHAVIORAL_AWARENESS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme AWARENESS → CRITICAL_THINKING/SELF_ESTEEM",
    "candidates": [
      "CRITICAL_THINKING",
      "SELF_ESTEEM"
    ]
  },
  "BEHAVIORAL_GROWTH": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [BEHAVIORAL,GROWTH]"
  },
  "BEHAVIORAL_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [BEHAVIORAL,REFLECTION]"
  },
  "BEHAVIORAL_REGULATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme REGULATION → IMPULSE_CONTROL/EMOTIONAL_REGULATION/EXECUTIVE_FUNCTION",
    "candidates": [
      "IMPULSE_CONTROL",
      "EMOTIONAL_REGULATION",
      "EXECUTIVE_FUNCTION"
    ]
  },
  "BEHAVIORAL_STABILITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [BEHAVIORAL,STABILITY]"
  },
  "CAPABILITY_DEVELOPMENT": {
    "construct": "SKILL_AWARENESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAPABILITY → SKILL_AWARENESS"
  },
  "CAREER_ACADEMIC": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_CLARITY | LEARNING_APPROACH",
    "candidates": [
      "CAREER_CLARITY",
      "LEARNING_APPROACH"
    ]
  },
  "CAREER_ALIGNMENT": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_AUTONOMY": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_BRANDING": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_COMPETITION": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_DECISION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_CLARITY | CRITICAL_THINKING",
    "candidates": [
      "CAREER_CLARITY",
      "CRITICAL_THINKING"
    ]
  },
  "CAREER_DEVELOPMENT": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_ECOSYSTEM": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_EXECUTION": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_EXPECTATIONS": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_EXPLORATION": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_EXPOSURE": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_FLEXIBILITY": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_GROWTH": {
    "construct": "CAREER_GROWTH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → CAREER_GROWTH"
  },
  "CAREER_GUIDANCE": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_IDENTITY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_CLARITY | SELF_ESTEEM",
    "candidates": [
      "CAREER_CLARITY",
      "SELF_ESTEEM"
    ]
  },
  "CAREER_MAPPING": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_PLANNING": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_CLARITY | EXECUTIVE_FUNCTION",
    "candidates": [
      "CAREER_CLARITY",
      "EXECUTIVE_FUNCTION"
    ]
  },
  "CAREER_PREPAREDNESS": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_PRIORITIZATION": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_PSYCHOLOGY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_CLARITY | MENTAL_HEALTH",
    "candidates": [
      "CAREER_CLARITY",
      "MENTAL_HEALTH"
    ]
  },
  "CAREER_READINESS": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → CAREER_READINESS"
  },
  "CAREER_RECOVERY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_CLARITY | RESILIENCE",
    "candidates": [
      "CAREER_CLARITY",
      "RESILIENCE"
    ]
  },
  "CAREER_REFLECTION": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_RISK": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_STABILITY": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_SUITABILITY": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_SUSTAINABILITY": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_TIMELINE": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_TRADEOFF": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CAREER_TRANSITION": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "CHARACTER_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [CHARACTER,DEVELOPMENT]"
  },
  "CLASSROOM_ADAPTATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [CLASSROOM,ADAPTATION]"
  },
  "CLASSROOM_ENGAGEMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [CLASSROOM,ENGAGEMENT]"
  },
  "COGNITIVE_AWARENESS": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COGNITIVE → CRITICAL_THINKING"
  },
  "COGNITIVE_DEVELOPMENT": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COGNITIVE → CRITICAL_THINKING"
  },
  "COGNITIVE_EMOTIONAL": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CRITICAL_THINKING | EMOTIONAL_REGULATION",
    "candidates": [
      "CRITICAL_THINKING",
      "EMOTIONAL_REGULATION"
    ]
  },
  "COGNITIVE_MAPPING": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COGNITIVE → CRITICAL_THINKING"
  },
  "COGNITIVE_REFLECTION": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COGNITIVE → CRITICAL_THINKING"
  },
  "COGNITIVE_SELF": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COGNITIVE → CRITICAL_THINKING"
  },
  "COGNITIVE_SKILLS": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COGNITIVE → CRITICAL_THINKING"
  },
  "COGNITIVE_WELLNESS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CRITICAL_THINKING | STRESS_MANAGEMENT",
    "candidates": [
      "CRITICAL_THINKING",
      "STRESS_MANAGEMENT"
    ]
  },
  "COLLABORATION_OWNERSHIP": {
    "construct": "PEER_RELATIONS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COLLABORATION → PEER_RELATIONS"
  },
  "COLLEGE_ADAPTATION": {
    "construct": "COLLEGE_ADAPT",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → COLLEGE_ADAPT"
  },
  "COMMUNICATION_BEHAVIOR": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COMMUNICATION → COMMUNICATION"
  },
  "COMMUNICATION_DEVELOPMENT": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COMMUNICATION → COMMUNICATION"
  },
  "COMMUNICATION_EXPRESSION": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → COMMUNICATION"
  },
  "COMMUNICATION_LEADERSHIP": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COMMUNICATION → COMMUNICATION"
  },
  "COMPETENCY_DEVELOPMENT": {
    "construct": "SKILL_AWARENESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COMPETENCY → SKILL_AWARENESS"
  },
  "COMPETENCY_INTELLIGENCE": {
    "construct": "SKILL_AWARENESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token COMPETENCY → SKILL_AWARENESS"
  },
  "COMPETITIVE_ADAPTATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [COMPETITIVE,ADAPTATION]"
  },
  "COMPETITIVE_EXAM": {
    "construct": "EXAM_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_READINESS"
  },
  "CONFIDENCE_BUILDING": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SELF_ESTEEM"
  },
  "CONFIDENCE_DEVELOPMENT": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SELF_ESTEEM"
  },
  "CONFIDENCE_SELF": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SELF_ESTEEM"
  },
  "DECISION_ANXIETY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CRITICAL_THINKING | ANXIETY",
    "candidates": [
      "CRITICAL_THINKING",
      "ANXIETY"
    ]
  },
  "DECISION_COACHING": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token DECISION → CRITICAL_THINKING"
  },
  "DECISION_CONFIDENCE": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CRITICAL_THINKING | SELF_ESTEEM",
    "candidates": [
      "CRITICAL_THINKING",
      "SELF_ESTEEM"
    ]
  },
  "DECISION_INDEPENDENCE": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token DECISION → CRITICAL_THINKING"
  },
  "DECISION_LEADERSHIP": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token DECISION → CRITICAL_THINKING"
  },
  "DIGITAL_LEARNING": {
    "construct": "DIGITAL_DISCIPLINE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → DIGITAL_DISCIPLINE"
  },
  "DIGITAL_RESPONSIBILITY": {
    "construct": "DIGITAL_DISCIPLINE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → DIGITAL_DISCIPLINE"
  },
  "DISCIPLINE_HABITS": {
    "construct": "HABIT_FORMATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → HABIT_FORMATION"
  },
  "EMOTIONAL_DEVELOPMENT": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_IDENTITY": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.8,
    "reason": "same-cluster EMOTIONAL+IDENTITY → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_LEADERSHIP": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_LEARNING": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: EMOTIONAL_REGULATION | LEARNING_APPROACH",
    "candidates": [
      "EMOTIONAL_REGULATION",
      "LEARNING_APPROACH"
    ]
  },
  "EMOTIONAL_LITERACY": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_MATURITY": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_RECOVERY": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → RESILIENCE"
  },
  "EMOTIONAL_REFLECTION": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_REGULATION": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_RESILIENCE": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → RESILIENCE"
  },
  "EMOTIONAL_RESPONSE": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_SELF": {
    "construct": "EMOTIONAL_REGULATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMOTIONAL → EMOTIONAL_REGULATION"
  },
  "EMOTIONAL_WELLBEING": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: EMOTIONAL_REGULATION | STRESS_MANAGEMENT",
    "candidates": [
      "EMOTIONAL_REGULATION",
      "STRESS_MANAGEMENT"
    ]
  },
  "EMPLOYABILITY": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMPLOYABILITY → CAREER_READINESS"
  },
  "EMPLOYABILITY_ACADEMIC": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: CAREER_READINESS | LEARNING_APPROACH",
    "candidates": [
      "CAREER_READINESS",
      "LEARNING_APPROACH"
    ]
  },
  "EMPLOYABILITY_DEVELOPMENT": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMPLOYABILITY → CAREER_READINESS"
  },
  "EMPLOYABILITY_FUTURE": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EMPLOYABILITY → CAREER_READINESS"
  },
  "ENGAGEMENT_BEHAVIOR": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ENGAGEMENT,BEHAVIOR]"
  },
  "ENGAGEMENT_MANAGEMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [ENGAGEMENT,MANAGEMENT]"
  },
  "ENTREPRENEURIAL_LEADERSHIP": {
    "construct": "CREATIVITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ENTREPRENEURIAL → CREATIVITY"
  },
  "ENTREPRENEURSHIP_GUIDANCE": {
    "construct": "CREATIVITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ENTREPRENEURSHIP → CREATIVITY"
  },
  "EXAM_READINESS": {
    "construct": "EXAM_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_READINESS"
  },
  "EXAMINATION_READINESS": {
    "construct": "EXAM_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_READINESS"
  },
  "EXAMINATION_STRESS": {
    "construct": "EXAM_STRESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_STRESS"
  },
  "EXECUTIVE_COMMUNICATION": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → COMMUNICATION"
  },
  "EXPLORATION_INHIBITION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [EXPLORATION,INHIBITION]"
  },
  "EXPLORATORY_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "FACULTY_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [FACULTY,DEVELOPMENT]"
  },
  "FACULTY_EFFECTIVENESS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [FACULTY,EFFECTIVENESS]"
  },
  "FACULTY_SUSTAINABILITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [FACULTY,SUSTAINABILITY]"
  },
  "FEEDBACK_ADAPTATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [FEEDBACK,ADAPTATION]"
  },
  "FINANCIAL_READINESS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [FINANCIAL,READINESS]"
  },
  "FOUNDATIONAL_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "FUTURE_CAREER": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "FUTURE_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "FUTURE_ORIENTATION": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.8,
    "reason": "exact-override: future orientation → GOAL_ORIENTATION"
  },
  "FUTURE_SELF": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "FUTURE_WORKFORCE": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token WORKFORCE → CAREER_READINESS"
  },
  "GENERAL_CONCERN": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GENERAL,CONCERN]"
  },
  "GOAL_ALIGNMENT": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token GOAL → GOAL_ORIENTATION"
  },
  "GOAL_REFLECTION": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token GOAL → GOAL_ORIENTATION"
  },
  "GROWTH_ACCOUNTABILITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,ACCOUNTABILITY]"
  },
  "GROWTH_BEHAVIOR": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,BEHAVIOR]"
  },
  "GROWTH_MAPPING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,MAPPING]"
  },
  "GROWTH_MEASUREMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,MEASUREMENT]"
  },
  "GROWTH_MENTORING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,MENTORING]"
  },
  "GROWTH_MINDSET": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme MINDSET → LEARNING_DRIVE/RESILIENCE",
    "candidates": [
      "LEARNING_DRIVE",
      "RESILIENCE"
    ]
  },
  "GROWTH_ORIENTATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,ORIENTATION]"
  },
  "GROWTH_PERSISTENCE": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PERSISTENCE → RESILIENCE"
  },
  "GROWTH_RECOGNITION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,RECOGNITION]"
  },
  "GROWTH_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,REFLECTION]"
  },
  "GROWTH_TRACKING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [GROWTH,TRACKING]"
  },
  "HABIT_DEVELOPMENT": {
    "construct": "HABIT_FORMATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → HABIT_FORMATION"
  },
  "HELP_SEEKING": {
    "construct": "SOCIAL_CONFIDENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SOCIAL_CONFIDENCE"
  },
  "HIGHER_EDUCATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [HIGHER,EDUCATION]"
  },
  "HOLISTIC_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [HOLISTIC,DEVELOPMENT]"
  },
  "IDENTITY_CONFIDENCE": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SELF_ESTEEM"
  },
  "IDENTITY_CONFLICT": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token IDENTITY → SELF_ESTEEM"
  },
  "IDENTITY_EXPRESSION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: SELF_ESTEEM | COMMUNICATION",
    "candidates": [
      "SELF_ESTEEM",
      "COMMUNICATION"
    ]
  },
  "IDENTITY_FORMATION": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token IDENTITY → SELF_ESTEEM"
  },
  "IDENTITY_INTEGRATION": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token IDENTITY → SELF_ESTEEM"
  },
  "IDENTITY_REFLECTION": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token IDENTITY → SELF_ESTEEM"
  },
  "INCLUSION_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "INCLUSIVE_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "INDEPENDENCE_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [INDEPENDENCE,DEVELOPMENT]"
  },
  "INNOVATION_ENTREPRENEURSHIP": {
    "construct": "CREATIVITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token INNOVATION+ENTREPRENEURSHIP → CREATIVITY"
  },
  "INNOVATION_READINESS": {
    "construct": "CREATIVITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token INNOVATION → CREATIVITY"
  },
  "INQUIRY_CURIOSITY": {
    "construct": "CREATIVITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token INQUIRY+CURIOSITY → CREATIVITY"
  },
  "INSTRUCTIONAL_QUALITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [INSTRUCTIONAL,QUALITY]"
  },
  "INTEGRITY_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [INTEGRITY,REFLECTION]"
  },
  "INTELLECTUAL_GROWTH": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token INTELLECTUAL → CRITICAL_THINKING"
  },
  "INTERDISCIPLINARY_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "INTERVENTION_INTELLIGENCE": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [INTERVENTION,INTELLIGENCE]"
  },
  "LANGUAGE_DEVELOPMENT": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LANGUAGE → COMMUNICATION"
  },
  "LEADERSHIP_ACCOUNTABILITY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_DEVELOPMENT": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_DYNAMICS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_ENDURANCE": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ENDURANCE → RESILIENCE"
  },
  "LEADERSHIP_FOUNDATIONS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_INFLUENCE": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_MATURITY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_OWNERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_READINESS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEADERSHIP_RECOVERY": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token RECOVERY → RESILIENCE"
  },
  "LEADERSHIP_TRANSITION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "LEARNING_ADAPTABILITY": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_AWARENESS": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_BEHAVIOR": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_DEPENDENCY": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_EFFECTIVENESS": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_INTERVENTION": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_MINDSET": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_OPTIMIZATION": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_PERSISTENCE": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | RESILIENCE",
    "candidates": [
      "LEARNING_APPROACH",
      "RESILIENCE"
    ]
  },
  "LEARNING_PSYCHOLOGY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: LEARNING_APPROACH | MENTAL_HEALTH",
    "candidates": [
      "LEARNING_APPROACH",
      "MENTAL_HEALTH"
    ]
  },
  "LEARNING_QUALITY": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_REFLECTION": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_SKILLS": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LEARNING_SUSTAINABILITY": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "LIFE_READINESS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [LIFE,READINESS]"
  },
  "LIFESTYLE_ADAPTATION": {
    "construct": "PHYSICAL_WELLBEING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LIFESTYLE → PHYSICAL_WELLBEING"
  },
  "LIFESTYLE_ADJUSTMENT": {
    "construct": "PHYSICAL_WELLBEING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LIFESTYLE → PHYSICAL_WELLBEING"
  },
  "LIFESTYLE_CAREER": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: PHYSICAL_WELLBEING | CAREER_CLARITY",
    "candidates": [
      "PHYSICAL_WELLBEING",
      "CAREER_CLARITY"
    ]
  },
  "LIFESTYLE_PRESSURE": {
    "construct": "PHYSICAL_WELLBEING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.8,
    "reason": "same-cluster LIFESTYLE+PRESSURE → PHYSICAL_WELLBEING"
  },
  "LONG_TERM": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [LONG,TERM]"
  },
  "MATURITY_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [MATURITY,DEVELOPMENT]"
  },
  "METACOGNITION_SELF": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token METACOGNITION → CRITICAL_THINKING"
  },
  "METACOGNITIVE_DEVELOPMENT": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token METACOGNITIVE → CRITICAL_THINKING"
  },
  "MOTIVATION_DEVELOPMENT": {
    "construct": "INTRINSIC_MOTIVATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token MOTIVATION → INTRINSIC_MOTIVATION"
  },
  "MOTIVATION_MAPPING": {
    "construct": "INTRINSIC_MOTIVATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token MOTIVATION → INTRINSIC_MOTIVATION"
  },
  "MOTIVATION_PSYCHOLOGY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: INTRINSIC_MOTIVATION | MENTAL_HEALTH",
    "candidates": [
      "INTRINSIC_MOTIVATION",
      "MENTAL_HEALTH"
    ]
  },
  "MOTIVATION_VALUES": {
    "construct": "INTRINSIC_MOTIVATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → INTRINSIC_MOTIVATION"
  },
  "MULTI_POTENTIALITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [MULTI,POTENTIALITY]"
  },
  "ORGANIZATIONAL_DEVELOPMENT": {
    "construct": "EXECUTIVE_FUNCTION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ORGANIZATIONAL → EXECUTIVE_FUNCTION"
  },
  "ORGANIZATIONAL_INTELLIGENCE": {
    "construct": "EXECUTIVE_FUNCTION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token ORGANIZATIONAL → EXECUTIVE_FUNCTION"
  },
  "OVER_COMPLIANCE": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [OVER,COMPLIANCE]"
  },
  "OWNERSHIP_ACCOUNTABILITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [OWNERSHIP,ACCOUNTABILITY]"
  },
  "PERFORMANCE_ANALYSIS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERFORMANCE,ANALYSIS]"
  },
  "PERFORMANCE_BEHAVIOR": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERFORMANCE,BEHAVIOR]"
  },
  "PERFORMANCE_COACHING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERFORMANCE,COACHING]"
  },
  "PERFORMANCE_REFLECTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERFORMANCE,REFLECTION]"
  },
  "PERFORMANCE_RESILIENCE": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → RESILIENCE"
  },
  "PERSEVERANCE_COACHING": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PERSEVERANCE → RESILIENCE"
  },
  "PERSISTENCE_DEVELOPMENT": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PERSISTENCE → RESILIENCE"
  },
  "PERSONAL_BRANDING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,BRANDING]"
  },
  "PERSONAL_DECISION": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token DECISION → CRITICAL_THINKING"
  },
  "PERSONAL_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,DEVELOPMENT]"
  },
  "PERSONAL_EFFECTIVENESS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,EFFECTIVENESS]"
  },
  "PERSONAL_EXPANSION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,EXPANSION]"
  },
  "PERSONAL_GROWTH": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,GROWTH]"
  },
  "PERSONAL_IDENTITY": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token IDENTITY → SELF_ESTEEM"
  },
  "PERSONAL_INSIGHT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,INSIGHT]"
  },
  "PERSONAL_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "PERSONAL_POSITIONING": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,POSITIONING]"
  },
  "PERSONAL_SUSTAINABILITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [PERSONAL,SUSTAINABILITY]"
  },
  "PERSONAL_VISION": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token VISION → GOAL_ORIENTATION"
  },
  "PERSONALITY_ALIGNMENT": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme PERSONALITY → SELF_ESTEEM/CAREER_CLARITY",
    "candidates": [
      "SELF_ESTEEM",
      "CAREER_CLARITY"
    ]
  },
  "PERSONALITY_CAREER": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token CAREER → CAREER_CLARITY"
  },
  "PERSONALITY_EXPLORATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme PERSONALITY → SELF_ESTEEM/CAREER_CLARITY",
    "candidates": [
      "SELF_ESTEEM",
      "CAREER_CLARITY"
    ]
  },
  "PLACEMENT_OPERATIONS": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PLACEMENT → CAREER_READINESS"
  },
  "PLACEMENT_RISK": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PLACEMENT → CAREER_READINESS"
  },
  "POTENTIAL_DISCOVERY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [POTENTIAL,DISCOVERY]"
  },
  "PRODUCTIVITY_COACHING": {
    "construct": "EXECUTIVE_FUNCTION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PRODUCTIVITY → EXECUTIVE_FUNCTION"
  },
  "PRODUCTIVITY_REFLECTION": {
    "construct": "EXECUTIVE_FUNCTION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PRODUCTIVITY → EXECUTIVE_FUNCTION"
  },
  "PROFESSIONAL_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "PSYCHOLOGICAL_ADAPTATION": {
    "construct": "MENTAL_HEALTH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PSYCHOLOGICAL → MENTAL_HEALTH"
  },
  "PURPOSE_ALIGNMENT": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PURPOSE → GOAL_ORIENTATION"
  },
  "PURPOSE_DISCOVERY": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PURPOSE → GOAL_ORIENTATION"
  },
  "PURPOSE_REFLECTION": {
    "construct": "GOAL_ORIENTATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PURPOSE → GOAL_ORIENTATION"
  },
  "RECOVERY_BEHAVIOR": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token RECOVERY → RESILIENCE"
  },
  "RECOVERY_CAPABILITY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: RESILIENCE | SKILL_AWARENESS",
    "candidates": [
      "RESILIENCE",
      "SKILL_AWARENESS"
    ]
  },
  "RECOVERY_ORIENTATION": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token RECOVERY → RESILIENCE"
  },
  "REFLECTIVE_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [REFLECTIVE,DEVELOPMENT]"
  },
  "REFLECTIVE_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "REFLECTIVE_SYSTEMS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [REFLECTIVE,SYSTEMS]"
  },
  "RESPONSIBILITY_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [RESPONSIBILITY,DEVELOPMENT]"
  },
  "SELF_ACCEPTANCE": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SELF_ESTEEM"
  },
  "SELF_AWARENESS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF+AWARENESS → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_DEVELOPMENT": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_DIAGNOSTIC": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_DISCOVERY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_EVALUATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_EXPLORATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_EXPRESSION": {
    "construct": "COMMUNICATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token EXPRESSION → COMMUNICATION"
  },
  "SELF_GROWTH": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_IDENTITY": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token IDENTITY → SELF_ESTEEM"
  },
  "SELF_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF+LEADERSHIP → SELF_ESTEEM/CRITICAL_THINKING/SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING",
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "SELF_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "SELF_MANAGEMENT": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_MOTIVATION": {
    "construct": "INTRINSIC_MOTIVATION",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → INTRINSIC_MOTIVATION"
  },
  "SELF_OBSERVATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_PERCEPTION": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PERCEPTION → SELF_ESTEEM"
  },
  "SELF_PROGRESS": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_REFLECTION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF → SELF_ESTEEM/CRITICAL_THINKING",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING"
    ]
  },
  "SELF_REGULATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme SELF+REGULATION → SELF_ESTEEM/CRITICAL_THINKING/IMPULSE_CONTROL/EMOTIONAL_REGULATION/EXECUTIVE_FUNCTION",
    "candidates": [
      "SELF_ESTEEM",
      "CRITICAL_THINKING",
      "IMPULSE_CONTROL",
      "EMOTIONAL_REGULATION",
      "EXECUTIVE_FUNCTION"
    ]
  },
  "SELF_WORTH": {
    "construct": "SELF_ESTEEM",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → SELF_ESTEEM"
  },
  "SKILL_DEVELOPMENT": {
    "construct": "SKILL_AWARENESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token SKILL → SKILL_AWARENESS"
  },
  "SOCIAL_CAPABILITY": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: SOCIAL_CONFIDENCE | SKILL_AWARENESS",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "SKILL_AWARENESS"
    ]
  },
  "SOCIAL_DEVELOPMENT": {
    "construct": "SOCIAL_CONFIDENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token SOCIAL → SOCIAL_CONFIDENCE"
  },
  "SOCIAL_EMOTIONAL": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: SOCIAL_CONFIDENCE | EMOTIONAL_REGULATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "EMOTIONAL_REGULATION"
    ]
  },
  "SOCIAL_LEADERSHIP": {
    "construct": "SOCIAL_CONFIDENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token SOCIAL → SOCIAL_CONFIDENCE"
  },
  "SOCIAL_LEARNING": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: SOCIAL_CONFIDENCE | LEARNING_APPROACH",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "LEARNING_APPROACH"
    ]
  },
  "SOCIAL_REFLECTION": {
    "construct": "SOCIAL_CONFIDENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token SOCIAL → SOCIAL_CONFIDENCE"
  },
  "SOCIAL_SELF": {
    "construct": "SOCIAL_CONFIDENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token SOCIAL → SOCIAL_CONFIDENCE"
  },
  "STAKEHOLDER_ALIGNMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STAKEHOLDER,ALIGNMENT]"
  },
  "STEM_LEARNING": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token LEARNING → LEARNING_APPROACH"
  },
  "STRATEGIC_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "STRATEGIC_PREPARATION": {
    "construct": "EXAM_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_READINESS"
  },
  "STRENGTH_DISCOVERY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STRENGTH,DISCOVERY]"
  },
  "STUDENT_BALANCE": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,BALANCE]"
  },
  "STUDENT_BEHAVIOUR": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,BEHAVIOUR]"
  },
  "STUDENT_DEVELOPMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,DEVELOPMENT]"
  },
  "STUDENT_ENGAGEMENT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,ENGAGEMENT]"
  },
  "STUDENT_LEADERSHIP": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme LEADERSHIP → SOCIAL_CONFIDENCE/COMMUNICATION/GOAL_ORIENTATION",
    "candidates": [
      "SOCIAL_CONFIDENCE",
      "COMMUNICATION",
      "GOAL_ORIENTATION"
    ]
  },
  "STUDENT_PSYCHOLOGY": {
    "construct": "MENTAL_HEALTH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token PSYCHOLOGY → MENTAL_HEALTH"
  },
  "STUDENT_RECOVERY": {
    "construct": "RESILIENCE",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token RECOVERY → RESILIENCE"
  },
  "STUDENT_REGULATION": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.4,
    "reason": "theme REGULATION → IMPULSE_CONTROL/EMOTIONAL_REGULATION/EXECUTIVE_FUNCTION",
    "candidates": [
      "IMPULSE_CONTROL",
      "EMOTIONAL_REGULATION",
      "EXECUTIVE_FUNCTION"
    ]
  },
  "STUDENT_RISK": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,RISK]"
  },
  "STUDENT_SUCCESS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,SUCCESS]"
  },
  "STUDENT_SUPPORT": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [STUDENT,SUPPORT]"
  },
  "STUDENT_WELLBEING": {
    "construct": "STRESS_MANAGEMENT",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token WELLBEING → STRESS_MANAGEMENT"
  },
  "STUDENT_WELLNESS": {
    "construct": "STRESS_MANAGEMENT",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token WELLNESS → STRESS_MANAGEMENT"
  },
  "STUDY_STRATEGY": {
    "construct": "LEARNING_APPROACH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → LEARNING_APPROACH"
  },
  "SUBJECT_ANXIETY": {
    "construct": "EXAM_STRESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → EXAM_STRESS"
  },
  "SUBJECT_INTERVENTION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [SUBJECT,INTERVENTION]"
  },
  "TALENT_DISCOVERY": {
    "construct": "SKILL_AWARENESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token TALENT → SKILL_AWARENESS"
  },
  "TALENT_IDENTIFICATION": {
    "construct": "SKILL_AWARENESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token TALENT → SKILL_AWARENESS"
  },
  "TEACHING_QUALITY": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [TEACHING,QUALITY]"
  },
  "TEAM_LEADERSHIP": {
    "construct": "PEER_RELATIONS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token TEAM → PEER_RELATIONS"
  },
  "TEAM_LEARNING": {
    "construct": null,
    "status": "REVIEW_REQUIRED",
    "confidence": 0.5,
    "reason": "multi-construct: PEER_RELATIONS | LEARNING_APPROACH",
    "candidates": [
      "PEER_RELATIONS",
      "LEARNING_APPROACH"
    ]
  },
  "TEAM_MANAGEMENT": {
    "construct": "PEER_RELATIONS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token TEAM → PEER_RELATIONS"
  },
  "THINKING_QUALITY": {
    "construct": "CRITICAL_THINKING",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token THINKING → CRITICAL_THINKING"
  },
  "TRANSITION_ADAPTATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [TRANSITION,ADAPTATION]"
  },
  "TRANSITION_READINESS": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [TRANSITION,READINESS]"
  },
  "VALUES_BASED": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [VALUES,BASED]"
  },
  "VALUES_EXPLORATION": {
    "construct": null,
    "status": "UNMAPPED",
    "confidence": 0,
    "reason": "no behavioural construct token in [VALUES,EXPLORATION]"
  },
  "VOCATIONAL_GUIDANCE": {
    "construct": "CAREER_CLARITY",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token VOCATIONAL → CAREER_CLARITY"
  },
  "WORKFORCE_TRENDS": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.85,
    "reason": "token WORKFORCE → CAREER_READINESS"
  },
  "WORKPLACE_ADAPTATION": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → CAREER_READINESS"
  },
  "WORKPLACE_FIT": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → CAREER_READINESS"
  },
  "WORKPLACE_PERFORMANCE": {
    "construct": "CAREER_GROWTH",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → CAREER_GROWTH"
  },
  "WORKPLACE_READINESS": {
    "construct": "CAREER_READINESS",
    "status": "HIGH_CONFIDENCE",
    "confidence": 0.95,
    "reason": "exact-override → CAREER_READINESS"
  }
};

  /**
   * Pure, side-effect-free resolver. Returns the crosswalk entry for a bridge tag,
   * or null if the tag is not present in the clarity bank crosswalk.
   */
  export function resolveConstructForBridgeTag(tag: string | null | undefined): CrosswalkEntry | null {
    if (!tag) return null;
    return BRIDGE_TAG_CONSTRUCT_CROSSWALK[tag] ?? null;
  }
  
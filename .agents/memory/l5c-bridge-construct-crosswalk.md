---
name: L5C bridge-tag → construct crosswalk
description: Deterministic clarity bridge_tag → behavioural construct crosswalk for Outcome Projection; reachability ceiling, honesty rules, umbrella-token overreach vector.
---

# L5C — Bridge Tag → Construct crosswalk (Outcome Projection enablement)

The clarity question bank (~30,638 q, 325 distinct `master_bridge_tag`) had **no path**
to the 36-key behavioural construct registry — the only concern→construct map
(`CONCERN_TO_CONSTRUCT`, short-assessment keys) resolves just **0.3%** of clarity
questions (clarity `concern` is 6,235 descriptive phrases in a totally different
vocabulary from the 160 short-assessment keys, so exact-match overlap is near-zero).
The fix is an explicit, hand-verified `bridge_tag → construct` crosswalk
(`backend/data/bridge-tag-construct-crosswalk.ts`).

**Why / how to apply:**
- The artifact is **INERT** — imported ONLY by audit/measurement tooling, never by a
  runtime selection/scoring/projection path. Keep it that way until a separate,
  approval-gated wiring phase. Architect confirms inert by grepping for no runtime
  references to `BRIDGE_TAG_CONSTRUCT_CROSSWALK`.
- Classify EVERY tag: `HIGH_CONFIDENCE` (one clear construct — exact-override / single
  substantive token / same-cluster collapse), `REVIEW_REQUIRED` (multiple plausible
  constructs → carry `candidates[]`, NEVER auto-map), `UNMAPPED` (no behavioural
  construct → NEVER force).
- **Honest reachability ceiling ≈ 85.6%** (HIGH 67.5% / 182 tags + REVIEW 18.2% /
  64 tags), NOT ~91-100%. The residual **14.4% UNMAPPED (79 tags)** is genuinely
  institutional/operational/holistic — FACULTY_*, TEACHING/INSTRUCTIONAL_QUALITY,
  ASSESSMENT_INTELLIGENCE, HOLISTIC/PERSONAL_DEVELOPMENT, GROWTH-meta, GENERAL_CONCERN.
  Mapping them needs a NEW construct (out of scope) or fabrication (forbidden). Report
  the gap; do not tune to hit a target.
- **Construct-reachable ≠ outcome-reachable.** HIGH tags route to an ungated
  `wc3_outcome_models` model for only 56.7% of the bank (62.1% incl. gated
  `exam_readiness`). Constructs with NO outcome model anywhere: PROCRASTINATION,
  PHYSICAL_WELLBEING, PEER_RELATIONS, SAFETY_THREATS, DIGITAL_DEPENDENCY/DISCIPLINE,
  CAREER_GROWTH — tags resolving to these are honestly mapped but outcome-orphan.
- **Clarity bank theme skew:** 10 of 36 registry constructs receive NO HIGH mapping
  (WORKING_MEMORY, PROCESSING_SPEED, IMPULSE_CONTROL, PROCRASTINATION, ANXIETY,
  LEARNING_DRIVE, SAFETY_THREATS, DIGITAL_DEPENDENCY, ACADEMIC_RECOVERY,
  FAMILY_DYNAMICS) — the clarity tags simply don't carry those themes. Honest, not a bug.
- **Overreach vector (architect caution):** umbrella-token HIGH mappings (`CAREER_*`
  →CAREER_CLARITY/READINESS, `ACADEMIC_*`→LEARNING_APPROACH; ~33 tags / 6.5% of bank)
  are defensible for an audit artifact but must be **re-adjudicated and uncertain ones
  downgraded to REVIEW before any runtime adoption** (annex in report 03).
- Q-intelligence completeness (L5A `wc3_question_intelligence` + L5B
  `wc3_question_context`, both 100% / 30,638): (L5A+L5B+L5C)/3 lifts 66.8% → 89.2%
  (HIGH) / 95.2% (HIGH+REVIEW).

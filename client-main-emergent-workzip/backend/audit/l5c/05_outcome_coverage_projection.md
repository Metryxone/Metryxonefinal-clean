# L5C Report 5 — Outcome Coverage Projection

  Projects how HIGH_CONFIDENCE clarity questions would route to the **7 existing wc3_outcome_models**
  (construct ∈ model.construct_keys). INERT projection — no runtime change.

  **Outcome coverage:** 56.7% of the bank routes to an **ungated** outcome model
  (62.1% including the gated `exam_readiness` model). Baseline was ~0.3%.

  | Outcome model | Gated | Construct keys | HIGH tags routed | Questions | % bank |
  |---------------|-------|----------------|------------------|-----------|--------|
  | career_clarity | no | CAREER_CLARITY, CAREER_READINESS, SKILL_AWARENESS, GOAL_ORIENTATION, COLLEGE_ADAPT | 55 | 5992 | 19.6% |
| confidence_stability | no | SELF_ESTEEM, SOCIAL_CONFIDENCE, RESILIENCE, EMOTIONAL_REGULATION, ANXIETY, MENTAL_HEALTH, STRESS_MANAGEMENT | 43 | 5016 | 16.4% |
| decision_quality | no | CRITICAL_THINKING, IMPULSE_CONTROL, GOAL_ORIENTATION, INTRINSIC_MOTIVATION, EXECUTIVE_FUNCTION, HABIT_FORMATION | 34 | 3545 | 11.6% |
| employability_readiness | no | SKILL_AWARENESS, COMMUNICATION, SOCIAL_CONFIDENCE, CAREER_READINESS, CREATIVITY | 34 | 5021 | 16.4% |
| exam_readiness | yes | EXAM_READINESS, EXAM_PERFORMANCE, EXAM_STRESS, STRESS_MANAGEMENT, ACADEMIC_RECOVERY | 11 | 2285 | 7.5% |
| family_wellbeing | no | FAMILY_DYNAMICS | 0 | 0 | 0.0% |
| learning_effectiveness | no | LEARNING_APPROACH, LEARNING_DRIVE, ACADEMIC_RECOVERY, CRITICAL_THINKING, WORKING_MEMORY, PROCESSING_SPEED, ATTENTION_REGULATION, EXECUTIVE_FUNCTION | 48 | 4118 | 13.4% |

## Constructs that are HIGH targets but reach NO ungated outcome model
  These tags resolve to a real construct, but that construct is not a key in any **ungated** outcome model
  (honest nuance — construct-reachable ≠ outcome-reachable):

  - **EXAM_PERFORMANCE** — 225 q (only via gated exam_readiness)
- **EXAM_READINESS** — 725 q (only via gated exam_readiness)
- **CAREER_GROWTH** — 700 q (no outcome model at all)
- **PEER_RELATIONS** — 365 q (no outcome model at all)
- **DIGITAL_DISCIPLINE** — 50 q (no outcome model at all)
- **EXAM_STRESS** — 690 q (only via gated exam_readiness)
- **PHYSICAL_WELLBEING** — 530 q (no outcome model at all)

Constructs with NO outcome model anywhere (ungated or gated): PROCRASTINATION, PHYSICAL_WELLBEING, PEER_RELATIONS, SAFETY_THREATS, DIGITAL_DEPENDENCY, DIGITAL_DISCIPLINE, CAREER_GROWTH. Tags resolving to these are honestly construct-mapped but outcome-orphan until/unless an outcome model covers them.

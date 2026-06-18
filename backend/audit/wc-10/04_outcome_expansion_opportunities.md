# WC-10 Report 4 — Outcome Expansion Opportunities (DESIGN — simulated, not applied)

For every residual construct: candidate reconciliation into an EXISTING model (Metric 5) and, where none fits, a new-outcome candidate or honest remain-unmapped (Metric 6). Each fold is **simulated against cloned models** to measure real coverage lift — the live wc3_outcome_models are untouched.

## Metric 5 — fold into existing model
| Construct | Bank q | Candidate existing model | Confidence | Marginal coverage lift | Rationale |
|-----------|--------|--------------------------|------------|------------------------|-----------|
| CAREER_GROWTH | 700 | career_clarity | HIGH | +700 q (2.3%) | CAREER_GROWTH is directly adjacent to existing career_clarity keys CAREER_CLARITY / CAREER_READINESS / GOAL_ORIENTATION — same career-development family. |
| PROCRASTINATION | 0 | decision_quality | HIGH | +0 q (0%) | PROCRASTINATION is a self-regulation / executive-function failure; decision_quality already holds IMPULSE_CONTROL, HABIT_FORMATION, EXECUTIVE_FUNCTION — same regulation family. |
| DIGITAL_DISCIPLINE | 50 | decision_quality | HIGH | +50 q (0.2%) | DIGITAL_DISCIPLINE is impulse/habit self-control over device use; maps onto decision_quality keys IMPULSE_CONTROL / HABIT_FORMATION. |
| DIGITAL_DEPENDENCY | 0 | decision_quality | MODERATE | +0 q (0%) | DIGITAL_DEPENDENCY (compulsive use) sits between decision_quality (IMPULSE_CONTROL) and confidence_stability (MENTAL_HEALTH); leaning decision_quality as the dominant behavioural framing. Genuine human-review item. |
| PEER_RELATIONS | 365 | confidence_stability | MODERATE | +365 q (1.2%) | PEER_RELATIONS is social-emotional; confidence_stability holds SOCIAL_CONFIDENCE, and employability_readiness also holds SOCIAL_CONFIDENCE/COMMUNICATION — defensible into either, leaning confidence_stability. Genuine human-review item. |

## Metric 6 — no existing fit → new-outcome candidate or remain-unmapped
| Construct | Bank q | Verdict | Evidence |
|-----------|--------|---------|----------|
| PHYSICAL_WELLBEING | 530 | NEW OUTCOME candidate: holistic_wellbeing (PHYSICAL_WELLBEING, MENTAL_HEALTH, STRESS_MANAGEMENT) | No existing model carries a physical-health / sleep / energy construct; family_wellbeing is FAMILY_DYNAMICS only. No defensible existing fit. |
| SAFETY_THREATS | 0 | REMAIN UNMAPPED | SAFETY_THREATS is safeguarding / crisis, handled by the runtime crisis-escalation path — not a developmental-outcome construct. Remain unmapped (do NOT force into a behavioural model). |

> Discipline: HIGH-confidence folds are same-family adjacencies to a model's existing keys. MODERATE folds (DIGITAL_DEPENDENCY, PEER_RELATIONS) are genuine human-review items defensible into >1 model — surfaced, never auto-decided. PHYSICAL_WELLBEING / SAFETY_THREATS have NO defensible existing fit and are NOT forced.

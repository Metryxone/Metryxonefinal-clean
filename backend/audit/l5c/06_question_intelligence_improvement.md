# L5C Report 6 — Question Intelligence Improvement

  Each clarity question accrues intelligence across three additive layers:

  | Layer | Source | Coverage |
  |-------|--------|----------|
  | L5A — Question Intelligence | `wc3_question_intelligence` | 30638/30638 (100%) |
  | L5B — Question Context | `wc3_question_context` | 30638/30638 (100%) |
  | L5C — Outcome/Construct reachability (this phase) | bridge-tag crosswalk | HIGH 67.5% / HIGH+REVIEW 85.6% |

  **Per-question layer-completeness = (L5A + L5B + L5C)/3**, averaged over all 30638 questions:

  | Scenario | Completeness |
  |----------|--------------|
  | Before L5C (L5C reach = 0.3%) | 66.8% |
  | After L5C — HIGH only | **89.2%** |
  | After L5C — HIGH + REVIEW | 95.2% |

  L5C lifts question-intelligence completeness from **66.8%** to **89.2%**
  (auto-projectable HIGH), or **95.2%** once REVIEW_REQUIRED tags are human-disambiguated.
  The remaining gap is the 14.4% of questions on institutional/holistic tags with no behavioural construct (Report 4).
  
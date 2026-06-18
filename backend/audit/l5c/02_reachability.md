# L5C Report 2 — Reachability (7 Validation Metrics)

  All figures frequency-weighted by real clarity question counts (n = 30638; 325 distinct master_bridge_tag).

  | # | Metric | Value |
  |---|--------|-------|
  | 1 | Current reachability (existing concern→construct chain, exact match) | **0.3%** (102 q) |
  | 2a | Reachability after crosswalk — HIGH only (auto-projectable) | **67.5%** |
  | 2b | Reachability after crosswalk — HIGH + REVIEW (resolvable w/ human disambiguation) | **85.6%** |
  | 3 | HIGH_CONFIDENCE coverage | 182 tags · 67.5% |
  | 4 | REVIEW_REQUIRED coverage | 64 tags · 18.2% |
  | 5 | UNMAPPED coverage | 79 tags · 14.4% |
  | 6 | Outcome coverage (HIGH → ungated outcome model) | 56.7% (incl. gated exam_readiness: 62.1%) |
  | 7 | Question-intelligence layer completeness (L5A+L5B+L5C)/3 | before 66.8% → 89.2% (HIGH) / 95.2% (HIGH+REVIEW) |

  ## Headline
  Bridge-tag → construct reachability rises from **0.3%** to **67.5% auto-projectable** (HIGH) and **85.6% resolvable** (HIGH+REVIEW).

  ## Honest ceiling — why not ~91%/100%
  The residual **14.4% UNMAPPED** is NOT a classifier failure. 79 tags carry
  institutional / operational / holistic semantics with **no single behavioural construct** in the existing
  36-key registry (e.g. FACULTY_*, TEACHING_QUALITY, INSTRUCTIONAL_QUALITY, ASSESSMENT_INTELLIGENCE,
  HOLISTIC_DEVELOPMENT, PERSONAL_DEVELOPMENT/GROWTH, GROWTH-meta, GENERAL_CONCERN, STAKEHOLDER_ALIGNMENT,
  FINANCIAL_READINESS). Mapping them would require **new constructs** (out of scope) or **fabrication**
  (forbidden). They are reported as honest coverage gaps, not forced.
  
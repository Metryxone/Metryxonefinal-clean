---
name: WC-8 Future Readiness coverage-audit method
description: How to measure CAPADEX future-readiness coverage honestly — substring traps, L5B vs literal coverage, and the front-half/back-half structural finding.
---

# WC-8 — Future Readiness & Adaptive Growth (DESIGN+AUDIT)

Deliverables live in `backend/audit/wc-8/` (10 markdown reports). Phase was audit-only — no code,
no schema. These are the durable *method* lessons, not the report contents.

## Coverage-audit honesty rules (reusable for any theme-coverage audit)
- **Short tokens need word boundaries.** A naïve `ILIKE '%ai%'` / `~* 'ai'` matched
  "again/training/available/explain" and inflated the AI clarity count ~50× (6,750 vs the honest
  129). Always boundary short tokens (`~* '\yai\y'`) and **sample-verify** matches before reporting.
  **Why:** an unboundaried count would have fabricated the headline AI number.
- **Literal keyword coverage ≠ context coverage.** The L5B classifier (`wc3_question_context`,
  lexicon+ontology) tags far more than literal tokens: AI_FUTURE_OF_WORK=440, CAREER_TRANSITION=403,
  EMPLOYABILITY=341, ENTREPRENEURSHIP=89 (vs literal AI 129). Report BOTH; use L5B as the true
  *context* coverage and literal as a floor. Don't pick whichever is bigger.
- **Label measured vs directional.** Row counts from SQL = measured; any maturity/lift/"~85" score
  is a directional estimate and must say so inline.

## The structural finding (the spine of the whole phase)
Future-readiness coverage is **front-loaded**: CAPADEX can *ask & classify* (questions + L5B
contexts exist for AI/transition/employability/entrepreneurship) but cannot *activate* — there are
only **7 outcome models** and **6 journey routes**, and only `employability_readiness` +
`employability_index` form an end-to-end future-readiness pillar. So the gap is the **back-half
(outcome models + products)**, not content. The single keystone is an **AI-resilient skill taxonomy
+ occupation-exposure reference**: build once, unlocks AI Navigator + Future Skills Planner +
Employability-2.0. Entrepreneurship is the one genuine content+activation gap (89 ctx Qs) → deferred,
not dressed up as compose-only.

## Honesty discipline applied
Where an outcome/product link is absent, the reports say "reachability broken" rather than route to
a generic fallback. Architect honesty pass caught two issues both fixed: (1) a Track-A "no
future-readiness product" line that contradicted the live Employability Index; (2) a "single
fastest-growing concern" claim unsupported by snapshot-only data (no longitudinal series measured).

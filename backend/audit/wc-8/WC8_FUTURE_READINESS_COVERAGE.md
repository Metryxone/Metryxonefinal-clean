# WC-8 Track A — Future Readiness Coverage Report

**Measured, read-only.** Corpus: 2,489 concerns / 30,638 clarity questions.

## A.1 Theme coverage — measured keyword match
Concern columns scanned: `display_label, concern_search, domain, concern_cluster,
capability_mapping`. Clarity columns: `question, concern`. The AI and gig rows use **word-boundary**
matching (a naïve `ai` substring matches "again/training/available" and inflated the count ~50×;
the boundaried number below is the honest one, and every match was sample-verified as genuinely
on-theme).

| Theme | Concerns (of 2,489) | % | Clarity Qs (of 30,638) | % | Read |
|-------|------:|----:|------:|----:|------|
| Adaptability / resilience | 395 | 15.9% | 1,480 | 4.8% | **Strong** |
| Human skills | 295 | 11.9% | 1,059 | 3.5% | **Strong** |
| Leadership | 251 | 10.1% | 1,192 | 3.9% | **Strong** |
| Employability | 92 | 3.7% | 887 | 2.9% | Moderate |
| Career transition | 75 | 3.0% | 601 | 2.0% | Moderate |
| Lifelong learning | 28 | 1.1% | 79 | 0.3% | Weak |
| Emerging careers | 23 | 0.9% | 356 | 1.2% | Weak |
| Reskill / upskill | 18 | 0.7% | 217 | 0.7% | Weak |
| Innovation | 15 | 0.6% | 121 | 0.4% | Weak |
| **AI job disruption** (boundaried) | 6 | 0.2% | 129 | 0.4% | **Thin (literal)** |
| Entrepreneurship | 6 | 0.2% | 42 | 0.1% | **Near-absent** |
| Creator economy | 6 | 0.2% | 6 | 0.02% | **Near-absent** |
| Gig economy (boundaried) | 2 | 0.08% | 8 | 0.03% | **Near-absent** |

> Note: literal keyword counts undercount AI/transition because the **L5B context classifier**
> (lexicon + ontology, not just literal tokens) tags **440** questions `AI_FUTURE_OF_WORK`,
> **403** `CAREER_TRANSITION`, **341** `EMPLOYABILITY`, **89** `ENTREPRENEURSHIP` (see Track F).
> Use the L5B numbers as the true *context* coverage; the table above is *literal* coverage.

## A.2 The 7 required coverage dimensions

| Dimension | Where it lives | Future-readiness verdict |
|-----------|----------------|--------------------------|
| 1. Question coverage | 30,638 clarity Qs, L5A-staged | Present for AI/transition/employability; near-zero for gig/creator/entrepreneurship |
| 2. Concern coverage | 2,489 master concerns | Same shape — strong human/adaptability, thin AI/entrepreneurship |
| 3. Context coverage | L5B `wc3_question_context` | **Best-covered dimension** — explicit `AI_FUTURE_OF_WORK`/`CAREER_TRANSITION`/`EMPLOYABILITY`/`ENTREPRENEURSHIP` contexts exist |
| 4. Outcome coverage | `wc3_outcome_models` (7) | **Gap** — only `employability_readiness` + `career_clarity` are future-readiness-adjacent; no AI / entrepreneurship / future-skills / resilience outcome |
| 5. Journey coverage | `wc3_journey_routes` (6) | **Gap** — `employability_index` + `career_builder` only; no AI Navigator / Entrepreneurship / Future-Skills route |
| 6. Decision coverage | DC-1/DC-2 catalog | **Gap** — decisions catalogue stage/outcome/routing, none anchored on AI/entrepreneurship/future-skill |
| 7. Product coverage | Stage ladder + bridges | **Gap** — exactly ONE live future-readiness product (Employability Index, via the stage-ladder/bridges); no AI / future-skills / resilience / entrepreneurship product |

## A.3 Shape of the gap (the key insight)
Coverage is **front-loaded**: the system can *ask* and *classify* future-readiness concerns
(dimensions 1–3 are real), but cannot *activate* them into a future-readiness-specific outcome,
journey, decision, or product (dimensions 4–7 are thin). Employability is the **only** theme that
traverses all 7 dimensions end-to-end today.

## A.4 Directional maturity
Future Readiness layer ≈ **40/100** (directional) is corroborated: front-half ~65, back-half ~20.
Closing it is overwhelmingly a back-half (outcome + product) problem, not a content problem.

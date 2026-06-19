---
name: Question type canonical keys vs short tokens
description: DB-stored question_type is the canonical key (multiple_choice, …), not a short token (mcq) — scoring/option logic must normalize via validateQuestionType.
---

# Question type canonical keys (scoring trap)

`competency_question_templates.question_type` / `onto_question_competency_mapping.question_type`
store the **canonical** key from `QUESTION_TYPES` in `services/question-blueprint.ts`:
`likert`, `multiple_choice`, `situational_judgment`, `scenario_based`, `case_study`,
`behavioral`, `forced_choice`. Short tokens like `mcq`/`sjt`/`scenario`/`case` are only **aliases**.

**Rule:** any option-score / Likert-vs-best-answer branch must normalize the incoming type through
the shared `validateQuestionType(raw)` (returns `{valid, key}` with `key` = canonical or null) and
branch on the canonical key — treat only `likert` (or `null`/unrecognized) as the rating-ladder path;
every other resolvable canonical type is best-answer scored.

**Why:** A hardcoded short-token set (`{mcq,sjt,scenario,case,…}`) silently mis-scores the canonical
non-Likert keys as Likert (index→0/25/50/75/100 instead of best/adjacent/else=100/60/20), corrupting
raw score → competency score → normalization → level. A smoke that inserts short tokens directly into
the mapping table will NOT catch this — seed/test with canonical keys (or via the real `mapQuestion`
path) to exercise the integration.

**How to apply:** when adding any scorer/consumer that reads question_type, import
`validateQuestionType` rather than matching string tokens; add a regression that scores a question
stored with a canonical non-Likert key (e.g. `multiple_choice` adjacent → 60, not 25).

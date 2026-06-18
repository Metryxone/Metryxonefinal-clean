---
name: Confidence clarity options — context-aware scale generation
description: Why CAPADEX confidence-type clarity questions all showed an identical bland scale, and the safe way to regenerate option text.
---

# Confidence clarity options looked identical across every question

**Symptom:** every `response_type='confidence'` CAPADEX clarity question rendered
the same flat "Very Low / Low / Moderate / High / Very High" answer scale — felt
like the question/options were "repeating again and again".

**Root cause:** ~2,286 `confidence` rows in `capadex_clarity_questions` literally
stored that generic scale in `option_a..option_e` (the frontend faithfully renders
the DB options; it does NOT fabricate a scale). Most *other* response types
(coping_effectiveness, situational_fit, energy_motivation, …) already had rich
contextual option text — only `confidence` was bland.

**Fix approach (deterministic, reviewable):**
`backend/scripts/generate-confidence-options.mjs` detects each question's "feeling
word" (confident / hopeful / ready / prepared / emotionally stable|balanced /
mentally / likely / clear / calm / comfortable / satisfied / motivated — anchored
on the word after "how", then a priority keyword scan, default `confident`) and
writes a graduated 5-rung scale tailored to that dimension.

**Why it's safe:**
- Only rewrites `option_a..option_e` *text*; `*_score` columns and ascending A→E
  intensity are preserved, so scoring / reverse-scoring is unchanged.
- Dry-run writes a review CSV (`scripts/out/confidence-options-review.csv`); only
  `--apply` writes to the DB. Fully reversible (text-only).
- No backend restart needed — picker reads option columns from the DB per request.

**How to apply:** `node scripts/generate-confidence-options.mjs` (review) then
`--apply`. Re-runnable/idempotent (selects rows still on the generic scale).

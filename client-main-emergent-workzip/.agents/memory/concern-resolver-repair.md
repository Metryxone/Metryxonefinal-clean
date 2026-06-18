---
name: Concern resolver repair (RRP-1)
description: How resolveMasterConcernIdFromText was repaired — IDF-weighted ranking, deterministic tie-break cascade, short-intent mode, confidence, and how to validate it honestly.
---

# Concern resolver repair (RRP-1)

The free-text master-concern resolver lives in the pure module
`backend/services/concern-resolver-engine.ts` (single source of truth for tokenize/stem/synonym/IDF/
resolve) and is wired into `routes/capadex-concern-intelligence.ts` via a cached corpus loader
(5-min TTL) + `resolveMasterConcernDetailed`, keeping the back-compat `resolveMasterConcernIdFromText`
shim. `/analyze` surfaces `resolution_confidence` + `resolution_detail` **additively** (only when no
explicit `concern_id` is passed) — flag-free, non-breaking.

## Durable lessons

- **Ranking = IDF-weighted matched tokens as PRIMARY key; the cascade only breaks ties.**
  Tie-break order: exact label → exact phrase → cluster hits → bridge-tag hits → specificity
  (avgIdf/maxIdf) → age-fit → `concern_id` LAST. The legacy resolver broke EVERY tie by
  `concern_id ASC` (content-blind alphabetical bias).
- **The honest "tie rate" is `tie_break_reason==='concern_id_fallback'` (arbitrary ties), NOT
  weighted-score ties ≥2.** After the cascade, most weighted ties are resolved by content; only the
  residual that falls all the way to `concern_id` is truly arbitrary. Report both, but judge against
  the arbitrary number.
- **Short-intent mode (≤3 tokens) MUST drop the `matched/tokens ≥ 60%` gate.** The legacy gate
  rejected the simplest real phrasings ("i struggle with confidence" → 2 tokens, 1 match → 50% →
  null). Short mode boosts exact label/bridge/cluster instead → short-intent failures went 7.4%→0%.
- **Clamp `maxIdf` to a positive floor.** `idf = ln(N/(1+df))`; for a degenerate corpus (N≤1)
  `ln(N)=0`, so `specificity = avgIdf/maxIdf` becomes NaN/Infinity. Guard at build (`maxIdf>0` else
  `max(ln(N),1e-6)`) AND at the division site. Covered by a degenerate-corpus unit test.
- **`stress` stems to `stres`** (the stemmer strips a trailing `s` after `ss`→`s`); tests must expect
  the stemmed form.
- **Validate via the SAME saved baseline intents.** Reuse `audit/concern-resolution/_raw_results.json`
  (14,934 self-resolution intents + `ti` target index) and `_concerns_meta.json` (`ti`→id/tag/cluster)
  so before/after is apples-to-apples; build the "after" corpus from the live DB (full haystack).
  Self-resolution is a **best-case upper bound** — real paraphrases score lower; say so in the report.
- **`concern_cluster` is ~1:1 with the concern** (2,430 clusters / 2,489 concerns), so "near match by
  cluster" is almost never reachable — don't lean on cluster as an abstraction layer.

## Audit-only deliverables (NOT wired into the live resolver)

- **Synonym candidate groups** are derived from ontology co-occurrence (tokens recurring across ≥2
  concerns of the same bridge tag) — NO LLM, NO fabrication. They are surfaced for human review only;
  wiring them into the live resolver is a deliberate risk-low follow-up.
- **Missing-construct audit**: of the 6 marketed constructs, only CAREER_STABILITY has a dedicated
  bridge tag; the other 5 (CAREER_CLARITY/LEADERSHIP/COMMUNICATION/ENTREPRENEURSHIP/FUTURE_READINESS)
  are **`bridge_only`** — the concept is present across many concern labels but has no first-class
  bridge tag. That's a concern-authoring/coverage finding; **never fabricate concerns to "fix" it.**

Scripts: `backend/scripts/audit/rrp1-validate.ts` (before/after) + `rrp1-reports.ts` (synonym +
missing-construct) → `audit/rrp1/`.

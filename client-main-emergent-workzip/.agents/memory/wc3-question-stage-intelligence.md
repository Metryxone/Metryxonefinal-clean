---
name: WC-3 L5A Question Stage Intelligence
description: How question-level canonical stage is derived for clarity questions, and why its distribution legitimately skews.
---

# WC-3 L5A — Question Stage Intelligence (per-question canonical stage)

L5 "Question Intelligence 2.0" stamps each clarity question with intelligence dims; Phase 1
("L5A") delivers only the **Stage** slice: Primary + Secondary canonical stage + confidence.

## Rules / decisions
- **Do NOT read the clarity `stage` column.** It is single-valued ("Clarity" on ~14.3k,
  blank on ~16.3k) with zero canonical signal (AQ-1 dev-stage collapse). Stage is DERIVED
  from `question_type` + `response_type` + `polarity` + `narrative_style` only.
- **Derivation = deterministic weighted vote.** Each field maps its value → a partial
  distribution over the 5 canonical stages (`CANONICAL_STAGE_ORDER`, imported never
  re-declared); combine by field weight (qtype 0.40 · rtype 0.30 · narrative 0.15 ·
  polarity 0.15), normalise over RECOGNISED votes, top-2 = Primary/Secondary.
  `confidence = primaryProb × (0.5 + 0.5×coverage)`; coverage = recognised field-weight.
  Bands HIGH≥0.60 / MODERATE≥0.45 / LOW<0.45.
- **`single_select` is a UI FORMAT, not a semantic → casts no vote** (drops coverage to
  ~0.7 on ~24% of rows). Any unrecognised value also votes nothing — honest, never guessed.
- **Key the sidecar `wc3_question_intelligence` by the clarity SERIAL `id`, NOT
  `question_id`** — question_id is reused across different questions (clarity-xlsx-import
  lesson) so it can't be a PK / conflict target.
- **QIS stage delta = weight(0.20) × resolved_fraction × mean_confidence × 100.** Full
  coverage at MODERATE mean confidence (~0.51) yields ~+10, NOT the +20 ceiling — report
  the honest gain, don't inflate confidence to chase it.

## Why
**The distribution legitimately skews Clarity (~56%) / Growth (~30%) with Mastery rare
(~0.4%).** That is a real CATALOGUE property — the pool is diagnostic-heavy (`question_type`
'clarity' dominates, 66% negative polarity), and there are only ~120 mastery/reflection-typed
questions. It is an honest authoring gap to surface, NOT a derivation bug to "balance" away.

## How to apply
Additive/flag-gated (`FF_WC3_QUESTION_INTEL`, default OFF): the table is offline-derived and
no request path reads it yet, so the app is byte-identical ON or OFF. Future L5 phases
(outcome/journey/persona/context/capability/signal/QIS) ALTER ADD columns and gate any
runtime consumption behind the same flag. Builder is idempotent (`ON CONFLICT (clarity_id)`).

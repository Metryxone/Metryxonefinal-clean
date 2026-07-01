---
name: Lifecycle stage read-layer normalization
description: How stored 4-stage lifecycle strings ('Clarity'/'Awareness'/codes) are normalized at READ time without a data migration, and why trimming/case-insensitivity is safe.
---

# Lifecycle stage read-layer normalization

Canon (4 coded stages + 1 uncoded pre-stage): Curiosity/CAP_CUR → Insight/CAP_INS (stored
display alias **"Clarity"**) → Growth/CAP_GRW → Mastery/CAP_MAS. **"Awareness" = uncoded
pre-stage** (no CAP_* code). Stored DB strings ('Clarity', 'Awareness') are LOAD-BEARING —
`wc3/stage-intelligence.ts` `canonicalStageFor` emits proper-cased labels
('Awareness'/'Curiosity'/'Clarity'/'Growth'/'Mastery'), never codes, never padded.

## The decision: normalize at read, NEVER migrate the data
The single source of truth for resolving any stored representation is
`normalizeStoredStage(value): ResolvedStoredStage` in `backend/lib/lifecycle.ts` (pure,
never throws, case-insensitive, trimmed). It recognizes label / code / display alias /
uncoded pre-stage and returns `{ code, label, order, isUncodedPreStage, recognized }`.
**Why:** a DB rewrite of 'Clarity'/'Awareness' is high-risk and unnecessary; every consumer
can just route its lookup through this one normalizer and stay byte-identical.

## Consumers routed through it (each had its OWN duplicated literal map)
- `services/wc7c/subscription-engine.ts` `stageFloorIndex` → `FLOOR_BY_CODE`
  {CAP_CUR:0, CAP_INS:1, CAP_GRW:1, CAP_MAS:2}, uncoded/unknown→0.
- `services/wc3/trend-intelligence.ts` `stageToScale` → ordinal (pre-stage 0, coded order+1,
  else null) → (ordinal/4)*100.
- `services/wc7b/growth-plan-bridge.ts` `stageScore` → (ordinal+1)*20, unknown/absent→50.
- `lib/scoring-utils.ts` `stageWeight` (CSI) → resolve INPUT via canon then `WEIGHT_BY_CODE`
  {CAP_CUR:0.50, CAP_INS:0.75, CAP_GRW:1.00, CAP_MAS:1.25}, unknown/uncoded→0.5 (legacy default).
- `routes/csi.ts` `STAGE_ORDER` (highest-stage) + `routes/lbi-engine.ts` `stageOrder`
  (adaptability ordered-avgs) → both replaced the literal `['CAP_CUR','CAP_INS','CAP_GRW','CAP_MAS']`
  list with `LIFECYCLE_STAGE_CODES`. (Dead duplicate `STAGE_WEIGHTS` in csi.ts removed.)
- `routes/cognitive-intelligence.ts` has TWO separate stored-stage reads in ONE file
  (meta-learning "advanced" detection AND computeCognitiveProfile "processing depth" deep-session
  filter) — both are now order≥Growth via the canon. **Lesson: grep the WHOLE file, not the first
  hit — a "route every stage read" task fails review if a second literal read in the same file is
  left behind.**

## What is NOT a stored-stage read (deliberately left alone)
- `STAGE_PRICES` (`wc7c/upsell-engine.ts`, `wc7c/subscription-engine.ts`) keys the PRODUCT/target
  code being priced, not a user's current stage → no normalization needed.
- `services/wc3/question-stage-intelligence.ts` maps are question-type→stage probability
  distributions (seed/metadata), not a read of a persisted stage.
- `services/experience-routing.ts` `STAGE_TO_EXPERIENCE` keys `CareerStage` (a DIFFERENT taxonomy),
  not the CAPADEX lifecycle stage.
- `services/adaptive-assessment.ts` `STAGE_CODE_TO_NAME` already aliases canon `STAGE_CODE_TO_LABEL`.

## Registered validation check (fails the build on drift)
`scripts/verify-lifecycle-stage-normalization.ts` is registered as the **`lifecycle-stage-parity`**
validation step (validation skill), so it runs on every change and hard-fails if any stage reader
drifts from its legacy map. **Why:** the harness used to run only by hand — a new ad-hoc stage map
or a changed weight could ship silently. If you add another stored-stage read, add a matching
assertion here or the guard's coverage silently narrows.

## Byte-identity gotchas (proven by `scripts/verify-lifecycle-stage-normalization.ts`)
- **The three legacy maps disagreed on edge handling**: trend trimmed + lower-cased; subscription
  floor lower-cased but did NOT trim; growth-plan `stageScore` was CASE-SENSITIVE and did NOT trim.
- Routing all three through the shared normalizer makes them all trimmed + case-insensitive. This
  is SAFE because `canonical_stage` is never persisted padded or in non-proper case — so the
  newly-handled forms (whitespace, lower/upper case, CAP_* codes) **do not occur as real inputs**.
  Strict parity is asserted only on actually-occurring proper-cased values; trimming/case/code
  handling is verified as additive robustness, not legacy parity.
- **No feature flag**: behaviour is provably byte-identical on real inputs, so no runtime shift.

## Write-side guarantee (the read-parity rests on it)
The read-parity holds ONLY while stored `canonical_stage` is a clean proper-cased label. To stop a
future writer from silently breaking that, `backend/lib/lifecycle.ts` adds two PURE guards:
`isCanonicalStoredStage(v)` (exact membership in `STORED_STAGE_ORDER`, no trim/case-fold) and
`toCanonicalStoredStage(v)` (coerce any code/alias/casing/whitespace → proper stored label;
CAP_INS → 'Clarity'; junk/null → null).
- The caller-controlled write site `wc3/longitudinal-foundation.ts captureLongitudinalSnapshot`
  routes `canonicalStage` through `toCanonicalStoredStage` before persist + `console.error`s loudly
  on coercion. **Gotcha that motivated this:** `wc3/user-intelligence-foundation.ts` was passing the
  RAW `stage_code` (e.g. 'CAP_INS') as `canonicalStage` — fixed to `canonicalStageFor(stage_code)`.
- `canonicalStageFor` (→ wc3_stage_state/progression) and the outcome insert (current/desired_stage,
  sourced from persisted L1 + `STORED_STAGE_ORDER`) are canon BY CONSTRUCTION; outcome also routes
  current_stage through the guard for defense-in-depth.
- Guarantee is enforced by `scripts/verify-canonical-stage-writers.ts` (fails loudly / exit 1),
  now registered as the **`lifecycle-stage-writers`** validation step (companion to
  `lifecycle-stage-parity`), so a drifting WRITER hard-fails the build automatically — no longer
  manual-only. **Why:** Task #306 proved reads; this proves writes can never reintroduce a
  non-canonical value. Add a matching assertion here when you add a new writer of a stage column.

## What was deliberately left alone
`services/wc5/*` memory just passthrough-stores `canonical_stage` (no label→number map) so there
was nothing to normalize there. Don't invent a map where none exists.

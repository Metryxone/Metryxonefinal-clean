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

## Byte-identity gotchas (proven by `scripts/verify-lifecycle-stage-normalization.ts`)
- **The three legacy maps disagreed on edge handling**: trend trimmed + lower-cased; subscription
  floor lower-cased but did NOT trim; growth-plan `stageScore` was CASE-SENSITIVE and did NOT trim.
- Routing all three through the shared normalizer makes them all trimmed + case-insensitive. This
  is SAFE because `canonical_stage` is never persisted padded or in non-proper case — so the
  newly-handled forms (whitespace, lower/upper case, CAP_* codes) **do not occur as real inputs**.
  Strict parity is asserted only on actually-occurring proper-cased values; trimming/case/code
  handling is verified as additive robustness, not legacy parity.
- **No feature flag**: behaviour is provably byte-identical on real inputs, so no runtime shift.

## What was deliberately left alone
`services/wc5/*` memory just passthrough-stores `canonical_stage` (no label→number map) so there
was nothing to normalize there. Don't invent a map where none exists.

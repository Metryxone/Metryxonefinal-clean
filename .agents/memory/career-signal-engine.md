---
name: Career Signal Engine (Phase 4.10)
description: Compose-only developmental signal layer + the Number(null)===0 fabrication trap that any composing/clamp helper must guard.
---

# Career Signal Engine (Phase 4.10)

Compose-only, read-only, flag-gated (`careerSignal` / `FF_CAREER_SIGNAL`) layer
that folds the competency runtime, EI profile, Phase-4.3 readiness and Phase-4.4
gap engines into seven DEVELOPMENTAL signals (Career/Leadership/Technical/Growth/
Promotion Potential + Career/Stagnation Risk). Config-as-data overlay tables
(`career_signal_library` + `career_signal_rules`) override in-code defaults when
present; admin CRUD is the only write/DDL path.

## The clamp/coerce fabrication trap (the durable lesson)
A `clampScore(n)` helper written as `Number(n); if(!isFinite) return null` will
turn an honest-absent `null` into a measured **0**, because `Number(null) === 0`
(finite). That silently flips a signal from `measurable:false` to a fabricated
`measurable:true, score:0` (and, after an `invert` transform, to a fake `100`).

**Why:** smoke caught two signals reading as measurable for a non-existent
subject — the upstream EI engine correctly returned `growth.score = null`, but the
clamp coerced it to 0.

**How to apply:** any numeric normalizer feeding a Coverage/measurability gate
must guard `null | undefined | ''` BEFORE `Number()`. Treat "present" as a real
value, never a coerced zero. (Same family as the longitudinal null-coercion trap.)

## Honesty contract specifics
- Coverage = present inputs / declared inputs; Confidence = inherited from the
  WEAKEST contributing source band, never re-derived. Separate axes, never composited.
- Promotion Potential is a developmental readiness signal, NOT a hiring/promotion
  prediction — every signal carries an interpretation cap + composed language_policy.
- GET-never-writes: getProfile/buildEiProfile/buildCareerReadiness transitively
  ensure competency-runtime schema, so gate ALL composed sources behind
  `competencyRuntimeReady(pool)`; config readers use `to_regclass` + defaults fallback.

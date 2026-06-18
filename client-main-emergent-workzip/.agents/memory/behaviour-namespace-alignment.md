---
name: Behaviour namespace alignment (WC-L0)
description: Why the WC-L0 behaviour construct dims were empty, and the polarity-aware concern→deficit fix that keeps the strengths canon.
---

# Behaviour namespace alignment — projection vs runtime vocabulary

The WC-L0 behaviour **projection** (`projectBehaviour` in
`backend/services/wc3/user-intelligence-foundation.ts`) matched the four construct dims
(motivation / confidence / engagement / adaptability) by **regex over POSITIVE / `self_*` signal
keys** — but the activation **runtime emits ONLY concern-diagnostic signal keys**
(`avoidance_pattern`, `career_confusion`, `social_withdrawal`, `placement_anxiety`,
`cognitive_blocking`, `emotional_overload`, plus `GENERAL_CONCERN` and null-strength latency keys).
The two namespaces never intersect, so those four dims were **structurally NULL** no matter how much
behaviour was captured. This is a *vocabulary* failure, not a data failure.

**Fix:** a polarity-aware `SIGNAL_DEFICIT_MAP` that routes the EXISTING concern keys to the EXISTING
dims as a **deficit** — it adds NO new construct / dimension / ontology / scoring model. Gated by
`FF_BEHAVIOUR_NAMESPACE_ALIGNMENT` (default OFF → byte-identical).

## Non-negotiable rules (learned the hard way)
- **Deficits ONLY, with a NEUTRAL CAP.** `value = min(50, round(100 − strength))`. The cap is the
  strengths-canon guard: a concern signal may mark a construct as *impaired* (≤ neutral 50) but may
  **never** assert an above-neutral strength. Without the cap, a weak concern (strength 0.1 → 90)
  reads as a high construct value — i.e. a fabricated strength from a distress signal. **Why:** the
  platform canon is "strengths come ONLY from CSI `positive_factors` / positive growth, never from
  raw concern-signal magnitude." An architect honesty review flagged the uncapped form as a canon
  violation even though live data (all strengths ≥0.5) never tripped it.
- **Positive evidence wins.** The deficit fills a dim ONLY when the positive regex path left it NULL;
  a non-null positive hit is never overwritten.
- **Don't map the catch-all or null-strength keys.** `GENERAL_CONCERN` is non-specific (no single
  construct); `rapid_answer*` / `prolonged_hesitation` carry NULL strength (no magnitude to
  inverse-code). Mapping them would fabricate a dimension. Leaving them unmapped is the honest choice,
  not an omission — and the 6 mapped keys already cover 100% of the *specific* readable-strength
  concern signals.

## The ceiling this fix does NOT raise (report honestly)
Namespace alignment makes graphed sessions **richer** (within-graph construct coverage 0% → ~62%) but
cannot raise **session-level reach** or **trend coverage** — those are bounded by the upstream
**graph-capture gap** (only a fraction of completed sessions have a behaviour graph; returning users
rarely have ≥2 *graphed* sessions). Those are separate findings (WC-L0C FP1 capture / FP2 activation)
out of alignment scope. Do NOT inflate headline coverage to hit targets — report the true ceiling and
name the binding constraint.

**How to apply:** when a downstream metric (personalization reach, trend/longitudinal readiness) is
flat after this fix, the binding constraint is graph capture, not the projection — point at FP1/FP2,
don't tune the projection.

## Re-persist regression trap (the deficit dims live ONLY while the flag is ON)
Re-running `persistUserIntelligence` re-PROJECTS the behaviour dims from the graph every time — the
deficit dims (motivation/confidence/engagement) exist ONLY because `FF_BEHAVIOUR_NAMESPACE_ALIGNMENT`
was ON when they were last persisted. So any backfill/recompute that re-runs the WC-L0 persist WITHOUT
also setting that flag will silently re-project those dims to **NULL** and **regress coverage**
(measured base 77.8% → ~22%). The existing `wcl0b-backfill.ts` is exactly this trap: it sets
`FF_USER_INTELLIGENCE_FOUNDATION` + `FF_BEHAVIOUR_TREND_INTELLIGENCE` but **not** the alignment flag.
**Why:** the alignment fill is a projection branch, not a stored value, so it is not "sticky" across a
re-persist. **How to apply:** any script that calls `persistUserIntelligence` must set
`FF_BEHAVIOUR_NAMESPACE_ALIGNMENT=1` in-process, and should PROVE non-regression with a VALUE-level
(per-dim, not dim-count) before/after compare — a NULL-regression changes a value, so a count-only
check can miss a same-count swap. (WC-L0F lesson; the genuine WC-L0F lift was not coverage — already
at the WC-L0E ceiling — but behaviour-TREND activation, which only became possible once WC-L0E had
graphed BOTH sessions of a returning owner, mirroring the WC-L3 outcome analog.)

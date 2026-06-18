# WC-P1 — D10: Personalization Readiness

**Coverage**: 30% | **Confidence**: 25%

---

## Evidence

| Personalization Layer | State |
|---|---|
| Behavioral nudges in job ranking | ✅ `rankJobsForUser` adjusts by Execution Readiness |
| IDP behavioral bias | ✅ Low Execution Readiness → low-effort, high-momentum steps |
| CareerBrain integration | ✅ EI score passed to `useCareerBrain` in all tabs |
| Band-based messaging | ⚠️ Band labels diverge across 3 schemas (see D5) |
| Per-industry weighting | ❌ Not implemented; single global ruleset only |
| Per-seniority weighting | ❌ Not implemented (doc §8.5: planned) |
| Persona-keyed question selection | ❌ No persona→EI weighting |
| CAPADEX behavioral profile → EI weights | ❌ Not wired |

---

## Band Label Confusion

Three incompatible band definitions coexist:
- **Docs**: Getting Started / Building / Career-Ready / Hire-Ready
- **UI tokens**: Starter / Developing / Good / Excellent
- **DB ruleset**: Starter / Developing / Good / Strong / Excellent

Copy in the breakdown modal, CTA buttons, and marketing surfaces references these labels inconsistently. A user can see "Good" in the gauge and "Career-Ready" in documentation about the same score range.

---

## What Works

- Behavioral context is live: `BehaviorContext` adjusts job ranking and IDP step selection.
- EI score is threaded consistently through all CareerBuilder tabs (as `eiScore` prop).
- Breakdown modal CTA labels adjust per score level ("Take the assessment" vs "Retake to improve").

---

## What Doesn't Work

- No industry-specific weighting (a finance candidate and a software engineer get identical weights).
- No seniority adjustment (entry-level and C-suite use the same formula).
- Band label inconsistency undermines user messaging coherence.

---

## Actions to Reach 95%

1. Standardise band labels (one schema, propagated everywhere).
2. Add industry context to ruleset config (separate dimension weight sets per industry vertical).
3. Personalise assessment CTA messaging by band + gap size.

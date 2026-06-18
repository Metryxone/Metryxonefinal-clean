# WC-P1 — D2: Assessment Readiness

**Coverage**: 35% | **Confidence**: 20%

---

## Evidence

| Check | Measured Value |
|---|---|
| Competency question templates in DB | 63 rows |
| LBI sessions completed | 0 rows (0 = never used) |
| SDI user responses | 0 rows (0 = never used) |
| Assessment score feeding EIGauge (useHybridEI) | ❌ ABSENT — engine has no assessmentScore input |
| Assessment score feeding EI breakdown modal | ✅ Present — `(assessmentScore/100)*25` at max 25pts |
| CAPADEX → EI score bridge | ❌ Not wired — `career-behavior-adapter.ts` exists but no assessment score passthrough |
| Assessment CTA in roadmap | ✅ Present — "Complete the Competency Assessment" appears in `buildRoadmap()` |

---

## Critical Finding: Assessment Score Split

The platform has two parallel EI representations that produce different numbers:

| | Engine | Assessment Handled? | Max Score |
|---|---|---|---|
| **EIGauge (displayed score)** | `useHybridEI` + `employabilityEngine.ts` | ❌ No | 99 (no assessment pts) |
| **EI Breakdown Modal** | `eiBreakdown` in `CareerBuilderPage.tsx` | ✅ Yes (25pts) | 100 (doc-accurate) |

A user who completes the assessment sees +25pts in the breakdown modal but ZERO change in the EIGauge score. This is an integrity gap — the headline score does not reflect the most impactful action the user can take.

---

## Why This Matters

The documentation states: *"This dimension contributes zero points until the user actually completes the assessment."*
That is true for the modal breakdown. It is also unintentionally true for the gauge — but for the wrong reason (the gauge was never wired to accept assessment scores).

---

## Actions Required to Reach 95%

1. Wire `profile.assessmentScore` into `runEmployabilityEngine()` input and add a 25-pt dimension (requires formula unification — see D5).
2. Complete CAPADEX → Career Builder assessment score passthrough via `career-behavior-adapter.ts`.
3. Seed LBI and SDI sessions with at least one test user to validate the pipeline.

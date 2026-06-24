# MX-75X — Section 13: Candidate Validation Surface

> **Status:** ACTIVATED (transparency disclosure). **Evidence:** PENDING (developmental signals only).
> **Honesty contract:** candidates are told plainly that insights are developmental signals and that
> empirical accuracy is deliberately withheld until the platform accrues ≥30 realized outcomes.

## Purpose
Candidates deserve to know **how trustworthy their insights are today**. There is **no candidate-scoped
calibration endpoint by design** — calibration is a platform-wide, privacy-preserving aggregate and
exposing a per-user "accuracy" number would be fabrication. So this surface is a **transparency
disclosure**: it explains the validation methodology and shows the honest current state rather than
inventing a personal accuracy figure.

## Component
`frontend/src/components/career/PredictionTrustTab.tsx`
- Mounted in `CareerBuilderPage.tsx` (Intelligence hub zone, TabId `prediction-trust`, icon
  `ShieldCheck`). Added to the `validTabs` deep-link whitelist.
- **Flag-gated for byte-identical OFF:** the sidebar tab and render switch are guarded by a probe of
  `GET /api/validation-loop/enabled` (persona-agnostic flag probe; `flagGate`-only). When
  `validationLoop` is OFF the probe 503s → the tab is hidden → the Career Builder is byte-identical to
  its pre-MX-75X state.

## What it shows
1. **Honest current state** — a prominent banner: insights are *developmental signals*; empirical
   accuracy is *still building*; the platform shows **no** accuracy figure rather than guessing, and
   publishes calibration only after ≥ **30** realized outcomes (aggregate, privacy-preserving).
2. **The closed validation loop** — Assessment → Prediction → Outcome → Validation → Calibration →
   Improved prediction, so the candidate understands guidance sharpens as real outcomes feed back.
3. **Coverage vs Confidence** — two plain-language cards: Coverage = "does enough data about you
   exist?" (missing shown as missing, never guessed); Confidence = "is the model calibrated yet?"
   (separate axis; today: developmental).
4. **Language policy** — explicit ARE / ARE-NOT lists: insights ARE developmental/growth/directional;
   they are NOT hiring verdicts, promotion decisions, suitability scores, guaranteed outcomes,
   pass/fail judgements, or rankings against others.

## Honesty rules enforced
- **No per-user accuracy claim.** By construction there is no fetch of a fabricated personal score;
  the k_min (30) and language policy mirror the engine's `VALIDATION_LANGUAGE_POLICY` exactly.
- **Developmental framing only.** Aligns with the platform-wide language policy — no
  hiring/promotion/suitability prediction is presented to the candidate.
- **Missing = missing.** Coverage copy commits to never filling gaps with guesses.

## Why a disclosure (not a live data panel)
Surfacing the platform-wide calibration counts to an individual candidate would be noise at best and
misleading at worst (it is not *their* accuracy). The honest, scope-correct candidate artifact is a
methodology + current-state disclosure grounded in the real k_min and language policy.

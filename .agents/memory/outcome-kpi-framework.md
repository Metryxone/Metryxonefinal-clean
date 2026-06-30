---
name: Outcome Framework / KPI Engine (CAPADEX 3.0 Phase 1.6)
description: Flag outcomeFrameworkKpiEngine — read-only outcome/KPI composer over existing engines; effectiveness WIRED via reuse of validation-loop calibration but abstained until k_min; mirrors 1.3/1.4/1.5 scaffold.
---

# Outcome Framework / KPI Engine (CAPADEX 3.0 Phase 1.6)

Flag `outcomeFrameworkKpiEngine` / `FF_OUTCOME_FRAMEWORK_KPI_ENGINE` (default OFF), getter
`isOutcomeFrameworkKpiEngineEnabled()`, public-config key `outcome_framework_kpi_engine`.
Answers **"assessment → intervention → MEASURABLE OUTCOME → KPI."** Enhancement-only,
reuse-before-build, NO new outcome/KPI engine, NO V2. Byte-identical-OFF incl. schema — ZERO DDL.

## The rule (why this phase exists)
The outcome→KPI chain is mechanism-complete via REUSE: MX-102X outcome-intelligence +
Phase-1.3 progression-outcome-capture write realized outcomes into `validation_loop_outcomes`;
the EXISTING enterprise-analytics + benchmark + mei/employability engines compute the KPI families.
This phase adds ONE read-only composer/registry + the canonical Outcome & KPI Model — and NOTHING else.

**Why:** Phases 1.3/1.4/1.5 established the reuse-before-build + four-axis-honesty discipline; 1.6
applies it to outcomes/KPIs. Building a parallel outcome ledger or a second KPI engine would
duplicate already-shipped substrate and violate byte-identical-OFF.

## Non-obvious traps
- **Effectiveness is WIRED via REUSE, then ABSTAINED until k_min (not 0).** The effectiveness gap was
  closed NOT by computing a rate but by WIRING `composeEffectiveness` to the EXISTING
  validation-loop calibration mechanism (`calibrationFromRows`/`toCalibrationPairs`/`OutcomeRow` from
  `validation-loop-engine.ts`, fed by `recordValidationOutcome`'s `predicted_prob_at_decision`). It
  reads non-demo `validation_loop_outcomes` via a never-throws `readRows` and surfaces a loop-level
  `calibration` block; the rate stays `null` while status is `cold_start`/`provisional` and lights up
  ONLY at `calibrated` (≥ k_min=30 real pairs). Per-channel rec/intervention rates stay null
  (predictions are loop-level, not per row). Zero-DDL: column absent → readRows null → honest null.
  **Why:** the link must be end-to-end real (no fabricated rate, no new table) — abstention is a
  CONFIDENCE/Adoption axis, never a gap.
- **OPEN engineering gaps = 0; never re-open as a gap.** `OUTCOME_KPI_GAPS = []`;
  `RESOLVED_OUTCOME_KPI_GAPS` has 6 entries: MECH-EFFECTIVENESS-CALIBRATION-WIRED (former GAP-O1,
  mechanism-closed), AXIS-PERSONA-KPI-ARCHITECTURE (former GAP-O2 — per-persona is a zero-DDL
  read-time join, an ARCHITECTURE axis; "closing" it would need DDL = contract violation), and
  AXIS-PLATFORM-KPI-ADOPTION (former GAP-O3 — platform KPI population is usage-driven = ADOPTION
  axis). Both AXIS-* are reported on their own axes, NEVER as engineering gaps.
- **`readScalar` returns null on ERROR, 0 on no-rows.** This is the null≠0 guarantee. Observed in the
  wild: `development_recommendations` COUNT(*) = 0 (table exists, empty) but DISTINCT-subject query
  renders `—` (the subject column is unreadable → caught → null). That divergence is CORRECT honesty,
  not a bug — do not "fix" it by coercing null to 0.
- **public-config getter is a SEPARATE import site.** `routes/capadex.ts` `/public-config` must IMPORT
  `isOutcomeFrameworkKpiEngineEnabled` or the endpoint 500s (no tsc here — only caught at runtime).
- **14 deliverables, NOT 12.** Unlike 1.5, this phase splits effectiveness into rec (06) + intervention
  (07) and adds outcome-inventory/kpi-inventory/lifecycle-outcome/dashboard/frontend reports.
- **Summary has NO loop_closure field** (unlike 1.5). The generator must NOT reference `S.loop_closure`;
  instead it reads `outcome_type_rollup` + `kpi_family_rollup` + `effectiveness` + `adoption`.
- **Revenue stays separate** (commerce ledger `capadex_payments`); Business KPIs here mean
  placement/hiring realized outcomes, never money composited into outcome/growth KPIs.

## How to apply
- Regenerate evidence from `backend/`: run `capadex-1.6-outcome-kpi-scan.ts` THEN
  `capadex-1.6-generate-deliverables.ts` (generator reads ONLY scan.json so docs never drift).
- Verdict is STRUCTURAL-only: `STRUCTURAL_COMPLETE_ADOPTION_PENDING`. Adoption/Confidence are
  data-driven, reported SEPARATELY, never a gap. Coverage⟂Confidence⟂Outcome⟂Adoption never composited.
- esbuild-verify edited backend files; NEVER pkill / vite build to validate.

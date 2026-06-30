---
name: Outcome Framework / KPI Engine (CAPADEX 3.0 Phase 1.6)
description: Flag outcomeFrameworkKpiEngine — read-only outcome/KPI composer over existing engines; effectiveness ABSTAINED; mirrors 1.3/1.4/1.5 scaffold.
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
- **Effectiveness is ABSTAINED, not 0.** `composeEffectiveness` reports recommendation/intervention
  SUBSTRATE counts (MEASURED), but `effectiveness_rate` is `null` BY DESIGN — there is no
  decision-time prediction (`predicted_prob_at_decision`) recorded, so a calibrated rate would be
  fabricated. This is the CONFIDENCE axis, distinct from Coverage. Never compute a rate here.
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

# CAPADEX 3.0 · Phase 1.8 — Prioritized Enhancement Plan

> Deliverable 13 · Generated 2026-06-30T16:11:07.376Z · Source of truth: `scan.json` (read-only repo+getter scan, sha256:9c3c909cf5cf, written 2026-06-30T16:11:07.375Z).
> Program-1 capstone certification (Phases 1.1–1.7) against the frozen Product Blueprint.
> Honesty: Structural ⟂ Functional-Integration ⟂ Product-Maturity ⟂ Enterprise-Launch-Readiness (never composited); Coverage⟂Confidence⟂Outcome⟂Adoption; null ≠ 0; never fabricated.

Forward work, ordered by severity. The 4 RESOLVED items are engineering-complete (Adoption-axis volume only). The remaining OPEN items are 0 engineering + 2 Future — none is an open engineering defect closeable inside this phase's zero-DDL boundary. All require human approval; Future items require a new approved phase outside zero-DDL.

## OPEN items (forward work)
| Priority | Gap | Severity | Recommended action |
|---|---|---|---|
| Future | GAP-AI1 AI per-feature attribution depth (LLM-layer accuracy/quality harness internals) | Future | Explainability is rendered and recommendation/intervention calibration is WIRED (1.7, validation-loop — the SAME mechanism that resolves GAP-O1). The ONLY residual scoped to this gap is per-feature attribution depth, which needs NEW DDL = out of Phase 1.8 zero-DDL scope → deferred to a future approved phase. Not closeable here without violating the contract. |
| Future | GAP-S1 Missing dedicated verticals (gov / health / clinical) | Future | NON-CLINICAL scaffold registry only (validated:false / clinical_use:false). Building + validating clinical verticals is net-new architecture (out of Enhancement-Only scope) and is explicitly do-not-claim-until-built. Not closeable here without fabrication. |

## RESOLVED items (no new code — accrue real volume)
| Gap | Was | Engineering mechanism | Adoption residual |
|---|---|---|---|
| GAP-O1 | High | validation-loop calibration: recordValidationOutcome → predicted_prob_at_decision → calibrationFromRows (services/validation-loop-engine.ts, close-the-loop-engine.ts, outcome-kpi-engine.ts, ai-orchestration-engine.ts) | effectiveness_rate stays null until ≥k_min (30) calibrated real pairs accumulate post-launch. |
| GAP-K | Medium | anl_kpi_daily + outcome-kpi-engine.ts KPI-family rollups (routes/enterprise-analytics.ts, services/enterprise-analytics-schema.ts) | business/outcome KPI values stay honest-low until real outcome volume flows. |
| GAP-P1 | Medium | captureProgressionOutcome + getReassessmentSignal (services/capadex/progression-outcome-capture.ts) | real re-administration volume honest 0 until recurring users complete reassessment cycles post-launch. |
| GAP-J | Low | captureJourneyTailMilestone (routes/journey-tail.ts, services/capadex/progression-outcome-capture.ts) | per-persona tail completion accrues as mentor/parent/institution flows are exercised post-launch. |

## Sequencing
1. **Adoption-driven** (GAP-O1/GAP-K/GAP-P1/GAP-J): no new code — accrue real non-demo volume so calibrated effectiveness + business KPIs light up automatically. Tracked on the Adoption axis, never as a gap.
2. **DDL-bounded** (GAP-AI1): per-feature AI attribution depth — propose as a NEW approved phase (outside 1.8's zero-DDL scope). Cannot be closed here without fabrication.
3. **Future** (GAP-S1): dedicated verticals (gov/health/clinical) — do-not-claim until built + validated.

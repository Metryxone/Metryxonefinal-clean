# Program 2 · Phase 2.1 — 07 · Backend Maintainability Report

## 1. Size / hotspots
| File | Lines | Note |
|---|---|---|
| `routes.ts` | 14,524 | monolith; primary maintainability hotspot |
| `storage.ts` | 5,057 | broad data-access surface |
| `routes/capadex.ts` | 4,462 | large domain router |
| `shared/schema.ts` | 3,569 | Drizzle schema (partial — see D5) |
| `routes/capadex-concern-intelligence.ts` | 3,117 | |
| `config/feature-flags.ts` | 2,928 | flag registry |
| `services/competency-runtime.ts` | 2,827 | |
| `routes/employer-portal.ts` | 2,495 | |

## 2. Coupling
- **Healthy reuse:** shared engines (evidence, ontology, validation-loop) and `cohort-gating` (`K_MIN`) are imported widely rather than copy-pasted.
- **Fan-in hotspots (not confirmed cycles):** `enterprise-intelligence-integration.ts` imports ~11 service summaries (integration aggregator by design); CAPADEX 3.0 engines share constants like `REASSESSMENT_FRESHNESS_DAYS` from `services/capadex/progression-outcome-capture.ts`. The exploration *suspected* circular imports, but a shared-constant import is **not** a cycle unless the target imports back — **this was not confirmed**, so it is reported as coupling to watch, not a defect.
- **Near-identical blocks:** `ai-orchestration-engine.ts` and `outcome-kpi-engine.ts` share calibration import/logic (intentional reuse of the validation-loop calibration mechanism). Acceptable; extraction optional.

## 3. Conventions
- Strong, documented conventions exist (flag-gated additive, never-throws reads, `null ≠ 0`, lazy ensure-schema). Where new code follows them, maintainability is good.
- Drift (validation/response/logging — report 03) raises onboarding cost in `routes.ts`.

## 4. Maintainability recommendations (non-breaking, approval-gated)
1. Treat `routes.ts` as **frozen-then-shrinking**: register *new* endpoints only in modular `routes/*.ts`; migrate domains out opportunistically.
2. Adopt `lib/validate.ts` for new/touched routes (incremental).
3. Add a thin logger util; adopt on touch.
4. Document the schema source-of-truth policy (Drizzle vs lazy ensure-schema) so D5 drift is bounded.
5. Confirm and document the `-v2`/bare path split so future readers don't mistake `-v2` for dead code (this report + memory now capture it).

## 5. Verdict
The backend is **maintainable for its scale** with clear conventions; the principal levers are the route monolith and convention drift. None require architectural replacement — all are **incremental, behavior-preserving** improvements, consistent with Enhancement-Only.

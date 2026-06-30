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

## 6. Binding repository policy (Phase 2.1 — adopted)
These are the concrete, enforceable forms of D5/D6/D7/D9/D10. They are deliberately **policy + on-touch adoption**, not big-bang refactors, because a sweeping rewrite of a 14k-line `tsx` file that runs with **no `tsc` gate** (a single syntax slip crashes boot) is exactly the regression the acceptance criteria forbid.

1. **Routes monolith — "frozen-then-shrinking" (D10).** Do **not** add new endpoints to `backend/routes.ts`. Register new endpoints in a modular `backend/routes/<domain>.ts` router. Migrate existing domains out of `routes.ts` opportunistically *when already editing them*, one domain per approved change set with its own restart + smoke. The `-v2`/bare dual registration is **intentional** (the `-v2` module is the active runtime with flags ON) — not dead code.
2. **Request validation (D6).** `backend/lib/validate.ts` is the canonical request-validation gate. New/touched routes adopt it. Working ad-hoc validators are **not** force-migrated (behavior-affecting).
3. **Response shapes (D7).** New endpoints use a consistent response shape. **Existing response shapes are frozen** — clients depend on them, so changing them is a breaking change. Standardize **additively** only.
4. **Logging (D9).** `backend/lib/logger.ts` is the structured logger. Adopt it **on touch** (replace `console.*` in code you're already editing). No global `console` replacement.
5. **Schema source-of-truth (D5).** Drizzle `shared/schema.ts` is the SoT for ORM-accessed tables. Lazy `ensureSchema` raw SQL is the **deliberate, supported** pattern for flag-gated additive runtime tables (flag-OFF must create 0 tables — a Drizzle definition would create them unconditionally). Backfilling Drizzle *type* definitions for raw-SQL tables is **read-only** and may be done on-touch; **no big-bang DDL migration** against the live shared DB.

## 7. Verdict
The backend is **maintainable for its scale** with clear conventions; the principal levers are the route monolith and convention drift. None require architectural replacement — all are **incremental, behavior-preserving** improvements, consistent with Enhancement-Only. The Phase 2.1 binding policy (§6) bounds the drift going forward without incurring rewrite risk.

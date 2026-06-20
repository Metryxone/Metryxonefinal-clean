# Super-Admin Validation Report — Phase 4.12

**Phase:** 4.12 — Career Intelligence Super-Admin Validation
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerValidation` (default OFF) · **Route:** `routes/career-validation.ts` · **Smoke:** `smoke-career-validation.ts` → ✅ 22 passed / 0 failed
**Status:** Operational at engine/API level. Flag-gated, not deployed.

## Purpose
A read-only, compose-only honesty/invariant harness (mirroring Phase 3.12) that validates the entire Phase-4 career-intelligence composition **area-by-area** against a real subject and emits **PASS / WARN / FAIL** per area. It composes every Phase-4 engine plus platform probes; it defines **no DDL** and runs under `tsx` (no typecheck — so wrong-field access surfaces as a checked invariant, not a silent `undefined`).

## Deliverables
- `services/career-intelligence-validation.ts` / `super-admin-career-validation-engine.ts`
- `routes/career-validation.ts` (literal prefix routes before `/:subject`)
- `scripts/smoke-career-validation.ts`
- `careerValidation` flag

## Result (2026-06-20 harness run)
```
runtime_provisioned = true
status = warn
PASS = 6 · WARN = 7 · FAIL = 0
smoke: 22 passed, 0 failed
```

### How to read this (honesty contract)
- **FAIL = 0** → no real break: no out-of-bounds score, no band/score incoherence, no fabricated fire. This is the load-bearing result.
- **WARN = 7** → **honest absence**, not defects. WARNs flag areas where the demo subject lacks sufficient data (e.g., no measured onto-domain baseline for simulation; sparse future-readiness inputs), which the engines correctly report as `unmeasured` rather than fabricating.
- An overall `status=warn` is the expected, honest verdict for a subject with partial data — WARN never masquerades as PASS, and absence never masquerades as a measured value.

## Validation invariants checked
- Coverage vs Confidence reported as separate axes everywhere (never composited).
- No score outside its declared band; band labels coherent with numeric scores.
- No fabricated "fire" (a signal/recommendation never emitted on absent evidence).
- GET-never-writes across the composed read paths (`to_regclass` before/after).
- Append-only history tables never mutated in place.
- Each area wrapped in its own try/catch → a throwing area FAILs only that area; an existing-but-unreadable table is FAIL (not silent PASS).

## Honest gaps
- The validation harness exercises the **backend** composition. It does not assert frontend surfacing, because the user-facing surfaces (Steps 2–5) are not yet wired — that remains the principal open item for Phase 4 end-to-end.

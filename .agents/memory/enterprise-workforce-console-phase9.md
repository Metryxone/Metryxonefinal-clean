---
name: Enterprise Workforce Console (MX-100X Phase 9)
description: Read-only flag-gated console composing predictive-workforce (Phase 5) + M5 engines into 7 workforce views; naming-collision + derivation traps.
---

# Enterprise Workforce Intelligence Console (MX-100X Phase 9)

Read-only, flag-gated console that COMPOSES the EXISTING predictive-workforce (Phase 5) and M5
enterprise engines into ONE super-admin surface with 7 views: skill-gap, succession,
internal-mobility, workforce-planning, talent-risk, talent-forecasting, readiness-forecasting.

## Naming collision (the big one)
The planned names `workforceIntelligence` / `routes/workforce-intelligence.ts` /
`/api/workforce-intelligence/*` ALL ALREADY EXIST — they are Phase 5.12, an **employer-scoped**
engine. Reusing them would have shadowed/clobbered a live surface.
**Resolution:** distinct namespace everywhere —
- flag `enterpriseWorkforceConsole` (env `FF_ENTERPRISE_WORKFORCE_CONSOLE`)
- base `/api/enterprise-workforce/*`
- `services/enterprise-workforce-console.ts` + `routes/enterprise-workforce-console.ts`.
**Why:** Phase 5.12 is employer/org-scoped; Phase 9 is the platform-wide super-admin console over
the same engines. Lesson: always grep the planned flag/route/file names before writing — the plan
file's names were stale against the live tree.

## Compose-never-recompute + fabricated-sentinel traps
The predictive-workforce + M5 engines were built for their own surfaces and SILENTLY EMIT
fabricated sentinels on empty inputs — a composing read-only console must gate measurability on
the SOURCE EVIDENCE, never on the returned value:
- `recomputeOrgRiskSnapshot` WRITES — never call it from a GET. Use only the SELECT-only readers.
- `m5-workforce-simulation.futureForecast` hardcodes avg=60 on 0 capability rows → guard on the real
  capability row count and abstain.
- `m5-workforce-intelligence.readiness()` returns `{readiness_score:0, departments:[]}` on 0 dept
  rows → that 0 is NOT a measured score; treat enterprise readiness measurable ONLY when
  `departments` is non-empty, else surface null (code review caught this one).
- Deterministic what-if `simulateScenario` needs a headcount/attrition baseline the platform doesn't
  record → don't auto-run with a fabricated baseline; surface the scenario LIBRARY only + note it.

## Honesty mechanics reused
- Trend math is the single existing impl `services/wc3/longitudinal-consumption.ts`
  (`leastSquaresSlope` / `directionOf` / `STABLE_DEADBAND`). Forecast abstains below
  `MIN_TREND_POINTS=2` — abstained trend emits slope/direction/forecast_next all `null` (never a
  fabricated 0).
- k-anonymity `K_MIN=30`: any cohort AVERAGE over `< 30` distinct people/subjects is suppressed
  (value `null` + explicit reason). Per-individual trends are NOT cohort aggregates, so they still
  render (e.g. the single demo subject's readiness trend).
- Every view returns one honest envelope: `{view, available, abstained (XOR available), reason,
  provenance:{engines,tables,notes}, data}`. `safeCall` makes each view degrade to
  `abstained:true` rather than failing the request; `tableExists` is a `to_regclass` probe (no DDL).

## Internal-mobility is DERIVED
There is no dedicated internal-mobility population. Mobility readiness is derived from the
succession candidates' `mobility_alignment` dimension (provenance stamped
`succession_candidates`) — disclosed in the view's notes, not presented as a first-class source.

## Trend data plumbing
Snapshot timestamp cols are `captured_at` EXCEPT `career_readiness_history` = `created_at` (easy to
get wrong → empty trend). A single-subject readiness history correctly yields a rendered per-subject
trend but a SUPPRESSED cohort average (n<30) — per-individual trend is not a cohort aggregate.

## Gating
Base path is NOT under `/api/admin/*`, so the global admin gate does NOT apply — routes carry
inline `gate → requireAuth → requireSuperAdmin` (gate fires first → 503 before any auth/DB touch
when flag OFF). Workflow command leaves the flag OFF, so HTTP smoke asserts status ∈ {401,403,503}.

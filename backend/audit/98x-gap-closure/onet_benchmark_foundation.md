# O*NET Benchmark Foundation (capability 5 of 5)

**Engine:** `getBenchmarkFoundation` in `services/onet-activation.ts` (composes `generateRoleBenchmark`).
**Route:** `GET /api/v2/onet-activation/benchmark/:roleInput` (flag-gated, read-only).

## What it reports
- **Benchmark positioning** — from the existing `generateRoleBenchmark` (reads `ti_role_benchmarks`, 60 rows).
- **Library coverage** — `benchmarkRows` (live count of `ti_role_benchmarks`) so a caller can see the denominator behind any abstention.

## Abstain-by-default honesty
`ti_role_benchmarks` is keyed by role **family** name. A role-level lookup with no matching family row returns `available:false` with a reason — **never an invented percentile**. Unresolved role → `benchmark.available:false`, `reason:'unresolved_role'`.

## Why benchmark coverage is lower than DNA coverage
DNA reaches 1,021 roles (via competency links), but benchmarks only exist for 60 families. This gap is **reported, not hidden**: `libraryCoverage.benchmarkRows` exposes it directly. Closing it requires more benchmark source data (out of scope for additive Phase 1) — we do not fabricate to fill it.

## Rollback / impact
Read-only; no write path; no schema impact. Flag-OFF → 503.

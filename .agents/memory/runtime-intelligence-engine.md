---
name: Runtime Intelligence Engine (MX-800 2.4)
description: Read-only composer over health-aggregator + live process/OS/pg measurements; honesty traps around null-on-error and availability denominators.
---

# Runtime Intelligence Engine (MX-800 Phase 2.4)

Flag `runtimeIntelligenceEngine` / `FF_RUNTIME_INTELLIGENCE_ENGINE` (default OFF). Base
`/api/admin/runtime-intelligence`. Service `services/runtime-intelligence.ts`, route
`routes/runtime-intelligence.ts`, migration `20261223_runtime_intelligence.sql` (tables
`runtime_component_registry` + `runtime_intelligence_audit_snapshots`). Reuse export
`computeAllHealthDomains(pool)` in `routes/health-aggregator.ts` (route untouched).

## Durable lessons

- **Flag naming collision:** `runtimeIntelligence{Activation,Pipeline,Consumption}` already exist
  and are UNRELATED. A new runtime-intelligence phase must NOT reuse those — pick a distinct name
  (here `runtimeIntelligenceEngine`) or you silently gate the wrong subsystem.

- **null ≠ 0 lives in the DB helpers, not just the callers.** A read composer's `scalar()`/`rows()`
  helpers MUST return `null` on query ERROR and reserve `0`/`[]` for a genuinely empty result. If
  they swallow errors into `0`/`[]`, every downstream count conflates "couldn't measure" with
  "measured zero" — an honesty FAIL even when all the arithmetic is correct. Architect blocked the
  first cut precisely on this. `pct(n,d)` likewise returns null when numerator is null OR denom is
  0/null (no fabricated 0%). After changing the helper signatures, EVERY call site needs a guard
  (`?.[0]`, `if (r == null)`, `?? []`) or null reaches `.length`/arithmetic.

- **Availability denominator must exclude the unmeasurable, not just the unmeasured-by-design.** A
  measurable service whose probe is UNREADABLE (status `unknown`) must be dropped from BOTH numerator
  and denominator of `availability_pct` — counting it as "not up" fake-deflates the ratio
  (`null ≠ down`). Configured-only external services (separate processes) are already excluded as
  honest-null.

- **Metrics are SIX SEPARATE measured scores, deliberately NO composite/overall** (application_health,
  performance_health, resource_health, service_availability, observability_coverage,
  runtime_stability_trend). `runtime_stability_trend` needs ≥2 snapshots → null until POST
  `/audit/capture` runs twice.

- **Honest-null deferrals (no fabrication):** throughput / p95 (no load tooling), tracing pipeline,
  service-dependency call-graph, cgroup/disk limits — all honest-null, NOT 0.

- **Soft lifecycle link:** `lifecycle_uid` soft-references MX-700 `platform_lifecycle_catalog` ONLY
  when that table is present (ABSENT in this DB → null). Discover never fabricates the link.

- **Flag discipline:** OFF byte-identical incl. schema — route gate 503 BEFORE auth/DDL, but the
  global `app.use('/api/admin')` auth gate fires first so OFF smoke (incl. `/enabled`) is
  `∈ {401,403,503}`. Writes assert flag THEN ensure-schema → 0 tables OFF; reads use `to_regclass`
  probes (never DDL) → `ready:false` when absent.

- **Validator:** `scripts/mx800-2.4-runtime-validate.ts` run with `FF_RUNTIME_INTELLIGENCE_ENGINE=1`
  → 46/46; drops both tables at start AND end (restores byte-identical OFF). tsx scripts must live
  inside `backend/`.

Contract strings: `Running ≠ Healthy ≠ Stable ≠ Scalable` · `ResponseTime ≠ Performance` ·
`Error-Free ≠ Reliable` · `Configured ≠ Running ≠ Healthy` · `Built ≠ Activated`.

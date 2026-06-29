# MX-800 Phase 2.4 — Runtime Intelligence Engine (Implementation)

**Status:** Built · flag-gated OFF byte-identical (incl. schema) · validator 46/46 · architect APPROVED · **STOP for approval — NO deploy.**

## What this is
An **ENHANCEMENT-ONLY, read-only** intelligence tier that **COMPOSES** the already-shipped
`health-aggregator` runtime checks with **live process / OS / pg measurements**. It introduces no
new business logic, no parallel/duplicate registry or engine, no rebuild/V2, and **no dormant
activation** (nothing is turned on by building this — it only observes).

- **Flag:** `runtimeIntelligenceEngine` / `FF_RUNTIME_INTELLIGENCE_ENGINE` (default **OFF**).
  Helper `isRuntimeIntelligenceEngineEnabled()` in `backend/config/feature-flags.ts`.
  Name chosen because `runtimeIntelligence{Activation,Pipeline,Consumption}` are pre-existing,
  unrelated flags.
- **Base:** `/api/admin/runtime-intelligence`
- **Service:** `backend/services/runtime-intelligence.ts`
- **Route:** `backend/routes/runtime-intelligence.ts` (`registerRuntimeIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`), wired in `routes.ts`.
- **Migration:** `backend/migrations/20261223_runtime_intelligence.sql` — 2 tables
  `runtime_component_registry` + `runtime_intelligence_audit_snapshots`.
- **Reuse export:** ONE additive `computeAllHealthDomains(pool)` in `routes/health-aggregator.ts`
  (the existing route is **untouched**; the export composes the private `DOMAINS` and returns
  `{ overall_score, overall_status, domains[] }`).

## 10 parts
1. **Runtime Registry** — `/registry`, `/registry/:uid`, POST `/discover`, POST `/register`.
   Discovery composes the live component set; `lifecycle_uid` **soft-links** the MX-700
   `platform_lifecycle_catalog` only when that table is present (ABSENT in this DB → honest null,
   never fabricated). `lifecycle_state` MANAGED ⟂ `activation_state` DERIVED.
2. **Application Health** — `/application-health` composes `computeAllHealthDomains` (no recompute).
3. **Performance** — `/performance`: DB round-trip latency (3-sample) + event-loop lag **MEASURED**;
   throughput / p95 **honest-null** (no load tooling — `ResponseTime ≠ Performance`).
4. **Service** — `/service`: postgres + session-store **MEASURED** (status up|down|unknown);
   MongoDB + upload-service are **configured-only** (separate processes, not probed → honest-null).
   Availability is computed **only over services actually measured** (status up|down); a measurable
   service whose probe is unreadable (`unknown`) is excluded from numerator AND denominator
   (`null ≠ down`).
5. **Observability** — `/observability`: snapshot tables + feature-flag registry **MEASURED**
   present/populated (tri-state `true|false|null`); tracing/metrics-pipeline honest-null.
6. **Resource** — `/resource`: process memory (rss/heap), OS mem + load + cores, pool stats, db
   size **MEASURED**; cgroup/disk **honest-null** (`Configured ≠ Running ≠ Healthy`).
7. **Runtime Reasoning** — `/reasoning`: read-only findings (DOWN/DEGRADED domains, latency, memory
   headroom) with contract framing — never a verdict, never mutates.
8. **Validation** — `/validation`: **STRUCTURAL** verdict only (presence/wiring), explicitly NOT a
   runtime/outcome confidence claim.
9. **Metrics** — `/metrics`: **SIX SEPARATE MEASURED scores** — `application_health`,
   `performance_health`, `resource_health`, `service_availability`, `observability_coverage`,
   `runtime_stability_trend`. **Deliberately NO composite / "overall"**. Any score is `null` when
   its denominator is 0 or its substrate is unreachable.
10. **Verification** — `/summary` composes all; `/audit/drift`, `/audit/snapshots`, POST
    `/audit/capture` (the ONLY write path; owns lazy ensure-schema). Validator
    `backend/scripts/mx800-2.4-runtime-validate.ts`.

## Honesty contract (enforced + measured)
- `null ≠ 0`. The DB helpers `scalar()`/`rows()` return **null on query ERROR** (0/`[]` only for a
  genuinely empty result); `pct(n,d)` returns null when the numerator is null or denom is 0/null
  (no fabricated 0%). Call sites propagate the distinction: unreadable registry rows →
  `measurement_error`; unreadable session count → service status `unknown` (excluded from
  availability); unreadable observability counts → `populated: null`.
- `Running ≠ Healthy ≠ Stable ≠ Scalable` · `ResponseTime ≠ Performance` · `Error-Free ≠ Reliable`
  · `Configured ≠ Running ≠ Healthy` · `Built ≠ Activated`.
- Coverage ⟂ Confidence ⟂ Evidence ⟂ Health — never composited.

## Flag discipline
- OFF is **byte-identical incl. schema**: route gate returns **503 before auth/DDL**; the global
  `app.use('/api/admin')` auth gate fires first, so OFF smoke on every endpoint (incl. `/enabled`)
  is `∈ {401, 403, 503}`. No tables are created OFF.
- All writes assert the flag **then** ensure-schema → OFF creates 0 tables. Reads use
  `to_regclass` probes (never DDL) → `ready: false` when a table is absent.

## Verification
- `cd backend && FF_RUNTIME_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.4-runtime-validate.ts`
  → **46 passed, 0 failed**; cleanup drops both tables (0 tables, byte-identical OFF).
- OFF smoke (flag absent): all endpoints `∈ {401, 403, 503}`; no tables created.
- DB is pg 16.10; `platform_lifecycle_catalog` ABSENT → discover soft-links only when present
  (honest null).

## Architect review
APPROVED. The one prior blocking honesty issue (helpers collapsing unknown/error into `0`/`[]`) is
**resolved** — re-review confirmed null-preservation and correct call-site propagation, with no new
regressions and byte-identical-OFF intact.

## No frontend
STOP clause — no SuperAdmin panel in this phase (read APIs only).

## Next
MX-800 Phase 2.5 = Knowledge Intelligence (future phase). Freeze after approval.

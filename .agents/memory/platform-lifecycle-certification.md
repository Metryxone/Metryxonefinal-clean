---
name: Platform Lifecycle Intelligence Production Certification (MX-700 Phase 1.43)
description: Final-phase read-only certification composer over the 1.37–1.42 lifecycle tiers; traps when integrating + certifying a stack of flag-gated tiers without drifting from them.
---

# Platform Lifecycle Intelligence Production Certification (MX-700 Phase 1.43)

Flag `platformLifecycleCertification` / `FF_PLATFORM_LIFECYCLE_CERTIFICATION` (default OFF). Read-only
composer that integrates + validates + certifies the existing 1.37 Foundation / 1.38 Management /
1.39 Intelligence / 1.40 Evolution / 1.41 Automation / 1.42 Operations tiers and emits MEASURED
certification reports. NO new engine/persistence/migration/business-logic; no dormant activation.

## Durable lessons

- **Gather each tier getter EXACTLY ONCE, in parallel — do not let part-builders each call getters.**
  **Why:** the lifecycle getters are individually expensive (1.40 evolution ~6s, 1.41 automation summary
  ~9s, automation metrics ~8s, intelligence metrics ~3s). The first draft had each of the 10 parts +
  the pre-integration audit call getters independently, so several were invoked 3–4× and the composer
  ran >90s and was killed by the tooling timeout. **How to apply:** compute one `gather(pool)` bag with
  `Promise.all`, hand the bag to pure (sync) part-builders, and key the per-tier audit `getter_ready`
  off the same bag. A composer that re-runs the engines it certifies can also drift from them.

- **Honest performance: only composition latency is measurable here.** No load-testing tooling exists,
  so throughput / p95 are `null` (never estimated). The measured `composition_latency_ms` is the
  wall-clock of the single parallel gather (~20s) — report it as-is, don't dress it up.

- **Four readiness axes stay SEPARATE; Production-Ready is WITHHELD by design.** structural_quality ⟂
  integration ⟂ validation ⟂ production_confidence. `production_confidence = null` (unmeasurable, not 0)
  because the subsystem has no runtime adoption + realized-outcome evidence. Verdict is
  `STRUCTURAL_CERTIFIED`; never composite the axes into a production-confidence number.

- **Certify by repository SSoT, not by re-asserting.** Route-registration is measured by grepping the
  register fn name in `routes.ts`; service/migration presence via `fs.existsSync`; "no duplicate
  architecture" via a filename scan for `platform-(lifecycle|evolution)*(v2|-2|copy|clone|parallel|new)`.
  1.42 is a frontend-exposure phase → it legitimately has NO service/getter/migration; encode that as
  `null` (by-design) not as a failure.

- **OFF smoke is {401,403,503}, not 503 alone.** The global `app.use('/api/admin')` auth gate fires
  before the route's own flag gate, so even `/enabled` returns 401 when unauthenticated. 401 ≠ 404 still
  proves the route is registered. (Documented platform-lifecycle behavior; mirrors 1.39–1.41.)

- **Route signature mirrors automation:** `(app, concernsPool, requireAuth, requireSuperAdmin)`; `concernsPool`
  is the in-scope pool var in routes.ts. 1.42 operations is the odd one out — it takes no pool (probe-only).

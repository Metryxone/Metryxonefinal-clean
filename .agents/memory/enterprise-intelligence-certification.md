---
name: Enterprise Intelligence Certification (MX-800 2.14)
description: FINAL MX-800 phase — read-only certification composer over the 2.1–2.13 intelligence tiers; pattern + the tier-2.7 route-file trap.
---

# Enterprise Intelligence Certification (MX-800 Phase 2.14)

FINAL phase of the MX-800 program. Flag `enterpriseIntelligenceCertification` /
`FF_ENTERPRISE_INTELLIGENCE_CERTIFICATION` (default OFF). ENHANCEMENT-ONLY read-only certification composer
that mirrors MX-700 1.43 EXACTLY: composes the existing MX-800 tier getters ONCE in parallel + repo fs scans
into 10 measured cert parts. NO new engine/V2/parallel/duplicate service, NO business-logic change, NO dormant
activation, NO migration/persistence, NO frontend.

## Rules that matter
- **Getters gathered EXACTLY ONCE in parallel** (`gather()` → `Promise.all` of `safe()` probes), then the bag
  is reused by pure sync part-builders. Per-part getter re-calls → timeout + drift. Composition of all tier
  getters is slow (~50s wall-clock) → a CLI/script run easily exceeds a 30s tool timeout; run it to a log file
  and poll, don't assume it died.
- **FOUR axes never composited**: Structural ⟂ Integration ⟂ Validation ⟂ Production-Confidence.
  `production_confidence=null`, verdict `STRUCTURAL_CERTIFIED`, **Production-Ready WITHHELD by design** (no
  runtime-adoption + realized-outcome evidence for these internal subsystems).
- **Maturity** per-domain Level 0–5; report the FLOOR (not a composite/average); ceiling = **Managed (L3)**;
  Levels 4–5 WITHHELD (no measured autonomous-optimization / runtime-adoption evidence; human approval mandatory).
- **Performance is HONEST**: only `composition_latency_ms` measured; throughput/p95 = null (no load tooling). null≠0.
- **Release baseline** = MEASURED fs snapshot (service/route/migration/docs/memory counts + flag on/off) +
  phase freeze list 2.1–2.14. `repository_commit=null` (read-only composer invokes no git). `baseline_frozen`
  is a STRUCTURAL marker, NOT a deployment.
- **Zero persistence**: no migration, no ensure-schema, no write path. The certification is computed on demand.
- **OFF smoke**: route gate 503 before auth/DDL, but the global `/api/admin` auth gate fires first → OFF
  unauthenticated returns 401 (∈ {401,403,503}).
- Script enables the 12 tier `FF_*` + the cert flag for ITS OWN process only (env override). Flags do NOT seed
  data — dormant substrate stays honestly empty (`getter_ready=null`).

## The tier-2.7 route-file trap (cost real debugging)
The plan/spec table listed 2.7's registerFn as `registerPredictiveIntelligenceRoutes` — that actually belongs
to a **separate pre-existing** predictive system (`routes/predictive-intelligence.ts`), NOT the MX-800 2.7
engine. There are THREE predictive route files: `predictive-intelligence.ts` (older system,
`registerPredictiveIntelligenceRoutes`), `predictive-intelligence-engine.ts` (**the real 2.7**,
`registerPredictiveIntelligenceEngineRoutes`, flag `predictiveIntelligenceEngine`, getter `getPredictiveSummary`),
and `predictive-intelligence-v2.ts` (a V2 of the *older* system, different mount `/api/v2/predictive` + flag
`predictiveIntelligenceV2`).
**Why:** when 2.7's `routeFile` was set to `predictive-intelligence.ts`, the duplicate scan stripped to base
`predictive-intelligence` and false-matched the unrelated `predictive-intelligence-v2.ts`, wrongly failing
`no_duplicate_implementation` / `repository_certified`.
**How to apply:** trust the repository (routes.ts imports), NOT the plan table, when mapping a tier to its
route file/registerFn. A certified tier must be keyed by its service+flag+getter triple, and its route file is
whatever routes.ts actually registers for that triple. Pre-existing `-v2` files belonging to *other* systems
are out of scope for a tier-duplication check.

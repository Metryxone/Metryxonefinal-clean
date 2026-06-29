---
name: Predictive Intelligence Engine (MX-800 2.7)
description: Read-only tier cataloging EXISTING prediction capabilities + composing prior intelligence tiers; the name-collision trap and how OFF stays byte-identical.
---

# Predictive Intelligence Engine (MX-800 Phase 2.7)

Flag `predictiveIntelligenceEngine` / `FF_PREDICTIVE_INTELLIGENCE_ENGINE` (default OFF). ENHANCEMENT-ONLY read-only tier that CATALOGS the platform's EXISTING forecast/trend/risk/simulation/scenario/readiness capabilities and COMPOSES prior tiers (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision). Never duplicates an engine, never invokes a dormant engine, never generates a forecast, never decides. SIMULATION ONLY.

## The name-collision trap (the expensive lesson)
**Why:** A PRE-EXISTING tracked `backend/routes/predictive-intelligence.ts` already existed (per-user prediction module, BASE `/api/predictions` + `/api/admin/predictions`, export `registerPredictiveIntelligenceRoutes`). Writing a new `predictive-intelligence.ts` SILENTLY OVERWROTE it — the build still "worked" until you noticed the original handlers were gone.

**How to apply:** Before creating a service/route file for a new intelligence tier, GREP the repo for the bare name first (`predictive-intelligence`, `decision-intelligence`, etc.) — older per-user modules squat the obvious name. Use a distinguishing suffix (`-engine`) for BOTH the filename AND the exported `register*Routes` function, and pick a BASE that does not overlap the legacy one. Recover an overwrite with `git show HEAD:path > path` (read-only, not a destructive git command). This tier lives at `*-engine.ts`, export `registerPredictiveIntelligenceEngineRoutes`, BASE `/api/admin/predictive-intelligence` (legacy `/api/admin/predictions/*` left untouched).

## Honesty contract specifics
- 5 SEPARATE metrics, NO composite: `forecast_confidence` (STRUCTURAL verifiability, NOT accuracy), `prediction_quality` (structural), `trend_accuracy` (**honest-NULL** — runtime accuracy needs labelled outcomes that don't exist), `risk_prediction_coverage`, `explainability_score`.
- `forecast_consistency` validation check is STRUCTURAL self-consistency (valid kind + a substrate handle), explicitly NOT forecast accuracy — name it so reviewers don't read it as an accuracy claim.
- Population is exact `COUNT(*)` (never `n_live_tup`); absent table → count NULL (≠ 0). 13 existing prediction tables are COUNT-only read; the tier OWNS only `prediction_registry` + `predictive_intelligence_audit_snapshots`.

## Proving "engines never invoked / reads never write"
The validator records exact `COUNT(*)` on all 13 prediction sentinel tables BEFORE the read parts and asserts unchanged AFTER. Empirical non-mutation + static fact (engine source files are checked with `fs.existsSync`, never imported) together close the claim. A per-run COUNT diff cannot mathematically prove absence of side effects — pair it with the static "existence-read-only" inspection in the deliverable.

## Self-referential repo refs gotcha
The service's `REPO_REFS` and the `repository_integrity` validation check must point at the tier's OWN `*-engine.ts` files — NOT the legacy `predictive-intelligence.ts`. Because the legacy files exist, a wrong reference still passes the check while silently verifying the wrong files. Caught in review; fixed to `-engine` paths.

## Flag-gate depth
Route `gate` returns 503 before auth/DB when OFF; every service write path (`discoverPredictions`/`registerPredictionCapability`/`capturePredictiveSnapshot`) calls `assertEnabled()` before `ensurePredictiveSchema()` (defense-in-depth so a direct/tooling caller can't create schema OFF). Global `/api/admin` auth gate means OFF smoke returns 401 (∈ {401,403,503}); the flag gate still enforces disabled behaviour. Validator: `scripts/mx800-2.7-predictive-validate.ts` (56/56, run with the FF set).

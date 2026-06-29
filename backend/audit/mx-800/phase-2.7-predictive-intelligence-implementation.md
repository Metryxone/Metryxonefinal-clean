# MX-800 Phase 2.7 — Predictive Intelligence Engine (implementation)

**Status:** Implemented, flag OFF by default (`predictiveIntelligenceEngine` / `FF_PREDICTIVE_INTELLIGENCE_ENGINE`). Byte-identical legacy behaviour incl. schema when OFF. **STOP for approval — NO deploy.**

**Validator:** `backend/scripts/mx800-2.7-predictive-validate.ts` → **56/56 passed, 0 failed** (run with `FF_PREDICTIVE_INTELLIGENCE_ENGINE=1`).

**Architect code review:** PASS — no blocker-level defects; collision resolved; honesty + flag contracts materially enforced.

---

## What this is

An ENHANCEMENT-ONLY, READ-ONLY intelligence tier ABOUT the platform's prediction capabilities. It **catalogs** the EXISTING forecast / trend / risk / simulation / scenario / readiness capabilities the platform already makes, and **composes** the prior intelligence tiers (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision) into explainable predictive intelligence (registry / trend / risk / impact-simulation / scenario / explainability / validation / metrics).

It introduces **NO** parallel prediction / forecast / analytics engine, **DUPLICATES** no model, and changes **NO** business logic. It **INVOKES / ACTIVATES** no dormant prediction engine — it reads each engine's **EXISTENCE** (source file on disk) and its **PERSISTED OUTPUT** (forecast/trend/risk tables, COUNT-only) only. It **never generates** a new forecast/risk/simulation/scenario and **never decides**. The repository + the existing prediction tables remain the single source of truth.

### Critical implementation note — name collision (resolved)
A PRE-EXISTING tracked module `backend/routes/predictive-intelligence.ts` (a per-user prediction module, BASE `/api/predictions` + `/api/admin/predictions`, export `registerPredictiveIntelligenceRoutes`) was accidentally overwritten during initial authoring and was **restored from git**. This phase's code was moved to `-engine` filenames with a renamed export and a non-colliding BASE:
- service `backend/services/predictive-intelligence-engine.ts`
- route `backend/routes/predictive-intelligence-engine.ts` → export `registerPredictiveIntelligenceEngineRoutes`, BASE `/api/admin/predictive-intelligence`
- both modules now register side-by-side in `routes.ts`; bases do not overlap; legacy `/api/admin/predictions/*` is intact.

---

## Surface

**Service** `backend/services/predictive-intelligence-engine.ts` (9 parts + registry/discovery + summary + audit):
- Part 1 `getPredictionCatalog` — curated, DB+file-verified catalog of 13 EXISTING prediction capabilities (forecast/readiness/trend/risk/simulation/scenario) across 8 domains. Each: persisted `table` (read-only COUNT-only) and/or `engine` source file (existence-read), governing `flag` state (Built ≠ Activated), soft `intelligence_uid`.
- Part 2 `getTrendIntelligence` — surfaces EXISTING trend capabilities + composes prior tiers. Trend ≠ Future.
- Part 3 `getRiskPrediction` — surfaces EXISTING risk capabilities + composes prior tiers. Probability ≠ Certainty.
- Part 4 `getImpactSimulation` — SIMULATION ONLY; reads existing simulation substrate; `production_safety.modifies_production=false`, `write_paths_to_business_tables=0`. Simulation ≠ Reality.
- Part 5 `getScenarioIntelligence` — frames 7 scenario framings over the EXISTING scenario substrate; never asserts an outcome.
- Part 6 `explainPrediction(uid)` — why / evidence / structural confidence / assumptions / alternatives / repo+knowledge+runtime refs / governance(human-approval mandatory). Unknown uid → `found:false` (no fabrication).
- Part 7 `getPredictionValidation` — STRUCTURAL only (7 checks: repository/model/evidence/prediction/trail/forecast-consistency/registry). `forecast_consistency` is STRUCTURAL self-consistency, explicitly **NOT** forecast accuracy. Verdict ∈ {STRUCTURAL_VALIDATED, PARTIAL, ABSENT}.
- Part 8 `getPredictionMetrics` — **5 SEPARATE** measured scores, **NO composite** (`composite:null`):
  `forecast_confidence` (confidence, STRUCTURAL verifiability), `prediction_quality` (structural), `trend_accuracy` (accuracy — **honest-NULL**, unmeasurable: no labelled outcomes), `risk_prediction_coverage` (coverage), `explainability_score` (evidence).
- `getPredictiveSummary` composes registry/catalog/metrics/validation/tiers.
- Audit: `capturePredictiveSnapshot` (ONLY write path beyond discover/register — owns lazy ensure-schema), `getPredictiveSnapshots`, `getPredictiveDrift` (needs ≥2 snapshots; null delta = a side unmeasured).
- Registry: `discoverPredictions` (upsert; `owner`/`lifecycle_uid` deliberately excluded from UPDATE set → re-discovery never clobbers MANAGED fields), `registerPredictionCapability` (manual; rejects unsafe table identifiers), `getPredictionRegistry`, `getPredictionCapability`.

**Route** `backend/routes/predictive-intelligence-engine.ts` — BASE `/api/admin/predictive-intelligence`. `/enabled` (persona-agnostic probe), `gate` (503 before auth/DB when OFF), `/feature-flag`, GET reads (summary/catalog/trend/risk/simulation/scenario/validation/metrics/registry/audit-drift/audit-snapshots/explain/:uid/registry/:uid), POST writes (discover/register/audit/capture). Literal sub-paths before `:uid` params.

**Migration** `backend/migrations/20261226_predictive_intelligence.sql` — 2 OWNED tables: `prediction_registry` + `predictive_intelligence_audit_snapshots` (mirrors the lazy `ensurePredictiveSchema`). Never creates/alters any EXISTING prediction table.

**Flag** `backend/config/feature-flags.ts` — `predictiveIntelligenceEngine: false` + `isPredictiveIntelligenceEngineEnabled()`.

---

## Honesty contract (enforced + verified)

- **null ≠ 0.** Population is exact `COUNT(*)` (NEVER `pg_stat` `n_live_tup`); absent table → `present:false`, count NULL; query error → NULL (≠ empty). `pct()` returns null on null numerator or 0/null denominator.
- **Metrics are 5 SEPARATE scores; NO composite/overall.** Blending would hide honest gaps.
- **forecast_confidence is STRUCTURAL only** (substrate verifiability), not runtime/outcome/accuracy.
- **trend_accuracy is honest-NULL (DEFERRED)** — runtime forecast/trend accuracy requires labelled prediction outcomes (absent). This tier surfaces prediction SUPPORT; it never measures whether a forecast came true.
- **Coverage ⟂ Confidence ⟂ Evidence** — separate axes, never blended. Forecast ≠ Fact; Probability ≠ Certainty; Simulation ≠ Reality; Trend ≠ Future; Confidence ≠ Accuracy; Prediction ≠ Decision. Human approval mandatory.
- **Byte-identical OFF incl. schema** — route gate 503 before auth/DDL; every service write path asserts the flag before ensure-schema (defense-in-depth); reads never ensure-schema. OFF creates 0 tables.
- **SIMULATION ONLY** — production never modified; no write to any business table.
- **MANAGED fields** (`owner`, `lifecycle_uid`) are honest-NULL when unassigned and survive re-discovery.

## What the validator proves (56 checks)
- All 9 parts return the contracted shapes; metrics 5-separate/no-composite; trend_accuracy null; honesty axes asserted.
- **Reads NEVER write**: exact `COUNT(*)` on **13** existing prediction sentinel tables is unchanged before vs after exercising every read part.
- **Engines NEVER invoked**: e.g. `competency_forecasts` and `m4_simulation_forecasts` counts unchanged (the engines are existence-checked via `fs.existsSync`, never imported/invoked — confirmed by static review).
- **Injection rejected**: `/register` rejects a malicious `physical_table` identifier; no row written; target table survives.
- **Cleanup** drops both OWNED tables → 0 tables (byte-identical OFF).

## Smoke (flag OFF, live Backend API)
All `/api/admin/predictive-intelligence/*` endpoints return **401** (global `/api/admin` auth middleware fires before the route-level flag gate; OFF smoke ∈ {401,403,503} per platform convention — the flag gate still enforces disabled behaviour). Legacy `/api/admin/predictions/dashboard` returns 401 (intact). OWNED tables absent.

## STOP
Additive phase complete. **STOP for approval before merge/deploy. NO deploy.** Next: MX-800 Phase 2.8 — Recommendation Intelligence.

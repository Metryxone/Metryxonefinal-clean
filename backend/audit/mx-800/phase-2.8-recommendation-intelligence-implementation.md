# MX-800 Phase 2.8 — Recommendation Intelligence Engine (implementation)

**Status:** Implemented, flag OFF by default (`recommendationIntelligenceEngine` / `FF_RECOMMENDATION_INTELLIGENCE_ENGINE`). Byte-identical legacy behaviour incl. schema when OFF. **STOP for approval — NO deploy.**

**Validator:** `backend/scripts/mx800-2.8-recommendation-validate.ts` → **62/62 passed, 0 failed** (run with `FF_RECOMMENDATION_INTELLIGENCE_ENGINE=1`).

**Architect code review:** PASS — no blocker-level defects; honesty + flag + recommend-only contracts materially enforced.

---

## What this is

An ENHANCEMENT-ONLY, READ-ONLY intelligence tier ABOUT the platform's recommendation capabilities. It **catalogs** the EXISTING recommendation / opportunity / intervention / optimization capabilities the platform already produces, and **composes** the prior intelligence tiers (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive) into explainable recommendation intelligence (registry / action / opportunity / prioritization / prescriptive / explainability / validation / metrics).

It introduces **NO** parallel recommendation / prescriptive / optimization engine, **DUPLICATES** no model, and changes **NO** business logic. It **INVOKES / ACTIVATES** no dormant recommendation engine — it reads each engine's **EXISTENCE** (source file on disk) and its **PERSISTED OUTPUT** (recommendation/opportunity/intervention tables, COUNT-only) only. It **never generates** a new recommendation/opportunity and **never decides / executes / automates**. The repository + the existing recommendation tables remain the single source of truth.

---

## Surface

**Service** `backend/services/recommendation-intelligence-engine.ts` (9 parts + registry/discovery + summary + audit):
- Part 1 `getRecommendationCatalog` — curated, DB+file-verified catalog of **20 EXISTING recommendation capabilities** across **16 domains** and **4 kinds** (recommendation/opportunity/intervention/optimization). Each: persisted `table` (read-only COUNT-only) and/or `engine` source file (existence-read), governing `flag` state (Built ≠ Activated), soft `intelligence_uid`.
- Part 2 `getActionIntelligence` — surfaces EXISTING action/recommendation capabilities + composes prior tiers. Recommendation ≠ Execution. `execution_safety.executes_actions=false`, `automates_actions=false`, `write_paths_to_business_tables=0`.
- Part 3 `getOpportunityIntelligence` — surfaces EXISTING opportunity capabilities + composes prior tiers. Opportunity ≠ Requirement.
- Part 4 `getPrioritizationIntelligence` — STRUCTURAL framing over substrate volume (`basis: structural_substrate_volume`); Priority ≠ Approval. `decision_safety.asserts_business_priority=false`, `approves=false`, `decides=false`.
- Part 5 `getPrescriptiveIntelligence` — RECOMMEND ONLY; reads existing recommendation substrate; `execution_safety.executes=false`, `automates=false`, `decides=false`, `modifies_production=false`, `write_paths_to_business_tables=0`. Recommendation ≠ Execution.
- Part 6 `explainRecommendation(uid)` — why / evidence / structural confidence / assumptions / alternatives / repo+knowledge+runtime refs / governance(human-approval mandatory; `automated_action=false`, `executes=false`, `decides=false`). Unknown uid → `found:false` (no fabrication).
- Part 7 `getRecommendationValidation` — STRUCTURAL only (7 checks: repository/engine/evidence/recommendation/trail/recommendation-consistency/registry). `recommendation_consistency` is STRUCTURAL self-consistency, explicitly **NOT** acceptance or effectiveness. Verdict ∈ {STRUCTURAL_VALIDATED, PARTIAL, ABSENT}.
- Part 8 `getRecommendationMetrics` — **6 SEPARATE** measured scores, **NO composite** (`composite:null`):
  `recommendation_quality` (structural), `recommendation_confidence` (confidence, STRUCTURAL verifiability), `recommendation_coverage` (coverage), `explainability_score` (evidence), `acceptance_rate` (adoption — **honest-NULL**, unmeasurable: no adoption data), `effectiveness` (outcome — **honest-NULL**, unmeasurable: no labelled outcomes).
- `getRecommendationSummary` composes registry/catalog/metrics/validation/tiers (composition `of:6`).
- Audit: `captureRecommendationSnapshot` (ONLY write path beyond discover/register — owns lazy ensure-schema), `getRecommendationSnapshots`, `getRecommendationDrift` (needs ≥2 snapshots; null delta = a side unmeasured).
- Registry: `discoverRecommendations` (upsert; `owner`/`lifecycle_uid` deliberately excluded from UPDATE set → re-discovery never clobbers MANAGED fields), `registerRecommendationCapability` (manual; rejects unsafe table identifiers), `getRecommendationRegistry`, `getRecommendationCapability`.

**Route** `backend/routes/recommendation-intelligence-engine.ts` — BASE `/api/admin/recommendation-intelligence`. `/enabled` (persona-agnostic probe), `gate` (503 before auth/DB when OFF), `/feature-flag`, GET reads (summary/catalog/action/opportunity/prioritization/prescriptive/validation/metrics/registry/audit-drift/audit-snapshots/explain/:uid/registry/:uid), POST writes (discover/register/audit/capture). Literal sub-paths before `:uid` params.

**Migration** `backend/migrations/20261227_recommendation_intelligence.sql` — 2 OWNED tables: `recommendation_registry` + `recommendation_intelligence_audit_snapshots` (mirrors the lazy `ensureRecommendationSchema`). Never creates/alters any EXISTING recommendation table.

**Flag** `backend/config/feature-flags.ts` — `recommendationIntelligenceEngine: false` + `isRecommendationIntelligenceEngineEnabled()`.

---

## Catalog provenance (DB + file verified)

Every catalog capability maps to a real persisted table and/or a real engine source file:
- `capadex_recommendations` ↔ `services/recommendation-engine.ts`; `career_recommendations` ↔ `services/career-recommendation-engine.ts` (flag `careerRecommendation`); causal / EI recommendations → compute-on-read (table null); `frp_recommendations` ↔ `frp-recommendation-engine.ts` (flag `futureReadiness`); `lbi_user_recommendations` ↔ `lbi-recommendation-engine.ts`; `mei_user_recommendations` ↔ `mei-recommendation-engine.ts`; `rie_recommendations` ↔ `rie-recommendation-engine.ts`; `cg_user_recommendations` ↔ engine null (flag `careerGraph`); `m5_executive_recommendations` ↔ `m5-executive-intelligence.ts`; `development_recommendations` / `learning_recommendations` ↔ `services/pil/recommendation-builder.ts`.
- Opportunity: `rie_opportunity_flags` ↔ `rie-opportunity-engine.ts`; `paie_opportunity_forecasts` ↔ `routes/paie-opportunity.ts`; `roie_opportunities` ↔ `routes/roie-opportunity.ts`; `iil_opportunities` ↔ `routes/iil-evolution.ts`; `nhda_opportunities` ↔ `routes/nhda-core.ts`.
- Intervention/optimization: `capadex_interventions` ↔ `services/intervention-intelligence.ts`; `pil_intervention_library` ↔ `services/pil/runtime-guidance-engine.ts`; runtime-optimization ↔ `services/runtime-optimization-engine.ts` (table null).

(`paie`/`roie` opportunity logic lives in `routes/` not `services/` — recorded honestly.)

---

## Honesty contract (enforced + verified)

- **null ≠ 0.** Population is exact `COUNT(*)` (NEVER `pg_stat` `n_live_tup`); absent table → `present:false`, count NULL; query error → NULL (≠ empty). `pct()` returns null on null numerator or 0/null denominator.
- **Metrics are 6 SEPARATE scores; NO composite/overall.** Blending would hide honest gaps.
- **recommendation_confidence is STRUCTURAL only** (substrate verifiability), not runtime/outcome/accuracy.
- **acceptance_rate + effectiveness are honest-NULL (DEFERRED)** — adoption requires accept/dismiss telemetry (absent); effectiveness requires labelled recommendation outcomes (absent). This tier surfaces recommendation SUPPORT; it never measures whether a recommendation was taken or worked.
- **Coverage ⟂ Confidence ⟂ Evidence** — separate axes, never blended. Recommendation ≠ Decision; Recommendation ≠ Automation; Recommendation ≠ Execution; Priority ≠ Approval; Opportunity ≠ Requirement; Confidence ≠ Accuracy. Human approval mandatory.
- **Byte-identical OFF incl. schema** — route gate 503 before auth/DDL; every service write path asserts the flag before ensure-schema (defense-in-depth); reads never ensure-schema. OFF creates 0 tables.
- **RECOMMEND ONLY** — never executes / automates / decides; no write to any business table.
- **MANAGED fields** (`owner`, `lifecycle_uid`) are honest-NULL when unassigned and survive re-discovery.

## What the validator proves (62 checks)
- All 9 parts return the contracted shapes; metrics 6-separate/no-composite; acceptance_rate + effectiveness null; honesty axes asserted; execution/decision safety flags false.
- **Reads NEVER write**: exact `COUNT(*)` on **17** existing recommendation/opportunity sentinel tables is unchanged before vs after exercising every read part.
- **Engines NEVER invoked**: e.g. `career_recommendations` and `rie_opportunity_flags` counts unchanged (the engines are existence-checked via `fs.existsSync`, never imported/invoked — confirmed by static review).
- **Injection rejected**: `/register` rejects a malicious `physical_table` identifier; no row written; target table survives.
- **Cleanup** drops both OWNED tables → 0 tables (byte-identical OFF).

## Smoke (flag OFF, live Backend API)
All `/api/admin/recommendation-intelligence/*` endpoints return **401** (global `/api/admin` auth middleware fires before the route-level flag gate; OFF smoke ∈ {401,403,503} per platform convention — the flag gate still enforces disabled behaviour). OWNED tables absent.

## STOP
Additive phase complete. **STOP for approval before merge/deploy. NO deploy.**

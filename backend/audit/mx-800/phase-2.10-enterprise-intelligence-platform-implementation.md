# MX-800 Phase 2.10 — Enterprise Intelligence Platform (implementation)

**Status:** Implemented, flag OFF by default (`enterpriseIntelligencePlatform` / `FF_ENTERPRISE_INTELLIGENCE_PLATFORM`). Byte-identical legacy behaviour incl. schema when OFF. **STOP for approval — NO deploy.**

**Validator:** `backend/scripts/mx800-2.10-enterprise-validate.ts` → **72/72 passed, 0 failed** (run with `FF_ENTERPRISE_INTELLIGENCE_PLATFORM=1`; offline harness pins `EI_MEMO_TTL_MS=600000`).

**Architect code review:** PASS — no blocker-level defects; honesty + flag + insight-only contracts materially enforced; read-only / engines-never-invoked confirmed; `EI_MEMO_TTL_MS` accepted as a defensible perf knob (clamped, production default unchanged).

---

## What this is

An ENHANCEMENT-ONLY, READ-ONLY intelligence tier ABOUT the platform's enterprise-level intelligence. It **registers** the platform's EXISTING intelligence domains/services into ONE canonical enterprise registry, and **composes** the eight prior MX-800 intelligence tiers (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8 recommendation / 2.9 continuous-learning) into explainable enterprise intelligence (registry / orchestration / cross-intelligence correlation / enterprise insights / organizational / executive / explainability / validation / metrics).

It introduces **NO** parallel enterprise / analytics / executive engine, **DUPLICATES** no model, and changes **NO** business logic. It **INVOKES / ACTIVATES** no dormant engine — it reads each engine's **EXISTENCE** (source file on disk) and its **PERSISTED OUTPUT** (intelligence/analytics/executive/governance tables, COUNT-only) only. It **never decides**, **never executes**, **never acts autonomously**, and **never modifies business logic**. The repository + the existing intelligence registries/snapshots remain the single source of truth.

---

## Surface

**Service** `backend/services/enterprise-intelligence-platform.ts` (9 parts + registry/discovery + summary + audit):
- Part 1 `getEnterpriseCatalog` — curated, DB+file-verified catalog of **19 EXISTING enterprise-intelligence capabilities** across **13 domains** and **4 kinds** (intelligence 8 / executive 5 / organizational 4 / analytics 2). Each: persisted `table` (read-only COUNT-only) and/or `engine` source file (existence-read), governing `flag` state (Built ≠ Activated), soft `intelligence_uid`.
- Part 2 `getEnterpriseOrchestration` — coordinates the 8 prior tiers at **metadata level only**. **Connected ≠ Orchestrated.** `orchestration_safety`: never executes engines / re-runs tiers / decides; 0 business writes. `tier_reachability.of === 8`.
- Part 3 `getCrossIntelligenceCorrelation` — surfaces 8 intelligence channels **side-by-side** with `co_presence` reported as exact COUNT-or-0 over populated trails (**NOT** a correlation coefficient). **Correlation ≠ Causation.** `correlation_safety`: never asserts/infers causation / decides. `tier_reachability.of === 8`.
- Part 4 `getEnterpriseInsights` — observations only; every insight `is_decision:false`. **Insight ≠ Decision.** `dormant_capabilities` listed as observation (Built ≠ Activated). `insights_safety`: never a decision / triggers action / autonomous / modifies business logic. `tier_reachability.of === 8`.
- Part 5 `getOrganizationalIntelligence` — surfaces EXISTING org/governance + portfolio/product substrate (no fabricated org model); records exposed as null ≠ 0. `organizational_safety`: never decides / modifies business logic / autonomous. `tier_reachability.of === 8`.
- Part 6 `explainEnterprise(uid)` — why / evidence / structural confidence / **previous_state + current_state + reason_for_change (honest "NO CHANGE")** / assumptions / alternatives / repo+knowledge+runtime refs / governance (human-approval mandatory; never decides/executes/autonomous). Evidence is COUNT-only over existing trail (null ≠ 0). Unknown uid → `found:false` (no fabrication).
- Part 7 `getEnterpriseValidation` — STRUCTURAL only (repository/intelligence/evidence/enterprise/knowledge/recommendation/organizational/consistency/registry checks). `enterprise_consistency` is STRUCTURAL self-consistency, explicitly **NOT** effectiveness. Verdict ∈ {STRUCTURAL_VALIDATED, PARTIAL, ABSENT}.
- Part 8 `getEnterpriseMetrics` — **6 SEPARATE** measured scores, **NO composite** (`composite:null`):
  `enterprise_health` (structural), `intelligence_coverage` (coverage), `intelligence_maturity` (confidence, STRUCTURAL), `explainability_score` (evidence), `intelligence_effectiveness` (**honest-NULL**, outcome unmeasurable), `enterprise_optimization` (**honest-NULL**, longitudinal improvement unmeasurable).
- Part 9 `getExecutiveIntelligence` — MEASURED KPIs / strategic indicators / trends from composed tiers. **Dashboard ≠ Intelligence.** `enterprise_kpis` include an honest-null unmeasurable outcome KPI; `strategic_indicators` assert `connected_not_orchestrated`; `enterprise_trends` not ready without ≥2 snapshots (null ≠ 0). `executive_safety`: never decides / fabricates KPIs / autonomous. `tier_reachability.of === 8`.
- `getEnterpriseSummary` composes registry/catalog/metrics/validation/all-parts (composition `of:8`); `enterprise_safety` executes/decides/acts/modifies_business_logic/duplicates all false, insight-only.
- Audit: `captureEnterpriseSnapshot` (ONLY write path beyond discover/register — owns lazy ensure-schema), `getEnterpriseSnapshots`, `getEnterpriseDrift` (needs ≥2 snapshots; null delta = a side unmeasured).
- Registry: `discoverEnterprise` (upsert; `owner`/`lifecycle_uid` deliberately excluded from UPDATE set → re-discovery never clobbers MANAGED fields), `registerEnterpriseCapability` (manual; rejects unsafe table identifiers), `getEnterpriseRegistry`, `getEnterpriseCapability`.

**Route** `backend/routes/enterprise-intelligence-platform.ts` — BASE `/api/admin/enterprise-intelligence`. `/enabled` (persona-agnostic probe), `gate` (503 before auth/DB when OFF), `/feature-flag`, GET reads (summary/catalog/orchestration/correlation/insights/organizational/executive/validation/metrics/registry/audit-drift/audit-snapshots/explain/:uid/registry/:uid), POST writes (discover/register/audit/capture). Literal sub-paths before `:uid` params.

**Migration** `backend/migrations/20261229_enterprise_intelligence_platform.sql` — 2 OWNED tables: `enterprise_intelligence_registry` + `enterprise_intelligence_audit_snapshots` (mirrors the lazy `ensureEnterpriseSchema`). Never creates/alters any EXISTING intelligence table.

**Flag** `backend/config/feature-flags.ts` — `enterpriseIntelligencePlatform: false` + `isEnterpriseIntelligencePlatformEnabled()`.

---

## Catalog provenance (DB + file verified)

Every catalog capability maps to a real persisted table and/or a real engine source file, spanning **13 domains** (platform / engineering / runtime / knowledge / decision / predictive / recommendation / learning / analytics / executive / organizational / governance / reporting) and **4 kinds**:
- **Intelligence (8):** the eight prior MX-800 tiers' audit-snapshot trails + engine files (2.1 platform-intelligence, 2.3 engineering, 2.4 runtime, 2.5 knowledge, 2.6 decision, 2.7 predictive, 2.8 recommendation, 2.9 continuous-learning) — each existence-checked, snapshot trail COUNT-only.
- **Executive (5):** existing enterprise-analytics / executive / dashboard substrate (persisted tables COUNT-only; engine files existence-read).
- **Organizational (4):** existing organizational + governance substrate (e.g. governance/RBAC + knowledge-preservation trails), records exposed null ≠ 0.
- **Analytics (2):** existing analytics / reporting substrate (report-factory / enterprise-analytics), persisted-trail COUNT-only.

(NULL persisted table = compute-on-read or trail-only → `table_count` honest-null, not 0. NULL engine = persisted-trail-only capability, recorded honestly.)

---

## Honesty contract (enforced + verified)

- **null ≠ 0.** Population is exact `COUNT(*)` (NEVER `pg_stat` `n_live_tup`); absent table → `present:false`, count NULL; query error → NULL (≠ empty). `pct()` returns null on null numerator or 0/null denominator.
- **Metrics are 6 SEPARATE scores; NO composite/overall.** Blending would hide honest gaps.
- **intelligence_maturity / intelligence_coverage / enterprise_health / explainability_score are STRUCTURAL** (substrate verifiability + coverage + evidence), not runtime/outcome/accuracy.
- **intelligence_effectiveness + enterprise_optimization are honest-NULL (DEFERRED)** — effectiveness requires labelled enterprise outcomes (absent); optimization requires longitudinal improvement deltas (absent). This tier surfaces enterprise intelligence SUPPORT; it never measures whether the platform improved or worked.
- **Coverage ⟂ Confidence ⟂ Evidence** — separate axes, never blended. Integration ≠ Duplication; Intelligence ≠ Business Logic; Insight ≠ Decision; Dashboard ≠ Intelligence; Correlation ≠ Causation; Recommendation ≠ Approval; Evidence ≠ Confidence; Confidence ≠ Accuracy; Built ≠ Activated; Present ≠ Populated; Connected ≠ Orchestrated. Human approval mandatory.
- **Byte-identical OFF incl. schema** — route gate 503 before auth/DDL; every service write path asserts the flag before ensure-schema (defense-in-depth); reads never ensure-schema. OFF creates 0 tables.
- **INSIGHT ONLY** — never executes / decides / acts autonomously / modifies business logic; no write to any business table; never invokes/activates a dormant engine.
- **MANAGED fields** (`owner`, `lifecycle_uid`) are honest-NULL when unassigned and survive re-discovery.
- **`EI_MEMO_TTL_MS`** is an operational perf knob (default 8000ms = production unchanged, clamped to 0–3,600,000ms). It dedupes composition within a request window only; reads never write regardless of cache state, so it cannot change OFF behaviour or any output's correctness. The offline validator pins a long TTL so its ~12 back-to-back composing getters don't each recompute the 8-tier composition from cold.

## What the validator proves (72 checks)
- All 9 parts return the contracted shapes; metrics 6-separate/no-composite; effectiveness + optimization null; honesty axes asserted; orchestration/correlation/insights/organizational/executive safety flags false; `tier_reachability.of === 8` across parts and `composition.of === 8` in summary.
- **Reads NEVER write**: exact `COUNT(*)` on existing intelligence sentinel tables (incl. `platform_intelligence_audit_snapshots` + `continuous_learning_intelligence_audit_snapshots`) is unchanged before vs after exercising every read part → prior engines NEVER invoked.
- **Injection rejected**: `/register` rejects a malicious `physical_table` identifier; no row written; target table survives.
- **Cleanup** drops both OWNED tables → 0 tables (byte-identical OFF).

## Smoke (flag OFF, live Backend API)
All `/api/admin/enterprise-intelligence/*` endpoints return **401** on GET / **403** on POST (global `/api/admin` auth middleware fires before the route-level flag gate; OFF smoke ∈ {401,403,503} per platform convention — the flag gate still enforces disabled behaviour). OWNED tables absent (`enterprise_intelligence_registry`, `enterprise_intelligence_audit_snapshots` both NULL via `to_regclass`).

## STOP
Additive phase complete. **STOP for approval before merge/deploy. NO deploy.**

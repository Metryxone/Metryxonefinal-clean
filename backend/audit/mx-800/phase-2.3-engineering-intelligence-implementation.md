# MX-800 Phase 2.3 — Engineering Intelligence Engine (Implementation)

**Status:** Implemented behind flag `engineeringIntelligence` (default **OFF**). Flag-OFF is byte-identical to legacy **including schema** (no tables created). STOP-and-freeze after approval; Phase 2.4 = Runtime Intelligence.

**Classification:** ENHANCEMENT-ONLY read-only composer. NO rebuild / V2 / parallel / duplicate engine, NO business-logic change, NO dormant activation, NO dashboards / runtime / AI.

## What it is
An additive intelligence tier that **COMPOSES** the already-shipped MX-700 1.37–1.40 read-only getters plus MEASURED filesystem scans of `backend/services` + `backend/routes` (and the backend manifest) into one Engineering-Intelligence surface. It introduces **no new business logic** — every number is either a direct filesystem measurement or read from an existing tier's measured getter.

## Surface
- **Flag:** `engineeringIntelligence` / `FF_ENGINEERING_INTELLIGENCE` (`backend/config/feature-flags.ts`, default false) + helper `isEngineeringIntelligenceEnabled()`.
- **Service:** `backend/services/engineering-intelligence.ts`.
- **Route:** `backend/routes/engineering-intelligence.ts` — `registerEngineeringIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`, BASE `/api/admin/engineering-intelligence`. Wired in `backend/routes.ts`.
- **Migration (canonical mirror):** `backend/migrations/20261222_engineering_intelligence.sql` — 2 tables `engineering_knowledge_registry` + `engineering_intelligence_audit_snapshots`.
- **Validator:** `backend/scripts/mx800-2.3-engineering-validate.ts` (drops both tables at start AND end → idempotent + restores OFF byte-identical).

### Endpoints
- `GET /enabled` — ungated flag probe (so the admin UI can hide the tab when OFF).
- `GET /feature-flag` — gate → auth → superadmin.
- Reads (gate → auth → superadmin, **GET-never-writes**, `to_regclass`-probe): `/summary`, `/registry`, `/registry/:uid`, `/code`, `/architecture`, `/dependencies`, `/quality`, `/reasoning`, `/validation`, `/metrics`, `/explain/:uid`, `/audit/drift`, `/audit/snapshots`.
- Writes (gate → auth → superadmin, each owns lazy ensure-schema + `assertEnabled()` before DDL): `POST /discover`, `POST /register`, `POST /audit/capture` (the ONLY snapshot write path).

## 9 parts
1. **Engineering Knowledge Registry** — file-verified catalog populated by `POST /discover` (MEASURED scan: ~736 backend files / 46 manifest libraries / 782 entries in dev). `lifecycle_uid` SOFT-references the MX-700 `platform_lifecycle_catalog` (`lifecycle_linked=false` when that catalog is empty).
2. **Discover** — re-scans and upserts; `owner`/`documentation_ref` are **MANAGED** (preserved on re-discover), activation/measurement fields **DERIVED** (refreshed).
3. **Code Intelligence** — MEASURED line/byte sizes, large-file list, code-smell markers (composes `scanRepositoryDebtMarkers` + `getRepositoryHealthIntel`). AST metrics (complexity / cohesion / duplication / maintainability_index) = honest **NULL DEFERRED**.
4. **Dependency Intelligence** — MEASURED manifest libraries (runtime + build) + internal/external import edges; api deps honest **NULL DEFERRED** (no full AST graph).
5. **Quality Intelligence** — MEASURED test-file ratio; `line_coverage` honest **NULL** (instrumentation DEFERRED); `maintainability_index` honest **NULL** (AST DEFERRED). Composes `getTechnicalDebtIntelligence` + repo health + lifecycle metrics.
6. **Engineering Reasoning** — evidence-grounded composed narrative + per-entity `explain/:uid` (unknown → `found:false`, never fabricated).
7. **Validation** — **STRUCTURAL** verdict; explicit `no_duplicate_engineering_engine` + `no_business_logic_change` checks; composes 1.39/1.40 validation.
8. **Metrics** — 6 **SEPARATE** measured scores; **deliberately NO composite/overall**; `technical_debt_trend` null until ≥2 snapshots.
9. **Summary + Audit** — `/summary` composes all parts; `/audit/capture` writes an append-only snapshot; `/audit/drift` compares the two latest (null with <2).

## Honesty contract
- `null ≠ 0` everywhere; Built ≠ Activated; Coverage ⟂ Confidence ⟂ Evidence never composited.
- AST/instrumentation metrics are explicit NULL DEFERRED, never coerced to 0.
- Metrics never composited (6 separate scores, no overall).
- Owner MANAGED (preserved on re-discover) ⟂ DERIVED measurement refreshed.
- Reads probe with `to_regclass` and never run DDL; writes `assertEnabled()` before `ensureEngineeringSchema()` → flag-OFF creates 0 tables (byte-identical including schema).

## Perf fix (gather EXACTLY ONCE)
`captureEngineeringSnapshot` + `getEngineeringSummary` originally triggered a deep redundant fan-out: each part independently re-ran the full-repo filesystem scan (~700 files) and the composed repo-health / metrics / validation getters (each of which runs its OWN repo scan), so a single capture re-derived the same expensive sources dozens of times → minutes-long hang + connection-pool exhaustion (the MX-700 1.43 "gather each source EXACTLY ONCE" lesson). Fix: a short-TTL (8s) promise memo (`memo()`) wrapping the 3 filesystem scans and 8 composed-getter wrappers (`repoHealth`/`lcMetrics`/`lcValidation`/`compatIntel`/`debtMarkers`/`techDebt`/`evoValidation`/`evoMetrics`). The memo dedupes in-flight promises within a request and reuses for a few seconds; rejections are **not** cached. Data is read-only intelligence so the small staleness window is irrelevant (mirrors the existing 60s admin cache). Memo touches only flag-ON aggregate paths — flag-OFF behavior is unchanged.

## Verification
- esbuild parse-check: PASS (service / route / validator).
- Validator (`FF_ENGINEERING_INTELLIGENCE=1`): **32 passed, 0 failed**; both tables dropped at end (OFF byte-identical restored).
- Flag-OFF HTTP smoke: `/enabled`, `/feature-flag`, `/summary`, `/registry`, `/metrics` all ∈ {401,403,503} (401 from the global `/api/admin` auth gate, consistent with prior phases); `to_regclass` confirms neither table exists when OFF.
- Code review (architect, includeGitDiff): **PASS**, no blocking correctness/security defects.

## STOP
Built, flag default OFF, validated. **STOP for approval before merge/deploy.** No deploy performed. No frontend (STOP clause). Phase 2.4 = Runtime Intelligence is a future phase.

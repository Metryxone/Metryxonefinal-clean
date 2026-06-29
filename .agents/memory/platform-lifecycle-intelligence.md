---
name: Platform Lifecycle Intelligence Engine (MX-700 Phase 1.39)
description: Read-only intelligence tier composing the 1.37 Foundation + 1.38 Management; measurement/validation/explainability/scoring over the lifecycle registry. Honesty + flag-OFF byte-identical traps.
---

# Platform Lifecycle Intelligence Engine (MX-700 Phase 1.39)

Flag `platformLifecycleIntelligence` / env `FF_PLATFORM_LIFECYCLE_INTELLIGENCE` (default OFF).
Base `/api/admin/platform-lifecycle-intelligence`. Service `platform-lifecycle-intelligence.ts`.

## What it is
READ-ONLY intelligence layer that COMPOSES Foundation (`platform-lifecycle`: `getRepositoryHealth`/
`getValidation`/`getSummary`/`schemaReady`/`LIFECYCLE_STATES`) + Management (`getManagementSummary`).
NO parallel registry, NO duplicate engines, NO business-logic change. Reads the existing
`platform_lifecycle_*` tables; adds measurement on top.

9 engines: Evidence, Confidence, Explainability(`/explain/:uid`), Lifecycle Health, Repository
Health, Compatibility Intelligence, Validation, Audit(drift), Metrics. Plus `/summary`.

## Single write path
`POST /audit/capture` → `captureAuditSnapshot` is the ONLY writer. It owns the lazy
`ensureIntelligenceSchema` (mirrors `20261218_platform_lifecycle_intelligence.sql`, ONE append-only
table `platform_lifecycle_intelligence_snapshots`). Every read engine is GET-never-writes: probes via
`to_regclass`/`schemaReady`, degrades to `ready:false`. **Why:** flag-OFF must be byte-identical incl.
schema — putting ensure-schema only behind the gated write path means OFF never creates the table.

## Honesty rules baked in (don't "fix" these into a single score)
- `getLifecycleMetrics` exposes 6 SEPARATE scores and INTENTIONALLY no `overall`/`composite` field.
  Coverage ⟂ Confidence ⟂ Evidence ⟂ Health are distinct axes. The validation script asserts the
  absence of `overall`/`composite` — adding one is a regression, not an improvement.
- `pct()` returns `null` when denominator ≤ 0 (null ≠ zero). Drift deltas null when either side null.
- Evidence vs Confidence are different ratios on the SAME source: coverage = how many rows HAVE a
  ref; confidence = how many of those refs RESOLVE on disk / are definitively measured.
- git is repo-level last-commit only (best-effort `execFile git log -1`); per-entity history is an
  honest `unavailable` gap, never fabricated. Orphan modules are CANDIDATES (no relationship edge),
  not asserted dead. Dormant capabilities are built-but-OFF-by-design, NOT tech debt.

## Foundation getter return-shape gotchas (composed, so match exactly)
- `getRepositoryHealth().checks` keys: `duplicate_capabilities`, `duplicate_lifecycle_records`,
  `orphan_records`, `missing_ownership`, `broken_references` (NOT `duplicate_services`/`orphan_modules`
  — those are 1.39-added). 
- `getValidation().checks` keys: `missing_documentation`, `missing_owners`, `missing_dependencies`,
  `missing_lifecycle_states`, `duplicate_capability_ids`, `duplicate_ownership`.
- Registry columns exist for: `compatibility_status` (DEFAULT 'compatible' → all rows non-null →
  compatibility coverage reads ~100% honestly), `current_version`, `migration_version`,
  `migration_date`, `feature_flag`, `documentation_reference`, `repository_reference`,
  `dependencies TEXT[]` (empty = `'{}'`). `entity_type` ∈ {capability,module,service,migration,documentation}.

## Flag-OFF smoke reality (same as Platform Intelligence Console)
Global `app.use('/api/admin')` auth gate returns 401 BEFORE the route-level flag gate, so even
`/enabled` (intended ungated) returns 401 not 200 under `/api/admin`. POST hits global CSRF → 403.
Smoke asserts every route ∈ {401,403,503}; nothing reaches the service/DDL either way. Don't try to
"make /enabled ungated" — the global gate wins; there's no frontend this phase so it's moot.

## Validation
`backend/scripts/mx700-1.39-validate.ts` (flag forced ON via env, self-cleans its snapshots).
esbuild bundle PASS. tsx scripts must live INSIDE backend/. Foundation discovery must have run first
(`POST /api/admin/platform-lifecycle/discover`) or engines correctly return `ready:false`.

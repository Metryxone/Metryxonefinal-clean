# MX-700 Phase 1.38 — Platform Lifecycle Management Engine (Implementation Report)

**Mode:** Implementation (enhancement-only). **Flag:** `platformLifecycleManagement` (env `FF_PLATFORM_LIFECYCLE_MANAGEMENT`), default **OFF**.
**Builds on:** Phase 1.37 — Platform Lifecycle Foundation (the ONLY pre-existing platform-lifecycle code).

## Honesty contract (per user preference — honesty over optimism, never fabricate)
- The Management tier **COMPOSES** the Foundation. It reuses the Foundation's registry, capability catalog,
  append-only state-history and `transitionState()` engine. There is **NO parallel registry and NO second
  state machine**. The authoritative `lifecycle_state` lives in `platform_lifecycle_registry` and changes
  **only** through `transitionState()`.
- The Foundation discovery populates `entity_type ∈ {capability, module, service, migration, documentation}`.
  There is **no `feature`, `api`, or `model` entity_type**. The Management views map those vocabularies onto
  the closest **measured** analog or are **registration-only**, each declaring `derived`/`note` honestly:
  | View | Backed by entity_type | derived | Honest meaning |
  |---|---|---|---|
  | `feature` | `capability` | yes | Features ARE feature-flag capabilities; no separate "feature" entity is discovered. |
  | `capability` | `capability` | no | Native — discovered feature-flag entities. |
  | `module` | `module`, `service` | no | Native — discovered route + service files. |
  | `api` | `module` | yes | API surface at route-module granularity; per-endpoint API registry is NOT discovered (honest gap). |
  | `model` | `model` | no | Models are NOT file-discoverable; registration-only; registry stays **0** until explicitly registered. |
- All counts are **MEASURED** (`COUNT(*)`), never estimated. `null ≠ zero` both directions. `built ≠ activated`.
- **Flag-OFF is byte-identical incl. schema**: `ensureManagementSchema` runs ONLY on flag-ON write paths; every
  route 503s before any auth/DB touch when OFF, so no tables are created.

## Already-Existing (reused, not rebuilt)
- `platform_lifecycle_registry`, `platform_capability_catalog`, `platform_capability_ownership`,
  `platform_lifecycle_relationships`, `platform_lifecycle_state_history` (Foundation tables).
- `transitionState()`, `ensurePlatformLifecycleSchema()`, `schemaReady()`, `getStateHistory()`,
  `isLifecycleState()`, the 14-value `LIFECYCLE_STATES` (Foundation service).

## Implemented (this phase — additive)
- **Flag** `platformLifecycleManagement` + helper `isPlatformLifecycleManagementEnabled()` (`config/feature-flags.ts`).
- **Migration** `migrations/20261217_platform_lifecycle_management.sql` — 4 additive tables (no hard FK to registry;
  soft `lifecycle_uid` reference so re-discovery never blocks management metadata):
  `platform_lifecycle_deprecation` (PART 7), `platform_lifecycle_retirement` (PART 8),
  `platform_lifecycle_version_ledger` (PART 6, append-only), `platform_lifecycle_evolution` (PART 9, append-only).
- **Service** `services/platform-lifecycle-management.ts` — lazy `ensureManagementSchema` (mirrors the migration;
  ensures Foundation schema first). Operations:
  - PART 1–5 typed lifecycle **views** (`getEntityLifecycle`) + explicit **registration** (`registerEntity`, into the
    SHARED Foundation registry; creation is the first lifecycle stage, subsequent moves go through `transitionState`).
  - PART 6 **version management** (`setVersion` → append-only ledger + updates the registry's authoritative
    `current_version`; `getVersionHistory`).
  - PART 7 **deprecation** (`deprecateEntity` → stores policy/replacement metadata + composes `transitionState(deprecated)`).
  - PART 8 **retirement** (`retireEntity` → **measured dependency validation** over incoming
    `platform_lifecycle_relationships` edges; blocks with `has_active_dependents` unless `force=true`, which records
    the dependency snapshot; composes `transitionState(retired)`).
  - PART 9 **evolution/enhancement log** (`recordEvolution`, `getEvolution`).
  - Getters: `getDeprecation`, `getRetirement`, `getEntityLifecycleDetail` (composes all tiers + state history),
    `getManagementSummary` (measured counts + honest view coverage).
- **Routes** `routes/platform-lifecycle-management.ts` (`registerPlatformLifecycleManagementRoutes`, BASE
  `/api/admin/platform-lifecycle-management`) — mirrors the Foundation conventions exactly: `/enabled` probe,
  flag `gate` 503-before-auth/DB, `/feature-flag` (res.ok), reads `gate+requireAuth+requireSuperAdmin`, literal
  sub-paths before `:param`, GET-never-writes, ensure-schema only inside POST handlers. Registered in `routes.ts`.

## Partial / Deferred (honest gaps — NOT fabricated)
- **`api` view** is route-module granularity only; a per-endpoint API registry is **deferred** (Foundation does not
  discover endpoints). Surfaced as `derived:true` with an explicit note; per-endpoint entries can be registered explicitly.
- **`model` view** is **registration-only** — the registry is **0** until models are explicitly registered. No model
  discovery is performed (models are not file-discoverable by the Foundation scan). Reported honestly as empty, never inflated.
- **No dashboards / analytics / reporting / SuperAdmin pages / AI-lifecycle** — out of scope per the Phase 1.38 STOP clause.

## Missing (intentionally not built — STOP clause)
- Lifecycle analytics, tech-debt tracking, AI-driven lifecycle, future-phase scaffolding, any frontend panel.

## Validation (service-level, dev only; `scripts/mx700-1.38-validate.ts` — flag forced on for the script, test rows self-deleted)
21/21 PASS against the **real** Foundation registry:
- 4 management tables created by `ensureManagementSchema`.
- Summary ready; honest view coverage measured: `feature=171(derived) capability=171 module=721 api=304(derived) model=0`.
  (Registry distribution: service=417, module=304, migration=219, capability=171, documentation=26.)
- `registerEntity` creates with initial history row; version ledger append-only (2 rows, registry `current_version`
  updated to latest); evolution log recorded; `deprecateEntity` composes `transitionState` → registry
  `lifecycle_state=deprecated`; **retirement blocked by a measured dependency**, then forced through with snapshot →
  `lifecycle_state=retired`; full detail composes all tiers (versions=2, evolution=1, history=3); unknown entity →
  honest `unknown_entity` error (no fabrication); cleanup leaves 0 test rows.
- HTTP smoke (flag OFF): `/api/admin/...` returns from the global `/api/admin` auth gate (401/403) before the flag
  gate — within the documented `{401,403,503}` acceptance set; byte-identical OFF.

## Files
- `backend/config/feature-flags.ts` (flag + helper)
- `backend/migrations/20261217_platform_lifecycle_management.sql`
- `backend/services/platform-lifecycle-management.ts`
- `backend/routes/platform-lifecycle-management.ts`
- `backend/routes.ts` (import + registration)
- `backend/scripts/mx700-1.38-validate.ts` (dev validation)

## Status
Implementation complete and validated. **Flag OFF by default; not deployed.** Awaiting approval before merge/deploy (per user preference: additive phases STOP for approval). Phase 1.39 to follow on approval.

# CAPADEX 2.0 — Phase 1.37: Platform Lifecycle Foundation (IMPLEMENTATION of the 1.36 gap)

> **Execution mode:** ENHANCEMENT-ONLY · ADDITIVE · flag-gated (`platformLifecycleFoundation`, default OFF, byte-identical OFF **including schema**). Reuse-before-build: NO parallel registry, NO business-logic change, NO dormant-capability activation. Repository remains the single source of truth.
> **Honesty contract:** *measured* = derived by exact inspection of the live repo + feature-flag registry + DB on 2026-06-28; built ≠ activated; flag-ON ≠ runtime-active; Null ≠ Zero; table-existence ≠ population. Ownership/documentation/dependency gaps are reported as **honest NULL gaps**, never fabricated.

Generated 2026-06-28 · Initiative MX-700 · Phase 1.37. Implements the formal **Capability Catalog + Lifecycle Registry + Ownership + Lifecycle Metadata + State Engine + Relationships + Repository Discovery** identified as MISSING in Phase 1.36 (constitution doc), without owning any business logic.

---

## What was built (additive, flag-gated)

| Layer | Artefact |
|---|---|
| Feature flag | `platformLifecycleFoundation` (default OFF) + `isPlatformLifecycleFoundationEnabled()` · env `FF_PLATFORM_LIFECYCLE_FOUNDATION` — `backend/config/feature-flags.ts` |
| Canonical migration | `backend/migrations/20261216_platform_lifecycle_foundation.sql` — 5 `platform_*` tables (catalog · ownership · registry · state_history append-only · relationships) |
| Service (lib) | `backend/services/platform-lifecycle.ts` — lazy `ensurePlatformLifecycleSchema` (mirrors migration), `schemaReady` `to_regclass` probe, `runDiscovery` (reuses `FEATURE_FLAGS` + fs scan of routes/services/migrations/docs), `transitionState` (append history, never delete/mutate), `getValidation`, `getRepositoryHealth`, query getters, `getSummary` |
| Route | `backend/routes/platform-lifecycle.ts` — BASE `/api/admin/platform-lifecycle`; flag-gate 503 before DDL; `/enabled` + `/feature-flag` probes; GET reads never write (degrade via `to_regclass`); POST `/discover` + POST `/registry/:uid/transition` run ensure-schema. Registered in `backend/routes.ts` (concernsPool, requireAuth, requireSuperAdmin). |
| SuperAdmin UI | `frontend/src/components/superadmin/PlatformLifecyclePanel.tsx` + wired into `SuperAdminDashboard.tsx` (lazy import, `/feature-flag` probe res.ok, conditional-spread nav `platform-lifecycle`, conditional render) |

## Discovery result (measured against the live repo, 2026-06-28)
- **171 flag-capabilities** (63 active / 108 dormant — derived from live flag runtime), **304 route modules**, **417 services**, **219 migrations**, **26 docs** → **registry_total 1,137**, **251 measured `gated_by` relationships** (flag key literally referenced in the file).
- Activation axis is honest: **966 `unknown`** (modules/services/migrations/docs — presence ≠ runtime-active), 108 dormant, 63 active.
- Validation surfaces **real gaps** (never fabricated): missing_documentation 1,111 · missing_owners 475 · missing_dependencies 1,137 · duplicate ids 0 · missing_lifecycle_states 0.
- Repository health: 0 duplicates / 0 orphans / 0 broken references.

## Honesty / design decisions
- **lifecycle_state (managed) ⟂ activation_state (derived).** Re-discovery refreshes the live activation_state but **never** clobbers a managed lifecycle_state — a human `transitionState` (e.g. → `released`) survives subsequent discovery runs. State history is append-only.
- **Ownership is honest-NULL.** No business/technical owner is fabricated; discovery records repository_location + flag references only and leaves owner columns NULL (surfaced as `missing_owners`).
- **No parallel registry.** Discovery COMPOSES the existing `FEATURE_FLAGS` registry + repository filesystem; it does not duplicate or replace any existing inventory.

## Flag-OFF verification (byte-identical incl. schema)
- Routes registered but the global `/api/admin` auth gate returns 401 unauth (never reaches route-level 503); **no `platform_*` tables exist** while the flag is OFF (ensure-schema only runs on the flag-ON write paths). Clean-state confirmed: 0 `platform_*` tables after verification.

## Deliverable
This `.md`. The capability catalog / registry itself is the live `platform_*` substrate, populated on demand by `POST /discover` when the flag is ON.

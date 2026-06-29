---
name: Platform Lifecycle Management Engine (MX-700 Phase 1.38)
description: Management tier composing the 1.37 Foundation — deprecation/retirement/version/evolution + typed lifecycle views; honest derived/registration-only mapping.
---

# Platform Lifecycle Management Engine (MX-700 Phase 1.38)

Flag `platformLifecycleManagement` (env `FF_PLATFORM_LIFECYCLE_MANAGEMENT`), default OFF.
ADDITIVE management tier over the Phase 1.37 Foundation. Service
`services/platform-lifecycle-management.ts`, routes `routes/platform-lifecycle-management.ts`
(BASE `/api/admin/platform-lifecycle-management`), migration `20261217_platform_lifecycle_management.sql`.

## Composes, never forks
- Reuses the Foundation registry + `transitionState()` + append-only state-history. NO parallel
  registry / NO second state machine. Authoritative `lifecycle_state` stays in
  `platform_lifecycle_registry`, mutated ONLY via `transitionState()`. The 4 new
  `platform_lifecycle_{deprecation,retirement,version_ledger,evolution}` tables hold ONLY the
  management metadata the registry lacks dedicated columns for.
- `setVersion` also updates the registry's authoritative `current_version` (ledger is append-only history).
- `deprecateEntity`/`retireEntity` write their metadata THEN compose `transitionState(deprecated|retired)`.

## Honest view mapping (the key honesty trap)
- Foundation discovery only ever populates `entity_type ∈ {capability, module, service, migration, documentation}`.
  There is NO `feature`/`api`/`model` entity_type. So the management views are mapped, each carrying
  `derived`/`note`:
  - `feature` → `capability` (derived: flags ARE features)
  - `capability` → `capability` (native)
  - `module` → `module`+`service` (native)
  - `api` → `module` (derived: route-module granularity; per-endpoint API registry NOT discovered — honest gap)
  - `model` → `model` (registration-only; registry stays **0** until explicitly registered — NEVER inflate)
- **Why:** reporting feature/api/model as first-class discovered entities would fabricate coverage. Live
  registry distribution: service=417, module=304, migration=219, capability=171, documentation=26.

## Retirement dependency validation
- `retireEntity` checks MEASURED incoming `platform_lifecycle_relationships` edges (`to_uid=uid`).
  Non-empty → `has_active_dependents` (HTTP 409) unless `force=true`, which records the dependency
  snapshot in `platform_lifecycle_retirement.dependency_validation` JSONB.

## Flag-OFF byte-identical incl. schema
- `ensureManagementSchema` runs ONLY on flag-ON POST handlers. Every route 503s before any auth/DB
  touch when OFF → no tables created. `/enabled` is shadowed by the global `/api/admin` auth gate
  (returns 401 not 503 unauth) — same as the Foundation; smoke acceptance set is {401,403,503}.
- Reads are GET-never-writes: services probe via `to_regclass` and degrade to `ready:false`
  (`management_totals=null` until a flag-ON write creates the schema). null ≠ zero.

## How to apply
- New lifecycle metadata extends these 4 tables + the registry — do NOT add a parallel namespace.
- Dev validation: `scripts/mx700-1.38-validate.ts` (flag forced on, self-deletes its test rows).

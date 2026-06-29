---
name: Platform Lifecycle Operations (MX-700 1.42)
description: Frontend exposure console composing the 1.37–1.41 read APIs; flag platformLifecycleOperations; honesty/probe traps.
---

# Platform Lifecycle Operations & SuperAdmin Governance Platform (MX-700 Phase 1.42)

Frontend EXPOSURE phase. Flag `platformLifecycleOperations` / `FF_PLATFORM_LIFECYCLE_OPERATIONS`
(default OFF). OFF → byte-identical legacy incl. schema.

## What it is
ONE read-only SuperAdmin console panel (`PlatformLifecycleOperationsPanel.tsx`, 8 sub-tabs:
Lifecycle / Capability / Repository / Technical Debt / Version / Governance / Observability /
Administration) that COMPOSES the already-shipped read APIs of the prior chain:
- F = 1.37 Foundation `/api/admin/platform-lifecycle`
- I = 1.39 Intelligence `/api/admin/platform-lifecycle-intelligence`
- E = 1.40 Evolution `/api/admin/platform-evolution-intelligence`
- A = 1.41 Automation `/api/admin/platform-lifecycle-automation`
(1.38 Management has no console of its own; its data surfaces through I/E composition.)

## Rules that bit / must hold
- **NO new data endpoints.** Composition is CLIENT-SIDE over existing APIs. The only backend surface
  is the probe route (`/enabled` + `/feature-flag`). No service, no migration, no persistence.
- **Per-section engine probe.** The console flag only says the CONSOLE is exposed — it says NOTHING
  about whether the underlying 1.37–1.41 engines are activated. Each section probes its OWN engine
  flag and shows an honest "engine OFF" notice rather than fabricating 0. Dashboard≠Runtime,
  Visible≠Operational, Built≠Activated. null→"—" (null≠0).
- **Global `/api/admin` gate wins over route-level flag-first.** Unauth smoke on `/enabled` AND
  `/feature-flag` both return 401 (NOT the route's own 503/200), because the global
  `app.use('/api/admin')` auth middleware intercepts before the route gate. So OFF smoke is ∈
  {401,403,503}; 401 (not 404) confirms the route is registered. Same pattern as 1.39/1.40/1.41.
- **Nav wiring is DOUBLE in SuperAdminDashboard.tsx**: the tab lives both in the
  `CompetencyFrameworkShell` `extraTabs` array (node) AND in a parallel top-level
  `activeTab === '<id>' && <flag> && <Panel/>` render block — add BOTH or the tab renders blank.
- Frontend vite build is env-blocked/pathologically slow here; validate via esbuild parse of changed
  TSX + intact `frontend/dist`, NEVER pkill.

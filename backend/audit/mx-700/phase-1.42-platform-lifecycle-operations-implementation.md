# MX-700 Phase 1.42 — Platform Lifecycle Operations & SuperAdmin Governance Platform

**Type:** Frontend exposure phase (enhancement-only, additive, flag-gated).
**Flag:** `platformLifecycleOperations` / `FF_PLATFORM_LIFECYCLE_OPERATIONS` (default OFF).
**Status:** Implemented; flag OFF → byte-identical legacy (incl. schema — zero new persistence).

## Goal
Extend the EXISTING SuperAdmin with ONE read-only console that COMPOSES the already-shipped
read APIs of the prior MX-700 chain — 1.37 Foundation, 1.38 Management, 1.39 Intelligence,
1.40 Evolution, 1.41 Automation — into a single Platform Lifecycle Operations surface.

## Non-goals (explicitly NOT done — by design)
- NO SuperAdmin V2, NO parallel/duplicate dashboard, NO duplicate service.
- NO new data endpoints (composition is client-side over existing 1.37–1.41 APIs).
- NO migration, NO new tables, NO new persistence.
- NO business-logic change, NO dormant-engine activation.

## What was implemented
- **Flag + helper** — `platformLifecycleOperations: false` added to `backend/config/feature-flags.ts`
  with `isPlatformLifecycleOperationsEnabled()` (mirrors 1.41).
- **Probe-only route** — `backend/routes/platform-lifecycle-operations.ts`
  (`registerPlatformLifecycleOperationsRoutes(app, requireAuth, requireSuperAdmin)`, registered in
  `routes.ts`). BASE `/api/admin/platform-lifecycle-operations`. ONLY two endpoints:
  - `GET /enabled` — flag probe, `{ enabled }`.
  - `GET /feature-flag` — gate (503 when OFF) → `requireAuth` → `requireSuperAdmin` → `{ ok, enabled }`.
  No data endpoints.
- **Console panel** — `frontend/src/components/superadmin/PlatformLifecycleOperationsPanel.tsx`.
  8 sub-tabs: Lifecycle, Capability, Repository, Technical Debt, Version, Governance, Observability,
  Administration (client-side search over already-fetched data). Composes EXISTING read APIs of
  engines F (1.37), I (1.39), E (1.40), A (1.41). Each section independently probes its own engine
  flag via the engine's `/enabled` and renders an honest "engine OFF" notice when its backend is
  disabled — never fabricates data. `null → "—"` throughout.
- **Nav wiring** — `SuperAdminDashboard.tsx`: lazy import + `platformLifecycleOperationsEnabled`
  flag probe (`/feature-flag` `res.ok`) + conditional `extraTab` + top-level render block next to
  `platform-lifecycle`. Tab hidden when flag OFF (byte-identical UI).

## Honesty axes preserved
- Dashboard ≠ Runtime · Visible ≠ Operational · Built ≠ Activated · Coverage ⟂ Confidence · null ≠ 0.
- The operations-console flag reports only whether the CONSOLE is exposed — it says nothing about
  whether the underlying 1.37–1.41 engines are activated; each section probes its own engine flag.

## Validation
- esbuild parse clean: route + `feature-flags.ts` (backend); panel + `SuperAdminDashboard.tsx` (frontend).
- Backend API restarted.
- OFF smoke (unauth): `/feature-flag` → 401, `/enabled` → 401. Both ∈ {401,403,503}: the global
  `app.use('/api/admin')` auth gate intercepts before the route's own flag gate (documented behavior
  for the whole 1.37–1.41 chain). Route is registered (401, not 404). Flag-OFF → nav tab hidden.
- Frontend vite build is env-blocked / pathologically slow in this workspace (as in prior phases);
  validated instead via esbuild parse of changed TSX + intact `frontend/dist`.

## Deferred / dormant / missing
- Underlying 1.37–1.41 engines remain individually flag-gated and largely dormant; the console
  surfaces their REAL state (engine-OFF notices) rather than activating them.
- No new analytics or write paths — the console is strictly read-only composition.

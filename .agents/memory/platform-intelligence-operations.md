---
name: Platform Intelligence Operations Center (MX-800 2.11)
description: Frontend-exposure console composing the 9 MX-800 intelligence tiers client-side; probe-only backend; mirrors MX-700 1.42.
---

# Platform Intelligence Operations Center (MX-800 Phase 2.11)

Flag `platformIntelligenceOperations` / `FF_PLATFORM_INTELLIGENCE_OPERATIONS` (default OFF, byte-identical incl. schema). FRONTEND-EXPOSURE phase that mirrors MX-700 1.42 (`platformLifecycleOperations`) EXACTLY.

**Rule:** this is a presentation layer only. ONE read-only SuperAdmin console (`superadmin/PlatformIntelligenceOperationsPanel.tsx`) that COMPOSES the already-shipped read APIs of the nine prior MX-800 tiers (2.1 registry, 2.3 engineering, 2.4 runtime, 2.5 knowledge, 2.6 decision, 2.7 predictive, 2.8 recommendation, 2.9 continuous-learning, 2.10 enterprise) **CLIENT-SIDE**. Backend is probe-only (`/enabled` + `/feature-flag`). NO service, NO migration, NO new persistence, NO new data endpoint, NO business-logic change, NO dormant activation.

**Why:** the spec explicitly forbids a parallel dashboard/operations engine — the 2.1–2.10 engines already expose every read getter, so the only honest exposure is to fetch them client-side and render. Adding any backend aggregator would duplicate the engines and risk invoking dormant ones.

## How to apply / traps
- **Probe-only backend gate ordering is mooted by the global `/api/admin` auth gate.** `app.use('/api/admin')` runs `requireAuth` before any route handler, so BOTH `/enabled` and `/feature-flag` return **401** when unauthenticated even though `/enabled` is route-level ungated. OFF smoke target is ∈{401,403,503}; 401 (not 404) proves the route is registered. Do NOT "fix" the 401 on `/enabled` — it's the established platform reality (same as 1.42).
- **React rules-of-hooks:** the panel calls `useEngineEnabled`/`useQuery` once per tier. ALWAYS iterate the CONSTANT `TIERS` array (stable length/order) and gate via `enabled: on[base]`. NEVER iterate a `.filter(on)` array to build hooks — the set of enabled engines changes between renders and crashes with a hook-count mismatch.
- **Per-section engine probe + EngineOff:** the console flag only says the CONSOLE is exposed; each section must independently probe its own engine `/enabled` and render an honest "engine OFF" notice. Built ≠ Activated; Visible ≠ Healthy; Dashboard ≠ Intelligence; Monitoring ≠ Governance; Insight ≠ Decision.
- **Alerts are client-side DERIVED** from each enabled engine's own `/validation` output (recursive scan for concern-status leaves, depth-capped). Alert ≠ Incident — observations for human review only, never auto-executed.
- **Generic renderers** (`RecursiveKV`, `DataTable`) handle the 9 tiers' differing response shapes without hardcoding nested keys (which would mis-key to "—" everywhere or crash). null/absent → "—" (null ≠ 0). Don't hand-map every tier's shape.
- **DOUBLE nav wiring** in `SuperAdminDashboard.tsx` (same as every flag-gated panel): lazy import + feature-flag `useQuery` (res.ok, gated on `isAuthenticated`) + `extraTabs` conditional-spread node + parallel `activeTab===` block. Tab hidden when OFF.
- **Validation:** vite build is env-blocked/slow → validate via `esbuild` parse of changed TSX + confirm `frontend/dist` intact. NEVER pkill (kills own shell).

Tier BASEs: 2.1 `/api/admin/platform-intelligence-registry` · 2.3 `/api/admin/engineering-intelligence` · 2.4 `/api/admin/runtime-intelligence` · 2.5 `/api/admin/knowledge-intelligence` · 2.6 `/api/admin/decision-intelligence` · 2.7 `/api/admin/predictive-intelligence` · 2.8 `/api/admin/recommendation-intelligence` · 2.9 `/api/admin/continuous-learning-intelligence` · 2.10 `/api/admin/enterprise-intelligence`. (Note: registry 2.1 has no `/metrics`; runtime 2.4 adds `/application-health,/performance,/observability,/service,/resource`.)

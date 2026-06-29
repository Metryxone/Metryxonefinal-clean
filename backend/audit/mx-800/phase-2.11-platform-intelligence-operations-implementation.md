# MX-800 Phase 2.11 — Platform Intelligence Operations Center (implementation)

**Flag:** `platformIntelligenceOperations` / `FF_PLATFORM_INTELLIGENCE_OPERATIONS` — **default OFF**, byte-identical legacy when OFF (incl. schema — there is no schema to create).

**Type:** FRONTEND-EXPOSURE phase. Mirrors MX-700 Phase 1.42 (`platformLifecycleOperations`) EXACTLY: ONE read-only SuperAdmin console that **COMPOSES the already-shipped read APIs of the nine prior MX-800 intelligence tiers CLIENT-SIDE**. **NO new service, NO migration, NO new persistence, NO new data endpoints, NO business-logic change, NO dormant activation, NO V2, NO duplicate dashboard/operations-center.**

## Composed tiers (existing read APIs only — client-side fetch)
| Tier | Phase | BASE |
|---|---|---|
| Platform Intelligence Registry | 2.1 | `/api/admin/platform-intelligence-registry` |
| Engineering Intelligence | 2.3 | `/api/admin/engineering-intelligence` |
| Runtime Intelligence | 2.4 | `/api/admin/runtime-intelligence` |
| Knowledge Intelligence | 2.5 | `/api/admin/knowledge-intelligence` |
| Decision Intelligence | 2.6 | `/api/admin/decision-intelligence` |
| Predictive Intelligence | 2.7 | `/api/admin/predictive-intelligence` |
| Recommendation Intelligence | 2.8 | `/api/admin/recommendation-intelligence` |
| Continuous Learning Intelligence | 2.9 | `/api/admin/continuous-learning-intelligence` |
| Enterprise Intelligence | 2.10 | `/api/admin/enterprise-intelligence` |

## Backend (probe-only)
`backend/routes/platform-intelligence-operations.ts` — `registerPlatformIntelligenceOperationsRoutes(app, requireAuth, requireSuperAdmin)`, BASE `/api/admin/platform-intelligence-operations`:
- `GET /enabled` — persona-agnostic flag probe `{ enabled }` (no auth at route level).
- `GET /feature-flag` — gate (503 before auth touch when OFF) → `requireAuth` → `requireSuperAdmin` → `{ ok:true }`.

Wired in `backend/routes.ts` (import + `registerPlatformIntelligenceOperationsRoutes(app, requireAuth, requireSuperAdmin)` after the 2.10 registration).

**OFF smoke (flag OFF):** both `/enabled` and `/feature-flag` return **401** — the global `app.use('/api/admin')` auth gate intercepts before the route-level flag gate. This is the documented 1.42 behaviour: **401 (not 404) confirms the route is registered**; OFF smoke ∈ {401,403,503} ✓. **No own tables exist by design.**

## Frontend (the console)
`frontend/src/components/superadmin/PlatformIntelligenceOperationsPanel.tsx` — read-only console, 9 sub-tabs mapped to the spec's 10 parts:
1. **Operations** — unified per-engine activation grid (enabled/dormant) + enterprise `/summary`. Console exposure ≠ engine activation.
2. **Monitoring** — 9 per-engine health cards from each tier's `/summary` (runtime uses `/application-health`). *Visible ≠ Healthy.*
3. **Observability** — enterprise `/correlation` + runtime `/observability` + runtime `/performance` + engineering `/metrics`. *Correlation ≠ Causation.*
4. **Governance** — registry `/governance`, decision `/governance`, engineering `/quality` + `/architecture`, enterprise `/validation`. *Monitoring ≠ Governance; human approval mandatory.*
5. **Operational Intelligence** — predictive `/risk` + `/trend`, recommendation `/opportunity` + `/action`, enterprise `/insights`. *Insight ≠ Decision.*
6. **Alerts** — **CLIENT-SIDE DERIVED** observations from each enabled engine's own `/validation` output (concern-status leaves). *Alert ≠ Incident; never auto-executes.*
7. **Executive** — enterprise `/executive` + `/metrics` (separate scores, no composite) + `/organizational`.
8. **SuperAdmin Ops** — client-side search over enterprise `/registry`.
9. **Validation** — each tier's own STRUCTURAL `/validation` verdict.

**Honesty discipline baked in:** each section independently probes its own engine `/enabled` and renders an honest `EngineOff` notice when that engine is OFF; `num()`/`dash()` render null/absent → `"—"` (never a fake 0); status-like fields render as toned badges; the global "no engines enabled" banner is shown when none are on. Generic `RecursiveKV`/`DataTable` renderers handle each tier's differing response shapes without fabricating zeros.

**React hooks correctness:** the main component and `AlertsSection` iterate the **CONSTANT `TIERS` array** (stable hook count/order) and gate each `useQuery` via `enabled: on[base]` — no rules-of-hooks violation when engines toggle.

## Nav wiring (DOUBLE, in `frontend/src/components/SuperAdminDashboard.tsx`)
1. `lazy` import of the panel.
2. `useQuery` probing `/api/admin/platform-intelligence-operations/feature-flag` (`res.ok`), gated on `isAuthenticated`.
3. `extraTabs` conditional-spread node (id `platform-intelligence-operations`) — present only when the flag probe is true.
4. Parallel top-level `activeTab === 'platform-intelligence-operations'` render block.

Tab is **hidden entirely when OFF** (probe `res.ok` false → no tab, no render).

## Validation performed
- `esbuild` parse of `PlatformIntelligenceOperationsPanel.tsx` (clean), modified `SuperAdminDashboard.tsx` (clean), and `platform-intelligence-operations.ts` (clean). (Vite build is env-blocked/slow — never pkill; `frontend/dist` confirmed intact.)
- Backend OFF smoke as above.
- architect code review (`includeGitDiff`) — **PASS**, no severe issues.

## STOP
Phase complete and **STOPPED for approval. NO deploy.** Phase 2.12+ is FUTURE — not built.

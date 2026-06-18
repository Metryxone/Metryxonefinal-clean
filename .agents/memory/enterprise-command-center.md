---
name: SuperAdmin Enterprise Command Center (IA + Product Command Centers)
description: Nav IA rewrite + per-product executive aggregator; pool topology and honest-axis conventions that aren't obvious from the code.
---

# Enterprise Command Center

The SuperAdmin shell was reorganized into 9 visible nav groups (Mission Control,
Products, Intelligence, Organizations, Operations, Reports, Commercial,
Governance, Platform) plus two collapsible `isLabs` tier groups (Advanced Mode,
Developer Mode) for low-frequency screens. Mission Control + 6 Product Command
Centers (`cc-capadex/competency/lbi/employability/career/employer`) are the
executive surfaces.

## Non-obvious facts (don't re-derive the hard way)
- **`concernsPool` IS the main `DATABASE_URL` pool** (`new pg.Pool({connectionString: process.env.DATABASE_URL})`). There is no separate concerns database — every admin route that takes `concernsPool` queries the one DB.
- **`capadex_sessions` / `concerns_master` do NOT exist in this DB.** CAPADEX runtime lives in `capadex_session_telemetry` (has `created_at`) and `capadex_session_signals` (`captured_at`); reference data in `capadex_clarity_questions`, `capadex_question_registry`, `capadex_signal_profiles`, `capadex_linguistic_signals`, `capadex_stage_pricing`.
- **CAPADEX command center reads `idle` (0% activation) honestly** because there are no runtime telemetry rows in dev — that is a true finding, not a bug. Do not seed fake sessions to make it green.
- **LBI has NO timestamp column** (`lbi_score_history` lacks created_at), so its Trend is honestly `available:false, reason:'no_time_basis'`. Any product without a real timestamp column must degrade trend, never fabricate one.

## Conventions baked into the product aggregator
- **Coverage vs Activation are two independent axes, never composited.** Coverage = fraction of ALL declared sources materialized (rows>0); Activation = fraction of `kind:'runtime'` sources with live data. Reference-only data fully present + activation 0 is a legitimate state.
- Config-driven: each product = list of `{label, table, kind:'reference'|'runtime', usage?}` + optional `{trend: {table, tsCol}}`. Adding a product = add a config block (tables must be verified to exist; counts are guarded so a missing table degrades one indicator to "unavailable").
- Endpoints under `/api/admin/product/*` follow the admin convention: `requireAuth`+`requireSuperAdmin`, 60s TTL cache, `?refresh=1` busts. Registered next to `registerMissionControlRoutes` in routes.ts.

## Sidebar multi-tier gotcha
- The legacy sidebar had a SINGLE `labsOpen` boolean → only one collapsible labs group. Multiple `isLabs` tier groups must key on `openGroups.has(group.label)` / `toggleGroup(group.label)` (the same Set used by named groups). `labsOpen/setLabsOpen` props remain wired but unused after this change.

## Command palette (⌘K / Ctrl+K)
- `components/superadmin/CommandPalette.tsx` — additive global jump-to-screen over EVERY admin tab. Derives its list from the live `navGroups` (so new tabs appear automatically, including `isLabs` tiers), and navigates via `setActiveTab`. Open state is LIFTED into `SuperAdminDashboard` with a `window` keydown listener (`metaKey||ctrlKey` + `k`); the palette renders inside `AdminDashboardContext.Provider` so `useAdminDashboard()` works.
- **Additive, not a replacement**: the original header `searchQuery` `<Input>` (sidebar filter) was KEPT alongside the new ⌘K trigger button — do not remove it again (an architect review caught its removal as a regression).
- `vite build` does NOT typecheck — a missing `useState`/`useEffect` import still builds green but throws at runtime. After hook-adding edits, confirm imports manually; the green build is not proof.
- Arrow-nav must clamp with `Math.max(0, results.length-1)` or empty results drive selection to -1.

## Global Search (`/api/admin/search`) + Action Center (`/api/admin/action-center`)
- **Global search covers 12 BACKEND entity types; the ⌘K palette shows 13 GROUPS** (those 12 + the instant local **Navigation** group). If a spec says "13 entity types", it's the palette-group count — do NOT fabricate a 13th backend entity over a marginal table to hit the number.
- **Non-obvious entity→table map** (verified to exist): candidates=`cra_profiles`, institutions=`users` filtered by `account_type ILIKE '%institut%'` (no dedicated table → honestly empty), employers=`employer_organizations`, signals=`ti_signal_master` (~300), competencies=`competency_dna_master` (~21), jobs=`cg_roles` (~200), skills=`frp_skill_library` (~41), subscriptions=`capadex_stage_pricing` (~4), questions=`question_bank` (empty in dev). assessments unions `ti_fact_assessments`+`ep98_hiring_assessments`; reports union `rf_master`+`lbi_report_types`.
- **`health` is null unless a REAL numeric column exists.** A boolean flag (e.g. employer `verified`) must NOT be mapped to a pseudo-score (100/40) — that's fabrication an architect review WILL catch. Surface the boolean as a subtitle fact ("verified"/"unverified") and keep `health:null`.
- **Action Center 8 categories; sources that have no table → `available:false`** (institution_requests, support_requests). `aig_alerts` rows are RULE CONFIGS not fired alerts — only surface those with `trigger_count>0` (unack/unresolved). Empty (total 0) in dev is the HONEST state (no pending approvals/failed jobs/escalations); do not seed.
- **2FA dev login uses passport `username` field, not `email`** — `POST /api/login {username, password}` → `{mfaRequired, attemptToken}`; read code from `mfa_codes` (used=false, latest expires_at); `POST /api/admin/mfa/verify {attemptToken, code}`. `[DEMO]`-prefixed seed rows break bare curl URLs (bracket/space) — query a clean token like `acme`.

## Notification Center (`/api/admin/notifications`) + Readiness Dashboards (`/api/admin/readiness`)
- **Two more read-only never-throws aggregators** in the same family. Notifications: 4 categories (System/Assessment/Commercial/Operational); severity is DERIVED from real status/severity cols, never invented; a missing source table → `available:false`; total 0 in dev is the HONEST state (no fired alerts) — do not seed.
- **Readiness = 7 products × 8 dimensions** (structural/activation/data/intelligence/commercial/operations/security/governance). Dim score = `round(met/total*100)` over REAL signal tables; a dimension with no declared signal for that product → `available:false` (e.g. capadex operations/security/governance), and **overall = mean of AVAILABLE dims only** (never count unavailable dims as 0 — that would fabricate a low score). capadex overall=20 'early' on empty dev runtime tables is honest; lbi=100 / competency=88 reflect seeded reference data.
- **`readiness_snapshots` is the only write path** and it is lazily ensured at route registration; the GET endpoints are pure reads. Trend/history need ≥2 snapshots → `trend.available:false reason:'insufficient_history'` until then (do NOT synthesize a direction from one point).
- **Icon-import trap (recurrence of the "vite build doesn't typecheck" rule):** added nav items used `Bell`/`Gauge`; `Gauge` was NOT in the `lucide-react` import block in `useAdminDashboardState.tsx` and vite STILL built green — it only throws `ReferenceError` at runtime. An architect review caught it. After adding any nav `icon:` reference, grep the import block for that identifier; the green build is not proof.
- **Nav-badge count polls mirror `actionCenterCount`:** a 60s `useEffect` keyed on `isAuthenticated` hits `/summary`; `notificationCount` = critical+warning. `navGroups` is a plain array rebuilt each render (NOT a useMemo), so new count state is picked up automatically — no dep array to update.

## Health Dashboards (`/api/admin/health`)
- **Same read-only never-throws family, 4th aggregator.** 6 domains (Platform/Data/Assessment/API/DB/Security), each runs REAL checks with a 5-value status: `ok|warn|fail` are SCORED (100/50/0), `info` shows but is NOT scored, `unknown` = "not measurable here" (excluded, never scored 0). `health_snapshots` is the only write path (lazy-ensured at registration); 15s cache TTL (shorter than the 60s family — this is "real-time", frontend polls every 15s).
- **Status and score are SEPARATE signals — never normalize one to the other.** Domain/overall STATUS = worst (any fail → `down`); SCORE = mean of scored checks. So `overall_status:'down'` with `overall_score:97` is the CORRECT honest output (one empty `capadex_clarity_questions` → data domain `down`), not a UX bug. An architect review confirmed this; a tooltip on the overall pill explains it. Do NOT collapse status into the score to make it look green.
- **`info` checks (Node version, DB size, active connections, user/session counts) are facts, not verdicts** — keep them out of the score or a healthy fact drags the mean. HTTP error rate is honestly `unknown` (no request-log table exists). DB latency/pool read via `pingMs` + `pool.totalCount/idleCount/waitingCount` (best-effort; guard with `typeof === 'number'`).

## Additive UX shell (breadcrumbs + sticky context bar)
- `AdminShellBar.tsx` + `adminUx.ts` (spacing tokens): a sub-header rendered BETWEEN the main header and panel content. Breadcrumbs (Mission Control / Group / Current) + "Go to…" sibling-screen dropdown are derived from the LIVE `navGroups` (so new tabs appear automatically); non-nav tabs (settings/rie-escalations) degrade via a `currentLabel` fallback (never crash).
- **Two `sticky top-0` siblings COLLIDE** (lower z-index slides under the higher one and hides). To pin a header + a sub-bar together, wrap BOTH in ONE `sticky top-0 z-30` container and make the inner bars non-sticky — do not give each its own `sticky top-0`.
- **"Additive UX shell" does NOT license a global content-container change.** Constraining the content wrapper to `max-width:1600` reflows EVERY existing panel → an architect review correctly FAILED it as non-byte-identical. Keep cross-cutting layout (max-width, padding rhythm) OPT-IN per panel (export the helper, don't apply it globally); only the new bar is truly additive.
- **Honesty applies to UX too:** don't add a "copy deep link" action when there's no tab-in-URL routing — the link wouldn't navigate, so it's a fabricated feature. Only ship context actions that actually work (sibling-jump, back-to-root, scroll-top all use `setActiveTab`/`window.scrollTo`).

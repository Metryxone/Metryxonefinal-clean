# SuperAdmin — End-to-End Audit

**Scope**: the `super_admin` surface — authentication/authorization, the dashboard frontend, and the `/api/admin/*` backend API.
**Method**: source inspection + grep verification of every claim + live workflow log review (dev).
**Stance** (per project policy): honesty over optimism. **Coverage** (does it exist / is it wired) and **Confidence** (is it correct / trustworthy) are reported as separate axes. Nothing here is inferred from naming alone — each finding cites where it was verified.

> **Remediation pass (this revision)**: the launch-blocking findings **F1, F2, F3 are now REMEDIATED in code** (the audit was originally read-only; remediation was a subsequent, explicitly-approved task). A single authoritative `app.use('/api/admin', requireAuth, requireSuperAdmin)` gate (F3) now covers the **entire** admin surface — which closed F1 (PAIE admin) **and a much larger previously-unguarded engine-admin surface discovered during remediation** (see F3). The non-`/admin` PAIE write routes are gated by `app.use('/api/paie', …)` (F1). RIE tables now self-create via a lazy ensure-schema, which also backfilled three columns the canonical migration had omitted but the handlers require — the Crisis Inbox endpoint now returns 200 (F2). Per-finding status lines and smoke-test evidence are inline below.

---

## 1. Verdict

| Axis | Rating | Basis |
|---|---|---|
| Auth & session design | **Strong** | scrypt, Postgres session store, hardened cookie, mandatory MFA for super_admin, fails-closed guard, no self-register escalation |
| Authorization **coverage** | **Strong (remediated)** | one authoritative `app.use('/api/admin', requireAuth, requireSuperAdmin)` global gate now covers the **entire** admin surface; non-admin PAIE writes gated via `app.use('/api/paie', …)` (F1/F3 remediated) |
| Frontend architecture | **Strong** | single state source, error-boundary per panel, config-driven CRUD, new accordion+search nav |
| Data/engine **confidence** | **Mixed (honest)** | core admin areas real & populated; several Advanced-Labs engines are synthetic/simulation stubs (F5) |
| Operational health (dev) | **Remediated** | Crisis Inbox 500s fixed — lazy ensure-schema creates the RIE tables **and** the three columns the migration omitted; endpoint now 200 (F2 remediated) |
| Documentation accuracy | **Was stale, now corrected** | prior doc had wrong creds/MFA/nav/counts (F4) |

**Bottom line (post-remediation)**: the SuperAdmin console is well-architected and the security model fails closed. Authorization is now enforced by **one authoritative global gate** (`app.use('/api/admin', …)`) with per-route guards retained as defence-in-depth. Remediation revealed the original "PAIE only" framing **understated** the exposure: the same missing-guard pattern affected most engine-admin families (ROIE, LDE, SPE, most BIOS, cognitive, semantic, memory, digital-twin, predictive, psychometrics, fairness, ethics, CSI, and `/api/admin/capadex/*`). The single global gate closes all of them at once. The original launch-blockers (F1, F2) are fixed and smoke-tested.

---

## 2. Findings (severity-ordered)

### F1 — CRITICAL · `/api/admin/paie/*` is unauthenticated · ✅ REMEDIATED
- **Evidence**: `backend/routes.ts` registers `registerPAIEGovernanceRoutes(app, concernsPool)` with **no guard args**. `backend/routes/paie-governance.ts` declares routes as `app.get("/api/admin/paie/simulations", async …)` etc. with **no inline `requireAuth`/`requireSuperAdmin`**, and a content grep of that file returns **zero** matches for either guard. The only router-level `/api/admin/*` guards are `bios/runtime-state`, `iil`, `nhda` — **`paie` is not covered**.
- **Impact**: anyone (no session) can hit `/api/admin/paie/simulations`, `/api/admin/paie/agents/:name/invoke`, `/api/admin/paie/agents/orchestrate`, `/api/admin/paie/governance/master`, etc. — i.e. read PAIE data and **execute** simulations / agent invocations. Data sensitivity is lower than user PII (much is synthetic), but unauthenticated **admin-namespaced** read + compute-execution is a real exposure and abuse vector.
- **Breadth**: the sibling files `paie-forecasting.ts`, `paie-opportunity.ts`, `paie-intelligence.ts` also return **zero** guard matches — likely the same gap across the PAIE family. Confirm before fixing.
- **Recommended fix**: pass `requireAuth, requireSuperAdmin` into the PAIE registrars (or add `app.use('/api/admin/paie', requireAuth, requireSuperAdmin)` and an equivalent for the non-`/admin` `/api/paie/*` mutation routes), mirroring `enterprise-analytics.ts` / `ai-governance.ts`. **DECISION (owner)**: the `/api/paie/*` (non-admin) write routes (`simulation/run`, `model/evolve`, `fairness/audit`) also need a guard decision — they currently mutate with no auth.
- **✅ REMEDIATION (applied)**: the `/api/admin/paie/*` GETs are now covered by the global `/api/admin` gate (F3). The non-`/admin` `/api/paie/*` write/compute routes are gated by `app.use('/api/paie', requireAuth, requireSuperAdmin)` registered immediately before the PAIE registrars in `backend/routes.ts`. Owner decision resolved: these are super-admin Advanced-Labs ops (only the PAIE super-admin panels call them), so super-admin-only is correct. **Smoke-tested (unauth)**: `GET /api/admin/paie/governance/master` → 401; `POST /api/paie/simulation/run` → 401.

### F2 — HIGH (dev) / MEDIUM (prod) · Crisis Inbox endpoint 500s — `rie_escalations` missing · ✅ REMEDIATED
- **Evidence (runtime, dev)**: live `Backend API` logs show repeated `GET /api/admin/rie/escalations/unread 500 :: relation "rie_escalations" does not exist` (every poll, code `42P01`, `backend/routes/rie-admin.ts:185`). **Source evidence**: `rie-admin.ts` declares "no DDL here" and queries `rie_escalations` directly with **no `CREATE TABLE IF NOT EXISTS` / ensure-schema`; the table is created only by migration `backend/migrations/20260507_rie_engine.sql`, which has not been applied in this environment. (Source proves the schema dependency; the dev logs prove the table is currently absent — prod status depends on whether that migration ran there.)
- **Impact**: the Crisis Alert Inbox badge (highest-priority operator surface) is broken in dev; the panel cannot load its queue. In prod this depends on whether the RIE migration was applied.
- **Recommended fix**: run the RIE migration (or add a lazy ensure-schema in `rie-admin.ts` consistent with the rest of the codebase). Add a smoke check that the crisis endpoint returns 200 before launch.
- **✅ REMEDIATION (applied)**: added a module-level memoized `ensureRieSchema(pool)` to `backend/routes/rie-admin.ts` — idempotent `CREATE TABLE/INDEX IF NOT EXISTS` mirroring all 8 tables of migration `20260507_rie_engine.sql` (kept in lockstep; resets its promise on failure so a transient error retries). It is warmed fire-and-forget at registration **and** awaited by an `app.use('/api/admin/rie', …)` middleware so no request can race ahead of the DDL.
  - **Schema-drift sub-finding (discovered during remediation)**: once the table existed, the same endpoint failed with `42703 column "assigned_to_name" does not exist`. The Crisis Inbox handlers SELECT/UPDATE three columns — `assigned_to_name`, `acknowledged_at`, `acknowledged_by` — that the canonical migration **never defined** (the migration was out of sync with the handler code). Creating the table alone would only have swapped a `42P01` for a `42703`. Fixed by adding all three columns to both the migration and the ensure-schema, with idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (the table already existed from the first restart, so `CREATE TABLE IF NOT EXISTS` would not have added them).
  - **Verified (runtime evidence)**: live `Backend API` log — `GET /api/admin/rie/escalations/unread 200 :: {"count":0,"alerts":[]}` for an authenticated dashboard poll (previously a repeating 500). All three columns confirmed present in the dev DB; the handler's exact SELECT and the acknowledge UPDATE both run cleanly against the DB. Unauthenticated, the endpoint returns 401 from the global gate (reaches auth, never the handler).

### F3 — MEDIUM · Authorization is per-route; the global gate is partial · ✅ REMEDIATED
- **Evidence**: `requireSuperAdmin` is defined at `backend/routes.ts` ~L4828, **after** many routes are registered. Routes earlier than that (e.g. the inline guard at ~L1393, comment: "requireSuperAdmin defined later in this function") must hand-roll their own guard. Across `backend/routes.ts` + `backend/routes/*.ts` there are ~1,202 `requireSuperAdmin` usages over ~927 `/api/admin` path literals — i.e. guarding is widespread but **manual**, so a single forgotten guard (as in F1) is silently unprotected.
- **Impact**: structural fragility. Coverage is high but not guaranteed; correctness depends on every author remembering the bookend.
- **Recommended fix**: add one authoritative `app.use('/api/admin', requireAuth, requireSuperAdmin)` mounted before any `/api/admin` route is registered, then treat per-route guards as defence-in-depth. This converts F1-class bugs from "exposed" to "double-guarded". (Verify no `/api/admin/*` route legitimately needs non-super-admin access first.)
- **✅ REMEDIATION (applied)** — and the gap was BIGGER than F1 implied: a global `app.use('/api/admin', …)` gate is now mounted in `backend/routes.ts` immediately after `requireSuperAdmin` is defined (so it precedes the bulk of admin routes), with a single exemption for `/api/admin/lbi-catalog` (which intentionally allows any authenticated user; its own `requireAuth` still applies). The pre-login MFA routes (`/api/admin/mfa/verify`, `/api/admin/mfa/resend`) are registered **earlier** in the stack and are intentionally unaffected — verified still reachable (`POST /api/admin/mfa/verify` → 400, not blocked).
  - **Honest scope correction**: during remediation, grep showed PAIE was **not** the only unguarded family — most engine-admin routes were declared as bare `async (req,res)=>` with no inline guard: ROIE, LDE, SPE, most BIOS, cognitive, semantic, memory, digital-twin, predictive, psychometrics, fairness, ethics, CSI, and `/api/admin/capadex/*`. The single global gate closes **all** of them at once (this is why F3, not F1, is the structural fix). **Smoke-tested (unauth, all → 401)**: `/api/admin/{roie/risk/dashboard, lde/cohorts, spe/dashboard, capadex/analytics, bios/simulations, cognitive/profiles}`; `/api/admin/lbi-catalog` → 401 from its own `requireAuth` (correctly **not** super-admin-gated).
  - **Follow-up (NOT implemented — out of scope of F1/F2/F3)**: non-`/admin` engine compute prefixes other than `/api/paie/*` (e.g. any `/api/roie/*`, `/api/lde/*` POST compute routes, if present) were not swept here. They are not covered by the `/api/admin` gate and warrant the same review as a separate task before relying on them being closed.

### F4 — LOW · Documentation drift (now corrected)
- **Evidence vs prior `docs/SUPERADMIN.md`**: creds were `superadmin@metryx.one` (actual seeder: `support@metryxone.com`, `backend/storage.ts:4149`); MFA described "optional/toggleable" (actual: **mandatory** for super_admin, `/api/login`→`mfa_codes`→`/api/admin/mfa/verify`); sidebar described as 5 groups (actual: **20**); panel count "84" (actual: **163** files under `superadmin/` + 8 under `caf/`); `requireSuperAdmin` cited at L4546 (actual ~L4828).
- **Impact**: operators following the old doc could not log in (wrong username) and mis-modelled the security posture.
- **Status**: `docs/SUPERADMIN.md` rewritten this revision with verified values.

### F5 — INFO/MEDIUM · Some Advanced-Labs engines are synthetic stubs
- **Evidence**: `backend/routes/paie-governance.ts` uses an `rnd(min,max)` helper to fabricate simulation/agent/fairness outputs; the explorer classified PAIE as "mix of populated logic and simulation stubs". This is consistent with the additive/flag-gated model (engines self-bootstrap with placeholder data in dev).
- **Impact**: not a bug, but operator-facing numbers in PAIE/some labs panels are **not real predictions**. Risk only if surfaced to end-users or represented as decisions — which the platform's language policy forbids (developmental signals only).
- **Recommended action**: label simulation/stub panels clearly in-UI; ensure these outputs never feed user-facing hiring/suitability language. No fabrication should leak past the labs boundary.
- **✅ REMEDIATION (applied)**: added a shared `SimulatedDataBanner` (`frontend/src/components/superadmin/SimulatedDataBanner.tsx`) and surfaced it at the top of the four PAIE panels that render the `rnd()`-fabricated outputs — `PAIE{Governance,Intelligence,Opportunity,Forecasting}Panel.tsx`. The banner reads "Simulated data — not real predictions … never present these as hiring, promotion, or suitability decisions" (consistent with the developmental-signal language policy). Scope note (honesty): only PAIE is **confirmed** synthetic (via `paie-governance.ts` `rnd()`); other Advanced-Labs panels are "verify per-panel" and were **not** blanket-labelled — labelling an unverified panel "fake" would be as dishonest as the reverse. Frontend build green.

### F6 — LOW · Frontend performance: no code-splitting — **✅ FIXED**
- **Evidence (before)**: all ~163 panels were statically imported in `SuperAdminDashboard.tsx`; production build reported `SuperAdminDashboard-*.js` at **~3.14 MB** (gzip ~587 kB) — above the 1.5 MB warning.
- **Fix**: converted the **158** default panel imports from `./superadmin/*` and `./admin/*` to `React.lazy(() => import(...))`, and wrapped the conditional panel-render switch in a single `<Suspense>` (placed inside the existing `DialogsErrorBoundary`). Always-on chrome stays static — `CrisisAlertInbox` and `NotificationCenter` (header), `AdminSidebar`/`AdminDialogs` (named), `FrameworkPanel` (rendered only inside the switch but kept static), and `DialogsErrorBoundary` (a local class, not an import).
- **Result**: build green; `SuperAdminDashboard-*.js` chunk fell **3.14 MB → 386 kB** (gzip 588 → 91 kB); the 158 panels now load as separate on-demand chunks. Browser console clean after restart (no runtime errors); architect review PASSED (0 lazy components rendered outside a Suspense boundary).
- **Non-blocking note**: two Rollup warnings (`ConcernAreasPanel`, `ShortAssessmentsPanel` are dynamically imported here but also statically imported by `FrameworkPanel.tsx`) — these are **optimization limitations, not defects**; those two modules simply stay in `FrameworkPanel`'s chunk instead of getting their own.

### F7 — INFO · Pre-existing, out-of-scope noise
- `MONGODB_URI missing` warning at boot (continues because `MONGO_REQUIRED=false`) — expected in dev; **accepted, left as-is** (intentional dev posture).
- Production build warning: `Duplicate key "border"` in `frontend/src/pages/EnterpriseWorkforceOSPage.tsx` — **✅ FIXED**: the tab-button style object declared `border` twice; removed the dead `border: 'none'` and kept the intended conditional (`tab===id ? 'none' : '1px solid #e5e7eb'`). Build green.
- Two `mockup-sandbox` preview workflows are failing (missing `vite`/`fast-glob`) — unrelated dev tooling; **accepted, left as-is** (canvas mockup sandbox, not part of the app).

---

## 3. Strengths (what is genuinely solid)

- **Authentication**: scrypt hashing with per-user salt; no plaintext or reversible storage.
- **MFA mandatory for super_admin**: 6-digit code, 32-byte attempt token, 5-minute expiry, ≤5 attempts (429), atomic single-use, email masked in the response.
- **Session hardening**: Postgres-backed store, `httpOnly`, `sameSite=lax`, `secure` in prod, `trust proxy=1`.
- **Fails closed**: the guard 403s unless an explicit super-admin role is present; registration cannot grant the role.
- **Resilience**: `DialogsErrorBoundary` per panel; never-throws post-completion hooks; append-only audit.
- **Maintainability**: config-driven frameworks + `CrudTable` keep the surface consistent; one state source.
- **Honesty primitives**: Coverage vs Confidence separation, k-anonymity (k_min=30), draft→approved gates, developmental-signal language policy.

---

## 4. Real vs Stub matrix (Confidence axis)

| Area | Real & populated | Notes |
|---|---|---|
| Auth / MFA / session | ✅ | verified end-to-end in source |
| Users & Orgs, Tenants, Employers | ✅ | CRUD over real tables |
| Frameworks (LBI/SDI/Competency) | ✅ | real tables, import/export |
| CAPADEX ontology (Concerns/Clarity/Hub) | ✅ | large real datasets |
| Report Factory / EI Health / Enterprise Analytics / AI Governance | ✅ | flag-gated, 60s-cached where noted |
| Feature flags | ✅ | two systems, real |
| RIE admin | ✅ code / ✅ schema (F2 remediated) | tables now self-create via lazy ensure-schema |
| PAIE governance & family | ⚠ mixed data / ✅ guarded (F1 remediated) | synthetic `rnd()` outputs (data confidence unchanged); now super-admin-gated |
| Other Advanced-Labs engines (BIOS/ROIE/LDE/IIL/NHDA/SPE panels) | ⚠ verify per-panel / ✅ guarded (F3 remediated) | additive/flag-gated; some self-bootstrap with placeholder data — confirm before relying on numbers; **auth** now closed by the global `/api/admin` gate |

---

## 5. Prioritized recommendations

| # | Action | Severity | Type |
|---|---|---|---|
| 1 | ✅ **DONE** — PAIE `/api/paie/*` writes gated via `app.use('/api/paie', …)`; `/api/admin/paie/*` covered by global gate; owner decision = super-admin-only | CRITICAL | code fix + **owner decision** |
| 2 | ✅ **DONE** — lazy `ensureRieSchema()` creates all 8 RIE tables **and** backfills three handler-required columns the migration omitted (`assigned_to_name`, `acknowledged_at`, `acknowledged_by`); crisis endpoint now returns **200** (live-log verified) | HIGH | code/ops fix |
| 3 | ✅ **DONE** — authoritative `app.use('/api/admin', requireAuth, requireSuperAdmin)` global gate added (per-route guards retained as defence-in-depth) | MEDIUM | hardening |
| 4 | ✅ Covered by #3 (global gate closes the whole engine-admin family). **Follow-up**: sweep non-`/admin` engine compute prefixes (`/api/roie/*`, `/api/lde/*`, …) — NOT done, separate task | MEDIUM | verification |
| 5 | ✅ **DONE** — `SimulatedDataBanner` added to the 4 confirmed-synthetic PAIE panels; other labs panels left unlabelled pending per-panel verification (honesty) | MEDIUM | UX/governance |
| 6 | ✅ **DONE** — `React.lazy` code-split of 158 panels in `SuperAdminDashboard.tsx` behind one `Suspense`; chunk 3.14 MB → 386 kB (gzip 91 kB). Build green, console clean, architect PASSED | LOW | perf |
| 7 | ✅ **DONE** — `EnterpriseWorkforceOSPage` duplicate-key warning fixed | LOW | cleanup |

> **Remediation status**: items 1–3 (the launch-blockers F1/F2 + the structural fix F3), items **5 (synthetic-panel labelling)** + **7 (duplicate-key cleanup)**, and item **6 (`React.lazy` code-split — 158 panels, chunk 3.14 MB → 386 kB)** are **applied and frontend build is green** (architect review PASSED). F4 (documentation drift) was already corrected. Item 4's follow-up sweep (non-`/admin` engine compute prefixes) remains open as a separate task. Per project policy (stop for approval before deploy), nothing here is published without owner approval.

# MX-600 — Phase 1: Product Architecture & Information Architecture Audit

**Date:** 2026-06-27 · **Mode:** Read-only audit (no product code changed) · **Founder gate:** STOP for GO/NO-GO

> **Honesty discipline:** Findings below are *verified*, not inherited from a scan. Where a sub-agent flagged "duplication", I opened the files and **downgraded two over-claims** to naming hazards (see §4). Coverage (what exists) and Severity (does it hurt users / launch) are reported separately.

---

## DELIVERABLE 1 — Architecture Report

### 1.1 Topology (confirmed Phase 0 + this phase)
- **Frontend** `frontend/` — React + Vite SPA, **state-based routing** (NOT react-router): a single `Screen` union (**118 identifiers**) in `App.tsx`, switched by `currentScreen` state and synced to the URL via `window.history.pushState`/`popstate`. ~67 page files + **102 top-level components** + 17 component subdirectories.
- **Node API** `backend/` — Express, **303 route files**, **416 service files**, mounted through one ~14k-line `routes.ts` registrar.
- **FastAPI** `backend-main/` — upload service (healthy).
- **DB** — 1,426 tables (shared dev/prod instance).

### 1.2 Structural character: *evolutionary layering*
The platform grew in numbered phases (Phase 2.4, Phase 6, WC-3/5/7, MX-1xx/3xx…). The dominant pattern is **additive composition**: thin route files wrap shared services, and "Bridge"/"aggregator" services compose lower engines read-only (e.g. `career-intelligence-bridge.ts` folds Competency + EI + Role Readiness). This is *intentional* and matches the documented flag-gated additive convention — **not** accidental sprawl. But it has produced a **discoverability problem at the file/route level** (303 routes, many `career-*`, `competency-*`, `talent-*`, `workforce-*` siblings).

### 1.3 The "5-minute" test — honest verdict
- **Per-persona: PASS.** After login each role lands in ONE scoped home (career_seeker→Career Builder, student→Student Dashboard, employer→Employer Portal, mentor→Mentor Dashboard, admin→Super Admin). A logged-in user sees a coherent product.
- **Platform/marketing level: FAIL (cosmetic, not functional).** The marketing megamenu exposes **7 top categories** and **5–7 overlapping product names** (LBI™, Exam Ready™, Competency Intelligence™, Career Builder, Workforce Intelligence, MetryxAI, Mentor Marketplace) with cross-listed links (e.g. `competency-intelligence` appears under Intelligence, Products, Solutions, *and* Competency Intelligence). A first-time visitor cannot quickly tell how the products differ. This is a **messaging/IA-clarity** issue, not a broken-product issue.

---

## DELIVERABLE 2 — Navigation Map

### 2.1 Marketing megamenu (`components/layout/Navbar.tsx`)
| Category | Leads to (slugs) |
|---|---|
| **Intelligence** | lbi-product · exam-ready · ai-powered-reports · learning-paths · enterprise-hiring · leadership-readiness · workforce-analytics · competency-intelligence |
| **Products** | lbi-product · exam-ready · competency-intelligence · ai-powered-reports · metryxai-assistant · pricing |
| **Solutions** | k12-schools · coaching · edtech · learning-paths · mentor-marketplace · enterprise-hiring · competency-intelligence · campus-recruit · workforce-analytics · **competency-roletransition** ⚠️ · ld-integration |
| **Competency Intelligence** | competency-intelligence · competency-gap-analysis · competency-benchmarks · competency-career-stages · **competency-role-transition** · competency-hiring-prediction · competency-growth-simulation · competency-learning-paths |
| **Resources** | docs · case-studies · research · help · contact |
| **Company** | about · leadership · careers · press |

### 2.2 Persona routing (post-login, `Login.tsx` → `App.tsx`)
`career_seeker/job_seeker/employee_candidate → career-builder` · `student/campus_student/metryx_student → student-dashboard` · `employer/hr_recruiter/corporate → employer-portal` · `mentor/metryx_applicant → mentor-dashboard` · `super_admin/admin → super-admin` · `parent → unified-parent-dashboard` · `institute/school/college → unified-institute-dashboard`.

### 2.3 ⚠️ VERIFIED DEFECT — one dead navigation link
- **`Navbar.tsx:271`** links the Competency megamenu item *"Role Transition & Hiring Prediction"* to slug **`competency-roletransition`** (no hyphen).
- **`App.tsx`** only declares + renders **`competency-role-transition`** (hyphenated). There is **no render branch** for the un-hyphenated slug.
- **Impact:** that menu item navigates to a slug with no screen → falls through to not-found/landing. All other sampled competency slugs resolve correctly (1:1 render branch each).
- **Severity:** Medium (user-facing broken link on a primary marketing menu). **One-line fix** (align the slug). Recommended to fix within this phase since it's trivial and demonstrably broken.

---

## DELIVERABLE 3 — Responsibility Matrix (module → single owner)

| Domain | Canonical owner | Notes / overlap status |
|---|---|---|
| Behavioural assessment (CAPADEX) | `routes/capadex*.ts` + `services/capadex-*` | Single spine; engines are layered, not duplicated |
| Competency scoring | `services/competency-scoring.ts` (Phase 2.4, current) | `competency-runtime.ts` = legacy domain-proxy mean; `-v2` = current. **Legacy/current pair** |
| EI / Employability | `services/employabilityEngine` + `ei-*` engines | EI gauge single-sourced; backend 6-dim is a *separate* entity-resolved score (documented) |
| Career intelligence | `services/career-intelligence-bridge.ts` | 4 routes compose ONE bridge — intentional |
| Report generation | **FRAGMENTED** (see §4) | 5–6 generators; consolidation candidate |
| Memory | `wc5/memory-*` (DB) · `longitudinal-memory` · `behavioural-memory` | Intentional layers; 1 merge candidate |
| Feature flags | `config/feature-flags.ts` (defs) + `services/feature-flags.ts` (runtime) | Unified, robust — no action |
| Talent foundation | `routes/talent-foundation.ts` (595L) + `-v52.ts` (95L additive) | Thin additive layer, NOT a clone (verified) |
| Outcome/validation | `validation-loop-engine` + `outcome-intelligence-engine` | Compose-not-recompute; `quality-validator` overlaps in *goal* |

---

## DELIVERABLE 4 — Consolidation Recommendations (prioritised, NONE required for launch)

> All recommendations are **hygiene/tech-debt**, to be done as their own flag-safe tasks with Founder approval. None blocks launch. I deliberately did **not** auto-refactor — that would violate the audit-only + stop-for-approval contract.

**P1 — Fix now (trivial, user-facing):**
1. **Dead nav link** `competency-roletransition` → `competency-role-transition` (one-line slug fix in `Navbar.tsx:271`).

**P2 — Naming/discoverability (low risk, high clarity gain):**
2. Rename the confusing **singular/plural pair** `career-simulation` (`/api/career-simulation`, super-admin engine) vs `career-simulations` (`/api/career-simulations`) — both are LIVE and distinct, but the names invite mistakes. Suggest `career-simulation-admin` vs `career-simulations`.
3. Add `*-v2`/`*-v52` provenance comments or fold thin additive layers (`talent-foundation-v52`) into their base behind the same flag.

**P3 — Structural debt (defer; larger effort):**
4. **Report generation** is genuinely fragmented across `report-factory`, `omega-report-builder`, `dynamic-report`, `vx-report-intelligence`, `lbi-report-generator`, `capadex-report-synthesis`. Partly justified (different formats/audiences) but the *assembly* logic should converge on one `ReportAssembler` over the existing `pdf-renderer`/`viz-data-resolver`.
5. **Scoring engines** (`competency-scoring`, `talent-scoring`, `spe-scoring-engine`, `mei-scoring-engine`, `ei-calculation-engine`, `omega-x-scoring`) share core derive-raw-score logic — extract a shared kernel; keep domain wrappers.
6. **Route proliferation**: group `career-*` / `competency-*` thin wrappers into modular routers to shrink the 303-file surface and the 14k-line `routes.ts`.

---

## GO / NO-GO GATE — Phase 1

**Verdict: GO (conditional) ✅**

- **Architecture is sound and intentional** — evolutionary layering with read-only composition, single-responsibility holds at the module level, persona experiences are cleanly scoped.
- **No launch-blocking architectural defect.** All consolidation items are hygiene/tech-debt, safely deferrable.
- **One verified user-facing bug** (dead `competency-roletransition` menu link) — Medium severity, one-line fix. **Recommendation:** approve this single trivial fix now; everything else is logged as future tasks.
- **One honest clarity gap** (marketing IA over-exposes overlapping product names) — a messaging/positioning task, not engineering-blocking.

**Founder decision requested:**
1. Approve the one-line dead-link fix now? (Y/N)
2. Proceed to **Phase 2 — CAPADEX Assessment E2E**? (or pick another phase)
3. Should P2/P3 consolidation items be filed as backlog tasks now, or revisited after the full audit?

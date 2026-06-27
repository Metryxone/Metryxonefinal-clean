# MX-302E — Campus Placement & Company Intelligence — Founder Report

**Status:** Built, flag-gated, verified in dev. **STOPPED for approval before merge/deploy.**
**Flag:** `campusPlacement` (`FF_CAMPUS_PLACEMENT`), **default OFF**, byte-identical when OFF.
**Date:** 2026-06-27

---

## 1. What shipped

Two student-facing deliverables inside Career Builder, both behind one new flag:

1. **Placement Hub** — a single workspace tab (`placement-hub`) with sub-panels:
   - **Overview** — transparent placement-readiness composite + quick links.
   - **Calendar** — published placement events (drives, deadlines, test dates).
   - **Company Drives** — published drives with CTC band, dates, and a per-drive **eligibility checker**.
   - **Internships** — internship marketplace (stipend band, duration, PPO flag, deadline).
   - **Graduate Programs** — graduate / leadership programs.
   - **Applications** — student-scoped application tracker (CRUD + status pipeline + "import from device" from Fresher Hub local drives).
   - **Offers & Packages** — student-scoped offer tracker + **package analytics** (self / k-anon cohort / market reference).
   - **My Profile** — placement profile (CGPA, branch, backlogs, batch year, 10th/12th %) powering eligibility.

2. **Company Explorer** — company list + **Company DNA** drill-down:
   - Recruited roles (crosswalked to curated Role-DNA, abstaining when no match).
   - Aggregated hiring competencies (criticality-ranked) from resolved roles only.
   - **Salary trends** — real `m3_salary_trends` rows matched to the company's recruited role titles by distinctive-token overlap (p25/p50/p75); honest empty when nothing matches. Market reference, not the company's actuals.
   - **Preparation checklist** — grounded ONLY in the company's real top hiring competencies + the union of its published-drive eligibility criteria (CGPA/backlogs/branch); never generic filler.
   - **Learning focus** — the company's top hiring competencies framed as what to build; personalised paths remain user-level in the Learning tab.
   - **Interview / assessment patterns** — explicitly marked **unavailable** (interview-intelligence & hiring-assessment are scaffolds with no per-company pattern data — not fabricated).
   - Your real package signal at that company.
   - Cultural DNA explicitly marked **unavailable** (no signal source — not fabricated).

---

## 2. Honesty contracts (enforced, not aspirational)

| Contract | How it is enforced |
|---|---|
| **null ≠ 0** | All money columns (`ctc*`, `stipend`) are NULLABLE; engine returns `null` for unmeasured figures; UI renders `—` / dashed bars, never `0`. |
| **No fabricated CTC** | Package analytics aggregate **only real recorded offers**; market reference comes from `m3_salary_trends` (real ingested data). Absent → honest empty state. |
| **k-anonymity ≥ 30** | Cross-student cohort benchmarks are **suppressed** below `CAMPUS_K_MIN = 30` (`cohort.suppressed = true`, all numbers null). Self-offers (the student's own data) are never suppressed. |
| **Company DNA from real signal only** | Composed from the role-DNA distribution (`resolveCuratedRoleByTitle` → `getRoleProfile`) + market salary; roles that don't resolve are shown with **no competency expansion (abstained)**. Cultural/behavioural DNA omitted. |
| **Eligibility never silently passes** | A present criterion with a missing student field → `pass = null` → overall verdict `null` ("insufficient data"). Only a concrete required-vs-actual comparison can fail. A drive with no criteria is a genuinely open drive. |
| **Multi-tenant isolation** | Company/drive/internship/program/calendar rows are tenant-scoped (`tenant_id`, NULL = platform-global) on **both** list AND detail reads (`drives/:id`, `eligibility/:driveId`, `company-explorer/:id` all filter by tenant + `status='published'/'active'`, returning 404 out of scope — no IDOR by guessed ID). Student personal rows (`campus_applications`, `offers`, `campus_student_profiles`) are user-scoped (`user_id`). |
| **Interview / assessment patterns honest-empty** | Surfaced as **unavailable** with a reason — the platform's interview-intelligence & hiring-assessment engines are scaffolds holding no per-company pattern data, so nothing is invented. |
| **Byte-identical OFF** | `flagGate` 503s before auth and before any schema DDL; tables are created only on the flag-ON path (`ensureCampusPlacementSchema`). OFF path touches neither DB nor UI (tab hidden, render gated). |

---

## 3. Architecture

- **Flag:** `backend/config/feature-flags.ts` — `campusPlacement: false` + `isCampusPlacementEnabled()`.
- **Schema:** `backend/migrations/20260627_campus_placement.sql` (8 net-new tables: `companies`, `campus_drives`, `internships`, `graduate_programs`, `placement_calendar`, `campus_applications`, `offers`, `campus_student_profiles`) + lazy `ensureCampusPlacementSchema` / `campusPlacementTablesReady` (readOnly probe) in `backend/services/campus-placement-schema.ts`.
- **Engine (pure, read-only):** `backend/services/campus-placement-engine.ts` — `evaluateEligibility`, `composePackageAnalytics`, `composeCompanyDNA`, `composePlacementReadiness`. Reuses existing `role-competency-profile`, `role-title-crosswalk`, `m3-market-intelligence`.
- **Routes:** `backend/routes/campus-placement.ts` (`registerCampusPlacementRoutes(app, pool, requireAuth)`), registered in `backend/routes.ts`. All data routes `flagGate → requireAuth`; the `/enabled` probe is intentionally ungated (returns `{enabled:false}` when OFF, only DATA routes 503).
- **Frontend:** `frontend/src/pages/career/PlacementHubTab.tsx`, mounted in `CareerBuilderPage.tsx` as TabId `placement-hub`, flag-probed via `/api/campus-placement/enabled` (tab hidden when OFF).

---

## 4. Verification

- **Frontend vite build:** ✅ passes (the real launch gate — backend runs on tsx, no tsc step).
- **Flag ON (dev):** `/enabled` → `{ok:true,enabled:true}`; `/calendar`, `/applications` → **401 unauth** (flag passed, auth required).
- **Flag OFF:** data routes → **503** (verified during route build); tab hidden in nav; render switch gated.
- **Engine honesty:** validated via throwaway tsx harness (since deleted) — eligibility insufficient-data verdict, k-anon suppression, null-never-0, Company DNA abstention all confirmed; demo rows purged.

> Note: the dev flag is enabled via a **development-only** env override (`FF_CAMPUS_PLACEMENT=1`) for smoke-testing. **Production stays OFF.**

---

## 5. Founder decision required

1. **Approve merge/deploy?** Per workspace policy, additive phases STOP for approval before merge/deploy. Nothing is merged yet.
2. **One phase vs split E1/E2?** Currently shipped as **one** phase (`campusPlacement`). If you'd prefer admin-side authoring (publishing drives/companies/internships) as a separate follow-up, that would be a natural E2 — the current build is student-read + student-personal-CRUD; there is **no admin authoring UI** yet (rows are seeded directly / via tenant tooling).
3. **Data population:** the substrate is empty in prod. Flag-ON with no data shows honest empty states everywhere. Populating companies/drives/internships requires either an admin authoring surface (E2) or a seed/import path — your call on sequencing.

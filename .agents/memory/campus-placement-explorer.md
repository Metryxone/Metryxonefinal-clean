---
name: Campus Placement & Company Explorer
description: Flag-gated student Placement Hub + Company Explorer; substrate split, tenant isolation on detail reads, and honesty contracts future work must preserve.
---

# Campus Placement & Company Explorer (flag campusPlacement)

Flag `campusPlacement` / `FF_CAMPUS_PLACEMENT` (default OFF, byte-identical OFF). Two student-facing surfaces inside Career Builder: **Placement Hub** (tab `placement-hub`) + **Company Explorer** (a sub-panel of that tab, NOT a separate tab).

## Substrate split (the thing to remember)
- **Tenant-scoped** (curated/published, `tenant_id` NULL = platform-global): `companies`, `campus_drives`, `internships`, `graduate_programs`, `placement_calendar`. Student reads return published/active rows only.
- **User-scoped** (personal, `user_id` varchar mirrors users.id): `campus_applications`, `offers`, `campus_student_profiles`.
- Same flag-gated DDL discipline as the rest of the platform: tables created ONLY on flag-ON path via `ensureCampusPlacementSchema` (route handlers call it after `flagGate`). OFF = no DDL, no DB touch.

## Honesty contracts (don't regress these)
- **null ≠ 0**: money cols (`ctc*`, `stipend`) NULLABLE; engine returns null; UI renders `—`/dashed bar. Never store/display 0 for "unknown".
- **No fabricated CTC**: package analytics aggregate REAL recorded `offers` only; market reference = `m3_salary_trends` (via `createMarketIntelligence().salaryTrends()`). Absent → honest empty.
- **k-anonymity ≥ 30** (`CAMPUS_K_MIN`): cross-student cohort benchmark SUPPRESSED below 30 (all numbers null). Self-offers (own data) never suppressed.
- **Company DNA from real signal only**: roles crosswalked via `resolveCuratedRoleByTitle` → `getRoleProfile(readOnly)`; unresolved roles shown with NO competency expansion (abstain, never guess). Cultural/behavioural DNA marked `available:false` — no signal source, never invented.
- **Eligibility never silently passes**: criterion present + student field missing → `pass=null` → verdict `null` (insufficient_data). Only a concrete required-vs-actual mismatch fails. No criteria = genuinely open drive.

## Tenant isolation — detail reads, not just lists (review-caught IDOR)
- Tenant + status filtering must be on EVERY detail/by-id read, not only the list endpoints. `GET /drives/:id`, `GET /eligibility/:driveId` (it fetches the drive's criteria), and `composeCompanyDNA`/`company-explorer/:id` originally fetched by raw id with no tenant/status filter → cross-tenant leak by guessed id.
- **How to apply:** thread `tenantId` into the engine (`composeCompanyDNA(pool, id, { userId, tenantId })`); every internal query (`companies`, `campus_drives`, eligibility union) filters `(tenant_id IS NULL OR tenant_id = $t) AND status='published'/'active'`; out-of-scope → null → route 404 (never 200-with-data).

## Company Explorer surfaces (compose real signal, honest-empty otherwise)
- Company DNA must surface, per company: roles, hiring competencies, **salary trends**, **prep checklist**, **learning focus**, interview/assessment patterns, package signal, cultural DNA. Building only the first few is an incomplete deliverable.
- **Salary trends** = real `m3_salary_trends` rows matched to the company's recruited role titles by distinctive-token overlap (drop role stopwords like engineer/manager so umbrella tokens don't over-match); it's a MARKET reference, label it as not the company's actuals.
- **Prep checklist** is grounded ONLY in the company's real top hiring competencies + the union of its published-drive eligibility criteria — never generic filler.
- **Learning focus** = the company's top hiring competencies framed as what-to-build; the personalised learning PATH engines (`buildLearningPath`, `buildCareerRecommendations`) are USER-level, not company-level — don't force them company-side.
- **Interview/assessment patterns**: interview-intelligence & hiring-assessment are scaffolds with NO per-company data → mark `available:false` with a reason; do NOT fabricate.

## Wiring gotchas
- `/api/campus-placement/enabled` probe is intentionally UNGATED (returns `{enabled:false}` OFF); only DATA routes 503. Frontend hides the tab + gates render on this probe.
- Route signature `registerCampusPlacementRoutes(app, pool, requireAuth)` — 3 args, student-only (no requireSuperAdmin). There is **no admin authoring UI** — rows seeded directly / via tenant tooling (natural E2 follow-up).
- Applications "import from device" reads Fresher Hub localStorage key `mx-fresher-drives` → POST `/import-local`.
- Verify launch via frontend vite build (backend is tsx, no tsc). Dev flag enable = `FF_CAMPUS_PLACEMENT=1` dev-only env override; prod stays OFF.

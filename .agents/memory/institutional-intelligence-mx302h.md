---
name: Institutional Intelligence (MX-302H)
description: Wiring the University/Faculty/Placement/Parent mock dashboards to real k-anon-gated aggregation; the schema/scoping traps.
---

# Institutional Intelligence (MX-302H)

Flag `institutionalIntelligence` (env `FF_INSTITUTIONAL_INTELLIGENCE`, default OFF).
A read-only, never-throws composition layer that wires the previously-MOCK
institutional dashboards (`InstitutionCareerPage.tsx`) to REAL institute-scoped
aggregation. Engine `services/institutional-intelligence-engine.ts`, routes
`routes/institutional-intelligence.ts`. Frontend: probe `/enabled`; OFF → render
existing mock byte-identical; ON → `InstitutionCareerRealView.tsx`.

## Durable traps & decisions
- **No `departments` table exists.** The mock fabricated 5 named departments with
  invented readiness/placement. Real "department" analytics aggregate by the
  existing `batches` table, joined to students via `enrollment_requests` (status IN
  Approved/Active/Enrolled). NEVER fabricate department splits — label grouping as
  `batch` on every surface.
- **Substrate map (subject_id ≡ students.user_id):** readiness =
  `career_readiness_history` (append-only, latest-per-subject via DISTINCT ON);
  competency = `onto_competency_profiles` (per-student overall) AND
  `onto_competency_scores` (per-DOMAIN rows: `onto_domain`/`domain_label`/`scaled_score`)
  — the per-domain table is what powers the REAL heatmap and competency-gap surfaces;
  offers = `employer_offers` linked by `candidate_id = students.user_id`;
  accreditation = `institution_accreditations` (`institution_id::text` = institute id,
  uuid). `placement_drives` / `placement_applications` (MX-302E) do NOT exist →
  placement pipeline is honest-unavailable (`pipeline_available:false`), never a
  fabricated funnel.
- **Compose real engines, don't proxy:** heatmap = real per-`onto_domain`
  aggregation (per-domain k-anon gate, `domains[]`); gaps = PRIMARY lowest
  `onto_competency_scores` domains + SECONDARY coarse readiness blocks (separate
  `competency_cohort`/`readiness_cohort` gates, back-compat `critical_gaps`);
  industry-alignment COMPOSES the existing `assessIndustryGaps`
  (`services/industry-gap-engine.ts`) over per-student readiness snapshots →
  `alignment_score` + `top_industry_gaps[]`, NOT a bare readiness number. (A prior
  rev was rejected for using readiness proxies + a placeholder `domains:[]` — the
  fix was to read the real competency substrate.)
- **`/enabled` is UNGATED** (200 `{enabled:<bool>}`, only DATA routes 503 when OFF)
  — matches the MX-302 family contract; the UI decides from the boolean. Both the
  institution real view AND the parent card self-probe it; OFF → mock / nothing
  (byte-identical). Engine import paths carry NO file extension (tsx resolves them).
- **k-anon vs roster split:** SCORE aggregates (avgs, placement rate, CTC, gaps,
  per-batch avg) go through `applyKAnonymity` (cohort-gating: masked<30/prov/verified)
  → masked returns `null`. Roster COUNTS (total/assessed/batches) are the
  institute's own operational data → always shown (not a peer-benchmark leak).
- **Role-aware tenant scope (not admin-only — a reviewer-blocking trap):** resolving
  the institute by `institutes.admin_user_id` ALONE locks out faculty/placement-officer
  staff (they 403 unless also the owner). The staff linkage is `institute_staff` →
  `staff_roles` (role_code/role_name, free text → classify by token, never fabricate a
  role the row lacks); faculty are batch-confined via `staff_batch_assignments` (no
  assignments ⇒ they see NOTHING, never the whole institute). Resolution order:
  owner→`institute_admin` (all batches), else staff→classified role. Each route
  declares allowed roles → 403 `role_not_authorised` outside its set (least-privilege:
  university analytics = admin+officer; placement = admin+officer; faculty roster =
  admin+faculty). Probe staff tables with `to_regclass` (older envs lack them → null→403,
  not an error). **Parent view is a DIFFERENT axis — gated by `parent_student_links` +
  DPDP consent (lbi_consent AND not consent_revoked_date, OR child dob ≥18), NOT institute
  scope.** `parents.user_id` → parent; link by `parent_id`.
- **Per-tab role-aware UI, never a whole-page 403 gate (reviewer-blocking twice):**
  the real view must NOT set a global `forbidden` from the `/overview` 403 — faculty
  are denied on `/overview` BY DESIGN yet must still load `/faculty`. Each surface
  has its own role allow-list, so the UI fetches all surfaces, marks a tab accessible
  unless its backing endpoint returned 403, hides non-authorised tabs, and only shows
  the full-page access-required state when EVERY surface 403s (genuine non-member).
  Default the active tab to the first authorised one (faculty land on Faculty Roster).
- **`apiRequest` throws on non-200**, so the real view uses raw `fetch` to read
  503/403/degraded honestly.
- Verify flag ON in dev via `setEnvVars({FF_INSTITUTIONAL_INTELLIGENCE:true},'development')`
  + restart Backend API (configureWorkflow is limit-blocked). Revert with
  `deleteEnvVars` so shipped default stays OFF/byte-identical.
- In a fresh env every institutional surface correctly resolves to masked/empty/403
  (0 institutes/students/batches) — that's the honest correct outcome, not a bug.

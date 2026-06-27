# MX-302H — University, Faculty, Placement Officer & Parent Intelligence
## Founder Report (STOP for approval — no merge/deploy)

**Task:** Wire the existing **MOCK** institutional dashboards (University / Faculty /
Placement Officer / Parent) to **REAL** institute-scoped aggregation engines,
k-anonymity gated, behind a new additive flag. This is *wire-mock-to-real +
compose existing engines*, **not** greenfield.

**Status:** Implemented, contract-verified, flag default **OFF** (byte-identical
legacy). Awaiting founder approval before any merge/deploy (per user preference:
audits & additive phases stop for approval; never auto-deploy).

---

## 1. What shipped (all additive, read-only, never-throws)

| Layer | File | Notes |
|---|---|---|
| Feature flag | `backend/config/feature-flags.ts` → `institutionalIntelligence: false` | env `FF_INSTITUTIONAL_INTELLIGENCE`, default OFF |
| Engine | `backend/services/institutional-intelligence-engine.ts` | pure SELECT composer over existing tables; no DDL, no writes |
| Routes | `backend/routes/institutional-intelligence.ts` | flag-gated, tenant-scoped, registered in `backend/routes.ts` |
| Frontend (real view) | `frontend/src/pages/career-seeker/InstitutionCareerRealView.tsx` | k-anonymity-gated live UI; Overview / Heatmap / Gaps / Placement / **Industry** / **Faculty** tabs with honest masked/empty states |
| Frontend (probe wiring) | `frontend/src/pages/career-seeker/InstitutionCareerPage.tsx` | probes `/enabled`; `enabled:false` → renders existing mock byte-identical |
| Frontend (parent card) | `frontend/src/components/career/ParentPlacementReadinessCard.tsx` + mount in `UnifiedParentDashboard.tsx` (Overview tab) | self-probes `/enabled`; OFF → renders **nothing** (dashboard byte-identical) |

### Endpoints (data routes flag-gated 503-before-auth when OFF; `/enabled` ungated)
- `/api/institutional-intelligence/enabled` — **ungated** flag probe → `200 {enabled:<bool>}` (matches MX-302 family contract; only DATA routes 503 when OFF)
- `/overview` — University: roster counts + readiness aggregate + **department(=batch)** breakdown
- `/heatmap` — **real** competency heatmap: per-`onto_domain` aggregation from `onto_competency_scores` (`domains[]` with per-domain k-anon gating); honest-empty until per-domain data exists
- `/gaps` — **real** competency-domain gaps (lowest `onto_competency_scores` domains) PRIMARY + coarse readiness-block gaps SECONDARY; back-compat `critical_gaps` preserved
- `/placement` — Placement Officer: employer offers + pipeline (honest-unavailable until MX-302E substrate)
- `/accreditation` — accreditation records (`institution_accreditations`)
- `/industry-alignment` — **composes** the existing industry-gap engine (`assessIndustryGaps`) over per-student readiness snapshots → `alignment_score` + `top_industry_gaps[]` (never a bare readiness proxy)
- `/faculty` — Faculty: per-student roster (`?batchId` optional)
- `/parent/readiness/:childId` — Parent: child placement readiness (consent-gated, NOT institute-scoped)

---

## 2. Founder decisions taken (defaults — documented, not blocking)

- **Decision #3 — Department dimension → aggregate by `batches`.** There is **no
  `departments` table** in the schema. The mock fabricated 5 departments
  (Computer Science / EEE / Mechanical / BA / Data Science) with invented
  per-department readiness and placement counts. The real engine aggregates by the
  **existing `batches` table** (joined via `enrollment_requests`). Department
  splits are **never fabricated**. Every surface labels this grouping explicitly
  (`grouping: 'batch'`).
- **Decision #4 — Kept as ONE phase** (single assigned task; downstream MX-302I is
  separate and intentionally not overlapped).

---

## 3. Honesty contract (how fabrication is prevented)

- **k-anonymity** (reused `backend/services/cohort-gating.ts`): every **score**
  aggregate (readiness avg, per-batch avg, placement rate, CTC, gaps, industry
  alignment) passes through `applyKAnonymity` — **masked < 30**, **provisional
  30–99**, **verified ≥ 100**. Masked cohorts return **`null`**, never a number.
- **Roster counts** (total students / assessed / batches) are the institute's own
  operational data and are always shown — they are not a peer-benchmark leak. Score
  *distributions* over a tiny roster remain masked. This split is documented in the
  engine header.
- **null ≠ 0**: a missing aggregate is `null` (UI renders `—` / "masked" /
  "Building cohort"), never coerced to 0.
- **Honest unavailability, never fabrication**:
  - Placement drive/application substrate (**MX-302E**, tables
    `placement_drives` / `placement_applications`) is **absent** in this env →
    pipeline reported `pipeline_available: false` with a reason. Offers fall back to
    `employer_offers` linked via `candidate_id ↔ students.user_id` only.
  - Domain heatmap reports `available: false` until per-domain competency data
    exists — no invented domain scores.
  - Mentorship analytics are **not** part of this layer → the Mentorship tab shows
    an explicit honest empty state (no fabricated mentor sessions).
- **Role-aware tenant scoping** (`resolveInstituteForUser`): the caller's institute
  **and role** are resolved before any data is served — no caller resolves an
  institute → **403** `no_institute_scope`; cross-institute reads impossible (every
  query filtered by the resolved `institute_id`). Resolution order:
  1. **institute_admin** — institute owner via `institutes.admin_user_id` (full
     university lens, all batches).
  2. **placement_officer** / **faculty** / **staff** — institute *staff* via
     `institute_staff → staff_roles` (role classified from `role_code`/`role_name`;
     faculty additionally **batch-confined** to their `staff_batch_assignments`
     batches; with no assigned batches they see nothing — never the whole institute).
  Each route declares its **allowed roles**; a resolved role outside that set →
  **403** `role_not_authorised` (least-privilege role→surface matrix):
  | Surface | institute_admin | placement_officer | faculty |
  |---|:--:|:--:|:--:|
  | overview / heatmap / gaps / accreditation / industry-alignment | ✓ | ✓ | — |
  | placement | ✓ | ✓ | — |
  | faculty roster (batch-confined) | ✓ | — | ✓ |
  Parent reads are **not** institute-scoped — gated by `parent_student_links` + DPDP
  consent (consent active **or** child ≥ 18). All staff linkage tables are
  `to_regclass`-probed so older envs without them degrade to honest null (→ 403), not
  an error. Role resolution + batch scoping verified by
  `scripts/mx302h-role-authz-verify.ts` (ephemeral seed → 21/21 assertions, self-cleaning).
- **Byte-identical OFF incl. schema**: no DDL anywhere; every route 503s before any
  auth/DB touch; the frontend probe 503s → `enabled` stays false → the **existing
  mock dashboard renders unchanged**.

---

## 4. Live data reality (this environment — the honest correct outcome)

Verified against the live shared DB:

| Table | Rows | Consequence |
|---|---|---|
| `institutes` | 0 | no caller resolves an institute → 403 honest access state |
| `students` | 0 | roster empty |
| `batches` | 0 | no department(=batch) rows |
| `parent_student_links` | 0 | no parent access |
| `capadex_user_profiles` | 0 | cohort always masked |
| `employer_offers` | 0 | no placement outcomes |
| `institution_accreditations` | 0 | no accreditation records |
| `career_readiness_history` | 4 | readiness substrate exists but unlinked to any institute |
| `placement_drives` / `placement_applications` | **absent** | placement pipeline honest-unavailable |

**Therefore every institutional surface correctly resolves to masked / empty / 403
in this environment.** This is the *honest, correct* result of the wiring — not a
defect. When real institute/student/offer data is present, the same code paths
surface real-or-masked numbers (never fabricated). All engine SQL was executed
against the live schema and returns cleanly (0 rows / null aggregates).

---

## 5. Code-review rejections addressed (this revision)

The prior submission was rejected for three honesty/wiring gaps — all now closed:

1. **Faculty + Parent portals not wired to UI** → `InstitutionCareerRealView.tsx`
   now renders dedicated **Industry Alignment** and **Faculty Roster** tabs; the
   Parent surface is wired via a new self-probing `ParentPlacementReadinessCard`
   mounted in `UnifiedParentDashboard.tsx` (Overview tab). OFF → card renders
   nothing (dashboard byte-identical).
2. **gaps / industry-alignment used readiness proxies, not real competency
   substrate** → `composeGaps` now derives PRIMARY gaps from real
   `onto_competency_scores` domains (readiness blocks demoted to SECONDARY);
   `composeIndustryAlignment` now **composes the existing `assessIndustryGaps`
   engine** over per-student readiness snapshots (`alignment_score` +
   `top_industry_gaps[]`), not a bare readiness number.
3. **heatmap was a placeholder `domains:[]`** → `composeHeatmap` now performs real
   per-`onto_domain` aggregation (`subject_id`, `onto_domain`, `domain_label`,
   `scaled_score`) with per-domain k-anonymity gating, returning a populated
   `domains[]` (honest-empty only when no per-domain data exists).

---

## 6. Verification performed

- **Flag OFF**: `/enabled` → `200 {ok:true,enabled:false}` (ungated probe);
  `/overview`, `/parent/readiness/x` → `503` **before** auth. Mock dashboard +
  parent dashboard paths unchanged.
- **Flag ON** (dev env var, reverted before handoff): `/enabled` →
  `{ok:true,enabled:true}`; `/overview`, `/parent/readiness/x` unauthenticated →
  `401` (flag-gate passed, auth enforced).
- **Engine SQL**: every query (readiness aggregate, batch breakdown, per-domain
  heatmap, competency gaps, industry-gap composition, offers join, accreditation,
  parent access, faculty roster) executed against the live schema → no errors,
  honest-empty results.
- **Build**: backend files esbuild-clean; both changed frontend `.tsx` files
  bundle-clean via esbuild (vite full build intentionally not run — pathologically
  slow in this repo; validated via esbuild bundle per repo convention).

> The dev flag override was **removed** after testing — the shipped default is
> **OFF** everywhere (prod stays OFF).

---

## 7. Out of scope / not done (by design)
- No new scoring engine — strictly composes existing readiness/competency/offer
  substrates.
- Placement *pipeline* funnel deferred to MX-302E substrate (honest-unavailable).
- Mentorship live analytics and report-export generation not wired (honest empty).
- No data seeding — the env's empty state is the honest outcome.

---

## Approval gate
**Implementation complete and verified at the contract level. Awaiting founder
approval to merge/deploy. Default flag state is OFF (byte-identical legacy).**

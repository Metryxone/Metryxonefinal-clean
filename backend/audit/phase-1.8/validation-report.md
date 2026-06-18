# Phase 1.8 — SuperAdmin Validation Report

**Surface:** Competency Intelligence admin (Phases 1.1–1.7) · `routes/competency-intelligence.ts` + `services/competency-*.ts` + `superadmin/Competency*Panel.tsx`
**Method:** live evidence — route/middleware inventory, unauth curl matrix, full authenticated super-admin e2e (login → MFA → mutation → audit-row check → restore), direct DB inspection. No fabrication; gaps reported honestly.
**Verdict legend:** PASS (verified working) · PARTIAL (works with a stated limit) · GAP (capability absent by design).

| # | Capability | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | CRUD Operations | **PASS** (scoped) | See §1 |
| 2 | Import | **GAP** | No admin import endpoint; seed-scripts only — §2 |
| 3 | Export | **PASS** | `POST /search/bulk {export}` → JSON → CSV — §3 |
| 4 | Bulk Upload | **GAP** | No bulk-create endpoint; seed-scripts only — §4 |
| 5 | Bulk Classification | **PASS** | `POST /search/bulk {assign_type}` verified write+restore — §5 |
| 6 | Audit Logs | **PASS** | Live PATCH produced `admin_audit_logs` row — §6 |
| 7 | Permissions | **PASS** | Unauth 401 matrix; authorized 200; unauth control 401 — §7 |
| 8 | Version Tracking | **PARTIAL** | Version labels + provenance + audit trail; no row-level history — §8 |
| 9 | Activation Status | **PASS** | 503 flag-gate on every route; flag ON reachable — §9 |

---

## 1. CRUD Operations — PASS (scoped to additive extension tables)
The canonical genome (`onto_competencies`, `onto_roles`) is **read-only by design** — never mutated. All writes land on additive extension tables.

| Entity | Create | Read | Update | Delete | Table |
|--------|:--:|:--:|:--:|:--:|-------|
| Competency Master (status + module-eligibility) | — | ✅ | ✅ PATCH `/master/:id` | — | `onto_competency_master_ext` |
| Micro-framework relationships | ✅ | ✅ | ✅ | ✅ | `onto_competency_hierarchy` |
| Role-competency profiles | ✅ | ✅ | ✅ | ✅ | `onto_role_competency_profiles` |
| Assessment blueprints | ✅ | ✅ | ✅ | ✅ | `onto_assessment_blueprints` |
| Blueprint↔competency / role↔assessment / competency↔question maps | ✅ | ✅ | — | ✅ | mapping tables |

- Competency/role rows have **no create/delete by design** (genome integrity) — edits are status + eligibility overrides stamped `source='curated'`.
- **Verified live:** `PATCH /master/comp_accountability` flipped `assessment_eligible` → 200, write landed, restore returned it to `true` (`source='curated'`), zero residual.

## 2. Import — GAP (honest)
No admin import endpoint (CSV/xlsx/JSON) exists on this surface. Initial population is via idempotent server-side seed scripts (`scripts/seed-competency-types.ts`, `seed-competency-master.ts`, `seed-micro-competency.ts`, `seed-role-competency-profile.ts`, `seed-assessment-foundation-mapping.ts`). Adequate for a governed genome; **not** a self-serve admin import. → enhancement candidate.

## 3. Export — PASS
`POST /api/admin/competency-intelligence/search/bulk` with `operation:'export'` returns JSON of the selected competencies; `CompetencySearchPanel.tsx` converts to a CSV download. Verified in Phase 1.7.

## 4. Bulk Upload — GAP (honest)
No bulk-create/insert admin endpoint. Bulk population is seed-script only (see §2). The existing "bulk operations" are **export** and **classify** (§3/§5), not upload. → enhancement candidate.

## 5. Bulk Classification — PASS
`POST /api/admin/competency-intelligence/search/bulk` with `operation:'assign_type'` upserts `onto_competency_type_map`, stamping `provenance='manual_bulk'`, `confidence='high'`, `evidence` note, `needs_review=true`. Verified Phase 1.7 (write succeeds + restore leaves no residual).

## 6. Audit Logs — PASS (verified live this phase)
Global middleware mounted at `/api/admin` (`routes.ts`) → `admin_audit_logs`.
- **Live e2e:** a successful super-admin `PATCH /master/comp_accountability` produced exactly **one** new row: `action_type='PATCH'`, `target_id='comp_accountability'`, `admin_user_id` captured, `notes='PATCH … → 200'`.
- **Scope/limits (honest):** middleware logs the HTTP verb + path-derived `target_type='api'` + actor for mutating verbs **only when `status < 400`** — failed mutations are not logged. (This explains the previously-empty table: dev-DB schema drift 500s most other admin mutations.) `previous_state` / `new_state` columns exist but are **NULL** — the generic middleware does not capture change diffs. A separate semantic governance audit (`recordGovernanceAudit`, under `FF_GOVERNANCE_RBAC_V2`) additionally logged the login event.

## 7. Permissions — PASS (verified live)
- Public reads: `gate` + `requireAuth`. Admin reads/mutations: `gate` + `requireAuth` + `requireSuperAdmin`.
- **Unauth curl matrix → all 401:** `/search`, `/spine`, `/master-summary`, `/readiness`, `PATCH /master/:id`, `POST /role-profiles`.
- **Authorized super-admin → 200** on `/master-summary` and the PATCH.
- **Unauth control** (cookie cleared) re-issuing the PATCH → **401**.

## 8. Version Tracking — PARTIAL (honest)
Present: per-phase semantic version constants in every service (e.g. `COMPETENCY_MASTER_VERSION='phase-1.2'`, `MICRO_COMPETENCY_VERSION='phase-1.4'`, `ROLE_COMPETENCY_PROFILE_VERSION='phase-1.5'`, `ASSESSMENT_FOUNDATION_VERSION='phase-1.6'`), surfaced in API envelopes (`master-summary` returns `version`); per-row provenance via `source` (default/curated), `provenance`, `needs_review`; `updated_at` on all ext tables; and an audit trail of mutating calls (§6).
Absent: no append-only history / `ver_*` shadow table — edits **overwrite in place** (`updated_at` advances; prior value is not retained). With `previous_state`/`new_state` unpopulated, there is currently **no row-level historical version trail**. → enhancement candidate if change history is required.

## 9. Activation Status — PASS
Synchronous 503 gate (`gate`) at the top of every route, driven by `isCompetencyFrameworkIntelligenceEnabled` (`FF_COMPETENCY_FRAMEWORK_INTELLIGENCE`). Flag **ON** in the running workflow → routes reachable (401 unauth, not 503). Flag **OFF** → `503 feature_disabled` and the SuperAdmin tab hides (byte-identical legacy). The `/readiness` endpoint surfaces activation/coverage state.

---

## Summary
- **PASS (6):** CRUD (scoped), Export, Bulk Classification, Audit Logs, Permissions, Activation Status.
- **PARTIAL (1):** Version Tracking — labels + provenance + audit trail, no row-level history.
- **GAP (2):** Import and Bulk Upload — seed-script only, no self-serve admin API.

No blocking defects. Gaps and the version-tracking limit are by-design for a governed genome; flagged as enhancement candidates, not failures. No code changed in this phase (validation only). Awaiting approval before any deploy.

*PII masked: super-admin login email and actor UUIDs are platform-internal; not reproduced here.*

# Employer Foundation Report

**Phase:** 5 (Employer Lifecycle) — Final
**Date:** 2026-06-21
**Scope:** Employer onboarding + organization setup
**Validator:** Super Admin Employer Validation v5.15.0 (read-only, compose-only)
**Verdict:** ✅ **OPERATIONAL**

---

## 1. Subsystem

The employer foundation covers the two entry stages of the hiring lifecycle:

| Stage | Persists to | Engine / route |
|-------|-------------|----------------|
| Employer Registers | `employer_organizations` | `routes/employer-portal.ts`, `routes/employer-admin.ts` |
| Organization Created | `employer_company_profiles` | `routes/employer-portal.ts` |
| Permissions / roles | workforce-os role tables | `routes/employer-security.ts`, `services/enterprise-workforce-os-engine.ts` |

Auth is **session-scoped** (`requireAuth`) and employer-scoped (subject = `employerId`; `employer_organizations` keys on `id`, child tables on `employer_id`).

## 2. Evidence — persistence (E2E lifecycle driver)

`backend/scripts/e2e-employer-lifecycle.ts`, stages 1–2, proven by **before/after row deltas** (never a bare `count>0`):

```
[01] Employer Registers   ✓ employer_organizations persisted (Δ 0→1)
[02] Organization Created ✓ employer_company_profiles persisted (Δ 0→1)
```

## 3. Evidence — invariants (validator areas `employer_setup`, `organization_setup`)

```
[employer_setup] status=pass measurable=true
   - org_exists: pass — organization row present.
   - approval_threshold_bounds: pass — approval_threshold within range.
   - max_sessions_bounds: pass — max_sessions within range.
   - company_profile_coverage: pass — 1 company profile row(s).

[organization_setup] status=pass measurable=true
   - tenants_present: pass — 4 tenant(s).
   - tenant_seat_invariant: pass — no tenant over its seat cap.
   - tenant_seats_non_negative: pass — seat counts non-negative.
   - orgs_present: pass — 1 organization(s).
   - org_threshold_non_negative: pass — thresholds non-negative.
```

Both areas **measurable** and **PASS** — no out-of-bounds thresholds, no over-seated tenants, no negative seat counts.

## 4. Honesty notes (Coverage vs Confidence)

- **Dev substrate is empty** (`employer_organizations` = 0 rows live). This is an honest finding, **not** a defect: the foundation is exercised with self-cleaning `@example.com` seed data, then removed. Production population is a data axis, separate from the structural axis proven here.
- **Coverage** (rows exist) and **Confidence** (data is in-canon / in-bounds) are reported as separate axes by the validator; every measurable check on this foundation passed both.

## 5. Success criteria

| Criterion | Status | Basis |
|-----------|--------|-------|
| Employer onboarding operational | ✅ | E2E stage 1 + `employer_setup` PASS |
| Organization setup operational | ✅ | E2E stage 2 + `organization_setup` PASS |

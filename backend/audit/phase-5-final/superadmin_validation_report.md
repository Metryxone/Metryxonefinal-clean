# Super Admin Validation Report (Phase 5.15)

**Phase:** 5.15 — Super Admin Employer Validation
**Date:** 2026-06-21
**Engine:** `services/super-admin-employer-validation-engine.ts` **v5.15.0**
**Routes:** `routes/employer-validation.ts` (flag `employerValidation` / `FF_EMPLOYER_VALIDATION`, default OFF)
**Contract:** additive · compose-only · GET-never-writes (zero DDL) · super-admin gated · IDOR employer-scoped · never-throws · honesty-first
**Verdict:** ✅ **ZERO FAIL** across 14 areas

---

## 1. What this is

A read-only honesty/invariant harness a super-admin runs for **one employer subject**
across **14 areas**. It mirrors the Career analog (Phase 4.12) exactly: 3-status
result types (**PASS / WARN / FAIL**), `Coverage` vs `Confidence` kept separate,
`null ≠ 0`, per-area `try/catch → FAIL that area only` (orchestrator never 500s).

- **WARN** = honest absence / not measurable — *never* a failure.
- **FAIL** = a real invariant break: out-of-bounds score, orphan FK, out-of-canon
  enum, negative amount, null `created_at`.

## 2. Headline result (over a fully-seeded lifecycle)

```
SUMMARY {"areas_total":14,"pass":12,"warn":2,"fail":0,"status":"warn","measurable_areas":13} ok=true
```

| Metric | Value |
|--------|-------|
| Areas total | 14 |
| PASS | 12 |
| WARN | 2 (honest absences) |
| **FAIL** | **0** |
| Measurable areas | 13 / 14 |
| Orchestrator `ok` | `true` |

## 3. Full area-by-area detail

```
[employer_setup] status=pass measurable=true
   org_exists · approval_threshold_bounds · max_sessions_bounds · company_profile_coverage → all pass

[organization_setup] status=pass measurable=true
   tenants_present(4) · tenant_seat_invariant · tenant_seats_non_negative · orgs_present(1) · org_threshold_non_negative → all pass

[job_architecture] status=pass measurable=true
   families_present(10) · family_no_self_parent · family_parent_resolves · profiles_present(14) · required_level_non_negative · weight_non_negative → all pass

[job_posting] status=pass measurable=true
   jobs_present(1) · status_in_canon · salary_band_coherent · counts_non_negative · distributions_resolve · channel_in_catalog → all pass

[talent_search] status=warn measurable=false
   pools_present: warn(0) · pool_members_resolve: pass · shortlists_present: warn(0) · shortlist_members_resolve: pass · saved_searches_present: warn(0)

[matching] status=pass measurable=true
   candidates_present(1) · match_score_bounds · ei_score_bounds · match_coverage(1/1) · requirement_backing(14) → all pass

[assessments] status=pass measurable=true
   assessment_activity(1 sent,1 scored) · assessment_score_bounds · score_implies_sent → all pass

[shortlisting] status=pass measurable=true
   pipeline_present(1) · status_in_canon · stage_order_non_negative · transitions_resolve · transition_status_in_canon → all pass

[interviewing] status=pass measurable=true
   schedules_present(1) · status_in_canon · mode_in_canon · duration_non_negative · scores_within_max · decision_in_canon → all pass

[hiring] status=pass measurable=true
   offers_present(1) · ctc_non_negative · total_ctc_coherent · hire_decisions(1) → all pass

[workforce_intelligence] status=pass measurable=true
   workforce_data(1) · distribution_engine(ok=true) · department_engine(ok=true) → all pass

[notifications] status=pass measurable=true
   notification_engine · workflow_engine · communication_engine · notifications_measurable · never_sends(4 previews, delivered=false) · no_candidate_pii → all pass

[permissions] status=pass measurable=true
   wos_roles_present(5) · assignments_resolve · expiry_after_grant · role_definitions_present(10) · permissions_resolve → all pass

[audit_logs] status=warn measurable=true
   audit_tables_present(4) · audit_coverage(3) · created_at_present · subject_audit_coverage: warn(0) · risk_score_bounds → warn
```

## 4. The two WARNs (why they are honest, not failures)

| Area | WARN check | Why it is correct |
|------|-----------|-------------------|
| `talent_search` | `pools_present` / `shortlists_present` / `saved_searches_present` = 0 | No saved-search pools were created in the seeded flow. The structure is sound — `*_members_resolve` checks PASS (no orphans); only the optional data is absent (`measurable=false`). |
| `audit_logs` | `subject_audit_coverage` = 0 for subject | The seeded employer produced no audit rows of its own (audit is written by real admin actions, not by the seed). `null ≠ 0` — reported as a WARN, never inflated. |

Both are exactly the harness behaving honestly: it refuses to manufacture a PASS over
absent data.

## 5. Guarantees verified (from the 5.15 smoke suite)

- **GET-never-writes:** `pg_class` + row-count snapshot unchanged across calls (zero DDL).
- **Determinism:** two consecutive calls produce identical output (sans `generated_at`).
- **Never-throws:** a broken area FAILs only itself; the orchestrator returns `200`.
- **Flag-OFF byte-identical:** with `employerValidation` OFF, the route returns `503`.
- **Safety:** notifications `never_sends` + `no_candidate_pii` both PASS.

## 6. Success criteria

| Criterion | Status |
|-----------|--------|
| 14 areas present | ✅ (`areas_total=14`) |
| Zero FAIL | ✅ (`fail=0`, `ok=true`) |
| Honest WARNs (not masked failures) | ✅ (2 WARNs, both genuine absences) |

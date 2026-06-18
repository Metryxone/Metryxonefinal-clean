# Chain Flow Validation — Competency Type → … → Assessment Blueprint

**Flow:** Competency Type → Competency → Micro Competency → Role → Role Competency Profile → Assessment Blueprint
**Method:** authenticated super-admin e2e (login → MFA → live writes → DB confirm → cleanup), run against the live dev DB. All test rows removed afterward (verified 0 residual). No application code changed.
**Result: ALL 7 AXES PASS. No defects.**

## Fixtures (existing genome rows)
`type='behavioral'` · parent=`comp_accountability` · child=`comp_accountable_leadership` · role=`role_be_eng`

## Axis results

| Axis | Result | Evidence |
|---|---|---|
| **Data Persistence** | ✅ PASS | Every create (micro id=26, role-profile id=34, blueprint, blueprint↔competency id=67, role↔assessment id=11) confirmed present in its DB table immediately after the HTTP 200. |
| **Data Retrieval** | ✅ PASS | `GET /types` (5), `/master?type=` (5 rows), `/micro-framework`, `/role-profiles?role_id=`, `/blueprints/:id` all returned the created/expected entities. |
| **Search** | ✅ PASS | `GET /search?q=Accountability` → 200, 3 hits. |
| **Filters** | ✅ PASS | `/search/facets` → 200 (10 facet groups: types, domains, families, industries, functions, departments, roles, trainability, stability_level, complexity_level); `/search?type=behavioral` → 200; `/master?type=behavioral` → 5 rows, type-consistent. |
| **Relationships** | ✅ PASS | 3 joins resolved in retrieval: micro **parent→child**, role-profile **role→competency**, blueprint **blueprint→competency** (+ role→assessment link created). |
| **Audit Logging** | ✅ PASS | `admin_audit_logs` delta=6 across the run (5 chain mutations + the MFA-verify POST); every successful admin mutation logged with actor + target. |
| **Permission Controls** | ✅ PASS | Unauthenticated `POST /role-profiles`, `POST /blueprints`, `DELETE /micro-framework/:id` → **401/401/401**. |

## Notes (honest findings, not defects)
- **Input validation confirmed working:** a create with `criticality:'high'` was correctly rejected `400 invalid_criticality` — valid tiers are `critical | important | desirable | optional`. (`required_level` 1–5, `weight` 0–100 enforced likewise.)
- **Genome integrity:** all writes land on additive tables (`onto_competency_hierarchy`, `onto_role_competency_profiles`, `onto_assessment_blueprints` + map tables) stamped `source='curated'`; canonical `onto_competencies` / `onto_roles` never mutated. Creates validate that referenced ids EXIST (404 otherwise) and reject duplicates (409).
- **Cleanup:** 5 test rows created, 5 removed, residual 0/0/0 — no test data left in the DB.

*PII masked: super-admin login email / actor UUIDs are platform-internal, not reproduced here.*

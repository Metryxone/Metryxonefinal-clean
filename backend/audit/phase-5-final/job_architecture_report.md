# Job Architecture Report

**Phase:** 5 (Employer Lifecycle) — Final
**Date:** 2026-06-21
**Scope:** Role families + role-competency requirement profiles
**Validator:** v5.15.0
**Verdict:** ✅ **OPERATIONAL**

---

## 1. Subsystem

Job architecture is the requirement backbone every match, assessment, and readiness
score traces back to:

| Concept | Source | Notes |
|---------|--------|-------|
| Role families | `role_families` (10 rows live) | hierarchical (parent_id) |
| Role-competency requirements | `onto_role_competency_profiles` (14 rows live) | required_level + weight per (role, competency) |

This is the curated requirement source. The matching layer reads it for
**requirement backing** (see `talent_matching_report.md`).

## 2. Evidence — invariants (validator area `job_architecture`)

```
[job_architecture] status=pass measurable=true
   - families_present: pass — 10 role family(ies).
   - family_no_self_parent: pass — no self-parented family.
   - family_parent_resolves: pass — all parent references resolve.
   - profiles_present: pass — 14 role-competency requirement row(s).
   - required_level_non_negative: pass — required_level within range.
   - weight_non_negative: pass — weights non-negative.
```

Every check **PASS**: no self-parented family, all parent references resolve (no
orphan FKs), required levels and weights all non-negative and in-bounds.

## 3. Honesty notes

- **Coverage:** 10 families / 14 requirement rows exist in dev — a real, curated
  substrate (unlike the per-employer transactional tables which are empty).
- **Confidence:** structural integrity is fully validated (no orphans, no negative
  levels). Breadth of the taxonomy (how many roles are covered) is a content axis;
  expansion needs O\*NET/ESCO bulk import, not manual seeding — an honest ceiling,
  not a defect.

## 4. Success criteria

| Criterion | Status | Basis |
|-----------|--------|-------|
| Job architecture operational | ✅ | `job_architecture` area PASS (6/6 checks), requirement profiles back matching |

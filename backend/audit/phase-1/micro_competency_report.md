# Micro-Competency Report — Phase 1.3

**Objective:** provide an additive structure to decompose a competency into finer **micro-competencies** — either by linking an existing competency as a child, or by naming a micro under a parent — without ever mutating the genome.
**Result: structure implemented and validated end-to-end. 12 relationships present.**

## Structure (`onto_competency_hierarchy`)

| Metric | Value |
|---|---|
| Total micro relationships | 12 |
| Linked (parent → existing child competency) | 11 |
| Named-only (micro_label under a parent) | 1 |
| Distinct parent competencies | 3 |

Two relationship modes are supported:
- **Linked micro** — `parent_competency_id` → `child_competency_id`, both referencing existing `onto_competencies` rows (validated to exist; duplicates rejected).
- **Named-only micro** — `parent_competency_id` + `micro_label`, for a sub-skill not (yet) a full competency.

Each row is reversible (`active` toggle + hard delete), re-orderable (`sort_order`), and stamped `source='curated'`.

## Operational validation (live e2e)
Verified against the running backend with a super-admin session:
- **Create** `POST /api/admin/competency-intelligence/micro-framework` → 200, row persisted in DB.
- **Retrieve** `GET /api/competency-intelligence/micro-framework?parent_id=` → returns the relationship with the **parent→child join resolved**.
- **Validation** — parent/child existence enforced (404 on unknown id), duplicate pair rejected (409).
- **Permissions** — unauthenticated create/delete → 401.
- **Audit** — each mutation logged to `admin_audit_logs`.
- **Cleanup** — all test rows removed, 0 residual.

(See `superadmin_validation_report.md` for the full chain run.)

## Honest finding (not a defect)
- **Content is sparse:** 12 relationships across 3 parent competencies. The micro-competency *structure and engine are operational*; the *decomposition content* (micro-competencies for the remaining competencies) is an authoring task, not an engineering gap. We report the real count rather than implying full decomposition.

**Success criterion "Micro competency structure implemented": MET — structure, engine, validation, and governance operational; content population is ongoing curation.**

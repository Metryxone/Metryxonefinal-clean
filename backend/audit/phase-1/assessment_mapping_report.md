# Competency-to-Assessment Mapping Report — Phase 1.6

**Objective:** additive foundational mappings that connect the competency genome to the assessment surface **without redesigning any assessment workflow**. Three deliverables.
**Result: mapping engine operational and validated. Blueprint and role-assessment surfaces populated; the competency→question slot exists but is unpopulated (honest gap).**

## The three deliverables

### 1. Competency → Question (`onto_competency_question_map`)
| Metric | Value |
|---|---|
| Mappings | **0** |

The slot, schema, and admin write endpoint (`POST /api/admin/competency-intelligence/competency-questions`) exist and are operational, but **no competency↔question links are authored yet**. This is a content gap, not an engineering defect — reported truthfully rather than implied complete.

### 2. Role → Assessment (`onto_role_assessment_map` → `onto_assessment_blueprints`)
| Metric | Value |
|---|---|
| Role→assessment links | 5 |

Maps a role to the blueprint(s) used to assess it (`is_primary` flag supported). Validates role + blueprint existence; duplicates rejected.

### 3. Competency Profile → Blueprint (`onto_assessment_blueprints` + `onto_blueprint_competency_map`)
| Metric | Value |
|---|---|
| Assessment blueprints | 5 |
| Blueprint→competency links | 33 |

A blueprint composes a set of competency requirements (level · weight · criticality) — the assessment-side mirror of a role profile, optionally sourced from a role (`source_role_id`).

## Integrity & validation
- Every mapping references EXISTING genome / question rows; the genome and question bank are **never** mutated.
- Existence enforced (`404`), duplicates rejected (`409`), enums/ranges validated (`required_level` 1–5, `weight` 0–100, `criticality` tiers).
- Admin writes are `requireAuth + requireSuperAdmin` and audit-logged.

## Operational validation (live e2e)
- Blueprint create → 200 (persisted); blueprint→competency link → 200; role→assessment link → 200.
- Retrieve `GET /blueprints/:id` resolves the **blueprint→competency join**.
- Permissions: unauthenticated create → 401.
- Cleanup: all test rows removed, 0 residual.

## Honest findings (not defects)
- **Competency→Question = 0 mappings.** The hardest, highest-value link (which question measures which competency) is the one not yet authored. Surfaced explicitly.
- Blueprint / role-assessment populations (5 each) reflect seeded foundational data; broader authoring is ongoing.

**Success criterion "Competency-to-assessment mapping operational": MET for role→assessment and profile→blueprint; the competency→question slot is operational-but-empty and flagged as the priority content gap.**

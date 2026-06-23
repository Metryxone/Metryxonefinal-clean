# §4 — Assessment Certification Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts`

## Verdict: 🟡 PARTIAL — blueprint is genuinely Role-DNA-driven (✅), question integrity is clean (✅), but question **coverage is very low** (14 competencies)

## Chain: Role → Role DNA → Competencies → Required Levels → Blueprint → Questions → Assessment

| Hop | Verdict | Evidence |
|---|---|---|
| Role → Role DNA → Competencies | ✅ | `map_role_competency` (52,362 rows) carries weight + min/target proficiency per competency |
| Required Levels | ✅ | `target_proficiency` present on 100% of inherited rows |
| Blueprint **from DNA, not bank** | ✅ | `services/blueprint-builder.ts` `deriveDimensionMix` derives a 5-dim mix from competency weights → `onto_blueprint_dimension_mix`; questions are selected *into* the blueprint (forward direction, no reverse generation) |
| Questions → Assessment | 🟡 | `competency-runtime.ts` `generateAssessment` selects from the bank to fill the blueprint |

## "Questions must NOT drive assessments" — ✅ MET
The blueprint is produced from Role-DNA competency weights first; question selection is downstream and
fills the blueprint. There is no path where the question bank defines the assessment shape.

## Quality assessment

| Axis | Verdict | Evidence |
|---|---|---|
| Blueprint accuracy | ✅ | dimension mix sums from real competency weights |
| Question integrity | ✅ | **0** questions without competency / difficulty / type (of 74) |
| Difficulty accuracy | 🟡 | `difficulty_band` present on all; no explicit `proficiency_level` column (difficulty is the proxy) |
| Competency coverage | ❌ | only **14** distinct competencies have question templates; `onto_competency_question_map`=25 rows / 7 competencies |
| Assessment coverage | 🟡 | **74** templates (43 approved) — enough for pilot, not enterprise breadth |
| Assessment completeness | 🟡 | blueprint can be filled only for the 14 covered competencies |

## Honest finding
The **architecture is correct and DNA-driven** (the hard part). The gap is **content volume**: a 74-item
bank covering 14 competencies cannot assemble blueprints for the 159 role-relevant competencies. This is a
curation/authoring gap, **closable additively** by expanding `competency_question_templates` per
competency × difficulty band — not an architectural defect.

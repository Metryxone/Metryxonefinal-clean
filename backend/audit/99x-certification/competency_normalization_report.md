# §6 — Competency Normalization Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts` + `services/competency-type-classification.ts`

## Verdict: 🟡 PARTIAL — 100% of the genome is classified into the 5 canonical types (✅), but two types are honestly underpopulated (`future_skills`=0, `technical`=18)

## Canonical 5-type resolution
A deterministic classifier (`services/competency-type-classification.ts`) resolves every competency to one
of: **Behavioral · Functional · Technical · Cognitive · Future Skills**.

Resolution cascade: Future-Skills lexicon → Technical (family `fam_technical_adoption` / lexicon) →
inherit curated `scientific_type` (functional/cognitive/behavioral) → default **behavioral** with
`confidence='low'` + `needs_review=true`.

## Coverage & distribution (live)

| Metric | Value |
|---|---|
| Genome competencies | **419** |
| Classified (in `onto_competency_type_map`) | **419 (100%)** |
| `needs_review` flagged | **0** |

| Canonical type | Members | Note |
|---|---|---|
| behavioral | 199 | well-populated |
| functional | 103 | well-populated |
| cognitive | 99 | well-populated |
| technical | **18** | sparse |
| future_skills | **0** | **empty** |

## Assessment
| Axis | Verdict | Evidence |
|---|---|---|
| Coverage | ✅ | 419/419 classified, 0 unmapped |
| Accuracy | ✅ | deterministic lexicon + curated inheritance; `needs_review=0` |
| Duplicates | ✅ | one type per competency (`competency_id` PK in type map) |
| Unmapped competencies | ✅ | none |
| Classification quality | 🟡 | 3 of 5 types well-populated; **technical sparse, future_skills empty** |

## Honest finding
The normalization **layer is complete and correct** — the prior MX-98X note that DNA used O\*NET-native
types (`core/domain`) refers to the **Role-DNA requirement tags**, not this genome classification, which is
fully normalized. The genuine gap is **content**: the classifier honestly refuses to invent members for
`technical`/`future_skills` (code comment: *"We do NOT invent members to fill a category"*). Closing this is
a **curation** task (author real future-skills/technical competencies into the genome), not a code fix.

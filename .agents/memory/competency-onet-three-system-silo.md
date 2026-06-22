---
name: Competency / O*NET three-system silo
description: Why "industries don't reflect in Search & Discovery" — the curated onto_ genome, the O*NET ont_ library, and the assessment bank are three disjoint systems with a broken hierarchy; what an honest bridge requires.
---

# The three siloed systems (Search & Discovery industry-coverage root cause)

Reported symptom: industries managed in the Industries admin panel (206 rows) do NOT
appear in Super Admin → "Search & Discovery" (which shows only ~2). Root cause is a
three-way namespace + hierarchy silo, NOT a UI bug.

## The three systems
1. **Curated competency genome (`onto_*`)** — powers BOTH Search & Discovery
   (`CompetencySearchPanel` → `/api/competency-intelligence/search/facets` →
   `competency-search.ts`) AND the competency framework/assessment. Competency ids are
   TEXT (`comp_accountability`). Rich on competencies (299) but the role hierarchy is a
   bare demo seed: ~2 `onto_industries`, 3 `onto_functions`, 5 `onto_roles`, 14
   `onto_role_competency_profiles`. The search industry facet reads `onto_industries`
   (deprecated=false) → that's why only ~2 industries show. Industry scoping joins
   `onto_functions.industry_id`.
2. **O*NET reference library (`ont_*`)** — what the Industries admin panel manages
   (`/api/ontology/industries`). Competency ids are INTEGER. Rich leaf: 206
   `ont_industries`, 1019 `ont_roles`, 136 `ont_competencies`, and **52,100**
   `map_role_competency` rows (real O*NET ratings, 997 roles × 136 comps).
3. **Assessment bank** (`competency_question_templates`, ~74) — tied to the `onto_`
   genome (#1), not to O*NET.

## Why nothing bridges them
- **Competency catalogs barely overlap**: `ont_competencies` (136 O*NET operational
  skills/abilities — Reading Comprehension, Mathematics, Near Vision, Programming) vs
  `onto_competencies` (299 curated behavioral/business competencies — Accountability,
  Systems Thinking). Normalized exact name match ≈ 11% (15/136); even generous fuzzy
  ceiling ≈ 23%. Different KINDS of taxonomy → any name-crosswalk is inherently lossy.
- **`map_ont_onto_role` crosswalk is EMPTY** (0 rows) — the intended bridge was never
  populated.
- **O*NET's OWN hierarchy is fragmented** so industry→competency traversal = 0:
  - `map_industry_function` links only **12 of 206** industries.
  - `ont_role_families` → `ont_departments`: only **8 of 31** role-families have a valid
    department parent.
  - The 52,100 bulk O*NET mappings hang off SOC major-group role-families (`RF_ONET_*`)
    that have NO department/industry parent at all.
  - The only industry-scoped scaffold is a hand-authored **12-industry** starter seed
    (`services/ontology-seed.ts`, `phases.industries = 12`).

## What an honest "full bridge" needs (no fabrication)
- Real importers EXIST: `services/onet-import.ts` (bulk O*NET → `ont_*`, needs tab files
  in `backend/data/onet/` or downloads from onetcenter.org) and `services/ontology-seed.ts`
  (12-industry curated scaffold). The bulk role/competency import already ran; the
  STRUCTURAL links (SOC major group → department → industry) are the missing piece.
- To make MANY industries searchable you must source a real SOC→industry structural
  crosswalk (O*NET/BLS data, real — not guessed) and complete the
  industry→function→department→role_family chain, then EITHER repoint Search & Discovery
  to `ont_` OR mirror the O*NET hierarchy into `onto_` (with a competency reconciliation,
  given the ~13% catalog overlap). Picking which competency catalog is canonical for
  search+assessment is a product decision.
- **Never** fabricate the missing role_family→department→industry links or the 87% of
  unmatched competency pairs to inflate coverage. Coverage is gated on real source data,
  not on code.

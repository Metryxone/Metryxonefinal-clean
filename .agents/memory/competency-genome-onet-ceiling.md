---
name: Competency genome real-data ceiling (O*NET import)
description: Why the onto_* competency genome can't be seeded to N-per-dimension from real data, and the traps when importing O*NET.
---

# Competency genome real-data ceiling

Requests like "seed 500 competencies per dimension" cannot be met from real data.
The recognised public taxonomy (O*NET Content Model: Skills+Abilities+Knowledge+Work Styles)
has only **~136 distinct elements total**. Importing the real set yields ~120 NEW rows
after deduping against the curated genome.

**Why:** honesty contract forbids fabricating competencies to hit a count. The honest
maximum from O*NET is the element count, not an arbitrary target.

**How to apply:**
- The 5 dimensions live in `onto_competency_type_map.type_key`
  (behavioral/cognitive/functional/technical/**future_skills**). O*NET has **no**
  future-skills elements → that dimension honestly stays 0; populating it needs a
  *different* real source (e.g. WEF/skills-of-the-future taxonomy), never invented rows.
- `onto_competencies` requires real `domain_id`/`family_id` FKs + unique
  `canonical_name`/`slug`. Import under a dedicated `dom_onet` domain + `fam_onet_*`
  families with id namespace `onet_<elementId>` and `scoring_metadata.source='onet'`
  → trivially reversible.
- **Dedup trap:** O*NET reuses the same NAME across groups — e.g. "Mathematics" is both
  a Skill (2.A.1.e) and a Knowledge area (2.C.4.a). Dedup names BOTH against the existing
  genome AND within the candidate set (first-wins), or the unique `canonical_name`
  constraint 23505s mid-transaction.
- `scientific_type` only uses behavioral/cognitive/functional (no 'technical' value) —
  map technical-dimension rows to `scientific_type='functional'`; the `technical`
  distinction lives in the type_map.
- After inserting competencies + type_map, run `runCompetencyMasterSeed` so each new row
  gets an `onto_competency_master_ext` row (status + eligibility) and surfaces on the page.
- Importer: `backend/scripts/import-onet-competencies-to-genome.ts` (--dry-run / --down).

---
name: Precise per-competency scoring — the blueprint comp-map gate
description: Why approving comp_*-coded questions alone does NOT raise employer directMatchCount; the real binding gate.
---

# Precise per-competency scoring depends on TWO levers, not one

Employer match (`computeCompetencyDrivenMatch`, employer-competency-hiring.ts)
counts a requirement as `direct_competency` (vs `domain_proxy`) only when the
candidate has a PRECISE per-competency score for that comp. Precise scores are
written by `scoreAssessment` (competency-runtime.ts) ONLY for competencies whose
comp-tagged questions were actually SERVED in the assessment.

**The trap:** `generateAssessment` (competency-runtime.ts ~L314-322) serves
comp-tagged approved templates ONLY for the competencies present in the
assessment blueprint's competency map (`onto_blueprint_competency_map`), via
`selectCodes = [...domainCodes, ...blueprintCompIds]`. A role-DNA competency that
has an approved + active-mapped question (`onto_competency_question_map`) but is
NOT in any blueprint's comp-map is never served → never scored precisely → the
match stays domain_proxy.

**So two levers are BOTH required to move directMatchCount:**
1. Approve + active-map comp_*-coded question templates for the competency
   (`onto_competency_question_map`).
2. Add that competency to the relevant role blueprint's comp-map
   (`onto_blueprint_competency_map`), sourced from the role's DNA
   (`onto_role_weights` keyed by `dna_profile_id`, NOT `role_id`).

**Why:** Task #130 ("approve more tagged questions") assumed lever 1 alone would
raise directMatchCount. It does not — proven: approving 87 comp-coded templates
for all 33 role-DNA comps changed NOTHING observable until the blueprints were
wired, because no blueprint served the new comps.

**How to apply:** When asked to expand precise scoring / direct matches, wire
BOTH tables. Seed reusably: most task-agent DB rows do NOT reach the live DB on
merge (only code+DDL), so the seed scripts must be idempotent and re-run in prod.

## Extending BEYOND the role-DNA comps (a THIRD lever + a hard reach ceiling)
To raise directMatchCount for a competency that is NOT yet in any role's DNA, a
third lever precedes the two above: the competency must first be ADDED to the
role's DNA requirement set (`onto_role_weights`, `dna_profile_id`-keyed,
source-tag it for reversibility), because the employer match's curated requirement
set IS that role's `onto_role_weights`. Authoring questions + wiring a blueprint
for a comp that is not a role requirement moves nothing.

**Hard reach ceiling:** directMatchCount can only be moved for roles whose title
resolves through the LIVE bridge. The chain is
`generateRoleDNA(jobTitle)` → `resolveBestOntRole` → `ont_roles` →
`map_ont_onto_role` (needs **non-null `ont_role_id`**) → curated `onto_role` →
`onto_role_weights`. The bridge-reachable set has GROWN over tasks: base 3
(`role_pm`, `role_eng_manager`, `role_credit_analyst`); Task #145 added the
Backend pair (`role_be_eng`/`role_sr_be_eng` via dedicated ROLE_BE_ENG/
ROLE_SR_BE_ENG); Task #151 completed the engineering family (`role_qa_eng`,
`role_devops_eng`, `role_fe_eng`, `role_fullstack_eng` via NEW dedicated
ROLE_QA_ENG/ROLE_DEVOPS_ENG/ROLE_FE_ENG/ROLE_FULLSTACK_ENG library roles +
`role_software_eng`/`role_sr_software_eng` bridged to the PRE-EXISTING
ROLE_SWE/ROLE_SR_SWE). **Why:** confirmed by querying map_ont_onto_role +
proven e2e (each role's directMatchCount rose 0→N once its DNA+blueprint were
wired). **How to apply:** before wiring, check the comp's target role is
bridge-reachable; otherwise the data is correct but inert at match time.
**Crucial:** merged task-agent data does NOT reach the live/prod DB (only code +
DDL merge), so re-run the four seed scripts (`seed-task1NN-bridge`,
`-competency-questions`, `-blueprint-wiring`, then `verify-task1NN-e2e`) in prod
AFTER running `ontology-seed-run.ts` (which lazily ON CONFLICT-adds the new
library roles). Task #151's roles needed no new routes → no Backend restart.

## Other gotchas hit
- Generic TYPE-coded MX-101A drafts (competency_code TEC/EIQ/ADP/...) can be
  approved but CANNOT drive precise scoring — the precise path keys on
  `competency_code == comp_* id`. Force-activating their generic map rows would
  fabricate identical scores across many comps. Honest lever = AUTHOR genuine
  comp_*-coded MCQs (mirror demo `acc_q1`).
- pg "inconsistent types deduced for parameter $1 — text versus character varying"
  on an INSERT...SELECT where $1 feeds a varchar column AND a WHERE comparison:
  cast EACH bind (`$1::varchar`, `$2::uuid`) on both sides.
- `generateRoleDNA(jobTitle)` does not resolve every role title (e.g. "Backend
  Engineer"/"QA Engineer" returned 0 requirements while "Data Scientist"/"Product
  Manager" resolved) — a separate title-resolution concern, independent of the
  question/blueprint data.
- **Resolution lever (precedes the bridge):** the employer match resolves jobTitle
  → `resolveBestOntRole` (rank code<exact_title<alias<partial) → `curatedLayerFor`
  (`map_ont_onto_role WHERE ont_role_id=<resolved id>`). A title that only matches
  a SHARED O*NET alias (e.g. "Backend Engineer" AND "DevOps Engineer" both →
  ONET_15-1252.00 "Software Developers" id 123) or matches NOTHING ("Senior Backend
  Engineer") cannot be bridged safely — pointing the shared id at one role's DNA
  mis-routes its siblings. Fix = seed a DEDICATED curated `ont_roles` row per title
  in `services/ontology-seed.ts` (mirror ROLE_SWE/ROLE_SR_SWE: add to `roles` +
  `roleExtras`) so each resolves EXACTLY (exact_title beats the shared alias) to a
  DISTINCT id; then UPDATE the `map_ont_onto_role` NULL bridge to that id by CODE
  (never hardcode the autoincrement id). `map_ont_onto_role` has `UNIQUE(onto_role_id)`
  + FK `ON DELETE SET NULL` (reversible). **Side effect to disclose:** the title's
  inherited requirement set shifts from the generic O*NET occupation to the curated
  seeded role (fewer but role-appropriate comps) — accepted as more consistent with
  how ROLE_SWE already behaves, not a regression.
- `onto_dna_profiles` has no `name` col; `onto_assessment_blueprints` has no
  `status` col (use `active`); blueprint comps come from
  `onto_blueprint_competency_map` joined to `onto_competencies.canonical_name`.

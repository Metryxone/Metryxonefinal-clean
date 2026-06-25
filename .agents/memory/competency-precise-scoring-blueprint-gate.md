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
- `onto_dna_profiles` has no `name` col; `onto_assessment_blueprints` has no
  `status` col (use `active`); blueprint comps come from
  `onto_blueprint_competency_map` joined to `onto_competencies.canonical_name`.

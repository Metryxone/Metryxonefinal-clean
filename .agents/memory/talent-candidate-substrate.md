---
name: Talent / candidate substrate
description: Which table is the real candidate source for employer-side talent features.
---

`employer_candidates` is the canonical employer-side candidate table (rich typed
columns: name/email/location/candidate_role/skills jsonb/ei_score/match_score/
stage/rating/tags/pooled/behavioral_profile/competency_profile). Build talent
search / filter / segmentation / pools / shortlists against it.

**Why:** During Phase 5.4 reconciliation, `candidate_master` and `tig_entities`
did NOT exist in this DB (despite older memory referencing them), and
`career_seeker_profiles` (PK `user_id`, JSONB `data`) is the SEEKER-side store,
not the employer discovery substrate. Reaching for a non-existent or wrong table
silently degrades to empty results.

**How to apply:** For any employer/recruiter-facing candidate feature, read from
`employer_candidates`. Curation surfaces with no existing table (pools/shortlists/
saved-searches) are legitimately net-new additive tables — distinct from the
gap-fill fabrication trap (which was about building audit-named tables that have
zero consumers). A user explicitly requesting the capability makes the table real.
Always confirm a candidate-table name via a live information_schema query before
coding, since names drift between memory and the actual DB.

---
name: Competency-runtime dual scoring ledgers
description: Two parallel scoring engines write different tables — any "scoring run" count must union both or runtime-scored subjects read as unscored.
---

# Two scoring ledgers coexist in competency-runtime

There are **two distinct scoring engines** that persist to **different tables**:

1. **Rich/normalized scorer** — `backend/services/competency-scoring.ts`. Writes a full
   run row to `onto_competency_score_runs` (id, assessment_id, blueprint_id, subject_id,
   competency_scores jsonb, overall jsonb, normalization, status, source).
2. **Runtime generate→score path** — `scoreInstance` in `backend/services/competency-runtime.ts`.
   This is the path the SuperAdmin UI driver (`CompetencyRuntimePanel.runProfileAssessment`)
   and the validation demo actually exercise. It writes domain-proxy rows to
   `onto_competency_scores` **and one append-only snapshot per run to `onto_competency_profiles`**,
   but **never** writes to `onto_competency_score_runs`.

**The trap:** any measurement of "scoring runs" that reads only `onto_competency_score_runs`
will report a subject scored via the runtime path as **"scored, but none for this subject"** —
a false negative. This is what surfaced in the Phase 2.10 validation harness Scoring stage.

**Rule:** to count scoring runs (total or per-subject), **union both ledgers**:
- normalized ledger = `COUNT(onto_competency_score_runs)`
- runtime-proxy ledger = `COUNT(onto_competency_profiles)` — faithful because `scoreInstance`
  does exactly **one** append-only `onto_competency_profiles` INSERT per scoring call
  (verified: it is the only writer to that table).

**Why this proxy is safe:** profile snapshot is 1-row-per-run; using its count for the
Scoring stage while the Profile stage also reads it is acceptable — they are adjacent
evidence checks in a read-only validation report, not independent correctness proofs.

**If stricter non-proxy accounting is ever needed:** add an explicit run-ledger INSERT in
the runtime `scoreInstance` path (mind `onto_competency_score_runs.assessment_id` is a UUID
FK — the runtime *instance* id is from `onto_assessment_instances`, not `onto_assembled_assessments`,
so leave assessment_id NULL or add an instance_id column) and switch the harness to that single table.

# Per-competency (comp_*) scoring now writes the run ledger — but generation is the real gate

The runtime `scoreAssessment` now DOES write `onto_competency_score_runs` (source
`runtime_competency_map`, assessment_id NULL) whenever its precise per-competency layer
produced scores — so the unified profile (`resolveUnifiedCompetencyProfile`) surfaces them
at `granularity:'competency'` and the employer match scores requirements via DIRECT
per-competency hits instead of the domain proxy. `ensureScoringSchema(pool)` is called
BEFORE the txn so the conditional INSERT can never abort scoring mid-transaction.

**The non-obvious gate (cost >2 attempts):** writing the run ledger is necessary but NOT
sufficient. The precise layer only fires when the SERVED+answered questions are linked in
`onto_competency_question_map`, and legacy `generateAssessment` only ever served the **7-code
domain bank** (COG/LEA/COM/ADP/EIQ/EXE/TEC) — those approved templates are NOT in the map.
The mapped/tagged templates are coded directly to **comp_\*** ids (`competency_code ==
competency_id`, e.g. `comp_stakeholder_mgmt`). So generation had to be extended to ALSO
select comp_*-coded approved templates for the blueprint's competencies and serve them first
(onto-domain resolved via `domByComp`, never fabricated). Without that wire the run-ledger
INSERT is dead code and `directMatchCount` stays 0.

**Why it lines up for the PM demo:** `bp_pm_v1` competencies, `role_pm` requirements, and the
23 approved+mapped templates are ALL the same comp_* ids by design (demo seed). Of ~2,539 map
rows only ~25 are `active`+approved (the rest are MX-101A draft pipeline, human-approval-gated).
MX-106A demo result moved from `0 direct / 10 proxy` to `6 direct / 8 proxy` (measurement
domain_proxy→hybrid). **How to apply:** to raise direct matches, approve+map more comp_*
templates for the blueprint's competencies — never fabricate; untagged comps stay null.

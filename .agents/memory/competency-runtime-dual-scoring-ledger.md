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

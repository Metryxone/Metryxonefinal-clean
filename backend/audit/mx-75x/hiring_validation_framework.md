# MX-75X · Section 3 — Hiring-Outcome Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 3 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the employer pipeline, the validation loop, and the
MX-75X connection (`terminalCandidatesToPairs`).
**Honesty-first:** Coverage and Confidence/Calibration-trust are SEPARATE axes. `null` = missing,
never a fabricated 0. Demo / `@example.com` rows are excluded from evidence-backed claims.

---

## 0. Headline

Hiring is the **only** outcome type with a **live, automatic feeder** today. The MX-75X connection
wires the pre-existing employer pipeline into the validation loop without any manual intake: when an
`employer_candidates` row reaches a terminal stage (`Hired`/`Rejected`) and carries a decision-time
`predicted_prob_at_decision`, it becomes a realized `{predicted, outcome}` pair via
`terminalCandidatesToPairs` (`backend/services/validation-loop-engine.ts:136-153`).

**Empirical state is still ABSTAINED.** A live feeder is *coverage*, not *accuracy*. There are **0
realized non-demo hiring outcomes** carrying a decision-time prediction today, so hiring calibration
is `cold_start` and stays abstained until **≥30** such outcomes accrue (`VALIDATION_K_MIN = 30`,
`validation-loop-engine.ts:28`). No code can shortcut this; it is an outcome-accrual milestone.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| Terminal-stage feeder (pure) | `backend/services/validation-loop-engine.ts:136-153` (`terminalCandidatesToPairs`) |
| Decision-time prediction column | `backend/migrations/20261211_employer_tig_calibration_enhancements.sql:5` (`employer_candidates.predicted_prob_at_decision FLOAT`) |
| Feeder query (status) | `backend/routes/validation-loop.ts:183-191` |
| Feeder query (calibration) | `backend/routes/validation-loop.ts:288-298` |
| Realized + connected + platform_realized union | `backend/routes/validation-loop.ts:192-195`, `:216-221` |
| Manual hiring intake (`outcome_type='hiring'`) | `backend/routes/validation-loop.ts:83-140` |
| `hiring_outcomes` table (disconnected) | `backend/migrations/20260522_employability_knowledge_graph.sql:237-249` |
| `interview_outcomes` table (disconnected) | `backend/migrations/20260522_employability_knowledge_graph.sql:225-235` |
| k_min gating + evidence verdict | `backend/services/validation-loop-engine.ts:159-171` |
| Calibration engine (reused) | `backend/routes/employer-tig.ts:211-274` |
| Demo exclusion (`@example.com`) | `backend/services/validation-loop-engine.ts:139-140` |
| Coverage counts (employer terminal) | `backend/routes/validation-loop.ts:198-206` |

---

## 2. The realized hiring pair: `employer_candidates`

A hiring outcome is the cleanest realized signal the platform has, because the employer pipeline
*already* records both halves of the pair:

- **Prediction half** — `employer_candidates.predicted_prob_at_decision` (a `FLOAT` in [0,1]), added
  by `backend/migrations/20261211_employer_tig_calibration_enhancements.sql:5`. This is the success
  probability snapshotted at the moment a hire/reject decision is made.
- **Outcome half** — the candidate `stage`. The feeder treats `Hired = 1` and `Rejected = 0`
  (`validation-loop-engine.ts:143-144`); any non-terminal stage is ignored (`:145`).

The success probability itself is produced upstream by the employer-TIG engine
(`computeSuccessProbability`, `employer-tig.ts:88-96`) — so the prediction and the realized outcome
come from the *same* operational pipeline, which is exactly what a validation loop needs.

---

## 3. The connected feeder: `terminalCandidatesToPairs`

This is the MX-75X connection. It is a **pure** function (`validation-loop-engine.ts:136-153`) that
maps terminal candidate rows to realized pairs, mirroring the honesty filters of `toCalibrationPairs`:

1. **Demo excluded** — `email` ending `@example.com` is skipped (`:139-140`).
2. **Terminal only** — `Hired → 1`, `Rejected → 0`, everything else `continue` (`:142-145`).
3. **Finite, in-range prediction** — missing/empty predictions are skipped; non-finite or
   out-of-`[0,1]` predictions are **dropped, never clamped** (`:146-149`).

The status route runs this against the live pipeline (read-only):

```sql
SELECT stage, predicted_prob_at_decision, email
  FROM employer_candidates
 WHERE stage IN ('Hired','Rejected') AND predicted_prob_at_decision IS NOT NULL
```
(`validation-loop.ts:184-188`; the same query backs `/calibration` at `:290-294`). The result is
`connectedPairs` (`:189`), and the loop reports three calibration views
(`validation-loop.ts:216-221`):

| Key | Pairs used | Meaning |
|---|---|---|
| `realized` | manual intake, non-demo | hand-recorded outcomes only |
| `connected` | `terminalCandidatesToPairs` | the automatic employer hiring feeder |
| `platform_realized` | `realized ∪ connected` | the honest **total** evidence axis (`:194`) |
| `demo_illustrative` | demo rows | proves the mechanism runs; never evidence |

The evidence verdict folds in the connected feeder so the loop reflects ALL real hiring evidence
(`evidenceVerdict(platformPairs.length)`, `validation-loop.ts:209`).

---

## 4. The disconnected feeders that EXIST

Two richer hiring substrates exist in the employability knowledge graph but are **not yet wired** into
the validation loop's calibration (they are reported on the **coverage** axis only):

- **`hiring_outcomes`** (`20260522_employability_knowledge_graph.sql:237-249`) — records `user_id`,
  `occupation_id`, `hired_at`, `salary_offered`, `source`, `metadata`. It captures the *fact* of a
  hire but carries **no decision-time prediction column**, so a row here cannot become a
  `{predicted, outcome}` pair without a join to the prediction that preceded it (UNVERIFIED — no such
  join exists in code today).
- **`interview_outcomes`** (`20260522_employability_knowledge_graph.sql:225-235`) — records per-stage
  results (`screen/technical/onsite/final/offer` × `progressed/rejected/offered/declined/accepted/
  withdrew`). It is finer-grained funnel data, also with no prediction snapshot.

The status route counts these for coverage transparency (`validation-loop.ts:201-202`,
`safeCount(... hiring_outcomes ...)`, `... interview_outcomes ...`), returning `null` if a table is
absent — **`null`, not 0** (`safeCount`, `validation-loop.ts:58-65`). They are *coverage that exists
but does not yet feed calibration*; routing them in would require a verified prediction-at-decision
join and is out of scope for this read-only framework.

---

## 5. Manual hiring intake (the fallback path)

Independently of the feeder, a super-admin can record a hiring outcome directly:

`POST /api/validation-loop/outcomes` with `outcome_type='hiring'`
(`validation-loop.ts:83-140`). Intake validates: `outcome_type` ∈ `OUTCOME_TYPES`
(`:88-90`), `subject_email` required (`:91-92`), binary `outcome_value` must be 0/1 (`:97-99`), and
`predicted_prob_at_decision` (if supplied) must be in `[0,1]` (`:101-104`). Rows are idempotent on
`(outcome_type, ref_id)` (`migration uq_vlo_type_ref`, `:42-44`). Manual rows land in the `realized`
bucket (when `is_demo=false`).

---

## 6. k_min gating & calibration

Hiring pairs (connected + manual) flow into the **reused** engine `buildCalibrationModel`
(`employer-tig.ts:211-274`) — Beta–Binomial α-smoothing (`:242`), Brier + ECE on raw predictions
(`:248-259`), and an isotonic/PAV curve **only once calibrated** (`:174-205`, `:265-270`). Status is
gated purely on realized count (`employer-tig.ts:226-229`):

| Realized hiring pairs | Status | Behaviour |
|---|---|---|
| `0` | `cold_start` | identity map (raw === calibrated); `brier`/`ece` = `null` |
| `1 .. 29` | `provisional` | α-smoothed band rate; best estimate, **never** "validated" |
| `≥30` | `calibrated` | isotonic mapping trusted |

There is also a cross-org **globally-pooled prior** (`buildGlobalCalibrationPrior`,
`employer-tig.ts:289-309`) that lends strength to thin orgs only when a band has `≥30` outcomes from
`≥2` distinct orgs (k-anonymity) — it never changes a trust status (`:286-288`).

---

## 7. Coverage vs Confidence (hiring)

| Axis | Today | Source |
|---|---|---|
| **Coverage** | `connected_realized`, `employer_candidates_terminal`, `hiring_outcomes`, `interview_outcomes` counts (`null` if absent) | `validation-loop.ts:223-233` |
| **Confidence** | `model_confidence` — reliability/consistency, explicitly **≠ accuracy** | `validation-loop.ts:252-256` |
| **Calibration / Accuracy** | **ABSTAINED** — `cold_start`, 0 realized non-demo pairs | `validation-loop.ts:216-221`, `employer-tig.ts:226-229` |

A live feeder raises *Coverage*. It does **not** raise *Accuracy*. Only ≥30 realized non-demo hiring
pairs can move the calibration axis.

---

## 8. Abstention contract

`evidenceVerdict` (`validation-loop-engine.ts:159-171`) governs hiring evidence:
`evidence_backed = platformPairs >= 30`; below that the reason is `awaiting_outcomes` (0) or
`insufficient_outcomes (n/30)`. The headline verdict stays **PARTIAL** — *"loop is structurally wired
and the intake is live; predictions stay ABSTAINED until realized outcomes accrue. No outcome is
fabricated."* (`validation-loop.ts:260`).

---

## Honesty / abstention note

- Empirical hiring accuracy is **ABSTAINED**: **0 realized non-demo hiring outcomes** with a
  decision-time prediction exist today → `cold_start`, `evidence_backed = false`.
- Calibration vocabulary is strictly `cold_start / provisional / calibrated`; `calibrated` is
  impossible below 30 realized outcomes.
- `@example.com` / `is_demo` rows are excluded from `realized`, `connected`, and `platform_realized`.
- `hiring_outcomes` / `interview_outcomes` are **coverage that exists but does not yet feed
  calibration**; wiring them needs a verified prediction-at-decision join (UNVERIFIED today).
- This is *developmental validation* only; the system issues no hiring/suitability predictions about
  people (`VALIDATION_LANGUAGE_POLICY`, `validation-loop-engine.ts:41-46`). No code was changed.

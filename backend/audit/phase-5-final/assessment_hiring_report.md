# Assessment-Led Hiring Report

**Phase:** 5 (Employer Lifecycle) — Final
**Date:** 2026-06-21
**Scope:** Assessment invitation + completion within the hiring flow
**Validator:** v5.15.0
**Verdict:** ✅ **OPERATIONAL**

---

## 1. Subsystem

| Concern | Engine / route |
|---------|----------------|
| Hiring assessment | `services/hiring-assessment-engine.ts`, `routes/hiring-assessment-engine.ts` |
| Persistence | `employer_candidates.assessment_sent`, `assessment_sent_at`, `assessment_score`, `completion_completed_at` |

The assessment layer enforces a **send-before-score invariant**: a candidate may not
carry a score without a corresponding sent flag.

## 2. Evidence — persistence (E2E stages 7–8)

```
[07] Assessment Invited   ✓ assessment_sent persisted (false/null→true)
[08] Assessment Completed ✓ assessment_score persisted (null→68, in [0,100])
                          ✓ score implies sent (assessment_sent still true)
```

Both transitions proven by before/after deltas: the invite flips
`assessment_sent` to `true`, and completion writes `assessment_score` `null → 68`.

## 3. Evidence — invariants (validator area `assessments`)

```
[assessments] status=pass measurable=true
   - assessment_activity: pass — 1 sent, 1 scored of 1 candidate(s).
   - assessment_score_bounds: pass — all assessment_scores in range.
   - score_implies_sent: pass — every score has a corresponding sent flag.
```

The critical honesty invariant is `score_implies_sent`: a scored-but-never-sent
assessment would FAIL. Here every score traces to a sent invite.

## 4. Honesty notes

- `assessment_score` is bounded `[0,100]`; out-of-range would FAIL `assessment_score_bounds`.
- Activity is reported as raw counts (`1 sent, 1 scored of 1`) — Coverage is explicit,
  never collapsed into a single inflated metric.

## 5. Success criteria

| Criterion | Status | Basis |
|-----------|--------|-------|
| Assessment-led hiring operational | ✅ | E2E stages 7–8 + `assessments` area PASS (3/3) |

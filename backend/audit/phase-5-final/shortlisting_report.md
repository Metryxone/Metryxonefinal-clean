# Shortlisting Report

**Phase:** 5 (Employer Lifecycle) — Final
**Date:** 2026-06-21
**Scope:** Pipeline management + stage transitions
**Validator:** v5.15.0
**Verdict:** ✅ **OPERATIONAL**

---

## 1. Subsystem

| Concern | Engine / route |
|---------|----------------|
| Pipeline / shortlisting | `services/shortlisting-engine.ts`, `routes/shortlisting-engine.ts` |
| Persistence | `candidate_pipeline` (status, stage_order), `workflow_transitions` |

### Canonical pipeline enum (`PIPELINE_STATUSES`)
`['review','shortlist','hold','interview','offer','hire','reject']`
(forward-funnel ordering; `hold`/`reject` are off-funnel → null)

## 2. Evidence — persistence (E2E stage 12)

```
[12] Candidate Shortlisted ✓ candidate_pipeline persisted (status=shortlist)
                           ✓ workflow_transition resolves to its pipeline entry (0 orphans)
```

The transition row is inserted pointing at the **real** `candidate_pipeline.id`, then
an explicit anti-join confirms **0 orphans** — a transition can never reference a
non-existent pipeline entry.

## 3. Evidence — invariants (validator area `shortlisting`)

```
[shortlisting] status=pass measurable=true
   - pipeline_present: pass — 1 pipeline entry(ies).
   - status_in_canon: pass — all statuses canonical.
   - stage_order_non_negative: pass — stage_order within range.
   - transitions_resolve: pass — all transitions resolve.
   - transition_status_in_canon: pass — all transition states canonical.
```

All five checks PASS: pipeline status and transition states are within
`PIPELINE_STATUSES`, `stage_order` is non-negative, and every transition resolves to
its pipeline entry (orphan FK = FAIL, which did not occur).

## 4. Honesty notes

- `transitions_resolve` is a true **referential-integrity invariant** — the most
  common silent-corruption vector in pipeline systems — and it is enforced, not assumed.
- Off-funnel states (`hold`/`reject`) are part of the canon and validated, so a
  rejected candidate is still a legal, in-canon pipeline state.

## 5. Success criteria

| Criterion | Status | Basis |
|-----------|--------|-------|
| Shortlisting operational | ✅ | E2E stage 12 (pipeline + 0-orphan transition) + `shortlisting` area PASS (5/5) |

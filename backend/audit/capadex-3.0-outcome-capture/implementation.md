# CAPADEX 3.0 — Program 2: Longitudinal Outcome Capture on Progression (Task #305)

**Status:** Implemented · flag-gated · byte-identical OFF · STOP for approval (no deploy).
**Closes:** GAP-O1 (realized-progression / Mastery outcome capture — MECHANISM only) +
GAP-A4 (exit / continuous-assessment hook).
**Flag:** `longitudinalOutcomeCapture` (env `FF_LONGITUDINAL_OUTCOME_CAPTURE`), default **OFF**.

---

## What this does (capture only — never claims accuracy)

When the flag is ON, every CAPADEX lifecycle stage completion wires into the **existing**
capture machinery — no new outcome store, no second snapshot path:

1. **Append-only longitudinal snapshot** — reuses `captureLongitudinalSnapshot`
   (`services/wc3/longitudinal-foundation.ts` → `wc3_longitudinal_snapshots`). One immutable
   datapoint per progression step. Same fn WC-L0 already treats as its canonical capture fn.
2. **Learning-type "platform milestone" outcome** — written to the canonical outcome ledger
   `validation_loop_outcomes` (`outcome_type='learning'`, `outcome_kind='milestone'`,
   `outcome_value=1`, `predicted_prob_at_decision=NULL`, `source='capadex_progression'`) via the
   existing `ensureValidationLoopSchema`. A DISTINCT "reached-Mastery" milestone
   (`ref_id=capadex_mastery:<sessionId>`) is recorded when the completed stage is Mastery
   (`CAP_MAS` / canonical `Mastery`), alongside the per-completion milestone
   (`ref_id=capadex_progression:<sessionId>`). Both are idempotent on the table's existing
   `uq_vlo_type_ref` partial unique index `(outcome_type, ref_id) WHERE ref_id IS NOT NULL`.
3. **Honest abstention** — milestones carry NO decision-time prediction, so the outcome engine's
   calibration axis keeps `method_applies=false` and the verdict stays PARTIAL below k-min
   (`OI_K_MIN`=30). No empirical accuracy / effectiveness is ever claimed.
4. **Demo / @example.com exclusion in lockstep** — demo subjects are stamped `is_demo=true` and
   the outcome engine counts realized (`is_demo=false`) and demo (`is_demo=true`) on SEPARATE
   axes, both in coverage AND the unified ledger. Capture can never self-inflate.
5. **Read-only exit / re-assessment signal** (GAP-A4) — `getReassessmentSignal` derives, on read
   from accrued snapshots: `snapshot_count`, `latest_snapshot_at`, `age_days`,
   `eligible_for_reassessment` (newest snapshot older than `REASSESSMENT_FRESHNESS_DAYS`=180),
   `reached_mastery`/`eligible_for_exit`, and a supportive `reason`. Attached to the CAPADEX
   complete response as `reassessment`; surfaced as a read-only banner in `StageJourneyPanel`.
   NEVER gates progression.

## Files

| Layer | File | Change |
|---|---|---|
| Flag | `backend/config/feature-flags.ts` | new flag `longitudinalOutcomeCapture` + helper `isLongitudinalOutcomeCaptureEnabled()` |
| Service (new) | `backend/services/capadex/progression-outcome-capture.ts` | `captureProgressionOutcome` (fire-and-forget; flag re-asserted at the write layer) + `getReassessmentSignal` (read-only) |
| Hook | `backend/routes/capadex-enterprise.ts` | item 24 in `postCompletionHooks` (flag-gated lazy import, never-throws) |
| Route | `backend/routes/capadex.ts` | complete response gains `reassessment` (null when flag OFF) |
| Engine | `backend/services/outcome-intelligence-engine.ts` | learning block + `composeLedger` additively fold `validation_loop_outcomes(outcome_type='learning')`, gated on the capture flag (byte-identical when OFF) |
| Frontend | `StageJourneyPanel.tsx`, `CapadexResultPhase.tsx`, `lib/behavioural-insights.ts` | optional `reassessment` prop + read-only banner; type field on `CapadexStageResult` |

## Byte-identical-OFF guarantees

- Flag OFF → `captureProgressionOutcome` returns at the first guard (`flag_off`): no snapshot,
  no ledger rows, no DDL. The hook itself is wrapped in a flag check before the lazy import.
- The capture write fn (`writeLearningMilestone`) **re-asserts the flag** before any
  `ensureValidationLoopSchema` / INSERT, so direct/tooling callers cannot create schema or rows
  while OFF.
- `getReassessmentSignal` returns `null` when OFF (no read, no DDL) → the route surfaces
  `reassessment:null` → the frontend banner does not render.
- The outcome engine's learning fold is gated on `isLongitudinalOutcomeCaptureEnabled()`; when
  OFF, `demoCount` stays `null` exactly as before (no null→0 drift) → engine output unchanged.
- **Ledger scoping (no duplication / no OFF leak):** `composeLedger`'s generic
  validation-loop block is explicitly scoped to `outcome_type IN ('hiring','performance','
  promotion','retention')` when no type filter is requested. `learning` rows are surfaced
  EXCLUSIVELY by the dedicated, flag-gated learning block — so they never duplicate when ON and
  never leak into the ledger when OFF. Verified: `composeLedger(undefined)` surfaces each
  progression row exactly once (ledger count == DB count) and zero progression rows when OFF.

## Verification (script `backend/scripts/task305-verify.ts`, live dev DB, self-cleaning)

```
=== OFF STATE ===
capture: enabled=false, skipped_reason=flag_off
reassessment signal: null
learning rows before/after: 0 / 0 · snapshot rows before/after: 0 / 0
ledger progression rows (flag OFF): 0
OFF byte-identical (no rows, signal null, no ledger leak): PASS

=== ON STATE ===
real capture: snapshot+learning+mastery all true, is_demo=false
demo capture: is_demo=true
reassessment: snapshot_count=1, reached_mastery=true, eligible_for_exit=true
idempotency (re-run → no new rows): 4 / 4  PASS
real session milestone rows: capadex_mastery (reached_mastery) + capadex_progression (stage_completion)
ON capture (snapshot+learning+mastery, demo flagged, exit eligible): PASS

=== ENGINE lockstep SQL (flag ON) ===
realized (is_demo=false): 2 · demo (is_demo=true): 2  → counted on SEPARATE axes  PASS

=== LEDGER (composeLedger, type omitted, flag ON) ===
db progression rows: 4 · ledger progression rows: 4
no duplication (ledger == db, surfaced exactly once): PASS
```

Residual after run: 0 progression VLO rows / 0 snapshots / 0 sessions (script cleans its own
`@example.com` + fixture rows).

## Honesty notes

- **Mechanism, not validated outcome.** A "platform milestone" records that a user reached a
  lifecycle stage — it is NOT a fabricated job/promotion outcome. No prediction is attached, so
  the calibration surface keeps abstaining until real non-demo data crosses k-min.
- **null ≠ 0** preserved throughout; absence of progression is absence, never synthesised.
- Anonymous sessions (no subject email) get a snapshot but NO ledger row — honest skip
  (`validation_loop_outcomes.subject_email` is NOT NULL).

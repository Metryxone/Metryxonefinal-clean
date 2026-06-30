---
name: Longitudinal outcome capture on progression (longitudinalOutcomeCapture)
description: CAPADEX 3.0 — flag-gated capture of lifecycle stage completions into the existing snapshot + canonical outcome ledger; reuse traps + honesty rules.
---

# Longitudinal outcome capture on progression (closes GAP-O1 + GAP-A4)

Flag `longitudinalOutcomeCapture` / `FF_LONGITUDINAL_OUTCOME_CAPTURE`, default OFF.
Wire CAPADEX stage completions into EXISTING capture machinery — no 2nd outcome store / snapshot path.

## Reuse, don't rebuild
- Snapshot → existing `captureLongitudinalSnapshot` (wc3 longitudinal foundation). Append-only, never-throws.
- Outcome → canonical ledger `validation_loop_outcomes`, `outcome_type='learning'`. The table comment
  only lists hiring/performance/promotion/retention but has NO CHECK on outcome_type, so 'learning' is
  allowed. **Do NOT reuse `recordValidationOutcome` — it rejects 'learning'.** Write the INSERT directly.
- Idempotency: the table's existing partial unique index is `(outcome_type, ref_id) WHERE ref_id IS NOT NULL`
  → an `ON CONFLICT` target MUST repeat the `WHERE ref_id IS NOT NULL` predicate or it won't match.

**Why:** a learning milestone records reaching a lifecycle stage; it is a mechanism, not a validated
job/promotion outcome — so it carries `predicted_prob_at_decision=NULL` → no calibration pair → the
outcome engine keeps `method_applies=false` and abstains below k_min. Capture ≠ accuracy.

## The ledger-leak trap (the one that bit on review)
**Rule:** when you add a new `outcome_type` to `validation_loop_outcomes`, any generic reader that
selects from that table WITHOUT a type filter (e.g. `composeLedger(type=undefined)`) must be made to
explicitly scope OUT the new type. Surface the new type ONLY through its own dedicated, flag-gated block.
**Why:** otherwise the generic block returns the new rows too → they (a) duplicate the dedicated block
when the flag is ON and (b) leak into the ledger even when the feature flag is OFF, breaking
byte-identical-OFF. The per-type aggregate path was fine because its branches are already type-scoped;
only the unfiltered ledger read needed the explicit `outcome_type IN (...)` whitelist.

## Other honesty / gating rules
- Flag-gate MUST reach the SERVICE write layer (re-assert the flag before ensure-schema/INSERT), not just
  the route/hook — direct/tooling imports otherwise create schema/rows while OFF. (Same lesson as the
  platform-intelligence-registry write layer.)
- The engine's additive learning fold is itself gated on the flag so that when OFF the learning
  `demoCount` stays `null` exactly as legacy — guarding against null→0 drift that would change output.
- Demo/@example.com → `is_demo=true`; engine counts realized (is_demo=false) and demo on SEPARATE axes,
  in coverage AND the ledger, in lockstep — capture can never self-inflate.
- Anonymous session (no email) → snapshot fires but NO ledger row (subject_email is NOT NULL): honest skip.

## getReassessmentSignal gotcha (the exit / re-assessment hook)
Returns null when flag OFF. Internally needs the longitudinal-history-by-session reader, which requires
a real `capadex_sessions` row (returns null otherwise) — production always has one, but a verification
fixture must INSERT one (NOT NULL cols incl. concern_name, user_age, age_band, stage_code) or the signal
is null even with snapshots present. Freshness window mirrors the evidence-freshness constant (180 days);
exit-eligible = reached canonical 'Mastery'. NEVER gates progression — read-only banner only.

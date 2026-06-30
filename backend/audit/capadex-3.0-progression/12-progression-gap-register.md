# CAPADEX 3.0 · Phase 1.5 — Progression Gap Register (classified)

> Deliverable 12 · Generated 2026-06-30T13:37:32.258Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8c4776b58a27, written 2026-06-30T13:37:32.255Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

**OPEN engineering gaps: 3** (Launch-Critical 0 · High 0 · Medium 1 · Low 1 · Future 1).

The growth LOOP is mechanism-complete via REUSE-before-build (Phase 1.3 progression-outcome-capture + evidence-gate), gated by `progressionEngineCompletion` (byte-identical OFF). The dominant remaining axis is **ADOPTION** (real re-administration/outcome volume) — reported SEPARATELY (deliverable 08), NOT a progression gap. Coverage⟂Confidence⟂Outcome⟂Adoption are never composited; null≠0; nothing fabricated.

## Open engineering gaps
### Launch-Critical
_None._

### High
_None._

### Medium
#### GAP-P1-PROMOTION-NOT-UNIFORMLY-GATED — Promotion is readiness-DERIVED, not a uniformly enforced per-persona gate
- **Evidence**: evidence-gate supplies a readiness band (scoreToLevelBand) recorded in wc3_stage_progression, and promotion is derived from it; but there is no single enforced "promotion gate" applied identically across all persona paths (INV4 link is derived, not gated).
- **Remediation**: OPTIONAL/ADDITIVE: behind a flag, wire the existing evidence-gate readiness as a hard precondition to a stage transition per persona. Reuse-only (no new engine); never block byte-identical-OFF. Not Launch-Critical.

### Low
#### GAP-P2-PRACTICE-REINFORCEMENT-INFERRED — Practice-activity & behaviour-reinforcement steps are recommendation/intervention-driven (no explicit logged practice-completion substrate)
- **Evidence**: practice_activity + behaviour_reinforcement spine steps are surfaced via the recommendation/intervention catalogs; reinforcement is inferred from re-measurement rather than an explicit "practice completed" event log.
- **Remediation**: OPTIONAL/ADDITIVE: if explicit practice-completion telemetry is later required, REUSE the existing intervention substrate (capadex_interventions) with a completion flag rather than a new table. Low priority.

### Future
#### GAP-P3-IMPROVEMENT-EFFECTIVENESS-DEFERRED — Calibrated improvement→promotion effectiveness/accuracy is deliberately abstained
- **Evidence**: learning/progression milestones carry NO decision-time prediction (predicted_prob_at_decision is NULL by design), so empirical accuracy of the improvement→promotion link is honestly abstained (Confidence axis), distinct from Coverage. This is a deliberate honesty choice, not a bug.
- **Remediation**: FUTURE: once real non-demo re-administration volume + a prediction substrate exist, compute effectiveness/calibration over the EXISTING ledger (validation_loop_outcomes). Never fabricate accuracy before the data exists.

## Resolved (mechanisms reused, not rebuilt)
### MECH-UNIVERSAL-OUTCOME-CAPTURE — Universal close-the-loop realized-outcome capture
- **Closure**: PRESENT via REUSE (Phase 1.3): captureProgressionOutcome + captureJourneyTailMilestone write realized growth/mastery/engagement milestones into the canonical ledger (validation_loop_outcomes). Gated by longitudinalOutcomeCapture → byte-identical OFF. No new engine/table/DDL.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real realized-outcome volume is usage-driven (honest-low/0; reported by composeProgressionAdoption — Adoption⟂Coverage, null≠0).

### MECH-EVIDENCE-GATED-READINESS — Evidence-gated readiness / promotion derivation
- **Closure**: PRESENT via REUSE: evidence-gate composes the readiness band (scoreToLevelBand + k-anonymity data-sufficiency) recorded in wc3_stage_progression; the composer READS it, never re-derives. Gated by evidenceGatedProgression → byte-identical OFF.
- **Residual (ADOPTION, usage-driven — not a gap)**: ENGINEERING (GAP-P1, Medium): promotion is derived from readiness, not uniformly gated per persona.

### MECH-REASSESSMENT-SIGNAL — Interval / exit reassessment eligibility signal
- **Closure**: PRESENT via REUSE: getReassessmentSignal derives interval/exit re-administration eligibility ON READ from the accrued longitudinal record (no scheduler, no write). Gated by longitudinalOutcomeCapture → byte-identical OFF.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real re-administration cadence is usage-driven (null≠0).

# MX-102X §1 — Outcome Architecture Audit (grounding)

_Read-only architecture grounding for the Outcome Intelligence Activation layer. Measured live against
the shared dev DB. No fabrication; "—"/null = unreadable or absent, never assumed 0._

## Objective
Establish, before building, exactly which realized-outcome substrates already exist, how each is (or is
not) empirically validated, and where the SIX outcome types draw their data — so the new layer COMPOSES
existing engines rather than recomputing or duplicating any namespace.

## Existing outcome/validation surfaces (measured)
| Surface | State | Substrate / engine | Role for MX-102X |
|---------|-------|--------------------|------------------|
| `validationLoop` (MX-75X) | **ACTIVE** (flag ON) | `validation_loop_outcomes` (4 types: hiring/performance/promotion/retention) + `buildCalibrationModel` | Primary realized-outcome intake + calibration for 4 of 6 types |
| Employer TIG calibration | **ACTIVE** | `buildCalibrationModel`, `tig_calibration`, `employer_candidates` terminal feeder | Hiring feeder (Hired=1/Rejected=0 + decision-time prob) |
| Career-outcome evidence | **ACTIVE** | `career_outcomes` (BIGSERIAL, prior_score_value, no decision prob) | Career coverage; native validation = association correlation (off-surface) |
| Confidence engine | **ACTIVE** | `confidence_traces` | Model/structural confidence — SEPARATE axis from empirical accuracy |
| `predictiveIntelligenceV2` | ACTIVE | prediction stores | Predictions exist upstream; Prediction ≠ Outcome |
| Learning completions | present | `student_subscriptions` (assessment_completed_at; NO is_demo) | Learning coverage; no decision-time prediction → calibration not wired |
| wc3Outcome / wc3Journey / wc3Stage | DORMANT | — | not relied upon |
| enterpriseWorkforceConsole | DORMANT | — | not relied upon |

## Six-type taxonomy → canonical source (new layer owns its own taxonomy)
| Type | Source(s) | Calibration method | Confidence axis |
|------|-----------|--------------------|-----------------|
| hiring | `validation_loop_outcomes` ∪ `employer_candidates` terminal feeder | binary_calibration + feeder | abstains < k_min |
| performance | `validation_loop_outcomes` | binary_calibration | abstains < k_min |
| promotion | `validation_loop_outcomes` | binary_calibration | abstains < k_min |
| retention | `validation_loop_outcomes` | binary_calibration | abstains < k_min |
| career | `career_outcomes` | association_correlation (native, off-surface) | abstains (no [0,1] prob coercion) |
| learning | `student_subscriptions` | not_wired (no decision-time prediction) | coverage only |

## Key decision
Do **NOT** mutate the live `validationLoop` `OUTCOME_TYPES` (4 types, flag ON). The new layer defines its
own 6-type taxonomy and composes each type from its canonical source, REUSING the pure helpers
(`buildCalibrationModel`, `toCalibrationPairs`, `terminalCandidatesToPairs`, `calibrationSummary`,
`evidenceVerdict`, `VALIDATION_K_MIN`) — never re-implementing the math, never adding a parallel
namespace.

## Honesty contract (carried into the engine)
- **Coverage ⟂ Confidence** — realized-outcome counts (data axis) and empirical calibration trust
  (evidence axis) are reported independently and never composited.
- **Abstain < k_min = 30** — empirical accuracy is never claimed below threshold; the verdict stays
  PARTIAL until realized {prediction,outcome} pairs reach k_min.
- **Demo excluded** — `is_demo` / `@example.com` rows are excluded from every realized/evidence figure
  (labelled in the ledger, never counted as evidence).
- **No fabrication** — unreadable substrates degrade to null (never 0); out-of-range predictions are
  dropped (never clamped); a realized outcome without a decision-time prediction counts toward Coverage
  only — that gap IS the Coverage≠Confidence finding.
- **Prediction ≠ Outcome** — predictions exist upstream; empirical accuracy requires realized outcomes.

## Live ground truth (dev, never deployed)
- ~0 realized NON-demo outcomes across all substrates; the only terminal hiring decisions present are
  demo (`@example.com`), correctly excluded from coverage → realized coverage 0, evidence pairs 0.
- Expected honest verdict: **PARTIAL** — surface structurally unified and reads live substrates;
  empirical accuracy ABSTAINED. This is the honest state, not a defect, and is never inflated.

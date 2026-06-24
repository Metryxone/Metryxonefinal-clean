# MX-102X — Per-Type Outcome Intelligence (Coverage ⟂ Confidence)

_Generated 2026-06-24T10:01:45.303Z · engine v102.0.0 · k_min=30 · read-only_

Coverage = realized outcomes captured (data axis). Confidence/accuracy = calibration trust,
ABSTAINED until realized {prediction,outcome} pairs reach k_min. A realized outcome without a
decision-time prediction counts toward Coverage only — that gap IS the Coverage≠Confidence finding.

| Type | Sources | Coverage (realized) | Demo | Calibration method | Evidence pairs | Abstained | Validation |
|------|---------|--------------------:|-----:|--------------------|--------------:|:---------:|------------|
| **Hiring** | validation_loop_outcomes, employer_candidates | 0 | 0 | binary_calibration+feeder | 0 | yes | awaiting_outcomes — no realized outcomes recorded yet |
| **Performance** | validation_loop_outcomes | 0 | 0 | binary_calibration | 0 | yes | awaiting_outcomes — no realized outcomes recorded yet |
| **Promotion** | validation_loop_outcomes | 0 | 0 | binary_calibration | 0 | yes | awaiting_outcomes — no realized outcomes recorded yet |
| **Retention** | validation_loop_outcomes | 0 | 0 | binary_calibration | 0 | yes | awaiting_outcomes — no realized outcomes recorded yet |
| **Career** | career_outcomes | 0 | 0 | association_correlation | 0 | yes | awaiting_outcomes — no realized outcomes recorded yet |
| **Learning** | student_subscriptions | 0 | _null (substrate unreadable — honest gap, not 0)_ | not_wired | 0 | yes | awaiting_outcomes — no realized outcomes recorded yet |

### Hiring (`hiring`)
- **Sources**: validation_loop_outcomes, employer_candidates · table_present=true
- **Coverage**: realized=0, demo=0
- **Coverage detail**: validation_loop_realized=0, employer_candidates_terminal=0, employer_feeder_pairs=0
- **Calibration**: method=binary_calibration+feeder, method_applies=true, pairs_used=0
- **Validation**: awaiting_outcomes — no realized outcomes recorded yet
- **Note**: Realized hires from validation-loop intake plus the employer terminal-decision feeder (Hired=1/Rejected=0) with the decision-time success probability as the prediction.

### Performance (`performance`)
- **Sources**: validation_loop_outcomes · table_present=true
- **Coverage**: realized=0, demo=0
- **Coverage detail**: validation_loop_realized=0
- **Calibration**: method=binary_calibration, method_applies=true, pairs_used=0
- **Validation**: awaiting_outcomes — no realized outcomes recorded yet
- **Note**: Realized performance outcomes recorded through the validation-loop intake; decision-time prediction calibrated against the binary outcome.

### Promotion (`promotion`)
- **Sources**: validation_loop_outcomes · table_present=true
- **Coverage**: realized=0, demo=0
- **Coverage detail**: validation_loop_realized=0
- **Calibration**: method=binary_calibration, method_applies=true, pairs_used=0
- **Validation**: awaiting_outcomes — no realized outcomes recorded yet
- **Note**: Realized promotion outcomes recorded through the validation-loop intake.

### Retention (`retention`)
- **Sources**: validation_loop_outcomes · table_present=true
- **Coverage**: realized=0, demo=0
- **Coverage detail**: validation_loop_realized=0
- **Calibration**: method=binary_calibration, method_applies=true, pairs_used=0
- **Validation**: awaiting_outcomes — no realized outcomes recorded yet
- **Note**: Realized retention outcomes recorded through the validation-loop intake.

### Career (`career`)
- **Sources**: career_outcomes · table_present=true
- **Coverage**: realized=0, demo=0
- **Coverage detail**: career_outcomes_realized=0
- **Calibration**: method=association_correlation, method_applies=false, pairs_used=0
- **Validation**: awaiting_outcomes — no realized outcomes recorded yet
- **Note**: Realized career outcomes captured in the career-evidence ledger. Its native validation is an association correlation (prior readiness/EI score ↔ realized outcome), surfaced at /api/admin/career-evidence — NOT a [0,1] probability calibration, so the unified calibration axis abstains for career rather than coercing a score into a probability.

### Learning (`learning`)
- **Sources**: student_subscriptions · table_present=true
- **Coverage**: realized=0, demo=_null (substrate unreadable — honest gap, not 0)_
- **Coverage detail**: assessments_completed=0, reports_generated=0, subscriptions_total=0
- **Calibration**: method=not_wired, method_applies=false, pairs_used=0
- **Validation**: awaiting_outcomes — no realized outcomes recorded yet
- **Note**: Realized learning outcomes = completed assessments / generated reports on student subscriptions. No decision-time prediction is stored for learning yet, so empirical calibration is honestly NOT wired (Coverage only).

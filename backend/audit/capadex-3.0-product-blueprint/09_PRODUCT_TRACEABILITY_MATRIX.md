# 09 · Product Traceability Matrix

Verifies that each major capability maps across the 9 required axes:
**Business Domain · Persona · Lifecycle Stage · Journey · Assessment · AI · Report · Outcome · KPI.**
A cell is `✓` (mapped, evidence), `~` (partial), or `✗` (missing). Missing mappings are flagged, not fabricated.

## Matrix (major product capabilities)
| Capability | Domain | Persona | Stage | Journey | Assessment | AI | Report | Outcome | KPI |
|---|---|---|---|---|---|---|---|---|---|
| CAPADEX concern assessment | D2 | learners | CUR/INS | student/prof | Diagnostic | ✓ | ✓ | ✗ | ✗ |
| Signal/behaviour analysis | D2 | learners | INS | all | Behaviour | ✓ | ✓ | ✗ | ✗ |
| Competency assessment | D3 | employee/student | INS/GRW | prof/employee | Competency | ✓ | ✓ | ~ | ✗ |
| Career Builder / readiness | D4 | fresher/prof | INS/GRW | career | Baseline/Competency | ✓ | ✓ | ~ | ✗ |
| Talent match / hiring | D9 | HR/employer | GRW/MAS | hire | Performance | ✓ | ✓ | ~ | ~ |
| Recommendation / growth plan | D7 | learners | GRW | all | — | ✓ | ✓ | ✗ | ✗ |
| Reports / dashboards | D8 | all | all | all | — | ~ | ✓ | ~ | ~ |
| Institutional intelligence | D10 | institute | all | cohort | aggregate | ✓ | ✓ | ~ | ~ |
| Commercial / entitlement | D11 | all paying | — | — | — | ✗ | ~ | ~ | ~ |
| Platform governance intel | D12 | super-admin | — | — | — | ~ | ✓ | ✗ | ✗ |
| Outcome & KPI | D13 | all | MAS | outcome tail | Progress/Exit | ✗ | ✗ | ✗ | ✗ |

## Mapping-gap summary (the deliverable's point)
- **Outcome column is ✗ for nearly every capability** — the single most systemic traceability gap. Capabilities
  exist and report, but do not trace to a *realized, measured outcome*.
- **KPI column is ✗/~ for most** — few capabilities are bound to a success target (only hiring, institutional,
  commercial, and reports/dashboards carry **partial** KPIs; none carry a full, target-bound KPI set).
- **Stage mapping is strong** for the assessment→career core; **weak/absent** for commercial + governance
  (which are stage-agnostic by nature — flagged as *legitimately N/A*, not a defect).
- **AI maps to most learner-facing capabilities; ✗ for commercial** (correctly — pricing isn't AI-driven).

## Honesty notes
- `~`/`✗` in Outcome/KPI are **honest gaps**, consistent with 03 (D13 missing-as-realized) and 11 GAP register.
- N/A-by-design (e.g. commercial→Stage, commercial→AI) is distinguished from a true gap in the notes above; it
  is NOT counted against the product.

## Verdict
**ONE traceability matrix.** The product traces cleanly across Domain/Persona/Stage/Journey/Assessment/AI/
Report for its core. **The Outcome and KPI axes are the dominant missing mappings** — the same close-the-loop
root cause surfaced from yet another angle.

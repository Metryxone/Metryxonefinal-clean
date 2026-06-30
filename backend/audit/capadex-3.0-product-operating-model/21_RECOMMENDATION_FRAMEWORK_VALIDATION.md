# 21 · Recommendation Framework Validation

Validates how CAPADEX turns assessment into recommended action.

## Recommendation surfaces (repo-evidenced)
| Surface | Engine | Basis | Status |
|---|---|---|---|
| Career recommendations | `career-recommendation-aggregator.js` | gap + transferability + mobility | **IMPLEMENTED** |
| Competency gap → roadmap | `career-roadmap-engine.ts`, gap engines | Role-DNA vs profile | **IMPLEMENTED** |
| Intervention map | intervention chain (LBI/M5) | concern signals | **IMPLEMENTED** |
| EI recommendations | EI engine | deterministic (gap/transferability/mobility) | **IMPLEMENTED** |
| Role/job match | talent-match, shortlisting | Role-DNA crosswalk | **IMPLEMENTED (abstain-never-fabricate)** |
| Recommendation Intelligence Engine (2.8) | `recommendation-intelligence-engine` | catalog/compose | **DORMANT (flag-gated)** |
| Next-best stage routing | DecisionOrchestrator `fit_score` | outcome-model affinities | **IMPLEMENTED** |

## Findings (honest)
- **Recommendations are deterministic and evidence-grounded**, not black-box — confidence is derived from
  source richness, matches abstain when coverage is weak (Coverage ⟂ Confidence). Strong.
- **Recommendations are recommend-only** — the platform never auto-executes or auto-decides; human approval is
  authoritative (consistent with governance & maturity ceiling). Correct.
- **Recommendation *acceptance/effectiveness* is NOT measured** — there is no feedback loop capturing whether
  a recommendation was followed or worked (acceptance_rate / effectiveness honest-NULL per memory). This caps
  recommendation maturity. (→ GAP-O1)
- **The advanced Recommendation Intelligence Engine (2.8) is dormant** — built, default-OFF.

## Verdict
**Recommendation framework: IMPLEMENTED & responsible; UN-MEASURED for effectiveness.** Enhancement = capture
recommendation acceptance/outcome (closes the same outcome loop as GAP-O1), and deliberately activate the
dormant 2.8 engine if/when warranted.

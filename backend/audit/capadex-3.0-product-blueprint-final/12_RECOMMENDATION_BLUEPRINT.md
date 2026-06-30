# 12 · Recommendation Blueprint

ONE recommendation model. Defines how CAPADEX turns assessment into recommended action + intervention. Promotes
Operating-Model (`21`) to blueprint depth. Governing principle: **recommend-only — the platform never
auto-decides or auto-executes.**

## Recommendation surfaces (canonical, repo-evidenced)
| Surface | Engine | Basis | Status |
|---|---|---|---|
| Career recommendations | `career-recommendation-aggregator.js` | gap + transferability + mobility | IMPLEMENTED |
| Competency gap → roadmap | `career-roadmap-engine.ts`, gap engines | Role-DNA vs profile | IMPLEMENTED |
| Intervention map | intervention chain (LBI / M5) | concern signals | IMPLEMENTED |
| EI recommendations | EI engine | deterministic (gap/transferability/mobility) | IMPLEMENTED |
| Role / job match | talent-match, shortlisting | Role-DNA crosswalk | IMPLEMENTED (abstain-never-fabricate) |
| Next-best stage routing | DecisionOrchestrator `fit_score` | outcome-model affinities | IMPLEMENTED |
| Recommendation Intelligence Engine (2.8) | `recommendation-intelligence-engine` | catalog / compose | DORMANT (flag-gated) |

## Canonical recommendation flow (FROZEN)
`Assessment → AI Diagnosis → Recommendation (grounded, confidence from source richness) → Intervention/Growth
Plan (M5) → [accept] → Act → (Re-measure) → Effectiveness.` The last two links (re-measure, effectiveness) are
**forward work** (the close-the-loop tail).

## Findings (honest)
- **Deterministic and evidence-grounded** — confidence derived from source richness; matches abstain when
  coverage is weak (Coverage ⟂ Confidence). Strong, not black-box.
- **Recommend-only** — never auto-executes/decides; human approval authoritative (consistent with governance +
  maturity ceiling). Correct.
- **Effectiveness is NOT measured** — no feedback loop captures whether a recommendation was followed or worked
  (acceptance_rate / effectiveness honest-NULL). This caps recommendation maturity → **GAP-O1** (same loop as
  Outcome).
- **Recommendation Intelligence Engine (2.8) is dormant** — built, default-OFF.

## Canonical decisions (FROZEN)
1. **Recommend-only** is a permanent contract — interventions are proposed, humans decide.
2. Effectiveness capture (did they act? did it work?) is **forward work** and closes the same loop as Outcome
   (D13) — instrument once, satisfy both.
3. Activate the dormant 2.8 engine **only** deliberately, if/when warranted.

## Verdict
**ONE recommendation model: IMPLEMENTED & responsible; UN-MEASURED for effectiveness. FROZEN.** Enhancement =
capture acceptance/outcome (closes GAP-O1).

# CAPADEX 3.0 · Phase 1.3 — Outcome & KPI Mapping

> Deliverable 09 · Generated 2026-06-30T11:44:25.490Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9b3be5dcc291, written 2026-06-30T11:44:25.495Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

| Canonical Type | Status | Purpose | Business value | Outcomes | KPIs |
|---|---|---|---|---|---|
| Entry Assessment (`entry`) | IMPLEMENTED | Place a brand-new user: capture persona/cohort and surface the presenting concern so the right bank/flow is served. | Top-of-funnel conversion + correct routing; the only assessment every persona always meets. | Session-start telemetry (capadex_session_telemetry). | Started→completed conversion; persona distribution. |
| Baseline Assessment (`baseline`) | IMPLEMENTED | Establish the user’s starting level so later runs can measure movement. | Anchors Progress/Outcome measurement; without a baseline, growth is unmeasurable. | Baseline row referenced by Progress deltas. | Baseline completion rate; baseline score distribution. |
| Diagnostic Assessment (`diagnostic`) | IMPLEMENTED | Diagnose the presenting concern and the behavioural signals driving it; surface wellbeing flags. | Core differentiator — the diagnostic depth that drives interventions and trust. | Interventions logged (capadex_session_interventions). | Concern coverage; clarity-resolution rate; intervention uptake. |
| Behaviour Assessment (`behaviour`) | IMPLEMENTED | Measure behavioural traits/patterns (incl. personality-style surfaces) from real session signals. | Behavioural intelligence is the platform’s core IP; powers honesty/contradiction guards. | Signal trends fold into longitudinal/behaviour memory. | Signal capture rate; contradiction/reliability rate. |
| Competency Assessment (`competency`) | IMPLEMENTED | Measure frameworked competencies/skills against the ontology genome and Role-DNA. | The employability spine — drives readiness, matching, hiring and career planning. | Feeds talent match + hiring-decision outcomes. | Competency coverage; level distribution; gap closure. |
| Learning Assessment (`learning`) | PARTIAL | Verify knowledge acquisition through curated MCQ / practice items. | Closes the learn→prove loop; supports upskilling claims. | Practice deltas (not yet systematically tied to outcomes). | Practice completion; domain mastery. |
| Performance Assessment (`performance`) | PARTIAL | Measure applied performance / role fit and career readiness against real role demands. | Employer-side revenue surface; strongest applied-evidence assessment. | Hiring-decision outcomes (validation_loop_outcomes). | Readiness distribution; match precision; hire conversion. |
| Progress Assessment (`progress`) | IMPLEMENTED | Measure movement against the baseline over time. | Proves the product works; the basis of the growth narrative. | Progress deltas feed outcome capture. | Re-run rate; positive-movement rate. |
| Exit Assessment (`exit`) | IMPLEMENTED | Gate stage/lifecycle exit by re-administering existing assessments to confirm readiness to move on. | Completes the closed growth loop; turns the platform from measure-once to measure-and-confirm. | Exit event = strongest close-the-loop signal. | Exit-gate pass rate; time-to-exit. |
| Continuous Assessment (`continuous`) | IMPLEMENTED | Keep the picture current by re-administering existing assessments on an interval. | Sustains engagement + outcome evidence beyond the first measurement. | Continuous evidence stream. | Re-engagement rate; cadence adherence. |

## Close-the-loop ADOPTION (Adoption⟂Coverage — never composited)
The Progress / Exit / Continuous mechanisms are now instrumented via REUSE of the existing progression-outcome-capture hook (no new engine/table). This measures how much that loop is **exercised** — a SEPARATE axis from whether the mechanism exists. `—` = unreadable (null≠0); a numeric `0` is a measured-empty.

| Adoption signal | Subjects |
|---|---|
| Progress (stage_completion captured, non-demo) | 0 |
| Exit (reached_mastery captured, non-demo) | 0 |
| Continuous (re-administered, >1 longitudinal datapoint) | 0 |

_Freshness window: 180 days. Capture is gated by the `longitudinalOutcomeCapture` flag, so adoption accrues only as real subjects re-administer — current values are honest, not fabricated._

## Persona ⟂ Outcome linkage (read-time join, k-anon suppressed)
Realized outcomes are attributed per assessment persona via a READ-TIME join (zero DDL, no persona column added). `linkage_present:true` (false = join unreadable, NOT zero outcomes). Per-persona counts below k_min=30 are suppressed for anonymity.

_No persona-linked outcomes measured yet (honest empty — the persona substrate and realized-outcome volume have not yet intersected). Coverage⟂Outcome⟂Confidence never composited._

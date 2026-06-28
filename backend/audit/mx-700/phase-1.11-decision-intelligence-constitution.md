# CAPADEX 2.0 — Phase 1.11: Decision Intelligence Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Decision Intelligence Constitution. **Do not rebuild, do not create a second decision engine, do not replace WC-3, do not create WC-4, do not regenerate the decision graph, do not replace Outcome Projection, do not activate dormant decision capabilities, do not modify business logic, do not replace Behaviour Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Decision Intelligence CONSUMES Behaviour Intelligence — it never replaces it. **AI never becomes the decision maker; humans decide.** Coverage ⟂ Confidence kept SEPARATE; null ≠ 0; **seeded config ≠ live runtime activation**; flag-ON ≠ data-flowing. Never fabricate decisions, evidence, projections, or confidence.
> **Basis:** live WC-3/decision-spine audit + Phase 1.2–1.10 constitutions + memory (`capadex-decision-orchestration`, `capadex-decision-chain-gaps`, `l5c-runtime-outcome-projection`, `l5d-runtime-journey-projection`, `wc7b-activation-intelligence`, `wc11-decision-intelligence-measurement`, `outcome-attribution-drift`, `outcome-intelligence-activation`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.11.

---

## PART 1 — Current Decision Intelligence Audit (MEASURED)

| Component | As-built | **Live runtime in this DB** | Verdict |
|---|---|---|---|
| WC-3 spine tables | ~16 `wc3_*` tables present | mixed | canonical engine EXISTS |
| Stage definitions `wc3_stage_definitions` | seeded config | **5** | SEEDED |
| Outcome models `wc3_outcome_models` | seeded config | **12** | SEEDED |
| Stage state `wc3_stage_state` | runtime | **1** | ~DORMANT |
| Outcome state `wc3_outcome_state` | runtime | **0** | DORMANT |
| Journey state `wc3_journey_state` | runtime | **1** | ~DORMANT |
| Personalization decisions `wc3_personalization_decisions` | runtime | **4** | ~DORMANT |
| WC-7b decision state `wc7b_decision_state` | runtime | **1** | ~DORMANT |
| Validation-loop outcomes `validation_loop_outcomes` | runtime | **0** | DORMANT (no realized {pred,outcome}) |
| Orchestrator / outcome routes | `adaptive-orchestration-v2.ts`, `outcome-intelligence.ts`, `talent-outcome-prediction.ts` | flag-gated | EXISTS |

**CRITICAL HONEST FINDING (DERIVED):** WC-3 is the canonical decision engine and its **configuration is seeded** (12 outcome models, 5 stage definitions), but its **runtime state tables are essentially empty** (0–4 rows) and `validation_loop_outcomes`/`wc3_outcome_state` read **0**. So the engine is **structurally present but operationally DORMANT** — flag-ON does NOT mean data is flowing. This matches the standing canon: *Decision/WC-3 is DORMANT (flag-ON, no default-path data) — DOCUMENT, never activate.* Activation is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** ONE canonical engine (no WC-4 sprawl); seeded outcome-model + stage taxonomy; orchestrator + outcome-projection + WC-7b activation layers exist; deterministic confidence discipline; outcome abstains below k_min. **Technical debt / GAPS (DERIVED):** runtime population gap (above); ⚠️ **stage taxonomy is SPLIT** (BE 5-stage vs FE `CAP_*` 4-code — reconcile before any stage-keyed UX); decision→subscription mapping + journey→M5 bridge + entitlement are partial; construct-reachable ≠ outcome-reachable (residual must be DERIVED from projection output, never a broader ontology = over-claim); mentoring catch-all dilutes routing. **Dormant:** the whole WC-3 chain — documented, not activated.

---

## PART 2 — Decision Philosophy

Behaviour creates understanding; Decision creates action. Decision Intelligence exists to Interpret · Compare · Evaluate · Prioritize · Predict · Recommend · Guide · Explain. **Never decide for humans · never replace Behaviour Intelligence · never fabricate decisions · never fabricate evidence.**

## PART 3 — Decision Domain Architecture

Domains: Decision Core · Graph · Evidence · Confidence · Recommendation · Simulation · Analytics · Explainability · Governance · Memory · Learning · Prediction · Security. **Every decision capability belongs to ONE domain.**

## PART 4 — WC-3 Constitution

**WC-3 remains the canonical Decision Engine. Never replace WC-3; never create WC-4; never duplicate WC logic; enhance only.** Protect Decision flow · graph · models · Outcome projection · Alternatives · Confidence · Explainability. Binding: WC-3 chain (stage/outcome/journey/longitudinal/personalization) is DORMANT — document, never activate; outcome chain depends on `FF_WC3_OUTCOME_CROSSWALK` + a populated behavioural spine.

## PART 5 — Decision Orchestrator Constitution

Protect Decision workflow · routing · dependencies · priorities · sequencing · escalation · outcomes · completion. **Orchestration remains centralized** (`adaptive-orchestration-v2.ts`). Binding: orchestrators COMPOSE existing engine output, never recompute; two fire-and-forget builders of one idempotent snapshot RACE → enforce a SOLE builder.

## PART 6 — Decision Graph Constitution

Protect Nodes · Relationships · Dependencies · Alternative paths · Decision chains · Context · Evolution · History. **Every decision path must remain explainable.** Binding: `route_key` provenance identity proves "decision-driven" (never a tautology).

## PART 7 — Outcome Projection Constitution

Protect Behaviour · Learning · Career · Life · Enterprise · Subscription · Decision outcomes + Projection confidence + limitations. **Never fabricate projections.** Binding: Question→BridgeTag→Construct→OutcomeModel is deterministic; **construct-reachable ≠ outcome-reachable**; residual DERIVED from projection output, never from a broader ontology; honest reachability ceiling (~85.6%) — never force UNMAPPED residual.

## PART 8 — Decision Evidence Constitution

Evidence originates from Behaviour Intelligence · Assessments · Journey · Learning · Career · Enterprise · Historical decisions · Longitudinal data · AI; documents Source · Timestamp · Coverage · Quality · Confidence. **Never bypass Behaviour Intelligence or Evidence.**

## PART 9 — Decision Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Trust · Probability. **Confidence is deterministic, explains itself, never guessed.** Binding: Coverage ⟂ Confidence NEVER composited; abstain below k_min=30; calibration RAW, borrowed prior never upgrades TRUST.

## PART 10 — Decision Explainability Constitution

Every decision explains Why · Evidence · Behaviour drivers · Competencies · Concerns · Alternatives · Trade-offs · Confidence · Limitations · Expected outcomes.

## PART 11 — Alternative Engine Constitution

Every recommendation generates Primary · Secondary · Alternative · Fallback · Deferred options; each explains Benefits · Risks · Evidence · Trade-offs · Confidence. **Never a second recommendation engine.**

## PART 12 — Trade-off Constitution

Every important decision evaluates Risk · Benefit · Cost · Time · Learning/Career/Behaviour/Enterprise/Life impact. **Trade-offs remain transparent.**

## PART 13 — Decision Simulation Constitution

Support simulation of Career · Learning · Behaviour-intervention · Subscription · Enterprise · Life decisions; each documents Inputs · Assumptions · Evidence · Confidence · Expected outcomes. Binding: the simulation harness is ALLOWED to FAIL — never tune metrics to force a pass.

## PART 14 — Decision Memory Constitution

Protect Historical decisions · Outcomes · Learning · Success · Failure · Evolution · Timeline. **Never overwrite historical decisions** (append-only; write-once snapshot frozen at FIRST terminal move; ON CONFLICT idempotent).

## PART 15 — Decision Learning Constitution

Decision Intelligence improves through Outcome tracking · Behaviour evolution · Journey progress · Learning/Career/Enterprise results. **Never modify historical evidence.** Binding: LEARNED calibration only from realized outcomes (Hired/Rejected + predicted_prob_at_decision), ≥30 → calibrated.

## PART 16 — Decision Recommendation Constitution

Every recommendation includes Why · Evidence · Confidence · Priority · Alternatives · Trade-offs · Journey/Learning/Career/Life/Subscription impact.

## PART 17 — Decision AI Constitution

**AI explains · recommends · compares · summarizes. AI never becomes the decision maker. AI cannot modify evidence. AI cannot fabricate confidence.** (Cross-ref Phase 1.9 P10 + P16.)

## PART 18 — Enterprise Decision Constitution

Protect Hiring recommendations · Learning recommendations · Promotion guidance · Leadership development · Team decisions · Department insights · Succession planning · Governance · Compliance. **Human approval remains mandatory.** Binding: outputs are developmental signals only — NEVER hiring/promotion/suitability predictions.

## PART 19 — Decision Security Constitution

Protect Decision data · Evidence · Confidence · Recommendations · Trade-offs · Enterprise decisions · Permissions · PII · Consent. Binding: tenant-scope every read; metered identity = server principal (IDOR guard); PII masked in audit artifacts.

## PART 20 — Decision Observability

Monitor Decision engine · Outcome projection · Alternative engine · Trade-off engine · Latency · Failures · Decision/Recommendation/Confidence quality. **Honest gap:** no central decision-observability dashboard; the DORMANCY in P1 is the first signal any such dashboard must surface honestly (0 ≠ healthy).

## PART 21 — Decision Analytics

Protect Decision KPIs · Trends · Success · Adoption · Recommendation adoption · Decision accuracy · Outcome achievement · Behaviour improvement. Binding: adoption is real-human action, never asserted; every unmeasurable rate = null + explicit note.

## PART 22 — Decision Report Constitution

Every decision report contains Decision summary · Evidence · Confidence · Alternatives · Trade-offs · Expected outcomes · Journey/Learning/Career impact · Next actions.

## PART 23 — Decision API Constitution

Protect Decision · Outcome · Recommendation · Alternative · Simulation · Enterprise-decision APIs. **Never duplicate API contracts.** Binding: auth-before-flag ordering (401 unauth → 503 flag-OFF); literal sub-paths before `/:id`.

## PART 24 — Decision Testing Constitution

Standardize Decision-logic · Outcome · Recommendation · Confidence · Evidence · Simulation · Regression tests. Current: simulation harness present (allowed to fail); decision-path e2e largely untested at runtime (GAP — CONDITIONAL ≠ GO).

## PART 25 — Decision Documentation

Maintain Decision · Outcome catalogs + Evidence · Confidence · Simulation · Trade-off · Alternative guides. SSOT: `docs/phase-history.md` (WC-3 Phase Index) + `docs/CAPADEX.md` + `.agents/memory/*`.

## PART 26 — Decision Governance

Every decision enhancement answers: Why is decision changing? · What existing capability is reused? · Does this duplicate WC-3? · Does this improve user outcomes? · Does this preserve explainability? · Does this preserve evidence?

## PART 27 — Decision Quality Gates

Verify Existing WC-3 reused · Orchestrator reused · Evidence exposed · Confidence exposed · Alternatives generated · Trade-offs documented · Explainability complete · Documentation updated.

## PART 28 — Decision Review Board

```
Founder[ ] DecisionArchitect[ ] BehaviourScientist[ ] AIArchitect[ ] ChiefPsychologist[ ]
Enterprise[ ] Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Decision Definition of Done

- [ ] Existing decision engine reused · [ ] WC-3 preserved · [ ] Decision graph preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Alternatives generated · [ ] Trade-offs documented · [ ] Explainability complete · [ ] Human approval preserved · [ ] Documentation updated · [ ] No regressions.

## PART 30 — Decision Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Decision engine (WC-3) | L2 Assisted (structurally present, runtime DORMANT) | L4 Predictive |
| Outcome projection | L2 Assisted (0 realized pairs) | L4 Predictive |
| Decision graph | L3 Explainable (deterministic) | L4 Predictive |
| Alternative engine | L2 Assisted | L3 Explainable |
| Trade-off engine | L2 Assisted | L3 Explainable |
| Decision learning | L1 Operational (calibration empty) | L4 Predictive |
| Decision analytics | L1 Operational | L3 Explainable |
| Decision reports | L2 Assisted | L3 Explainable |
| Enterprise decisions | L2 Assisted (human-approval gated) | L4 Predictive |

Levels: 1 Operational · 2 Assisted · 3 Explainable · 4 Predictive · 5 Autonomous Guidance (Human Approved). **Roadmap:** (separate approved phase) reconcile the SPLIT stage taxonomy → populate the behavioural spine so WC-3 runtime activates → realize {prediction, outcome} pairs to reach k_min and enable LEARNED calibration → wire journey→M5 + decision→subscription/entitlement bridges → decision-observability dashboard (surface dormancy honestly). **Top of maturity is Human-Approved guidance — never fully autonomous.**

## PART 31 — Decision Scientific Validation

Every decision enhancement documents Behaviour basis · Decision theory · Psychological basis · Evidence quality · Confidence model · Bias review · Ethical review · Cultural validation · Population applicability · Decision limitations.

## PART 32 — Decision Evolution Strategy

Future evolution supports New decision/simulation/recommendation models · enterprise decisions · industry frameworks · AI models · behaviour inputs · outcome models — **without breaking** WC-3 · decision engine · Behaviour Intelligence · journey engine · reports · AI. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 33 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Decision Intelligence Constitution | all | 15 | Decision Recommendation Constitution | P16 |
| 02 | Decision Architecture Report | P1 | 16 | Decision AI Constitution | P17 |
| 03 | WC-3 Constitution | P4 | 17 | Enterprise Decision Constitution | P18 |
| 04 | Decision Orchestrator Constitution | P5 | 18 | Decision Security Constitution | P19 |
| 05 | Decision Graph Constitution | P6 | 19 | Decision Analytics Constitution | P21 |
| 06 | Outcome Projection Constitution | P7 | 20 | Decision Report Constitution | P22 |
| 07 | Decision Evidence Constitution | P8 | 21 | Decision API Constitution | P23 |
| 08 | Decision Confidence Constitution | P9 | 22 | Decision Governance Constitution | P26 |
| 09 | Decision Explainability Constitution | P10 | 23 | Decision Quality Gates | P27 |
| 10 | Alternative Engine Constitution | P11 | 24 | Decision Review Board | P28 |
| 11 | Trade-off Constitution | P12 | 25 | Decision Definition of Done | P29 |
| 12 | Decision Simulation Constitution | P13 | 26 | Decision Scientific Validation | P31 |
| 13 | Decision Memory Constitution | P14 | 27 | Decision Evolution Strategy | P32 |
| 14 | Decision Learning Constitution | P15 | 28 | Decision Maturity Assessment | P30 |

---

**STOP — Phase 1.11 complete; Decision Intelligence Constitution ready to FREEZE on approval. WC-3 not modified, no dormant decision components activated, Outcome Projection not replaced, no second decision engine created, decision graph not regenerated, business logic not changed, Behaviour Intelligence not replaced.**
Honesty caveats: counts are MEASURED from the live shared Postgres today — WC-3 **configuration is seeded** (12 outcome models, 5 stage definitions) but its **runtime state tables read 0–4 rows** and `validation_loop_outcomes`/`wc3_outcome_state` read **0**, so the decision engine is structurally present but **operationally DORMANT**. Flag-ON ≠ data-flowing; seeded config ≠ live activation. The SPLIT stage taxonomy (BE 5-stage vs FE `CAP_*` 4-code) and the partial journey→M5 / decision→subscription / entitlement bridges are honest gaps. Activation of the dormant WC-3 chain is a separate, approved phase — NOT performed here.

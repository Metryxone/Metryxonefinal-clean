# CAPADEX 2.0 — Phase 1.19: Decision Intelligence Constitution (WC-3 + Decision Orchestrator)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Decision Intelligence Constitution. **Do not rebuild, do not create a second decision engine, do not replace WC-3, do not create WC-3 V2, do not replace the Decision Orchestrator, do not activate dormant decision capabilities, do not modify business logic, do not bypass Assessment / Behaviour / Conversation / Journey Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Decision Intelligence is the cognitive orchestration layer that turns intelligence into explainable actions. **Decision ≠ Recommendation ≠ Action ≠ Outcome · Prediction ≠ Reality · Simulation ≠ Execution · Evidence ≠ Confidence · Confidence ≠ Accuracy · Potential ≠ Probability · Decision Complete ≠ Successful Outcome · AI ≠ Decision Maker.** flag-ON ≠ runtime-active; built ≠ activated; null ≠ 0. Human remains accountable.
> **Basis:** live WC-3 / decision-orchestrator / outcome / scenario / intervention substrate audit + Phase 1.2–1.18 constitutions + memory (`capadex-decision-orchestration`, `capadex-decision-chain-gaps`, `l5c-runtime-outcome-projection`, `l5d-runtime-journey-projection`, `wc11-decision-intelligence-measurement`, `career-os-orchestration-engines`, `wc7b-activation-intelligence`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.19.

---

## PART 1 — Current Decision Intelligence Audit (MEASURED)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| WC-3 stage chain `wc3_stage_definitions` / `_state` / `_progression` / `_entity_map` | decision spine | **0 / 0 / 0 / 0** | DORMANT |
| WC-3 personalization `wc3_personalization_profile` / `_decisions` | decision spine | **0 / 0** | DORMANT |
| WC-3 longitudinal `wc3_longitudinal_snapshots` / `_trends` | decision spine | **0 / 0** | DORMANT |
| WC-3 outcome `wc3_outcome_models` / `_state` / `_actions` | outcome projection | **0 / 0 / 0** | DORMANT |
| Orchestration logs / failures / performance | orchestrator | `intelligence_orchestration_logs` **0**, `orchestration_failures` **0**, `orchestration_performance_logs` **0** | DORMANT |
| AI decision audits `ai_decision_audits` / `m4_ai_decision_logs` | decision AI | **0 / 0** | DORMANT |
| Scenario engines `m4_simulation_scenarios` / `caf_scenarios` / `eios_scenarios` / `wos_v2_scenarios` | scenario | **0 / 0 / 0 / 0** | DORMANT |
| Intervention engines `rie_interventions` / `capadex_interventions` / `learn_interventions` / `m5_*_intervention_*` | intervention | **0** (all) | DORMANT |
| Outcomes `career_outcomes` / `learn_outcomes` / `rie_outcomes` / `hiring_outcomes` / `interview_outcomes` | outcome | **0** (all) | DORMANT |
| Orchestrator code `services/*orchestrator*.ts` | code | present (assessment-runtime, career-discovery, competency-intelligence, rie-intervention, stage-guidance, ucip, unified-adaptive-runtime) | **BUILT** |

**CRITICAL HONEST FINDING (DERIVED):** the Decision Intelligence layer is **architecturally COMPLETE and broad** — the full WC-3 spine (stage · personalization · longitudinal · outcome) has dedicated tables, there is a family of orchestrator services (assessment-runtime, career-discovery, competency-intelligence, rie-intervention, stage-guidance, ucip, unified-adaptive-runtime), and there are scenario, intervention, outcome, and AI-decision-audit substrates across every domain. **But the decision RUNTIME is entirely DORMANT in this DB: every WC-3 table = 0, every orchestration/scenario/intervention/outcome/AI-decision-audit table = 0.** This is partly **by design** — much of the WC-3 chain (L5C outcome projection, L5D journey projection, WCL pattern/trend) is **compute-on-demand with no persist table** (keyed by `guest_email`/`sessionId` at request time), so emptiness of persisted tables does not by itself prove the engine is broken — but it does prove **no decisions have been computed-and-persisted in this environment, and no realized outcomes exist to calibrate against.** So: vast decision architecture, zero live decision/outcome data — **built ≠ activated, flag-ON ≠ runtime-active, and a populated WC-3 spine requires both a populated behavioural substrate upstream AND realized {prediction, outcome} pairs downstream, neither of which exists here.** Activating the WC-3 runtime (compute + persist decisions, accumulate realized outcomes for calibration) is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** single canonical decision engine (WC-3) with a clear orchestrator boundary; outcome projection is deterministic (Question→BridgeTag→Construct→OutcomeModel) and abstains rather than fabricates; orchestrators COMPOSE existing engines (never recompute); confidence is multi-axis by contract (never one score); AI is advisory-only (never decides autonomously). **Technical debt / GAPS (DERIVED):** WC-3 chain depends on `FF_WC3_OUTCOME_CROSSWALK` + a populated behavioural spine (see `audit/launch-readiness/`); stage taxonomy is SPLIT (backend 5-stage vs frontend CAP_* 4-code — reconcile before stage-keyed UX); journey→M5 growth-plan bridge + decision→subscription mapping + entitlement are the known conductor gaps; two fire-and-forget snapshot builders can RACE (one sole builder required); "decision-driven" must be a provenance check (route_key/source), never a tautology. **Dormant:** entire WC-3 persisted runtime + scenario + intervention + outcome + AI-decision-audit substrates — documented, not activated.

---

## PART 2 — Decision Philosophy

Decision Intelligence exists to Understand · Compare · Evaluate · Prioritize · Recommend · Explain · Guide · Optimize. **It never replaces human judgement, leadership, clinical / legal / hiring decisions, parents, teachers, or managers — it augments humans.**

## PART 3 — Decision Domain Architecture

Domains: Decision Core · WC-3 · Decision Orchestrator · Decision Graph · Decision Intelligence · Outcome Projection · Scenario Intelligence · Intervention Intelligence · Analytics · Reports · AI · Governance. **Every decision capability belongs to ONE domain.**

## PART 4 — WC-3 Constitution

WC-3 remains **the only Decision Intelligence Engine. Never replace WC-3 · never create WC-3 V2 · never duplicate decision orchestration — enhance only.** Protect Decision logic · Decision graph · Decision memory · Decision pipeline · Decision explainability.

## PART 5 — Decision Orchestrator Constitution

Protect Decision flow · Sequencing · Priorities · Dependencies · Routing · Coordination · Completion · Recovery. **Never bypass the Decision Orchestrator.** Binding: orchestrators COMPOSE existing engines, never recompute; one sole idempotent snapshot builder (no racing fire-and-forget builders).

## PART 6 — Decision Graph Constitution

Protect Decision nodes · Relationships · Dependencies · Context · Evolution · Provenance · Timeline.

## PART 7 — Outcome Projection Constitution

Outcome Projection uses Behaviour · Assessment · Journey · Learning · Career · Life · Enterprise · Evidence · Confidence. **It informs; it never guarantees results.** Binding: deterministic Question→BridgeTag→Construct→OutcomeModel; construct-reachable ≠ outcome-reachable; residual DERIVED from projection output, never a broader ontology (over-claim = fabrication); Prediction ≠ Reality.

## PART 8 — Scenario Intelligence Constitution

Support Best case · Expected case · Worst case · Alternative paths · Trade-offs · Risk analysis · Opportunity analysis · Sensitivity analysis. Binding: Simulation ≠ Execution.

## PART 9 — Recommendation Ranking Constitution

Every recommendation evaluates Evidence · Confidence · Behaviour fit · Journey fit · Learning fit · Career fit · Life fit · Enterprise fit. **Never rank using one score.** Binding: per-row feature for per-job modifiers (not a user scalar); map TEXT risk to a bounded penalty or NaN kills the tiebreak.

## PART 10 — Intervention Intelligence Constitution

Protect Behaviour / Learning / Career / Life / Enterprise / Decision interventions · Follow-up plans. Binding: growth-plan EXISTS in M5 (wire, don't rebuild); mentoring catch-all dilutes — keep it explicit.

## PART 11 — Decision Evidence Constitution

Evidence originates from Assessment · Behaviour · Conversation · Journey · Learning · Career · Life · Enterprise · Historical decisions; documents Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 12 — Decision Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Decision quality · Outcome probability · Trust. **Never combine into one metric.** Binding: Confidence ≠ Accuracy; Potential ≠ Probability.

## PART 13 — Decision Explainability Constitution

Every decision explains Why · Evidence · Decision drivers · Behaviour drivers · Confidence · Alternatives · Trade-offs · Limitations · Expected outcomes.

## PART 14 — Decision AI Constitution

**AI explains · compares · forecasts · summarizes · supports. AI never decides autonomously · never overrides governance · never fabricates evidence.** Binding: AI ≠ Decision Maker; human remains accountable. (Cross-ref Phase 1.9.)

## PART 15 — Decision Analytics Constitution

Protect Decision KPIs · Decision quality · Acceptance rate · Completion · Outcome tracking · Intervention success · Decision trends. **Honest gap:** 0 persisted decisions / 0 realized outcomes here → acceptance / outcome / intervention-success rates are unmeasurable (null), never 0.

## PART 16 — Decision Report Constitution

Every report contains Decision summary · Decision graph · Evidence · Confidence · Alternatives · Trade-offs · Recommendations · Expected outcomes · Next actions.

## PART 17 — Longitudinal Decision Constitution

Protect Decision history · Decision evolution · Decision outcomes · Behaviour / Journey / Learning evolution. **Never overwrite historical decisions.** Binding: write-once decision snapshot frozen at FIRST terminal move + ON CONFLICT idempotency.

## PART 18 — Enterprise Decision Constitution

Support Executive · Manager · Leadership decisions · Capability planning · Talent · Learning decisions. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation; AI Recommendation ≠ Employment Decision (Phase 1.16 §18).

## PART 19 — SuperAdmin Decision Constitution

Support Decision rules · Templates · Policies · Outcome models · Scenario models · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 20 — Decision Security Constitution

Protect Decision data · Evidence · Recommendations · Reports · Permissions · Consent · PII · Tenant isolation. Binding: payment/decision verify requires local↔gateway linkage / IDOR guard; PII masked in audit artifacts.

## PART 21 — Decision Observability

Monitor WC-3 · Decision Orchestrator · Decision Graph · Outcome Projection · Scenario Engine · Latency · Failures · Quality. **Honest gap:** `orchestration_failures` / `_performance_logs` = 0 here means never-run, not healthy.

## PART 22 — Decision Testing Constitution

Standardize Decision · Scenario · Outcome · Recommendation · Regression · Performance tests. Binding: a script measuring the composer measures ITS OWN flag state — run with `FF_*=1` and print them; "SELECT-only" is a lie if shared getters run ensure-schema DDL.

## PART 23 — Decision Documentation

Maintain Decision · Scenario · Outcome · Decision-rule catalogs + Decision API guide + Decision analytics guide. SSOT: `docs/phase-history.md` (WC-3 / WC-6 / WC-7 indexes) + `.agents/memory/*`.

## PART 24 — Decision Governance

Every decision enhancement answers: Why is Decision changing? · What existing capability is reused? · Does this duplicate WC-3? · Does this improve decision quality? · Does this preserve Behaviour Intelligence?

## PART 25 — Decision Quality Gates

Verify WC-3 reused · Decision Orchestrator reused · Behaviour reused · Assessment reused · Conversation reused · Journey reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 26 — Decision Review Board

```
Founder[ ] DecisionArchitect[ ] BehaviourScientist[ ] AIArchitect[ ] EnterpriseArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 27 — Decision Definition of Done

- [ ] Existing WC-3 reused · [ ] Decision Orchestrator preserved · [ ] Decision Graph preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Historical decisions preserved · [ ] Documentation updated · [ ] No regressions.

## PART 28 — Decision Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| WC-3 | L2 Guided (built; runtime dormant) | L4 Predictive |
| Decision Orchestrator | L2 Guided (composers built) | L4 Predictive |
| Decision Graph | L1 Operational (empty here) | L3 Intelligent |
| Outcome Projection | L2 Guided (deterministic, compute-on-demand) | L4 Predictive |
| Scenario Intelligence | L1 Operational (substrate empty) | L3 Intelligent |
| Recommendations | L2 Guided (multi-axis, built) | L4 Predictive |
| Analytics | L1 Operational (0 decisions/outcomes) | L3 Intelligent |
| Reports | L2 Guided (canon built) | L4 Predictive |

Levels: 1 Operational · 2 Guided · 3 Intelligent · 4 Predictive · 5 Autonomous Decision Intelligence (**human approval always required**). **Roadmap:** (separate approved phases) populate the upstream behavioural/assessment spine (Phases 1.17–1.18) → compute-and-persist WC-3 decisions → accumulate realized {prediction, outcome} pairs to calibrate (abstain < k_min) → reconcile the SPLIT stage taxonomy → close the conductor gaps (journey→M5 bridge, decision→subscription mapping, entitlement) → keep one sole snapshot builder + multi-axis confidence + AI-advisory-only. **Decision Intelligence augments humans; humans remain accountable.**

## PART 29 — Decision Scientific Validation

Document Decision science · Behavioural economics · Decision theory · Cognitive science · Risk analysis · Operations research · Evidence quality · Bias review · Ethics · Population applicability.

## PART 30 — Decision Evolution Strategy

Future evolution supports New decision / scenario / outcome / intervention / enterprise-decision / AI models — **without breaking** Assessment · Behaviour · Conversation · Journey · Learning · Career · Life · Enterprise Intelligence · WC-3. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Decision Intelligence Constitution | all | 14 | Decision Analytics Constitution | P15 |
| 02 | WC-3 Constitution | P4 | 15 | Decision Report Constitution | P16 |
| 03 | Decision Architecture Report | P1 | 16 | Longitudinal Decision Constitution | P17 |
| 04 | Decision Orchestrator Constitution | P5 | 17 | Enterprise Decision Constitution | P18 |
| 05 | Decision Graph Constitution | P6 | 18 | SuperAdmin Decision Constitution | P19 |
| 06 | Outcome Projection Constitution | P7 | 19 | Decision Governance Constitution | P24 |
| 07 | Scenario Intelligence Constitution | P8 | 20 | Decision Quality Gates | P25 |
| 08 | Recommendation Ranking Constitution | P9 | 21 | Decision Review Board | P26 |
| 09 | Intervention Intelligence Constitution | P10 | 22 | Decision Definition of Done | P27 |
| 10 | Decision Evidence Constitution | P11 | 23 | Decision Scientific Validation | P29 |
| 11 | Decision Confidence Constitution | P12 | 24 | Decision Evolution Strategy | P30 |
| 12 | Decision Explainability Constitution | P13 | 25 | Decision Maturity Assessment | P28 |
| 13 | Decision AI Constitution | P14 | | | |

---

**STOP — Phase 1.19 complete; Decision Intelligence Constitution ready to FREEZE on approval. WC-3 not modified, Decision Orchestrator not replaced, no second decision engine created, no dormant decision capabilities activated, business logic not changed, Assessment + Behaviour + Conversation + Journey Intelligence not bypassed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today. The Decision layer is architecturally COMPLETE (full WC-3 spine: stage / personalization / longitudinal / outcome tables + a family of orchestrator services + scenario / intervention / outcome / AI-decision-audit substrates), but the decision RUNTIME is entirely DORMANT here: **every WC-3 table = 0, every orchestration / scenario / intervention / outcome / AI-decision-audit table = 0.** Much of the WC-3 chain is compute-on-demand (no persist table, keyed at request time), so empty persisted tables don't alone prove breakage — but they DO prove no decisions have been computed-and-persisted and no realized outcomes exist to calibrate against here. A populated WC-3 spine needs BOTH a populated behavioural substrate upstream AND realized {prediction, outcome} pairs downstream — neither exists in this env. Built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Decision ≠ Recommendation ≠ Action ≠ Outcome; Prediction ≠ Reality; AI ≠ Decision Maker; human remains accountable. Activating the WC-3 runtime is a separate, approved phase — NOT performed here.

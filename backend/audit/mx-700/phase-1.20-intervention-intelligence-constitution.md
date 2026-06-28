# CAPADEX 2.0 — Phase 1.20: Intervention Intelligence Constitution (RIE + Intervention Orchestrator)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Intervention Intelligence Constitution. **Do not rebuild, do not create a second intervention engine, do not replace RIE, do not create RIE V2, do not replace the Intervention Orchestrator, do not activate dormant intervention capabilities, do not modify business logic, do not bypass Decision / Journey Intelligence or Growth Plans.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Intervention Intelligence is the execution layer that converts intelligence into measurable action; interventions never exist independently — every one must originate from validated intelligence. **Intervention ≠ Recommendation ≠ Action ≠ Completion · Completion ≠ Behaviour Change · Behaviour Change ≠ Outcome · Outcome ≠ Long-term Success · Execution ≠ Adoption · Evidence ≠ Confidence · Confidence ≠ Effectiveness · AI ≠ Intervention Owner.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains accountable; human choice always prevails.
> **Basis:** live RIE / intervention / follow-up / notification substrate audit + Phase 1.2–1.19 constitutions + memory (`capadex-decision-orchestration`, `capadex-decision-chain-gaps`, `l5d-runtime-journey-projection`, `lbi-architecture-state`, `pil-problem-intelligence-layer`, `career-os-orchestration-engines`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.20.

---

## ⚠️ MEASUREMENT-INTEGRITY CORRECTION (regenerated with exact `COUNT(*)`)

This phase was originally measured with `pg_stat_user_tables.n_live_tup`, which reads 0 for bulk-seeded tables until autovacuum analyzes them (see Phase 1.23 and `.agents/memory/n-live-tup-stale-population-audit.md`). It therefore **under-reported population and wrongly classified live intervention catalogs / RIE runtime as EMPTY / DORMANT.** Honesty cuts both ways — *empty-when-full* is as much a fabrication as *full-when-empty*. This section has been **regenerated with exact `SELECT COUNT(*)`**. Corrected values:

| Table | Was (n_live_tup) | **Now (COUNT\*)** | Correction |
|---|---|---|---|
| `intervention_library` | 0 (EMPTY) | **213** | catalog POPULATED |
| `learn_interventions` | 0 (EMPTY) | **81** | catalog POPULATED |
| `lbi_intervention_library` | 0 (EMPTY) | **20** | catalog POPULATED |
| `rie_recommendations` | 0 (DORMANT) | **3** | RIE HAS run (demo) |
| `rie_interventions` | 0 (DORMANT) | **1** | RIE HAS run (demo) |
| `learn_outcomes` | 0 (DORMANT) | **54** | outcomes recorded |
| `learn_effectiveness` | 0 | **9** | effectiveness recorded |

Genuinely 0 (re-confirmed by exact count): `capadex_interventions`/`capadex_intervention_recommendations`/`capadex_session_interventions`, `pil_intervention_library`, `intervention_memory`, `intervention_approvals`, `m5_coaching_interventions`, `mentor_tasks`/`study_tasks`/`task_variants`, `notifications`/`notification_broadcasts`/`notification_preferences`, `rie_outcomes`, `pil_intervention_outcomes`.

---

## PART 1 — Current Intervention Intelligence Audit (MEASURED, exact COUNT\*)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| RIE engine family `services/rie-*.ts` | code | present (engine · admin · aggregator · intervention-orchestrator · opportunity · recommendation · recovery-intelligence) | **BUILT** |
| RIE recommendations / interventions `rie_recommendations` / `rie_interventions` | runtime | **3 / 1** | **LIVE (demo-scale)** |
| RIE sequences / recovery / escalations / opportunity / outcomes / context | runtime | **0** (all) | DORMANT |
| Intervention engines `intervention-engine.ts` / `intervention-sequencer.ts` / `intervention-learning-engine.ts` | code | present | **BUILT** |
| CAPADEX interventions `capadex_interventions` / `capadex_intervention_recommendations` / `capadex_session_interventions` | runtime | **0 / 0 / 0** | DORMANT |
| Domain intervention libraries `intervention_library` / `learn_interventions` / `lbi_intervention_library` / `pil_intervention_library` | catalog | **213 / 81 / 20 / 0** | **POPULATED (PIL empty)** |
| Intervention memory / approvals `intervention_memory` / `intervention_approvals` | runtime | **0 / 0** | DORMANT |
| Enterprise interventions `m5_coaching_interventions` / `m5_organizational_intervention_recommendations` | runtime | **0 / 0** | DORMANT |
| Follow-up / tasks `mentor_tasks` / `study_tasks` / `task_variants` | runtime | **0 / 0 / 0** | DORMANT |
| Notifications `notifications` / `notification_broadcasts` / `notification_preferences` | engine | **0 / 0 / 0** | DORMANT |
| Outcomes `rie_outcomes` / `pil_intervention_outcomes` / `learn_outcomes` / `learn_effectiveness` | outcome | **0 / 0 / 54 / 9** | **PARTIAL (learning outcomes recorded; RIE/PIL outcomes 0)** |

**CRITICAL HONEST FINDING (MEASURED, exact COUNT\* + DERIVED):** Intervention Intelligence has the **richest engine family in the platform** — a full RIE suite (engine, admin, aggregator, intervention-orchestrator, opportunity, recommendation, recovery-intelligence) plus an intervention-sequencer, an intervention-learning-engine, and per-domain intervention libraries (CAPADEX, PIL, LBI, learning, enterprise). **Contrary to the original n_live_tup measurement, the intervention CATALOGS are PARTIALLY AUTHORED, not empty: `intervention_library`=213, `learn_interventions`=81, `lbi_intervention_library`=20 (only `pil_intervention_library`=0). So there IS content to schedule.** And RIE has **actually run at demo-scale** (`rie_recommendations`=3, `rie_interventions`=1), with learning outcomes/effectiveness recorded (`learn_outcomes`=54, `learn_effectiveness`=9). **What remains genuinely DORMANT is the EXECUTION-and-CLOSURE loop downstream of generation:** every CAPADEX intervention table = 0, intervention memory/approvals = 0, all follow-up/task tables = 0, all notification tables = 0, RIE sequences/recovery/escalation/opportunity/context = 0, and RIE/PIL intervention outcomes = 0. So the honest picture is: **catalogs populated + a handful of RIE recommendations generated, but interventions are NOT yet scheduled, approved, notified, followed-up, or outcome-tracked through the orchestrator.** Generation ≠ execution; library-populated ≠ runtime-active; built ≠ activated; **null ≠ 0** (here several tables are genuinely 0, several are genuinely non-zero — both reported exactly). Activating the full RIE orchestrator (schedule → approve → notify → follow-up → track outcomes → feed the learning-engine) is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** single canonical engine (RIE) with explicit recovery, escalation, and opportunity sub-engines; intervention-learning-engine closes the loop (effectiveness feedback); approvals table enforces human-in-the-loop; sequencer separates trigger/priority/dependency/order; **the catalogs are partially authored (213 + 81 + 20 templates) so the engine has real content to recommend**, and RIE has produced demo-scale recommendations/interventions with learning outcomes recorded. **Technical debt / GAPS (DERIVED):** `pil_intervention_library`=0 (PIL catalog unauthored); the execution-and-closure loop is unexercised (memory/approvals/tasks/notifications/RIE-PIL-outcomes all = 0 → interventions generated but never scheduled, approved, notified, followed-up, or outcome-tracked); notification/reminder engines wired but never fired; growth-plan EXISTS in M5 (wire don't rebuild); mentoring catch-all dilutes (keep explicit); adoption/behaviour-improvement/RIE-effectiveness rates remain unmeasurable at this scale (demo-only → provisional/null, never inflated). **Dormant:** RIE sequencing/recovery/escalation/opportunity runtime + CAPADEX interventions + intervention memory/approvals + follow-up/reminder/notification engines + RIE/PIL intervention outcomes — documented, not activated.

---

## PART 2 — Intervention Philosophy

Interventions exist to Enable · Support · Guide · Reinforce · Improve · Develop · Sustain · Transform. **Interventions never force behaviour; they facilitate positive change. Human choice always prevails.**

## PART 3 — Intervention Domain Architecture

Domains: Intervention Core · RIE · Intervention Orchestrator · Behaviour / Learning / Career / Life / Enterprise Intervention · Notification Engine · Reminder Engine · Follow-up Engine · Analytics · Reports · AI · Governance. **Every intervention capability belongs to ONE domain.**

## PART 4 — RIE Constitution

RIE remains **the only Recommendation & Intervention Engine. Never replace RIE · never create RIE V2 · never duplicate intervention orchestration — enhance only.** Protect Intervention rules · Logic · Pipeline · Memory · Explainability.

## PART 5 — Intervention Orchestrator Constitution

Protect Execution flow · Sequencing · Scheduling · Dependencies · Retry rules · Recovery · Completion · Escalation. **Never bypass the Intervention Orchestrator.**

## PART 6 — Behaviour Intervention Constitution

Support Behaviour reinforcement · Habit formation · Reflection · Behaviour coaching · Practice · Monitoring · Follow-up. **Never recommend interventions without evidence.** Binding: behaviour from evidence only (strengths from CSI positive_factors, never raw concern-signal magnitude).

## PART 7 — Learning Intervention Constitution

Support Courses · Micro learning · Practice · Assessments · Revision · Projects · Learning reinforcement · Certification activities. Binding: `learn_interventions` library empty — populate before scheduling.

## PART 8 — Career Intervention Constitution

Support Career coaching · Interview prep · Resume improvement · Competency / Skill development · Portfolio building · Networking · Career planning. Binding: reuse Career Builder + Resume Studio + interview question bank; don't fork.

## PART 9 — Life Intervention Constitution

Support Lifestyle improvements · Wellbeing · Stress management · Sleep · Nutrition · Exercise · Relationships · Financial literacy · Purpose. Binding: Life Intelligence essentially greenfield (Phase 1.15) — interventions here have no substrate yet; abstain, never fabricate.

## PART 10 — Enterprise Intervention Constitution

Support Leadership development · Learning campaigns · Capability development · Employee wellbeing · Compliance · Manager coaching · Org development. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation; AI Recommendation ≠ Employment Decision.

## PART 11 — Intervention Sequencing Constitution

Every intervention defines Trigger · Priority · Dependencies · Order · Duration · Completion · Review · Next action.

## PART 12 — Follow-up Constitution

Protect Daily · Weekly · Monthly follow-up · Milestone reviews · Goal reviews · Behaviour reviews · Journey reviews. Binding: append-only history (never overwrite).

## PART 13 — Reminder Constitution

Support Notifications · Reminders · Escalations · Missed activities · Re-engagement · Scheduling · Frequency rules. Binding: notification engines wired but never fired here.

## PART 14 — Intervention Evidence Constitution

Evidence originates from Assessment · Behaviour · Conversation · Decision · Journey · Learning · Career · Life · Enterprise · Historical interventions; includes Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 15 — Intervention Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Effectiveness · Completion · Impact · Trust. **Never combine into one metric.** Binding: Confidence ≠ Effectiveness; Completion ≠ Behaviour Change.

## PART 16 — Intervention Explainability Constitution

Every intervention explains Why · Evidence · Expected benefit · Dependencies · Confidence · Alternatives · Trade-offs · Limitations.

## PART 17 — Intervention AI Constitution

**AI explains · schedules · prioritizes · summarizes · supports. AI never executes autonomously · never forces interventions · never fabricates completion.** Binding: AI ≠ Intervention Owner; human remains accountable. (Cross-ref Phase 1.9.)

## PART 18 — Intervention Analytics Constitution

Protect Completion rate · Engagement · Adoption · Drop-offs · Effectiveness · Behaviour / Learning improvement · Career / Life progress. **Honest gap:** 0 interventions here → every rate is unmeasurable (null), never 0; Execution ≠ Adoption.

## PART 19 — Intervention Report Constitution

Every report contains Intervention summary · Completed activities · Pending activities · Evidence · Confidence · Progress · Recommendations · Next steps.

## PART 20 — Longitudinal Intervention Constitution

Protect Intervention history · Behaviour / Learning / Career / Life change · Outcome tracking · Timeline. **Never overwrite intervention history.**

## PART 21 — SuperAdmin Intervention Constitution

Support Intervention templates · Execution rules · Scheduling rules · Notification rules · AI rules · Reports · Analytics · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`; template authoring is the only catalog-changing op.

## PART 22 — Intervention Security Constitution

Protect Intervention data · Evidence · Reports · Notifications · Permissions · Consent · PII · Tenant isolation. Binding: IDOR guard; PII masked in audit artifacts.

## PART 23 — Intervention Observability

Monitor RIE · Orchestrator · Notifications · Scheduling · Failures · Latency · Completion · Quality. **Honest gap:** 0 across the board means never-run, not healthy.

## PART 24 — Intervention Testing Constitution

Standardize Intervention · Scheduling · Notification · Reminder · Workflow · Regression tests.

## PART 25 — Intervention Documentation

Maintain Intervention · Template catalogs + Execution / Reminder / Notification / Analytics guides. SSOT: `docs/phase-history.md` + `.agents/memory/*`.

## PART 26 — Intervention Governance

Every enhancement answers: Why is Intervention changing? · What existing capability is reused? · Does this duplicate RIE? · Does this improve execution quality? · Does this preserve Decision Intelligence?

## PART 27 — Intervention Quality Gates

Verify RIE reused · Decision reused · Journey reused · Growth Plans reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 28 — Intervention Review Board

```
Founder[ ] InterventionArchitect[ ] BehaviourScientist[ ] DecisionArchitect[ ] JourneyArchitect[ ] LearningArchitect[ ] AIArchitect[ ] EnterpriseArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Intervention Definition of Done

- [ ] Existing RIE reused · [ ] Intervention Orchestrator preserved · [ ] Decision preserved · [ ] Journey preserved · [ ] Growth Plans preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Historical interventions preserved · [ ] Documentation updated · [ ] No regressions.

## PART 30 — Intervention Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| RIE | L2 Guided (rich engine; demo-scale runtime — 3 recs / 1 intervention) | L4 Predictive |
| Intervention Orchestrator | L2 Guided (sequencer built; orchestration loop unexercised) | L4 Predictive |
| Behaviour interventions | L2 Guided (`intervention_library`=213 authored) | L4 Predictive |
| Learning interventions | L2 Guided (`learn_interventions`=81 + `learn_outcomes`=54) | L4 Predictive |
| Career interventions | L1 Operational (reuses Career Builder) | L3 Adaptive |
| Life interventions | **L0 Not-Built** (no Life substrate, Phase 1.15) | L2 Guided |
| Enterprise interventions | L1 Operational (`m5_coaching_interventions`=0) | L3 Adaptive |
| Analytics | L1 Operational (demo-scale; rates provisional/null) | L3 Adaptive |
| Reports | L2 Guided (canon built) | L4 Predictive |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Predictive · 5 Continuous Intervention Intelligence (**human approval always required**). **Roadmap:** (separate approved phases) author the intervention LIBRARIES (templates per domain — nothing to schedule until populated) → activate upstream Decision/Journey/Growth-Plan runtime (Phase 1.19) → fire the RIE orchestrator (schedule + notify + follow-up) → track realized intervention outcomes to feed the learning-engine → keep human-approval gates + multi-axis confidence + AI-advisory-only. **Interventions facilitate positive change; human choice always prevails.**

## PART 31 — Intervention Scientific Validation

Document Behaviour-change theory · Habit-formation theory · Motivational psychology · Self-determination theory · Implementation intentions · Learning-transfer theory · Evidence quality · Bias review · Ethics · Population applicability.

## PART 32 — Intervention Evolution Strategy

Future evolution supports New intervention / behaviour / learning / career / wellbeing / enterprise programs · new AI assistants — **without breaking** Assessment · Behaviour · Conversation · Decision · Journey · Learning · Career · Life · Enterprise Intelligence · RIE. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 33 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Intervention Intelligence Constitution | all | 15 | Intervention Explainability Constitution | P16 |
| 02 | RIE Constitution | P4 | 16 | Intervention AI Constitution | P17 |
| 03 | Intervention Architecture Report | P1 | 17 | Intervention Analytics Constitution | P18 |
| 04 | Intervention Orchestrator Constitution | P5 | 18 | Intervention Report Constitution | P19 |
| 05 | Behaviour Intervention Constitution | P6 | 19 | Longitudinal Intervention Constitution | P20 |
| 06 | Learning Intervention Constitution | P7 | 20 | SuperAdmin Intervention Constitution | P21 |
| 07 | Career Intervention Constitution | P8 | 21 | Intervention Governance Constitution | P26 |
| 08 | Life Intervention Constitution | P9 | 22 | Intervention Quality Gates | P27 |
| 09 | Enterprise Intervention Constitution | P10 | 23 | Intervention Review Board | P28 |
| 10 | Intervention Sequencing Constitution | P11 | 24 | Intervention Definition of Done | P29 |
| 11 | Follow-up Constitution | P12 | 25 | Intervention Scientific Validation | P31 |
| 12 | Reminder Constitution | P13 | 26 | Intervention Evolution Strategy | P32 |
| 13 | Intervention Evidence Constitution | P14 | 27 | Intervention Maturity Assessment | P30 |
| 14 | Intervention Confidence Constitution | P15 | | | |

---

**STOP — Phase 1.20 complete; Intervention Intelligence Constitution ready to FREEZE on approval. RIE not modified, Intervention Orchestrator not replaced, no second intervention engine created, no dormant intervention capabilities activated, business logic not changed, Decision + Journey Intelligence + Growth Plans not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (this phase was REGENERATED after an original `n_live_tup` measurement under-reported population — see the Measurement-Integrity Correction above). Intervention Intelligence has the richest engine family (full RIE suite + sequencer + learning-engine + per-domain libraries), and contrary to the original reading the **catalogs are PARTIALLY AUTHORED** (`intervention_library`=213, `learn_interventions`=81, `lbi_intervention_library`=20; only `pil_intervention_library`=0) and **RIE has run at demo-scale** (`rie_recommendations`=3, `rie_interventions`=1; `learn_outcomes`=54, `learn_effectiveness`=9). What is **genuinely DORMANT** is the execution-and-closure loop: CAPADEX interventions, intervention memory/approvals, all follow-up/task tables, all notification tables, RIE sequencing/recovery/escalation/opportunity/context, and RIE/PIL intervention outcomes = 0. So: catalogs populated + a few recommendations generated, but interventions are NOT yet scheduled, approved, notified, followed-up, or outcome-tracked through the orchestrator. Generation ≠ execution; library-populated ≠ runtime-active; built ≠ activated; **null ≠ 0** (both directions — some tables genuinely 0, some genuinely non-zero, each reported exactly). Intervention ≠ Recommendation ≠ Action ≠ Completion; Completion ≠ Behaviour Change; Execution ≠ Adoption; AI ≠ Intervention Owner; human remains accountable. Life interventions are L0 Not-Built (no Life substrate, Phase 1.15). Activating the full RIE orchestrator (schedule → approve → notify → follow-up → track outcomes) is a separate, approved phase — NOT performed here.

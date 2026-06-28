# CAPADEX 2.0 — Phase 1.18: Conversation Intelligence Constitution (Pragati)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Conversation Intelligence Constitution. **Do not rebuild, do not create a second conversation engine, do not replace Pragati, do not create Pragati V2, do not replace the Conversation FSM / Memory, do not activate dormant conversation capabilities, do not modify business logic, do not bypass Assessment / Behaviour / Decision / Journey Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Conversation Intelligence is the living interface connecting every other layer. **Conversation ≠ Chat ≠ LLM ≠ Prompt ≠ Assessment ≠ Therapy ≠ Diagnosis ≠ Decision ≠ Coaching · AI ≠ Human · Context ≠ Memory · Memory ≠ Knowledge · Recommendation ≠ Command · Conversation Complete ≠ User Transformation · Coverage ≠ Confidence.** flag-ON ≠ runtime-active; seeded FSM ≠ active runtime; null ≠ 0. Conversation Safety always overrides AI. Human remains in control.
> **Basis:** live Pragati / conversation substrate audit + Phase 1.2–1.17 constitutions + memory (`merged-task-data-not-in-live-db`, `capadex-clarity-picker-filters`, `adaptive-questioning`, `voice-screening-employer`, `voice-screening-avatar`, `capadex-report-tone-palette`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.18.

---

## PART 1 — Current Conversation Intelligence Audit (MEASURED)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| Pragati engine `routes/pragati.ts` | code | present (13-state FSM · 8 block types · 12-concern ontology · adaptive density · 4-dim quality · crisis-escalation · safety middleware · deterministic fallback) | **BUILT** |
| Pragati sessions `pragati_sessions` | runtime (lazy ensure-schema) | **table not materialized** (never bootstrapped) | DORMANT |
| Conversations `conversations` | runtime | **0** | DORMANT |
| Conversational quality snapshots `conversational_quality_snapshots` | analytics | **0** | DORMANT |
| Conversational assessment sessions `conversational_assessment_sessions` | runtime | **0** | DORMANT |
| Voice / multimodal seams | code (`voice-screening`, `avatarInterview` flags) | flag-gated, AI-inert without keys | BUILT, gated |

**CRITICAL HONEST FINDING (DERIVED):** the Pragati conversational engine is **architecturally BUILT and rich** — `routes/pragati.ts` implements a deterministic 13-state FSM, 8 block types, a 12-concern ontology, adaptive density, a 4-dimension quality score, crisis-escalation + safety middleware, and a deterministic fallback. **But the conversation RUNTIME is entirely DORMANT in this DB:** its primary store `pragati_sessions` (created lazily by the route's ensure-schema) **is not even materialized yet** — it has never been bootstrapped by a live session — and every related table (`conversations`, `conversational_quality_snapshots`, `conversational_assessment_sessions`) = 0. So the conversation layer is **code-complete but never run here — built ≠ activated, seeded FSM ≠ active runtime, and a lazily-created table's absence is itself proof the path has never executed in this environment.** (Consistent with Phase 1.17: the CAPADEX assessment runtime that would feed Pragati is also empty here; merged backfills carry CODE + DDL, not rows.) Bootstrapping Pragati (hit a session-start endpoint to materialize the schema, then run live conversations) is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** single canonical conversation orchestrator (no duplication); FSM is deterministic with explicit escalation/recovery/safe-exit; safety middleware + crisis-escalation override AI; deterministic fallback guarantees the dialogue never hard-fails; voice/avatar modalities are additive, flag-gated, and AI-inert without keys (honest degradation). **Technical debt / GAPS (DERIVED):** runtime never exercised in this DB (no sessions → no analytics → completion/drop-off/clarification/safety-event rates are all unmeasurable = null, not 0); `pragati_sessions` schema only verifiable by triggering the route; prompt registry (Part 26) is a governance requirement to confirm against current inline-prompt usage. **Dormant:** entire Pragati conversation runtime + conversational analytics + multimodal channels — documented, not activated.

---

## PART 2 — Conversation Philosophy

Conversation exists to Understand · Clarify · Guide · Educate · Support · Reflect · Coach · Enable. **Conversation Intelligence never replaces psychologists, doctors, teachers, managers, parents, or leaders — it complements human expertise.**

## PART 3 — Conversation Domain Architecture

Domains: Conversation Core · Pragati · FSM · Memory · Context · Conversation Intelligence · Analytics · Reports · AI · Governance · Security. **Every conversation capability belongs to ONE domain.**

## PART 4 — Pragati Constitution

Pragati remains **the only conversational intelligence platform. Never replace Pragati · never create Pragati V2 · never duplicate conversation orchestration — enhance only.** Protect Conversation engine · Flow · State · Memory · Safety · Explainability.

## PART 5 — Conversation State Machine Constitution

Protect Conversation states · Transitions · Escalations · Interruptions · Recovery · Timeouts · Safe exit · Completion. **The FSM remains deterministic; never introduce hidden transitions.** Binding: 13-state FSM in `routes/pragati.ts`.

## PART 6 — Persona Conversation Constitution

Conversation adapts using Student · Professional · Leader · Founder · Parent · Faculty · Employer · Enterprise · Healthcare · Government · NGO. **Conversation always begins from persona.** Binding: derive adultness from age, not persona key alone (Phase 1.17 §7).

## PART 7 — Concern Conversation Constitution

Conversation adapts using Primary / Secondary concern · Concern relationships · Severity · History · Evolution · Bridge tags. **Never bypass Concern Intelligence.** Binding: 12-concern ontology; concern routing via bridge tags (bucket-level), never fabricate.

## PART 8 — Behaviour Conversation Constitution

Conversation consumes Behaviour signals · Patterns · Graph · History · Evolution · Strengths · Development areas. **Never infer behaviour without evidence.** Binding: strengths from CSI positive_factors only, never raw concern-signal magnitude.

## PART 9 — Adaptive Dialogue Constitution

Dialogue adapts using Behaviour · Assessment · Persona · Concern · Journey · History · Confidence · Clarifications. **Every adaptive response explains WHY.** Binding: adaptive selection rebuilds the pool via the SAME analyze envelope; always falls back deterministically (never 500).

## PART 10 — Conversation Memory Constitution

Protect Session memory · Working memory · Longitudinal memory · User context · Timeline · Memory evolution · Memory provenance. **Never fabricate memory; never overwrite history.** Binding: append-only; compose-only snapshots inherit confidence.

## PART 11 — Context Intelligence Constitution

Context includes Persona · Behaviour · Assessment · Journey · Learning · Career · Life · Enterprise · Environment · Conversation history. **Context is evidence-backed.** Binding: Context ≠ Memory; Memory ≠ Knowledge.

## PART 12 — Conversation Evidence Constitution

Evidence originates from Assessment · Behaviour · Questions · Responses · Journey · Learning · Career · Life · Enterprise · Conversation; documents Source · Timestamp · Coverage · Confidence · Quality. **Never fabricate.**

## PART 13 — Conversation Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Understanding · Completion · Trust. **Never combine into one metric.** Binding: Conversation Complete ≠ User Transformation.

## PART 14 — Conversation Explainability Constitution

Every response explains Why · Evidence · Behaviour drivers · Context · Confidence · Alternatives · Limitations · Next step.

## PART 15 — Conversation Safety Constitution

Protect Crisis detection · Escalation · Safe responses · Human handover · Boundary management · Abuse protection · Sensitive topics · Emergency guidance. **Conversation Safety always overrides AI.** Binding: crisis-escalation + safety middleware in `routes/pragati.ts`.

## PART 16 — Voice & Multimodal Constitution

Support Voice · Text · Documents · Images · Future modalities. **Maintain identical reasoning; modality never changes evidence.** Binding: voice/avatar are additive flag-gated layers (`voiceScreening`, `avatarInterview`) reusing ONE scorer; AI-inert without keys (null ≠ 0).

## PART 17 — Conversation AI Constitution

**AI explains · clarifies · guides · summarizes · reflects. AI never diagnoses · never manipulates · never fabricates evidence · never bypasses governance.** Binding: AI ≠ Human. (Cross-ref Phase 1.9.)

## PART 18 — Conversation Analytics Constitution

Protect Session analytics · Conversation quality · Completion · Drop-offs · Clarification rate · Safety events · Adaptive success · User satisfaction. **Honest gap:** 0 sessions here → every rate is null (unmeasurable), never 0.

## PART 19 — Conversation Report Constitution

Every report contains Conversation summary · Topics · Behaviour context · Evidence · Confidence · Recommendations · Journey link · Next actions. Binding: hopeful/light tone canon shared with CAPADEX reports.

## PART 20 — Longitudinal Conversation Constitution

Protect Conversation history · Behaviour/Journey/Decision/Learning/Life evolution. **Never overwrite conversations.** Binding: append-only.

## PART 21 — Enterprise Conversation Constitution

Support Organizations · Employees · Managers · Leadership · Learning · Coaching · Support. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation.

## PART 22 — SuperAdmin Conversation Constitution

Support Conversation templates · FSM configuration · Prompt registry · Safety rules · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 23 — Conversation Security Constitution

Protect Conversation data · Memory · Evidence · Reports · Permissions · Consent · PII · Tenant isolation. Binding: entitlement/IDOR guards; PII masked in audit artifacts.

## PART 24 — Conversation Observability

Monitor Conversation engine · FSM · Memory · Latency · Failures · Safety events · Quality · AI availability. **Honest gap:** a silent-zero count makes unreadable indistinguishable from empty — surface dormancy honestly (table-not-materialized ≠ healthy).

## PART 25 — Conversation Testing Constitution

Standardize FSM · Dialogue · Memory · Safety · Regression · Prompt · Latency tests. Current: voice-screening degradation tests exist; Pragati FSM tests should assert determinism + no hidden transitions.

## PART 26 — Prompt Registry Constitution

Every prompt must have Owner · Version · Purpose · Dependencies · Evaluation history · Approval · Rollback. **No inline production prompts; registry is mandatory.** (Governance target — confirm against current usage before enforcing.)

## PART 27 — Conversation Governance

Every enhancement answers: Why is Conversation changing? · What existing capability is reused? · Does this duplicate Pragati? · Does this improve conversation quality? · Does this preserve Behaviour Intelligence?

## PART 28 — Conversation Quality Gates

Verify Pragati reused · FSM reused · Memory reused · Behaviour reused · Assessment reused · Journey reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 29 — Conversation Review Board

```
Founder[ ] ConversationArchitect[ ] BehaviourScientist[ ] Psychologist[ ] AIArchitect[ ] PromptEngineer[ ]
Security[ ] Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 30 — Conversation Definition of Done

- [ ] Existing Pragati reused · [ ] FSM preserved · [ ] Memory preserved · [ ] Behaviour preserved · [ ] Assessment preserved · [ ] Journey preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Safety validated · [ ] Documentation updated · [ ] No regressions.

## PART 31 — Conversation Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Pragati | L2 Adaptive (built; runtime dormant) | L4 Predictive |
| Conversation FSM | **L3 Intelligent** (deterministic 13-state, safety/recovery) | L4 Predictive |
| Adaptive dialogue | L2 Adaptive (built, explainable, fallback) | L4 Predictive |
| Conversation memory | L1 Operational (no sessions here) | L4 Predictive |
| Safety | L2 Adaptive (crisis-escalation + middleware) | L4 Predictive |
| Analytics | L1 Operational (0 sessions, rates null) | L3 Intelligent |
| Reports | L2 Adaptive (canon shared) | L4 Predictive |
| Enterprise conversation | L1 Operational (built, dormant) | L3 Intelligent |

Levels: 1 Operational · 2 Adaptive · 3 Intelligent · 4 Predictive · 5 Continuous Conversational Intelligence. **Roadmap:** (separate approved phases) bootstrap `pragati_sessions` by running a live session (materializes the lazy schema) → feed it from the (also-dormant) CAPADEX assessment runtime once seeded → populate conversational analytics from real sessions → formalize the prompt registry (no inline production prompts) → keep FSM determinism + safety-overrides-AI + append-only memory. **Conversation complements human expertise; it never replaces it.**

## PART 32 — Conversation Scientific Validation

Document Conversation theory · Dialogue systems · Behaviour science · Motivational interviewing · Communication theory · Cognitive psychology · Evidence quality · Bias review · Ethics · Population applicability.

## PART 33 — Conversation Evolution Strategy

Future evolution supports New dialogue / AI / modality / persona / concern-domain / enterprise-conversation / language models — **without breaking** Assessment · Behaviour · Decision · Journey · Learning · Career · Life · Enterprise Intelligence · Pragati. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 34 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Conversation Intelligence Constitution | all | 16 | Conversation AI Constitution | P17 |
| 02 | Pragati Constitution | P4 | 17 | Conversation Analytics Constitution | P18 |
| 03 | Conversation Architecture Report | P1 | 18 | Conversation Report Constitution | P19 |
| 04 | FSM Constitution | P5 | 19 | Longitudinal Conversation Constitution | P20 |
| 05 | Persona Conversation Constitution | P6 | 20 | Enterprise Conversation Constitution | P21 |
| 06 | Concern Conversation Constitution | P7 | 21 | SuperAdmin Conversation Constitution | P22 |
| 07 | Behaviour Conversation Constitution | P8 | 22 | Prompt Registry Constitution | P26 |
| 08 | Adaptive Dialogue Constitution | P9 | 23 | Conversation Governance | P27 |
| 09 | Conversation Memory Constitution | P10 | 24 | Conversation Quality Gates | P28 |
| 10 | Context Intelligence Constitution | P11 | 25 | Conversation Review Board | P29 |
| 11 | Conversation Evidence Constitution | P12 | 26 | Conversation Definition of Done | P30 |
| 12 | Conversation Confidence Constitution | P13 | 27 | Conversation Scientific Validation | P32 |
| 13 | Conversation Explainability Constitution | P14 | 28 | Conversation Evolution Strategy | P33 |
| 14 | Conversation Safety Constitution | P15 | 29 | Conversation Maturity Assessment | P31 |
| 15 | Voice & Multimodal Constitution | P16 | | | |

---

**STOP — Phase 1.18 complete; Conversation Intelligence Constitution ready to FREEZE on approval. Pragati not modified, Conversation FSM not replaced, no second conversation engine created, Conversation Memory not replaced, no dormant conversation capabilities activated, business logic not changed, Assessment + Behaviour + Decision + Journey Intelligence not bypassed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today. The Pragati engine is architecturally BUILT (deterministic 13-state FSM, 8 block types, 12-concern ontology, adaptive density, 4-dim quality, crisis-escalation + safety middleware, deterministic fallback) but the conversation RUNTIME is entirely DORMANT here: `pragati_sessions` is **not even materialized** (its lazy ensure-schema has never executed → the path has never run in this env), and `conversations` / `conversational_quality_snapshots` / `conversational_assessment_sessions` = 0. Built ≠ activated; seeded FSM ≠ active runtime; a lazily-created table's absence is proof of non-execution; flag-ON ≠ runtime-active; null ≠ 0. All conversation analytics rates are unmeasurable (null), not 0. Conversation Safety always overrides AI; AI ≠ Human; human remains in control. Bootstrapping/activating the Pragati runtime is a separate, approved phase — NOT performed here.

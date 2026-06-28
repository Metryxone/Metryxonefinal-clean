# CAPADEX 2.0 — Phase 1.17: Assessment Intelligence Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Assessment Intelligence Constitution. **Do not rebuild, do not create a second assessment engine, do not replace the CAPADEX Assessment Engine, do not replace the Question Factory, do not regenerate question banks, do not activate dormant assessment capabilities, do not modify business logic, do not bypass Behaviour / Concern / Competency Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Assessment Intelligence is the FOUNDATION beneath every other layer. **Question Bank ≠ Assessment · Assessment ≠ Report ≠ Diagnosis ≠ Prediction ≠ Recommendation ≠ Decision ≠ Certification · Assessment Completion ≠ Behaviour Understanding · Coverage ≠ Confidence · Evidence ≠ Score · Raw Score ≠ Intelligence · Adaptive ≠ Random · AI ≠ Psychologist.** flag-ON ≠ runtime-active; null ≠ 0. AI never diagnoses, never scores independently, never changes assessment evidence.
> **Basis:** live CAPADEX session / concern / clarity / competency / question-factory substrate audit + Phase 1.2–1.16 constitutions + memory (`question-factory`, `capadex-composite-activation`, `capadex-clarity-picker-filters`, `adaptive-questioning`, `competency-ontology-architecture`, `clarity-bridge-tag-classifier`, `merged-task-data-not-in-live-db`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.17.

---

## PART 1 — Current Assessment Intelligence Audit (MEASURED)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| CAPADEX sessions `capadex_sessions` | runtime spine | **0** | DORMANT |
| CAPADEX responses `capadex_responses` | runtime | **0** | DORMANT |
| CAPADEX reports `capadex_reports` | runtime | **0** | DORMANT |
| Session signal/pattern/composite pipeline `capadex_session_*` | runtime | **0** | DORMANT |
| Concerns Master `capadex_concerns_master` | ontology | **0** (replit.md cites ~2,489 — isolated env) | EMPTY here |
| Clarity Questions `capadex_clarity_questions` | ontology | **0** (replit.md cites ~30,638 — isolated env) | EMPTY here |
| Concern→signal / concern→clarity maps `capadex_concern_*_map` | ontology | **0** | EMPTY here |
| Competency genome `onto_competencies` | competency | **422** | **POPULATED** |
| Competency question templates `competency_question_templates` (Question Factory) | question bank | **2,665** | **POPULATED (DRAFT pipeline)** |
| Competency score runs `onto_competency_score_runs` | competency runtime | **24** | LIVE |
| Interview questions `interview_questions` | bank | **45** | LIVE |
| Pragati / conversation runtime `conversations` | conversation | **0** | DORMANT |
| Other persona/exam banks (`lbi_*`, `spe_*`, `exam_*`, `psychometric_*`, `caf_*`) | banks | **0** | EMPTY here |

**CRITICAL HONEST FINDING (DERIVED):** the Assessment **ENGINE and architecture are comprehensive** (CAPADEX session pipeline `capadex_session_*`, Question Factory `competency_question_templates`, competency genome `onto_*`, 4-tier concern/signal ontology, Pragati conversational runtime, 3-tier clarity picker, adaptive questioning, ~20 distinct question-bank tables across personas), but in **THIS live shared DB the assessment RUNTIME and the concern/clarity ontology are EMPTY**: `capadex_sessions`/`responses`/`reports` = 0, `capadex_concerns_master` = 0, `capadex_clarity_questions` = 0, all `capadex_session_*` pipeline tables = 0. **The populated figures in replit.md (~2,489 concerns, ~30,638 clarity) reflect an ISOLATED/merged environment — merged backfills carry CODE + migration DDL, NOT rows — so they are NOT present in this shared DB.** The **ONLY genuinely live assessment substrate here is the COMPETENCY side**: `onto_competencies` = 422, `competency_question_templates` = 2,665 (Question Factory DRAFT pipeline), `onto_competency_score_runs` = 24, plus `interview_questions` = 45. So: rich engine + rich competency bank, but **CAPADEX concern-assessment runtime is dormant/empty in this environment — built ≠ activated, seeded framework ≠ live consumption, and table-existence ≠ population.** Seeding/activating the CAPADEX concern + clarity ontology and running live sessions is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** Question Factory governance is exemplary (DRAFT-only generation, provenance/confidence/quality_review_status, human approval the ONLY coverage-changing op, retire-archives-never-deletes, AI-inert without key); competency genome richly populated (422 comps, 2,665 templates) with dual scoring ledger; 3-tier clarity picker carries `clarity_source` provenance and never 404s; adaptive `/adaptive-next` rebuilds the pool via the SAME analyze envelope and always falls back to the batch (200, never 500). **Technical debt / GAPS (DERIVED):** CAPADEX concern/clarity ontology empty in this DB (must be seeded — `ensureSignalOntologySchema` creates structure, existence ≠ population); `competency_question_templates.status` locked to {draft,approved} by two conflicting CHECK constraints (lifecycle lives in `quality_review_status`+map.active); clarity join is bucket-level `master_bridge_tag` only (`concern_id` is DISJOINT, 0% join); two `question_type` vocabularies coexist by design (bridged by `mapQuestionType`). **Dormant:** CAPADEX session runtime + concern/clarity ontology + conversation runtime + non-competency persona banks — documented, not activated.

---

## PART 2 — Assessment Philosophy

Assessment exists to **understand** — not to judge, label, or diagnose. Assessment Intelligence exists to Understand · Measure · Clarify · Adapt · Discover · Explain · Guide · Enable. **Every assessment starts a journey; no assessment ends with a report.**

## PART 3 — Assessment Domain Architecture

Domains: Assessment Core · Adaptive · Behaviour · Competency · Concern · Persona · Conversation · Analytics · Reports · AI · Governance. **Every assessment capability belongs to ONE domain.**

## PART 4 — Assessment Conversation Constitution

Assessment is a **conversation** — never a questionnaire, survey, or examination. Every assessment adapts · every question has purpose · every answer influences the next · every conversation remains explainable.

## PART 5 — Question Intelligence Constitution

Protect Question Factory · Templates · Categories · Difficulty · Context · Dependencies · Sequencing · Versioning · Provenance. **Never duplicate Question Factory.** Binding: DRAFT-only generation; human approval is the ONLY coverage-changing op; retire archives, never deletes; lifecycle in `quality_review_status`+map.active (NOT `status`).

## PART 6 — Adaptive Assessment Constitution

Adaptive Assessment uses Behaviour · Responses · Confidence · Clarifications · History · Persona · Concern · Competencies · Journey. **Adaptive logic must always explain WHY the next question was selected.** Binding: `/adaptive-next` rebuilds the pool via the SAME analyze envelope; arm only when no prefill; every failure falls back to the batch (200, never 500). Adaptive ≠ Random.

## PART 7 — Persona Assessment Constitution

Support Student · Professional · Leader · Founder · Parent · Faculty · Institution · Employer · Enterprise · Government · Healthcare · NGO. **Adaptive routing depends on persona; never duplicate assessment pathways.** Binding: derive adultness from age (≥24) not persona key alone; persona SOFT, age HARD (else students dead-end to static fallback).

## PART 8 — Concern Assessment Constitution

Protect Concern Master · Categories · Hierarchy · Dependencies · Signals · Relationships · Bridge Tags · Concern evolution. **Never regenerate Concern Master — extend only.** Binding: `capadex_concerns_master` EMPTY in this DB (seed required); join is bucket-level `master_bridge_tag` (`concern_id` DISJOINT); orphan tags REMAP via hand-verified override, never fabricate.

## PART 9 — Competency Assessment Constitution

Protect Competencies · Competency genome · Competency questions · Relationships · Levels · Benchmarks · Evolution. **Never duplicate competency assessments.** Binding: canonical authority is `onto_*` genome + `competency_question_templates` + competency-runtime scoring (dual ledger); legacy `competency_*` tables are EMPTY shells (reads fall back to `onto_*`); do NOT add parallel namespaces.

## PART 10 — Behaviour Assessment Constitution

Behaviour Assessment measures Traits · Patterns · Signals · Behaviours · Strengths · Development areas · Behaviour graph · Behaviour evolution. **Behaviour originates from evidence; never infer without evidence.** Binding: strengths come ONLY from CSI positive_factors / positive longitudinal growth — NEVER from raw concern-signal magnitude (signals are concern-DIAGNOSTIC).

## PART 11 — Conversation Assessment Constitution

Conversation Assessments support Pragati · Voice · Chat · Interactive sessions · Reflection · Clarification · Follow-up · Multi-session continuity. Binding: Pragati 13-state FSM + crisis-escalation + safety middleware + deterministic fallback; conversation runtime dormant in this DB.

## PART 12 — Assessment Evidence Constitution

Evidence originates from Questions · Responses · Clarifications · Behaviour signals · Competencies · Concern signals · History · Longitudinal memory; always contains Source · Timestamp · Coverage · Confidence · Quality. **Never fabricate.**

## PART 13 — Assessment Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Completion · Reliability · Validity · Trust. **Never combine into one score.** Binding: pg `COUNT()`→strings (`Number()` before compare); Completion ≠ Behaviour Understanding.

## PART 14 — Assessment Explainability Constitution

Every assessment explains Why this question · Why this sequence · Why this concern · Why this competency · Evidence · Confidence · Alternatives · Limitations.

## PART 15 — Assessment Report Constitution

Every report contains Assessment summary · Behaviour summary · Competency summary · Concern summary · Evidence · Confidence · Journey initiation · Recommendations · Next steps. Binding: preview ↔ report share ONE visual canon; tone hopeful/light; Assessment ≠ Report.

## PART 16 — Assessment AI Constitution

**AI explains · clarifies · summarizes · adapts · guides. AI never diagnoses · never scores independently · never changes assessment evidence.** Binding: AI ≠ Psychologist. (Cross-ref Phase 1.9.)

## PART 17 — Assessment Analytics Constitution

Protect Assessment KPIs · Completion · Drop-offs · Adaptive efficiency · Question utilization · Confidence distribution · Assessment coverage · Journey conversion. Binding: every unmeasurable rate = null + note; 0 sessions → 0% honest, never fabricate.

## PART 18 — Longitudinal Assessment Constitution

Protect Assessment history · Behaviour/Competency/Concern evolution · Historical evidence · Progress · Comparison · Timeline. **Never overwrite assessments.** Binding: append-only history (`p4_competency_history`, `m3_*` never mutated in place).

## PART 19 — Assessment Security Constitution

Protect Assessment data · Questions · Responses · Evidence · Reports · Permissions · Consent · PII. Binding: entitlement gate per session (IDOR `sessionParam`); PII masked in audit artifacts; OTP-gated report access.

## PART 20 — Enterprise Assessment Constitution

Support Corporate · University · School · Government · NGO · Leadership · Organization assessments. Binding: k-anonymity ≥30; developmental signals only; human approval gates.

## PART 21 — SuperAdmin Assessment Constitution

Support Question banks · Assessment templates · Assessment rules · Adaptive rules · Question Factory · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`, 60s cache, `?refresh=1`; manual POST always `status='draft'`.

## PART 22 — Assessment Observability

Monitor Assessment engine · Adaptive engine · Question Factory · Completion · Failures · Latency · Confidence · Quality. **Honest gap:** must distinguish unreadable from empty (0 ≠ healthy); surface the empty CAPADEX runtime honestly.

## PART 23 — Assessment Testing Constitution

Standardize Question · Adaptive · Assessment · Behaviour · Competency · Regression tests. Binding: simulation harness is ALLOWED to fail — never tune metrics to force a pass.

## PART 24 — Assessment Documentation

Maintain Assessment · Question · Competency · Concern catalogs + Adaptive logic guide + Assessment API guide. SSOT: `docs/CAPADEX.md` + `docs/COMPETENCY_ASSESSMENT.md` + `.agents/memory/*`.

## PART 25 — Assessment Governance

Every assessment enhancement answers: Why is Assessment changing? · What existing capability is reused? · Does this duplicate assessment logic? · Does this improve assessment quality? · Does this preserve Behaviour Intelligence?

## PART 26 — Assessment Quality Gates

Verify Assessment engine reused · Question Factory reused · Behaviour reused · Competencies reused · Concerns reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 27 — Assessment Review Board

```
Founder[ ] AssessmentArchitect[ ] BehaviourScientist[ ] Psychologist[ ] AIArchitect[ ] QuestionScienceLead[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 28 — Assessment Definition of Done

- [ ] Existing engine reused · [ ] Question Factory preserved · [ ] Behaviour preserved · [ ] Competencies preserved · [ ] Concerns preserved · [ ] History preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Documentation updated · [ ] No regressions.

## PART 29 — Assessment Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Assessment engine (CAPADEX) | L2 Adaptive (built; runtime empty here) | L4 Predictive |
| Adaptive engine | L2 Adaptive (built, byte-identical fallback) | L4 Predictive |
| Question Factory | **L3 Intelligent** (2,665 templates, governed) | L4 Predictive |
| Behaviour assessment | L1 Operational (runtime empty here) | L4 Predictive |
| Competency assessment | **L3 Intelligent** (422 genome, 24 score runs) | L4 Predictive |
| Concern assessment | L1 Operational (ontology empty here) | L4 Predictive |
| Conversation assessment | L1 Operational (Pragati built, dormant) | L3 Intelligent |
| Analytics | L1 Operational (0 sessions) | L3 Intelligent |
| Reports | L2 Adaptive (canon built) | L4 Predictive |

Levels: 1 Operational · 2 Adaptive · 3 Intelligent · 4 Predictive · 5 Continuous Assessment Intelligence. **Roadmap:** (separate approved phases) seed the CAPADEX concern + clarity ontology into this DB (re-run seeds — merged backfills don't reach live) → run live CAPADEX sessions to populate the runtime spine → promote Question Factory drafts via human approval (the only coverage-changing op) → keep adaptive explainability + byte-identical batch fallback + never-overwrite history. **Assessment exists to understand, not to judge.**

## PART 30 — Assessment Scientific Validation

Document Psychometrics · Behaviour science · Cognitive psychology · Educational measurement · Competency theory · Validity · Reliability · Evidence quality · Bias review · Ethics · Population applicability.

## PART 31 — Assessment Evolution Strategy

Future evolution supports New assessment / adaptive / persona / concern-domain / competency / conversation / AI models — **without breaking** Behaviour · Decision · Journey · Learning · Career · Life · Enterprise Intelligence · reports · AI. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 32 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Assessment Intelligence Constitution | all | 14 | Assessment Report Constitution | P15 |
| 02 | Assessment Architecture Report | P1 | 15 | Assessment AI Constitution | P16 |
| 03 | Assessment Conversation Constitution | P4 | 16 | Assessment Analytics Constitution | P17 |
| 04 | Question Intelligence Constitution | P5 | 17 | Longitudinal Assessment Constitution | P18 |
| 05 | Adaptive Assessment Constitution | P6 | 18 | Enterprise Assessment Constitution | P20 |
| 06 | Persona Assessment Constitution | P7 | 19 | SuperAdmin Assessment Constitution | P21 |
| 07 | Concern Assessment Constitution | P8 | 20 | Assessment Governance Constitution | P25 |
| 08 | Competency Assessment Constitution | P9 | 21 | Assessment Quality Gates | P26 |
| 09 | Behaviour Assessment Constitution | P10 | 22 | Assessment Review Board | P27 |
| 10 | Conversation Assessment Constitution | P11 | 23 | Assessment Definition of Done | P28 |
| 11 | Assessment Evidence Constitution | P12 | 24 | Assessment Scientific Validation | P30 |
| 12 | Assessment Confidence Constitution | P13 | 25 | Assessment Evolution Strategy | P31 |
| 13 | Assessment Explainability Constitution | P14 | 26 | Assessment Maturity Assessment | P29 |

---

**STOP — Phase 1.17 complete; Assessment Intelligence Constitution ready to FREEZE on approval. CAPADEX Assessment Engine not modified, Question Factory not replaced, question banks not regenerated, no second assessment engine created, no dormant assessment capabilities activated, business logic not changed, Behaviour + Concern + Competency Intelligence not bypassed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today. The assessment ENGINE/architecture is comprehensive, but in THIS DB the **CAPADEX assessment RUNTIME and concern/clarity ontology are EMPTY** (`capadex_sessions`/`responses`/`reports` = 0; `capadex_concerns_master` = 0; `capadex_clarity_questions` = 0; all `capadex_session_*` = 0). The populated figures in replit.md (~2,489 concerns, ~30,638 clarity) reflect an ISOLATED/merged environment — merged backfills carry CODE + DDL, NOT rows — and are NOT present here; table-existence ≠ population. The ONLY genuinely live assessment substrate here is the COMPETENCY side (`onto_competencies` = 422, `competency_question_templates` = 2,665 DRAFT pipeline, `onto_competency_score_runs` = 24) + `interview_questions` = 45. Built ≠ activated; seeded framework ≠ live consumption; flag-ON ≠ runtime-active; null ≠ 0. Question Bank ≠ Assessment; Assessment ≠ Report/Diagnosis/Prediction; AI ≠ Psychologist. Seeding/activating the CAPADEX runtime is a separate, approved phase — NOT performed here.

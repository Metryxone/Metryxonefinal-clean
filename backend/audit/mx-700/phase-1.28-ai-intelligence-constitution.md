# CAPADEX 2.0 — Phase 1.28: AI Intelligence Constitution (AI Gateway + Model Registry + Prompt Registry + AI Orchestration)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent AI Intelligence Constitution. **Do not rebuild, do not create a second AI engine, do not replace Pragati, do not create AI V2, do not duplicate AI routing/orchestration, do not modify business logic, do not activate dormant AI capabilities, do not bypass any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**); *judgement* = DERIVED. **AI never replaces intelligence; AI augments intelligence; AI never reasons without evidence.** **AI ≠ Intelligence ≠ Human ≠ Decision Maker ≠ Psychologist ≠ Career Counselor ≠ Doctor ≠ Recruiter · Prompt ≠ Knowledge · Response ≠ Truth · Prediction ≠ Fact · Inference ≠ Evidence · Confidence ≠ Accuracy · Coverage ≠ Confidence · Reasoning ≠ Understanding · Model Output ≠ Verified Information · LLM ≠ Source of Truth.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains accountable. Never fabricate; never hallucinate; never estimate unknown facts.
> **Basis:** exact-count audit of the AI substrate + Phase 1.23–1.27 + memory (`question-factory` (AI inert without `OPENAI_API_KEY`), `voice-screening-avatar`, `outcome-intelligence-activation`, `n-live-tup-stale-population-audit`) + Pragati spec (`replit.md`: 13-state FSM, deterministic fallback).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.28.

---

## PART 1 — Current AI Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Repository implementation (code)
| Component | Files | Class |
|---|---|---|
| Pragati conversational runtime | `routes/pragati.ts` · `PragatiWorkspace.tsx` (13-state FSM, 8 block types, crisis-escalation + safety middleware, **deterministic fallback**) | **LIVE (code)** |
| AI Gateway / governance LLM | `services/{ai-governance-llm,ai-governance-v2,ai-governance-scheduler,ai-governance-schema}.ts` · `routes/ai-governance.ts` | **LIVE (code)** |
| AI reasoning / inference | `services/{ai-reasoning-engine,ai-competency-inference-engine}.ts` · `routes/ai-assessment-v2.ts` | **LIVE (code)** |
| M4 AI governance (bias/fairness/drift) | `routes/m4-ai-governance.ts` · `services/m4-ai-governance.ts` | **LIVE (code)** |
| M5 AI coaching | `services/m5-ai-coaching.ts` | **LIVE (code)** |
| Ontology AI rules | `routes/ontology-ai-rules.ts` | **LIVE (code)** |
| External provider seams | OpenAI · Whisper · HeyGen/avatar (voice-screening, avatar interview) | **LIVE (code), inert without `OPENAI_API_KEY`** |

### Database population (exact COUNT\*)
| Component | Table | **Live count** | Class |
|---|---|---|---|
| **AI Gateway model registry** | `aig_models` **4** · `aig_model_configs` **3** | seeded | **SEEDED** |
| **Prompt Registry** | `aig_prompts` **4** · `aig_prompt_versions` **4** | seeded | **SEEDED** |
| Prompt test cases | `aig_prompt_test_cases` | **0** | **EMPTY** |
| AI workflows | `aig_ai_workflows` | **3** | **SEEDED** |
| **M4 AI model registry** | `m4_ai_model_registry` **7** · `model_governance_registry` **5** | seeded | **SEEDED** |
| **AI governance policies** | `m4_ai_governance_policies` | **5** | **SEEDED** |
| **Pragati conversation runtime** | `conversations` **0** · `conversational_assessment_sessions` **0** · `conversational_quality_snapshots` **0** | **0** | **DORMANT** (FSM live, no sessions persisted) |
| AI memory | `ai_assessment_memory` | **0** | **DORMANT** |
| AI reasoning chains | `ai_reasoning_chains` | **0** | **DORMANT** |
| AI inferred competencies | `ai_inferred_competencies` | **0** | **DORMANT** |
| AI decision audits | `ai_decision_audits` | **0** | **DORMANT** |
| AI report generations | `ai_report_generations` | **0** | **DORMANT** (consistent w/ 1.26) |
| AI runtime monitoring | `ai_runtime_monitoring` | **0** | **DORMANT** |
| Ontology AI rules | `ont_ai_rules` **0** · `ont_ai_rule_audit_log` **0** | **0** | **EMPTY** |
| M4 AI runtime logs | `m4_ai_decision_logs` **0** · `m4_ai_observability_logs` **0** · `m4_ai_hallucination_flags` **0** | **0** | **DORMANT** |

### Runtime activation · duplicates · broken routing · unused prompts (explicit, per spec PART 1)
- **Runtime activation:** **DORMANT — the most runtime-inert layer in the entire MX-700 intelligence series.** The configuration/registry layer is seeded (model registries 4 + 7, prompts 4 / versions 4, AI workflows 3, governance policies 5, governance registry 5), but **every single AI *runtime* table reads 0** — conversations, conversational assessment sessions, quality snapshots, AI memory, reasoning chains, inferred competencies, decision audits, report generations, runtime monitoring, observability logs, hallucination flags, AI rules. The AI subsystem is **structurally complete but unexercised**.
- **External gating:** the LLM path is **externally gated on `OPENAI_API_KEY`** (absent in this environment — see `missing_secrets`). OpenAI/Whisper/HeyGen seams are inert without their keys. **Important:** Pragati has a **deterministic fallback** (per `replit.md`), so the conversational runtime can operate without an LLM — yet `conversations`=0 means no sessions (LLM or fallback) have been persisted in this DB.
- **Duplicate AI gateways / prompt systems / model duplication:** model registries exist in **two namespaces** — `aig_models` (AI Gateway, 4) and `m4_ai_model_registry`/`model_governance_registry` (M4 governance, 7/5). Per spec PART 4/6 the canonical gateway is the **AI Gateway (`aig_*`)** and Pragati is the **only** conversational engine; the M4 governance registry is a domain-governance overlay — consolidate the model catalog, never fork the gateway.
- **Broken AI routing:** none observed in code; routing is simply unexercised (no observability/decision logs to inspect).
- **Unused prompts:** `aig_prompts`=4 registered but `aig_prompt_test_cases`=0 → prompts have no evaluation harness data yet.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **AI Intelligence is the textbook built ≠ activated layer — a fully-scaffolded AI stack (Pragati FSM + AI Gateway + dual model registries + prompt registry + governance/observability schema + reasoning/inference engines) with a SEEDED configuration layer and ZERO runtime rows across every conversation, memory, reasoning, decision, report, and observability table.** Unlike Report (1.26, genuinely live) or Analytics (1.27, split live/dormant), AI is structurally present and runtime-dormant in this environment, and is additionally **externally gated on `OPENAI_API_KEY`** which is absent. Two honest nuances preserve fidelity: (1) Pragati's deterministic fallback means the conversational engine is **not** wholly LLM-dependent — yet `conversations`=0 shows it has not run here regardless; (2) the seeded registries (4/7 models, 4 prompts, 5 governance policies) are **configuration, not usage** — they do not imply a single AI call has been made. **No fabrication:** every runtime 0 is reported as DORMANT/EMPTY, never inferred-active from the seeded registry counts; AI safety/observability cannot be claimed effective when `m4_ai_hallucination_flags`/`m4_ai_observability_logs`/`ai_runtime_monitoring`=0 (the controls are coded, not exercised).

**Strengths (DERIVED):** complete AI governance schema (bias/fairness/drift/hallucination/explainability scaffolding present); model + prompt registries exist (no hardcoded models/prompts at the registry level); Pragati safety middleware + deterministic fallback; provider seams isolated and honestly inert without keys. **Technical debt / GAPS (DERIVED):** zero AI runtime/observability data (controls unexercised); no prompt evaluation data; dual model registries (catalog fragmentation); reasoning/memory/inference output unpersisted. **Dormant:** Pragati conversations, AI memory, reasoning chains, inferred competencies, decision audits, AI report generation, runtime monitoring, hallucination/observability logs, AI rules. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — AI Philosophy

AI exists to Assist · Explain · Summarize · Guide · Recommend · Educate · Forecast · Support. **AI never makes autonomous decisions, overrides evidence, creates facts, or invents behaviour / competencies / concerns / reports.**

## PART 3 — AI Domain Architecture

Domains: AI Gateway · Pragati · AI Orchestrator · Model Registry · Prompt Registry · Conversation Memory · AI Evaluation · AI Analytics · AI Monitoring · AI Reports · AI Governance.

## PART 4 — AI Gateway Constitution

AI Gateway remains **the only canonical AI gateway. Never replace it · never create AI Gateway V2 · never duplicate AI routing — enhance only.** Protect Routing · Providers · Models · Fallback · Retries · Observability. Binding: canonical gateway = `aig_*`; M4 governance registry is an overlay — consolidate, never fork.

## PART 5 — Pragati Constitution

Pragati remains **the only canonical conversational intelligence engine. Never replace it · never create Pragati V2.** Protect Conversation · Reasoning · Memory · Safety · Context · State. Binding: 13-state FSM + deterministic fallback + crisis-escalation/safety middleware preserved; `conversations`=0 (runtime dormant, not removed).

## PART 6 — Model Registry Constitution

Protect Model catalog · Provider registry · Capabilities · Limits · Versions · Availability · Fallback priority. **Never hardcode models.** Binding: `aig_models`=4 + `m4_ai_model_registry`=7 seeded; consolidate the catalog.

## PART 7 — Prompt Registry Constitution

Protect Prompt library · Templates · Versioning · Ownership · Metadata · Evaluation · Lifecycle. **Never hardcode prompts.** Binding: `aig_prompts`=4 / `aig_prompt_versions`=4 seeded; `aig_prompt_test_cases`=0 — evaluation harness unpopulated.

## PART 8 — AI Memory Constitution

Protect Conversation · Longitudinal · Session · Context memory · Provenance · Retention · Expiry. **AI memory never becomes source of truth.** Binding: `ai_assessment_memory`=0 (dormant); memory inherits provenance/confidence, never authoritative.

## PART 9 — AI Reasoning Constitution

AI reasoning uses Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Reports · Analytics · Evidence. **AI never reasons without evidence.** Binding: `ai_reasoning_chains`=0 (engine present, unexercised).

## PART 10 — AI Evidence Constitution

Every AI response exposes Evidence · Source · Coverage · Confidence · Quality · Limitations. **Inference ≠ Evidence; Model Output ≠ Verified Information.**

## PART 11 — AI Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Model confidence · Response confidence · Trust. Binding: Confidence ≠ Accuracy.

## PART 12 — AI Explainability Constitution

Every AI output explains Why · Evidence · Reasoning · Alternatives · Confidence · Limitations.

## PART 13 — AI Safety Constitution

Protect Prompt safety · Output safety · PII protection · Consent · Data isolation · **Hallucination prevention** · Human review. Binding: safety controls are CODED but UNEXERCISED (`m4_ai_hallucination_flags`=0) — effectiveness cannot be claimed from presence; crisis-escalation middleware in Pragati preserved.

## PART 14 — AI Evaluation Constitution

Evaluate Accuracy · Groundedness · Completeness · Latency · Cost · Hallucination rate · Prompt quality. Binding: no evaluation data yet (`aig_prompt_test_cases`=0).

## PART 15 — AI Observability Constitution

Monitor Latency · Errors · Failures · Retries · Fallback · Model usage · Prompt usage · Token usage · Cost. Binding: `ai_runtime_monitoring`=0 / `m4_ai_observability_logs`=0 — observability is the first activation lever; a silent-zero must read as "unmeasured", not "healthy".

## PART 16 — AI Analytics Constitution

Protect Usage · Model · Prompt · Conversation · Performance · Cost analytics. **Cross-ref 1.27:** AI analytics share the dormant predictive/observability persistence pattern.

## PART 17 — AI Report Constitution

Protect AI usage · Model · Prompt · Performance · Safety · Evaluation reports. Binding: `ai_report_generations`=0.

## PART 18 — Enterprise AI Constitution

Support Enterprise AI policies · Model approval · Prompt approval · Compliance · Governance. **Human approval required.** Binding: `m4_ai_governance_policies`=5 seeded.

## PART 19 — SuperAdmin AI Constitution

Support Model registry · Prompt registry · AI policies · AI monitoring · AI configuration · Safety rules. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 20 — AI Security Constitution

Protect API keys · Tokens · Models · Prompt data · Conversation data · PII · Tenant isolation · Secrets. Binding: keys via env/secrets only (`OPENAI_API_KEY` absent → AI inert, fail honest, never fabricate); PII masked in artifacts.

## PART 21 — AI Testing Constitution

Standardize Prompt · Model · Routing · Safety · Regression · Performance tests.

## PART 22 — AI Documentation

Maintain Model catalog · Prompt catalog · AI API guide · Safety guide · Evaluation guide. SSOT: `docs/CAPADEX.md` (Pragati) + `.agents/memory/*`.

## PART 23 — AI Governance

Every enhancement answers: Why is AI changing? · What existing capability is reused? · Does this duplicate Pragati? · Does this preserve AI safety? · Does this preserve evidence integrity?

## PART 24 — AI Quality Gates

Verify AI Gateway reused · Pragati reused · Model Registry reused · Prompt Registry reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 25 — AI Review Board

```
Founder[ ] AIArchitect[ ] LLMArchitect[ ] BehaviourScientist[ ] SecurityArchitect[ ] EnterpriseArchitect[ ]
Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 26 — AI Definition of Done

- [ ] Existing AI Gateway reused · [ ] Pragati preserved · [ ] Prompt Registry preserved · [ ] Model Registry preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Safety validated · [ ] Documentation updated · [ ] No regressions.

## PART 27 — AI Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| AI Gateway | L2 Guided (registry seeded, 0 routing logs) | L4 Intelligent |
| Pragati | L2 Guided (FSM live, 0 conversations) | L4 Intelligent |
| Prompt Registry | L2 Guided (4 prompts, 0 test cases) | L4 Intelligent |
| Model Registry | L2 Guided (4 + 7 seeded, dual namespace) | L4 Intelligent |
| AI Memory | L1 Operational (empty) | L3 Adaptive |
| AI Safety | L2 Guided (5 policies coded, 0 hallucination flags) | L4 Intelligent |
| AI Evaluation | L1 Operational (no eval data) | L4 Intelligent |
| AI Monitoring | L1 Operational (0 observability logs) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous AI Intelligence. **Roadmap (separate approved phases):** provision `OPENAI_API_KEY` to lift the external gate (provider seams inert until then) → exercise Pragati (persist conversations; deterministic fallback already works key-less) → populate AI observability/monitoring first (make the safety/hallucination controls measurable, not just coded) → add prompt evaluation harness data → consolidate the dual model registries under the AI Gateway → keep ONE AI Gateway + ONE Pragati, no hardcoded models/prompts, AI-never-without-evidence, hallucination prevention, human accountable.

## PART 28 — AI Scientific Validation

Document LLMs · Retrieval-augmented generation · Prompt engineering · Human-AI interaction · Responsible AI · AI evaluation · Bias review · Ethics · Safety.

## PART 29 — AI Evolution Strategy

Future evolution supports New models · providers · prompt frameworks · memory systems · safety models · AI assistants — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Report · Analytics · Enterprise Intelligence. (Additive + flag-gated; byte-identical flag-OFF; AI inert without keys.)

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | AI Intelligence Constitution | all | 14 | AI Observability Constitution | P15 |
| 02 | Repository AI Audit | P1 | 15 | AI Analytics Constitution | P16 |
| 03 | AI Gateway Constitution | P4 | 16 | AI Report Constitution | P17 |
| 04 | Pragati Constitution | P5 | 17 | Enterprise AI Constitution | P18 |
| 05 | Model Registry Constitution | P6 | 18 | SuperAdmin AI Constitution | P19 |
| 06 | Prompt Registry Constitution | P7 | 19 | AI Governance Constitution | P23 |
| 07 | AI Memory Constitution | P8 | 20 | AI Quality Gates | P24 |
| 08 | AI Reasoning Constitution | P9 | 21 | AI Review Board | P25 |
| 09 | AI Evidence Constitution | P10 | 22 | AI Definition of Done | P26 |
| 10 | AI Confidence Constitution | P11 | 23 | AI Scientific Validation | P28 |
| 11 | AI Explainability Constitution | P12 | 24 | AI Evolution Strategy | P29 |
| 12 | AI Safety Constitution | P13 | 25 | AI Maturity Assessment | P27 |
| 13 | AI Evaluation Constitution | P14 | | | |

---

**STOP — Phase 1.28 complete; AI Intelligence Constitution ready to FREEZE on approval. AI Gateway not modified, Pragati not replaced, no second AI engine created, no dormant AI capabilities activated, business logic not changed, no intelligence engine bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used). **AI is the most runtime-dormant layer in the series** — a fully-scaffolded stack (Pragati FSM + AI Gateway + dual model registries + prompt registry + governance/observability schema + reasoning/inference engines) with SEEDED config (models 4/7, prompts 4, governance policies 5) but ZERO runtime rows across EVERY conversation/memory/reasoning/decision/report/observability table, and externally gated on `OPENAI_API_KEY` (absent here). Pragati's deterministic fallback means it is not wholly LLM-dependent, yet `conversations`=0 shows no sessions ran. Seeded registries are configuration, not usage; safety/hallucination controls are coded but unexercised — effectiveness not claimed from presence. AI augments intelligence, never replaces it; AI never reasons without evidence; LLM ≠ Source of Truth; human remains accountable.

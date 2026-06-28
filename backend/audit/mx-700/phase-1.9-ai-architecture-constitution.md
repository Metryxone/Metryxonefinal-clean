# CAPADEX 2.0 — Phase 1.9: AI Architecture Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent AI Architecture Constitution. **Do not build a new AI system, do not create a second assistant, do not rebuild Pragati, do not modify prompts, do not activate dormant AI, do not rebuild reasoning, do not change business logic.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (repo grep on 2026-06-28); *judgement* = DERIVED. Never assume an AI capability is missing; dormant ≠ deletable; flag-ON ≠ data-flowing; AI-inert (no key) → null + source tag, NEVER 0. **AI augments humans; AI never becomes the decision maker.**
> **Basis:** AI service audit + Phase 1.2–1.8 constitutions + memory (`voice-screening-avatar`, `voice-screening-employer`, `pil-problem-intelligence-layer`, `capadex-decision-orchestration`, `report-factory-engines`, `email-html-xss-escaping`, `secrets-handling-hygiene`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.9.

---

## PART 1 — Current AI Architecture Audit (MEASURED)

| Capability | As-built | Note |
|---|---|---|
| **Pragati** | `routes/pragati.ts` + `PragatiWorkspace.tsx` (3-panel) | THE single conversational companion (13-state FSM, 12-concern ontology, crisis-escalation + safety middleware, deterministic fallback) |
| **LLM call sites** | ~11 files invoke OpenAI/chat-completions | concentrated, not sprawled |
| **Provider env seams** | `OPENAI_API_KEY` (90 refs), `EMERGENT_LLM_KEY` (4), `Gemini` (2), `Anthropic` (2) | multi-provider seams EXIST; OpenAI is primary |
| **Speech** | Whisper transcription (4 files) | employer voice screening |
| **Avatar/video** | HeyGen/avatar (3 files) | live avatar interview (`voice_avatar_*`, Mongo) |
| **Intelligence services** | **39** `*intelligence*` service files | behaviour/career/learning/decision/outcome/trend/etc. |
| **Embeddings / vector search** | not surfaced as a dedicated store | GAP (semantic search is a TARGET) |
| **Safety** | Pragati crisis-escalation + safety middleware | in-flow, not a central moderation gate |

**Strengths (DERIVED):** ONE companion (no assistant sprawl); deterministic-fallback discipline (AI-inert degrades honestly); behaviour-science grounding (AI consumes the Behaviour engine, never replaces it); rich intelligence layer. **Technical debt (DERIVED):** no central **prompt registry/catalog** (prompts inline per service); no central **model router** (provider chosen per call site despite multi-provider env); no AI **observability** (token/cost/latency/prompt-version/quality not centrally tracked); no **evaluation/red-team suite**; embeddings/vector search absent. **Dormant AI:** Decision/WC-3 intelligence flag-ON but no default-path data — DOCUMENT, never activate. **Duplicate prompts/services:** none should be created — extend Pragati + the 39 intelligence services.

---

## PART 2 — AI Philosophy

AI exists to **Understand · Explain · Coach · Guide · Educate · Recommend · Predict · Summarize.** AI **never replaces** behaviour science, psychology, evidence, or human judgement. **AI augments humans; AI never becomes the decision maker.**

## PART 3 — AI Domain Architecture

Domains: Conversation · Behaviour · Assessment · Decision · Journey · Learning · Career · Life · Enterprise · Analytics · Recommendation · Knowledge · Administration intelligence. **Every AI capability belongs to ONE domain.** New AI work extends an existing domain service — never a parallel namespace.

## PART 4 — Pragati Constitution

**Pragati remains the single AI companion.** NEVER create Assistant V2 / Coach V2 / Career AI / Learning AI / Decision AI / Report AI as separate assistants. Everything extends Pragati. Pragati owns: Conversation · Memory · Reasoning · Guidance · Behaviour understanding · Context · Journey awareness · Recommendation · Explainability. **Never bypass Pragati; never introduce parallel AI endpoints.**

## PART 5 — Prompt Architecture Constitution

Every prompt documents Purpose · Owner · Consumers · Inputs · Outputs · Variables · Dependencies · Version · Safety rules · Evaluation rules · Fallback. **Never duplicate prompts — reuse · version · enhance.** **Honest gap:** there is no central prompt registry today (prompts are inline per service); a prompt catalog is a TARGET (P25).

## PART 6 — Context Architecture

AI context contains Persona · Concern · Behaviour · Assessment · Journey · Learning · Career · Life · Enterprise · History · Preferences · Subscriptions · Goals · Permissions. **Context must be ASSEMBLED, never fabricated.** Binding: assemble from real substrate (CSI/behaviour graph/profile); absent data → null marker, never a neutral fallback masquerading as a measurement.

## PART 7 — Memory Architecture

Document Short-term · Long-term · Conversation · Behaviour · Assessment · Journey · Learning · Career · Enterprise memory + Lifecycle · Retention · Expiry · Privacy · Consent. **Never invent memory.** Binding: behavioural memory is DB-backed (`routes/behavioural-memory.ts`), distinct from in-memory `career-memory.ts`; WC-L5 memory snapshot is compose-only (inherits confidence, semantic UPSERT key, fail-closed).

## PART 8 — Reasoning Constitution

Every reasoning chain includes Context · Evidence · Behaviour · Confidence · Alternatives · Explanation · Recommendation · Next step. **Reasoning stays deterministic where possible; AI cannot skip evidence.** Binding: intelligence layers COMPOSE existing engine output, never recompute; a never-throws GET must wrap every reused reader.

## PART 9 — Behaviour Intelligence Constitution

Behaviour Intelligence is the foundation. AI consumes Signals · Patterns · Competencies · Evidence · Confidence · Strengths · Concerns. **AI never bypasses the Behaviour engine.** Binding: strengths ONLY from positive factors (never raw concern magnitude — signals are concern-DIAGNOSTIC).

## PART 10 — Decision Intelligence Constitution (DOCUMENT DORMANT — NO ACTIVATION)

Document Decision context · Evidence · Alternatives · Confidence · Outcome projection · Decision history · Decision explanation. **Document dormant capabilities; no activation.** WC-3/Orchestrator is flag-ON but DORMANT (no default-path data); stage taxonomy SPLIT (BE 5-stage vs FE `CAP_*`). Activation is a separate approved phase.

## PART 11 — Assessment Intelligence Constitution

Protect Adaptive questioning · Assessment guidance · Assessment summary · Behaviour insights · Completion guidance · Journey trigger · AI explanations. Binding: `/adaptive-next` rebuilds the pool via the SAME analyze envelope; AI path inert without `OPENAI_API_KEY` (DRAFT generation only; human approval is the ONLY coverage-changing op).

## PART 12 — Recommendation Constitution

Every recommendation includes Why · Evidence · Confidence · Alternatives · Behaviour factors · Concern factors · Journey impact · Learning impact · Career impact · Subscription impact. Binding: recommendation confidence is deterministic (gap/transferability/mobility); abstain rather than fabricate.

## PART 13 — Explainability Constitution

Every AI output explains Why · How · Evidence · Confidence · Assumptions · Alternatives · Limitations · Sources · **Abstention reasons.** Binding: explainability is mandatory; abstaining below k_min=30 is itself an explained output, never a silent 0.

## PART 14 — Evidence & Confidence Constitution

**Separate** Coverage · Confidence · Evidence · Probability · Trust. Every output exposes Evidence source · Evidence quality · Confidence band · Missing evidence. **No fabricated confidence.** Binding: Coverage (data exists) ⟂ Confidence (trustworthy/sufficient) NEVER composited; calibration RAW (Brier/ECE), borrowed prior never upgrades TRUST, LEARNED only ≥30 outcomes.

## PART 15 — Safety Constitution

Protect against Hallucination · Prompt injection · Jailbreak · Bias · Toxicity · Unsafe advice · Medical/Legal/Financial advice · Self-harm · Crisis escalation · Human review. Binding: Pragati safety middleware + crisis escalation IN PLACE; outputs are developmental signals only — NEVER hiring/promotion/suitability predictions (every envelope ships allowed/disallowed term lists). Treat external/AI text as untrusted (prompt-injection).

## PART 16 — Human-in-the-Loop Constitution

**AI proposes; humans approve.** Enterprise decisions · Clinical interpretations · Hiring decisions · Promotions · Disciplinary actions **never become fully automated.** Binding: question-coverage changes require human approval; employer adoption is real-human action, never AI-asserted.

## PART 17 — AI Observability

Audit Latency · Token usage · Cost · Prompt versions · Failures · Fallbacks · Model usage · Safety events · User feedback · Quality scores. **Honest gap:** none of token/cost/latency/prompt-version/quality is centrally tracked today — all TARGETS. Fallback discipline (degrade on AI-inert) is in place.

## PART 18 — AI Evaluation

Evaluate Accuracy · Consistency · Grounding · Behaviour alignment · Explainability · Recommendation quality · Safety · User satisfaction · Regression. **Honest gap:** no automated eval/grounding/red-team suite today — TARGET.

## PART 19 — AI Security

Protect Prompts · Secrets · Keys · Models · Memory · PII · Enterprise data · Prompt injection · Output filtering. Binding: keys via secrets manager (never to stdout); AI-authored narrative XSS-escaped at interpolation; PII masked in audit artifacts; tenant isolation on every AI read.

## PART 20 — Model Management

Document Model registry · Versioning · Fallback models · Routing · Temperature · Top-P · Max tokens · Streaming · Selection rules. **Honest gap:** no central model registry/router today (params + provider per call site) — TARGET; multi-provider env seams exist.

## PART 21 — Multi-Model Architecture

Support OpenAI · Azure OpenAI · Anthropic · Gemini · Local models · Future models. **Never lock to one provider.** MEASURED: OpenAI primary; `EMERGENT_LLM_KEY`/Gemini/Anthropic seams present but OpenAI-dominant — a provider-abstraction layer is the path to honour this canon.

## PART 22 — AI Feature Flags

Every AI enhancement supports Environment · Tenant · Role · Model · Prompt flags + **Kill switch.** Binding: file-registry default OFF, flag-OFF byte-identical incl. schema; AI-degrading env vars (`OPENAI_API_KEY`) warn loudly at boot preflight, never crash dev.

## PART 23 — AI Performance

Audit Latency · Streaming · Caching · Memory usage · Concurrency · Cost · Scaling · Rate limits. Binding: single JS thread ≈ 1 core (scale horizontally); avatar/voice stream over their own channels; AI calls bounded by provider rate limits.

## PART 24 — AI Testing

Standardize Prompt · Regression · Evaluation-suite · Grounding · Safety · Performance · Hallucination · Red-team tests. Current: voice/avatar degradation test workflows exist; no prompt/grounding/red-team suite (GAP).

## PART 25 — AI Documentation

Maintain Prompt catalog · Model catalog · Reasoning catalog · Memory catalog · Evaluation reports · Safety reports · Architecture · Configuration. SSOT today: replit.md (Pragati + intelligence map) + `docs/CAPADEX.md` + `.agents/memory/*`; prompt/model/eval catalogs are TARGETS.

## PART 26 — AI Governance

Every AI enhancement answers: Why is AI required? · Can existing AI perform this? · Does Pragati already support this? · Does it duplicate prompts? · Does it duplicate reasoning? · Does it improve Behaviour Intelligence? · Does it improve user outcomes? (`FF_AI_GOVERNANCE` exists.)

## PART 27 — AI Quality Gates

Verify Existing AI reused · Pragati reused · Existing prompts reused · Existing reasoning reused · Evidence exposed · Confidence exposed · Safety verified · Evaluation passed · Documentation updated.

## PART 28 — AI Review Board

```
Founder[ ] AIArchitect[ ] BehaviourScientist[ ] Psychologist[ ] Product[ ]
Enterprise[ ] Security[ ] Legal[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — AI Definition of Done

- [ ] Existing AI enhanced · [ ] Pragati enhanced · [ ] No duplicate assistant · [ ] No duplicate prompts · [ ] Behaviour integrated · [ ] Decision integrated · [ ] Journey integrated · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Safety verified · [ ] Evaluation passed · [ ] Documentation updated · [ ] No regressions. (Stacks on API 1.8 / Backend 1.6 DoDs.)

## PART 30 — AI Maturity Model

| Domain | Current (DERIVED) | Target |
|---|---|---|
| Conversation (Pragati) | L4 Reasoning | L5 Behaviour Intelligence |
| Behaviour | L4 Reasoning | L5 Behaviour Intelligence |
| Assessment | L3 Context-aware | L4 Reasoning |
| Decision | L2 Assisted (DORMANT) | L5 (post-activation) |
| Journey | L2 Assisted | L4 Reasoning |
| Learning | L2 Assisted | L3 Context-aware |
| Career | L3 Context-aware | L4 Reasoning |
| Recommendation | L3 Context-aware | L4 Reasoning |
| Enterprise | L2 Assisted | L4 Reasoning |
| Report | L3 Context-aware | L4 Reasoning |

Levels: 1 Operational · 2 Assisted · 3 Context-aware · 4 Reasoning · 5 Behaviour Intelligence. **Roadmap:** central prompt registry + catalog → model router + provider abstraction → AI observability (token/cost/latency/prompt-version/quality) → evaluation/grounding/red-team suite → embeddings/vector search → (separate approved phase) activate Decision Intelligence.

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | AI Architecture Constitution | all | 14 | Safety Constitution | P15 |
| 02 | AI Architecture Report | P1 | 15 | Human-in-the-Loop Constitution | P16 |
| 03 | Pragati Constitution | P4 | 16 | Model Management Constitution | P20 |
| 04 | Prompt Architecture Constitution | P5 | 17 | AI Observability Constitution | P17 |
| 05 | Context Constitution | P6 | 18 | AI Evaluation Constitution | P18 |
| 06 | Memory Constitution | P7 | 19 | AI Security Constitution | P19 |
| 07 | Behaviour Intelligence Constitution | P9 | 20 | AI Testing Constitution | P24 |
| 08 | Decision Intelligence Constitution | P10 | 21 | AI Governance Constitution | P26 |
| 09 | Assessment Intelligence Constitution | P11 | 22 | AI Quality Gates | P27 |
| 10 | Recommendation Constitution | P12 | 23 | AI Review Board | P28 |
| 11 | Explainability Constitution | P13 | 24 | AI Definition of Done | P29 |
| 12 | Evidence Constitution | P14 | 25 | AI Maturity Assessment | P30 |
| 13 | Confidence Constitution | P14 | | | |

---

**STOP — Phase 1.9 complete; AI Architecture Constitution ready to FREEZE on approval. No AI services modified, no new assistant created, Pragati not replaced, no prompts modified, no dormant AI activated, no reasoning rebuilt, no business logic changed.**
Honesty caveats: counts are MEASURED today (Pragati single companion; ~11 LLM call sites; Whisper/HeyGen seams; 39 intelligence services; OpenAI-primary with Gemini/Anthropic/Emergent env seams). A central prompt registry/catalog, model router + provider abstraction, AI observability (token/cost/latency/prompt-version/quality), an evaluation/grounding/red-team suite, and embeddings/vector search **do not exist yet** — they are TARGETS this constitution mandates, not current state. Decision Intelligence is dormant and explicitly NOT activated here.

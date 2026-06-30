# 20 · AI Operating Model Validation

Validates the 10 AI functions from the brief. Evidence: `ai-reasoning-engine.ts`,
`ai-competency-inference-engine.ts`, `runtime-explainability-engine.ts`, `ai-governance-v2.ts`, `aiClient.ts`,
`mei-narrative-engine.ts`.

| AI function | Status | Evidence |
|---|---|---|
| **Observation** | **IMPLEMENTED** | `extractResumeSignals`, `analyzeGithubPayload` (inference engine). |
| **Diagnosis** | **IMPLEMENTED** | `why_inferred`, `readiness_rationale` (reasoning engine). |
| **Recommendation** | **IMPLEMENTED** | `career-recommendation-aggregator` consumed by report-pack. |
| **Prediction** | **DORMANT (by governance design)** | `ai-governance-v2.ts` explicitly flags "suitability prediction" as a violation. |
| **Coaching** | **PARTIAL** | `aiCareerCopilot.ts` exists (frontend/lib); lacks deep backend validation. |
| **Explainability** | **IMPLEMENTED** | `runtime-explainability-engine.ts` `why_weights_assigned`, `appliedModifiers`. |
| **Confidence** | **IMPLEMENTED** | `confidence_reasoning` from `sourceMix` richness; capped 0.95. |
| **Evidence / provenance** | **IMPLEMENTED** | `persistInference` stores `Evidence[]` in `ai_inferred_competencies`. |
| **Personalization** | **IMPLEMENTED** | `appliedModifiers` adjust Role-DNA by role/org context. |
| **Human override** | **IMPLEMENTED** | `applyHumanOverride` logs justification to `human_override_workflows`. |

## The two-layer model (honest)
- **Symbolic / heuristic layer** (`ai-competency-inference-engine.ts`): deterministic, weighted source
  corroboration, confidence-capped — **validated by construction.**
- **Generative LLM layer** (`aiClient.ts`, narrative engines): governed by `validatePolicy` regex to strip
  hiring/promotion verdict language, 503 fail-fast on unavailability — **safe but UNVALIDATED.**

## Critical honesty findings
- **There is NO AI accuracy / hallucination / quality measurement engine for the LLM layer.** Safety is
  enforced by a *policy regex guard*, not by measured correctness. "Existing AI ≠ intelligent customer
  experience" — exactly the contract's warning. (→ GAP-AI1)
- **Prediction is deliberately DORMANT** — governance blocks suitability prediction. This is a *responsible*
  design choice (no unaccountable verdicts), correctly reported as dormant-by-design, not missing-by-accident.
- **Override + evidence + explainability + confidence form a genuine accountable-AI spine** — a real strength
  and an enterprise differentiator.
- **No accuracy claim is fabricated** anywhere — the platform consistently degrades honestly (`null` source
  tags, AI-inert without `OPENAI_API_KEY`).

## Verdict
**AI operating model: ACCOUNTABLE & SAFE; NOT YET VALIDATED.** 8/10 functions IMPLEMENTED, 1 PARTIAL
(coaching), 1 DORMANT-by-design (prediction). The single most important AI enhancement before any
"intelligent" maturity claim is an **AI quality/accuracy harness** for the LLM layer (GAP-AI1). Until then, AI
maturity is **Managed, not Intelligent.**

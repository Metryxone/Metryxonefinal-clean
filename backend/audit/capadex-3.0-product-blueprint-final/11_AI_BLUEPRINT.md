# 11 · AI Blueprint

ONE AI operating model. Defines the 10 canonical AI functions, the two-layer architecture, the accountability
spine, and the single critical gap. Promotes Operating-Model (`20`) to blueprint depth. Governing principle:
**AI assists, humans decide** (maturity ceiling Managed/L3).

## Canonical AI functions (FROZEN)
| AI function | Status | Evidence |
|---|---|---|
| **Observation** | IMPLEMENTED | `extractResumeSignals`, `analyzeGithubPayload` (inference engine) |
| **Diagnosis** | IMPLEMENTED | `why_inferred`, `readiness_rationale` (reasoning engine) |
| **Recommendation** | IMPLEMENTED | `career-recommendation-aggregator` → report-pack |
| **Prediction** | **DORMANT (by governance design)** | `ai-governance-v2.ts` flags suitability prediction as a violation |
| **Coaching** | **PARTIAL** | `aiCareerCopilot.ts` (frontend/lib); no deep backend validation |
| **Explainability** | IMPLEMENTED | `runtime-explainability-engine.ts` (`why_weights_assigned`, `appliedModifiers`) |
| **Confidence** | IMPLEMENTED | `confidence_reasoning` from sourceMix richness; capped 0.95 |
| **Evidence / provenance** | IMPLEMENTED | `persistInference` stores `Evidence[]` in `ai_inferred_competencies` |
| **Personalization** | IMPLEMENTED | `appliedModifiers` adjust Role-DNA by role/org context |
| **Human override** | IMPLEMENTED | `applyHumanOverride` logs justification to `human_override_workflows` |

## Two-layer architecture (canonical)
- **Symbolic / heuristic layer** (`ai-competency-inference-engine.ts`): deterministic, weighted source
  corroboration, confidence-capped — **validated by construction.**
- **Generative LLM layer** (`aiClient.ts`, narrative engines): governed by `validatePolicy` regex that strips
  hiring/promotion verdict language; 503 fail-fast on unavailability — **safe but UNVALIDATED for accuracy.**

## Accountability spine (the differentiator)
`Observe → Diagnose → Recommend → Explain → Confidence → Evidence → Override → Govern.` Override + evidence +
explainability + confidence together form a genuine **accountable-AI spine** — a real enterprise differentiator.

## Critical honesty findings (FROZEN)
- **No AI accuracy / hallucination / quality measurement engine for the LLM layer.** Safety is a *policy regex
  guard*, not measured correctness. "Existing AI ≠ intelligent customer experience." → **GAP-AI1** (forward
  work: an AI quality/accuracy harness).
- **Prediction is deliberately DORMANT** — governance blocks suitability prediction. Responsible design (no
  unaccountable verdicts), reported as dormant-by-design, NOT missing-by-accident.
- **No accuracy claim is fabricated** anywhere — AI degrades honestly (null source tags; inert without
  `OPENAI_API_KEY`).

## Canonical decisions (FROZEN)
1. **AI assists, humans decide** — no autonomous verdicts; override authoritative.
2. **Prediction stays dormant** until governance + an accuracy harness justify activation.
3. The single most important AI enhancement before any "Intelligent" maturity claim is the **AI
   quality/accuracy harness** (GAP-AI1).

## Verdict
**ONE AI model: ACCOUNTABLE & SAFE; NOT YET VALIDATED. FROZEN.** 8/10 IMPLEMENTED, 1 PARTIAL (coaching),
1 DORMANT-by-design (prediction). AI maturity = **Managed, not Intelligent**, until GAP-AI1 closes.

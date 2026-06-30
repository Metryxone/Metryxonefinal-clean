# 6 · AI Enhancement Matrix

Measured: 8 OpenAI + 4 EMERGENT_LLM integrations, 27 key-guard sites. AI is **integrated with strong honesty
engineering** (source tags, confidence, evidence, anti-fabrication prompts, abstain null≠0). Enhancements are
about **validation, consistency, and depth — not adding new AI.**

## Current strengths (preserve — do not regress)
- **Source tagging:** outputs carry `source: rule-based | ai | static-library` + `aiAvailable:false`.
- **Honest degradation:** rule-based fallbacks (Employability Studio, Career Discovery); clean 503
  (`AIServiceUnavailableError`).
- **Abstain:** voice screening returns `overallScore: null`, never fake 0.
- **Explainability in UI:** evidence snippets with source tags (`CareerBuilderPage` `[resume] "…"`),
  confidence pills (quality_tier A–D), "N hits across M sources", 95% confidence intervals (`±2.1 EI`).
- **Anti-fabrication:** JSON-mode prompts forbid invention; `runLlmHallucinationCheck` compares output vs
  source data; deterministic authored fallbacks for live avatar questions.

## Enhancement opportunities
| ID | Enhancement | Repository evidence | Customer/Enterprise impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| AIE-1 | **Consistent degradation:** give `aiTestGenerator.ts:204` a rule-based fallback or clean 503 (today hard-fails without a key, unlike peers) | `services/aiTestGenerator.ts` | reliability; no cryptic failures | low | S | **High** |
| AIE-2 | Normalize `replit_integrations/audio/client.ts` hardcoded `"missing"` key → clean 503 | `replit_integrations/audio/client.ts` | clean error UX | low | S | Medium |
| AIE-3 | **AI quality measurement harness** — capture accuracy/agreement/hallucination-rate during pilot; surface as a governed metric (AI governance tables already exist: `aig_workflow_runs`, hallucination_score) | `services/ai-governance-llm.ts`, `ai-governance-v2.ts` | **enterprise trust** — converts "validated?" from null to measured | medium | M | **High** |
| AIE-4 | Surface **confidence + evidence consistently across ALL AI surfaces** (already excellent in Career/Employability; audit that every AI output — coach, test-gen, voice, governance — carries source/confidence/evidence) | UX explainability findings | uniform trust signals | low | M | Medium |
| AIE-5 | **Prompt/version provenance** in every AI output (model + prompt version embedded, like voice `provenance`) for auditability | `voice-screening-engine.ts` pattern | reproducibility, enterprise audit | low | M | Medium |
| AIE-6 | **Cost/latency guardrails** — timeouts + budget caps on network-bound LLM calls; exercise the 503/abstain paths under load | performance findings | cost control, resilience | medium | M | Medium |
| AIE-7 | **Personalization depth audit** — verify AI personalization keys on real per-entity features (not coarse buckets); memory records prior "looks the same for every X" traps | memory: assessment-preview-personalization | perceived intelligence | low | M | Medium |

## Honest non-goals (do NOT do)
- Do **not** add autonomous/unreviewed AI action — maturity ceiling is **Managed (human approval
  authoritative)**; Self-Optimizing is explicitly out of scope.
- Do **not** claim AI accuracy now — it is **unmeasurable pre-traffic** (`null`). AIE-3 makes it measurable.

## AI enhancement summary
The AI layer is **safe and transparent today** but **unvalidated for quality** (no usage). The two highest-
value moves are **AIE-1** (consistency fix, trivial) and **AIE-3** (a quality-measurement harness using the
governance tables that already exist) — both enhancement-only, no new AI engine.

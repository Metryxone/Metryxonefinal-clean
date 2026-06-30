# 6 · AI Readiness Report

Measured: 8 files reference OpenAI, 4 reference EMERGENT_LLM, **27 `OPENAI_API_KEY` guard sites**. Verdict:
**AI is integrated responsibly with honest degradation and provenance** — strong for launch, with a few
consistency gaps.

## Where AI is used
| Capability | Service | Model / mechanism |
|---|---|---|
| Voice screening | `voice-screening-engine.ts` | OpenAI Whisper (`gpt-4o-mini-transcribe`) + chat rubric scoring |
| Resume / LinkedIn / interview critique | `routes/employability-studio.ts` | OpenAI chat (JSON mode) |
| Career discovery coach | `services/career-discovery-guidance.ts` | OpenAI chat |
| AI test / MCQ generation | `services/aiTestGenerator.ts` | OpenAI chat |
| AI governance (audit other AI) | `services/ai-governance-llm.ts`, `ai-governance-v2.ts` | LLM hallucination/rubric checks |

## Honest degradation (strong)
- **Rule-based fallbacks** exist for Employability Studio (`analyzeResumeRuleBased`) and Career Discovery
  (`ruleBasedCoach`) — deterministic heuristics when no key.
- **Source tagging:** outputs carry `source: 'rule-based' | 'ai' | 'static-library'` and `aiAvailable: false`
  (e.g. `employability-studio.ts:178`).
- **Clean unavailability:** `aiClient.ts` throws `AIServiceUnavailableError` → HTTP **503** rather than
  fabricating.
- **Abstention (null ≠ 0):** voice screening returns `overallScore: null` when no transcript — never a
  fake `0` (`voice-screening-engine.ts:182`).

## Explainability & grounding (strong)
- **Provenance:** voice reports embed `provenance: 'openai:gpt-4o-mini-transcribe + chat-rubric'`.
- **Confidence:** AI governance tracks `confidence` and `hallucination_score` in `aig_workflow_runs`.
- **Anti-fabrication prompts:** JSON-mode system prompts explicitly forbid invention ("Never invent
  achievements the resume does not contain").
- **Hallucination checker:** `runLlmHallucinationCheck` compares output vs `sourceData` and flags
  discrepancies.
- **Deterministic scaffolding:** live avatar interview falls back to *authored* questions verbatim if the LLM
  fails — continues honestly without model drift.

## Inert/dormant without keys (expected)
- Voice screening → 503 `VoiceAIUnavailable`.
- AI governance LLM audit → regex/rule-based fallback.
- AI test generation → **hard fail** (no fallback) — see gap below.

## Gaps (honest)
| ID | Gap | Severity | Fix |
|---|---|---|---|
| AI-1 | `aiTestGenerator.ts:204` has **no rule-based fallback** — hard-fails without a key, unlike peer services | MEDIUM | add honest fallback or clean 503 |
| AI-2 | `replit_integrations/audio/client.ts` hardcodes key `"missing"` → cryptic 401 vs clean 503 | LOW | normalize to 503 unavailability |
| AI-3 | No live AI **accuracy/quality** measurement — cannot exist pre-traffic | (axis) | measure during pilot; do not claim accuracy now |

## AI readiness verdict
- **Integration & safety: READY.** Honest degradation, provenance, confidence, anti-fabrication grounding are
  all present and consistent across the major surfaces.
- **AI accuracy/outcome quality: UNMEASURABLE today** (no production usage). Report as `null`, not a score.
- Two small consistency fixes (AI-1, AI-2) recommended before GA; neither is launch-blocking.
- **Operational prerequisite:** `OPENAI_API_KEY` (and/or `EMERGENT_LLM_KEY`) must be set in prod, or all AI
  features degrade to rule-based/503 (honest but reduced).

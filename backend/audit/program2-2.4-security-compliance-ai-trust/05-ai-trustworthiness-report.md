# 05 · AI Trustworthiness Report

## Findings (file-cited)
| Property | Status | Evidence |
|---|---|---|
| Explainability — reasoning chains | **PRESENT** | `backend/services/ai-reasoning-engine.ts` — `why_inferred`, `confidence_reasoning`, `readiness_rationale`; persisted to `ai_reasoning_chains`. |
| Recommendation evidence | **PRESENT** | `behavioral_evidence[]` with `source`/`signal`/`weight`; each inferred level cites its source substrate. |
| Recommendation traceability | **PRESENT** | Provenance via `route_key`/source substrate; reasoning persisted per recommendation. |
| Confidence scores | **PRESENT** | 0..1 floats; honesty contract degrades absent data to `null` never `0` (`outcome-intelligence-engine.ts`). |
| Confidence calibration | **PRESENT** | `validation-loop-engine.ts` computes Brier + ECE; `VALIDATION_K_MIN = 30`; empirical accuracy **ABSTAINED** until ≥30 realized outcome pairs; `predicted_prob_at_decision` is the decision-time field. |
| Hallucination controls | **PRESENT** | OMEGA-X `safety-layer.ts` — "never diagnose", catastrophic-phrasing rewrite; `developmental-sanitizer.ts` strips predictive/hiring claims. |
| Prompt validation | **PRESENT** | Structured `chatJSON` with system/user role separation (`aiClient.ts`); output sanitizer walks payloads. |
| Prompt-injection protection | **PARTIAL** | Role separation + output sanitizer mitigate; **no dedicated input-side adversarial-injection filter** on user/CV free-text entering prompts → AI-M1. |
| Human review support (HITL) | **PRESENT** | `review-workbench.ts`; safety-layer "referral" escalates to counsellors; decision/outcome engines are read-only SUPPORT (never auto-execute). |
| AI audit trail | **PRESENT** | `ai_reasoning_chains` + `confidence_calibration_logs` (user_id, competency_id, confidence, source_coverage, decay_factor, engine_version). |
| AI service resilience | **PRESENT** | `aiClient.ts` `checkAIHealth` 3s timeout → `AIServiceUnavailableError` → 503; no silent fabrication when provider down. |

## Assessment
AI trustworthiness is **structurally strong**: recommendations are explainable, evidence-linked, traceable, honestly confidence-scored, calibrated with a principled abstention gate, guardrailed by a safety layer, and backed by a human-in-the-loop path and an audit trail. The one hardening item is **input-side prompt-injection defense** (AI-M1). 

**Adoption / measurement axes (reported separately — NOT gaps):** calibration honestly abstains until k_min=30 realized pairs accrue (cold-start), and AI provider keys are unset in this environment so live inference behavior is unmeasured here (503 fail-fast). These are data/adoption axes, never counted as engineering gaps.

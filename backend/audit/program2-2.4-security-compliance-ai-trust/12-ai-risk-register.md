# 12 · AI Risk Register (AI Trustworthiness + Responsible AI)

Severity axis independent from Security and Compliance. No composited scores.

## Launch-Critical — 0
None. Recommendations are explainable, evidence-linked, confidence-honest, guardrailed, and never auto-executed.

## High — 0
None.

## Medium — 2
| ID | Risk | Evidence | Recommended action (needs approval) |
|---|---|---|---|
| **AI-M1** | **Prompt-injection input hardening** — user/candidate free-text (CV text, narratives) enters LLM prompts; mitigated by system/user role separation + output sanitizer, but no dedicated input-side adversarial-injection filter. | `aiClient.ts` (chatJSON), `developmental-sanitizer.ts` (output-side) | Add an additive input-side injection guard (delimiter/marker stripping, instruction-override detection) before user text reaches prompts; reuse sanitizer patterns. |
| **AI-M2** | **Fairness monitoring operationalization** — fairness/bias engines exist but a monitoring cadence with published fairness metrics on real cohort volume is not evidenced (structural-present / operational-adoption split). | `fairness-monitoring-engine.ts` (+v2), `fairness-governance-engine.ts`, `m4-fairness.ts` | Wire a periodic fairness report surfaced in governance console (read-only); no scoring change. |

## Low — 2
| ID | Risk | Evidence | Recommended action |
|---|---|---|---|
| **AI-L1** | **Hallucination controls are rule/pattern-based** (safety-layer) — no model-graded groundedness/factuality check on free-form narratives. | `safety-layer.ts` | Optional groundedness check against source substrate for AI narratives. |
| **AI-L2** | **AI audit-trail retention & HITL linkage** — reasoning/calibration logs present; ensure retention + explicit linkage to human-review outcomes for full traceability. | `ai_reasoning_chains`, `confidence_calibration_logs`, `review-workbench.ts` | Link reasoning chains ↔ review outcomes; define retention (ties to CMP-M2). |

## Future — 1
| ID | Risk | Recommended action |
|---|---|---|
| **AI-F1** | Adversarial red-teaming harness for AI outputs + published model/system card documentation. |

**Adoption / measurement axes (NOT gaps):**
- Calibration honestly **abstains** (Brier/ECE null) until `k_min=30` realized outcome pairs accrue — correct cold-start behavior, reported as a data axis.
- AI provider keys unset in this environment → live inference behavior unmeasured (503 fail-fast); a measurement limitation, not a gap.

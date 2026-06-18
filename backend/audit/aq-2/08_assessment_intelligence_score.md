# CAPADEX AQ-2 — Updated Assessment Intelligence Score

> Generated 2026-06-04T07:44:42.778Z · bank `capadex_clarity_questions` · 30638 questions · additive layer `capadex_question_metadata` (provenance `aq2_reconstruction`). NOT wired into runtime.

### Score
| Metric | AQ-1 baseline | AQ-2 reconstruction | Δ |
|---|---:|---:|---:|
| Metadata coverage score | 36.4% | **92%** | +55.6 |
| Mean Question Intelligence Score | — | **51.1** | — |
| Confidence depth score | — | **55.7** | — |
| **Assessment Intelligence Score** | **57.2** | **73.9** | **+16.7** |

### Method
- **Question Intelligence Score** (per question) = mean of the six dimension confidences × 100.
- **Assessment Intelligence Score (AQ-2)** = 0.5 × coverage-breadth + 0.5 × confidence-depth (both 0–100).
- The AQ-1 baseline (57.2) used a different alignment-weighted formula; the Δ is **directional** — the per-dimension coverage deltas (deliverables 02–07) are the rigorous, like-for-like comparison.

### Honesty notes
- All numbers measured at runtime over 30638 questions; ungrounded tags / absent ontology rows are left unassigned, never fabricated.
- Signal & behavior reach is capped by WC-1B grounding (≈55.8% of questions under grounded tags) — an honest ceiling, not a defect of this reconstruction.
- Age, Persona and Stage are reconstructed from per-question content the bank already carries; they resolve AQ-1 ambiguity but inherit the underlying ontology's age spread (reflected in lower confidence, not hidden).

**STOP — awaiting approval.** The metadata layer is additive and reversible (`DELETE FROM capadex_question_metadata WHERE provenance='aq2_reconstruction';`). No runtime wiring, no scoring/report change, no deploy.

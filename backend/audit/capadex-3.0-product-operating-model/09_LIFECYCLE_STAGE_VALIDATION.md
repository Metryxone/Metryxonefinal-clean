# 09 · Lifecycle Stage Validation

Validates the canonical lifecycle stages against the brief's checklist (purpose, entry, exit, activities,
assessments, AI, reports, capabilities, progression, outcomes, success-metrics).

## Canonical stages (evidence: `CANONICAL_STAGE_ORDER`, `services/wc3/stage-intelligence.ts`)
| Stage | Code | Weight | UI-exposed |
|---|---|---|---|
| Awareness | — | 0.25 | No (pre-assessment / pre-purchase state) |
| Curiosity | CAP_CUR | 0.50 | Yes |
| Clarity (Insight) | CAP_INS | 0.75 | Yes |
| Growth | CAP_GRW | 1.00 | Yes |
| Mastery | CAP_MAS | 1.25 | Yes |

FE exposes a **4-stage commercial journey** (Curiosity/Insight/Growth/Mastery); BE carries a **5th implicit
Awareness** stage. This is a documented exposure seam (memory: capadex-decision-chain-gaps).

## Per-stage validation
| Component | Awareness | Curiosity | Clarity | Growth | Mastery |
|---|---|---|---|---|---|
| **Purpose defined** | ◐ implicit | ✅ pattern ID | ✅ root-cause/gaps | ✅ awareness→action | ✅ full profile |
| **Entry criteria (hard, in code)** | ✗ | ✗ | ✗ | ✗ | ✗ — all monetization-gated, not score-gated |
| **Exit criteria (hard, in code)** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Activities** | ✗ | ✅ 10-Q behavioural | ✅ 10-Q calibrated | ✅ 30-day plan + intervention map | ✅ 19-domain + debrief |
| **Assessments** | ✗ | ✅ | ✅ | ◐ (plan, not a re-test) | ✅ |
| **AI** | ◐ | ✅ | ✅ | ✅ | ✅ |
| **Reports** | ✗ | ✅ | ✅ | ✅ | ✅ |
| **Capabilities** | ◐ | ✅ | ✅ | ✅ | ✅ |
| **Progression rule** | derived | derived (index+1) | derived | derived | terminal |
| **Outcomes** | ✗ | ◐ | ◐ | ◐ | ◐ |
| **Success metrics** | ✗ | ◐ | ◐ | ◐ | ◐ |

## Findings (honest)
- **Stages are clearly defined, measurable in weight, and universal** across personas — a real strength.
- **The single systemic weakness: no stage has hard, code-enforced entry/exit criteria.** Advancement is
  *derived* (`current_index + 1`) and gated by **monetization** (`handleUnlockRequest`), not by demonstrated
  readiness. This means **stage ≠ progression** exactly as the honesty contract warns. (→ GAP-P1/P2)
- **Growth stage is plan-rich but re-test-light:** it produces a 30-day strategy but does not close the loop
  with a mandatory re-assessment to *measure* growth → the assess→intervene→re-test loop is incomplete.
- **No duplicate or ambiguous stages**; the only ambiguity is BE/FE naming (Clarity vs Insight; Awareness
  hidden).

## Verdict
Lifecycle stage **architecture: IMPLEMENTED & coherent.** Lifecycle stage **progression: PARTIAL** (derived +
monetization-gated, no measured exit). The product has stages; it does not yet have an evidence-gated
progression model. Enhancement-only fix (10/11).

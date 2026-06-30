# 11 · Progression Framework Validation

What actually moves a user from one stage to the next? (Evidence: `journey-intelligence.ts` `stageAdvancement`,
`wc7b/decision-orchestrator.ts`, `resolveSessionStage`, `wc3_stage_progression`.)

## The progression mechanism (measured)
| Question | Answer (repo-evidenced) | Classification |
|---|---|---|
| **What advances a user?** | Completing the session/product whose `stage_code` is `current_index + 1`. | **DERIVED / IMPLICIT** |
| **Business rules?** | Access to the next stage is **monetization-gated** (`handleUnlockRequest`), not readiness-gated. | **PARTIAL** (commercial gate ≠ progression gate) |
| **AI rules?** | AI derives *current* stage (60% `stage_code` + 40% CSI presence) and routes *next-best* via `fit_score` over outcome models. AI **assists routing**, does not **authorize promotion**. | **PARTIAL** |
| **Human approval?** | No human-in-the-loop promotion gate for the user lifecycle (mentor/admin can intervene but don't gate stage movement). | **MISSING** |
| **Evidence required?** | None enforced — a user can reach Mastery by purchasing/completing the Mastery session, regardless of prior scores. | **MISSING** |
| **Readiness criteria?** | Readiness is *computed and reported* (readiness engines) but **not used as a progression gate**. | **PARTIAL (computed, not enforced)** |
| **Certification?** | No real-time user-facing certificate; "certification" lives in the audit/batch layer. | **MISSING (user-facing)** |
| **Completion rules?** | `session_complete` appends to `wc3_stage_progression` (append-only log). | **IMPLEMENTED (logging)** |
| **Continuous improvement?** | No mandatory re-assessment loop closing growth. | **MISSING** |

## Findings (honest)
- **Progression is real but soft:** it is *derived from what the user did*, not *gated by what the user
  demonstrated*. This is the platform-defining product gap — **"existing stage ≠ defined progression"**
  exactly as the honesty contract anticipates.
- **The pieces to fix it already exist** (readiness engines, CSI confidence, outcome models) — they are
  *computed* but not *wired as gates*. So the enhancement is **composition/wiring, not new architecture**.
- **Monetization-gating is a legitimate commercial design** but should be *separated* from readiness-gating so
  "Mastery" means demonstrated mastery, not purchased mastery.

## Verdict
**Progression framework: PARTIAL.** Logging ✅, derivation ✅, commercial gate ✅; evidence-gate ✗, human/AI
promotion authority ✗, user certification ✗, continuous-improvement loop ✗. Top Tier-1 enhancement (GAP-P1/P2).

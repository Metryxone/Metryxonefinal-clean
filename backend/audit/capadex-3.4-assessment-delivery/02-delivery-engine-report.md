# CAPADEX 3.0 · Program 3 · Phase 3.4 — Delivery Engine Report (dimension 1 · delivery_engine)

> Deliverable 02 · Generated 2026-07-01T09:39:51.721Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6c0930a1b4b1, written 2026-07-01T09:39:51.722Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The delivery engine COMPOSES the existing assessment runtimes (adaptive-assessment / caf-runtime / dynamic-assessment-runtime) — no duplicate engine. It serves 6 delivery modes and 7 question-delivery modes over the same runtime.

## Delivery modes (6)
**Delivery modes:** 3 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Note |
|---|---|---|
| **Academic / exam** (`academic`) | SUPPORTED | MCQ/structured exam delivery (caf-runtime / dynamic-assessment-runtime). |
| **Psychometric / behavioural** (`psychometric`) | SUPPORTED | CAPADEX behavioural session delivery (capadex_sessions). |
| **Survey / questionnaire** (`survey`) | SUPPORTED | Non-scored questionnaire delivery via the same session runtime. |
| **Coding assessment** (`coding`) | PARTIAL | PLACEHOLDER — no code editor / execution sandbox at delivery time (Future). |
| **Video / recorded response** (`video`) | PARTIAL | PLACEHOLDER — reuses the employer voice/avatar seam; not a first-class delivery mode here (Future). |
| **Simulation / task-based** (`simulation`) | PARTIAL | PLACEHOLDER — no interactive simulation runner at delivery time (Future). |

## Question-delivery modes (7)
**Question-delivery modes:** 6 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Note |
|---|---|---|
| **Sequential** (`sequential`) | SUPPORTED | Ordered delivery in structure order. |
| **Randomized** (`randomized`) | SUPPORTED | Shuffle order per session (caf randomization rules). |
| **Question pools** (`question_pools`) | SUPPORTED | Draw-N-of-M pool per section at session start. |
| **Mandatory questions** (`mandatory`) | SUPPORTED | Required-answer enforcement before advance/submit. |
| **Optional questions** (`optional`) | SUPPORTED | Skippable questions per delivery rules. |
| **Section rules** (`section_rules`) | SUPPORTED | Per-section min/max/select enforcement at delivery. |
| **Adaptive routing** (`adaptive`) | PARTIAL | PLACEHOLDER — real per-response difficulty routing depends on the Phase 3.5 scoring engine (Future). |

## Launch modes (6)
**Launch modes:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Invite (candidate)** (`invite`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches, test_assignments |
| **Public link** (`public_link`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Secure (tokenized) link** (`secure_link`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Scheduled window** (`scheduled`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Token / access code** (`token_access`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **QR-code entry** (`qr_code`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |

_PARTIAL delivery modes (coding/video/simulation) and PARTIAL question-delivery (real adaptive routing) are honest deferrals — adaptive routing itself DEPENDS ON Phase 3.5. The delivery seam being ready is exactly what 3.5 needs._

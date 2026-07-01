# CAPADEX 3.0 · Program 3 · Phase 3.4 — Delivery Engine Report (dimension 1 · delivery_engine)

> Deliverable 02 · Generated 2026-07-01T10:13:32.658Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ba8e46395e4d, written 2026-07-01T10:13:32.658Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The delivery engine COMPOSES the existing assessment runtimes (adaptive-assessment / caf-runtime / dynamic-assessment-runtime) — no duplicate engine. It serves 6 delivery modes and 7 question-delivery modes over the same runtime.

## Delivery modes (6)
**Delivery modes:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Note |
|---|---|---|
| **Academic / exam** (`academic`) | SUPPORTED | MCQ/structured exam delivery (caf-runtime / dynamic-assessment-runtime). |
| **Psychometric / behavioural** (`psychometric`) | SUPPORTED | CAPADEX behavioural session delivery (capadex_sessions). |
| **Survey / questionnaire** (`survey`) | SUPPORTED | Non-scored questionnaire delivery via the same session runtime. |
| **Coding assessment** (`coding`) | SUPPORTED | First-class coding runner: in-browser editor + JS execution + expected-vs-actual test harness (CodeEditorRunner + /coding/run). Multi-language server sandbox is a scope boundary, not a gap. |
| **Video / recorded response** (`video`) | SUPPORTED | First-class recorded-response runner (MediaRecorder video/audio, RecordedResponseRunner); response metadata captured to ad_responses. |
| **Simulation / task-based** (`simulation`) | SUPPORTED | First-class task-based simulation runner (SimulationRunner); step interactions + completion captured to ad_responses/ad_events. |

## Question-delivery modes (7)
**Question-delivery modes:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Note |
|---|---|---|
| **Sequential** (`sequential`) | SUPPORTED | Ordered delivery in structure order. |
| **Randomized** (`randomized`) | SUPPORTED | Shuffle order per session (caf randomization rules). |
| **Question pools** (`question_pools`) | SUPPORTED | Draw-N-of-M pool per section at session start. |
| **Mandatory questions** (`mandatory`) | SUPPORTED | Required-answer enforcement before advance/submit. |
| **Optional questions** (`optional`) | SUPPORTED | Skippable questions per delivery rules. |
| **Section rules** (`section_rules`) | SUPPORTED | Per-section min/max/select enforcement at delivery. |
| **Adaptive routing** (`adaptive`) | SUPPORTED | Delivery-layer adaptive routing on objective correctness + difficulty ladder (AdaptivePlayer + /adaptive/next). Psychometric IRT / ability-estimation routing is Phase 3.5 (scoring) — a scope boundary, not a gap. |

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

_Coding/video/simulation delivery modes and delivery-layer adaptive question routing are ENGINEERING-CLOSED (first-class flag-gated delivery components + pure mechanisms). The honest boundary that remains is PSYCHOMETRIC adaptive routing — IRT / ability-estimation — which belongs to Phase 3.5; the delivery seam being ready is exactly what 3.5 consumes. This is a scope boundary, not a gap._

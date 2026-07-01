# CAPADEX 3.0 · Program 3 · Phase 3.4 — Session Management Report (dimension 3 · session_management)

> Deliverable 04 · Generated 2026-07-01T09:39:51.721Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6c0930a1b4b1, written 2026-07-01T09:39:51.722Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Session lifecycle (9 capabilities), timing (6 capabilities), and response capture (6 capabilities). REUSES `capadex_sessions` / `capadex_responses` with an additive `ad_sessions` / `ad_responses` overlay for the unified delivery session record.

## Session capabilities (9)
**Session capabilities:** 9 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (9 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Start session** (`start`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions, capadex_sessions |
| **Resume session** (`resume`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions |
| **Pause session** (`pause`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions |
| **Auto-save** (`auto_save`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses, capadex_responses |
| **Recover / restore** (`recover`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions |
| **Reconnect** (`reconnect`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions, express_sessions |
| **Timeout handling** (`timeout`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions |
| **Expiry handling** (`expiry`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions, ad_launches |
| **Multi-device continuity** (`multi_device`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions, express_sessions |

## Timing capabilities (6)
**Timing capabilities:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Assessment timer** (`assessment_timer`) | SUPPORTED | true | components/exam-ready/components/Timer.tsx, ad_sessions |
| **Section timer** (`section_timer`) | SUPPORTED | true | components/exam-ready/components/Timer.tsx, ad_sessions |
| **Question timer** (`question_timer`) | SUPPORTED | true | components/exam-ready/components/Timer.tsx, ad_sessions |
| **Countdown display** (`countdown`) | SUPPORTED | true | components/exam-ready/components/Timer.tsx |
| **Grace period** (`grace_period`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions |
| **Auto-submit on expiry** (`auto_submit`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_sessions |

## Response capabilities (6)
**Response capabilities:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Save response** (`save`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses |
| **Update response** (`update`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses |
| **Draft (unsubmitted)** (`draft`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses |
| **Final submission** (`final_submission`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses, capadex_responses |
| **Offline buffer** (`offline_buffer`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses |
| **Response recovery** (`recovery`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_responses |

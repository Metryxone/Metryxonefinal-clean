# CAPADEX 3.0 · Program 3 · Phase 3.4 — Notification Report (delivery notifications)

> Deliverable 07 · Generated 2026-07-01T10:13:32.658Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ba8e46395e4d, written 2026-07-01T10:13:32.658Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Delivery notification types (6) — invite, reminder, launch, resume, submission, result-ready handoff. REUSES the existing notification-engine; delivery-scoped notifications are recorded in the additive `ad_notifications` ledger.

**Notification types:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Invitation** (`invitation`) | SUPPORTED | true | services/notification-engine-shared.ts, ad_notifications |
| **Reminder** (`reminder`) | SUPPORTED | true | services/notification-engine-shared.ts, ad_notifications |
| **Started confirmation** (`started`) | SUPPORTED | true | services/notification-engine-shared.ts, ad_notifications |
| **Completed confirmation** (`completed`) | SUPPORTED | true | services/notification-engine-shared.ts, ad_notifications |
| **Timeout warning** (`timeout_warning`) | SUPPORTED | true | services/notification-engine-shared.ts, ad_notifications |
| **Submission confirmation** (`submission_confirmation`) | SUPPORTED | true | services/notification-engine-shared.ts, ad_notifications, notifications |

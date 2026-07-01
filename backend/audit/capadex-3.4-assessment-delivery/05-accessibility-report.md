# CAPADEX 3.0 · Program 3 · Phase 3.4 — Accessibility Report (dimension 4 · accessibility)

> Deliverable 05 · Generated 2026-07-01T10:13:32.658Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ba8e46395e4d, written 2026-07-01T10:13:32.658Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Accessibility + accommodation capabilities (7) that make delivery usable for every candidate (extra time, screen-reader support, keyboard nav, language, contrast/scaling, …).

**Accessibility capabilities:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **WCAG-aware markup** (`wcag`) | SUPPORTED | true | components/exam-ready/pages/AssessmentPage.tsx, components/exam-ready/components/QuestionRenderer.tsx |
| **Keyboard navigation** (`keyboard_navigation`) | SUPPORTED | true | components/exam-ready/pages/AssessmentPage.tsx, components/exam-ready/components/QuestionRenderer.tsx |
| **Screen-reader labels** (`screen_reader`) | SUPPORTED | true | components/exam-ready/components/QuestionRenderer.tsx |
| **Font scaling** (`font_scaling`) | SUPPORTED | true | components/exam-ready/pages/AssessmentPage.tsx |
| **Contrast options** (`contrast`) | SUPPORTED | true | components/exam-ready/pages/AssessmentPage.tsx |
| **Multi-language** (`multi_language`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Mobile responsive** (`mobile_responsive`) | SUPPORTED | true | components/exam-ready/pages/AssessmentPage.tsx, components/exam-ready/components/QuestionRenderer.tsx |

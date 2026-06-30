# CAPADEX 3.0 · Phase 1.4 — Journey Gap Register (classified)

> Deliverable 12 · Generated 2026-06-30T12:16:14.559Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:c5c4c1e82876, written 2026-06-30T12:16:14.555Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Counts: **0 Launch-Critical · 0 High · 3 Medium · 2 Low · 1 Future**.

## Launch-Critical
_None._

## High
_None._

## Medium
### GAP-J1-TEACHER-COUNSELLOR-DEADEND — Teacher / Counsellor survey is a true dead-end (no downstream journey)
- **Evidence**: CUSTOMER_JOURNEY_MODEL.teacher_counsellor=DEAD_END: survey input captured, zero continuation. The jt_stakeholder_observations substrate exists (staff-only) but is not wired into a downstream step.
- **Remediation**: Convert to a continuation using the EXISTING jt_stakeholder_observations substrate (no rebuild) — a flag-gated additive enhancement; deferred + classified honestly here. Never fabricate a journey.

### GAP-J2-PARENT-MENTOR-FACULTY-TAIL — Parent / Mentor / Faculty journeys have thin or nested tails
- **Evidence**: parent_support / mentor_mentee / faculty_students = PARTIAL: support-action + engagement substrate exists (journeyTailCompletion) but the tails are thin; faculty is a nested batch-confined scope, not a first-class top-level surface.
- **Remediation**: Deepen the support/engagement tail surfaces (reuse jt_* substrate) and promote faculty to a first-class scoped view. Flag-gated, additive. Adoption-gated.

### GAP-J3-UNIVERSAL-OUTCOME-TAIL-ADOPTION — Universal close-the-loop outcome tail: mechanism closed (1.3 reuse), ADOPTION pending
- **Evidence**: outcome_tail=PARTIAL: Phase 1.3 closed the MECHANISM via reuse (captureProgressionOutcome + getReassessmentSignal → validation_loop_outcomes, gated by longitudinalOutcomeCapture). Real per-journey re-administration/outcome volume is currently honest-low/0 (reported by composeOutcomeTailAdoption). Coverage⟂Adoption never composited.
- **Remediation**: Drive ADOPTION (real re-administration volume) + wire the tail per-journey via REUSE of the 1.3 hook. Not an engineering gap; no new engine. null≠0.

## Low
### GAP-J4-RESULTS-NEXT-STEP-CTA — Some results/analysis surfaces lack a "next step" conversion CTA
- **Evidence**: Frontend audit: StudentDashboard ResultsSummary can terminate without a clear next-step; GapAnalysisPage / CompetencyRoleTransitionPage show visualisations without a direct "enrol / contact mentor" conversion at the bottom.
- **Remediation**: Add a next-step CTA into the EXISTING canonical flow (no new journey). Additive UX; preserve byte-identical-OFF.

### GAP-J5-CONSENT-REDIRECT — Public consent-approval surface lacks a clean redirect back into the dashboard journey
- **Evidence**: Frontend audit: ParentConsentApprovePage performs an action via a public link but does not redirect back into a dashboard journey; OnboardingRegisterPage feels disconnected from the primary auth flow.
- **Remediation**: Add a post-action redirect into the parent dashboard journey; reconcile onboarding entrances (KEEP_ALL entrances, just connect them). Additive.

## Future
### GAP-J6-ORPHAN-STUBS — SiteMap lists UI-shell / stub routes with minimal functional depth
- **Evidence**: Frontend audit: SiteMap.tsx enumerates routes (e.g. gamification, ld-integration) that exist as shells/stubs — orphan surfaces, not part of a completed persona journey.
- **Remediation**: Either complete the stub into a real journey step or remove the orphan link. Out of scope for this audit — flagged honestly, never claimed as complete.

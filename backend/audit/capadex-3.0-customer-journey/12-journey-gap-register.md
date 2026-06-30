# CAPADEX 3.0 · Phase 1.4 — Journey Gap Register (classified)

> Deliverable 12 · Generated 2026-06-30T12:58:30.532Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:b399cc022876, written 2026-06-30T12:58:30.531Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

**OPEN engineering gaps: 0** (Launch-Critical 0 · High 0 · Medium 0 · Low 0 · Future 0).

Phase 1.4 ENGINEERING-CLOSED all six classified journey gaps (J1–J6) via REUSE-before-build, each gated by `customerJourneyCompletion` (byte-identical OFF). The ONLY remaining axis is **ADOPTION** (real usage/outcome volume) — reported SEPARATELY (deliverable 08), NOT a journey gap. Coverage⟂Confidence⟂Outcome⟂Adoption are never composited; null≠0; nothing fabricated.

## Open engineering gaps
_None — all classified journey gaps are engineering-closed._

## Resolved gaps (J1–J6) — engineering-closed this phase
### GAP-J1-TEACHER-COUNSELLOR-DEADEND — Teacher / Counsellor survey was a true dead-end (no downstream journey)
- **Closure**: CLOSED via REUSE: submitted observations now surface in a follow-up continuation (frontend ObservationFollowUpQueue → GET /api/journey-tail/counsellor/follow-up-queue + PATCH /observations/:id/follow-up resolution); resolving an observation fires captureJourneyTailMilestone into the universal outcome tail (reuse of the Phase-1.3 progression-capture hook). teacher_counsellor DEAD_END → PARTIAL. Gated by customerJourneyCompletion → byte-identical OFF.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real follow-up resolution volume is usage-driven (honest-low/0; reported separately — Adoption⟂Coverage, null≠0).

### GAP-J2-PARENT-MENTOR-FACULTY-TAIL — Parent / Mentor / Faculty journeys had thin or nested tails
- **Closure**: CLOSED: faculty promoted to a first-class batch-scoped surface (institutional-intelligence heatmap/gaps grant faculty role batch-confined access, server-driven 200 ON / 403 OFF; frontend tab auto-shows/hides byte-identically). Parent/mentor engagement tails wired into the outcome tail (see GAP-J3). Reuse of jt_* substrate; no rebuild.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real support/engagement/faculty-view volume is usage-driven (Coverage⟂Adoption, null≠0).

### GAP-J3-UNIVERSAL-OUTCOME-TAIL — Universal close-the-loop outcome tail not wired per-journey
- **Closure**: ENGINEERING-CLOSED via REUSE: Phase 1.3 closed the MECHANISM (captureProgressionOutcome + getReassessmentSignal → validation_loop_outcomes); Phase 1.4 now WIRES it per-journey via captureJourneyTailMilestone at the resolution points (observation resolved, mentor engagement milestone, parent support action done). Gated by longitudinalOutcomeCapture. Zero new engine/table/DDL.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real re-administration/outcome volume is usage-driven (honest-low/0; reported by composeOutcomeTailAdoption — Adoption⟂Coverage, null≠0). NOT an engineering gap.

### GAP-J4-RESULTS-NEXT-STEP-CTA — Some results/analysis surfaces lacked a "next step" conversion CTA
- **Closure**: CLOSED: gated next-step CTAs added to ResultsSummary, GapAnalysisPage, and RoleTransitionPage (→ Career Builder), present only when customerJourneyCompletion is ON. Additive into the EXISTING canonical flow; byte-identical OFF.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real click-through/conversion volume is usage-driven (null≠0).

### GAP-J5-CONSENT-REDIRECT — Public consent-approval surface lacked a clean redirect back into the dashboard journey
- **Closure**: CLOSED: ParentConsentApprovePage now redirects into the unified-parent-dashboard journey after approval (gated CTA + post-action redirect, present only when flag ON). Entrances KEEP_ALL — just connected. Additive; byte-identical OFF.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real redirect-through volume is usage-driven (null≠0).

### GAP-J6-ORPHAN-STUBS — SiteMap listed UI-shell / stub routes (gamification, etc.) not connected to a persona journey
- **Closure**: CLOSED: the Gamification Hub is now connected into the student journey nav via a gated StudentDashboard card (→ onNavigate('gamification')), present only when customerJourneyCompletion is ON. Additive; byte-identical OFF. The orphan link is now a reachable journey step.
- **Residual (ADOPTION, usage-driven — not a gap)**: ADOPTION: real hub engagement volume is usage-driven (null≠0).

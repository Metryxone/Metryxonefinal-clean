---
name: Notifications & Workflows engine (Phase 5.14)
description: Honesty/derivation traps for the PURE read notification/workflow/communication layer over employer evidence
---

PURE read/compose layer that DERIVES operational reminders from operator-recorded employer
evidence (composes 5.13 resolveDashboardEvidence -> 5.12 workforce + ONE scoped timestamp read
of employer_candidates applied/interview/decision/updated + employer_jobs created/updated). 7 alert
types (Job/Application/Interview/Offer/Employer/Recruiter + Status Changes); deliverables
notification_engine / workflow_notifications / communication_engine. Flag notificationEngine
(FF_NOTIFICATION_ENGINE), default OFF.

**interview.outcome_overdue must gate on `stage === 'Interview'`, NOT `ACTIVE.has(stage)`.**
**Why:** a candidate in Offer/Hired whose interview_date is in the past has IMPLICITLY recorded the
outcome via stage advancement; firing "outcome overdue" on them is a false positive against
operator-recorded progress (an Offer-stage row with a stale interview_date is normal data).
**How to apply:** any "past event but not resolved" alert over a staged pipeline should gate on the
candidate still sitting AT that stage, not merely being non-terminal.

**Timestamp coverage is a first-class Coverage axis.** No `updated_at` => `stalled:null` (abstain),
never assumed fresh or zero-filled; report with_updated_at/total. unmeasured=null NOT 0 throughout.

**Determinism boundary:** `now` is captured ONCE inside resolveNotificationEvidence. The POOL
wrappers each capture a fresh `now`, so assert determinism at the evidence->build boundary
(build*FromEvidence(ev) twice), NOT by calling the pool wrapper twice.

**communication_engine PII:** previews only, delivered:false, NEVER sends. Emits candidate id/role/
stage — never email/name/phone. The employer scope id can be email-form (seed convention) and
legitimately appears as SCOPE; a no-PII smoke assertion must target CANDIDATE emails specifically,
not any '@' string.

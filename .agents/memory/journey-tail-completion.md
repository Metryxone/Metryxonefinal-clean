---
name: Journey Tail Completion (journeyTailCompletion)
description: Flag-gated downstream step for three front-half-only persona journeys (parent/mentor/teacher-counsellor); authz + mentor-substrate lessons.
---

# Journey Tail Completion

Flag `journeyTailCompletion` / `FF_JOURNEY_TAIL_COMPLETION` (default OFF, byte-identical OFF incl. schema). Additive downstream step for three persona journeys that previously dead-ended. Backend: `services/journey-tail-engine.ts` (3 `jt_*` tables, lazy ensure-schema on write paths only, assertFlag before ensure-schema) + `routes/journey-tail.ts` (BASE `/api/journey-tail/*`, flagGate-first 503 before auth/DDL). Frontend gated by `/enabled` probe.

## Mentor substrate is RealMentorsTab, NOT the mock pages
The task named MentorDashboardPage / MentorMarketplacePage / ParentMentorServices, but those are **mock catalogs with no real `mentor_profile_id`**. The ONLY real mentor substrate is **CareerBuilderPage `RealMentorsTab`** (`/api/ecosystem/mentors`, `mentor_profiles`, bookings in `mentor_bookings`). Mount any real mentor-relationship feature there.
**Why:** a feature keyed on `mentor_profile_id` mounted on a mock page can never resolve a real id → dead surface.

## Participant integrity must be BOTH directions (authz)
A mentor "engagement" is the tail of a real MATCH, not a cold message. `seekerHasBooking(pool, seekerId, mentorProfileId)` (a real `mentor_bookings` row) must gate **both**:
- seeker→mentor post (else 403 `no_mentor_booking`)
- mentor→seeker post when a `seeker_id` is supplied (else 403 `not_a_participant`)

Mentor self-notes with NO `seeker_id` are allowed. `seekerHasBooking` fails **closed** (catch→false) so an absent `mentor_bookings` table denies, not allows. Forcing `seeker_id = actor` for non-mentor callers prevents impersonation but does NOT by itself stop a *mentor* from writing into an arbitrary seeker's thread — that needed the symmetric check.
**Why:** the first review caught the missing seeker check; a second review caught that the mentor side was still an IDOR (mentor could post to any `seeker_id`). Both sides share the same helper.

## Teacher/counsellor observation create is staff-only
`POST /api/journey-tail/observations` must enforce `isStaff(req)` (403 `staff_role_required`) — `requireAuth` alone let any authed user create observations for an arbitrary `child_id` that then surface to parents + the counsellor queue.

## Validator notes
`scripts/task293-journey-tail-validate.ts` is phased OFF→ON in one process (toggle `process.env.FF_JOURNEY_TAIL_COMPLETION`). Route-layer guards are unit-tested by exporting `isStaff` + `seekerHasBooking` from the route module and asserting them directly (the service layer has no role/booking concept — authz lives at the route). The booking test must `CREATE TABLE IF NOT EXISTS mentor_bookings` first (lazily created by ecosystem-community in prod, may be absent in a fresh dev DB) and clean up its demo row.

## E2E-testing a default-OFF flag route
The flag defaults OFF and is deliberately absent from the Backend API workflow command (dev stays
byte-identical-OFF). To drive the route's live HTTP authz, do NOT flip the shared :8080 workflow.
Spawn an isolated backend instance with the flag ON on its own port, poll the flag-gated `/enabled`
(200 only when up AND flag-ON = combined readiness+flag probe), run the session+CSRF flow, then
SIGKILL it. Keeps dev's OFF default intact and makes the regression self-contained.

## HTTP e2e harness for the mentor IDOR guard
`scripts/task295-mentor-engagement-authz-e2e.ts` drives the LIVE route (session+CSRF, mirrors the employer harness) to prove the mentor→seeker `not_a_participant` 403 end-to-end. A registered `role:'mentor'` user is NOT a real mentor until a `mentor_profiles` row exists with `user_id`=that user (registration creates none — provision it directly); `actorMentorProfileId` resolves identity from it. Requires the flag ON in the live server — enable via dev env var (`FF_JOURNEY_TAIL_COMPLETION=1` + restart) then revert.

## is_demo never fires through the live routes (honesty gap)
`is_demo` is derived from the acting user's @example.com email, but **`deserializeUser` (routes.ts) omits `email` from the session** → `actorEmail(req)` is null → EVERY journey-tail HTTP write records `is_demo=false`. The demo-exclusion only works when the service fns are called directly (the task293 validator passes emails in). So a demo account using the real UI pollutes `composeJourneyTailOverview` counts. (Follow-up filed.)

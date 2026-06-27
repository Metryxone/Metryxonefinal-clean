---
name: Student Career Builder Exposure (MX-302D)
description: Exposing an existing surface to a new role behind a flag without forking engines, keeping byte-identical-OFF.
---

# Student Career Builder Exposure (MX-302D)

Flag `studentCareerBuilder` (default OFF). Pure EXPOSURE + FRAMING over the shared
`CareerBuilderPage` — students (role `student`/`campus_student`) reach the SAME
career-seeker engines/routes; nothing is forked.

## Byte-identical-OFF traps when "exposing" an existing surface
- An existing CTA that ALREADY navigates to the target destination today is CURRENT
  behaviour — do NOT wrap it in the new flag. Flag-gating a pre-existing nav button
  *removes* it when OFF, which BREAKS byte-identical-OFF. (e.g. `StudentCareerPage`
  already had live `onNavigate('career-builder')` buttons → left untouched.)
- Only ADD new flag-gated entry points / reframe copy. The repointed
  `StudentDashboard` "Career Intel" quick-action conditionally targets
  `career-builder` (ON) vs the pre-existing `student-career-portal` (OFF) — same
  slot, OFF identical.

## Flag → frontend wiring
- **Why a probe**: file-registry flags (`backend/config/feature-flags.ts`) aren't in
  `/api/admin/feature-flags`. Expose an un-gated `GET /api/<x>/enabled` returning
  `{ok,enabled}` (mirror MX-302A/B/C) and have the client `fetch().then(r=>r.json())`
  set a boolean. Register the route in `backend/routes.ts`.
- **Framing across component boundary**: role-derived framing computed in the parent
  (`isStudentFraming = flag && role∈{student,campus_student}`) must be THREADED AS A
  PROP into sub-components (`DashboardTab studentFraming={...}`) — the welcome-hero
  copy lives inside the child, not the parent scope.

## Deliberate non-changes (document, don't "fix")
- **Login default landing left unchanged** (`student`→`student-dashboard`). Repointing
  it to `career-builder` would strand students from exams/LBI AND can't cleanly await
  an async flag probe at nav time. First-class entry is a dashboard ACTION, which is
  exactly what "first-class destination from their dashboard" asks for.
- The student Employability Dashboard is NOT new — it's the existing Career Builder
  dashboard tab (the MX-302C `careerLaunchpad` 15-widget Launchpad). MX-302D routes
  students into it + reframes the header; it composes, never rebuilds.

## Honesty
- Validation proves PROVENANCE (each of the 10 features → an existing engine/route),
  reported SEPARATELY from live adoption substrate (student users, `market_intelligence`
  rows, `onto_role_competency_profiles` rows). null≠0; market substrate absent in dev is
  an honest gap, never coerced to 0. Verdict is STRUCTURAL-only.

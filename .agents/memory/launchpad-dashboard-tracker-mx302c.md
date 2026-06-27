---
name: Launchpad Dashboard cross-device tracker (MX-302C)
description: How the Fresher/Career-Launchpad campus-drive/project/checklist state is made account-bound and device-independent, and the honesty traps.
---

# Career Launchpad Dashboard — device-independent tracker (MX-302C)

The Fresher toolkit (`FresherHubTab.tsx`) and the MX-302C dashboard
(`CareerLaunchpadDashboard.tsx`) historically stored campus drives, project
portfolio and the first-job checklist ONLY in `localStorage`
(`mx-fresher-drives` / `mx-fresher-projects` / `mx-fresher-checklist`), so they
were device-bound and never reached the server `readinessChecks`.

## Persistence model
- Stored server-side under the seeker's OWN profile row:
  `career_seeker_profiles.data.fresherHub = { drives[], projects[], checklist{} }`.
  Chose a dedicated `fresherHub` namespace (NOT top-level `data.projects`) so it
  can't clobber the canonical `profile.projects` that Resume Studio / `resumeChecks`
  read.
- Surface = `GET`/`PUT /api/launchpad-dashboard/tracker` (flag `launchpadDashboard`
  / `FF_LAUNCHPAD_DASHBOARD`). Self principal only via the route file's `selfId(req)`
  → no IDOR; FresherHubTab only receives a `profile` prop (no userId, no save
  callback), which is WHY a session-principal endpoint is required rather than
  reusing the `/api/cv/profile/:userId` merge path.
- `readinessChecks()` in `routes/launchpad-dashboard.ts` reads `profile.fresherHub.{drives,projects}`
  with a fall-back to any legacy top-level `p.drives`/`p.projects` so old rows stay byte-identical.

## Honesty / byte-identical-OFF rules baked in
- Flag-OFF → tracker routes 503 via the same shared `gate` before auth/DB (the
  client then silently keeps its localStorage copy). Frontend probes
  `/enabled` first; only persists when `enabled:true`.
- PUT requires an EXISTING profile row → 409 if absent (profile is created by the
  profile surface, not here); client keeps local copy so nothing is lost.
- GET: no profile / no substrate → honest `drives/projects/checklist = null`
  (null ≠ 0), never `[]`-as-data. `has_profile` tri-state (true/false/null-on-degrade).
- PUT only accepts the three slices (drives[]/projects[]/checklist{}); never lets
  the client reshape the rest of `data`.
- Migration: on first load with flag ON, if the account copy is EMPTY but this
  device has local data, lift the local data up once (PUT), then the account is
  the source of truth on every subsequent load.

## Dashboard readiness item list
- When `summaryState==='server'`, the dashboard's Upcoming-Tasks item LIST is
  sourced from `summary.readiness.checks` (server `key`→tab via `CHECK_TAB` map:
  drives/projects→`fresher-hub`), not the local `readinessChecks()`. Falls back to
  the local computation otherwise. `trackerSynced` flips the widget copy from
  "stored on this device" to "saved to your account".

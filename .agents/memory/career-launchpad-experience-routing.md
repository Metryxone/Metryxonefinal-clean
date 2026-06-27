---
name: Career Launchpad & Experience Routing (MX-302A)
description: Flag-gated career-stage capture + experience routing over the existing career_seeker_profiles record; rename traps and byte-identical-OFF discipline.
---

# Career Launchpad & Experience Routing (MX-302A)

Flag `careerLaunchpad` (env `FF_CAREER_LAUNCHPAD`), default OFF. Renames the
user-facing **"Fresher Hub" → "Career Launchpad"** and routes career seekers to one
of four experiences (Career Launchpad / Career Command Center / Leadership Studio /
Executive Studio) from a Career Stage chosen at registration.

## Durable decisions / traps

- **Rename without breaking deep-links:** only the *display label* changes
  ("Fresher Hub" → "Career Launchpad"). The internal tab id stays `fresher-hub`
  and the `dashboardTarget` routing keys off the unchanged id. Never rename the tab
  id — `TabId` union + searchIndex + deep-links all key on it.
- **One user = one record:** career_stage is a **nullable column added by an
  ALTER-only migration** on the existing `career_seeker_profiles` (PK `user_id`
  varchar). No new user table. Persist UPSERTs the existing row; the structured
  profile (field of study / years / role) lives in that row's `data` JSONB.
- **Byte-identical-OFF includes schema:** the lazy `ensureCareerStageColumn` DDL
  runs **only on the flag-ON code path**. Flag OFF → registration + schema unchanged,
  `/api/career/experience/enabled` returns 503, `/api/career/experience` returns 401
  (requireAuth runs before the flag check).
- **Honest not-yet-available tiers:** Leadership Studio + Executive Studio have no
  dedicated surface, so they route to the nearest real surface (Command Center) and
  are labelled "(soon)". Don't stand up empty shells and call them experiences.
- **Switcher sets a navigation PREFERENCE — never the canonical stage.** The first
  design persisted a "representative stage" for the chosen experience; that let a POST
  escalate a junior to an executive stage (and silently demoted a senior who visited a
  lower experience). **Why:** the stage is the user's identity (registration/derived),
  not a view toggle. **How:** persist the chosen experience under
  `data.careerProfile.preferredExperience`; `effectiveExperience(stage, preferred)`
  honours it only when `preferred ∈ allowedExperiences(stage)`, else falls back to the
  stage default. Stage is untouched, so the allowed set never changes.
- **Authorization is server-side, not the dropdown.** POST must (1) role-gate to career
  seekers (`career_seeker`/`job_seeker`) and (2) reject any requested experience not in
  `allowedExperiences(currentStage)` — both 403. The client only ever *shows* allowed
  options; never trust it as the gate.
- **jsonb preference write = nested merge, not shallow `||`.** Persisting the preference
  must merge at the `careerProfile` level (preserve field-of-study / years / role);
  a shallow `data || EXCLUDED.data` would wipe the sibling profile fields.
- **Existing users get a DERIVED stage** (platform role → seniority text → years →
  has-history); stage stays null only when nothing is derivable. Never fabricate a stage.
- **Unknown-stage default = Career Launchpad, NOT Command Center (product decision
  2026-06-27).** A returning user who registered but never built a profile has NO
  `career_seeker_profiles` row → `readEffectiveStage` yields stage null → the default
  experience must be the no-presumption ENTRY surface (Launchpad), not the mid-career
  Command Center. **Why:** Command Center presumes seniority we can't substantiate from
  zero signal; an EMPTY profile row already derived 'graduate'→Launchpad, so a no-row
  user (even less signal) landing on the MORE advanced surface was backwards; the
  switcher lets anyone move UP, so the entry default can never trap a senior user.
  **How:** `effectiveExperience(null, _)` returns `EXPERIENCES[DEFAULT_EXPERIENCE_WHEN_UNKNOWN='launchpad']`
  (single const). Stage stays null (honest "unknown"); only the *default experience*
  changed — we don't fabricate a stage.
- **`readEffectiveStage` now LEFT JOINs `users`** to feed the platform `role` into the
  deriver even when there is NO profile row (so a `student` role → 'student' stage →
  Launchpad via a REAL signal, derived=true). `profile_user_id` is the present-row
  marker — `hasExperience` must key off PROFILE presence (not the always-present user
  row) or an empty no-profile row would falsely read hasExperience=false→'graduate'.
- **Routing applies on page load too** (not just on switch), but an explicit `?tab=`
  deep-link always wins — auto-route only when the URL carries no tab.
- **A tab render-crash strands the no-profile user (rendered-UI gotcha).**
  `CareerBuilderPage` renders the initial `dashboard` tab INLINE, before the async
  load-time experience-routing effect can switch the tab. If any tab subtree throws
  during that first render, the throw propagates up through `CareerBuilderPage` so the
  page never commits → the routing effect never runs → blank white screen, and the
  no-profile user never reaches Launchpad. **Why:** effects only run after a successful
  commit; an inline child throw aborts the parent's commit. **How:** the main tab switch
  is wrapped in `TabContentErrorBoundary key={tab}` — a crash renders a fallback, the
  parent commits, the routing effect runs, and the tab-keyed boundary remounts cleanly
  on the switch. No-op (byte-identical) unless a tab actually throws. Corollary: a
  rendered-UI E2E (login as a real no-profile user) catches crashes that an API/DB
  read-path harness cannot — both `FresherHubTab` (missing `Circle` lucide import) and
  the dashboard subtree crashes were only visible through the browser.
- **Rendered-UI E2E harness:** `backend/audit/mx-302a/ui-e2e-seed.ts` seeds two
  loginable no-profile @example.com fixtures (career_seeker + student role);
  `ui-e2e-plan.md` is the Playwright plan, `ui-e2e-results.md` the last run. Flag is
  enabled in dev via the `FF_CAREER_LAUNCHPAD` env var (not a workflow flag — `.replit`
  is at its workflow limit; see `workflow-limit-flag-via-env-var.md`); revert the env
  var + run `clean` to restore byte-identical-OFF.
- **Engine is mirrored, not shared:** the pure backend engine has a frontend twin.
  Keep the 8 stages / 4 experiences / stage→experience map in lockstep across both.
- **Structural ⟂ Adoption:** the founder report certifies the routing *contract*
  (deterministic, 10/10 validate-mx302a.ts). It does NOT claim live adoption — that is
  measurable only against the live DB after the flag is ON. Never composite the two.

Deliverables: `backend/audit/mx-302a/{validate-mx302a.ts,validation-results.json,founder-report.md}`.

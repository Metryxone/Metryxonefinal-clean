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
- **Existing users get a DERIVED stage** (role → seniority text → years → has-history),
  returns null only when nothing is derivable (UI defaults to Command Center). Never
  fabricate a stage.
- **Routing applies on page load too** (not just on switch), but an explicit `?tab=`
  deep-link always wins — auto-route only when the URL carries no tab.
- **Engine is mirrored, not shared:** the pure backend engine has a frontend twin.
  Keep the 8 stages / 4 experiences / stage→experience map in lockstep across both.
- **Structural ⟂ Adoption:** the founder report certifies the routing *contract*
  (deterministic, 10/10 validate-mx302a.ts). It does NOT claim live adoption — that is
  measurable only against the live DB after the flag is ON. Never composite the two.

Deliverables: `backend/audit/mx-302a/{validate-mx302a.ts,validation-results.json,founder-report.md}`.

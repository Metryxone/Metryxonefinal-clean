---
name: Employer, Community & Ecosystem (MX-302I)
description: Flag-gated ecosystemCommunity layer — alumni/forums/study-groups/hackathons/referrals/stories + real mentorship; traps for byte-identical-OFF and tab gating.
---

# Employer, Community & Ecosystem (MX-302I)

Flag `ecosystemCommunity` (env `FF_ECOSYSTEM_COMMUNITY`, default OFF). Module
`backend/routes/ecosystem-community.ts`; page `frontend/src/pages/EcosystemCommunityPage.tsx`;
nav entry + real mentorship in `CareerBuilderPage.tsx`.

## Durable traps / decisions

- **Career forum is NET-NEW (`eco_forum_*`), not the existing `forum_*`.** The live
  `forum_*` tables are academic-scoped (child/test FKs) — reusing them would couple a
  career community to school enrollment. Same reasoning for all `eco_*` tables.
- **`mentor_bookings` did not exist in the live DB** — created lazily by this module's
  `ensureSchema`. Mentor mock (`data/catalogs/mentors.ts`) is used ONLY on the flag-OFF
  path; ON reads real `mentor_profiles` (status='active'). Dev has 0 active → honest empty.
- **The Community nav tab shares `id:'mentors'`** with the existing Mentor Connect tab,
  so it CANNOT be flag-gated by `t.id`. Gate it by `t.screen === 'ecosystem-community'`
  in the TABS filter instead. It's a `screen`-type tab (navigates to a separate App.tsx
  Screen), not an in-page TabId.
- **`/enabled` is `flagGate`d → 503 when OFF** (campus-placement pattern, not the
  employability-studio ungated-200 pattern). Frontend probes treat any non-ok as
  disabled, so both patterns work; just keep the comment accurate to whichever you chose.
- **Consent is the publish gate**: alumni profile visible only when `is_published`;
  career story public only when `consent_public` (else private draft). Contact never
  published. Anonymous forum threads/posts render `Anonymous` on every read path.
- **Gamification is NOT duplicated** — the surface links to the existing
  `/api/gamification/*` engine rather than re-implementing XP/leaderboard.

## Activation note
ON-smoke runs against the SHARED dev/prod DB, so set `FF_ECOSYSTEM_COMMUNITY` dev-only,
mark all test rows `@example.com`, and purge after (FK trap: clear
`admin_audit_logs.admin_user_id` before deleting the user). Remove the env var before
completion so prod stays OFF.

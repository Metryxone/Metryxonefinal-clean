# WS1 — Career Builder Runtime Report
**Task:** MX-RUNTIME-01 · **Date:** 2026-06-17 · **Method:** real HTTP code paths (no raw SQL data inserts)

## Activation status: ✅ ACTIVE (end-to-end via real endpoints)

The Career Builder save/goal runtime path is operationally active. Data was
generated exclusively through the live authenticated HTTP endpoints — never by
direct SQL inserts.

| Endpoint (real code path) | Method | Result |
|---|---|---|
| `POST /api/register` | mint session cookie | ✅ 100 candidates registered |
| `POST /api/cv/save-profile` | persist career profile | ✅ 101 profiles |
| `POST /api/cv/goals` | persist career goal | ✅ 101 goals |

## Measured runtime data (live DB counts)
| Metric | Count |
|---|---|
| `career_seeker_profiles` | **101** |
| `career_seeker_goals` | **101** |
| Distinct profile owners (`user_id`) | **101** |

(101 = 100 driver candidates + 1 prior probe user; target was 100.)

## How it was driven
`runtime_driver.mjs` registers each candidate (`POST /api/register`), captures the
session cookie, then calls `POST /api/cv/save-profile` and `POST /api/cv/goals`
with that cookie. The IDOR guard `resolveEffectiveUserId` was satisfied naturally
because each write uses the candidate's own session.

## Honest notes / caveats
- **Demo data only.** Every candidate email is `mxrt_cand_NNN@example.com`; profiles
  carry `source: 'Demo Seed'`. None represent real users.
- **Shared dev/prod database.** `DATABASE_URL` is shared, so these demo rows are
  visible in production too. They are filterable by `email LIKE '%@example.com'` for
  cleanup before go-live. See WS6 scorecard "Disclosure".
- **Identity FK drift (pre-existing).** `users.id` is `character varying` (not a real
  `uuid` column). The career schema's `user_id` FK creation failed historically
  (migration `20260519_career_builder_schema.sql`); the runtime path does not depend
  on that FK, so save/goal works regardless. Documented, not "fixed".
- **Coverage vs Confidence.** Coverage: 101 profiles exist (data present). Confidence:
  profiles are synthetic, so downstream intelligence over them is directional only.

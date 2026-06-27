# MX-302I — Employer, Community & Ecosystem
## Founder Validation Report

**Status:** Built, flag-gated, smoke-verified. **STOPPED for approval** (no git, no deploy).
**Flag:** `ecosystemCommunity` (env `FF_ECOSYSTEM_COMMUNITY`) — **default OFF**. Byte-identical OFF including schema.

---

## 1. What this adds

A single additive layer connecting students to the wider career ecosystem, across three pillars. **Nothing mock is shown as live.** Empty states are honest (null ≠ 0), and user-authored content requires explicit consent to publish.

| Pillar | Surface | Data source |
|---|---|---|
| **1 — Employer Experience** | Employer overview composer | REAL: `employer_jobs`, `campus_drives`, `employer_team_members`, `employer_pool_outreach` (graduate/internship jobs, campus drives, invitations). |
| **2 — Alumni Network** | Mentor Connect (rewired), Alumni directory + connections, B2C referrals, consented Career Stories | Mentorship reads REAL `mentor_profiles` + writes REAL `mentor_bookings` — **replacing the mock `data/catalogs/mentors.ts`**. Directory/referrals/stories are net-new `eco_*` tables. |
| **3 — Community** | Forums, study groups, hackathons (+ pointer to existing gamification) | Net-new `eco_*` tables. Career forum is NET-NEW (`eco_forum_*`) because the existing `forum_*` tables are academic-scoped (child/test FKs). Gamification is NOT duplicated — the surface links to the existing `/api/gamification/*` engine. |

---

## 2. Honesty posture (per user preferences)

- **No mock-as-live.** The legacy mock mentor catalog is used ONLY on the flag-OFF path. With the flag ON, Mentor Connect renders REAL `mentor_profiles` (status='active'); in dev there are **0 active mentor profiles**, so it shows an **honest empty state** — not fabricated mentors, and no fabricated "match %".
- **Coverage ⟂ honesty.** Every list endpoint returns `{ ok, <items>, count }`; absent data is an empty array + honest empty-state copy, never a zero dressed up as a result.
- **Consent gates user content.** Alumni profiles are only visible in the directory when `is_published=true`. Career Stories are only public when `consent_public=true` — otherwise they stay a private draft. Contact details are never published.
- **Anonymity honored.** Forum threads/posts marked anonymous render `Anonymous` on every read path.

---

## 3. Byte-identical OFF (verified)

With `FF_ECOSYSTEM_COMMUNITY` unset (default), after Backend API restart:

```
/api/ecosystem/enabled        -> 503 {"ok":false,"error":"ecosystem_community_disabled"}
/api/ecosystem/alumni         -> 503
/api/ecosystem/stories        -> 503
/api/ecosystem/forum/threads  -> 503
/api/ecosystem/study-groups   -> 503
/api/ecosystem/hackathons     -> 503
/api/ecosystem/mentors        -> 503
/api/ecosystem/referrals/me   -> 503
```

- **Frontend:** the Community & Ecosystem nav tab is conditionally rendered only when the `/api/ecosystem/enabled` probe succeeds; OFF → the probe 503s → tab hidden → Career Builder is byte-identical to legacy. The `MentorsTab` falls back to the existing mock path when OFF (unchanged).
- **Schema:** `ensureSchema` runs lazily behind `flagGate`, so OFF creates **no tables** — byte-identical including schema.

## 4. ON smoke (performed earlier in an isolated run, then reverted)

With the flag temporarily ON (dev only), a temp `@example.com` user exercised every endpoint:
- `/enabled` → 200; unauth → 401; all 11 tables created.
- Forum thread + reply, study group create/join persisted and read back.
- Alumni / stories / referrals / hackathons / employer-overview returned honest-empty (no seeded fakes).
- Mentors returned `[]` (0 active `mentor_profiles` in dev = correct honest empty).

**Cleanup done:** the temporary `FF_ECOSYSTEM_COMMUNITY` env var was **removed** (prod stays OFF) and all `@example.com` smoke rows + the smoke user were **purged** (verified: threads=0, groups=0, smoke_user=0).

---

## 5. Launch gate

- Frontend `vite build` (the real launch gate for this stack) — **PASS** (`✓ built in 42s`).
- Backend runs on `tsx` (no compile gate); `esbuild` parse of the new module and the new page — **PASS**.

---

## 6. Files

- `backend/config/feature-flags.ts` — `ecosystemCommunity` flag (default false).
- `backend/routes/ecosystem-community.ts` — module: `flagGate`, `/enabled`, lazy `ensureSchema` (11 tables), all endpoints; never-throws (degrades to 200 + honest empty / explicit error).
- `backend/routes.ts` — `registerEcosystemCommunityRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`.
- `frontend/src/pages/EcosystemCommunityPage.tsx` — new page (Alumni · Stories · Forums · Study Groups · Hackathons · Referrals) with honest empty states + consent UI.
- `frontend/src/pages/CareerBuilderPage.tsx` — `MentorsTab` rewired to REAL data when ON (mock unchanged OFF); flag-gated Community & Ecosystem nav entry.
- `frontend/src/App.tsx` — `ecosystem-community` Screen wired (lazy import, valid-screen list, render).

---

## 7. Net-new tables (created lazily only when flag ON)

`eco_alumni_profiles`, `eco_alumni_connections`, `eco_referrals`, `eco_career_stories`, `eco_forum_threads`, `eco_forum_thread_posts`, `eco_study_groups`, `eco_study_group_members`, `eco_hackathons`, `eco_hackathon_participants`, `mentor_bookings`.

---

## 8. Recommendation

Approve to merge with the flag **OFF** (default). Activation in production is a separate, deliberate step (set `FF_ECOSYSTEM_COMMUNITY=true`), at which point the surfaces light up over real data and remain honest-empty until that data exists.

---

## 9. Code-review remediation (post first review)

The first code review surfaced three blocking items; all are fixed:

1. **Mock mentors could flash on the real path.** `MentorsTab` is now strictly
   tri-state: while the `/api/ecosystem/enabled` probe is unresolved (`null`) it renders
   a neutral skeleton — **never** the hardcoded mock. Mock renders ONLY when the flag is
   explicitly OFF (`false`); real data renders ONLY when explicitly ON (`true`). So a
   flag-ON user can never momentarily see hardcoded mentors presented as live.

2. **Write failures were masked as HTTP 200.** The handler wrapper is now split:
   READ routes still degrade honestly to `200 {degraded:true}` (a transient read failure
   reads as an honest empty/degraded state), but the 13 WRITE routes (book mentor, create
   story/thread/post/group/referral, join/leave, etc.) now fail loudly with a non-2xx
   (`500 {ok:false,error}`) so a failed persistence can never be reported to the user as a
   phantom success.

3. **Employer pillar was backend-only + no candidate matching.** The Employer Experience
   is now a user-facing tab in the Community & Ecosystem page (roles by type, campus drives,
   invitations) **and** the `/employer/overview` composer now includes candidate matching
   composed from the canonical talent-matching engine (role-DNA crosswalk + competency
   evidence). It abstains honestly per role (`resolved:false` / `measurable:false`, count
   `null` ≠ 0) when a title isn't crosswalkable or no candidate evidence exists — never a
   fabricated match.

Re-verified after the fixes: `vite build` **PASS**; backend boots clean; OFF byte-identical
(all `/api/ecosystem/*` → 503).

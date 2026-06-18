# WS5 — Runtime Activity Report
**Task:** MX-RUNTIME-01 · **Date:** 2026-06-17 · **Method:** idempotent HTTP drivers (real code paths only)

## Drivers
| Script | Drives |
|---|---|
| `runtime_driver.mjs` | career profiles, competency assessments, CAPADEX completions |
| `topup.mjs` | additional CAPADEX completions (proven concern) to reach target |
| `employer_driver.mjs` | employer org activation, candidate pool, search operations |

All drivers use `fetch` + manual cookie handling against `http://localhost:8080`.
They are idempotent (register-collision → login fallback) and tag every artifact as
demo (`@example.com` / `source: 'Demo Seed'`).

## Targets vs achieved
| Target | Goal | Achieved | Status |
|---|---|---|---|
| Career profiles (register → save-profile) | 100 | **101** | ✅ |
| CAPADEX completions (start→respond→complete) | 50 | **58** | ✅ |
| Competency assessments (run-assessment + profile) | 20 | **20** | ✅ |
| Employer searches | 10 | **10** (80 results) | ✅ |

## Detailed measured activity
| Activity | Count |
|---|---|
| Candidates registered (`POST /api/register`) | 100 |
| Career profiles saved (`POST /api/cv/save-profile`) | 100 (101 incl. probe) |
| Career goals created (`POST /api/cv/goals`) | 100 |
| CAPADEX cycles completed | 58 (41 main + 15 top-up + 2 prior) |
| CAPADEX start-404s (substrate gap) | 9 |
| Competency score submissions | 20 |
| Competency career profiles | 20 |
| Employer org activated (`POST /api/employer/register`) | 1 |
| Employer candidates pooled (`POST /api/employer/candidates`) | 8 |
| Employer search operations (`GET /api/employer/candidates`) | 10 (80 rows returned) |
| Employer analytics read (`GET /api/employer/analytics`) | ✅ |

## Employer activation — schema bootstrap needed
`POST /api/employer/register` initially 500'd: its `ensureSchema` **ALTERs**
`employer_jobs` before that table exists, and `employer_jobs` is created lazily by a
**different** module (`recruiter-postings.ts`) on first hit. Hitting
`GET /api/career/recruiter-postings` bootstrapped `employer_jobs`, after which
employer activation, pooling, and search all succeeded. This is a real
cross-module ensure-schema ordering gap, documented for follow-up.

## Honest notes / caveats
- **100% demo data.** Nothing here is a real user, assessment, or candidate.
- **Shared dev/prod DB.** All of this activity lands in the production database (shared
  `DATABASE_URL`). Cleanup filter: `email LIKE '%@example.com'` across `users`,
  `capadex_sessions.guest_email`, `employer_candidates.email`, and the
  `candidate_master` family. **Do this before go-live.**
- **No deployment performed** (per user preference: STOP before deploy).

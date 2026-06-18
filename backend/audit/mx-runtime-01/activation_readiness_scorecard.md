# WS6 — Activation Readiness Scorecard
**Task:** MX-RUNTIME-01 · **Date:** 2026-06-17

> **Honesty framing (per project policy).** This scorecard measures **runtime-path
> activation** — "do the real code paths execute end-to-end and persist real rows?"
> It is substantiated by **demo data only** in a **shared dev/prod database**, with
> **no deployment performed**. Runtime-path activation and *commercial / real-world*
> activation are kept on **separate axes** and never composited (see §3).

## 1. Scorecard vs targets (runtime-path axis)
| Metric | Target | Measured | Status | Basis |
|---|---|---|---|---|
| **Activation** (systems with a live, exercised runtime path) | > 80% | **100%** (5/5) | ✅ | Career, CAPADEX, Competency, Employer, Candidate Master all driven end-to-end via HTTP/SQL-backfill |
| **Data** (systems holding non-zero runtime data) | > 80% | **100%** (5/5) | ✅ | every system has measured rows (WS1–WS4) |
| **Operational** (end-to-end operation success rate) | > 90% | **97.9%** (416/425 ops) | ✅ | only CAPADEX had failures (9 substrate-404s) |
| **Overall** (mean of the three axes) | > 90% | **99.3%** | ✅ | — |

### Per-system activation detail
| System | Runtime path | Data | Operational |
|---|---|---|---|
| Career Builder | ✅ register→save-profile→goals | 101 profiles / 101 goals | 100% |
| CAPADEX | ✅ start→respond→complete→report | 58 completed / 58 reports / 578 responses | 86% (9/65 start-404) |
| Competency | ✅ run-assessment→profile | 162 scores / 20 users / 20 profiles | 100% |
| Employer | ✅ register→pool→search→analytics | 4 orgs / 8 candidates / 10 searches | 100% |
| Candidate Master | ✅ additive schema + read-only backfill | 117 unified / 18 span ≥4 systems | 100% |

## 2. What moved the platform from "structurally complete" to "operationally active"
1. Applied unapplied migrations (`20260502_framework_tables.sql`, `20260508_score_trace.sql`)
   and restarted Backend API → CAPADEX boot-seed populated `sdi_items=680` and created
   `capadex_sessions/responses`.
2. Built idempotent HTTP drivers that exercise the **real** authenticated and anonymous
   endpoints (no SQL data inserts) — 425 runtime operations executed.
3. Bootstrapped the employer schema via its real recruiter endpoint, then activated an
   employer org and ran live candidate searches.
4. Added the additive Candidate Master layer and backfilled it read-only from live rows,
   proving cross-system identity unification (7 candidates span all 5 systems).

## 3. Separate axis — Commercial / real-world activation = **0%** (honest)
The runtime paths are live, but on the axes the business cares about:
- **Real users:** 0 (100% demo, all `@example.com`).
- **Real revenue / paid entitlements:** 0 (no payments exercised in this task).
- **Production deployment:** none (STOP-before-deploy honored).

Do **not** read the 99.3% above as "ready to sell." It means the machinery runs; it
does **not** mean real adoption exists.

## 4. Honest blockers / follow-ups (none fabricated away)
| # | Issue | Severity | Note |
|---|---|---|---|
| B1 | **Demo data sits in the shared prod DB** | High | Must purge `email LIKE '%@example.com'` (users, capadex guest_email, employer_candidates, candidate_master family) before go-live |
| B2 | CAPADEX concern×age catalogue gaps (9 start-404s) | Medium | Some concerns ("focus problems", "peer pressure") lack seeded `sdi_items` |
| B3 | Employer `ensureSchema` ALTERs `employer_jobs` before another module creates it | Medium | Cross-module ensure-schema ordering; bootstrap dependency on `recruiter-postings` |
| B4 | `users.id` is `varchar`, not `uuid` (FK drift) | Low | Career/memory FK migrations fail; runtime paths unaffected |
| B5 | Competency forecasting layers data-starved | Low | Single assessment per user; needs longitudinal repeats |

## 5. Verdict
**Runtime activation: ACHIEVED** — all four named targets exceeded on the runtime-path
axis, substantiated by measured rows from real code paths. **Commercial activation:
not claimed** (0 real users/revenue, not deployed). Recommended next step is owner
decision on demo-data purge + production deploy — **STOPPING here for approval; no
deploy performed.**

## Artifacts
`runtime_driver.mjs` · `topup.mjs` · `employer_driver.mjs` · `candidate_master.sql` ·
WS1–WS5 reports in this directory.

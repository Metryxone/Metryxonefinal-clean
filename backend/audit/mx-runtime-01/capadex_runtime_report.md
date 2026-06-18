# WS2 — CAPADEX Runtime Report
**Task:** MX-RUNTIME-01 · **Date:** 2026-06-17 · **Method:** anonymous HTTP runtime flow

## Activation status: ✅ ACTIVE (start → respond → complete → report)

The full anonymous CAPADEX assessment runtime is operationally active. Sessions are
created, answered, scored by the real engine, and reports generated — all via HTTP.

| Endpoint (real code path) | Result |
|---|---|
| `POST /api/capadex/session/start` | ✅ session + question bank returned |
| `POST /api/capadex/session/:id/respond` | ✅ responses persisted |
| `POST /api/capadex/session/:id/complete` | ✅ engine score computed |
| `GET  /api/capadex/report/:id` | ✅ report generated |

## Measured runtime data (live DB counts)
| Metric | Count |
|---|---|
| `capadex_sessions` total | **58** |
| `capadex_sessions` completed | **58** |
| `capadex_reports` | **58** |
| `capadex_responses` | **578** |
| Completed sessions tied to a candidate (`guest_email`) | **57** |

Target was 50 completions → **58 achieved**.

## Engine-score distribution (proof of real computation, not constant fill)
| Band | Count |
|---|---|
| High (≥80) | 2 |
| Mid (60–79) | 18 |
| Developing (40–59) | 28 |
| Low (<40) | 10 |

min = 26 · avg = 53.2 · max = 88 — a genuine spread, confirming the scoring engine
runs per-session rather than emitting a constant.

## Root-cause fix that unblocked activation
CAPADEX was previously 500-ing because migration `20260502_framework_tables.sql`
(creates `sdi_items`) was unapplied → the boot-seed threw on index creation →
`capadex_sessions`/`responses` were never created. Applying the migrations and
restarting Backend API let the boot-seed populate `sdi_items=680` and create the
session tables. `20260508_score_trace.sql` added the missing `score_trace` column so
`/complete` succeeds.

## Honest notes / caveats
- **9 start-404s (honest substrate gap).** Of the first 50 driver attempts, 9 failed
  at `session/start` with 404. These were concern/age combinations (e.g. "focus
  problems", "peer pressure" at certain ages) that have **no seeded `sdi_items`**.
  The top-up used the proven "exam stress" concern to reach the target. The gap is
  reported, not hidden: the catalogue does not yet cover every concern×age cell.
- **Demo data only.** `guest_email` values are `@example.com`; responses are random
  Likert values, so scores are structurally valid but not psychometrically meaningful.
- **Shared dev/prod DB** — same disclosure as WS1.

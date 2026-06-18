# MetryxOne — Top 10 Quick Wins

**Task:** MX-LAUNCH-98X-CRITICAL-BLOCKERS · 18 June 2026 · **Synthesis only.**
Quick win = high impact-to-effort, low regression risk, days-not-weeks. Each maps to a Top-20 blocker and cites its existing-audit evidence. None require new measurement.

| # | Quick win | Blocker | Effort | Risk | Why it's high-leverage | Evidence |
|---|---|---|---|---|---|---|
| 1 | **Reconcile EI gauge to one formula** — point `EIGauge` at `employabilityEngine.ts`; delete the 6-dim inline path | B03 | S | Low | Removes a visible "two different scores" trust defect on the flagship surface | CBL gap #3 |
| 2 | **Add auth + server-side org scoping** to `/api/m5` & `/api/career/workforce`; stop trusting `?org_id=` | B10 | S | Med | Closes a critical IDOR before any public exposure (re-verify residual unauth routes first) | EP D12 |
| 3 | **Label/gate `Math.random()` dashboards** — flag + "illustrative, not live" badge until backed | B14 | S–M | Med | Stops fabricated numbers reaching customers; honesty-contract compliant overnight | PA §5a, LR CB-5 |
| 4 | **Enable the safe prod flag wave** — set the display/intelligence `FF_*` with non-empty data in the deploy run command | B01 | S | Med | Makes the prod app match the demo for features that already have data | PP §3–§4 |
| 5 | **Backfill EI for the 101 existing profiles** via a one-shot batch over `mei-scoring-engine` | B02 | M | Med | Lights up the headline metric for the entire current population (abstain where inputs absent) | CB §4, CBL #1 |
| 6 | **Persist & surface recommendations** for all profiled users (batch write to `career_recommendations`) | B08 | M | Low | Turns "profile, no guidance" into actionable next-steps — a conversion driver | CB §5, CBL #5 |
| 7 | **Add the nightly snapshot scheduler** writing append-only `mei_score_history` | B17 | M | Low | Unblocks every trend/velocity tab and the re-engagement loop with one cron | CBL #7, LR HG-5 |
| 8 | **Persist Resume Studio server-side** (`GET/PUT /api/career/resume` + table) | B15 | M | Low | Stops silent data loss on the stickiest seeker feature; feeds intelligence | CBL #13, PA §5c |
| 9 | **Bootstrap `employer_jobs` + add the POST write path** so real postings can exist | B12 | S–M | Med | Single missing write route is the first broken link in the entire jobs→hire chain | EP D02/D14 |
| 10 | **Add a crisis human-notify hook + OTP/login rate-limit** | B20 | S–M | Med | Two small safety/security fixes that are launch-blocking on their own | CW #66–#76, LR HG |

## Sequencing note
Do **#1, #2, #3** first (days 1–3): they are pure trust/security/honesty fixes with no upstream dependency. **#5–#8** depend on the EI batch (#5) running first. **#9** is the smallest unlock on the employer/jobs chain but the full employer config still needs the larger B09/B11 work — keep expectations honest: the quick win opens the path, it does not finish the employer product.

## What is explicitly NOT a quick win
- Employer ATS backend (B09), employer accounts/commercial (B11), real monetization (B13), O*NET import (B06), realized-outcome validity (B04), k≥30 benchmarks (B07) — these are L/XL and/or population-bound. Listing them as quick wins would violate the honesty contract.

*STOP for approval — no deploy.*

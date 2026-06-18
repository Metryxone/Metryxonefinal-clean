# WC-L0D Deliverable 6 — Readiness Dashboard
_Generated 2026-06-09T14:43:30.470Z_

The seven WC-L0D measures, **before → after**, against the phase targets. Coverage and Confidence are
separate axes; **targets are not forced** — where a ceiling is lower, it is reported as the true
ceiling (honesty canon).

## Population
- Completed sessions: **9** · with a behaviour graph: **2** · emailed users: **3** · trend-eligible (≥2 completed): **2**

## The seven measures
| # | Measure | Before | After | Target | Met? |
|---|---|---|---|---|---|
| 1 | Behaviour Coverage (sessions ≥1 dim) | 22.2% | 22.2% | >70% | ❌ |
| 1b | — Construct coverage WITHIN graphed sessions | 0.0% | 62.5% | (FP3 fix) | ✅ lifted |
| 2 | Behaviour Persistence Coverage | 100.0% | 100.0% | >80% | ✅ |
| 3 | Trend Coverage | 0.0% | 0.0% | >50% | ❌ |
| 4 | Trend Confidence | 0.00 | 0.00 | (informative) | — |
| 5 | User Intelligence Impact (sessions gaining a construct dim) | 0 | 2 | (informative) | ✅ |
| 6 | Personalization Impact (reach) | 22.2% | 22.2% | >88% | ❌ |
| 7 | Longitudinal Readiness Impact | 0.0% | 0.0% | >80% | ❌ |

## What WC-L0D fixed (real, measurable)
- The **FP3 structural vocabulary mismatch is eliminated.** Construct-dim cells went from
  **0/36 → 5/36** overall, and
  **0.0% → 62.5%** within graphed sessions. The four
  construct dimensions are now **reachable** wherever a mapped concern signal exists.

## Why the headline targets are NOT met (true ceiling, not inflated)
The four headline targets (Behaviour >70%, Trend >50%, Personalization >88%, Longitudinal >80%) are
**session-/user-level reach** metrics, and reach is bounded by **graph coverage** — only
**2/9** completed sessions have any behaviour graph (WC-L0C **FP1** capture
gap + **FP2** activation/graph gap). Those gaps are **out of WC-L0D scope** (WC-L0D aligns the
namespace; it does not change capture or graph construction). So:
- Behaviour Coverage stays **22.2%** (≤ graph coverage 22.2%).
- Trend & Longitudinal stay **0.0%** — no user has ≥2 *graphed* sessions.
- Personalization reach stays **22.2%**.

**To reach the headline targets, WC-L0C's FIX 2 (close the capture/activation/graph gap) is required
in addition to this alignment.** WC-L0D is necessary but not sufficient — and that is reported
honestly rather than gamed.

## Activation note
This dashboard is a **read-only simulation** of flag-ON (`FF_BEHAVIOUR_NAMESPACE_ALIGNMENT`) over
the live graphs — **nothing was written**. To realise the AFTER state on persisted rows: enable the
flag and re-run the existing WC-L0 backfill (`scripts/wc3/wcl0-backfill.ts`), then the behaviour
trend backfill. No deploy performed; **STOP FOR APPROVAL**.

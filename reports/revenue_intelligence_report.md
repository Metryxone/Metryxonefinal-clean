# Revenue Intelligence — Operational Report

**Date:** 2026-06-21 · **Environment:** development · **Status:** ✅ Operational

> Coverage vs Confidence reported separately. Revenue math and segmentation are proven; live revenue is ~0 in dev (no real paid volume).

## Purpose
Aggregates collected revenue across segments (B2C, institution, employer, recurring, one-time), computes totals and geography breakdowns, and forecasts recurring revenue — without ever fabricating an unmeasurable rate.

## Architecture
- **Flags:** `commercialRevenueIntelligence` (analytics), `commercialRecurringRevenue` (MRR / renewal forecast via last+slope, ≥2 periods or abstain).
- **Substrate:** `capadex_payments` (paid), `comm_subscriptions` (recurring), invoice rows.
- **Surface:** `/api/admin/commercial/revenue/*`, flag-OFF → 503; SuperAdmin Revenue tab hidden when OFF.

## Evidence (`smoke-revenue-intelligence-66.ts` — 20 passed, 0 failed)
- B2C customer union spend == **₹1,500** (exact reconciliation).
- Segmentation: institution segment ≥ ₹1,000; employer segment ≥ ₹1,000; `by_institution` lists the seeded institution; `by_employer` lists the seeded employer.
- Totals: **total = recurring + one-time** (identity holds); one-time collections ≥ ₹500.
- **Never-fabricate honesty:** not degraded on healthy substrate; geography `coverage_pct` is a real number.
- Geography source filtering: ZZ geography == ₹700 only (manual rows excluded, `place_of_supply` fallback applied); ZZ invoice count == 1.
- Flag-OFF: `/revenue/ping` and `/revenue/analytics` gated (503/401, not 200).

## Coverage vs Confidence
| Axis | Result | Basis |
|------|--------|-------|
| Structural / Coverage | ✅ Operational | Segmented totals, geography fallback, total-identity, no-fabrication all proven |
| Activation / Confidence | ⚠️ ~0 in dev | All figures above derive from seeded ephemeral rows; live revenue requires production sales |

## Honest gaps
- Recurring revenue forecast uses **last+slope** and **abstains below 2 periods** — correct, but means no forecast is emitted until a real recurring history accrues.
- Live revenue is ₹0 in dev; the dashboards will read honest zeros until production sales occur.

## Verdict
**Revenue intelligence operational ✓** — segmentation, totals identity, geography handling, and forecast-abstention all verified; figures will populate from real collections in production.

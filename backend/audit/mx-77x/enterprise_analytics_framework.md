# MX-77X · Section 13 — Enterprise Analytics Framework

**Status:** Composer-backed analytics surface (read-only, flag-gated).

## What "enterprise analytics" means here
A read-only analytical fold over the 7 workforce views + TIG, surfaced in the SuperAdmin console.
It COMPOSES existing engines (never recomputes) and reports four axes SEPARATELY:

| Axis | Definition | Source |
|---|---|---|
| **Coverage** | how much data exists (row counts per view) | per-view `data.coverage` |
| **Confidence** | how trustworthy/sufficient (k-anon, ≥2-point trends, calibration state) | per-view notes |
| **Evidence** | provenance (engines + tables that produced each number) | per-view `provenance` |
| **Prediction** | trend direction + clamped `forecast_next` | talent-forecasting / readiness |

## Cross-view roll-ups (honest)
- **Views available / abstained** (overview summary) — the headline activation metric.
- **Signal coverage** — risk 60 · ai-exposure 340 · obsolescence 325 · market 94 (richest).
- **Org-grain capability** — capability indices 5 (department roll-up abstains at 0).
- **TIG graph scale** — 72 nodes / 1680 edges / 40 intelligence / calibration 5.

## Hard honesty rules (analytics MUST obey)
- **Never composite a single "Enterprise Score"** while department evidence is 0 — that would
  fabricate org-level coverage. Report sub-indices, abstain on the roll-up.
- **No accuracy / hit-rate** without realized outcomes (Validation Loop ≥30 non-demo) — not met,
  so predictive accuracy is explicitly NOT claimed.
- **k-anonymity k≥30** on every cohort statistic.
- **null propagates** — an unmeasured input makes the derived metric null, never 0.
- **Demo data excluded** from any certified metric (`@example.com` / `demo_org` flagged).

## Reachability ceiling
- Analytics is bounded by the composer's reachability: market-derived predictive signals are broad
  and trustworthy as *direction*; org-resident analytics (headcount, attrition ground-truth,
  department capability) are structurally reachable but UNFED — disclosed per view.

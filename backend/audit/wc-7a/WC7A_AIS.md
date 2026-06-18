# WC-7A — AIS 2.0: Activation Intelligence Score (Output #9)

A single composite that expresses how mature the platform's **activation machinery** is across
the eight activation layers. **Distinct from WC-2's Assessment Intelligence Score** (see
WC7A_README "Naming honesty") — different unit, never compared.

> All scores below are **grounded** in the real-vs-stub inventory (WC7A_LAYER_AUDIT). All
> **projected** (post-improvement) numbers are **directional design estimates** — no activation
> telemetry exists yet, so nothing here is measured.

---

## Definition

```
AIS 2.0 = Σ (layer_maturity_i × weight_i)   for i = 1..8
```

Maturity per layer comes from the WC7A banding rubric (REAL+consumed 85–100 · REAL-but-idle
60–80 · PARTIAL 40–65 · STUB 15–40 · ABSENT 0–15), evidence-weighted across each layer's
mechanisms.

### Weights

Two weightings are reported for honesty (the headline uses **equal weight**, the simplest and
least arguable; the **activation-centrality** variant shows where business value concentrates):

| Layer | Equal weight | Activation-centrality weight | Rationale for centrality weight |
|-------|-------------|------------------------------|---------------------------------|
| 1 Personalization | 0.125 | 0.10 | quality multiplier, not a gate |
| 2 Longitudinal | 0.125 | 0.10 | retention multiplier |
| 3 Decision | 0.125 | **0.18** | the conductor; gates 4–7 |
| 4 Product Activation | 0.125 | 0.14 | the value delivered |
| 5 Growth Plan | 0.125 | 0.12 | core sustained value |
| 6 Mentor | 0.125 | 0.10 | high-value, near-ready |
| 7 Subscription | 0.125 | **0.16** | the revenue gate (DC-2 tension) |
| 8 Future Readiness | 0.125 | 0.10 | highest-ceiling, lowest-now |

---

## Current AIS 2.0 (grounded)

| # | Layer | Maturity | Dominant reason |
|---|-------|----------|-----------------|
| 1 | Personalization | 78 | core REAL; L5A/L5B idle; CB partial |
| 2 | Longitudinal | 75 | engines REAL; capture/scheduling stubbed |
| 3 | Decision | 57 | ingredients REAL; orchestrator absent |
| 4 | Product Activation | 60 | real products + 2 stubs; no deep-link |
| 5 | Growth Plan | 65 | M5 REAL but not seeded by the decision |
| 6 | Mentor | 70 | REAL; not decision-driven; auth hole |
| 7 | Subscription | 45 | billing REAL; no mapping/entitlement |
| 8 | Future Readiness | 40 | B2B data layer absent |

- **Equal-weighted AIS 2.0 = 61 / 100** (mean of the eight).
- **Activation-centrality AIS 2.0 = 59 / 100** (Decision + Subscription, the two heaviest gates,
  are also two of the lowest-scoring — so the centrality weighting pulls the composite *down*,
  confirming the gaps sit exactly where they matter most).

---

## Trajectory: current → target

Maturity per layer after each tier (directional estimates; see WC7A_MINIMAL_SET for the moves):

| # | Layer | Now | +Tier A (small wiring) | +Tier B (commercial loop) | +Tier C (large builds) |
|---|-------|-----|------------------------|---------------------------|------------------------|
| 1 | Personalization | 78 | **90** | 90 | 90 |
| 2 | Longitudinal | 75 | **90** | 90 | 90 |
| 3 | Decision | 57 | 85 | 87 | **90** |
| 4 | Product Activation | 60 | 72 | 78 | **90** |
| 5 | Growth Plan | 65 | **88** | 88 | 90 |
| 6 | Mentor | 70 | 86 | 88 | **90** |
| 7 | Subscription | 45 | 55 | **85** | 90 |
| 8 | Future Readiness | 40 | 45 | 55 | **90** |
| | **Equal-weighted AIS 2.0** | **61** | **76** | **83** | **90+** |

### Eligibility to 90% — which layers actually need a large build

The Tier-C column above shows every layer at 90, but **not every layer's final points come from
the large C1/C2 builds.** For Layers 3/5/6/7 the last 2–5 points are **small polish**; only
Layers 4 and 8 genuinely depend on Tier-C large builds.

| # | Layer | Highest tier needed for 90% | Large (greenfield) build required? |
|---|-------|------------------------------|------------------------------------|
| 1 | Personalization | A | No |
| 2 | Longitudinal | A | No |
| 3 | Decision | A + minor polish | No |
| 5 | Growth Plan | A + minor polish | No |
| 6 | Mentor | A/B + minor polish (B2C path) | No* |
| 7 | Subscription | B | No |
| 4 | **Product Activation** | **C** | **Yes — complete 2 stub products** |
| 8 | **Future Readiness** | **C** | **Yes — institutional B2B data layer** |

\* Mentor's B2C path reaches ~90 with small polish; only its *cohort/bulk* path shares the C2 B2B
build. **Six layers are eligible for 90% without any large build; exactly two are not.**

### Reading the trajectory honestly

- **Tier A (small wiring) buys the most per unit of effort:** +15 AIS points (61→76), and it
  fully tops out the two intelligence layers (1, 2) and nearly tops Growth Plan and Mentor —
  largely by **consuming intelligence that is already built but idle** (L5A/L5B, adapter drivers,
  longitudinal detections) plus standing up the read-only orchestrator.
- **Tier B (one medium commercial loop) buys +7 (76→83)** and is the highest-ROI *revenue* move
  (Subscription 45→85), resolving the DC-2 central tension.
- **There is no path to AIS ≥ 90 without Tier C.** After Tiers A+B the composite stalls at **83**,
  held down by the two **hard-floor** layers — Product Activation (78, capped by two stub
  products) and Future Readiness (55, capped by the absent B2B data layer). Closing them is a
  LARGE build, not wiring. **Any claim of a small-only route to 90% would be fabricating readiness
  for these two layers.**

### Ceiling note (honesty, echoing WC-2's AIS-1.0 ceiling discipline)

90%+ **system-wide** is *reachable* (unlike WC-2's >95 Assessment-AIS, which was mathematically
capped) — but only because Tier C is explicitly included. The realistic **small-and-medium-only**
ceiling is **AIS 2.0 ≈ 83**. State the target as: **"AIS 2.0 ≥ 83 via wiring + commercial loop;
≥ 90 requires the two product/B2B builds."**

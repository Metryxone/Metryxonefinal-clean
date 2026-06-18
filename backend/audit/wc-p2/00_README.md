# WC-P2 — Personalization Consumption Activation (MEASURED)

**Type:** Implementation + measurement. The four WC-P2 levers are built (additive, flag-gated,
byte-identical when OFF). This folder reports **two independent metrics**, computed by invoking the
runtime read-only builders with every WC-P2 flag ON in the measurement process. No telemetry, no
estimates, no fabrication.

Generated: 2026-06-08T15:51:32.846Z

## The two metrics (reported separately — never merged)
1. **Consumption Rate** — did the surface **consume** the intelligence it was given? Provenance that
   the lever read real resolved intelligence and emitted a grounded block. Honest `false` where the
   session genuinely has none to consume.
2. **Activation Readiness** — did the consumed intelligence resolve to a **fully-fired, actionable**
   output? The stricter downstream state; honestly data-limited at cold start.

## Population
- **Headline = completed sessions** (`status='completed'`): **9** sessions — the population that
  actually produces decisions / reports / recommendations.
- **Transparency = all sessions**: **27** (incl. `in_progress`/`replaced` that can never resolve a
  decision). Shown alongside so the completed-only headline is never read as cherry-picking.

## Levers
- **A — Decision-driven activation** (`buildActivationEnvelope`): Product / Growth / Mentor /
  Commercial slots. Consumption = the slot was evaluated against the `UnifiedDecision`
  (product route mirrors `decision.route`; bridges produced a grounded reason, not a flag-off
  sentinel). Readiness = `ready:true`.
- **B — Report personalization** (`report.personalization`): persona + behaviour profile.
  Consumption = ≥1 real source. Readiness = behaviour graph resolved (richer than persona-only).
- **C — Recommendation personalization** (`recs.personalization_context`): stage / outcome / journey.
  Consumption = ≥1 layer resolved. Readiness = all three resolved.
- **D — Longitudinal consumption** (`report.longitudinal`): per-metric trend + forecast.
  Consumption = read ≥1 real snapshot. Readiness = trend established (≥2 readable points).

## Headline (completed sessions, 9)
| Lever / slot | Consumption Rate | Activation Readiness |
|---|---|---|
| A · Product activation | 9/9 (100.0%) | 0/9 (0.0%) |
| A · Growth Plan | 9/9 (100.0%) | 0/9 (0.0%) |
| A · Mentor | 9/9 (100.0%) | 9/9 (100.0%) |
| A · Commercial | 9/9 (100.0%) | 0/9 (0.0%) |
| B · Report personalization | 2/9 (22.2%) | 2/9 (22.2%) |
| C · Rec personalization | 9/9 (100.0%) | 0/9 (0.0%) |
| D · Trend + forecast | 0/9 (0.0%) | 0/9 (0.0%) |
| **Mean (independent)** | **74.6%** | **17.5%** |

- **All activations decision-driven:** 9/9 (100.0%) of completed
  sessions have an envelope whose product slot mirrors `decision.route` and a non-empty `composed_from`.

## Deliverables
1. `01_consumption_metrics.{md,csv}` — both metrics per lever + per-session matrix
2. `02_lever_a_activation.md` — decision-driven consumption vs readiness + reason histograms
3. `03_lever_b_report_personalization.md` — persona + behaviour
4. `04_lever_c_rec_personalization.md` — stage/outcome/journey
5. `05_lever_d_longitudinal.md` — trend/forecast (honest degradation)
6. `06_consumption_summary.md` — two independent roll-ups + success-criteria assessment

> **Honesty note:** Consumption and Readiness are reported INDEPENDENTLY and never merged. Any low
> figure is a real, grounded finding (e.g. anonymous sessions carry no persona; no repeat-session
> snapshots exist yet so no trend can form). Nothing is inflated or fabricated to hit a target.

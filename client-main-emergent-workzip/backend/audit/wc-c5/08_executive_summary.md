# WC-C5 · Deliverable 8 — Executive Summary
_Generated 2026-06-10T07:53:25.872Z. WC-C5 Renewal Intelligence Audit — AUDIT ONLY · read-only · recomputed from runtime._

## Question
Does CAPADEX currently possess enough intelligence, history, behavioural evidence, engagement signal, and commercial signal to support subscription **renewals** and **recurring revenue**?

## Answer (4 separate axes — never combined)
| Axis | Result |
|---|---|
| **Structural Readiness** | **70%** — most renewal parts exist; decision (scoring/retention) + activation (reminder/recurring) layers are absent |
| **Activation Readiness** | **0%** — nothing can fire: 0 renewable population, 0 forecastable series, 0 renewal events |
| **Coverage** | renewable population **not_measurable** (0/0 — not_measurable: empty denominator (0/0)); renewal coverage **not_measurable** |
| **Confidence** | **VERY_LOW** — no renewal ground truth (paid=0, subs=0) |

## Success criteria
- **Current Renewal Readiness:** Structural **70%** / Activation **0%** (pair, not blended).
- **Current Renewal Coverage:** **not_measurable** — renewable population = 0 (0/0).
- **Current Renewal Signal Coverage:** **not_measurable** over the renewable population; forecastable series 0% (0/4); behavioural/engagement repeat 40% (2/5) (labelled, not commercial).
- **Current Retention Readiness:** commercial **not_measurable** (0 paid cohort); behavioural repeat 40% (2/5).
- **Earliest point recurring revenue becomes viable:** a precondition CHAIN, not a date —
   - 1. First PACKAGE sale → an active student_subscription with a finite expiry_date (B2C ladder cannot renew by design).
   - 2. One validity window elapses → renewal-engine surfaces due_soon (≤14d) / in_grace (≤7d) candidates.
   - 3. ≥2 monthly points accrue per series → commercial-forecast-inputs flips a series to forecastable.
   - 4. ≥2 sessions per PAID identity → behaviour/longitudinal continuity becomes renewal-relevant.
   - 5. A reminder→repurchase (or recurring) loop is wired → a candidate can be ACTED on as revenue.
   - NB: the 6 pending B2C payments are the nearest revenue lever but are one-time (adjacent to renewal, not recurring).
- **What is missing to reach 90% Renewal Readiness:**
   - Structural: 90% Structural is reachable by ENGINEERING: wire the 3 absent cells (renewal scoring composition, renewal reminder loop, recurring/repurchase loop) and exercise the package sales flow e2e (gated-real→real).
   - Activation: 90% Activation CANNOT be granted by an audit or engineering pass — it is a function of real package subscriptions sold and renewed over time (live renewable population, forecastable series, acted-on candidates).
- **Highest-leverage intervention:** Establish a RENEWABLE POPULATION first — sell package subscriptions (the only model with renewal semantics; the earning B2C ladder is renewal_not_applicable by design). Every downstream renewal signal/score/forecast/retention metric is currently zero-denominated by the empty substrate. The reminder→repurchase loop is the necessary SECOND step — worthless without a population. Sequencing: population, then activation loop.

## Bottom line
The renewal **engines are real but dormant over an empty substrate**, and two activation layers (reminders, recurring/repurchase) plus the decision layer (scoring, retention) do not exist. The single structural truth that frames everything: **the model that earns cannot renew, and the model that can renew has no sales.** Recurring revenue becomes viable only after a renewable population is established (highest-leverage intervention) and a reminder→repurchase loop is wired. No implementation, schema change, or deployment was performed.

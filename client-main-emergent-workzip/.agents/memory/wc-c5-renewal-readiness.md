---
name: WC-C5 renewal-readiness audit
description: How to audit renewal / recurring-revenue readiness on the CAPADEX commerce stack honestly — the renewable-population zero-denominator trap, the binary Activation axis, and the structural truth that the earning model can't renew.
---

# WC-C5 Renewal Intelligence audit — durable rules

Measuring "can this platform RENEW subscriptions / earn recurring revenue?" over the WC-7C
engines (subscription-lifecycle / renewal-engine / commercial-forecast-inputs / entitlement-engine)
reusing WC-L0→WC-C4. Four SEPARATE axes (Structural / Activation / Coverage / Confidence), never combined.

## The structural truth that frames everything
- **The model that EARNS cannot renew; the model that CAN renew has no sales.** The B2C stage
  ladder (`capadex_payments`) is ONE-TIME by design (`renewal_not_applicable_b2c`); the only
  renewable model is validity-window packages (`student_subscriptions`, `expiry_date`) — and it
  has **0 live rows**. So the renewable population is 0.
- **Why it matters:** every renewal coverage/signal/retention metric measured over the renewable
  population is **not_measurable (0/0)** — report `not_measurable`, NEVER 0% or 100%. There is no
  renewal signal about subscriptions that do not exist.
- **Highest-leverage intervention = establish a renewable population FIRST** (sell package subs).
  The reminder→repurchase (or recurring) loop is the necessary SECOND step — worthless without a
  population. Sequencing matters; never recommend wiring the loop before there is anyone to renew.

## Axis discipline (extends WC-C1 dual-axis)
- **Activation = per-capability BINARY "can fire on live renewal data NOW?" + reason** — NOT a
  population fraction (that's Coverage). Keep the two from overlapping. Make the "can fire" check
  **data-driven** (e.g. paid identities with ≥2 sessions > 0), never hardcoded `false`, or a re-run
  after the first real sales silently understates Activation.
- **Structural = deterministic tier map** (real5·gated-real4·partial3·stub2·absent1) over a
  capability checklist declared UP FRONT *including the absent cells*: renewal scoring composition,
  retention/churn cohort, reminder loop, recurring/repurchase loop are all **absent(1)** here. Cap
  unexercised paths (package sales flow, entitlement-enforcement gate) at **gated-real(4)**.
  Result ≈ **70%** — honest because pipeline stages A (substrate/lifecycle) + B
  (identification/signal inputs) exist, but C (decision/scoring) and D (activation) do not.
- **90% Activation CANNOT be granted by an audit/engineering pass** — only real package subs sold
  and renewed over time. 90% Structural IS reachable by wiring the absent cells. Always state which
  axis "missing for 90%" refers to.

## Honesty traps to mirror
- **Reconcile prior renewal claims:** WC-C1's renewal report called renewal "structurally complete"
  while its own capabilities list said reminders MISSING — a latent overclaim. Correct to **PARTIAL**.
- **forecastable_series is a MEASURED 0%** (denominator = the 4 defined series is non-empty), unlike
  the 0/0 renewable-population metrics which are not_measurable.
- **Earliest recurring-revenue viability = a precondition CHAIN, not a date** (first sale → active
  sub w/ finite expiry → window elapses → due_soon/in_grace candidate → ≥2 monthly points → loop wired).
- Keep behavioural substrate (wcl0 dims, repeat-engagement) OUT of every COMMERCIAL %, labelled
  behavioural; report the ≥10-session identity dual-view (with/without), "likely test" = unverified.

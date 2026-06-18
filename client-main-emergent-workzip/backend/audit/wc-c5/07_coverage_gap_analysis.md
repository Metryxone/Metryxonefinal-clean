# WC-C5 · Deliverable 7 — Coverage Gap Analysis
_Generated 2026-06-10T07:53:25.872Z. What is missing, and which axis each gap belongs to._

## Structural capability checklist (deterministic tier map · grounding traceability)
| Capability | Pipeline stage | Tier | Grounding source |
|---|---|---|---|
| expiry_validity_tracking | A_substrate_lifecycle | real (5/5) | schema (WC-C1 §subscription) |
| lifecycle_state_classifier | A_substrate_lifecycle | real (5/5) | WC-C1 d03/commercial-wave-2 |
| package_sales_flow | A_substrate_lifecycle | gated_real (4/5) | WC-C1 commercial-readiness memory (unexercised=unverified) |
| renewal_candidate_engine | B_identification_signal | real (5/5) | WC-C1 d07 |
| behaviour_signal_engine | B_identification_signal | real (5/5) | WC-L0 / WC-L0b |
| longitudinal_value_engine | B_identification_signal | real (5/5) | WC-L1 |
| forecast_input_contract | B_identification_signal | real (5/5) | WC-C1 d09 / WC-L2 |
| renewal_scoring_composition | C_decision_scoring | absent (1/5) | grep: no renewal-score/propensity engine |
| retention_cohort_analysis | C_decision_scoring | absent (1/5) | grep: no commercial retention engine |
| entitlement_enforcement_gate | D_activation | gated_real (4/5) | WC-C4 |
| renewal_reminder_loop | D_activation | absent (1/5) | grep: no reminder/cron wired; WC-C1 d07 "reminders MISSING" |
| recurring_or_repurchase_loop | D_activation | absent (1/5) | renewal-engine.ts / subscription-engine.ts; grep: no auto-renew |

**Structural Readiness = mean(tier)/5 = 70%.**

## Gaps by axis (never combined)
### Structural gaps (closable by engineering)
- `renewal_scoring_composition` — absent. Compose existing WC-L0/L1/engagement inputs into a per-identity renewal propensity.
- `renewal_reminder_loop` — absent. Wire a reminder/notification job to the existing renewal-engine candidate output.
- `recurring_or_repurchase_loop` — absent. A package-repurchase path (or recurring billing) converting a candidate into a new paid term.
- `package_sales_flow` / `entitlement_enforcement_gate` — gated-real. Exercise the sales flow e2e and enable enforcement to move toward real.

### Activation gaps (NOT closable by engineering — require real revenue over time)
- 0 renewable population, 0 forecastable series, 0 renewal events. These resolve only as real package subscriptions are sold and renewed.

### Coverage gaps
- Every renewal-population coverage is **not_measurable (0/0)**; behavioural repeat coverage is 40% (2/5) but does not translate to renewal coverage (0 paid).

### Confidence gap
- Band **VERY_LOW** — no renewal ground truth exists; any inference is directional.

## What is missing to reach 90% Renewal Readiness
- **90% Structural** (reachable by engineering): 90% Structural is reachable by ENGINEERING: wire the 3 absent cells (renewal scoring composition, renewal reminder loop, recurring/repurchase loop) and exercise the package sales flow e2e (gated-real→real).
- **90% Activation** (NOT reachable by audit/engineering): 90% Activation CANNOT be granted by an audit or engineering pass — it is a function of real package subscriptions sold and renewed over time (live renewable population, forecastable series, acted-on candidates).

---
name: Commercial Wave 2 — commercial lifecycle readiness
description: Compose-only commercial lifecycle layer (entitlement/renewal/upsell/lifecycle/forecast-inputs) audited dual-axis over an empty revenue substrate; honest ceilings, never composite.
---

# Commercial Wave 2 — commercial lifecycle readiness

Additive, flag-gated, compose-only layer over CAPADEX's commercial surfaces. 5 PURE resolvers in `backend/services/wc7c/` (no new tables, no new intelligence engines); flags gate ONLY the consumer boundary (admin route + audit script), not the engines.

**Dual-axis readiness is mandatory — never composite into one number.**
- Axis A Structural = deterministic per-capability rubric real=5/gated-real=4/partial=3/stub=2/absent=1 over the 6 commercial capabilities → N/30, measured before→after with a per-cell justification appendix.
- Axis B Data/Activation = measured booleans/ratios over the live substrate; a 0/0 ratio is "n/a", NEVER 100%.
- Report them side by side ("Structural X% · Data/Activation Y%"), never blended.

**Why cap "after" at gated-real (4), never real (5):**
**Why:** a flag that defaults OFF, with no live user-facing consumer and no real data, is gated-real, not real. Reaching "real" needs un-gating + wiring a consumer + actual data.
**How to apply:** an additive wave's structural ceiling is ~80% (all gated-real); claiming 95% would be a silent upgrade. Flag any brief headline the data can't support (e.g. "72-75%→95%") as a discrepancy and measure the real number — never restate the estimate.

**Empty-substrate honesty:** when the revenue ledger is empty (0 paid rows, 0 packages, 0 subscriptions), Data/Activation ≈ 0 and that empty substrate is the single binding constraint — every capability is structurally complete yet cannot show data readiness. Name the constraint; do not inflate.

**Commerce invariants (carried from WC-7C):** ledger/ownership reads fail CLOSED (read error → `billing_ledger_unavailable` / entitles-nothing, never "owns nothing"); upsell requires a PRIOR PAID purchase (0 paid → 0 eligible, a true ceiling not a wiring gap); D6 gating (conf≥0.7 AND ambiguity low); never sell into a stub; STAGE_PRICES {CAP_INS:499,CAP_GRW:999,CAP_MAS:1999} kept lockstep with capadex-payments.ts.

**Domain gotchas:**
- B2C stage ladder has NO renewal (`renewal_not_applicable_b2c`); renewal lives ONLY in the validity-window package model (`student_subscriptions.expiry_date`).
- Renewal `in_grace` MUST exclude cancelled subs (`status IS DISTINCT FROM 'cancelled'`, NULL-safe) or a recently-cancelled sub falsely counts as a renewal candidate (latent bug — moot at 0 rows, real once data arrives).
- Forecast inputs emit the WC-L2 ≥2-point CONTRACT + measured availability, NEVER a fabricated series; the revenue and count series share monthly support by construction (same table/filter) yet remain two distinct forecast targets.

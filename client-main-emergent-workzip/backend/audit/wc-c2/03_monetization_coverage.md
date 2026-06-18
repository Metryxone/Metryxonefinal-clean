# WC-C2 · Deliverable 3 — Monetization Coverage Report
_Generated 2026-06-10T05:36:05.041Z. Two metrics, reported side by side, **never composited**, **never silently swapped**._

## (a) Product Monetization Readiness — the WC-C1 metric (6 products × 5 cells)
> This name stays bound EXCLUSIVELY to this metric. It is the apples-to-apples answer to the objective.

**Now: 13.3% (4/30) · After entitlement keystone: 20% (6/30) · Activation 0%**

| Product | priced_sku | order_path | pay→entitlement | access_enforced | fulfillment | now |
|---|---|---|---|---|---|---|
| CAPADEX stage ladder | ✅ | ✅ | ✅ | ❌ | ❌ | 3/5 |
| LBI | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 |
| Employability Index / Passport | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 |
| Career Builder | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 |
| Mentor Intelligence | ❌ | ❌ | ✅ | ❌ | ❌ | 1/5 |
| Longitudinal (repeat-assessment trend) | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 |

**The entitlement keystone moves this metric 13.3% → 20% only** (CAPADEX gains `access_enforced` + `fulfillment`-provisioning; nothing else moves). **Reaching >90% on this metric is a PRODUCTIZATION decision, not entitlement work** — it would require turning LBI, Employability, Career Builder and Longitudinal into fully-wired SKUs and building the mentor stub. The audit does **not** recommend doing that solely to move a number.

## (b) Live-SKU Entitlement Wiring Readiness — PROPOSED RE-BASELINE (your decision)
> A DIFFERENT metric with a DIFFERENT name. The audit does **not** adopt it; it asks you to.

Scoped to the only complete SKU — the **CAPADEX stage ladder** — this metric measures how well the live SKU is wired for purchase→access:

**Now: 60% (3/5) · After entitlement keystone: 100% (5/5) · Activation 0%**

The entitlement keystone takes the live SKU from 60% → 100% **structural**. **Package SKU is excluded** because the email-keyed keystone cannot lift it (deriveEntitlement excludes packages · no feature map · child-keyed grants).

### Decision required
If you approve re-baselining "monetization readiness" to the live-SKU set, the entitlement keystone gets you to ≥90% **on that re-baselined metric**. If you keep the original 6×5 metric, the keystone gets you to **20%** and >90% needs a separate productization programme. **Both numbers are above; pick the denominator deliberately.**

## Activation (both metrics)
0% and not movable by configuration — it requires real Razorpay keys + real paid volume. Structural wiring is necessary but not sufficient for activation.

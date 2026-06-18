# WC-C6A · Deliverable 3 — Pricing Readiness Report
_Generated 2026-06-10T08:50:05.250Z. read-only._

## Capability tier map — L2 pricing
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
| `b2c_pricing_model` | B2C ladder pricing model (lockstep constants) | real (5/5) | ✅ fires | Prices defined and applied by the live order route. |
| `package_pricing_definition` | Package pricing definition (price + validity actually set) | partial (3/5) | — dormant | 0 priced products (price never set) |
| `pricing_tiers_discounting` | Pricing tiers / discounting / proration / multi-currency | absent (1/5) | — dormant | capability absent in code |

## Findings
- **B2C ladder pricing is REAL & live**: CAP_INS ₹499 · CAP_GRW ₹999 · CAP_MAS ₹1999 (lockstep constants).
- **Package pricing is PARTIAL**: `price` / `validity_days` columns exist (schema real) but are **nullable, never populated**, and the **seed omits them** → no package price/validity is ever defined. Priced package products: **0/0** (**not_measurable** (0/0 — not_measurable: empty denominator (0/0))).
- **No pricing tiers / discounting / proration / multi-currency** engine (absent).

> Pricing readiness for the renewable model is gated by the empty, unpriced catalog — not by a missing pricing primitive. The price column is ready; no price has ever been set.

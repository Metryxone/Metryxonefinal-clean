# WC-C6A · Deliverable 5 — Upgrade Path Report
_Generated 2026-06-10T08:50:05.250Z. read-only._

## Capability tier map — L5 ladder / upgrade
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
| `progressive_ladder` | Progressive ladder (CAP_CUR→INS→GRW→MAS) | real (5/5) | — dormant | 0 paid climbs → ladder progression never fires commercially |
| `upgrade_offer_engine` | Upgrade path engine (next-rung offer) | gated_real (4/5) | — dormant | flag commercialActivation OFF + 0 owners to offer an upgrade to |
| `cross_package_upgrade` | Cross-package upgrade / proration | absent (1/5) | — dormant | capability absent in code |

## Findings (Structural / Activation split — required)
- **B2C ladder is upgradable — Structural YES / Activation NO**: the offer-engine recommends the next rung (CAP_INS→GRW→MAS), but the flag `commercialActivation` is OFF and there are **0 owners** to offer an upgrade to.
- **Packages have NO upgrade path** (absent): flat, unordered SKUs; no cross-package upgrade or proration.

> "Upgradable" is true only for the one-time ladder, and only structurally. The renewable model has no upgrade concept at all.

# Commercial Wave 2 · Deliverable 4 — Subscription Lifecycle Report
_Generated 2026-06-10T03:28:35.624Z. Read-only projection (no persistence — fully recomputed from status + expiry)._

## B2C stage ladder (`capadex_payments`, total 6)
| State | Count |
|---|---|
| pending | 6 |
| fulfilled (paid) | 0 |
| abandoned (failed) | 0 |

## Package subscriptions (`student_subscriptions`, total 0)
| State | Count |
|---|---|
| active | 0 |
| expiring_soon (≤ 14d) | 0 |
| expired | 0 |
| cancelled | 0 |

**Honest finding:** all 6 ladder rows are **pending** (zero fulfilled), and there are zero package subscriptions. The lifecycle state machine is structurally complete but the substrate is pre-revenue. Degraded=false.

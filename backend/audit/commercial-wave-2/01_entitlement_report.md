# Commercial Wave 2 · Deliverable 1 — Entitlement Report
_Generated 2026-06-10T03:28:35.624Z. Emails one-way sha256-masked. Read-only; no DB writes._

**What it does:** resolves what a billing identity is entitled to from paid stages (`capadex_payments` status='paid') + active package grants. **Fail-CLOSED:** a ledger read error → `billing_ledger_unavailable` (entitles nothing), never mistaken for "owns nothing".

## Coverage (data axis)
| Metric | Value |
|---|---|
| Paying identities | 0 |
| Entitled identities | 0 |
| Entitlement coverage | n/a |
| Active package grants | 0 |
| Degraded | false |

**Owned-stage distribution:** — (no paid stages)

**Honest ceiling:** with 0 paid rows, coverage is **n/a (0/0)** — never reported as 100%. The resolver is deterministic and fail-closed, so once any paid row exists, coverage of paid identities → 100% structurally. Package entitlement-by-email is an honest modelling gap (`student_subscriptions` links via student/child, not billing email).

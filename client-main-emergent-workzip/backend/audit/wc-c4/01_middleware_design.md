# WC-C4 · Deliverable 1 — `requireEntitlement` Middleware
_Generated 2026-06-10T07:29:55.423Z. Validated by EXECUTION of the real handler (not source re-statement)._

## Contract
`requireEntitlement(pool, { sessionParam }) → RequestHandler`. Factory bound to the pool + the route's
session-id param (`session_id` for report routes, `id` for session sub-resources + the omega-x alias).
Gated by flag `commercialEntitlementEnforcement` (env `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT`, default **OFF**), distinct from the
admin-overview flag `commercialEntitlement`.

## Stage → required report feature (DERIVED from `STAGE_FEATURES`, in lockstep)
- `CAP_INS` → `insight_report` (stage features: `insight_report`)
- `CAP_GRW` → `growth_report` (stage features: `growth_report`, `growth_plan`)
- `CAP_MAS` → `mastery_report` (stage features: `mastery_report`, `mentor_access`)
- `CAP_CUR` (free) / null / unknown stage → **not in the map → never gated**.

## Decision flow (first match wins)
| # | Condition | Outcome | Rationale |
|---|---|---|---|
| 1 | flag OFF | `next()` (synchronous, no await) | byte-identical legacy behaviour |
| 2 | session-id param fails UUID regex | `next()` | never feed a garbage id to a UUID-typed query (preserves the handler's own 400/404/500) |
| 3 | session not found | `next()` | preserve the handler's own 404; nothing to protect |
| 4 | stage CAP_CUR / null / unknown | `next()` | free tier — no paid content |
| 5 | `deriveEntitlement` degraded (ledger fault) | **503 `entitlement_unavailable`** | fail-CLOSED — a ledger fault is never "unpaid" |
| 6 | required feature ∈ entitled_features | `next()` | identity owns the paid stage |
| 7 | otherwise | **402 `entitlement_required`** | paid stage, identity does not own it (incl. null guest_email → `no_billing_identity`) |

## Identity & reuse
- Billing identity = `capadex_sessions.guest_email`, read **server-side from the session record**. The gate
  NEVER consults a per-request `?email=` / body email — that direct bypass is closed.
- HONEST caveat (inherited, NOT introduced by WC-C4): `guest_email` itself originates from the
  unauthenticated client at `POST /session/start`. The gate trusts the stored session record, not
  per-request input, so an identity that started a session claiming a paying user's email would inherit
  that email's entitlement (a free-ride on the email-keyed `capadex_payments` ledger — no victim-data
  exposure). This is a property of the pre-existing email-keyed payment model; closing it would be a new
  authenticated-identity model, out of WC-C4 scope. Moot on current data (0 paid rows).
- Reuses `deriveEntitlement` + the live `capadex_payments` ledger ONLY. No new entitlement model, no
  schema / ontology change.

## Deviations (documented, per architect plan sign-off)
- **403 → 402**: a missing entitlement is a payment-required condition, so `402 Payment Required` is used
  (not `403`). A ledger fault is split out as **503** so "can't tell" is never conflated with "unpaid".
- **Minor existence signal**: for the `/report/:session_id` handlers (which 404 a non-`completed`
  session), a PAID-stage but not-yet-completed session would receive a 402 from the gate before the
  handler's 404. This IS observable on the current data — see the blocked CAP_INS sessions in
  deliverable 3 (all non-completed). It is the correct enforcement direction (unpaid → blocked) and is
  documented for honesty.

## Inherited scope caveat (honest limitation — NOT fixed here, per "reuse only")
- The gate inherits `deriveEntitlement`'s ledger scope: entitlement is resolved from
  `capadex_payments status='paid'` ONLY. Package/subscription grants (`student_subscriptions`) are NOT
  resolved per-identity. If a CAP_* stage is ever granted via that path, the gate would 402 that identity.
  On the live data this is moot (0 active subscriptions), but it is the correct caveat to flag before the
  flag is enabled — closing it would be a NEW entitlement model, out of scope for WC-C4.

---
name: WC-C4 entitlement enforcement middleware
description: Lessons from turning the entitlement ENGINE into actual access ENFORCEMENT (requireEntitlement gate) over paid CAPADEX surfaces — flag-OFF byte-identical guarantee, the "0 paid ≠ 0 blocked" honesty trap, and inherited identity caveats.
---

# WC-C4 — requireEntitlement enforcement gate

Converted the existing entitlement ENGINE (deriveEntitlement / STAGE_FEATURES / capadex_payments) into
real access ENFORCEMENT via a `requireEntitlement(pool,{sessionParam})` middleware factory, applied behind
flag `commercialEntitlementEnforcement` (env `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT`, default OFF; distinct
from the admin-overview flag `commercialEntitlement`).

## Flag-OFF byte-identical guarantee
- **Rule:** the flag check MUST be the gate's first synchronous statement, returning `next()` BEFORE any
  `await`. Prove it with a query-spy pool (Proxy over `query`) → flag OFF must issue **0 DB queries**.
- **Why:** a flag check after a session lookup would change latency/error surface even when "off". The
  spy-count==0 assertion is the only airtight proof of reversibility.
- **How to apply:** any additive gating middleware ships with the same spy-pool rollback proof; flag OFF is
  the ONLY state you may call byte-identical.

## "0 paid rows ≠ 0 sessions blocked" — the honesty trap
- A naive pre-check ("ledger has 0 paid rows, all completed sessions are CAP_CUR → flag ON is byte-identical
  / blocks nothing") was FALSE. `stage_code` can be a PAID tier (CAP_INS/GRW/MAS) on a session that never
  paid (here: 4 CAP_INS sessions, one identity, status replaced/in_progress, only pending payments). Flag ON
  those correctly get **402**.
- **Why:** stage_code reflects the tier a session reached, NOT payment. The projection must run over the
  FULL session population (not just completed), and the per-session decision must come from the REAL gate.
- **How to apply:** when projecting enforcement impact, drive every row through the actual handler and let
  "0 paid rows" + "N paid-stage-but-unentitled sessions" coexist. Never let `paidRows===0` auto-conclude
  "0 blocked / byte-identical when ON" — only flag OFF is byte-identical.

## Identity is server-side but the email is client-asserted upstream
- The gate reads `capadex_sessions.guest_email` server-side and NEVER consults a per-request `?email=`/body
  email (direct bypass closed). BUT `guest_email` itself originates from the unauthenticated client at
  `POST /session/start`, so an identity claiming a paying user's email inherits that email's entitlement
  (free-ride on the email-keyed ledger; no victim-data exposure).
- **Why:** "client email is NEVER trusted" overclaims — be precise: the gate trusts the stored session
  record, not per-request input. The upstream client-asserted email is an inherited limitation of the
  email-keyed payment model, not introduced here; closing it = a new authenticated-identity model.

## Inherited ledger scope
- `deriveEntitlement` resolves entitlement from `capadex_payments status='paid'` ONLY — package/subscription
  grants (`student_subscriptions`) are NOT resolved per-identity. If a CAP_* stage is ever granted via that
  path the gate would 402 it. Moot today (0 active subscriptions). Closing it = new model, out of scope.

## Deviations from a textbook gate (all documented in deliverable 01)
- Missing entitlement → **402** (payment-required) not 403; a ledger FAULT → **503 entitlement_unavailable**
  (fail-CLOSED) so "can't tell" is never conflated with "unpaid".
- Non-UUID param → `next()` (don't feed garbage to a UUID-typed query; preserve the handler's own 400/404).
- Existence signal: a PAID-but-incomplete `/report/:session_id` session gets a gate 402 before the handler's
  own 404 — disclosed, correct enforcement direction.

## Validation harness
- Drive the REAL exported middleware through a mock `req/res/next` harness (resolve on `next()` or
  `res.json`); re-parse the protected surface from `routes/capadex.ts` SOURCE so coverage is re-derived,
  never hardcoded. Avoids the "measuring my own reimplementation" trap. Toggle `process.env[FF_ENV]` at
  runtime — `envOverride` reads env at call time, so a constructed gate honours later toggles.

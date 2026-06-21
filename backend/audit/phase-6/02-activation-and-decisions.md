# Phase 6 — Activation Switch List & Decisions

**Task:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION-PHASE-6 (Commercial Platform Activation)
**Companion:** `01-reconciliation-audit.md` (grounding + subsystem map)
**Contract:** Additive · flag-gated (flag-OFF byte-identical) · compose-never-recompute · honesty-first ·
**STOP for approval before any merge/deploy** (per `replit.md`).

This document is the safe activation runbook. Nothing here flips a switch automatically — every item
is a reviewable instruction or an owner DECISION_REQUIRED gate.

---

## A. T004 outcomes — identity bridge & customer-success triggers (no code change required)

### A.1 Identity ↔ subscription ↔ entitlement bridge — RESOLVED (no migration)

The earlier "gap" (a belief that `users` had no `email` column) was corrected by re-grounding the live
schema. The identity linkage already exists and is consistent:

```
users.email
   ↕ (soft identity, email)
comm_customers.email            comm_customers.id ──< comm_subscriptions.customer_id
   ↕                                   ↕
comm_entitlement_grants.email   comm_usage_events.email   capadex_payments.email
```

- `users` columns: `id, username, password, full_name, role, roles, created_at, email, phone, account_type`.
- Grants / usage / payments are **email-keyed by design** (soft identity, deliberately no hard FK to
  `users`, so anonymous/guest commerce works before account creation).
- `comm_customers.user_id` is available if/when a **hard** account FK is later desired.

**Decision:** No additive migration is introduced. Building a hard FK now would be a behaviour change
for guest commerce and is **not required** for activation. → **No code change. Honest documentation.**

### A.2 Behavioural customer-success upsell triggers — kept honestly stubbed (documented reason)

`services/wc7c/upsell-engine.ts` exposes `trigger_taxonomy.not_built = ['behavioural_at_risk',
'behavioural_power_user']`. These are deliberately NOT built:

- There is **no behavioural-signal → commercial-trigger taxonomy** in the system. Implementing the
  triggers would require inventing a mapping from CAPADEX/behaviour signals to upsell intent — i.e.
  **fabrication**, which the honesty contract forbids.
- The engine already encodes this honestly (it "invents NO behavioural triggers"), so the stub is
  self-documenting, not a silent gap.

**Decision:** Keep stubbed. Real wiring is a future task requiring an owner-approved trigger taxonomy
grounded in real signals. → **No code change. Documented reason.**

---

## B. Razorpay — TEST vs LIVE (DECISION_REQUIRED)

- **Default (current):** Razorpay keys absent → `capadex-payments.ts` falls back to a `DEMO_` mock order
  path. The Phase-6 smoke and validation engine both run entirely in this TEST/demo mode (no real
  charges). `STAGE_PRICES`: `CAP_INS ₹499 / CAP_GRW ₹999 / CAP_MAS ₹1999`.
- **Integrations check:** Razorpay is **not** a Replit first-party integration/connector (it is not in
  the integrations catalog). Live activation therefore requires the owner to supply credentials.
- 🔶 **DECISION_REQUIRED (owner):** To accept real payments, the owner must provide `RAZORPAY_KEY_ID`
  and `RAZORPAY_KEY_SECRET` (and, if webhooks are used, `RAZORPAY_WEBHOOK_SECRET`). Until then, commerce
  stays in TEST/demo mode. **Do not request these secrets without explicit owner instruction.**
- Security invariants already enforced (see memory `commercial-spine-razorpay-security`): payment verify
  requires local↔gateway linkage (anti-IDOR); webhook fails CLOSED when a secret is configured;
  idempotency null-replay → 409 (verified structurally by the Phase-6 smoke §6).

---

## C. Activation switch list (flag-OFF verified first — enable only after approval)

All flags default **OFF**; flag-OFF is byte-identical (verified for the new validation route: all three
endpoints return `503 {feature_disabled}` before any DB touch). Enable by adding `FF_<NAME>=1` to the
**Backend API** workflow command, then restart.

| Order | Flag (env) | Enables | Pre-req before flip |
|---|---|---|---|
| 1 | `FF_COMMERCIAL_VALIDATION` | Read-only Phase-6 validation report (`/api/commercial-validation*`). Safe first — it only READS. | none (read-only, super-admin) |
| 2 | `FF_COMMERCIAL_ACTIVATION` | Commercial Layer / Subscriptions / Revenue / Customer-Success read engines + routes. | seed catalog (products/plans) first or reports stay WARN (honest empty) |
| 3 | `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` | Entitlement enforcement (402/503 fail-closed gates). | enable AFTER a catalog + at least one paid identity exists, else paid features 402 for everyone |
| — | Razorpay LIVE | Real charges | §B owner DECISION_REQUIRED (credentials) |

**Recommended safe sequence:** flip `FF_COMMERCIAL_VALIDATION` only → review the live report → seed a
real catalog → flip `FF_COMMERCIAL_ACTIVATION` → confirm revenue/subscription reports → only then flip
`FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT`. Razorpay LIVE last, on owner approval.

> Note: `FF_COMMERCIAL_ACTIVATION` and `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` are **already present** in
> the Backend API workflow command from prior phases. Phase-6 adds only `FF_COMMERCIAL_VALIDATION`
> (default OFF), which is the single new switch this task introduces.

---

## D. Verification performed this phase

- **Flag-OFF byte-identical:** `GET /api/commercial-validation`, `/_meta/status`, `/catalog` all return
  `503 {ok:false,error:'feature_disabled',flag:'commercialValidation'}` before any DB touch.
- **Validation engine (empty substrate):** 8 areas → **1 PASS / 7 WARN / 0 FAIL** (honest WARN-heavy).
- **E2E smoke (`scripts/smoke-commercial-platform.ts`, TEST/demo, self-cleaning):** ALL assertions pass —
  GET-never-writes (zero row delta), 0 FAIL clean & seeded, areas become measurable, MRR roll-up ₹999,
  entitlement coverage 100% with a paying identity, negative-price → FAIL detection, idempotency
  single-use (→409), determinism, and self-clean leaves the DB byte-identical.
- **Engine canonical sets** mirror the live DB CHECK constraints exactly (subscriptions
  `trial/active/past_due/cancelled/expired`; grants `active/revoked`; payments
  `pending/paid/failed/refunded`) so the harness never false-FAILs a legitimately-stored row.

---

## E. STOP

Per `replit.md`, this phase **STOPS for approval before any merge/deploy**. No flags were enabled, no
secrets requested, no production changes made. Awaiting owner decision on (1) the activation sequence in
§C and (2) Razorpay TEST→LIVE in §B.

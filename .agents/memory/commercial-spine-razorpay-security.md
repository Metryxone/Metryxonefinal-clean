---
name: Commercial spine Razorpay integration security
description: Three recurring security traps in any payment verify/webhook handler (verify IDOR, webhook fail-open, idempotency null-replay). Apply to commercial-spine and any future gateway integration.
---

# Razorpay (gateway) verify/webhook security traps

The `comm_*` Commercial Runtime Spine (`backend/routes/commercial-spine.ts` + `services/commercial/*`) is additive, flag-gated (commercialCatalog/commercialSubscriptions/commercialRazorpayRecurring, default OFF), TEST-keys-only with a keyless demo fallback. Three security defects were found in code review and fixed — they recur in ANY payment integration:

## 1. Verify endpoint IDOR — require local↔gateway linkage, never trust caller's record id
**Rule:** After a signature is valid, do NOT activate the caller-supplied `subscription_id` directly. Load the local subscription and require `comm_subscriptions.razorpay_subscription_id === verified razorpay_subscription_id` before crediting it.
**Why:** Otherwise any user with one valid signature tuple can pass a *different* `subscription_id` and activate/credit someone else's subscription (IDOR). Returns `reason:subscription_link_mismatch` on mismatch.
**How to apply:** Any "verify payment → mark X paid" path must bind X to the gateway object that was actually verified.

## 2. Webhook must fail CLOSED when the gateway is configured
**Rule:** If `isRazorpayConfigured()` (real keys present), require `RAZORPAY_WEBHOOK_SECRET` (else 503) AND a valid signature (else 400). Only the keyless demo path may skip verification.
**Why:** The original code verified only `if (secret)` — with secret absent it processed unsigned events, letting anyone forge lifecycle-changing webhooks.

## 3. Idempotency null-replay = in-flight, return 409 (not a 500)
**Rule:** `withIdempotency` claim-then-run can return `replayed:true` with `response==null` while a concurrent claim is still running. Handlers that spread `outcome.response` into JSON must guard `if (outcome.replayed && outcome.response == null) return 409 retry` first, or the spread throws → 500 under race.

## Also note (tech debt, see follow-up)
Webhook HMAC is computed over `JSON.stringify(req.body)` (re-serialized), not the raw bytes Razorpay signed. Demo works; real webhooks can fail verification in prod until a raw-body capture is added.

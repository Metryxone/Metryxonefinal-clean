# WC-C8B · Deliverable 5 — Final Gate Matrix

**Date**: 2026-06-10T10:57:52.282Z  
**Note**: G1–G6, G8–G12, G14 are **carried forward from WC-C8** (not re-measured in this validation pass). Re-run the WC-C8 audit to re-verify if required. Security/commercial gates touched by WC-C8A are **re-measured live** below.

## Free Consumer Launch

| Gate | Criterion | Source | Verdict |
|---|---|---|---|
| G1 Assessment Completion | session completes w/o 500 | carried (WC-C8) | ✅ PASS* |
| G2 OTP Email Delivery | OTP received & verified | carried + OTP cap re-measured | ✅ PASS* |
| G3 Report Rendering | renders w/o crash | carried (WC-C8) | ✅ PASS* |
| G4 Session Persistence | survives reload | carried (WC-C8) | ✅ PASS* |
| G5 CAPADEX Routing | ≥95% resolve | carried (WC-C8) | ✅ PASS* |
| G6 Data Integrity | no PII cross-contam | carried (WC-C8) | ✅ PASS* |
| G7 Security | helmet/fail-fast/SIGTERM/seed/MFA | **re-measured** | ⚠️ CONDITIONAL |
| G8 Error Handling | no naked traces | carried (WC-C8) | ✅ PASS* |

G7 sub-evidence: helmet headers 5/5 present → ✅ PASS; seed gate HTTP 401 → ✅ PASS; OTP attempts col present; MFA handlers ✅ PASS; SMTP ✅ PASS; credential rotation ❌ FAIL (admin123 live).

\* carried from WC-C8 — not independently re-verified in WC-C8B.

## Paid Consumer Pilot

| Gate | Criterion | Source | Verdict |
|---|---|---|---|
| G9 Payment Flow | order→webhook→status | carried; **DEMO mode only** | ⚠️ DEMO (no live processor) |
| G10 Entitlement Gate | unpaid blocked at report | carried (WC-C8) | ✅ PASS* |
| G11 Subscription Packages | ≥1 active package | carried (WC-C8) | ✅ PASS* |
| G12 Stage Coverage | CAP_INS/GRW/MAS | carried (WC-C8) | ✅ PASS* |
| G13 Admin Payments Auth | auth-gated | **re-measured** HTTP 401 | ✅ PASS |
| G14 Webhook Verification | HMAC verified | carried; needs WEBHOOK_SECRET | ⚠️ CONDITIONAL (secret absent) |
| G15 Refund Capability | route + sandbox test | **re-measured** | ⏸️ NOT TESTABLE |
| G16 Credential Security | rotatable + rotated | **re-measured** | ❌ FAIL (not rotated) |

## Feature-flag posture (vs production matrix)

The dev workflow runs **all** FF_* including `FF_COMMERCIAL_ACTIVATION=1`. The WC-C8A matrix marks
`FF_COMMERCIAL_ACTIVATION` as **HOLD** until billing is confirmed. With Razorpay unconfigured,
enabling it in production would surface commercial flows backed by **no payment processor**.
→ Free Launch production command must **omit** `FF_COMMERCIAL_ACTIVATION`.

**Free Consumer Launch**: ⚠️ CONDITIONAL  
**Paid Consumer Pilot**: ❌ FAIL

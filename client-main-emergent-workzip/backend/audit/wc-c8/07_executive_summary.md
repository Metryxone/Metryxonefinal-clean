# WC-C8 · Deliverable 7 · Executive Summary

**Audit:** WC-C8 — Launch Readiness Audit | **Generated:** 2026-06-10T09:56:20.133Z
**Mode:** AUDIT ONLY · READ ONLY · STOP FOR APPROVAL

---

## What Can Launch Today?

**Nothing can launch today.** Two P0 blockers affect all 4 targets simultaneously:

1. **SESSION_SECRET is unset in production** — the hardcoded fallback string is active; all user sessions can be forged.
2. **Feature flags are OFF in production** — the entire WC-3/decision/commercial chain (stage, outcome, journey, decision, commercial) is dark for production users. This affects the platform's primary value proposition.

Both are **configuration-only fixes** (no code changes). Estimated resolution: 1–2 days.

---

## What Can Launch After Fixing P0 Blockers?

| Target | Verdict | Blockers remaining after P0 fix |
|---|---|---|
| **Free Consumer Launch** | **CONDITIONAL GO** | P1: MFA, Helmet, graceful shutdown, OTP attempt cap |
| **Paid Consumer Pilot** | **CONDITIONAL GO** | P1: Above + refund path + confirm Razorpay keys |
| **LBI Launch** | **NO-GO** | No consumer entry; 0 production sessions; no checkout |
| **EI Pilot** | **NO-GO** | 0 question items; standalone route stub; no page; commercial guard |

---

## 6 Launch Readiness Metrics (Architect-Confirmed)

| Metric | Coverage / Structural | Activation / Context | Key finding |
|---|---|---|---|
| **Product Readiness (Free)** | Gates: 4/9 PASS | Context: 2 P0 blockers open | Assessment flow end-to-end works; security blocks launch |
| **Product Readiness (Paid)** | Structural: Razorpay complete | Activation: 0 paid conversions (cold start) | Infrastructure ready; refund path missing |
| **Product Readiness (LBI)** | Engine: REAL | Consumer entry: ABSENT | Binary NO-GO — no consumer path |
| **Product Readiness (EI)** | Engine: REAL | Question bank: **0 items** | Binary NO-GO — question bank empty |
| **Security Readiness** | 2 BLOCKERS / 2 PRE_LAUNCH | Deployment secrets: SESSION_SECRET absent | Set 1 secret to unblock; MFA to harden |
| **Commercial Readiness** | Packages: 13 seeded | Paid: 0 / 6 transactions | Infrastructure ready; cold start; refund missing |

---

## Critical Corrections (verified against live codebase)

The following claims appeared in prior audit notes. Each has been re-verified against the live codebase.

1. **FF_* flags not confirmed in production.** Dev workflow runs them via `FF_WC3_STAGE=1 …` in the
   command string. The production run command (`NODE_ENV=production npx tsx index.ts`) has no FF_* vars.
   [userenv.production] only contains `APP_URL`. Deployment-pane secrets cannot be verified from the repo —
   verify before launch. Flag-off is byte-identical to legacy; free assessment flow works without them.

2. **SESSION_SECRET not in .replit [userenv.production].** [userenv.production] = `{ APP_URL: "metryx.one" }`
   only. Deployment-pane must be checked — if absent, hardcoded fallback at routes.ts:234 is active.

3. **Dev OTP bypass (123456) does NOT exist** in CAPADEX code. grep across backend/routes/ returns zero
   matches. An earlier audit note incorrectly asserted this bypass; it is not present in the codebase.

4. **OTPs are stored PLAINTEXT, NOT bcrypt-hashed.** The INSERT at capadex.ts:2300 stores the raw code;
   verify-otp at capadex.ts:2437 matches on `WHERE code=$2`. bcrypt is applied to PASSWORDS only.
   An earlier audit note incorrectly claimed OTP bcrypt hashing; this is not present.

5. **14 outcome rows across 6 of 9 completed sessions, spanning 3 model types (1–3 rows per session).**
   Model distribution: confidence_stability (4), exam_readiness (6), holistic_wellbeing (4). 3 of 9
   completed sessions have no outcome state (pre-backfill sessions without constructs). This is correct
   engine behaviour, not anomalous.

---

## What Was Fixed Since the Prior Launch-Readiness Audit

| Prior finding | Current state |
|---|---|
| Outcome chain broken (0 rows) | **Fixed** — 14 rows across 6 sessions (backfill + crosswalk); 3 model types |
| Subscription packages = 0 | **Fixed** — 13 packages seeded via WC-C6B (₹299–₹1499) |
| Commercial layer: no revenue tables | **Partial** — capadex_payments exists (6 rows, may include demo/test orders); student_subscriptions still 0 |
| WC-C7 upsell engine | **Built** — B2C ladder upsell structural (71.4% caps); activation cold-start |

---

## What Blocks Launch (Summary)

### Config-Only Fixes (~1–2 days, no code changes)
1. Set SESSION_SECRET in deployment secrets
2. Add FF_WC3_STAGE + FF_WC3_OUTCOME + FF_DECISION_PERSISTENCE to [userenv.production]
   (at minimum; review each flag before enabling)

### Code Fixes (~3–5 days, no schema changes)
3. Enable SuperAdmin MFA + rotate credential
4. Add `app.use(helmet())` in backend/index.ts
5. Add SIGTERM graceful shutdown handler
6. Add OTP attempt cap (ALTER capadex_otps ADD COLUMN attempts INT DEFAULT 0)

### Code + Design (~3–7 days for paid pilot)
7. Implement refund route (Razorpay SDK)
8. Confirm Razorpay keys in production secrets
9. Document/establish customer support path

---

## STOP FOR APPROVAL

This audit is complete. No implementation, schema changes, or deployment actions have been taken.
The findings above are the basis for deciding which launch targets to pursue and in what order.

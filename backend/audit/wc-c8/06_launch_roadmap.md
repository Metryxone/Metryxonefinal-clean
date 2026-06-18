# WC-C8 · Deliverable 6 · Launch Roadmap

**Generated:** 2026-06-10T09:56:20.133Z

---

## Shortest Path: Free Consumer Launch

This is the only near-term launchable target. All items below are config/code fixes with no schema changes.

### Phase A — Unblock (P0 blockers, ~1–2 days, no schema changes)

1. **Set SESSION_SECRET in deployment secrets.** Rotate immediately.
   - Add fail-fast at startup: `if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET not set')`
   
2. **Add FF_* flags to [userenv.production] in .replit.**
   - Decide which flags belong in production. At minimum: FF_WC3_STAGE, FF_WC3_OUTCOME, FF_DECISION_PERSISTENCE (these are the "collect data" flags). Commercial flags (FF_COMMERCIAL_ACTIVATION) can wait.
   - Do NOT blindly copy the dev workflow command — review each flag and confirm intent.

### Phase B — Pre-Launch Hardening (~3–5 days)

3. **Enable SuperAdmin MFA** (un-comment the MFA block in routes.ts; confirm Zoho SMTP works). Rotate admin credential.
4. **Add Helmet middleware** — 1-line change in backend/index.ts.
5. **Add graceful shutdown** — SIGTERM handler: drain DB connections, wait for in-flight requests.
6. **Add OTP attempt cap** — ALTER capadex_otps ADD COLUMN attempts INT DEFAULT 0; lock after 5.

### Phase C — Soft Launches (can be done post-launch)

7. Email retry wrapper (1–3 retries on SMTP failure)
8. Sentry error tracking
9. Swap in-memory rate limiter for Redis-backed
10. Health endpoint DB connectivity check

**Exit criteria for Free Consumer Launch:** SEC-1 (SESSION_SECRET) resolved + FF_* in production confirmed.

---

## Shortest Path: Paid Consumer Pilot

Inherits all Free Consumer Launch steps, plus:

### Additional Pre-Launch (Paid Pilot only)

1. **Implement refund route** — POST /api/capadex/payment/refund via Razorpay SDK. Add admin UI for refund approval.
2. **Confirm Razorpay keys in production** — RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in deployment secrets.
3. **Establish support path** — at minimum a support email address displayed at checkout.
4. **Test end-to-end paid flow** — create a real ₹499 test transaction; verify stage unlock + emails.

**Timeline from Free Launch unblock:** ~3–5 additional days.

---

## Shortest Path: LBI Launch

LBI requires significant implementation work before launch. This roadmap is directional only.

1. **Consumer entry page** — Create frontend/src/pages/LBILaunchPage.tsx
2. **Purchase flow** — Wire LBI to Razorpay checkout (new SKU or via package catalog)
3. **LBI onboarding** — Age-band + persona selection → question flow → report
4. **B2C pricing decision** — Decide if LBI is a standalone SKU or part of a subscription package
5. **Schema normalisation** — Resolve student_id vs child_id model discrepancy
6. **Test with real users** — 0 production LBI sessions means no baseline

**Estimated effort:** Medium (1–2 weeks minimum). **Verdict: NOT near-term.**

---

## Shortest Path: Employability Index Pilot

EI requires the most work before launch. All 4 product gates are structural failures.

1. **Populate question bank** — competency_assessment_items = 0; source or author questions for 101 competencies
2. **Standalone page** — Create frontend/src/pages/EmployabilityIndexPage.tsx
3. **Unstub the route** — Update wc3_journey_routes status from stub to ready for employability_index
4. **Remove commercial guard** — Remove "employability" from the unsellable list in offer-engine
5. **Wire to checkout** — Add EI as a purchasable product
6. **Backfill norm data** — stage_competency_norms need population before percentile ranking is meaningful

**Estimated effort:** Large (3–6 weeks minimum). **Verdict: Not near-term. Requires user decision.**

---

## Timeline Summary

| Target | Blocks | Estimated to Unblock | Status |
|---|---|---|---|
| Free Consumer Launch | P0 security + FF_* in prod | ~1–2 days (config only) | ⚠️ Near-term |
| Paid Consumer Pilot | Free Launch + refund path | ~5–7 days total | ⚠️ Near-term |
| LBI Launch | No consumer entry, no sessions | Weeks (implementation) | ❌ Not near-term |
| EI Pilot | 0 question items, 4 product gates | Weeks (implementation) | ❌ Not near-term |

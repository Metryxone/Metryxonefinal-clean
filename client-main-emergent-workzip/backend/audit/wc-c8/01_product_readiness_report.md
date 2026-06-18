# WC-C8 · Deliverable 1 · Product Readiness Report

**Audit:** WC-C8 — Launch Readiness | **Mode:** AUDIT ONLY · READ ONLY | **Generated:** 2026-06-10T09:56:20.133Z

---

## 4-Target Readiness Summary

| Launch Target | Gates | PASS | SOFT | FAIL | Verdict |
|---|---|---|---|---|---|
| Free Consumer Launch | 9 | 4 | 3 | 1 | **NO_GO** |
| Paid Consumer Pilot | 16 | 8 | 4 | 2 | **NO_GO** |
| LBI Launch | 5 | 1 | 2 | 2 | **NO_GO** |
| Employability Index Pilot | 5 | 1 | 0 | 4 | **NO_GO** |

---

## Target 1 — Free Consumer Launch · Verdict: NO_GO

**What works:** The full free-assessment flow (analyze → clarity → questions → score → report → OTP → email)
has been executed end-to-end: **9 completed sessions**, **39 reports persisted**,
**30,638 clarity questions** available, **2489 concern master entries**.

**What blocks it:** Two hard FAIL gates — (1) SESSION_SECRET is unset in production ([userenv.production] only
contains APP_URL); (2) the entire WC-3/decision/commercial chain (stage, outcome, journey, decision) is OFF
in production because FF_* flags are absent from the production deploy command. Users in production experience
a stripped-down version that collects no stage/outcome/journey state.

| Gate | Label | Status | Notes |
|---|---|---|---|
| G1 | Concern entry → analysis → resolution | ✅ PASS | resolveCapadexConcern works end-to-end; 2489 master concerns, keyword fallback to "Easily distracted" (never 404) |
| G2 | Clarity questions served | ✅ PASS | 30,638 clarity questions in DB; 3-tier picker (master→DB→static) |
| G3 | Assessment (10 MCQ/Likert) | ✅ PASS | 10-item assessment served per concern/persona/age-band |
| G4 | Report generation | ✅ PASS | 39 reports persisted; OMEGA-X payload generated; 9 completed sessions end-to-end |
| G5 | OTP delivery & verification | ⚠️ SOFT_PASS | OTP stored PLAINTEXT; verify-otp has NO attempt cap (brute-forceable with in-memory rate-limit only); delivery is fire-and-forget (`.catch(console.error)` at capadex.ts:2381) — silent failure possible |
| G6 | Email report delivery | ⚠️ SOFT_PASS | Direct SMTP (Zoho); no queue/retry; failure is silent. Email entitlement gated by gateReportEntitlement — must verify free-tier users are not blocked. |
| G7 | Security baseline | ❌ FAIL | SESSION_SECRET not present in .replit [userenv.production]; deployment-pane secrets cannot be inspected from the repo — verify in the Deployments pane. If unset, hardcoded fallback at routes.ts:234 is active. Also: no Helmet headers; SuperAdmin MFA disabled. |
| G8 | Operational baseline | ⚠️ SOFT_PASS | No graceful shutdown (SIGTERM handler absent); no error tracking; email delivery has no retry. Health endpoint exists (/api/health). |
| G9 | WC-3/decision chain in production | 🔶 DECISION_REQUIRED | FF_WC3_*/FF_DECISION_* flags absent from .replit [userenv.production] and the production run command. Cannot verify deployment-pane secrets from the repo. Flag-off is byte-identical to legacy free-flow (G1–G4 work without them). Explicit owner decision required before launch: which flags belong in production. |

---

## Target 2 — Paid Consumer Pilot · Verdict: NO_GO

**What works:** Razorpay integration is complete and production-grade — order creation, HMAC-SHA256 signature
verification, webhook handler, post-payment stage unlock, and admin notification all verified. The payment
infrastructure can process real transactions today.

**Critical missing:** (1) No refund route or customer support path — legally and operationally required for
any paid consumer product. (2) Inherits all Free Launch blockers (SESSION_SECRET, FF_* in prod).

| Gate | Label | Status | Notes |
|---|---|---|---|
| G1 | Concern entry → analysis → resolution | ✅ PASS | resolveCapadexConcern works end-to-end; 2489 master concerns, keyword fallback to "Easily distracted" (never 404) |
| G2 | Clarity questions served | ✅ PASS | 30,638 clarity questions in DB; 3-tier picker (master→DB→static) |
| G3 | Assessment (10 MCQ/Likert) | ✅ PASS | 10-item assessment served per concern/persona/age-band |
| G4 | Report generation | ✅ PASS | 39 reports persisted; OMEGA-X payload generated; 9 completed sessions end-to-end |
| G5 | OTP delivery & verification | ⚠️ SOFT_PASS | OTP stored PLAINTEXT; verify-otp has NO attempt cap (brute-forceable with in-memory rate-limit only); delivery is fire-and-forget (`.catch(console.error)` at capadex.ts:2381) — silent failure possible |
| G6 | Email report delivery | ⚠️ SOFT_PASS | Direct SMTP (Zoho); no queue/retry; failure is silent. Email entitlement gated by gateReportEntitlement — must verify free-tier users are not blocked. |
| G7 | Security baseline | ❌ FAIL | SESSION_SECRET not present in .replit [userenv.production]; deployment-pane secrets cannot be inspected from the repo — verify in the Deployments pane. If unset, hardcoded fallback at routes.ts:234 is active. Also: no Helmet headers; SuperAdmin MFA disabled. |
| G8 | Operational baseline | ⚠️ SOFT_PASS | No graceful shutdown (SIGTERM handler absent); no error tracking; email delivery has no retry. Health endpoint exists (/api/health). |
| G9 | WC-3/decision chain in production | 🔶 DECISION_REQUIRED | FF_WC3_*/FF_DECISION_* flags absent from .replit [userenv.production] and the production run command. Cannot verify deployment-pane secrets from the repo. Flag-off is byte-identical to legacy free-flow (G1–G4 work without them). Explicit owner decision required before launch: which flags belong in production. |
| G10 | Razorpay order creation | ✅ PASS | capadex-payments.ts: POST /api/capadex/payment/create-order — validates stage_code, creates Razorpay order, persists "pending" in capadex_payments |
| G11 | Payment verification (HMAC-SHA256) | ✅ PASS | POST /api/capadex/payment/verify — server-side signature verification; updates status to "paid" |
| G12 | Webhook handler (async capture) | ✅ PASS | POST /api/capadex/payment/webhook — handles payment.captured / order.paid; ensures consistency if client verify fails |
| G13 | Post-payment stage unlock | ✅ PASS | startNextStageAfterPayment → /api/capadex/session/start; admin + user email notification; WhatsApp notification |
| G14 | Razorpay keys in production | ⚠️ SOFT_PASS | Demo-mode fallback active when RAZORPAY_KEY_ID missing (returns demo order, stays "pending"). Requires confirming RAZORPAY_KEY_ID/SECRET are set in production secrets. |
| G15 | Refund/support path | ❌ FAIL | No refund route in capadex-payments.ts; no customer support ticket system; no documented refund SLA. Required for any paid consumer launch. |
| G16 | Paid conversion (cold start) | – NOT_APPLICABLE | 0 paid / 6 total B2C payments. Cold start is a fact, not a gate failure. |

---

## Target 3 — LBI Launch · Verdict: NO_GO

**What works:** The LBI engine (5 behavioural dimensions across 19 domains) is real and correct.
Frontend report components exist.

**What blocks it:** No consumer entry point. No checkout wiring. **0 production LBI sessions ever**.
The engine has never been invoked by a real user. B2C model (pricing, entry page, purchase flow) does not exist.

| Gate | Label | Status | Notes |
|---|---|---|---|
| G1 | LBI scoring engine | ✅ PASS | LBIEngine in backend/routes/lbi-engine.ts; 5 dims (Consistency/Persistence/Attention/Adaptability/Velocity); 19 domains; real calculation |
| G2 | Consumer entry point / checkout wiring | ❌ FAIL | LBI has no consumer-facing purchase flow; not wired to Razorpay checkout; not a paid SKU in the B2C ladder or package catalog |
| G3 | LBI session history | ❌ FAIL | 0 rows in lbi_sessions. Engine has never been invoked in production. No baseline data. |
| G4 | Schema model consistency | ⚠️ SOFT_PASS | Legacy student_id vs new child_id model transition in progress; lbi_sessions and lbi_scores exist but diverged schema |
| G5 | Frontend consumer flow | ⚠️ SOFT_PASS | Report components exist (SubjectLBIReport, ShareLBIReport, AIPoweredReports lbi-comprehensive); no consumer entry page / landing |

---

## Target 4 — Employability Index Pilot · Verdict: NO_GO

**What works:** EI scoring engine is real (in CareerBuilderPage and StudentCompetencyPage). Gauge and
provenance components exist.

**What blocks it (all 4 are structural):**
1. **0 competency_assessment_items** — the question bank is entirely empty; EI scores require user responses.
2. Standalone consumer route is STUBBED in wc3_journey_routes.
3. No dedicated consumer page exists.
4. Commercial guard explicitly marks EI as unsellable ("product_not_ready").

| Gate | Label | Status | Notes |
|---|---|---|---|
| G1 | EI scoring engine | ✅ PASS | GET /api/competency/score/:userId — weighted, norm-referenced scoring real; used in CareerBuilderPage and StudentCompetencyPage |
| G2 | Standalone consumer route | ❌ FAIL | "employability_index" is marked stub in wc3_journey_routes; offer-engine has "never sell" guard; no /employability-index page exists |
| G3 | Consumer question bank | ❌ FAIL | competency_assessment_items = 0 rows. The question bank is entirely empty. EI scoring depends on responses; without items there is nothing for users to answer. |
| G4 | Dedicated consumer page | ❌ FAIL | No frontend/src/pages/EmployabilityIndexPage.tsx; EIGauge and EIProvenanceCard components exist but embedded in CareerBuilder only |
| G5 | Commercial unlock | ❌ FAIL | offer-engine explicitly excludes "employability", "competitive_exam", "competitive-exam", "exam_intelligence" as unsellable (status: "product_not_ready") |

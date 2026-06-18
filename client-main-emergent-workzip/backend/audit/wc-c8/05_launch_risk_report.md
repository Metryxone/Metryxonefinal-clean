# WC-C8 · Deliverable 5 · Launch Risk Report

**Generated:** 2026-06-10T09:56:20.133Z

---

## P0 · Launch Blockers (must fix before ANY public launch)

### RISK-P0-1 · SESSION_SECRET Not in .replit [userenv.production]
- **Impact (if unset):** Every user session can be forged by anyone who knows the hardcoded fallback string.
  Affects all user data, payment sessions, and admin access.
- **Evidence:** routes.ts:234; [userenv.production] = APP_URL only. Deployment-pane secrets cannot be
  inspected from the repo — verify in the Deployments pane before treating this as confirmed unset.
- **Fix:** Verify SESSION_SECRET in the Replit Deployments pane. If absent, set it. Add startup fail-fast:
  if !process.env.SESSION_SECRET throw Error to prevent server start with fallback.
- **Owner:** DevOps / Secret Management

### RISK-P0-2 · WC-3/Decision/Commercial Chain Status in Production Unknown
- **Impact (if flags absent):** Stage/Outcome/Journey/Decision chain is DARK for production users. The
  system's primary value proposition would be invisible.
- **Evidence:** .replit run command has no FF_* vars; [userenv.production] has no FF_* vars. Cannot verify
  deployment-pane from repo. Flag-off is byte-identical to legacy (free assessment flow still works).
- **Decision required:** Which FF_* flags belong in production? Review each before enabling. At minimum
  FF_WC3_STAGE + FF_WC3_OUTCOME + FF_DECISION_PERSISTENCE for data collection. Commercial flags separate.
- **Owner:** Engineering / Product owner

---

## P1 · Pre-Launch Fixes (fix before public launch — not hard blockers but high-risk)

### RISK-P1-1 · SuperAdmin MFA Disabled
- **Impact:** Single-factor admin breach; documented seed credential
- **Fix:** Enable MFA; rotate admin credential; remove seed from routes.ts before launch

### RISK-P1-2 · No Refund/Support Path (Paid Pilot)
- **Impact:** Legal and consumer-protection risk for any paid transaction without a refund mechanism
- **Fix:** Implement POST /api/capadex/payment/refund (Razorpay refund API); establish support email/flow

### RISK-P1-3 · No Graceful Shutdown (Data Loss on Autoscale)
- **Impact:** Completions lost during scale-down/redeploy; undermines data-collection goal
- **Fix:** SIGTERM handler; drain in-flight requests; close DB pool cleanly

### RISK-P1-4 · OTP Brute-Force (No Attempt Cap)
- **Impact:** Plaintext 6-digit OTP brute-forceable across server restarts
- **Fix:** Add attempts column to capadex_otps; lock after 5 failures

### RISK-P1-5 · No Helmet Security Headers
- **Impact:** Clickjacking, MIME-sniffing, missing HSTS in production
- **Fix:** `import helmet from 'helmet'; app.use(helmet())` in backend/index.ts

---

## P2 · Post-Launch Hardening (tolerable for MVP; fix within 30 days of launch)

| Risk | Impact | Fix direction |
|---|---|---|
| In-memory rate limiting | Ineffective under autoscale | Redis-backed limiter |
| No email queue/retry | Silent OTP/report delivery failures | Bull/Redis queue or retry wrapper |
| Response body memory logger | Memory pressure under load | Cap body capture size |
| No error tracking | Blind to production errors | Sentry integration |
| pg_stat estimates stale | Dashboard mis-reports row counts | Schedule ANALYZE; autovacuum |

---

## Product-Specific Risks

### LBI Launch Risk
- **RISK:** Launching an engine with 0 production sessions is a data-collection launch, not a product launch.
  No baseline behaviour exists. No consumer entry. No pricing in B2C ladder.
- **Verdict:** NO-GO until consumer entry and checkout are built.

### EI Pilot Risk
- **RISK:** Empty question bank (0 competency_assessment_items) means EI scores cannot be produced from user
  input. The existing EI scores in CareerBuilder come from competency framework data, not user answers.
- **Verdict:** NO-GO until question bank is populated AND standalone route is unblocked.

### Mentoring Fallback Dominance
- **RISK:** 66.7% of journey routes resolve to "mentoring" (fallback). If journey surface is shown to users,
  most users see a mentoring recommendation not derived from their specific concern/outcome. This is honest
  engine behaviour (correct fallback) but may confuse users expecting a tailored recommendation.
- **Mitigation:** Hide journey surface or display confidence tier prominently; only surface high-confidence (≥0.7) routes.

---

## Risk Matrix Summary

| Risk | Severity | Launch Target Affected | Status |
|---|---|---|---|
| SESSION_SECRET unset in production | P0 BLOCKER | All | ❌ Open |
| FF_* flags OFF in production | P0 BLOCKER | All | ❌ Open |
| SuperAdmin MFA disabled | P1 | All | ❌ Open |
| No refund path | P1 | Paid Pilot | ❌ Open |
| No graceful shutdown | P1 | All | ❌ Open |
| OTP brute-force | P1 | Free + Paid | ❌ Open |
| No Helmet headers | P1 | All | ❌ Open |
| In-memory rate limiting | P2 | All | ⚠️ Tolerable |
| No email queue | P2 | All | ⚠️ Tolerable |
| LBI: no consumer entry | Product blocker | LBI | ❌ NO-GO |
| EI: 0 question items | Product blocker | EI Pilot | ❌ NO-GO |

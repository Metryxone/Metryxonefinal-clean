# WC-C8 · Deliverable 4 · Security Report

**Generated:** 2026-06-10T09:56:20.133Z
**Methodology:** Static code analysis with grep verification against live codebase. All findings cite file:line.

---

## Severity Classification

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| SEC-1 | **BLOCKER** | SESSION_SECRET hardcoded fallback in production | routes.ts:234 |
| SEC-2 | **BLOCKER** | SuperAdmin MFA disabled; seed credential exposed | routes.ts:392, routes.ts:1258 |
| SEC-3 | PRE_LAUNCH | OTP stored plaintext; no attempt cap on verify-otp | capadex.ts:2300, 2437 |
| SEC-4 | PRE_LAUNCH | Helmet absent — no standard security headers | grep → 0 matches |
| SEC-5 | POST_LAUNCH | Rate limiting in-memory only (resets on restart) | security-middleware.ts |
| SEC-6 | NOTE | CORS dev-permissive; depends on CLIENT_ORIGIN in prod | frontend/server/src/index.ts |

---

## SEC-1 · BLOCKER · SESSION_SECRET Unguarded Fallback

**Finding:** SESSION_SECRET has no NODE_ENV guard; falls back to hardcoded string "edupsych-secret-key-change-in-production" in production

**Evidence:** backend/routes.ts:234 — `secret: process.env.SESSION_SECRET || "edupsych-secret-key-change-in-production"`

**Production confirmation:** `.replit [userenv.production]` only contains `APP_URL = "https://metryx.one"`.
SESSION_SECRET is not present in [userenv.production] or the production run command. Deployment-pane secrets
cannot be inspected from the repo — verify in the Replit Deployments pane before launch. **If unset,** the
hardcoded fallback "edupsych-secret-key-change-in-production" (routes.ts:234) is active, allowing any attacker
who knows this string to forge valid session cookies.

**Fix:** Set SESSION_SECRET in deployment secrets before launch; add fail-fast check at startup if absent

---

## SEC-2 · BLOCKER · SuperAdmin MFA Disabled

**Finding:** SuperAdmin MFA is permanently disabled (commented out) pending email service configuration. Documented credential (admin@metryx.one / Admin@123) is hardcoded in seed.

**Evidence:** backend/routes.ts:392 — "MFA temporarily disabled until email service is configured"; backend/routes.ts:418 — "MFA is disabled"; backend/routes.ts:1258 — seed credential

**Risk:** SuperAdmin has full platform access (user data, payment records, report management). Without MFA
and with a documented seed credential, the admin surface is a single-factor breach target.

**Fix:** Enable MFA before exposing any admin surface publicly; rotate seed credential

---

## SEC-3 · PRE_LAUNCH · OTP Plaintext + No Attempt Cap

**Finding:** CAPADEX OTPs stored and compared as plaintext 6-digit codes. No attempt cap on verify-otp route.

**Evidence:** backend/routes/capadex.ts:2300 — INSERT with raw `code` value; backend/routes/capadex.ts:2437 — WHERE code=$2 string match; capadex_otps table has no attempts column

**Note:** In-memory rate limiter provides partial protection; dev OTP bypass (123456) does NOT exist (subagent claim was wrong).

**Risk detail:** A 6-digit OTP has 1,000,000 possibilities. With only in-memory rate limiting (resets on
restart, ineffective under autoscale), an attacker can brute-force OTPs across server restarts.
The capadex_otps table has columns: id, email, code, expires_at, used, created_at — no `attempts` column.

**Fix:** Add attempt counter column + lock after N failures; consider bcrypt hash for OTP storage

---

## SEC-4 · PRE_LAUNCH · No Helmet (Security Headers Absent)

**Finding:** helmet() is absent from backend. Standard security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) are not set by the application.

**Evidence:** grep helmet backend/index.ts backend/routes.ts → 0 matches

**Missing headers:** HSTS, Content-Security-Policy, X-Frame-Options (clickjacking), X-Content-Type-Options,
Referrer-Policy, Permissions-Policy.

**Fix:** Add helmet() middleware before routes in backend/index.ts

---

## SEC-5 · POST_LAUNCH · In-Memory Rate Limiting

**Finding:** Custom sliding-window rate limiter is in-memory only (backend/services/security-middleware.ts). Resets on every server restart; ineffective under autoscale (multiple instances).

**Evidence:** backend/services/security-middleware.ts — in-memory timestamp arrays per IP/route bucket

**Fix:** Replace with Redis-backed limiter (or Upstash) before scaling past 1 instance

---

## What is CORRECT (do not fabricate gaps)

| Control | Status | Notes |
|---|---|---|
| Auth middleware (requireAuth / requireAdmin / requireSuperAdmin) | ✅ CORRECT | Role-based, Passport.js + JWT |
| Self-registration role allowlist | ✅ CORRECT | Prevents self-assigning super_admin |
| SQL injection | ✅ CORRECT | Drizzle ORM + parameterized queries |
| Session cookies | ✅ CORRECT | httpOnly=true; secure=true in production |
| IDOR guard (career builder) | ✅ CORRECT | resolveEffectiveUserId implemented |
| Anti-enumeration delay | ✅ CORRECT | antiEnumDelay jitter on 404s |
| Dev OTP bypass (123456) | ✅ NOT PRESENT | Grep confirms absence; prior audit note was incorrect |
| bcrypt on OTP | ❌ NOT PRESENT | OTP stored plaintext (see SEC-3); bcrypt on PASSWORDS only |

---

## OTP audit state
- Total OTPs generated: 119
- OTPs consumed (used=true): 114
- Unused OTPs: 5 (may include expired)

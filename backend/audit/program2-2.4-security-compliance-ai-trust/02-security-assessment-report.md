# 02 · Security Assessment Report

Measured against the LIVE codebase. Status legend: **PRESENT** (implemented + active) · **PARTIAL** (implemented, scope/limits noted) · **ABSENT**.

## Application & transport security controls
| Control | Status | Evidence (file · note) |
|---|---|---|
| Password hashing | **PRESENT** | `backend/routes.ts` ~362–379 — `scrypt` (16-byte random salt, 64-byte key), stored `${hash}.${salt}`; consumed by Passport `LocalStrategy`. |
| Super-admin MFA | **PRESENT (always enforced)** | `backend/routes.ts` ~841–867 issue / 887–936 verify. 6-digit, 5-min TTL, `attemptToken`-bound, ≤5 attempts. No password-only path; dev bypass removed. |
| Session management | **PRESENT** | `backend/routes.ts` ~390–434 — `connect-pg-simple` (`express_sessions`); cookie `httpOnly:true`, `secure:true` in prod (`'auto'` dev), `sameSite:'lax'`, `maxAge` 7d. |
| RBAC / admin gate | **PRESENT** | `requireAuth` (~525) + `requireSuperAdmin` (~5281); structural framework-admin gate `app.use('/api/admin', …)` (~5336) + `isFrameworkAdminPath` (`backend/lib/admin-path-gate.ts`). |
| Password policy + lockout | **PRESENT** | `backend/lib/password-policy.ts`; `assertPasswordAcceptable` (~542), lockout after 5 fails / 30-min (`isLockedOut` ~666); HIBP breach check best-effort fail-open. |
| Rate limiting | **PRESENT** | `backend/routes.ts` ~499–502 — Postgres-backed sliding window: login 10/min, register 5/min, mfa-verify 10/min, mfa-resend 5/min. |
| Input validation | **PRESENT** | Global `globalInputHardening` mounted `backend/index.ts` ~133 (prototype-pollution guard, NUL-byte reject, nesting/size bounds) on 100% of API; Zod `validate()` pure-gate `backend/lib/validate.ts` ~37 on high-risk writes. |
| Output redaction | **PRESENT** | `backend/index.ts` ~194 — response bodies passed through `redactDeep` (`backend/lib/redact.ts`) before logging; shared with DB audit writers. |
| SQL injection protection | **PRESENT** | Drizzle ORM parameterized by default (`backend/storage.ts`); raw `pool.query` uses `$1..$n` placeholders (`backend/routes/sdi.ts`); dynamic identifiers guarded by `isSafeTableIdentifier`. |
| XSS protection | **PRESENT** | `escapeHtml` on all user/AI text in `backend/email.ts` ~1863; React default escaping FE; `dangerouslySetInnerHTML` restricted to non-user chart SVG. |
| CSRF protection | **PRESENT** | Signed double-submit `backend/lib/csrf.ts`; mounted FIRST `backend/index.ts` ~34; fails CLOSED; kill-switch `CSRF_PROTECTION_DISABLED=1`; FE global fetch wrapper echoes token. |
| Security headers / CSP | **PRESENT** | Helmet `backend/index.ts` ~100–121 — CSP allowlists (`script-src 'self'`, `object-src 'none'`, Razorpay/YouTube/fonts/blob); kill-switch `CSP_DISABLED=1`. |
| CORS | **PRESENT (same-origin)** | No broad `cors()`; SPA + API same origin; `/api/**` proxied. |
| Secrets management | **PRESENT** | `backend/lib/env-preflight.ts` boot-time prod fail-fast on `SESSION_SECRET`/`DATABASE_URL`, placeholder detection; secrets from `process.env`; no hardcoded prod secrets found. |
| SSRF protection | **PARTIAL** | Outbound fetch (`aiClient`, `razorpay-client`, `voice-screening-twilio`) uses hardcoded / env-derived URLs — **no user-controlled URL sink found** (low exploitability); no explicit egress allowlist / private-IP deny. |
| Encryption in transit | **PRESENT** | TLS for SMTP (`smtppro.zoho.in:465`); web TLS terminated by platform/Cloud Run. |
| Encryption at rest | **PARTIAL** | Passwords hashed (scrypt); DB-at-rest relies on **provider-level** encryption; no application-layer field-level PII encryption. |
| Identity derivation | **PRESENT (session-only)** | `passport.deserializeUser` (~505) from Postgres store; `x-user-id`/header trust removed from live backend. |
| JWT validation | **PARTIAL (3rd-party only)** | Firebase ID tokens RS256-verified against Google certs (`backend/routes/firebase-auth.ts`); dormant `frontend/server` JWT app not in runtime path (hardcoded secret — see SEC-L2). |

## Assessment
The security control set is **comprehensive and active**. No active exploitable vulnerability was found (Launch-Critical = 0). Residual items (session lifetime policy, provider-level-only at-rest encryption, SSRF egress allowlist, dormant JWT hygiene, environment isolation) are recorded in report 10. SSRF is **Low** exploitability today because no user-controlled URL reaches an outbound-fetch sink; it is flagged so an egress allowlist is added *before* any user-supplied-URL feature ships.

**Runtime measurement limitation (not a gap):** AI provider keys are unset in this environment, so live AI-path request handling degrades to honest 503; runtime behavior of AI-adjacent endpoints is unmeasured here (mirrors Phase 2.3 M1).

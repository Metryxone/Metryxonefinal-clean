# 7 · Security Readiness Report

Measured controls (file counts): csrf 3, rateLimit 5, helmet 1, requireAuth 250 files, requireSuperAdmin 195
files, redactJson 5, mfa 8, scrypt 3. Verdict: **security posture is strong and launch-credible**; the one
[High] suspicion raised during assessment was **verified false** (it is gated).

## Confirmed controls
| Area | Control | Evidence |
|---|---|---|
| Auth | Session-based (`express-session` + Postgres store); `mx.sid` httpOnly + sameSite=lax + secure(prod) | `routes.ts:410-421` |
| Auth | Password hashing via **scrypt** (64-byte dk) | `routes.ts:355` |
| Auth | Account lockout (5 attempts / 30 min), **fail-open** on DB error | `routes.ts:637-674` |
| Auth | Super-admin **MFA always enforced**; 6-digit code in `mfa_codes`; dev→console only | `routes.ts:829-855` |
| CSRF | Signed double-submit (`mx.csrf` = token.hmac), mounted **first**, covers `/api` + `/api/v1` + upload proxy, **fail-closed** | `lib/csrf.ts`, `index.ts:34` |
| Rate limit | `/api/login` 10/min, `/api/register` 5/min, MFA verify/resend; global `antiEnumDelay(80)` | `routes.ts:488-491`, `index.ts:126` |
| Headers | Helmet global; strict CSP (`script-src` self+Razorpay, `object-src none`, `frame-ancestors self`) | `index.ts:100-121` |
| RBAC | Universal `/api/admin/*` gate (requireAuth + requireSuperAdmin) + framework-path gate for non-`/admin` admin paths | `routes.ts:5309-5335` |
| Secrets | Prod fail-fast preflight (`SESSION_SECRET`, `DATABASE_URL`) or process exits | `lib/env-preflight.ts` |
| Audit/PII | `redactDeep` in request logger; sensitive body paths skipped; redact-at-write unified trail | `index.ts:170-194` |

## Verified during this assessment
- **PAIE/LDE routes — SUSPECTED HIGH → RESOLVED.** `paie-governance.ts` defines non-`/admin` mutating routes
  (`/api/paie/simulation/run`, `/api/paie/model/evolve`, etc.) **without inline guards**, but
  `routes.ts:14158` mounts `app.use('/api/paie', requireAuth, requireSuperAdmin)` ahead of registration,
  gating the entire prefix. The `/api/admin/paie/*` dashboards are covered by the global admin gate.
  **Not a gap.** (Documents the importance of prefix-level gating for non-`/admin` admin routes.)

## Open gaps (none launch-blocking, all hardening)
| ID | Gap | Severity | Recommendation |
|---|---|---|---|
| SEC-1 | `UPLOAD_SERVICE_TOKEN` shared secret between Node + FastAPI; dev default exists | MEDIUM | ensure a real, rotated token in prod (memory + ENVIRONMENT.md already flag this) |
| SEC-2 | Standard-user OTPs stored plaintext in `capadex` table | LOW–MED | hash + short TTL |
| SEC-3 | `replit_integrations/audio/client.ts` hardcoded `"missing"` key | LOW | clean 503 |
| SEC-4 | Framework-path admin gate depends on a **maintained allowlist** (`isFrameworkAdminPath`); a new non-`/admin` admin route not added to the list would be exposed | MEDIUM | add a test that fails when an admin route is missing from the list (defense-in-depth) |
| SEC-5 | Lockout & some controls **fail-open** on internal error (deliberate availability tradeoff) | INFO | acceptable; document the tradeoff for enterprise security review |

## Known prior-art (from engineering memory — confirm closed in prod)
- Archived mirror (`client-main-emergent-workzip/`) must receive any auth fix or a latent bypass persists.
- A dormant secondary `frontend/server` JWT app with a hardcoded secret exists (empty node_modules; not run by
  any workflow) — confirm it is never deployed.
- CSP kill-switch (`CSP_DISABLED`) and CSRF kill-switch (`CSRF_PROTECTION_DISABLED`) exist — ensure they are
  **not** set in prod.

## Security verdict
- **Authentication, CSRF, rate-limiting, headers/CSP, RBAC gating, secrets fail-fast, and audit redaction are
  all present and correctly wired.** No confirmed launch-blocking vulnerability was found.
- Recommended pre-GA: a **third-party penetration test** + the SEC-1/SEC-4 hardening, plus confirming the
  archived-mirror and dormant-JWT-app are not in the deploy path. None of these block a controlled pilot.

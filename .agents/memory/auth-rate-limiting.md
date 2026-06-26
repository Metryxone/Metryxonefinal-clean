---
name: Auth endpoint rate limiting
description: How brute-force rate limiting is wired onto the auth endpoints, and the CSRF-before-limiter ordering trap when smoke-testing.
---

# Auth endpoint rate limiting

The custom sliding-window `rateLimit()` lives in `backend/services/security-middleware.ts`
(sets `X-RateLimit-*` headers, returns `429 {ok:false,error:'rate_limited',retry_after_seconds}`
+ `Retry-After`, audits over-limit via its `pool`). It is bound as **route-level**
middleware on the auth POSTs in `backend/routes.ts` (`registerRoutes`):
`/api/login`, `/api/register`, `/api/admin/mfa/verify`, `/api/admin/mfa/resend`.

**Why always-ON (not flag-gated):** security controls default ON here, same precedent
as CSRF and PII redaction. Under-limit requests stay byte-identical except for the
additive rate-limit headers.

**Default bucket is `${req.ip}:${req.path}`** → each endpoint gets its own window with
zero custom bucket code. `trust proxy=1` (set in `routes.ts`) makes `req.ip` the real
client IP behind the Replit proxy, so the bucket is correct — do NOT re-parse XFF for it.

## Traps when smoke-testing these endpoints
- **CSRF runs FIRST (global `app.use`), before any route-level limiter.** A POST without
  a valid double-submit token returns **403** and never reaches the limiter — so a naive
  curl burst shows all 403s, not 429s. To exercise the limiter you must pass CSRF:
  `GET /api/csrf-token` (with a cookie jar) returns `{token}` AND sets the `mx.csrf`
  cookie; echo that value in the `x-csrf-token` header on the POST. Kill-switch is
  `CSRF_PROTECTION_DISABLED=1`.
- **`/api/login` ALSO has a per-identifier lockout** (`auth_login_attempts` /
  `isLockedOut`) that can independently return 429. To prove the **IP limiter** is the
  one firing, hit it with a unique random username per request (lockout is per-identifier,
  so it can't trigger) and check the body is `error:'rate_limited'` — the lockout returns
  a different shape.

**Known residual (pre-existing, not a regression):** limiter state is in-process memory,
so counters reset on restart and aren't shared across multi-instance scale-out. Migrate to
shared storage (Redis/Postgres) only if multi-instance deploy becomes active.

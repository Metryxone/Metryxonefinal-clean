---
name: frontend/server latent JWT app & auth-bypass fix
description: The frontend/server/ Express+JWT subproject is dormant; how its auth works and a fixed header-trust bypass.
---

# frontend/server is a latent subproject

`frontend/server/` is a SECOND Node/Express + JWT app (intended port 8000) that is
**not started by any workflow and not deployed**. Its `node_modules` is empty in
this environment, so its `node --test` suites are **not runnable here** without a
full `npm install` (mongoose/openai/razorpay/pdfkit + native builds). Treat its
tests as code-verifiable but runtime-unverified in this workspace.

The real app is `frontend/src` → `backend/` on 8080; the real frontend sends NO
`x-user-id` header, so changes to `frontend/server` break no live flow.

## Auth model (after the bypass fix)
`frontend/server/src/middleware/auth.ts` derives identity ONLY from a verified
JWT — accepted via `Authorization: Bearer`, the `metryx_token` cookie, or
`?token=`. `requireAuth` → 401 when no valid token; `optionalAuth` → proceeds
anonymous (never sets `req.user`) when token missing/invalid.

**Why:** it previously trusted client-supplied `x-user-id` / `x-user-role`
headers as identity, so anyone could send `x-user-role: super_admin` and
impersonate. The header-trust fallback was removed from BOTH middlewares.

**How to apply:** never reintroduce a client-header identity path here; tests
must mint a real HS256 JWT (see `auth/jwt.ts` `mintToken`) rather than set
`x-user-*` headers. A separate open finding: `auth/jwt.ts` has a hardcoded
default JWT secret (still unfixed, out of that task's scope).

## Dep hardening must include this separate package.json
Repo-wide dependency remediation that bumps `backend/` + `frontend/` will MISS
`frontend/server/package.json` — it is its own package and, because it is dormant
(empty `node_modules`, no workflow), it is easy to overlook and silently retains
vulnerable pins (e.g. it lagged on `multer`/`nodemailer` and the ReDoS-prone
`xlsx 0.18.5` after the main app was already hardened).
**How to apply:** when closing dep-vuln gaps "to 100%", also bump this file and
regenerate its lockfile with `npm install --package-lock-only` (resolves without
a heavy full install since the service isn't run). Verify the lock reflects the
new versions; do NOT claim runtime/boot validation here — the service is dormant,
so the honest claim is "declared + locked versions remediated, runtime not
exercised". xlsx here uses only standard utils API → SheetJS CDN 0.20.3 is
API-identical.

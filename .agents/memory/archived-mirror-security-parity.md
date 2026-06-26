---
name: Archived-mirror security parity
description: The repo ships a git-tracked full duplicate tree; security fixes must be mirrored there or a latent bypass persists. Plus health-probe info-leak rule.
---

# Archived mirror is a latent-vuln trap

`client-main-emergent-workzip/` is a **git-tracked, full duplicate** of the app
(its own `frontend/`, `frontend/server/`, `backend`-style code, hooks, tests —
thousands of files). It is NOT in `.gitignore` and is NOT run by any workflow,
so vulnerabilities there are **latent**: invisible to runtime smoke tests but
present in the committed tree and exploitable if that copy is ever run/forked.

**Why this matters:** when you remediate a security issue in the LIVE tree
(e.g. auth middleware, client hooks), grep the WHOLE repo — the same vulnerable
code almost always also exists in the archived mirror (and sometimes in the
dormant `frontend/server/`). Fix every copy or the finding is only partially
closed.

**Concrete case — `x-user-id` impersonation:** the auth middleware
(`.../frontend/server/src/middleware/auth.ts`) historically let `requireAuth` /
`optionalAuth` trust client-supplied `x-user-id` / `x-user-role` headers (full
impersonation incl. `super_admin`). The live BFF copy was hardened (token-only,
with regression tests) but the archived mirror still trusted the headers.
Identity must come ONLY from a verified token/session; client identity headers
are ignored everywhere. The live serving backend (`backend/routes.ts`
`requireAuth`) uses passport sessions and reads no `x-user-id`; `/api/ei/resolve`
deliberately ignores `X-User-Id` — so the client send in `useHybridEI.ts` was
harmless dead weight, safe to remove (byte-identical server behaviour).

**How to apply:** after any auth/security fix, `rg` the pattern across the
repo including `client-main-emergent-workzip/`; mirror the fix. Note the
archived test suites may still assert the OLD behaviour — they don't run, so
leave them unless explicitly in scope, but call it out.

# Health/readiness probes must not echo error details

`/api/health/ready` (and any health endpoint) must NEVER return `e.message` to
the client — DB driver text / connection-string fragments leak through it.
Log the real error server-side (`console.error`) and return status-only
(`{status, db, ts}`). Keep the healthy 200 shape unchanged.

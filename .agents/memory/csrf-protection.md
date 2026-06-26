---
name: CSRF protection (signed double-submit)
description: How CSRF is enforced platform-wide; the non-obvious mount-order, fail-closed, and Bearer-narrowing decisions a future change must preserve.
---

# CSRF protection — signed double-submit

The app authenticates browsers with a `sameSite:'lax'` session cookie (`mx.sid`).
`lax` does NOT block top-level POST navigations, so mutating endpoints were
CSRF-exposed. Closed with a stateless **signed double-submit** token:
cookie `mx.csrf` = `<raw>.<hmac_sha256(raw, SECRET)>`, echoed in header
`x-csrf-token`; server requires header===cookie AND a valid HMAC.
Backend `backend/lib/csrf.ts`, frontend `frontend/src/lib/csrf.ts`.

## Durable decisions (preserve these)

- **Security control ⇒ defaults ON**, NOT flag-OFF like additive feature phases.
  Reversibility is an env kill-switch `CSRF_PROTECTION_DISABLED=1` (token issuance
  still runs so re-enabling is seamless), never a default-off flag.
  **Why:** a CSRF gate that ships off protects nothing.

- **Mount as the FIRST middleware** (before the `/api/v1/upload` reverse-proxy AND
  before the `/api/v1`→`/api` rewrite), not just before `registerRoutes`.
  **Why:** the upload proxy and the version-rewrite sit ahead of the route layer;
  mounting late leaves the proxied upload surface uncovered → not "100%".
  **How:** because it now runs before the rewrite, `canonicalPath()` collapses
  `/api/v1/*`→`/api/*` for exempt/token matching so order can't desync it. The
  guard reads only headers/cookies (no body) so it's safe ahead of `express.json`.

- **FAIL CLOSED on internal error.** The guard's `catch` returns 403 for protected
  mutations; only exempt-by-design requests (safe methods, signed webhooks,
  non-ambient Bearer, non-`/api`) degrade open. **Why:** a `catch → next()` in a
  security control is a bypass class — any parser hiccup would silently disable it.

- **Bearer exemption is NARROWED to requests with NO ambient session cookie.**
  A request carrying BOTH `Authorization: Bearer` and the `mx.sid` cookie is still
  gated. **Why:** exempting all Bearer requests over-broadens the bypass; a browser
  with an ambient session must prove token possession. **How it stays non-breaking:**
  the SPA fetch wrapper adds `x-csrf-token` to EVERY same-origin `/api` mutation, so
  first-party `authFetch` (Bearer + cookie) already carries a valid token and passes.

- **Frontend coverage = one global `window.fetch` monkey-patch** (installed in
  `main.tsx` before render), injecting the header on same-origin `/api` mutations.
  Verified COMPLETE because the frontend has **zero** XHR / axios / sendBeacon /
  form-action POSTs — every mutation goes through `fetch`. If any of those are added
  later, they bypass the wrapper and must set the header themselves.

## Gotchas
- Webhook exemptions are signature-verified server-to-server: `/api/capadex/payment/webhook`,
  `/api/commercial/razorpay/webhook` (canonical, non-v1 paths).
- Dev smoke: upload-proxy GET returns **504** (FastAPI not running on :8002), NOT 403
  — that proves the safe GET passed CSRF and reached the proxy; it is not a CSRF block.
- SECRET reuses `CSRF_SECRET || SESSION_SECRET || dev-constant` (dev constant is stable
  so cookies survive restarts; prod fails fast without `SESSION_SECRET`).

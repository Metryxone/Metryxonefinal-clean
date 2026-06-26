---
name: Security headers (CSP) & BFF CORS
description: Non-obvious constraints when enabling Helmet CSP and hardening the dormant frontend/server CORS on MetryxOne.
---

# CSP on the live backend
The live backend (`backend/index.ts`, helmet) historically shipped with
`contentSecurityPolicy:false` because a naive CSP breaks the production SPA.

**Rule:** a working CSP MUST allowlist every origin the SPA actually loads:
`self` + Razorpay (`checkout.razorpay.com` script, `*.razorpay.com` frame/connect)
+ Google Fonts (`fonts.googleapis.com` style, `fonts.gstatic.com` font) +
`'unsafe-inline'` for **styles only** (shadcn chart injects an inline `<style>`;
many CSS-in-JS libs use inline style attrs). Scripts stay `self` + Razorpay (Vite
prod build emits hashed module scripts under `/assets`, no inline JS).

**Why:** valid behaviour stays byte-identical only if nothing the app already uses
is blocked; the security benefit is blocking origins it does NOT use.

**How to validate:** in dev the frontend is served by Vite (port 5000) which does
NOT carry the backend's helmet header — so a port-5000 screenshot can't test CSP.
Confirm the header on a *backend* response (`curl -D - localhost:8080/api/health`)
and do the real render check against the production-served SPA in staging.
Ship with kill-switch `CSP_DISABLED=1` for instant revert if an origin was missed.

# frontend/server BFF CORS
`frontend/server/` is a dormant BFF (not in any workflow) but its CORS reflected
ANY origin (both branches `cb(null,true)` + blanket prod-true) with
`credentials:true` — a credential-leak/CSRF vector. Hardened to allowlist-only
(`CLIENT_ORIGIN`). The archived mirror `client-main-emergent-workzip/...` carries
the same code and must be fixed in lockstep.

# xlsx residual
`xlsx@0.18.5` (frontend) has a high ReDoS advisory with **no npm fix** — SheetJS
left npm; the only patch is their CDN tarball, which changes install source and
risks parse behaviour. Treat as an owner decision, never a silent swap.

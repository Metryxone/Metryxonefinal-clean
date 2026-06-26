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

**Additional directives the SPA genuinely needs (found by auditing every external
ref in built SPA + src — the only reliable check when you can't load prod):**
- `frame-src` MUST include `blob:` (EmployerPortal résumé PDF preview iframe uses
  `URL.createObjectURL`) AND `https://www.youtube.com` + `https://www.youtube-nocookie.com`
  (VideoPopup embed iframe from ChatWidget/ChatModal). `self`+Razorpay alone breaks both.
- `srcDoc` iframes (CapadexReportsPanel email preview) are covered by `frame-src 'self'`.
- `img-src` keep `https:` (remote avatars/thumbnails).
- WebRTC: `<video srcObject>` (MediaStream) is NOT governed by `media-src`; STUN
  (`stun:stun.l.google.com`) and anchor links (`wa.me`/social) are NOT CSP fetch
  directives → no entry needed. Don't add speculative `media-src`/`worker-src`.
- **Cross-port residual:** `VideoCallRoom` socket.io signaling targets the same host
  on **`:8000`** (a different origin). `wss:` covers its websocket transport, but the
  `polling` (XHR) fallback to `:8000` is NOT allowlisted and CAN'T be without a broad
  `https:` (which guts exfil protection) or the dynamic deploy host. Left documented,
  not "fixed" — standard single-port deploys don't expose `:8000` anyway, so it's a
  pre-existing architecture limitation, not a CSP regression. Honest over a fake fix.

# frontend/server BFF CORS
`frontend/server/` is a dormant BFF (not in any workflow) but its CORS reflected
ANY origin (both branches `cb(null,true)` + blanket prod-true) with
`credentials:true` — a credential-leak/CSRF vector. Hardened to allowlist-only
(`CLIENT_ORIGIN`). The archived mirror `client-main-emergent-workzip/...` carries
the same code and must be fixed in lockstep.

# xlsx — RESOLVED (was: ReDoS, no npm fix)
`xlsx@0.18.5` (frontend) had a high ReDoS advisory with **no npm-registry fix**
(SheetJS left npm). Resolved by installing the SheetJS official patched tarball:
`npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (NOT firewall-
blocked). Sole consumer is `EmployerPortalPage.tsx` using `read`/`utils.sheet_to_json`
/`json_to_sheet`/`book_new`/`book_append_sheet`/`writeFile` — API identical 0.18→0.20,
so byte-identical behaviour. After swap: frontend `npm audit` = 0 vulns, vite build
clean. Supply-chain caveat: source is a CDN tarball, not registry — keep lockfile
integrity pinned; migrate back to a registry artifact if SheetJS republishes.

# Archived mirror — DELETED
`client-main-emergent-workzip/` (237MB, no code refs) was deleted; its orphaned
mockup-sandbox preview workflow auto-removed with the dir. CORS/CSP fixes no longer
need lockstep mirror edits.

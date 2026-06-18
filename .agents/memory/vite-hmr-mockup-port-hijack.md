---
name: Vite HMR vs mockup-sandbox externalPort 80 hijack
description: Why the dev preview shows "server connection lost / WebSocket closed without opened" and how the externalPort 80 mockup squatter breaks HMR
---

# Symptom
Dev preview "not working": app HTTP loads fine but Vite shows `[vite] server connection lost. Polling for restart...` / `[vite] failed to connect to websocket (WebSocket closed without opened.)` at `<domain>:5000/@vite/client`. Bare domain `/` 302→`/__mockup/`.

# Root cause
The canvas **mockup-sandbox Component Preview Server** is a SECOND Vite server (localPort 23636) that the platform maps to **externalPort 80** in `.replit`. The main app's `vite.config.ts` had `hmr.clientPort: 443`, and `wss://<domain>:443` resolves to externalPort 80 → so the HMR handshake is sent to the *mockup* Vite (or to a dead port once mockup is stopped), which closes it. The app's own HTTP still works because the preview/canvas load it via the webview workflow (port 5000), independent of externalPort 80.

# Constraints discovered
- **`.replit` cannot be hand-edited** (port mappings protected → "Direct edits to .replit not allowed"). No agent tool currently remaps an externalPort.
- The mockup workflow **cannot be deleted** (`removeWorkflow` → `PROHIBITED_ACTION: managed by an artifact`). It CAN be left in a stopped/"finished" state, but stopping it leaves externalPort 80 → dead port, so the bare domain then 502s (cosmetic; the webview preview on 5000 is unaffected).

# Fix that works
Point HMR at the app's OWN dedicated external port instead of 443/80:
`vite.config.ts` → `hmr.clientPort: 5000` (host `REPLIT_DEV_DOMAIN`, protocol `wss`). The browser already reaches the app at `<domain>:5000`, so `wss://<domain>:5000` connects cleanly and never touches the hijacked externalPort 80. Restart "Start application" to apply; confirm browser console shows `[vite] connected.` with no "connection lost".

**Why:** externalPort 80 is owned by the artifact mockup and is unfixable from the agent side; the app's port 5000 is exposed and wss-reachable, so HMR should target it directly.
**How to apply:** any future "preview/HMR flapping" here — check for the mockup-sandbox workflow squatting externalPort 80 before touching app code; the durable cure is HMR clientPort = app port, not a .replit edit.

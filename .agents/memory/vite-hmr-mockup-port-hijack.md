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

# Fix that works (port-mapping–dependent — re-check `.replit` every time)
`hmr.clientPort` MUST equal the **externalPort the browser actually loads the app on**, which is platform-managed and HAS CHANGED over time. Read `.replit` `[[ports]]`, find the mapping whose `localPort = 5000`, and set `clientPort` to its public port:
- If `localPort 5000 → externalPort 80` (app served at `https://<domain>` over default 443): `hmr.clientPort: 443`. ← current state.
- If `localPort 5000 → externalPort 5000` (app reached at `<domain>:5000`): `hmr.clientPort: 5000`. ← earlier state.

Host `REPLIT_DEV_DOMAIN`, protocol `wss`. Restart "Start application"; confirm browser console shows `[vite] connected.` with NO "server connection lost".

**Why:** if `clientPort` names an externalPort that does not exist in `.replit` (e.g. `:5000` after the app moved to externalPort 80), the wss handshake can never connect → the preview "flashes and goes" (endless reconnect/reload). The mockup-sandbox squat on externalPort 80 was the ORIGINAL trigger, but the root invariant is just "HMR port = the app's live external port."
**How to apply:** any future "preview/HMR flapping" here — FIRST diff `.replit` `[[ports]]` to see which externalPort maps to localPort 5000, then set `clientPort` to match. Do NOT assume the prior value; mappings are not editable by the agent but the platform reshuffles them.

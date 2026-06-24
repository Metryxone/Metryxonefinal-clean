---
name: Build & deploy tooling reality
description: How MetryxOne actually builds/runs in prod, and why a backend tsc gate is a trap
---

# Build & deploy tooling reality

**Production runs the backend on `tsx`, never compiled JS.** `.replit` deploy:
- `run = cd backend && NODE_ENV=production npx tsx index.ts`
- `build = cd frontend && npm run build && cp dist/. → backend/public/`

So the **only** real launch gate is the frontend `vite build` (passes; **takes >120s** — see "Running the frontend build as a gate" below). The backend is type-erased at runtime by tsx/esbuild — it is **never type-checked**.

## Do NOT try to "fix" the backend build into a tsc gate
- `backend/package.json` `build:server` → `tsc -p server/tsconfig.build.json` (**file doesn't exist**) and `build:client` → `vite build` (no vite app in backend). The whole backend `npm run build` is vestigial/broken and unused by deploy.
- `backend/tsconfig.json` `extends "../tsconfig.json"` which **does not exist** at repo root.
- Code uses **extensionless relative imports**, incompatible with the previously-intended `NodeNext` resolution.
- **Why it's a trap:** enabling `tsc` surfaces an unbounded volume of never-checked errors across 13k+ line files + drizzle `node_modules` lib noise (no effective `skipLibCheck`). It has zero runtime/deploy benefit. Document as tech debt; don't hot-patch in a validation/small task.
- **How to apply (if ever asked to add a gate):** make a self-contained config (`skipLibCheck:true`, `module/moduleResolution: ESNext/Bundler` to tolerate extensionless imports, `noEmit:true`), exclude dead `backend/exam-ready.v1.routes.ts`, and treat the first error dump as a backlog — not a launch blocker.

## Running the frontend build as a gate
- A plain foreground `npx vite build` can blow past the 120s bash limit, and **background/`nohup`/`setsid` builds get reaped** when the tool call returns (their log goes empty / only the banner line survives). Don't keep retrying detached builds — they will keep dying.
- **What actually works:** foreground with a bumped heap finishes in **~49s**: `cd frontend && NODE_OPTIONS=--max-old-space-size=4096 timeout 115 npx vite build`. The default heap is what makes it slow/OOM; with 4GB it completes well under the limit. **Why:** the default Node heap thrashes on this large bundle; raising it removes the GC stall, not a timeout problem per se.
- Alternative: restart the configured **`build` workflow** — workflow-managed so it survives (it may report "didn't open a port" since a build exits; that's expected). Verify either way via `dist/index.html` mtime + `dist/assets` chunk count.

## Other durable facts
- Schema is bootstrapped **lazily** (`ensure*Schema()` on first request); there is **no migration runner**. Tables can exist in one env and not another (observed: `capadex_behavioural_memory` absent while `career_memory_snapshots` present). Prod≡dev is not guaranteed.
- Full validation write-up lives at `docs/PRODUCTION_VALIDATION.md` (Launch Readiness 84/100, GO with fast-follow).

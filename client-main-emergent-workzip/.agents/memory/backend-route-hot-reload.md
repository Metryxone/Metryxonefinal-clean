---
name: Backend route file hot-reload
description: New backend route files may not go live until the Backend API workflow is restarted.
---

After adding a NEW backend route file and wiring its `register…Routes(app, …)` call into
`backend/routes.ts`, the route can still return Express's default `Cannot GET …` 404 even
though the edits are correct — the `dev:server` (tsx) watcher did not pick up the
newly-created module / re-run route registration.

**Why:** route registration runs once at server start; a freshly added file + import was not
reliably reflected by the running dev process in this repl.

**How to apply:** after adding/registering a new route file, `restart_workflow("Backend API")`
before smoke-testing. A `Cannot GET` (HTML 404) on a route you just registered = not live yet;
your own JSON 404/401 = live. (Don't trust a stale `[feature-flags] … flags loaded` count in
old log files either — re-check after restart.)

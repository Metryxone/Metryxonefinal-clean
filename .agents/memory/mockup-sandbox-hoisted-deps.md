---
name: mockup-sandbox hoisted deps & npm prune trap
description: Why `npm uninstall`/`npm install <one>` in frontend breaks the canvas mockup-sandbox workflow, and how to recover without churning the committed lockfile.
---

The canvas mockup-sandbox (`frontend/artifacts/mockup-sandbox`) has its OWN `package.json`/`package-lock.json`, but its workflow runs `vite` whose config is bundled to `frontend/node_modules/.vite-temp/` and therefore resolves deps from **`frontend/node_modules`** (walks up, never into the sibling `artifacts/mockup-sandbox/node_modules`). So the sandbox's deps must be **hoisted/present in `frontend/node_modules`**, even though they are NOT listed in `frontend/package.json` — i.e. they live there as **extraneous** packages.

**The trap:** any `npm install` / `npm uninstall` run in `frontend` reconciles `node_modules` against `frontend/package.json`+lock and **prunes ALL extraneous packages** — wiping the sandbox's hoisted deps (e.g. `fast-glob`, `chokidar`, `vaul`, `tw-animate-css`, …). Symptom: the mockup-sandbox workflow fails to start with a cascade of `ERR_MODULE_NOT_FOUND: Cannot find package '<x>' imported from .../.vite-temp/vite.config.ts.timestamp-*.mjs` (fix one, the next surfaces).

**Why one-at-a-time fails:** `npm install --no-save <single-pkg>` ALSO reconciles → it re-prunes the extraneous deps you added in the previous call. The set never converges.

**Recovery (do this):**
- Install the **complete** sandbox dep set in **ONE** `npm install --no-save --no-audit --no-fund <all devDeps>` command (one reconcile keeps them all). Derive the list from `artifacts/mockup-sandbox/package.json` devDependencies.
- `--no-save` does **NOT** modify `frontend/package-lock.json` (verified byte-identical to HEAD after). Good: a temporary tool install (e.g. `sharp` for image conversion) must leave zero committed-dependency footprint.
- Clear vite's stale config cache `rm -rf frontend/node_modules/.vite-temp` before restarting (it caches the broken config resolution).

**Verification gotcha:** `require.resolve('<pkg>')` gives **false negatives** for CSS-only / type-only packages (`tw-animate-css`, `@types/*`, some `@replit/vite-plugin-*`) — they have no JS entry point. Verify presence by **directory existence** (`[ -d node_modules/<pkg> ]`) or, definitively, by **restarting the workflow** and confirming `VITE ... ready`.

**How to apply:** if you must `npm install`/`uninstall` in `frontend` (e.g. a one-off tool), expect to re-restore the sandbox deps afterward with the single bulk `--no-save` command, then restart the mockup-sandbox workflow to confirm. Confirm `frontend/package-lock.json` still matches HEAD (`git show HEAD:frontend/package-lock.json | diff - frontend/package-lock.json`).

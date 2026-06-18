---
name: Static serving & served-doc single-sourcing
description: How frontend/public vs backend/public serving works, and why served docs should be symlinks to a single canonical source.
---

# Static serving & served-doc single-sourcing

`backend/public/` is a **build-output directory**, NOT source. The deploy build step
(`.replit`, set via `deployConfig`) runs
`cd frontend && npm run build && rm -rf ../backend/public && mkdir -p ../backend/public && cp -r dist/. ../backend/public/`,
and `backend/static.ts` serves it via `express.static` in production. It is now
git-ignored (`backend/public/` in root `.gitignore`) and the build **cleans before
copying** — so stale hashed assets no longer accumulate. Treat anything under
`backend/public/` as regenerated; never hand-edit or commit files there.
**Why the clean step matters:** the old build used a bare `cp -r dist/.` with no
`rm`, so every deploy layered new content-hashed files on top of old ones — ~13 stale
copies of every asset piled up (2,163 JS files / 118MB / 2,216 tracked files) before
this was fixed.

The **real** served source is `frontend/public/` (Vite publicDir). In dev the frontend
(vite :5000) serves `/docs/*` etc. from `frontend/public/`; the deploy build copies that
into `backend/public/` for prod. In-app doc links are plain `<a href="/docs/X.md">`
(browser navigates to the static file), e.g. the Documentation page links
`/docs/CAPADEX_Documentation.md`.

**Single-sourcing a served doc:** keep ONE canonical file (e.g. `docs/CAPADEX.md`) and make
the served path a **symlink** to it (`frontend/public/docs/CAPADEX_Documentation.md ->
../../../docs/CAPADEX.md`). Verified: vite dev serves the symlink (HTTP 200, full body) and
`vite build` dereferences symlinks (copies real content into `dist`, then into
`backend/public`). 

**Why:** avoids maintaining 3 byte-identical copies (dev canonical + frontend served +
backend artifact) that silently drift.
**How to apply:** never create parallel doc copies in `frontend/public` + `backend/public`;
symlink the served path to the single source and let the build dereference it. Don't commit
fixes "into" `backend/public` — they get overwritten by the next deploy build.

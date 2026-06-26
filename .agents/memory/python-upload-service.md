---
name: Python bulk-upload service
description: Second backend (Python/FastAPI) living in backend-main/, separate from the Node backend, sharing the same DB.
---

# MetryxOne Bulk Upload (Python/FastAPI)

A SECOND backend, distinct from the Node/Express one. Lives in `backend-main/app/`
(package `app`, entry `app.main:app`). Run via the `Upload Service` workflow:
`cd backend-main && uv run --project /home/runner/workspace uvicorn app.main:app --host 0.0.0.0 --port 8000`.
Deps are uv-managed in the repo-root `.pythonlibs` venv (pyproject at root).

**Purpose:** bulk-import `question_bank` / `question_options` / `task_variants`
from CSV/XLSX into the SHARED PostgreSQL DB (reads `DATABASE_URL`). Active route
is `admin_upload.py` (`POST /admin/upload`, registry+handlers path); `upload.py`
is dead (commented out in main, and has its own `job.meta`/`question_code` bugs).

**Why it's separate:** different stack entirely; only the DB is shared. Never
"merge" it into the Node backend.

## Traps / lessons
- **`llm_proxy.py` can't run on Replit** — imports `emergentintegrations` + needs
  `EMERGENT_LLM_KEY` (Emergent-platform only). `main.py` deliberately does NOT
  include that router. Do not re-add it here.
- **bootstrap `create_all` must stay scoped** — `bootstrap.py` creates ONLY the
  uploader tables (question_bank/question_options/task_variants/bulk_upload_jobs/
  bulk_upload_rows). The models file ALSO declares users/students/tests/attempts;
  an unscoped `create_all` would let this service own unrelated schema in the
  shared DB. Keep the explicit `tables=` list.
- **question_options links by FK, not code** — `QuestionOption` has `question_id`
  (FK→question_bank.id) + unique (question_id, option_code); there is NO
  `question_code` column. Handler resolves question_code→QuestionBank.id first.
- **Starlette ≥1.3 TemplateResponse** — new signature is
  `TemplateResponse(request, name)`, not `(name, {"request": request})`.
- **Public port-8000 surface (FIXED, finding #14):** `.replit` publishes localPort
  8000 → externalPort 8000 (uneditable), so `/admin/*` was reachable on the public
  internet with NO auth. Fixed by an always-ON shared-secret gate `app/security.py`
  `require_upload_auth` (Depends on the router): constant-time `hmac.compare_digest`
  of `X-Upload-Service-Token` vs `UPLOAD_SERVICE_TOKEN`; dev-fallback constant keeps
  dev byte-identical, **prod fail-closed (503) when the env var is unset**, kill-switch
  `UPLOAD_AUTH_DISABLED=1`. The Node side reaches it via a `requireAuth→requireSuperAdmin`
  proxy at `/api/v1/upload` (in `routes.ts`, AFTER session/passport — the old `index.ts`
  proxy was DEAD: targeted port 8002 + ran pre-session so could never auth); the proxy
  injects the secret header only AFTER the super-admin guard passes.
  **Why mirror the CSRF precedent:** security controls are always-ON (never flag-gated),
  fail-closed in prod, dev-fallback for byte-identical dev.
- **`parser.py` validates server-side, not just by extension:** `_safe_filename`
  (basename only, reject path components / NUL / control chars, whitelist
  `.csv/.xlsx/.xls` → 400) + `_read_capped` (`MAX_UPLOAD_BYTES` env, default 10MB → 413).
  Reads into `BytesIO` then pandas, so valid-file parse output stays byte-identical.

## Dev-DB table collision recovery (admin login broke)
- An **unscoped** `create_all` (or an old run of it) let this Python service own a
  `users` table in the SHARED dev DB whose shape **conflicts** with the Node
  Drizzle `users` schema → Node admin login failed with "Incorrect email or
  password" because the row/columns didn't match. Recovery: drop the
  Python-domain tables, recreate `users` to match `backend/shared/schema.ts`, and
  re-seed the super admin (`storage.ts seedSuperAdmin`).
- The dev DB is **missing many Node tables** (most `relation does not exist` boot
  errors are pre-existing/non-fatal). Admin login specifically needs **both**
  `users` AND `mfa_codes` (super-admin login writes an `mfa_codes` row; a missing
  table → 500 "Failed to generate MFA code"). `express_sessions` is auto-created
  lazily by the session store on first login. A full `drizzle-kit push` was NOT
  run (risky); tables were created surgically to match the Drizzle schema.

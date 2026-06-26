---
name: Env preflight & GCP deploy env contract
description: The Node↔FastAPI env-var contract, the SESSION_SECRET vs SECRET_KEY naming trap, and the production boot preflight design.
---

# Production env vars: preflight + canonical-deploy contract

**Boot preflight** lives in `backend/lib/env-preflight.ts`, called once at the top of
`backend/index.ts`. It is PRODUCTION-ONLY (`if NODE_ENV!=='production' return`) so the
dev boot is byte-identical (no output). Two tiers:
- FATAL `process.exit(1)`: `SESSION_SECRET`, `DATABASE_URL` (app cannot run securely/at all).
- Loud WARN (never blocks): `ZOHO_EMAIL`+`ZOHO_APP_PASSWORD`, `FASTAPI_URL` (localhost/unset),
  `UPLOAD_SERVICE_TOKEN` (unset/dev-placeholder), `OPENAI_API_KEY`, `MONGODB_URI`
  (degrade only — `MONGO_REQUIRED` defaults false).

**Validation traps (don't regress):**
- `SESSION_SECRET` validity = **trim + non-empty + not a known placeholder**. A naive `!!value`
  passes a whitespace-only `'   '` secret → must `.trim()` BEFORE the length/placeholder test.
- **No localhost guard on `DATABASE_URL`** by design: Cloud SQL Auth Proxy legitimately uses
  `127.0.0.1`, so a localhost-reject rule is a false positive that blocks a valid prod boot.
- Sole export is `assertEnvPreflight()` (calls `process.exit`); no pure evaluator → test by
  invoking under tsx with env set and checking the exit code (whitespace→1, valid→0).

**Why WARN, not FATAL, for Zoho/upload/AI:** those only degrade an admin-only or
fail-soft feature. Aborting the whole platform boot (taking end-user traffic offline)
for an admin-MFA-email or bulk-upload misconfig is a worse failure than a loud warning.
A "launch blocker" (checklist gate) is NOT the same as a "boot blocker".

## The naming trap (real bug fixed)
- The **Node** backend requires **`SESSION_SECRET`** (fail-fasts without it; re-checked in
  `routes.ts` session setup).
- **`SECRET_KEY`** is the **FastAPI/Python** key — a DIFFERENT variable.
- The canonical deploy `scripts/deploy-gcp.sh` historically set only `SECRET_KEY` on the
  Node service → Node would fail-fast on boot in prod. Fix: deploy now also generates and
  sets `SESSION_SECRET` on the Node service.

## Upload-service shared-secret contract
- `UPLOAD_SERVICE_TOKEN` must be **identical on BOTH** Cloud Run services (Node injects it as
  `x-upload-service-token`; FastAPI `app/security.py` verifies it).
- In **prod** the Node default is `""` (no header) and FastAPI **requires** a real token →
  uploads fail CLOSED if unset (secure, but silent at request time — hence the preflight WARN).
- FastAPI only enforces the token when it thinks it is in prod: `security.py` checks
  `NODE_ENV` **or** `ENV` == `production`. The deploy now sets `ENV=production,NODE_ENV=production`
  on the FastAPI service, otherwise enforcement silently stays off.

## Deploy-time readiness gate (`scripts/deploy-gcp.sh`)
- `validate_inputs()` collects **ALL** missing required vars + format/placeholder problems and
  reports them at once (not one-at-a-time `${VAR:?}` aborts).
- `--check` / `--dry-run` / `CHECK_ONLY=1` = validate (and audit Secret Manager if gcloud present)
  then exit 0 **without deploying**.
- **Placeholder regex must be anchored** to template tokens that never occur in real credentials
  (`<...>`, `changeme`, `replace_me`, `xxxxx`, `placeholder`). Do NOT match loose substrings like
  `your-` — a real password can contain them, and that wrongly blocks a valid deploy. Verify with a
  valid input whose password contains `your-` → must exit 0.
- Has `set -e` + `set -o pipefail`. `set -u` deliberately NOT added — retrofitting it onto the large
  existing script risks unbound-var regressions that block valid deploys.

## Where vars are documented
`docs/ENVIRONMENT.md` is the authoritative reference (required/recommended/optional, per
service, where to set). `.env.example` is NOT usable here — `.env.*` is gitignored, and
secrets are managed via deployment panes / GCP Secret Manager, not `.env` files.

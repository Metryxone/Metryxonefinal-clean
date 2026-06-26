# Environment Variables — authoritative reference

Single source of truth for every environment variable MetryxOne reads. Secrets
are **not** stored in the repo — set them in the deployment secret store
(GCP Secret Manager for the canonical deploy, or the Replit Deployments pane for
the autoscale preview). This file is the checklist to verify against before launch.

The Node backend runs a **boot-time preflight** (`backend/lib/env-preflight.ts`,
called from `backend/index.ts`). In production it **refuses to start** if a
REQUIRED var is missing and prints a loud `[WARN]` line for each missing
RECOMMENDED var. In development the preflight is a no-op (byte-identical boot).

## REQUIRED in production (boot aborts if missing)

| Var | Service | Purpose / failure mode if unset |
|-----|---------|----------------------------------|
| `SESSION_SECRET` | Node API | express-session signing key. Unset in prod => **boot aborts** (also re-checked in `routes.ts`). Use a long random value. |
| `DATABASE_URL` | Node API + FastAPI | Postgres connection string. Unset => the app cannot function. |

## RECOMMENDED in production (boot continues, loud warning)

| Var | Service | Purpose / failure mode if unset |
|-----|---------|----------------------------------|
| `ZOHO_EMAIL` + `ZOHO_APP_PASSWORD` | Node API | Super-admin 2FA codes are emailed via Zoho. In prod the code is **never logged or returned**, so if Zoho is unconfigured **super-admin login is impossible** — a launch blocker for admin access (end-user traffic is unaffected, which is why the boot warns instead of aborting). |
| `FASTAPI_URL` | Node API | URL of the externally-published FastAPI bulk-upload service. Unset/`localhost` => admin bulk uploads fail (default in code is `http://localhost:8000`, which does not exist in a deployed environment). |
| `UPLOAD_SERVICE_TOKEN` | Node API **and** FastAPI | Shared secret the Node proxy injects and FastAPI verifies. Must be **identical on both services**. Unset/placeholder => uploads are rejected (fail-closed). The canonical deploy (`scripts/deploy-gcp.sh`) generates and sets this on both services. |
| `OPENAI_API_KEY` | Node API | AI features are fail-soft. Unset => AI paths stay dormant (acceptable). |

## Optional / context-specific

| Var | Service | Purpose |
|-----|---------|---------|
| `MONGODB_URI` | Node API + FastAPI | Mongo connection (required by the GCP deploy script). |
| `EMERGENT_LLM_KEY` | FastAPI | LLM provider key; the deploy maps it to `OPENAI_API_KEY` on the Node service. |
| `SECRET_KEY` | FastAPI | Python/FastAPI signing key (distinct from the Node `SESSION_SECRET`). |
| `ENV` / `NODE_ENV` | FastAPI / Node | `production` activates prod guards (e.g. FastAPI upload-token enforcement). |
| `APP_URL` | Node API | Public base URL (`https://metryx.one` in `[userenv.production]`). |
| `CSRF_PROTECTION_DISABLED` | Node API | Kill-switch for CSRF (leave unset/0 in prod). |
| `CSP_DISABLED` | Node API | Kill-switch for the Content-Security-Policy header (leave unset/0 in prod). |
| `UPLOAD_AUTH_DISABLED` | FastAPI | Kill-switch for upload-token auth (must NOT be `1` in prod). |
| `VITE_FIREBASE_*` | Frontend | Public Firebase config (already in `.replit [userenv.shared]`; safe to commit). |

## Where to set them

- **Canonical production (GCP Cloud Run + Firebase)** — `scripts/deploy-gcp.sh`
  stores secrets in GCP Secret Manager and wires them onto both Cloud Run
  services. It auto-generates `SESSION_SECRET`, `SECRET_KEY`, and
  `UPLOAD_SERVICE_TOKEN` if not supplied, and passes through `ZOHO_*` when set in
  the environment. Provide `ZOHO_EMAIL`/`ZOHO_APP_PASSWORD` to the script (or set
  them in Secret Manager) to avoid super-admin lockout.
- **Replit autoscale (dev/preview only)** — set values in the Replit Deployments
  pane. Note this target runs only the Node backend, so uploads additionally need
  an externally-published FastAPI and a matching `FASTAPI_URL` / `UPLOAD_SERVICE_TOKEN`.

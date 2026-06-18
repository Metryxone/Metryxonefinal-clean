# WC-C8B · Deliverable 2 — Production Secret Verification

**Date**: 2026-06-10T10:57:52.282Z  
**Method**: `process.env` presence at runtime (corroborated by the Secrets pane via viewEnvVars). Secrets in Replit are **global** (not environment-scoped) — a secret present here is inherited by the production Deployment unless explicitly overridden.

| Secret / Var | Present | Launch role |
|---|---|---|
| `SESSION_SECRET` | ✅ yes | Required for prod (fail-fast `process.exit(1)` if missing under NODE_ENV=production). **Satisfied** — WC-C8A blocker cleared. |
| `ZOHO_EMAIL` | ✅ yes | MFA + OTP email sender. |
| `ZOHO_APP_PASSWORD` | ✅ yes | MFA + OTP email auth. |
| `SUPERADMIN_INITIAL_PASSWORD` | ❌ no | Credential rotation lever (see Deliverable 3). **Absent → admin123 still live.** |
| `RAZORPAY_KEY_ID` | ❌ no | Payment processor (Paid Pilot). |
| `RAZORPAY_KEY_SECRET` | ❌ no | Payment processor (Paid Pilot). |
| `RAZORPAY_WEBHOOK_SECRET` | ❌ no | Webhook HMAC verification (Paid Pilot). |
| `NODE_ENV` (this runtime) | `(unset)` | Production deploy must run with `NODE_ENV=production` to engage fail-fast + prod hardening. |

## Residual owner confirmations (cannot be proven from the workspace)

- **Deployment override**: confirm the production Deployment does not override `SESSION_SECRET` to empty. The global secret is inherited by default, but a deployment-scoped override would shadow it. (Owner-verifiable only in the Deployments pane.)
- **NODE_ENV**: confirm the Deployment runs with `NODE_ENV=production` so the fail-fast and prod cookie/security behaviour engage.

**Verdict**: SESSION_SECRET **present** (WC-C8A blocker #3 cleared); Razorpay secret set **absent (gates Paid Pilot)**.

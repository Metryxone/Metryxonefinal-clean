# WC-C8B · Deliverable 3 — Credential Rotation Verification

**Date**: 2026-06-10T10:57:52.282Z  
**Mechanism** (`storage.ts seedSuperAdmin`): on startup, if a super_admin row exists **and** `SUPERADMIN_INITIAL_PASSWORD` is set, the row's password hash is UPDATEd to the new value (idempotent rotation). If the env var is absent, the seeded default `admin123` remains.

| Check | Evidence | Result |
|---|---|---|
| super_admin row exists | 1 row(s); username `su***@metryx.one` | ✅ PASS |
| `SUPERADMIN_INITIAL_PASSWORD` set | absent | ❌ FAIL |
| Rotation mechanism armed (restart required) | env var absent → rotation has NOT run; default `admin123` stands | ❌ FAIL |
| super_admin row `created_at` | 2026-05-15T13:28:42.054Z | informational |

## Honest finding

**`SUPERADMIN_INITIAL_PASSWORD` is NOT set.** The rotation has never run, so the super_admin password is still the seed default **`admin123`** — a publicly documented credential (it appears in `replit.md`). This is an active, platform-wide security exposure: anyone who reads the repo can log in as super_admin. This gates BOTH launches.

## Owner action to close

1. Set secret `SUPERADMIN_INITIAL_PASSWORD` = a strong password (Secrets pane).
2. Restart the Backend API workflow (and the production Deployment) → log line `Super Admin password rotated via SUPERADMIN_INITIAL_PASSWORD`.
3. Confirm login with the new password; the old `admin123` should be rejected.

**Verdict**: ❌ FAIL — admin123 still live; rotation not performed.

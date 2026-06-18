# WC-C8A: Startup Hardening Check

**Date**: 2026-06-10T13:58:16.463Z  
**Gate**: G7 sub-items — fail-fast, graceful shutdown

| Check | Present | Result |
|---|---|---|
| `helmet` imported | true | ✅ PASS |
| SESSION_SECRET fail-fast (exits in prod if missing) | true | ✅ PASS |
| SIGTERM/SIGINT graceful shutdown handler | true | ✅ PASS |

## Remediation Applied

- **Fail-fast**: `if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) process.exit(1)` added before IIFE in `backend/index.ts`
- **Helmet**: `app.use(helmet({ contentSecurityPolicy: false }))` added
- **Graceful shutdown**: `httpServer.close()` → `process.exit(0)` on SIGTERM/SIGINT; 10 s force-exit via `setTimeout(...).unref()`
- **Credential rotation**: `storage.ts seedSuperAdmin` now reads `SUPERADMIN_INITIAL_PASSWORD` env var; if set, UPDATE existing super_admin password hash on next restart

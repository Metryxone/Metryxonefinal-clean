# WC-C8A: Seed-Demo-Users Gate Check

**Date**: 2026-06-10T13:58:16.463Z  
**Gate**: G7 P0 — Unauthenticated super_admin creation  
**Verdict**: ✅ PASS

| Check | Result |
|---|---|
| Unauthenticated POST /api/seed-demo-users | HTTP 401 — ✅ Correctly rejected (401/403) |
| super_admin removed from seed payload | ✅ Not present in seed array |
| Plaintext credentials removed from response | ✅ credentials key removed from response JSON |

## Remediation Applied

- Added `requireAuth` middleware to `POST /api/seed-demo-users` (runs before handler)
- Added inline super_admin role check (requireSuperAdmin defined later in file; inline guard avoids forward-reference)
- **Removed** `admin@metryx.one / Admin@123` entry from `demoUsers` array — seed never mints privileged credentials
- **Removed** plaintext `credentials` key from success response
- **Fixed** password hashing: replaced invalid `crypto.hash()` call with correct `scrypt` implementation

## WC-C8 Before vs After

| Metric | Before (WC-C8) | After (WC-C8A) |
|---|---|---|
| Route auth | ❌ UNAUTHENTICATED | ✅ requireAuth + super_admin guard |
| super_admin in seed | ❌ Creates admin@metryx.one/Admin@123 | ✅ Removed |
| Credentials in response | ❌ Plaintext passwords in JSON | ✅ Removed |

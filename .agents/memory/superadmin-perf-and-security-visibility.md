---
name: SuperAdmin perf chunking + security visibility-only
description: Durable traps from STEP 11 bundle splitting and STEP 12 read-only audit/permission/session visibility on the SuperAdmin dashboard.
---

## Vite manualChunks catch-all must return undefined, not "vendor"
In `frontend/vite.config.ts`, split named vendor buckets (react/radix/motion/icons/query/charts/pdf) but the catch-all branch must `return undefined` (let Rollup decide), NOT `return "vendor"`.
**Why:** a single mega "vendor" chunk pulls everything eager and triggers circular-chunk warnings; returning undefined for the remainder gives clean code-split with zero circular warnings.
**Measured (do not assert targets):** entry index 608.09 → 465.83 kB gz (−23.4%) when the named buckets were added.

## Admin audit middleware: global, fire-and-forget, status-gated
`createAdminAuditMiddleware` is mounted once as `app.use('/api/admin', ...)` AFTER the auth gate. It writes `admin_audit_logs` ONLY on the `finish` event, ONLY for mutating verbs (POST/PUT/PATCH/DELETE) with status `<400` ("only record actions that took effect"). GET never writes. It is never-throws and does not alter the response or latency.
- It coexists with route-specific `storage.createAdminAuditLog(...)` calls — expect BOTH a generic HTTP-verb row (action_type='POST') and a semantic row (action_type='create_role') for one action. This is intended, not a duplicate bug.

## Dev-DB schema drift blocks most admin mutations (environment quirk)
This dev DB has pervasive pre-existing schema drift — many admin tables don't exist (assessment_templates, education_boards, capadex_users, notifications, platform_settings, subscription_packages all MISSING). So nearly every admin mutation 500s, which correctly writes NO audit row (status-gate).
**Among RBAC/settings candidates, only `feature_flags` and `role_definitions` exist.** To prove a positive audit write live, use `POST /api/admin/roles` (writes `role_definitions`) — it returns 200. Clean up after: delete the throwaway role + the test audit rows.

## Dev super-admin login (recap, for smoke tests)
passport local strategy keys on `username` NOT email. `POST /api/login {username,password:<dev seed pw — see replit.md>}` → attemptToken (2FA gated); read code from `mfa_codes` (Zoho absent in dev → emailSent:false); `POST /api/admin/mfa/verify {code,attemptToken}`. Active sessions read from `express_sessions` (NOT the non-provisioned `user_sessions`).

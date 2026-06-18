# WC-C8A: SuperAdmin MFA Handlers Check

**Date**: 2026-06-10T13:58:16.463Z  
**Gate**: G7 sub-item — SuperAdmin MFA

| Check | HTTP Status | Result |
|---|---|---|
| POST /api/admin/mfa/verify (no body → 400) | 400 | ✅ Handler present (400) |
| POST /api/admin/mfa/resend (no body → 400) | 400 | ✅ Handler present (400) |

## Remediation Applied

1. **Login MFA block** (`POST /api/login`): un-commented; uses `randomBytes(4).readUInt32BE(0) % 900000` (crypto-secure 6-digit); sends code to `user.username` (actual admin email, not hardcoded `support@metryx.one`)
2. **POST /api/admin/mfa/verify**: validates code + attemptToken + expiry + attempts cap (≥5 → 429); marks used; calls `req.login()`
3. **POST /api/admin/mfa/resend**: invalidates old codes; generates new code; sends to admin email; returns new `attemptToken`
4. **`sendMfaCode`** added to email import in `routes.ts`
5. **`mfaCodes`** added to schema import in `routes.ts`

## Frontend

`SuperAdminLogin.tsx` already has full MFA UI — no frontend changes required. Handlers wire to the existing UI contract.

## End-to-End Test Required

- Log in as superadmin@metryx.one with correct password
- System should send MFA code to ZOHO email (ZOHO_EMAIL / ZOHO_APP_PASSWORD configured ✅)
- Enter code in MFA screen → should log in
- Wrong code 5× → 429

> ⚠️ STOP FOR APPROVAL: End-to-end MFA email delivery must be confirmed with real credentials before production launch.

# WC-C8A: OTP Attempt Cap Check

**Date**: 2026-06-10T13:58:16.463Z  
**Gate**: G7 sub-item — brute-force OTP

| Check | Result |
|---|---|
| `attempts` column in `capadex_otps` | ✅ Present |
| Attempt cap check (≥5 → 429) in verify-otp handler | ✅ PASS |
| Attempt increment on mismatch | ✅ PASS |

**DB note**: Column present in DB (default: 0).

## Remediation Applied

- Migration: `backend/migrations/20260610_capadex_otp_attempts.sql`
- Lazy ensure: `ALTER TABLE capadex_otps ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0` fires at `registerCapadexRoutes` startup
- `POST /api/capadex/auth/verify-otp`: checks `MAX(attempts) >= 5` before code comparison → 429
- On mismatch: `UPDATE capadex_otps SET attempts = attempts + 1` on live OTPs for email

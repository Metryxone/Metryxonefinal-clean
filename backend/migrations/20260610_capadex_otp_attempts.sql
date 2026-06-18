-- WC-C8A: Additive — add attempt-counter column to capadex_otps
-- Idempotent via ADD COLUMN IF NOT EXISTS.
-- Purpose: allow verify-otp to lock an email after 5 wrong guesses
--          (brute-force cap identified in WC-C8 SEC-3 audit finding).

ALTER TABLE capadex_otps
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

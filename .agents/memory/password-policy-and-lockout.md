---
name: Password policy, login lockout & seed-admin hardening
description: How user-chosen passwords, account lockout, and the super-admin seed credential are gated platform-wide.
---

# Password policy, login lockout & seed-admin hardening

One shared validator (`backend/lib/password-policy.ts`) gates every USER-CHOSEN
password and the operator-supplied super-admin seed credential.

## Two-layer policy — keep them separate
- **Complexity** is synchronous, offline, and ALWAYS enforced (the hard floor):
  length + character-class + common-password denylist + identifier-embedding
  rejection (only when the identifier fragment is long enough to be meaningful).
- **Breach** is the HaveIBeenPwned k-anonymity range API (free, no key; send only
  the SHA-1 prefix, match the suffix locally). It is **best-effort / fail-open**:
  any network/non-2xx/parse/timeout error must NOT block (complexity stays the
  floor). The `Add-Padding` response injects synthetic `count=0` rows — treat
  count=0 as NOT breached or every padded prefix reads as a false hit.

**Why:** an external breach API being down must never break registration, but a
strong offline floor must always hold.

## Where applied vs deliberately not
- Applied: register, password-reset, and the seed-admin path (complexity-only at
  boot — no network call during startup).
- **NOT** applied to system-issued credentials (the generated student login and
  the mentor temp password). They are not user-chosen and can be shorter than the
  user policy; do not route them through the gate without redesigning how that
  credential is surfaced to the recipient.

## Login lockout (defense-in-depth)
- Self-contained, **always-on**, and INDEPENDENT of the governance RBAC flag
  (that flag only gates the separate failed-login *audit* write). Uses its own
  lazy attempts table.
- Threshold + window come from the previously data-only admin settings. Exceeding
  the threshold within the rolling window → `429` + `Retry-After`; cleared on
  successful login.
- Every lockout DB op is try/catch and **fails open on availability** — a DB
  hiccup must never block real logins. Keyed per-identifier (account protection),
  which matches the documented settings and carries a known victim-lockout DoS
  tradeoff accepted for parity with the spec.

## Seed super-admin in production
- Creating a NEW super-admin in production WITHOUT a strong
  `SUPERADMIN_INITIAL_PASSWORD` now THROWS rather than seeding the well-known
  default. The caller wraps `seedSuperAdmin()` in try/catch that logs + continues,
  so this does NOT crash boot — it just refuses to create a default-credential
  admin in prod until the operator sets a strong env value. Dev keeps the
  convenience default.

## Verify
- `npx tsx backend/tests/password-policy.test.ts` (offline complexity cases).
- Smoke: weak/common/breached register → 400; strong unique → 200; reset weak →
  400; repeated bad logins → 401 then 429. Use `@example.com` users and purge the
  attempts rows after (shared dev/prod DB).

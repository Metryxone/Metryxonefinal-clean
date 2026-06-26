---
name: Secrets handling hygiene
description: Prod fail-fast for auth secrets + no credential VALUES in stdout logs/seed scripts
---

# Secrets handling hygiene

Two durable rules for the Secrets Handling surface (security scanners — stdout redactor, HoundDog — police both).

## 1. Auth secrets (JWT/session) need a production fail-fast, NOT just a fallback
A hardcoded `?? 'dev-secret'` fallback is a token-forgery risk if the env var is unset in prod.
Pattern (see `frontend/server/src/auth/jwt.ts`): at module load,
`if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw`.
**Why:** prod must refuse to start on a known/guessable secret; dev keeps the fallback so dev
behaviour stays byte-identical (no env churn for contributors).
**How to apply:** any module that reads a signing/session secret with a literal fallback — add the
same prod-only throw. `frontend/server` is a dormant second Express app (not run by any workflow,
empty node_modules locally) so this change can't be exercised here, but it's the deployed-path guard.

## 2. Seed/dev/audit scripts must never interpolate credential VALUES into stdout
Secret scanners flag `console.log(`... ${PASSWORD}`)` even in non-request-path dev scripts
(e.g. seed-employer-demo demo password, storage.ts seedSuperAdmin's `admin123`).
**Why:** logs get shipped/captured; a literal credential in a log line is a leak regardless of
where the script runs.
**How to apply:** print the identifier (email/username) only; say "(password omitted from logs)".
The actual demo/dev password lives in the seeder source and `replit.md`, which is the single place
to document dev credentials — don't echo it to the console. A grep guard
(`console\.[a-z]+\([^)]*\b(PASSWORD|TOKEN|SECRET)\b`) catches regressions if you ever add CI.

Note: project IDs (e.g. Firebase) are public identifiers, not secrets — not a finding.

---
name: Career Passport read-only composition DDL trap
description: Why a read-only passport/composition layer must gate ALL competency-runtime consumers (not just getProfile) behind competencyRuntimeReady.
---

# Career Passport Foundation — GET-never-writes over competency-runtime

A read-only composition layer (e.g. Phase 4.9 Career Passport Foundation) that
composes competency-runtime outputs must gate **every** consumer behind a
read-only `competencyRuntimeReady(pool)` probe — not just the obvious direct
`getProfile` call.

**Why:** `getProfile` calls `ensureCompetencyRuntimeSchema(pool)` (CREATE TABLE
DDL) UNCONDITIONALLY as its first line. THREE separate composed entrypoints all
reach it transitively, so each one can create schema on a GET:
- `getProfile` (competency) → ensureCompetencyRuntimeSchema
- `buildEiProfile` → computeEmployabilityScore → loadScoringInputs → getProfile
- `buildCareerReadiness` → computeRoleReadinessV2 → computeRoleReadinessForSubject → getProfile

Gating only the direct `getProfile` call leaves the EI and readiness paths still
writing DDL on a read. The architect caught the EI/readiness leaks across two
review passes — the dependency chains are non-obvious from the call site.

**How to apply:** When building a read-only/never-writes GET surface that reuses
competency-runtime engines, wrap ALL of getProfile / buildEiProfile /
buildCareerReadiness in one `if (runtimeReady)` block (runtimeReady =
competencyRuntimeReady, a to_regclass probe). When not ready → all null + one
honest note, zero DDL. Trace each composed engine to its leaves before
asserting "performs no DDL" — verify, don't assume.

# Career profile PII

`career_seeker_profiles.data` JSONB is subject self-reported and free-text
fields (`summary`, `bio`) can carry embedded email/phone/address. For any
passport/public surface: drop free-text fields from the whitelist entirely AND
apply a `redactContact()` scrub (email + phone regex → `[redacted-*]`) to every
surfaced scalar string as defense-in-depth — a user can stuff contact info into
a structured field like `headline`. Contact is never published.

---
name: SuperAdmin global /api/admin gate + RIE migration/handler schema drift
description: How admin authz is now enforced platform-wide, and the trap that a lazy ensure-schema mirroring a migration can still 42703 because the migration itself drifted from the handler code.
---

# SuperAdmin authorization is enforced by ONE global gate

`app.use('/api/admin', requireAuth → requireSuperAdmin)` is mounted in `backend/routes.ts` right after `requireSuperAdmin` is defined and BEFORE the bulk of admin routes register. This is the authoritative guard; the ~1,200 per-route `requireSuperAdmin` usages are now defence-in-depth, not the primary control.

**Why:** authz was previously per-route and manual, so a single forgotten guard left a surface open (PAIE admin was unguarded). The original audit framed it as "PAIE only", but remediation found the same gap across most engine-admin families (ROIE, LDE, SPE, most BIOS, cognitive, semantic, memory, digital-twin, predictive, psychometrics, fairness, ethics, CSI, `/api/admin/capadex/*`). One global gate closes them all at once.

**How to apply:**
- Inside `app.use('/api/admin', mw)`, `req.path` is mount-relative (`/lbi-catalog`, not `/api/admin/lbi-catalog`). Match exact AND trailing-slash variants (`'/lbi-catalog' || '/lbi-catalog/'`).
- The ONE exemption is `/api/admin/lbi-catalog` (any authenticated user; its own `requireAuth` still applies).
- Pre-login MFA routes (`/api/admin/mfa/verify`, `/api/admin/mfa/resend`) are registered EARLIER than the gate so they stay public — do not move them after it or 2FA login breaks.
- Non-`/admin` engine compute prefixes (e.g. `/api/paie/*`, and any `/api/roie/*`, `/api/lde/*` write routes) are NOT covered by this gate — guard each separately (`app.use('/api/paie', requireAuth, requireSuperAdmin)` was added for PAIE). A full sweep of those prefixes is still outstanding.

# Lazy ensure-schema that mirrors a migration can STILL 42703

Adding a lazy `ensureRieSchema()` that faithfully mirrors `migrations/20260507_rie_engine.sql` fixed the `42P01 relation "rie_escalations" does not exist`, but the endpoint then failed `42703 column "assigned_to_name" does not exist` — because the **canonical migration itself was out of sync with the handler code**. The Crisis Inbox handlers SELECT/UPDATE `assigned_to_name`, `acknowledged_at`, `acknowledged_by`, none of which the migration ever defined.

**Why:** "mirror the migration" is only correct if the migration matches the code. Here it had drifted. Creating the table alone just swaps a missing-table error for a missing-column error.

**How to apply:**
- When wiring an ensure-schema for an existing engine, diff the handler's actual column references against the schema (grep the route file's queries), not just the migration.
- `CREATE TABLE IF NOT EXISTS` will NOT add columns to a table that already exists (e.g. created by a prior boot). For added columns use idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` and add the same columns to the canonical migration in lockstep.
- Verify by running the handler's exact query against the DB (returns rows / no error), and confirm a live authenticated request logs 200 — an unauthenticated 401 only proves the gate, not the handler.

---
name: Runtime activation traps (MX-RUNTIME-01)
description: Non-obvious ordering/bootstrap traps when driving real code paths to activate the platform end-to-end with demo data.
---

# Driving real runtime activation (HTTP, not SQL)

The honest way to "activate" this platform is to drive REAL endpoints via a fetch+cookie
driver (register → save-profile/goals; anon CAPADEX start→respond→complete→report;
competency run-assessment→profile; employer register→pool→search), NOT raw SQL inserts.
SQL is appropriate only for additive schema + read-only backfill (e.g. candidate_master).

## Employer activation cross-module ensure-schema ordering trap
`POST /api/employer/register` runs employer-portal `ensureSchema`, which **ALTERs
`employer_jobs`** — but that table is created lazily by a DIFFERENT module
(`recruiter-postings.ts`), only on first hit of one of ITS routes. Cold DB → register
500s with `relation "employer_jobs" does not exist` and leaves the whole batch
uncreated (`schemaReady` stays false → `employer_candidates` also absent).
**Fix:** hit `GET /api/career/recruiter-postings` once to bootstrap `employer_jobs`,
THEN employer register/pool/search all succeed.

## CAPADEX runtime depends on the framework migration + a restart
CAPADEX 500s end-to-end when `20260502_framework_tables.sql` (creates `sdi_items`) is
unapplied: the boot-seed throws on index creation, so `capadex_sessions`/`responses`
are never created. Apply that migration (+ `20260508_score_trace.sql` for the
`score_trace` col `/complete` needs) and **restart Backend API** so the boot-seed runs.
Some concern×age cells have no seeded `sdi_items` → `session/start` 404s honestly
(e.g. "focus problems", "peer pressure"); "exam stress" is a known-good concern.

## Competency caller guard is fine — `UID` is a bash readonly builtin
`run-assessment`/`profile/:id` enforce `callerId(req)===userId`. A manual curl test
"403"d only because `UID=...` silently failed (bash readonly) and sent the host UID.
Omit `userId` on run-assessment (defaults to session caller); pass the
register-returned id to `profile/:id`.

## Shared dev/prod DB — demo data must be purgeable
`DATABASE_URL` is shared, so ALL demo activation lands in the prod DB. Mark everything
`@example.com` / `source:'Demo Seed'` and disclose; purge filter before go-live is
`email LIKE '%@example.com'` across users, `capadex_sessions.guest_email`,
`employer_candidates.email`, and the `candidate_master` family.

## candidate_master identity join
Email is the universal key (`lower(trim())`): CAPADEX `guest_email`, Career/Competency
`user_id`→`users.email`, employer `email`. `users.id` is **varchar** not uuid — keep
`candidate_master.user_id` TEXT (no `::uuid` cast) and `coalesce(bool_or(...),false)`
in the completion rollup (bool_or over zero LEFT-JOIN rows yields NULL).

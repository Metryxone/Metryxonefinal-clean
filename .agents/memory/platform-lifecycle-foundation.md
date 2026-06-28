---
name: Platform Lifecycle Foundation (capability catalog / lifecycle registry)
description: Discovery-driven registry that re-scans the repo — the managed-vs-derived state trap and flag-gate/schema discipline.
---

# Platform Lifecycle Foundation (MX-700 1.37)

Flag-gated (`platformLifecycleFoundation`) additive registry that COMPOSES the existing
`FEATURE_FLAGS` registry + a filesystem scan (routes/services/migrations/docs) into a
`platform_*` substrate. It does NOT own business logic and is not a second source of truth.

## The managed-vs-derived state trap (the bug worth remembering)
A discovery engine that re-scans on every `POST /discover` has TWO state axes that must NOT be conflated:
- **`activation_state`** = DERIVED from the live flag runtime (active/dormant/unknown). Re-scan must refresh it.
- **`lifecycle_state`** = MANAGED — set once on first discovery, thereafter changed ONLY by an explicit
  `transitionState` that also writes an append-only history row.

**Rule:** the `ON CONFLICT DO UPDATE` of a re-discovery upsert must update `activation_state` but
**never** write `lifecycle_state` (omit it from the SET clause so it is preserved).
**Why:** the first cut had `lifecycle_state = EXCLUDED.lifecycle_state`, so the next discovery silently
reverted a human transition (e.g. `released`) back to the derived `dormant` — fabricating a state regression.
A `CASE WHEN ... IN ('deprecated','retired','archived')` half-guard is NOT enough; protect ALL managed states.

## Canonical lifecycle-state enum is the only gate
`platform_lifecycle_registry.lifecycle_state` is free-text `TEXT` with NO CHECK constraint, so the
ONLY validation gate on a transition is the `LIFECYCLE_STATES` enum (via `isLifecycleState`). It must
cover the full constitution PART 4 vocabulary — `proposed/approved/implemented/partial/validated/
released/active/dormant/experimental/deprecated/retired/archived/blocked/removed`. Spec "Live" maps to
the existing `active` (don't rename — "map existing values, don't replace semantics"); `removed` is
terminal alongside `retired`/`archived` (sets `retirement_status='retired'`). Missing a state from the
enum silently rejects an otherwise-valid transition with `invalid_state`.

## Honesty discipline applied here
- Ownership is honest-NULL (no business/technical owner fabricated); surfaced as `missing_owners`.
- Activation `unknown` for modules/services/migrations/docs (presence ≠ runtime-active) — do not coerce to active.
- GET readers degrade via `schemaReady()` (`to_regclass` probe) and report `ready:false` before discovery —
  do NOT hardcode `ready:true` (the `/registry/:uid/history` route initially did; architect flagged it).

## Flag-OFF byte-identical incl. schema
- `ensureSchema` runs ONLY on the write paths (`/discover`, `/transition`), both flag-gated before any DDL.
- Verify OFF state by COUNT against `information_schema.tables` for `platform_*` (must be 0), not by API alone.
- The global `app.use('/api/admin', requireAuth)` gate fires BEFORE these route handlers, so even the no-auth
  `/enabled` probe returns 401 when unauthenticated — the UI tab still hides because the `/feature-flag`
  `res.ok` probe is false. Smoke-assert {401,503}, never expect a bare 503 on `/api/admin/*`.

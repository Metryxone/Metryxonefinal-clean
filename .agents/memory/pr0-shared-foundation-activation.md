---
name: PR0 Shared Foundation Activation
description: Patterns and constraints from wiring EI, LBI, Career Builder to CAPADEX intelligence infra (P-R0 Priority 1).
---

## Workflow flag updates

`.replit` direct edits are blocked by the sandbox. To add env var feature flags to the Backend API command, use `configureWorkflow({ name: "Backend API", command: "...", waitForPort: 8080, outputType: "console" })` via `code_execution`. The full command must be specified each time (it replaces, not appends).

**Why:** The sandbox blocks direct .replit edits to prevent misconfiguration. Only the workflow skill's `configureWorkflow` callback is authorised.

**How to apply:** Any time you need to add a new `FF_*=1` flag to the backend, read the current command from `.replit` first, then call `configureWorkflow` with the extended string.

---

## wcl0_user_intelligence is email-keyed

The `wcl0_user_intelligence` table is indexed by `user_email` (TEXT), not by `user_id`. When enriching EI or LBI with wcl0 behaviour context and you only have a numeric/UUID user_id, you must first look up the email via `SELECT email FROM users WHERE id = $1`.

**Why:** wcl0 is populated from CAPADEX sessions which key on `guest_email` (not numeric user_id). Both systems must be joined through the email address.

**How to apply:** `enrichEIWithWcl0(pool, userId)` and `enrichWithWcl0(email, client)` follow this pattern — use these, don't re-derive.

---

## career-memory dual-store pattern

`career-memory.ts` uses an in-memory `Map` as the fast-read primary and Postgres (`career_memory_snapshots`, `career_memory_interventions`) as the additive secondary. DB writes are fire-and-forget (`persistSnapshot`, `persistIntervention` catch all errors silently). The in-memory store is the source of truth for the current process; the DB is for persistence across restarts.

**Why:** Career Builder needs sub-ms reads for the UI; DB is for durability and cross-session history.

**How to apply:** Always write to both stores on mutation. Never remove the in-memory layer.

---

## resolveEffectiveUserId IDOR guard

`resolveEffectiveUserId(req, clientSupplied)` in `career-memory.ts` prefers `req.user.id` over any client-supplied userId. When `req.user` is absent (unauthenticated flow), it falls back to the body/query value for backward compat.

**Why:** Without this, any caller can read/write snapshots for arbitrary user IDs by spoofing the userId parameter.

**How to apply:** Apply this pattern to any route that takes a userId from client input and is not hard-gated by `requireAuth`.

---

## career_recommendations user_id backfill join

To backfill `user_id` on `career_recommendations` rows from CAPADEX sessions:

```sql
UPDATE career_recommendations cr
   SET user_id = u.id::text
  FROM capadex_sessions cs
  JOIN users u ON lower(u.email) = lower(cs.guest_email)
 WHERE cr.session_id = cs.id::text
   AND cr.user_id IS NULL
```

`session_id` in `career_recommendations` is TEXT; `capadex_sessions.id` is UUID — cast with `cs.id::text`.

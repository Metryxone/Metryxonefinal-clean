---
name: Career memory route namespaces
description: Two distinct "memory" features under /api/career — how to extend without clobbering or IDOR.
---

# Career memory: two distinct features, two namespaces

There are TWO separate "memory" subsystems under `/api/career`. They look similar by name but are unrelated — keep them apart.

1. **Phase-3 transformation history** — `backend/routes/career-memory.ts`, in-memory store, registered as `registerCareerMemoryRoutes(app)` (SINGLE arg, no pool/auth). Routes under `/api/career/memory/*` (snapshot, snapshots, intervention(s), evolution, dump, summary).
2. **Phase-5 behavioural memory (Career OS)** — `backend/routes/behavioural-memory.ts`, DB-backed, `registerBehaviouralMemoryRoutes(app, pool, requireAuth)`. Routes under `/api/career/behavioural-memory/*` (POST snapshot, GET :userId → snapshots + growth deltas). Tables `capadex_behavioural_memory` + `career_memory_snapshots`.

**Why separate namespaces:** they share the literal segment `memory`, and Express `:userId` matches any single segment — so a GET `/api/career/memory/:userId` would shadow siblings like `/snapshots`, `/evolution`. Distinct static prefixes (`memory` vs `behavioural-memory`) avoid the collision.

**How to apply:**
- Never overwrite `career-memory.ts` to add DB routes — it is a pre-existing tracked file with the 1-arg signature. Add new DB-backed work in `behavioural-memory.ts` (or another distinct namespace).
- Any per-user `/api/career/.../:userId` route must derive the effective user id from `req.user.id` (canonical app-wide id; frontend passes the same `user.id`), NOT from the path/body param. Allow a different target only for `req.user.role === 'super_admin'`; otherwise a mismatching client-supplied id must 403 (prevents IDOR). See `resolveEffectiveUserId` in `behavioural-memory.ts`.

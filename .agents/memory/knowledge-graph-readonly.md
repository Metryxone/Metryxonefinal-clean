---
name: Knowledge graph read-only discipline
description: Why a "read-only" intelligence API must stay GET-only and never expose a public materialize/rebuild route.
---

# Read-only API discipline (CAPADEX Phase 8 knowledge graph)

When a task specifies a **read-only** API surface, that means GET-only. Do NOT add a
convenience POST that rebuilds/snapshots into tables, even if it's flag-gated.

**Why:** The CAPADEX `/api/capadex/kg/*` routes live on the *public* (no-auth) CAPADEX
router. A `POST /kg/materialize` there ran `DELETE FROM kg_edges/kg_nodes` + bulk insert
— i.e. unauthenticated write access + an expensive rebuild = broken-access-control + DoS
vector, and a direct violation of the read-only constraint. Code review failed the phase
for it.

**How to apply:** Keep the materialize/rebuild logic as an internal function
(`rebuildAndMaterialize` in the service) callable from scripts/jobs only. If a mutating
HTTP route is ever genuinely needed, it must be `requireAuth + requireSuperAdmin` and live
in an admin namespace, never on the public router. Default to: no mutating route at all.

**Related:** audit/script output paths must be cwd-independent (derive from
`import.meta.url`, not `process.cwd()`), or the documented run command writes outside the
repo depending on where it's launched.

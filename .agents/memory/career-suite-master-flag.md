---
name: Career Builder master suite flag (durable activation)
description: Why career-intelligence activation was fragile and the master-suite-flag pattern that fixed it
---

# Career Builder master suite flag — durable activation

**The trap:** Every career-intelligence flag in `backend/config/feature-flags.ts` defaults OFF and
was only enabled by `FF_*` env vars injected into the *runtime* `Backend API` workflow command
(via `configureWorkflow`). `.replit` (the persisted workflow definition) is uneditable and hard-codes
only a minimal `FF_*` set, so the full career flag set is **lost on any plain restart/redeploy** —
all career routes silently flip to `503` and Career Builder falls back to legacy frontend heuristics.
The activation was real but non-reproducible. A plain `restart_workflow` reverts to the `.replit`
command and breaks the career routes (also see backend-workflow-port-detection.md).

**The fix — master suite flag:**
- One flag `careerBuilderSuite` (default `true`) + a `CAREER_SUITE_FLAGS` Set enumerating the
  member flags.
- `isFlagEnabled(key)` resolution order: **env override (`FF_<SNAKE>` '1'/'0') → explicit code
  default → suite inheritance** (only if `key ∈ CAREER_SUITE_FLAGS` with no env + no truthy own
  default).
- `careerBuilderSuite` is **excluded** from `CAREER_SUITE_FLAGS` → no recursion.

**Why this order:** env override must still win so ops can force any single flag on/off and every
pre-existing per-phase override keeps working; suite inheritance is the *fallback* that makes the
default-ON durable. Result: suite ON survives a clean boot (routes `401` gated, not `503`),
`FF_CAREER_BUILDER_SUITE=0` returns byte-identical legacy (all members `false`, routes `503`), and
`FF_CAREER_PATH=0` while suite ON proves granular override still wins.

**How to apply:** When a family of additive flags must be "on by default but reversible with one
switch" yet `.replit` can't carry the env, use a suite flag with this 3-tier resolution; never let
the suite flag inherit from itself. Verify durability by probing the gated route after a *plain*
restart (expect `401`/auth, not `503`).

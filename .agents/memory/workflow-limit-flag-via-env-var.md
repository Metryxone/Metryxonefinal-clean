---
name: Enabling a backend feature flag when configureWorkflow is limit-blocked
description: How to turn on an env-driven feature flag for the backend when the .replit workflow limit blocks editing the workflow command.
---

# Enabling a backend feature flag when configureWorkflow is blocked

The Backend API workflow command carries dozens of `FF_*=1` flags. To enable one
more (e.g. `FF_ROLE_AUTO_RESOLUTION=1`) the obvious path is `configureWorkflow` to
append it to the command — but that can be hard-blocked.

**The trap:** `configureWorkflow`'s limit check ("Workflow limit exceeded 12/10")
counts the `.replit`-DEFINED workflow set, which is uneditable. `removeWorkflow`
only drops the *runtime* instance, NOT the `.replit` definition, so `listWorkflows()`
shows fewer (e.g. 9) yet `configureWorkflow` still fails at 12/10. You cannot get
under the limit by removing workflows, and mockup-sandbox workflows are
artifact-managed (PROHIBITED to remove).

**The fix:** set the flag as a project ENV VAR instead. `config/feature-flags.ts`
reads `process.env.FF_*` via `envOverride()` (accepts `1`/`0`), so a process-env
value enables the flag with no command edit. Use the environment-secrets skill:
`setEnvVars({ values: { FF_ROLE_AUTO_RESOLUTION: '1' }, environment: 'development' })`
then restart Backend API. Scope it **development-only** (not `shared`) so production
stays OFF — honours a "flags default OFF + NO DEPLOY" preference and is fully
reversible (`deleteEnvVars` + restart).

**Why:** env-var override is equivalent to a command flag for the backend, survives
restarts, and respects per-environment flag policy without touching the locked
`.replit` workflow set.

**How to apply:** when a backend `FF_*` flag must be ON and `configureWorkflow` errors
with a workflow-limit message, skip the workflow edit — set the env var in the right
environment scope and restart. Verify by probing the gated endpoint (503 → 401/403
means the flag is now ON).

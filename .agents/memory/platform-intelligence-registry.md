---
name: Platform Intelligence Registry (MX-800 PIOS Foundation)
description: Enhancement-only canonical registry composing existing intelligence engines; flag-gate must reach the SERVICE write layer, not only routes.
---

# Platform Intelligence Registry (PIOS Foundation)

The MX-800 PIOS "Constitution & Foundation" registry is an **enhancement-only** layer that catalogs the
ALREADY-EXISTING intelligence engines into ONE canonical registry. It does NOT execute, reason, predict,
recommend, or automate — it is a coordination/metadata FOUNDATION. Posture is **Connected, NOT
Orchestrated** (Built ≠ Activated; Registered ≠ Used).

## Durable lessons

- **Flag-gate must reach the SERVICE write layer, not only the routes.** Routes 503 before any DB touch
  when OFF, but service write functions can be imported directly by tooling/scripts and bypass the route
  gate entirely — that is exactly how a "byte-identical-OFF incl. schema" contract gets silently violated
  (a validator created the tables while the live flag was OFF). **Why:** OFF byte-identical-incl-schema is
  a hard user contract. **How to apply:** every write/DDL service fn (`discover`/`register`/`captureAudit…`)
  asserts the flag itself BEFORE `ensure*Schema`; reads stay caller-agnostic (probe via `to_regclass`,
  never create schema). Also make any write-exercising script fail-fast unless the flag env is ON, so
  tooling and the live workflow agree on flag state.

- **lifecycle_state is MANAGED, activation_state is DERIVED.** Re-discovery must refresh DERIVED fields
  (activation from the live flag, `present` from the filesystem) but the upsert must NEVER overwrite a
  human-set `lifecycle_state`/`owner` — else managed transitions silently revert. Validate this explicitly
  (set a managed state + owner, re-discover, assert they survive).

- **Honest axes, never composited.** `confidence` is STRUCTURAL-ONLY (file existence + flag registry + doc
  refs); runtime/outcome confidence is NOT measured here → explicit `null`, never a fabricated number.
  `owner` is honest-NULL across the catalog (a real governance gap, not 100%). Coverage ⟂ Confidence ⟂
  Evidence stay separate. `null ≠ 0` (0-denominator metric → null).

- **Catalog entries are file-verified and reference, not duplicate, prior registries.** The in-code catalog
  carries a `lifecycle_uid` SOFT reference into the MX-700 `platform_lifecycle_catalog` (resolved only when
  that table exists) — no parallel/duplicate registry. `flag_key` values MUST be real keys in the
  `FEATURE_FLAGS` object (workflow env names like `FF_CAREER_GRAPH` do NOT all have a matching registry key —
  verify against `config/feature-flags.ts`; e.g. use `careerIntelligence`/`learningPath`, there is no
  `careerGraph`/`learningIntelligence` flag).

- **The global `app.use('/api/admin')` auth gate fronts even the `/enabled` probe** → OFF HTTP smoke for
  this surface is ∈ {401,403,503}, not a clean 200 `{enabled:false}`. Codify the smoke contract as that set.

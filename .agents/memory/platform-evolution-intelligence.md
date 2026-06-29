---
name: Platform Evolution & Technical Debt Intelligence (MX-700 Phase 1.40)
description: Flag-gated enhancement tier that must compose 1.37/1.38/1.39 rather than duplicate registries; durable honesty + schema rules.
---

# Platform Evolution & Technical Debt Intelligence (MX-700 Phase 1.40)

Flag `platformEvolutionIntelligence` / `FF_PLATFORM_EVOLUTION_INTELLIGENCE`, default OFF, byte-identical OFF incl. schema. Backend-only (STOP clause, no panel).

## The composition discipline (the whole point of this phase)
**Rule:** This is an enhancement tier, not a new subsystem. Version/deprecation/retirement/evolution
intelligence must READ the 1.38 management ledgers; validation + architecture-stability must READ the
1.39 intelligence engine; foundation summary READS 1.37.
**Why:** 1.38 already owns the deprecation/retirement/version_ledger/evolution tables AND their getters.
Re-checking that BEFORE writing is what kept 1.40 to only 3 genuinely-new tables instead of duplicating 7.
**How to apply:** Before adding any registry/getter in this area, grep the 1.38/1.39 services first — if a
ledger/getter exists, compose it. The only net-new state here is the curated Technical-Debt registry, the
curated Knowledge registry, and append-only evolution snapshots.

## Honesty rules (do not regress)
- **Six SEPARATE metrics, NO composite/overall.** The validate script asserts the `scores` object has no
  `overall`/`composite` key — keep it that way. Technical-Debt ⟂ Version ⟂ Repository-Evolution ⟂
  Knowledge ⟂ Migration ⟂ Architecture are independent axes.
- **null ≠ zero** in both directions: a ratio whose denominator is 0 returns null, never 0. (e.g. nothing
  retired → knowledge_health is null; no capability carries a current_version → version_health is a real
  measured 0, not null — know which is which.)
- **Markers ≠ tracked debt ≠ bugs.** The TODO/FIXME/HACK/XXX scan is a MEASURED hint surface reported as a
  SEPARATE axis from the curated debt registry. **Dormant (flag-OFF) capabilities are NOT debt.**
- **Deprecated ≠ Removed; Retired ≠ Deleted; Version ≠ Release; Knowledge-Exists ≠ Runtime-Active.**
- Git history is best-effort, honest-`available:false` when `.git` is absent — never invented.

## Schema / flag discipline
- Every WRITE path owns its lazy ensure-schema; reads probe via `to_regclass` and degrade to `ready:false`.
  So flag-OFF (routes 503 before auth/DDL) creates zero tables — verified tables ABSENT before any write.
- The global `/api/admin` auth gate fronts even `/enabled`, so OFF smoke returns membership in
  {401,403,503}, not a clean 503 on `/enabled` (same as 1.37–1.39). Assert the set, not one code.

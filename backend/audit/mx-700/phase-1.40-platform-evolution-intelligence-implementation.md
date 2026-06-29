# MX-700 Phase 1.40 — Platform Evolution & Technical Debt Intelligence Engine

**Status:** Implemented · backend-only (STOP clause — no frontend panel) · flag `platformEvolutionIntelligence` (env `FF_PLATFORM_EVOLUTION_INTELLIGENCE`) **default OFF** · flag-OFF byte-identical incl. schema.

## Mandate
ENHANCEMENT-ONLY tier that establishes continuous repository evolution, technical-debt governance,
version/deprecation/retirement governance and knowledge preservation **by COMPOSING** the existing
Phase 1.37 Foundation + 1.38 Management + 1.39 Intelligence. It introduces **NO** duplicate
debt/version/deprecation/retirement/evolution registry, **NO** parallel engine, changes **NO**
business logic, and activates **NO** dormant capability. The repository remains the single source of truth.

## What is genuinely NEW vs. COMPOSED
| Capability | Source |
|---|---|
| Version Intelligence | **COMPOSES** 1.38 `version_ledger` + registry `current_version`/`migration_version` (no new version registry) |
| Deprecation Intelligence | **COMPOSES** 1.38 `platform_lifecycle_deprecation` getter |
| Retirement Intelligence | **COMPOSES** 1.38 `platform_lifecycle_retirement` getter |
| Evolution Intelligence | **COMPOSES** 1.38 `platform_lifecycle_evolution` log + registry migration history |
| Evolution Validation | **COMPOSES** 1.39 `getLifecycleValidation` + evolution-specific knowledge/version checks |
| Architecture Stability metric | **COMPOSES** 1.39 `getLifecycleMetrics().architecture_stability` (reused, never recomputed) |
| Technical Debt **registry** | **NEW** table `platform_evolution_technical_debt` (curated, human-tracked program) |
| Technical Debt **marker scan** | **NEW** read-only MEASURED scan of `TODO/FIXME/HACK/XXX` in `backend/{routes,services,lib,config}` |
| Knowledge Preservation **registry** | **NEW** table `platform_evolution_knowledge` |
| Knowledge **index** | **NEW** read-only MEASURED count of `.agents/memory/*.md` + `docs/*.md` |
| Continuous Evolution Audit | **NEW** append-only table `platform_evolution_audit_snapshots` + drift |

Three NEW tables only. Migration `backend/migrations/20261219_platform_evolution_intelligence.sql`.

## Files
- Flag + helper: `backend/config/feature-flags.ts` (`platformEvolutionIntelligence`, `isPlatformEvolutionIntelligenceEnabled()`).
- Migration: `backend/migrations/20261219_platform_evolution_intelligence.sql` (3 NEW tables).
- Service: `backend/services/platform-evolution-intelligence.ts` (9 parts; reads GET-never-writes via `to_regclass` probes; every WRITE path owns the lazy `ensureEvolutionSchema`).
- Routes: `backend/routes/platform-evolution-intelligence.ts` (BASE `/api/admin/platform-evolution-intelligence`; literal `/technical-debt/markers` before `:uid`; `gate` 503 before auth/DB; registered in `routes.ts`).
- Validation: `backend/scripts/mx700-1.40-validate.ts`.

## Honesty contract (per user preference — honesty over optimism, never fabricate)
- **Six SEPARATE measured scores, deliberately NO composite/overall:** `technical_debt_health`,
  `version_health`, `repository_evolution`, `knowledge_health`, `migration_health`, `architecture_stability`.
  Technical-Debt ⟂ Version ⟂ Repository-Evolution ⟂ Knowledge ⟂ Migration ⟂ Architecture.
- **null ≠ zero** in both directions — a score whose denominator is 0 is `null`, never `0`.
- **Coverage ≠ Confidence ≠ Evidence**; **Technical Debt ≠ Bug**; **Deprecated ≠ Removed**;
  **Retired ≠ Deleted**; **Archived ≠ Forgotten**; **Version ≠ Release**; **Release ≠ Adoption**;
  **Knowledge Exists ≠ Runtime Active**.
- **Dormant capabilities are NOT debt** — built-but-deactivated by design (flag OFF), reported for
  transparency, never auto-actioned (STOP clause).
- Git history degrades to an explicit `available:false` when `.git` is absent — never invented.
- All counts MEASURED (`COUNT(*)` / filesystem walk / git), never estimated.

## Validation evidence
- `npx esbuild` bundles all four new/changed files clean.
- Flag-OFF HTTP smoke (live `Backend API`): all 14 GET routes + 3 POST routes ∈ {401, 403, 503};
  the three new tables were **absent** in the DB before the service-level run (flag-OFF created no schema).
- Service-level validation (`mx700-1.40-validate.ts`, 24 assertions, all PASS, self-cleaned):
  - repo marker scan MEASURED (files=891, total=5, `{FIXME:2,HACK:0,XXX:0,TODO:3}`);
  - debt register + status-append + read-back; knowledge preserve + read-back; knowledge index MEASURED (memory=264, docs=26);
  - version/deprecation/retirement/evolution compose the 1.38 ledgers; evolution validation composes 1.39;
  - 6 scores all `number|null`, **NO `overall`/`composite` key present**;
    sample `{technical_debt_health:100, version_health:0, repository_evolution:100, knowledge_health:null, migration_health:100, architecture_stability:100}`
    (`knowledge_health:null` because nothing is retired yet — null≠zero; `version_health:0` is a real measured gap, no capability carries a `current_version`);
  - 2 snapshots → drift with `number|null` per-metric deltas;
  - summary declares it COMPOSES 1.37 + 1.38 + 1.39.

## STOP
No deploy. Awaiting approval per user preference (additive phases STOP for approval before merge/deploy). Flag remains OFF in the `Backend API` workflow.

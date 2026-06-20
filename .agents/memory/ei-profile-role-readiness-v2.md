---
name: EI Profile (3.4) + Role Readiness V2 (3.5) engines
description: Composition/honesty rules and invariants for the competencyEi profile + role-readiness-v2 layer
---

# EI Profile Engine (3.4) + Role Readiness V2 (3.5)

Additive layer behind flag `competencyEi` / `FF_COMPETENCY_EI`. Routes in `routes/competency-ei.ts` (gate → requireAuth → requireSuperAdmin, literal-before-param). Engines: `ei-profile-engine.ts`, `ei-profile-history.ts`, `role-risk-engine.ts`, `role-potential-engine.ts`, `role-readiness-v2.ts`.

## Composition (never recompute)
- 3.4 COMPOSES `computeEmployabilityScore` (3.3); 3.5 COMPOSES `computeRoleReadinessForSubject` (Phase 2) + 3.4 profile + risk + potential. Numbers are re-shaped, never re-derived.

## Honesty invariants
- Coverage (how much measured) and Confidence (how trustworthy) are SEPARATE axes; confidence caps at 60 when measurement is `domain_proxy`. null + reason, never a fake 0; abstain to `Unmeasured` when inputs absent.
- **Role Potential already-ready cap (hard rule):** readiness ≥ `READY_THRESHOLD` (85) ⇒ level ALWAYS `Low` and score clamped to `LOW_POTENTIAL_CEILING` (34), regardless of positive factors (closable gaps, EI growth). Low potential here is a POSITIVE signal (little upside left), not a deficit. **Why:** other positive factors could otherwise lift an already-ready candidate to Medium/High, contradicting the documented invariant — enforce it in code, don't rely on tendency.
- Role Risk: a blocking gap can NEVER read as Low risk (enforced in `role-risk-engine.ts`).

## Schema discipline (byte-identical flag-OFF)
- `ei_profile_snapshots` DDL (lazy `ensureEiProfileHistorySchema`) runs ONLY on the snapshot POST/persist path. GET reads use a `to_regclass` probe + degrade — zero DDL on reads. History schema is intentionally NOT in the boot ensure-schema block (write-path only).

## Frontend contract (panel ↔ engine field names)
- Canonical engine field names the SuperAdmin panel MUST consume: `StrengthArea.rationale`, `DevelopmentArea.rationale` (+ `headroom`), `CriticalRisk.{type, ei_dimension_id, dimension_name, detail, severity}` (NO `key`/`label`), `GrowthPotential.{level, score, improvable_dimensions, drivers, reason}`.
- `GrowthPotential.level` uses `Moderate` (not `Medium`); risk/potential levels use `Medium`. Panel level-color map must include BOTH.

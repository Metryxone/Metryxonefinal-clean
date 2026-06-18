# WC-C1 · Deliverable 4 — Entitlement Audit Report
_Generated 2026-06-10T05:14:29.718Z. Feature gating · plan gating · access control · package ownership._

## Can the tier hierarchy be enforced **today**?
```
Free → LBI → Employability → Career Builder → Mentor → Premium
```
**No — it is conceptual, not enforced by a single guard.** The pieces exist but are not wired to block access:
- **`entitlement-engine.deriveEntitlement(email)`** unions owned paid stages (CAP_CUR→CAP_INS→CAP_GRW→CAP_MAS) into entitled features — **but no `requireEntitlement` middleware consumes it.** Access is currently governed by RBAC (`requireAuth`/`requireAdmin`/`requireSuperAdmin`) only.
- Plan gating is **distributed inside route handlers** (e.g. `PLAN_FEATURES[plan]` in the parent subscription routes), not a cross-cutting gate.
- **Package ownership** is represented (`student_subscriptions.package_id`, `capadex_payments` by email) but **nothing enforces it at access time**.

## Entitlement resolver — live state (recomputed)
| Metric | Value |
|---|---|
| Paying identities | 0 |
| Entitled identities | 0 |
| Entitlement coverage | n/a |
| Active package grants | 0 |
| Degraded | false |

**Owned-stage distribution:** — (no paid stages)

## Two flag systems (both real, neither is per-plan entitlement)
- **Config registry** (`backend/config/feature-flags.ts`) — boolean engine/phase gates; **global**, default OFF. Commercial flags here: commercialActivation=OFF, revenueIntelligence=OFF, commercialEntitlement=OFF, commercialRenewal=OFF, commercialUpsell=OFF, commercialLifecycleState=OFF, commercialForecastInputs=OFF.
- **DB `feature_flags` table** — engine flags (signal_intelligence/dynamic_reporting ON; interventions/longitudinal_memory OFF), with tenant overrides + rollout %. **Neither system is a per-user subscription entitlement.**

## Fail-CLOSED discipline (correct)
The entitlement + commerce reads **fail closed**: a ledger read error → `billing_ledger_unavailable` (entitles nothing), never mistaken for "owns nothing" — preventing a dishonest upsell. This is a strength to preserve.

## What exists / partial / missing
- **EXISTS:** RBAC guards; entitlement resolver (owned stages→features); fail-closed reads; two flag systems.
- **PARTIAL:** plan gating (per-route, non-blocking); package ownership (recorded, not enforced).
- **MISSING:** centralized `requireEntitlement`/`requirePlan` access-time guard; enforced Free→…→Premium hierarchy; per-user subscription→feature gate.

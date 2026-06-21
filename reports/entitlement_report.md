# Entitlement Engine — Operational Report

**Date:** 2026-06-21 · **Environment:** development · **Status:** ✅ Operational

> Coverage vs Confidence reported separately. Enforcement behaviour is proven; live entitlement *volume* depends on real paying identities.

## Purpose
Resolves and enforces what a customer is entitled to (feature classes, quotas, credits) and **blocks** usage beyond entitlement — failing **closed** so an absent or ambiguous entitlement never silently grants access.

## Architecture
- **Flags:** `commercialEntitlementClasses` (resolution), `commercialEntitlementEnforcement` (the gate; distinct from resolution).
- **Substrate:** `comm_plan_entitlements`, `comm_entitlement_grants` (+ super-admin manual grants), unioned across `comm_subscriptions`.
- **Identity:** metered/enforced identity is the **server principal**, not a client-supplied email (IDOR-safe).

## Evidence
**`smoke-usage-metering-safety-65.ts` (13/13 passed):**
- Over-quota storm: remaining writes **refused (fail-closed)**; **every** refusal cites `quota_exceeded`; ledger count stays at 3 after the storm (no overrun persisted); raw event rows === 3.
- Absent substrate: `checkQuota` does **not** throw (non-500) → honest empty (`limit null, used 0, no_active_subscription`); `checkCreditDimension` → honest `no_substrate, balance 0`.
- Read path issued **NO DDL/mutation** (GET-never-writes) but **did** issue `to_regclass` probe(s).

**`smoke-commercial-platform.ts`:** `entitlement_intelligence` became **measurable** once a paying identity existed; entitlement **coverage 100%** with a paying identity.

## Coverage vs Confidence
| Axis | Result | Basis |
|------|--------|-------|
| Structural / Coverage | ✅ Operational | Fail-closed enforcement, quota ceilings, honest-empty on absent substrate all proven |
| Activation / Confidence | ⚠️ Low in dev | Coverage measurable only with seeded paying identities; no real grants in dev |

## Honest gaps
- With zero real paid customers, live entitlement coverage is honestly ~0 in dev; the **enforcement mechanism** is fully armed.
- Enforcement (the gate) and productization (catalog/packaging) are **separate axes** — this report covers enforcement only.

## Verdict
**Entitlement engine operational ✓** — enforcement fails closed, cites a reason, never overruns the ledger, and degrades honestly when substrate is absent.

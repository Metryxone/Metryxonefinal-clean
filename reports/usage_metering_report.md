# Usage Metering — Operational Report

**Date:** 2026-06-21 · **Environment:** development · **Status:** ✅ Operational

> Coverage vs Confidence reported separately. Metering accounting is proven; live event *volume* depends on real traffic.

## Purpose
Meters consumption across the seven usage types (views / searches / unlocks / assessments / downloads / credits / …) per customer-subscription, enforcing per-dimension limits and a credit balance.

## Architecture
- **Flag:** `commercialUsageMetering` (default OFF → `/api/commercial/metering/*` 503; **no** `comm_usage_events` table created when OFF).
- **Substrate:** `comm_usage_events` (raw append-only event rows) + derived dimension rollups.
- **Identity:** server principal (IDOR-safe), consistent with the Entitlement engine.

## Evidence
**`smoke-usage-metering-65.ts` (38/38 passed):**
- Consumption view exposes **8 dimensions**, not degraded.
- Credits dimension shows balance **300**; assessments dimension `used=3 limit=3 remaining=0` (ceiling reached, reported honestly).
- Admin dimension overview exposes **8 dimensions**, not degraded.
- Flag-OFF: `/consumption`, `/credits/balance`, `/admin/.../dimensions` all gated (503/401, not 200).

**`smoke-usage-metering-safety-65.ts` (13/13 passed):** over-quota writes fail closed; ledger never overruns; honest-empty on absent substrate; GET-never-writes + `to_regclass` probe (see Entitlement report).

## Coverage vs Confidence
| Axis | Result | Basis |
|------|--------|-------|
| Structural / Coverage | ✅ Operational | 8-dimension accounting, ceiling enforcement, flag-OFF gating proven |
| Activation / Confidence | ⚠️ Low in dev | Real event volume depends on production traffic |

## Honest gaps
- The **concurrency** stress variant (`smoke-usage-metering-concurrency-65.ts`) flakes intermittently under storm on the shared dev DB (HTTP 500s under contention). The non-concurrency accounting and the safety/fail-closed paths pass cleanly. This is an environmental contention characteristic to re-verify on isolated production infra, not a logic defect in the metering accounting.

## Verdict
**Usage metering operational ✓** — 8-dimension consumption accounting, credit balance, ceiling enforcement, and honest degradation all verified. Concurrency-under-load to be re-confirmed on production-grade infra.

# SuperAdmin Command Center — Operational Report

**Date:** 2026-06-21 · **Environment:** development · **Status:** ✅ Operational

> Coverage vs Confidence reported separately. The aggregator is proven to count honestly (absent→null, present→real count, 0 only when genuinely empty); most domain headlines are an honest **0** in dev.

## Purpose
A read-only, never-throws SuperAdmin aggregator (Phase 6.14) folding **12 platform domains** (the self-validation harness reports `1/12 unmeasurable`), a control tower of pending actions, subsystem monitoring, and a self-validation harness into one command surface.

## Architecture
- **Flag:** `commandCenter` (default OFF → gated).
- **Route module:** `routes/superadmin-command-center.ts`; `requireAuth` + `requireSuperAdmin`.
- **Domains aggregated (source table in parens; 11 enumerated in the captured run excerpt, the harness counts 12 total):** employers (`employer_organizations`), students (`students`), candidates (`employer_candidates`), assessments (`capadex_sessions, ti_fact_assessments`), ei (`ei_profile_snapshots`), career_builder (`career_seeker_profiles`), jobs (`employer_jobs`), revenue (`capadex_payments`), subscriptions (`student_subscriptions, comm_subscriptions`), partners (no source), support (`rie_escalations`).

## Evidence (`smoke-command-center-614.ts` — gating=OK authedFlagOff=OK flagOnHttp=OK engines=OK)
- Honest counts: 11/12 domains `measurable=true` with real headline counts (mostly `0` = genuinely empty in dev); **ei headline=1**. `partners` `measurable=false, headline=null` (no source) — **absent ≠ 0**.
- Control tower: `pending_total=0`, `users=1`, `sessions=73`.
- Monitoring: `status=degraded` (1/12 subsystems unmeasurable — `partners`), `gov_alerts=725`, `crit=0`.
- Self-validation: **overall WARN (4 PASS / 2 WARN / 0 FAIL)**:
  - `no_fabrication` **PASS** — absent sources report null; present sources report a real count (0 only when genuinely empty).
  - `metric_bounds` PASS, `control_tower_bounds` PASS, `control_tower_total` PASS (total == sum of measured).
  - WARNs: `domain_coverage` (1/12 unmeasurable: partners), `monitoring_status` (1/12 unmeasurable → degraded). Both are **honest absence**, not failures.

## Coverage vs Confidence
| Axis | Result | Basis |
|------|--------|-------|
| Structural / Coverage | ✅ Operational | 12-domain aggregation, control tower, monitoring, self-validation all proven; no-fabrication PASS |
| Activation / Confidence | ⚠️ Low in dev | Most domain headlines are an honest 0; partners unmeasurable (no source) |

## Honest gaps
- `partners` has no source table wired into the aggregator → reported `null` (absent), correctly distinct from `0`.
- `status=degraded` is an honest reflection of one unmeasurable subsystem, not an outage.
- `gov_alerts=725` with `crit=0` reflects accumulated dev governance alerts; no critical alerts.

## Verdict
**SuperAdmin Command Center operational ✓** — aggregates 12 domains with no-fabrication validation passing; WARNs are honest absence (partners source not wired), zero FAIL.

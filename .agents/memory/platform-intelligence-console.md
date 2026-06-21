---
name: Platform Intelligence Console (Phase 6.10)
description: Read-only super-admin analytics console that composes the commercial engines into 7 metric groups; flag/gate ordering trap and honesty rules.
---

# Platform Intelligence Console (Phase 6.10)

A NEW additive, flag-gated (`platformIntelligenceConsole`, default OFF → byte-identical),
READ-ONLY super-admin console. COMPOSES the existing read-only commercial engines and adds the
genuinely-missing reads, exposing 7 categories (Platform Health, Adoption, Growth, Conversion,
Retention, Revenue, Operational) + `executive_dashboard` + `founder_dashboard` projections.

## Architecture
- Engines in `backend/services/platform/`:
  - `platform-operational-view.ts` — the only NEW reads (everything else is composed). Provides
    `data_quality` (avg `behavioral_reliability_index` from `capadex_runtime_contexts`),
    `growth_trend` (signups [60,30) vs [30,now) on `users.created_at`), `conversion_funnel`
    (distinct `capadex_sessions.guest_email` vs distinct paid `capadex_payments.email`), operational
    volume. `to_regclass` probes ONLY — NO ensure-schema/DDL.
  - `platform-intelligence-engine.ts` — `buildPlatformIntelligence()` COMPOSES
    engagement+retention+revenue+operational into the 7 categories + headline + degraded + notes.
  - `executive-dashboard-view.ts` / `founder-dashboard-view.ts` — each call
    `buildPlatformIntelligence()` ONCE then project (compose-never-recompute).

## Gate-ordering trap (the time-sink)
**A global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate (routes.ts ~4947) fronts
EVERY `/api/admin/*` route.** So a route-level flag guard can NEVER make flag-OFF return a strict
503 for an *unauthenticated* caller — auth rejects with 401 first (byte-identical to any non-existent
admin route). Re-ordering the local chain to put the flag check first is therefore DEAD-ordered behind
the global gate and changes nothing observable.

**Why:** the architect suggested moving the flag guard ahead of auth to satisfy a literal "flag OFF →
503"; that is unachievable here and pointless. Keep the canonical `[requireAuth, requireSuperAdmin,
requireConsoleFlag]` order (matches 6.9 enterprise-governance). The byte-identical-OFF guarantee that
actually matters: the ONLY reachable caller is an authenticated super-admin, for whom flag OFF → 503
and the FE tab stays hidden.

**How to apply:** an unauthenticated HTTP smoke against an `/api/admin/*` route asserts gating with
`status ∈ {401,403,503}` (a 200 = flag leaked ON is the only real failure) — do not demand a strict
503; you'd have to authenticate (MFA) to ever see it.

## Honesty rules
- Every unmeasurable rate is `null` **with an explicit note** pushed onto `notes[]` (e.g.
  `free_to_paid_pct` null when no session emails; `data_quality.avg_reliability_index` null when no
  BRI recorded). no_substrate (table absent) vs honest empty (table present, 0 rows) are distinct
  notes. Never fabricate a rate when the denominator/base is zero.
- never-throws: every DB read is `.catch()`-guarded and degrades; `degraded`/substrate flags drive
  `platform_health.overall_status` rather than throwing.

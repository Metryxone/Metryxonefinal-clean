---
name: Enterprise Workforce Console activation (MX-77X)
description: Activating the dormant M5/TIG workforce intelligence stack — measurement traps and flag-gating gotchas.
---

## n_live_tup is a stale estimator — never certify dormancy off it
A first-pass current-state audit used `pg_stat_user_tables.n_live_tup` and wrongly concluded the
whole Enterprise Workforce stack was dormant. True `COUNT(*)` showed the console is OPERATIONAL on
seeded `demo_org` data.
**Why:** `n_live_tup` is an autovacuum estimate, not a live count; it lags or zeroes on
freshly-seeded / rarely-vacuumed tables.
**How to apply:** any "is this table dormant/empty" claim in an audit MUST use `COUNT(*)`, never
`n_live_tup`.

## The workforce stack was already built — activate, don't rebuild
`services/enterprise-workforce-console.ts` (v9.0.0) + `routes/enterprise-workforce-console.ts`
(8 read-only GET views at `/api/enterprise-workforce/*`) + flag `enterpriseWorkforceConsole`
(`FF_ENTERPRISE_WORKFORCE_CONSOLE`, default OFF, super-admin gated, compose-never-recompute,
never-throws, to_regclass-probed, k_min=30, DEFAULT_ORG_ID='demo_org') already existed.
**Why:** a plan that says "build a new composer+flag" can predate discovery of an existing one;
building a parallel one violates a no-rebuild mandate and duplicates the surface.
**How to apply:** before building a composer/flag, grep for an existing one; the real gap is usually
the missing frontend surface, not the backend.

## Flag-OFF byte-identical needs BOTH nav AND render gated
SuperAdminDashboard persists `activeTab` in localStorage. Gating only the nav item
(`...(enabled ? [navItem] : [])`) is insufficient: if the tab was active while the flag was ON, a
reload after the flag flips OFF still renders the panel via the unconditional
`activeTab === 'x' && <Panel/>` line.
**How to apply:** gate the render too — `activeTab === 'x' && enabled && <Panel/>`. The 7-view detail
panel probes `/_meta/status` (res.ok) for the enabled flag (503 OFF → false).

## Honest reachability ceiling (demo_org)
Available: skill-gap, succession, mobility (DERIVED from succession candidates — provenance stamped),
talent-risk, talent-forecasting, readiness (1 subject trend), workforce-planning (capability
projection only). Genuinely dormant (0 rows, reported as "Insufficient Evidence", never faked):
`eios_*`, `m5_workforce_transformation_scenarios`, `m5_future_capability_forecasts`,
`m5_workforce_readiness_scores`, `m5_succession_readiness`, `m5_department_capability_scores`.
Enterprise readiness roll-up ABSTAINS (departments=0) → null, never 0. No predictive accuracy claimed
(no realized outcomes; Validation Loop ≥30 non-demo not met).

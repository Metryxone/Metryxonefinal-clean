---
name: Module Access Control panel (Phase 6.4)
description: Super-admin UI + plan→module APIs over the wc7c module-access engine, flag moduleAccessControl.
---

# Module Access Control (Phase 6.4)

Super-admin panel governing the 7 product modules (competency_assessments, employability_index,
career_builder, career_passport, employer_portal, analytics, workforce_intelligence) defined in
`backend/services/wc7c/module-access-engine.ts` (`MODULE_REGISTRY`/`MODULE_CODES`).

## Two distinct access sources — never conflate
- **Plan-derived**: `comm_plan_entitlements` rows whose `feature_code` = a module code. An active
  subscription to that plan confers the module (via `deriveModuleAccess`).
- **Manual grants**: per-email rows in the entitlement-grants ledger (POST `/grant`/`/revoke`).
Removing a plan→module mapping NEVER touches a manual grant, and vice-versa. The per-user UI only
lets you revoke *grant*-sourced modules (plan-sourced ones change only in the Plan mapping section).

## Plan→module write path FK chain
`comm_plan_entitlements.feature_code` FKs to `comm_features.code`. So the attach endpoint MUST run
`ensureArchitectureSchema(pool)` (creates comm_features + comm_plan_entitlements, and bootstraps the
comm spine it FKs into) AND `ensureModuleRegistry(pool)` (seeds the 7 module rows into comm_features)
BEFORE the INSERT, or the insert 23503s. Insert is `ON CONFLICT (plan_id, feature_code) DO NOTHING`
(idempotent). GET `/plans` stays DDL-free: `to_regclass` probe on comm_plans/comm_plan_entitlements
and degrades to "no modules mapped".

## Flag gating (byte-identical OFF)
- File-registry flag `moduleAccessControl` / `FF_MODULE_ACCESS_CONTROL` (default OFF). Every
  `/api/entitlement/*` route 503s BEFORE auth when OFF (gate is first middleware).
- Frontend hides the **nav tab itself** (not a panel-level 503): probe GET `/api/entitlement/modules`
  in `useAdminDashboardState.tsx` (`res.ok`) → filter out nav id `module-access` when false. This is
  the same pattern as `usageMeteringEnabled`. Panel id `module-access` in the Commercial group.

## Verification reality
No tsc here; 2FA super-admin login is impractical to browser-drive. Verified via: esbuild bundle
parse of the panel + all identifiers imported/defined + endpoints returning 503 (OFF) / 401 pre-auth
(ON, gate-before-auth) + SPA loads clean. Enable in dev via `setEnvVars({values:{FF_MODULE_ACCESS_CONTROL:'1'}})`
+ restart Backend API (can't append to .replit workflow — flag limit). prod default stays OFF.

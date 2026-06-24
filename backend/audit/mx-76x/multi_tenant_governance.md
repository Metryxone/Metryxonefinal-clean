# MX-76X · Section 8 — Multi-Tenant Governance

## Governance levels (mapped to existing assets)
```
Platform Level      ← super_admin (requireSuperAdmin) + feature-flags registry
Tenant Level        ← white_label_partners (0 rows) + tenant_* tables + createTenantScopeGuard
Organization Level  ← employer_* / org tables (employer portal)
Department Level     ← ont_departments (43) / m5 department engines
Role Level          ← ont_roles / onto_roles + RBAC (governanceRbacV2)
```

## Current state (measured)
- **All tenant tables = 0 rows** (`white_label_partners`, `tenant_relationships`,
  `tenant_capability_profiles`, `tenant_partner_agreements`, `tenant_category_assignments`,
  `tenant_channel_referrals`, `rf_white_label_configs`).
- Isolation middleware `createTenantScopeGuard` exists but is **opt-in**, not globally wired
  (preserves byte-identical legacy). Flags `tenantManagementConsole`, `tenantIsolationEnforcement`.
- RBAC subsystem `governanceRbacV2` present (RBAC/approvals/audit/security) — platform/role axis.

## Isolation model (additive, reversible)
- Tenant scoping is **opt-in per route** via the existing guard — going global does NOT flip it on
  globally (that would risk legacy data paths). New global-intel routes that are tenant-aware accept an
  optional resolved `tenant_id`; absent → platform scope (today's behaviour).
- Region/country config can hang off a tenant (`nhda_regions.tenant_id` already exists, all null
  today) so a tenant can scope its own regions — **untested until ≥1 tenant exists** (honest).
- RLS via `tenantIsolationEnforcement` applies only to additive tables — never retrofitted onto
  legacy tables in this task.

## Governance honesty
- With **0 tenants**, tenant isolation is **structurally ready, unverified**. Certification must say
  "multi-tenant ready (mechanism)", not "multi-tenant proven" (no tenant has exercised it).
- `labor_regime` (`m4_countries`) + data-residency are governance inputs that are **stored but not
  enforced** (G7/G9) → declared as roadmap, not claimed as active controls.

## Verdict
Multi-tenant *governance mechanism* = present (tables + guard + RBAC + flags). Multi-tenant
*operation* = unexercised (0 tenants). Reported as **Ready / Unexercised**.

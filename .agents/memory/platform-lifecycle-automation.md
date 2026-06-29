---
name: Platform Lifecycle Automation & Continuous Governance (MX-700 Phase 1.41)
description: Flag-gated enhancement tier that COMPOSES 1.37/1.38/1.39/1.40 into automation/governance/policy/compliance; durable honesty + injection-safe custom policy rules.
---

# Platform Lifecycle Automation & Continuous Governance (MX-700 Phase 1.41)

Flag `platformLifecycleAutomation` / `FF_PLATFORM_LIFECYCLE_AUTOMATION`, default OFF, byte-identical OFF incl. schema. Backend-only (STOP clause, no panel/notifications/AI). BASE `/api/admin/platform-lifecycle-automation`.

## The composition discipline (the whole point of this phase)
**Rule:** Automation/governance/compliance/validation/quality-gate views READ the existing 1.37 Foundation
(`getValidation`/`getRepositoryHealth`/`getSummary`), 1.38 (`getManagementSummary`), 1.39 Intelligence
(`getLifecycleValidation`/`getLifecycleMetrics`/`getCompatibilityIntelligence`/`getRepositoryHealthIntel`)
and 1.40 Evolution (`getEvolutionValidation`/`getEvolutionMetrics`/`getTechnicalDebtIntelligence`/`getEvolutionSummary`).
**Why:** every "validation" number this phase reports was already MEASURED by a prior tier — re-deriving it would
risk drift and duplicate engines. That discipline kept 1.41 to only **2 net-new tables**
(`platform_governance_policies`, `platform_governance_audit_snapshots`).
**How to apply:** before adding any check/getter, grep the 1.37–1.40 services; if the measured number exists,
compose it. Built-in policies map each rule to an EXISTING measured number (no new computation).

## Policy / compliance honesty
- **Built-in policies live in CODE** (deterministic `BUILTIN_POLICIES`, the honesty contract as machine-checkable
  rules). The DB table holds only human-authored CUSTOM policies. `custom_count` is null until a flag-ON write
  creates the registry (built ≠ populated).
- **Compliance is MEASURED on-demand, never persisted.** A policy existing ≠ a system being compliant
  (Policy-Exists ≠ Compliant; Compliance ≠ RuntimeUsage). Per-domain compliance ratios are kept SEPARATE; the
  single `overall_compliance` is the mean of EVALUATED policy ratios only (unmeasurable policies excluded, not 0).
- **Custom policy evaluation is injection-safe:** `rule_field` must pass an exact-match `SAFE_FIELDS` whitelist
  BEFORE any interpolation; scope/allowed values go through bind params. `builtin.*` key prefix is reserved.
  Non-whitelisted fields are rejected at register time (`rule_field_not_in_safe_whitelist`).

## Metric honesty (do not regress)
- **Six SEPARATE scores, NO composite/overall:** automation_health ⟂ compliance_health ⟂ governance_health ⟂
  validation_success ⟂ repository_stability ⟂ lifecycle_stability. The validate script asserts `scores` has no
  `overall`/`composite` key. repository/lifecycle stability REUSE the 1.39 measured metrics (compose, never recompute).
- **null ≠ zero:** a pass-rate/ratio with a 0 denominator returns null. Pass-rates EXCLUDE unmeasurable checks
  (unmeasurable ≠ pass; unmeasurable ≠ compliant).
- **Automation ≠ Activation · Validation ≠ Modification · Governance ≠ BusinessLogic · Gate-Pass ≠ Production-Ready.**
  Every engine is read-only; the only writes are register-policy / set-enabled / capture-snapshot. No gate auto-blocks,
  no policy auto-remediates, no dormant capability is activated (STOP clause). `regression_risk` gate is STRUCTURAL
  (flag-OFF byte-identical guarantee), deliberately not runtime-measured.

## Schema / flag discipline
- Every WRITE path owns its lazy `ensureAutomationSchema`; reads probe via `to_regclass` and degrade to `ready:false`.
  Flag-OFF (routes 503 before auth/DDL) creates zero tables.
- The global `/api/admin` auth gate fronts even `/enabled`, so OFF smoke returns membership in {401,403,503}, not a
  clean 503 on `/enabled` (same as 1.37–1.40). Assert the set, not one code. POST writes 403 unauth (requireSuperAdmin).
- Validate `scripts/mx700-1.41-validate.ts` (flag-independent: calls services directly, self-cleans its rows).

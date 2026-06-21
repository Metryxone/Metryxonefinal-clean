---
name: Enterprise Governance console (Phase 6.9)
description: Read-only flag-gated admin console composing the existing governance subsystem (RBAC/approvals/audit/security) + Data Governance + a transparent Compliance posture index.
---

# Enterprise Governance console (Phase 6.9)

A NEW read-only admin console that COMPOSES the already-built governance write subsystem (gated by
`governanceRbacV2`) — it never recomputes and never writes schema. Distinct flag
`enterpriseGovernanceConsole` (env `FF_ENTERPRISE_GOVERNANCE_CONSOLE`, default OFF). Four read-only
view engines live under `backend/services/governance/` (audit-trail / approval-workflow /
security-center / enterprise-governance composite).

## Hard rules that bit during build / review
- **Read engines MUST NOT call `ensureGovernanceSchema`.** The existing
  `services/governance/{audit-engine,approval-engine,security-overview}.ts` ALL run DDL on entry — do
  NOT reuse them on a GET path. The only safe reuse is the PURE `deriveCategory(actionType,targetType)`
  classifier exported from `audit-engine.ts`. New views do their own `to_regclass` probes + plain
  SELECTs.
- **A silent-zero helper breaks the no-fabricate axis.** A `count()` helper that catches DB errors and
  returns `0` without flipping `degraded`/notes makes an *unreadable present table* indistinguishable
  from a *true empty table*. Every count/read helper must take an `onError` that sets `degraded=true`
  and pushes a note. (Caught by architect review; fixed.)
- **Two distinct governance flags — keep them separate.** `governanceRbacV2` = the operational write
  subsystem (creates rbac_* tables, seeds, mutations). `enterpriseGovernanceConsole` = this read-only
  console only. The console can read substrate the write subsystem created, but is independently
  gateable and its flag-OFF path is byte-identical (route 503 + nav tab self-hides via `/console/ping`).

## Compliance posture index (transparent, never fabricated)
Renormalises weights over MEASURABLE pillars only and discloses which were used:
`rbac_defined` (0.3) / `audit_active` (0.3) / `approvals_resolved` (0.2) / `datagov_tracked` (0.2).
A pillar is included ONLY when its substrate table is present (and, for `approvals_resolved`, when
requests actually exist). Included weights renormalise to 1; `score = Σ value*weight * 100`. Zero
measurable pillars → `score=null` + `reason` (never a fabricated number). `approvals_resolved` =
`(total - pending)/total` and is unmeasurable when no requests exist (0/0 is not 100%).

## Substrate (all read-only, to_regclass-guarded)
`admin_audit_logs`, `rbac_failed_logins`, `rbac_flag_change_log`, `rbac_approval_requests`,
`intervention_approvals` (SERIAL id), `role_definitions`/`permission_definitions`/`role_permissions`/
`rbac_role_hierarchies`/`rbac_permission_groups`/`rbac_admin_status`, `governance_events`
(event_type/severity/created_at; Data Governance: consent_/data_access_/risk_flag_ prefixes). Live
super-admin gate reads `users.role = 'super_admin'` — reported as a SEPARATE axis from formal RBAC
(live gate authoritative, formal RBAC advisory), never composited.

**Why:** mirrors the Phase 6.8 customer-success pattern (engine→route→panel→nav wiring); the honesty
axes (Coverage/substrate vs degraded, transparent renormalised index) are the platform-wide convention
for these read-only admin consoles.

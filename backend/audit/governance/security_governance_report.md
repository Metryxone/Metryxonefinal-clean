# Security & Governance Report

_Generated: 2026-06-18T04:01:39.872Z · flag FF_GOVERNANCE_RBAC_V2=ON_

> Structural = approval engine, admin lifecycle, security-center aggregator and
> flag-change log all exist and are wired. Activation = governance actions have
> actually occurred (approvals raised/decided, statuses set, flag changes logged).
> Empty Activation in dev is honest.

## Headline

| Axis | Score |
|---|---|
| **Governance/SecurityOps — Structural** | ████████████████████ 100% |
| **Governance/SecurityOps — Activation** | ░░░░░░░░░░░░░░░░░░░░ 0% |

**Verdict: CONDITIONAL** (Structural 100% / Activation 0%).

## WS5 — Approval workflows

- Generalized request→decision workflow for **6 types**: `refund` `invoice_override` `role_assignment` `permission_escalation` `subscription_change` `data_deletion`.
- Decisions are **super-admin only** (route guard) and **fail-closed**: only a still-pending
  request can be decided; everything is audited.
- The engine **records and tracks** approvals — it does **not** execute the underlying action
  (the owning subsystem still performs the refund/role change/etc.). Reported, not implied.
- Activation: 0 request(s) recorded.

## WS3 — Admin lifecycle

- `getAdminDirectory` joins admin-class users with `rbac_admin_status`; `setAdminStatus`
  writes active/suspended/terminated + an audit event.
- **Advisory only:** status does **not** change the live super_admin gate (reported honestly).
- Admin-class users discovered: 1. Status overrides recorded: 0.

## WS6 — Security center

- Read-only never-throws aggregator over real tables: admin activity, audit-event counts by
  category, suspicious-activity heuristic (≥5 failed logins per ip/email in 24h), failed logins,
  feature-flag changes.
- Flag-change log Activation: 0 row(s).

## Critical Gaps closed

| Gap | Before | After |
|---|---|---|
| #2 Operational RBAC | `role_definitions` empty (0 roles) | 10 roles, 44 permissions, 144 grants, 9 hierarchy edges (canonical SYSTEM CONFIG) |
| #3 Audit / Governance | scaffold only, no semantic capture | login/logout/failed-login capture wired + approval + admin-lifecycle + security-center + flag-log engines & routes |

## Honest notes

- Flag-OFF (production default) is byte-identical: no schema, routes 503, panel hidden.
- RBAC config is fully seeded (Activation of config), but governance **usage** (approvals,
  status changes, flag-change entries) and audit **traffic** accrue only with real operation.

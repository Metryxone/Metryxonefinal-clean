# Audit Logging Readiness

_Generated: 2026-06-18T02:16:47.975Z · flag FF_GOVERNANCE_RBAC_V2=ON_

> Structural = the capture path is wired (tables + helpers + login/logout/failed-login
> hooks). Activation = events have actually been recorded. A fresh dev DB with the
> hooks wired but no traffic is an **honest zero on Activation**, never inflated.

## Headline

| Axis | Score |
|---|---|
| **Audit — Structural** | ████████████████████ 100% |
| **Audit — Activation** | ░░░░░░░░░░░░░░░░░░░░ 0% |

**Verdict: CONDITIONAL** (Structural 100% / Activation 0%).

## What is captured

- **Reuses the canonical `admin_audit_logs` table** — no parallel audit system. The global
  middleware (security-center) records mutating HTTP verbs; this layer adds **semantic**
  events: `login` `logout` `create` `update` `delete` `payment` `invoice` `assessment` `subscription` `role_change` `permission_change`.
- Login success, super-admin MFA login, logout and **failed logins** are wired into the
  passport handlers (flag-gated, fire-and-forget, never blocks auth).
- Failed logins land in `rbac_failed_logins` for the suspicious-activity heuristic.

## Activation evidence (live DB)

| Metric | Count |
|---|---|
| Total audit rows | 0 |
| Login/logout audit rows | 0 |
| Failed-login rows | 0 |

Recent failed-login sample (emails masked):
_None recorded yet — honest zero._

## Honest notes

- The capture hooks are wired but Activation depends on real auth traffic. In dev with no
  logins/failures the counts are legitimately low/zero — this measures wiring, not usage.
- Auditing is **never-throws**: a failure to write an audit row can never break the action
  it observes (auth, mutation, etc.).

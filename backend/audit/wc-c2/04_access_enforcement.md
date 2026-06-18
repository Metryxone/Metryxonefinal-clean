# WC-C2 · Deliverable 4 — Access Enforcement Report
_Generated 2026-06-10T05:36:05.041Z. Where paid-tier content is served WITHOUT an entitlement check._

## Central finding — session UUIDs are bearer tokens for paid-tier content
There is **no backend paywall**. Every paid-tier CAPADEX endpoint is gated by **possession of the session UUID** (+ a completed-status / runtime-flag check) — never by payment or entitlement. Anyone holding the UUID can fetch the deeper report regardless of payment; the only thing stopping non-payers is the **frontend** choosing not to call these endpoints.

## Missing enforcement points (verified file:line)
| Method | Endpoint | Location | Current gate (NOT entitlement) |
|---|---|---|---|
| GET | `/api/capadex/session/:id/report` | routes/capadex.ts:3037 | isRuntimeIntelligenceActivationEnabled() + validSessionId |
| GET | `/api/capadex/session/:id/reports` | routes/capadex.ts:3078 | isRuntimeIntelligenceActivationEnabled() + validSessionId |
| GET | `/api/capadex/report/:session_id` | routes/capadex.ts:3360 | session exists + status=completed + email param (linking only) |
| GET | `/api/capadex/session/:id/omega-x` | routes/capadex.ts:2565 | reader; validSessionId |
| GET | `/api/capadex/session/:id/signals` | routes/capadex.ts:2580 | validSessionId |
| GET | `/api/capadex/session/:id/patterns` | routes/capadex.ts:2590 | validSessionId |
| GET | `/api/capadex/session/:id/explain` | routes/capadex.ts:2603 | validSessionId |
| GET | `/api/capadex/session/:id/guidance` | routes/capadex.ts:2621 | validSessionId |
| GET | `/api/capadex/session/:id/grounding` | routes/capadex.ts:2644 | validSessionId |
| GET | `/api/capadex/session/:id/pipeline` | routes/capadex.ts:2711 | validSessionId |
| GET | `/api/capadex/session/:id/stage` | routes/capadex.ts:2734 | validSessionId |

## RBAC ≠ entitlement
`requireAuth` / `requireAdmin` / `requireSuperAdmin` are **role-based** and never consult `deriveEntitlement`. There is no `requireEntitlement` / `requirePlan` tier guard anywhere in the codebase.

## The single fix
One `requireEntitlement(feature)` middleware that calls `deriveEntitlement(pool, email)` and 403s when the required feature is absent, applied to the report/stage endpoints above. For ladder stages this satisfies BOTH `access_enforcement` AND `access-provisioning` (the paid stage finally unlocks). It does **not** cover packages (entitlement-disjoint — see deliverable 1).

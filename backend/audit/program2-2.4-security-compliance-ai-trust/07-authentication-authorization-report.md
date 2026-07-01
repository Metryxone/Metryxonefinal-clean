# 07 · Authentication & Authorization Report

## Authentication
| Control | Status | Evidence |
|---|---|---|
| Local password auth | **PRESENT** | Passport `LocalStrategy`; `scrypt` hashing (16-byte salt / 64-byte key), `${hash}.${salt}` (`backend/routes.ts` ~362–486). |
| Super-admin MFA (always-on) | **PRESENT** | Issue ~841–867, verify ~887–936; 6-digit, 5-min TTL, `attemptToken`-bound, ≤5 attempts, single-use; **no password-only path**. Non-prod code logged to console (never in HTTP response). |
| Federated (Google/Firebase) | **PRESENT** | `backend/routes/firebase-auth.ts` — RS256 verification vs Google certs. |
| Password policy | **PRESENT** | `backend/lib/password-policy.ts` — complexity (hard floor) + HIBP breach best-effort fail-open; shared by register/reset/seed-admin. |
| Account lockout | **PRESENT** | 5 failures → 30-min lockout (`isLockedOut` ~666); fails open by design. |
| Auth rate limiting | **PRESENT** | login 10/min, register 5/min, mfa-verify 10/min, mfa-resend 5/min (Postgres-backed sliding window). |
| Session issuance | **PRESENT** | `connect-pg-simple` Postgres store; `httpOnly`+`secure`(prod)+`sameSite:lax`; 7-day `maxAge`. |
| Session lifetime policy | **PARTIAL** | 7-day rolling; no absolute/idle timeout or forced re-auth on privilege change surfaced → SEC-M1. |

## Authorization
| Control | Status | Evidence |
|---|---|---|
| requireAuth | **PRESENT** | `backend/routes.ts` ~525. |
| requireSuperAdmin | **PRESENT** | ~5281; inline guards where defined before it. |
| Structural admin gate | **PRESENT** | `app.use('/api/admin', requireAuth→requireSuperAdmin)` ~5336; + `isFrameworkAdminPath` second mount catches `/api/<fw>/admin/*` (`backend/lib/admin-path-gate.ts`, case-insensitive). |
| RBAC v2 | **PRESENT** | `backend/services/governance/rbac-engine.ts` — `requirePermission(pool,'perm:scope')`, wildcard-aware, `wos_role_assignments`, role hierarchies + permission groups. |
| ABAC / ownership | **PARTIAL** | Ownership/attribute checks (child-record, role-switch) implemented per-handler, not a centralized ABAC engine (acceptable; noted for consistency). |
| Identity source | **PRESENT** | Session-only via `deserializeUser`; no header-trust in live backend. |
| MFA scope | **PARTIAL** | MFA limited to `super_admin`; no MFA option for other privileged roles (employer/institution admins) → SEC-L3. |

## Assessment
Authentication and authorization are **robust and defense-in-depth**: strong hashing, always-on super-admin MFA, Postgres-backed sessions with correct cookie flags, layered admin gating (explicit + structural framework gate), wildcard-aware RBAC v2, and session-only identity with header-trust removed. Residual items are **policy refinements** (session lifetime SEC-M1, MFA breadth SEC-L3), not defects. No authorization bypass was found in the live backend path.

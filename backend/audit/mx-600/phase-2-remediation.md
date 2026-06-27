# MX-600 Enterprise Audit — Phase 2 Remediation

**Date:** 2026-06-27
**Scope:** Founder directive — implement R1 / R2 / unknown-role-default / B1 "without gaps, make it 100%".
**Discipline:** additive, fail-closed, honest (null≠0); no auto-deploy. STOP for Founder GO/NO-GO after this report.

---

## R1 — Partner onboarding submissions now reach review (was a dead-end)

**Finding:** the public partner onboarding form had no live backend route, so institute / mentor / NGO / parent / LEI applications were never persisted — they could not reach the Super Admin Onboarding panel.

**Fix (additive, backend only):**
- `POST /api/onboarding/register` and `GET /api/onboarding/status/:email` registered in `backend/routes.ts` **before** `/api/login` (public, no auth).
- Writes to `onboarding_approvals` — the **same** table the Super Admin Onboarding panel reads + approves from, so submissions are genuinely reviewable.
- `authRegisterLimiter` (existing rate limiter) applied; CSRF enforced by the global double-submit guard (verified live).
- Validation: `entityType ∈ {institute, mentor, ngo, parent, lei}`, required `entityName`, email-format check.
- Duplicate-pending guard → `409` (a partner can't flood review with the same email).
- **Lossless capture:** all extra partner fields preserved in a new `metadata` JSONB column (`onboarding_approvals.metadata`), so no submitted data is dropped.
- **Status lookup is token-gated (anti-enumeration):** `register` mints an unguessable 32-byte `trackingToken` (stored in `metadata`, returned once + emailed). `GET /status/:email` requires `?token=` and verifies it with a timing-safe compare; **every** miss returns an identical `404` so application existence is never disclosed. The GET carries the register rate limiter. This closes the email-enumeration / status-disclosure surface flagged in code review (email alone is no longer sufficient).
- Best-effort, non-blocking notifications: applicant confirmation (now includes the tracking code) + Super Admin alert (`sendOnboardingConfirmation` / `sendOnboardingAdminAlert` in `backend/email.ts`, HTML-escaped). Email failure never fails the submission.
- Frontend (`OnboardingRegisterPage.tsx`): persists the token to `localStorage` on register (same-device tracking just works) and adds a tracking-code input for cross-device lookups; status display reads the canonical snake_case fields.

**Schema:** `metadata jsonb DEFAULT '{}'::jsonb` added to `onboardingApprovals` in `backend/shared/schema.ts`, with canonical migration `backend/migrations/20260627_onboarding_approvals_metadata.sql` **and** a lazy `ADD COLUMN IF NOT EXISTS` ensure in the route (mirrors the project's migration + lazy-ensure convention).

**Live smoke test (localhost:8080, with CSRF token):**
| Case | Expected | Actual |
|---|---|---|
| GET status (no token) | 404 | 404 ✓ |
| GET status (wrong token) | 404 (no disclosure) | 404 ✓ |
| POST register (valid) | 201 + pending row + token | 201 ✓ |
| POST register (duplicate pending) | 409 | 409 ✓ |
| POST register (bad entityType) | 400 | 400 ✓ |
| GET status (correct token) | 200 pending | 200 ✓ |
| metadata persistence | extras + token in JSONB | verified ✓ |

Demo row (`partner-smoke@example.com`) purged after the test.

---

## R2 — Registration password policy aligned with backend (was min-6, mismatched)

**Finding:** the registration form only required ≥6 chars, while the backend password validator enforces a 12-char complexity floor (lower/upper/number/symbol). Users could submit "valid" passwords the backend would reject.

**Fix (`frontend/src/components/Registration.tsx`):**
- Client-side validation now mirrors the backend floor: ≥12 chars + lowercase + uppercase + number + symbol, with specific error messages.
- Guarded for Google-prefilled accounts (password optional): the policy only runs when a password is actually provided.
- Placeholder updated `Min 6 characters` → `Min 12 characters`.
- Live inline checklist under the password field (5 rules, ✓/○) so users see requirements as they type.

Backend remains the authority; this removes the false-accept on the client. Frontend typecheck clean.

---

## Unknown-role default — absent role no longer silently lands on the parent dashboard

**Finding:** `Login.tsx` defaulted an absent `role` to `'parent'`, so users with no/unknown role were routed to the parent dashboard.

**Fix (`frontend/src/components/Login.tsx`):**
- `getNavigationTarget(role?)` — unknown/absent role now returns `'role-selection'` (was `'landing'`); signature accepts `undefined`.
- `primaryRole` default changed `'parent'` → `''`; an absent role yields an empty role set that routes to neutral **role selection** rather than the parent dashboard.
- `dashboardTarget` derives from `primaryRole` for consistency.
- Stored session `role` left as `'parent'` fallback only to satisfy the saved-session type union; navigation is the corrected path. Frontend typecheck clean.

---

## B1 — Formal RBAC is now a live authorization participant (was advisory-only)

**Finding:** the formal RBAC model (`role_definitions`/`permission_definitions`/grants, 10 roles · 44 permissions) was seeded but **never consulted at runtime** — the only live gate was the single `super_admin` check. The two role vocabularies (login persona roles vs formal role names) were disjoint.

**Fix:**
- New enforcement primitives in `backend/services/security-middleware.ts`:
  - `PERSONA_TO_RBAC_ROLE` — the single bridge mapping login persona roles → formal `role_definitions` names.
  - `requireRole(...roles)` — fail-closed role gate (super_admin / `GOV_ADMIN_TOKEN` inherit; persona→formal mapping; 401 no identity / 403 denied).
  - `requirePermission(pool, permKey)` — fail-closed permission gate backed by `resolveEffectivePermissions` (formal model); any resolution error or missing permission → 403.
- Wired as **defense-in-depth** on the RBAC mutation routes (`backend/routes/governance.ts` grant/revoke) using the real seeded keys `permissions.grant` / `permissions.revoke`. The existing `requireSuperAdmin` guard is retained (not loosened — avoids any lockout / global-gate risk), so the change is a strict superset and super_admin behaviour is unchanged.
- `rbac-engine.ts` honesty note updated to reflect that grant/revoke now consult the formal permissions as a live participant.

**Honest scope (corrected after code review — not over-claimed):** the grant/revoke routes still sit behind the existing `requireSuperAdmin` guard **and** the platform-wide `app.use('/api/admin', requireAuth → requireSuperAdmin)` gate. So today **super_admin is the SOLE effective gate** there — a non-super-admin is rejected before `requirePermission` is ever consulted, making it genuine *defense-in-depth* (belt-and-suspenders), **not** yet the deciding authority for any reachable caller. What is genuinely shipped and real now: the reusable, **fail-closed, unit-tested** enforcement primitives (`requireRole` / `requirePermission`) plus the single persona→formal-role bridge. Genuine *delegated* enforcement (a non-super-admin acting via a granted formal role) requires making a reachable surface permission-aware (the global `/api/admin` gate is super_admin-only by design); that is the documented next phase, deliberately **not** done here to avoid lockout risk. `grants: 0` at boot is correct, not a defect.

**Unit test:** `backend/tests/rbac-enforcement.test.ts` — 5/5 pass (super_admin inherit, hr_recruiter→recruiter, institute→institution_admin, wrong-role 403, no-identity 401).

---

## Validation summary
- Backend booted clean (`Server listening on 8080`; `RBAC seed ready: roles 10, permissions 44, grants 0`).
- RBAC unit test: 5/5.
- Frontend typecheck: no errors in `Login.tsx` / `Registration.tsx`.
- Onboarding routes: 6/6 live HTTP checks pass; demo data purged.
- Flag posture: changes are either public (onboarding) or defense-in-depth behind the existing `governanceRbacV2` flag + super_admin gate; no new always-on surface beyond the intended public onboarding endpoints.

## STOP — awaiting Founder GO/NO-GO
Per project policy (audits & additive phases stop for approval; never auto-deploy). No deployment performed.

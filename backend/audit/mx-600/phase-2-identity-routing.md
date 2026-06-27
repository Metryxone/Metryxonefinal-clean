# MX-600 — Phase 2: Registration, Identity & Experience Routing (Audit + Validation)

**Date:** 2026-06-27 · **Mode:** Read-only audit (no code changed) · **Founder gate:** STOP for REVIEW

> **Honesty discipline:** Every claim below was opened in code and verified — I downgraded/over-rode explorer output where the live path differed (notably the onboarding route living in the *dormant* app). Findings are graded by severity; none is presented as worse or better than the evidence supports. `defined` ≠ `enforced`; `exists in repo` ≠ `served live`.

---

## DELIVERABLE 1 — Audit Report

### 2.1 Registration
- **Self-registration** (`frontend/src/components/Registration.tsx`): parent · student · career_seeker (Employability Index™) · institute · ngo · corporate/HR · metryx_applicant (mentor/evaluator). Google/Firebase social via `lib/firebase.ts`.
- **Live backend handler:** `POST /api/register` (`routes.ts:501`, rate-limited `authRegisterLimiter`) + `POST /api/auth/firebase/google/register` (`routes/firebase-auth.ts`).
- **⚠️ FINDING R1 (High) — Partner onboarding submit has NO live handler.** `OnboardingRegisterPage.tsx` POSTs to `/api/onboarding/register`, which exists **only** in the dormant `frontend/server/src/routes/onboarding.ts` (a second Express+JWT app run by **no workflow**). The live Node backend serves only `/api/admin/onboarding/*` (super-admin review/approve/KYC). → A partner submitting the onboarding form in the live app gets a **404**. Decision needed: port the public submit route into the live backend, or remove/redirect the form.
- **⚠️ FINDING R2 (Medium) — Password length client/server mismatch.** Client requires **≥6** (`Registration.tsx:347` + placeholder "Min 6 characters"); server enforces **≥12** (`lib/password-policy.ts` `PASSWORD_MIN_LENGTH=12`). A 6–11 char password passes client validation, is submitted, then **rejected server-side** → confusing failed registration. One-line client fix.

### 2.2 Authentication
- **Session-cookie based** (`express-session` + `connect-pg-simple` Postgres store + Passport `LocalStrategy`). The JWT app is dormant — **live auth is sessions, not JWT.**
- **Mechanisms:** password login · email-OTP login (`/api/auth/otp/*`) · Firebase/Google.
- **Super-admin login is always MFA-gated** (emailed 6-digit code via Zoho; dev logs it to console — never returned in HTTP). No password-only bypass. ✅ matches `replit.md` security canon.
- **Password policy:** min 12 / max 128, complexity always-on, common-password blocklist, HIBP breach best-effort (fail-open). **Lockout:** `rbac_failed_logins`. **Rate limiting:** sliding-window per IP+route on login/register/mfa. **CSRF:** signed double-submit, mounted first (full `/api` coverage), fail-closed. ✅ all live.
- **⚠️ FINDING A1 (Low/known) — latent JWT app.** `frontend/server` carries a hardcoded JWT secret and header-trust history; it is dormant (empty node_modules, not served) but remains a latent risk if ever wired. Documented, not live.

### 2.3 RBAC
- **Live enforcement = single `super_admin` gate.** All `/api/admin/*` go through `[requireAuth, requireSuperAdmin]`; per-framework `/api/<fw>/admin/*` closed structurally by a second mount (per prior remediation). Governance mutations add `requireGovAdmin` (super_admin or `GOV_ADMIN_TOKEN`).
- **⚠️ FINDING B1 (Medium, by-design-debt) — formal RBAC is defined but NOT enforced.** `services/governance/rbac-engine.ts` defines a full role/permission hierarchy (super_admin → platform_admin → institution_admin → employer_admin → recruiter → faculty → assessor → counselor → student → candidate) but it is **advisory/governance-surfaced only**; the live path uses the single super_admin gate. Two role vocabularies coexist (formal RBAC vs live persona roles in `users.role`/`users.roles[]`). Not a security hole today (the coarse gate is strict), but it means granular least-privilege is **claimed in the model, not active in enforcement** — must not be described as "live RBAC".

### 2.4 Career Stage
- **Canonical:** `career_seeker_profiles.career_stage` (migration `20260627_career_stage.sql`).
- **Detection** (`services/experience-routing.ts` `deriveStage`): student role → `student`; SENIOR/EXEC title regex; years 15+/8+/3+/1+/<1 → executive / senior-leadership / mid-career / early-career / graduate; no-years fallback → mid-career (has experience) else graduate. **Returns null honestly when unknown.** Self-select at registration when `careerLaunchpad` on. ✅ best-effort, no fabrication.

### 2.5 Persona
- `role` (primary) + `roles[]` (secondary) + `career_stage` (seniority refinement). Self-heal ensures primary role is in `roles[]` (legacy accounts defaulted to `['parent']` — note: **`parent` is the global default fallback role**, see Routing).

### 2.6 Experience Routing
- **Post-login:** `getNavigationTarget` (`Login.tsx:245`) maps ~16 role aliases → 6 dashboards. Unknown role → warns + defaults to landing; absent role → **`parent`** default.
- **effectiveExperience** (`routes/career-seeker.ts` `/api/career/experience`): no profile → **Launchpad** ("no-presumption entry"), not Command Center.
- **Experience switcher:** launchpad · command-center · leadership-studio · executive-studio. **Switching is a navigation PREFERENCE only** (`persistPreferredExperience` → `data.careerProfile.preferredExperience`) and **never mutates `career_stage`**. Gated by `allowedExperiences(stage)`: launchpad + command-center universal; leadership-studio = senior-leadership; executive-studio = executive. ✅ correct (a junior can't escalate, a senior isn't silently demoted).

### 2.7 Profile Completion & Career Profile
- `career_seeker_profiles.data` JSONB → `careerProfile`. `computeCompleteness` weighted (personal 12 · email 12 · experience 18 · education 14 · tech-skills 10 + bonuses linkedin/certs 4 each). Drives `FirstLoginProfileModal` + readiness metrics.
- **⚠️ FINDING P1 (Low/enhancement) — no true progressive profiling.** Completeness nudges via a modal, but there is no staged "ask the next best field over time" flow. Opportunity, not a defect.

### 2.8 Preferences
- Stored across `data` JSONB (`preferredExperience`), `metadata.consents` (privacy/marketing), and `localStorage` (theme). **⚠️ FINDING P2 (Low) — preferences are fragmented** across three stores with no unified surface.

---

## DELIVERABLE 2 — Validate Every Experience

> **Validation method (honest):** routing/identity logic was traced in code (the source of truth for where each persona lands). Live end-to-end login per persona is **deferred to the runtime phase** — dev has only 4 users and super-admin is MFA-gated, so seeded per-persona accounts are required for true e2e. This phase certifies the **routing contract**, not a live click-through.

| # | Experience | Login role(s) | Lands on | Stage/sub-experience | Verdict |
|---|---|---|---|---|---|
| 1 | **Student** | student · campus_student · metryx_student | `student-dashboard` | stage = `student` | ✅ PASS |
| 2 | **Graduate** | career_seeker · job_seeker · employee_candidate | `career-builder` | stage `graduate` → **Launchpad/Fresher Hub** | ✅ PASS (stage-derived, not a separate login) |
| 3 | **Professional** | career_seeker · job_seeker | `career-builder` | stage `mid/senior/exec` → Command Center / Leadership / Executive Studio | ✅ PASS (gated by `allowedExperiences`) |
| 4 | **Employer** | hr_recruiter · corporate | `employer-portal` | — | ✅ PASS |
| 5 | **University** | institute · college · school · skilling_partner | `unified-institute-dashboard` | role-scoped (faculty batch-confined) | ✅ PASS |
| 6 | **Founder** | *(no distinct role)* — `super_admin` + flag `founderControlCenter` | `super-admin` → Founder Control Center console | — | ⚠️ CONDITIONAL — **not a registration identity**; a super-admin console (flag-gated). Honest: "Founder" is an admin lens, not a 7th persona. |
| 7 | **Super Admin** | super_admin · admin · superadmin | `super-admin` (MFA-gated) | — | ✅ PASS |

**Cross-cutting finding (Medium):** the **default fallback role is `parent`** (absent/unknown role → `parent` dashboard). For a platform whose primary funnels are seeker/student/employer, defaulting unknown identities to the parent dashboard is a surprising choice worth revisiting.

---

## DELIVERABLE 3 — Responsibility Matrix (identity components)

| Concern | Canonical owner | Status |
|---|---|---|
| Registration (live) | `routes.ts` `/api/register` + `firebase-auth.ts` | ✅ live |
| Partner onboarding submit | `frontend/server/.../onboarding.ts` (DORMANT) | ⚠️ not served live (R1) |
| Session auth | `routes.ts` (Passport + pg session) | ✅ live |
| Password policy | `lib/password-policy.ts` | ✅ live (client out of sync — R2) |
| Rate limit / lockout / CSRF | `security-middleware.ts` · `rbac` schema · `lib/csrf.ts` | ✅ live |
| Coarse admin RBAC | `requireAuth`+`requireSuperAdmin` | ✅ live |
| Granular RBAC | `governance/rbac-engine.ts` | ⚠️ defined, advisory only (B1) |
| Career stage | `services/experience-routing.ts` + `career_stage` col | ✅ live |
| Experience switch | `experience-routing.ts` (`preferredExperience`) | ✅ live, preference-only |
| Profile completeness | `routes/career-seeker.ts` `computeCompleteness` | ✅ live |
| Preferences | JSONB + localStorage (fragmented) | ⚠️ P2 |

---

## GO / NO-GO GATE — Phase 2

**Verdict: GO (conditional) ✅** — identity, session auth, MFA, rate-limiting, CSRF, career-stage derivation, and experience routing are sound and live. The experience-switcher correctly treats stage as canonical and switching as preference.

**Open findings carried forward (graded):**
- **R1 (High):** partner onboarding submit has no live handler → 404. *Decision needed.*
- **R2 (Medium):** password min-length client(6)/server(12) mismatch → confusing rejected signups. *One-line fix, awaiting approval.*
- **B1 (Medium):** granular RBAC defined but not enforced (coarse super_admin gate is the live control). *Roadmap decision, not a hole.*
- **Cross-cutting (Medium):** unknown-role default = `parent` dashboard. *Revisit default.*
- **A1 / P1 / P2 (Low):** dormant JWT app · no progressive profiling · fragmented preferences.

**Founder decisions requested:**
1. **R1** — port the public onboarding submit into the live backend, or remove/redirect the partner form?
2. **R2** — approve the one-line client password-length fix (align to 12)? (and surface the full policy in the UI)
3. **B1** — keep coarse RBAC for now (documented) or schedule granular enforcement?
4. Which **Product Enhancements** (see `phase-2-optimization-report.md`) to implement now vs backlog?
5. Proceed to **Phase 3**? (which?)

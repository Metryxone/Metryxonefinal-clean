# Phase 5.6 — Employability Matching Engine · Reconciliation & Build Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Phase:** 5.6 — Employability Matching Engine
**Status:** Built, smoke-verified, flag default OFF. STOP for approval (no merge/deploy).
**Contract:** additive · flag-gated (default OFF) · compose-never-recompute · GET-never-writes · super-admin IDOR-guarded · never-throws · honesty-first (dual-axis coverage/confidence; developmental-signal language, NEVER hiring/suitability prediction).

---

## 1. What this phase adds

Three developmental employability signals, each COMPOSED from already-computed
profiles — no new scoring math, no new tables, no DDL.

| Deliverable | Engine fn | Output | Substrate composed |
|---|---|---|---|
| `employability_matching_engine` | `computeHiringReadiness` + orchestrator `buildEmployabilityMatch` | **Hiring Readiness** (role-agnostic present-state readiness) | `readiness.overall` composite → EI-overall fallback → unmeasured |
| `job_readiness_engine` | `computeJobReadiness` | **Job Readiness** (role-specific) | `readiness.role` block + career `target_occupation` context |
| `employer_fit_engine` | `computeEmployerFit` | **Employer Fit** (directional, always provisional) | mean(EI overall, role readiness), capped DOWN by high-severity EI critical risk |

---

## 2. Reconciliation — substrate is REUSED, not rebuilt

- **Single substrate loader:** `loadPassportContext(pool, subjectId)` in
  `services/career-passport-engine.ts` — one read-only, never-throws,
  `competencyRuntimeReady`-gated (`to_regclass` probes, **ZERO DDL**) call returning
  `{ runtimeReady, eiProfile, readiness, careerProfile, competencyProfile, notes }`.
- **EI Profile** = `buildEiProfile` (`ei-profile-engine.ts`): `overall_ei`, dimensions,
  strengths/development, `critical_risks[]`, growth potential.
- **Readiness Profile** = `buildCareerReadiness` (`career-readiness-aggregator.ts`):
  `overall{measurable,score,contributing}` + `current/future/role/growth` blocks, each
  with its own `axes{coverage,confidence}`.
- **Career Profile** = `career_seeker_profiles` JSONB (keyed `user_id`); read for
  `target_occupation` only.
- **Identity key** = `subjectId` (= `user_id`), explicitly NOT `employer_candidates.id`
  (a different identity space from Phase 5.5).
- **Net-new tables: 0. DDL statements: 0.** Verified at runtime by a pre/post `pg_class`
  relation-count snapshot in the smoke (relAfter === relBefore).

---

## 3. Honesty model (dual axes, never composited)

Every metric reports **Coverage** (does the data exist) and **Confidence** (is it
trustworthy) as TWO SEPARATE axes — never folded into a single number.

- **Compose-never-recompute:** scores are derived from already-composed composites
  (`readiness.overall` / `readiness.role` / `ei.overall`). No competency/dimension
  weighting is re-implemented.
- **Never fabricate:** an absent input yields `measurable:false`, `score:null`, band
  `Unmeasured`, and an honest note — never a default 0.
- **Hiring Readiness** prefers the readiness composite; only falls back to EI overall
  when the composite is unmeasurable (cap noted); unmeasured when neither exists.
- **Job Readiness** requires a measurable anchor-role block; with no anchor role it is
  honestly unmeasured (a target_occupation is context, never invented into a score).
- **Employer Fit** is ALWAYS provisional (no employer-side outcome data → confidence
  ceiling Moderate) and capped DOWN to band `Developing` by any high-severity EI
  critical risk. Labelled a directional developmental signal, never a hiring verdict.
  Its coverage axis averages the EI and role coverage ONLY when both are genuinely
  present — an absent source is never coerced to 0 (no fabricated coverage); a single
  present source is reported alone, and neither present → `null`.
- **Language policy** from the EI profile is surfaced unchanged on the envelope.

---

## 4. Flag, routes, wiring

- **Flag:** `employabilityMatching` (default `false`) in `config/feature-flags.ts`;
  env `FF_EMPLOYABILITY_MATCHING`; helper `isEmployabilityMatchingEnabled()`.
- **Routes** (`routes/employability-matching-engine.ts`, base
  `/api/employability-matching-engine`): `gate → requireAuth → requireSuperAdmin`,
  GET-only, literal-before-param:
  `/_meta/status`, `/subject/:subjectId/{hiring-readiness,job-readiness,employer-fit,explain}`,
  `/subject/:subjectId`.
- **Flag-OFF behaviour:** every route returns 503 BEFORE any auth/DB touch
  (byte-identical legacy).
- **Wiring:** imported and registered in `routes.ts` with `concernsPool` +
  `requireAuth` + `requireSuperAdmin` (mirrors Phase 5.5 talent-matching).

---

## 5. Smoke results — `scripts/smoke-employability-matching-engine.ts`

`FF_EMPLOYABILITY_MATCHING=1 npx tsx scripts/smoke-employability-matching-engine.ts` → **32 passed, 0 failed.**

The harness is fail-safe: a top-level `catch` and a completeness guard (asserts all
31 pre-guard checks executed) ensure a section skipped by exception can never report a
false clean pass. The integration subject is a real `users.id` uuid (seeded
`@example.com` parent row, since `career_seeker_profiles.user_id` has an FK to
`users.id`); both seeded rows self-clean.

- **Pure engines (synthetic contexts):** readiness-composite-preferred Hiring (78,
  3/3 coverage, 3 drivers); EI fallback (65, cap noted); all-unmeasured honesty;
  role-specific Job Readiness (75); Employer Fit mean = 78.5 with Moderate confidence
  ceiling and provisional cap; high-severity critical risk caps band to Developing;
  career target propagated into Job Readiness notes.
- **Integration (real `@example.com` subject):** never-throws, well-formed envelope,
  dual axes on all three metrics, real `career_seeker_profiles` row read
  (`target_occupation` surfaced), no fabricated score when substrate absent, blank
  subject → `invalid_input`.
- **GET-never-writes:** `pg_class` relation count unchanged across the read path
  (ZERO DDL).
- **HTTP:** `/_meta/status` and `/subject/:id` both 503 with the flag OFF on the
  running server.
- Demo row self-cleaned.

---

## 6. Launch gate

- Frontend `npx vite build` — PASS (backend runs on tsx; no backend typecheck gate per
  program convention).

---

## 7. Out of scope

- **Phase 6 NOT built** (per directive).
- No UI surface in this phase (engine + API only).
- No merge, no deploy — STOP for approval.

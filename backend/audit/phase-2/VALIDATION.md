# Phase 2 — Competency Runtime Activation · Validation Report

**Date:** 2026-06-19
**Flag:** `competencyRuntime` (default **OFF**)
**Scope:** Operationalize the live competency chain — Role → Blueprint → Assessment
Generation → Scoring → Competency Profile → Gap Analysis. Strictly additive,
flag-gated, never fabricates. **No consumers touched** (Employability Index,
Career Builder, Career Passport, Employer Intelligence, Learning Intelligence,
Future Readiness).

---

## 1. What shipped

| Artifact | Path |
|---|---|
| Flag + `isCompetencyRuntimeEnabled()` | `backend/config/feature-flags.ts` |
| Migration (4 tables) + lazy `ensureCompetencyRuntimeSchema()` | `backend/migrations/20260619_competency_runtime.sql`, `backend/services/competency-runtime.ts` |
| Runtime engine | `backend/services/competency-runtime.ts` |
| Routes (gate→auth→wrap) | `backend/routes/competency-runtime.ts` |
| Registration | `backend/routes.ts` (`registerCompetencyRuntimeRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`) |

**Tables (append-only profile):** `onto_assessment_instances`,
`onto_assessment_responses`, `onto_competency_scores`, `onto_competency_profiles`.

**Access control (IDOR fix).** `subject_id` is an operator-supplied identifier for
any assessed person — it is **not** the caller's own identity. So all five routes
are gated `gate → requireAuth → requireSuperAdmin`. Only trusted operators may
generate/score/read arbitrary subjects, closing the cross-user IDOR surface a code
review flagged on the initial `requireAuth`-only version.

**Routes (all `requireAuth` + `requireSuperAdmin`, 503 when flag OFF):**
- `POST /api/competency-runtime/assessment-instances`
- `GET  /api/competency-runtime/assessment-instances/:id`
- `POST /api/competency-runtime/assessment-instances/:id/score`
- `GET  /api/competency-runtime/profiles/:subjectId`
- `GET  /api/competency-runtime/gap-analysis/:subjectId`

---

## 2. Honesty model (no fabrication)

- **Domain-proxy measurement.** The question bank is keyed by 7 codes
  (COG/COM/LEA/EXE/ADP/TEC/EIQ); the genome taxonomy has 5 onto-domains.
  `onto_competency_question_map` = **0 rows**, so per-competency scores inherit
  their **onto-domain** score (curated, inert `DOMAIN_CODE_TO_ONTO` crosswalk).
  Reported as `measurement: "domain_proxy"`. **Auto-upgrades** to per-competency
  precision the moment `onto_competency_question_map` is populated — no code change.
- **UNMEASURABLE surfaced, never scored.** `dom_strategic` has no question-bank
  code → its competencies (e.g. *Strategic Planning*) are reported `unmeasurable`
  with a reason string, excluded from scores and from coverage numerator.
- **Coverage reported as a separate axis** (measurable vs total competencies).
- **Scoring mirrors bank `option.score` (0–100)**, not the CAF/IRT engine —
  documented deviation (the IRT engine expects a data shape this bank does not
  carry). `scoreToLevel`: ≥80→5, ≥60→4, ≥40→3, ≥20→2, else 1.

---

## 3. Validation results

### 3.1 Flag-OFF = byte-identical (503 before any DB/auth)
Workflow command does **not** set `FF_COMPETENCY_RUNTIME`, so flag is OFF:

```
GET  /assessment-instances/x   -> 503
GET  /profiles/demo            -> 503
GET  /gap-analysis/demo        -> 503
POST /assessment-instances     -> {"ok":false,"error":"feature_disabled","flag":"competencyRuntime"}
```
The gate is the first synchronous statement in every route — no DB read/write/DDL
occurs when OFF.

### 3.2 Schema
- 4 tables present after lazy ensure.
- Migration re-applied cleanly (idempotent; `IF NOT EXISTS` + skip notices only).

### 3.3 End-to-end (flag ON, engine-level, real DB, demo data purged)
Target blueprint `blueprint_pm` (Product Manager, 7 competencies). Seeded 21 demo
`approved` templates (`template_key LIKE 'demo_phase2_%'`), ran the full chain,
then deleted every demo row.

**GENERATE** — 14 questions; coverage: 7 total / 6 measurable / **1 unmeasurable**
(`Strategic Planning` → `dom_strategic`, reason surfaced); `question_bank_empty:false`.

**SCORE** — answered 14; overall **76 (L4)**; `measurement: domain_proxy`;
domain_scores: behavioral 75 (L4), cognitive 75 (L4), interpersonal 78.1 (L4).

**PROFILE** — `measured:true`, overall 76 (L4), `history_count:1` (append-only).

**GAP ANALYSIS** — measured; total 7 / measurable 6 / unmeasurable 1;
**coverage 85.7%**; blocking gaps 0. Per-competency met/gap reported;
`Strategic Planning` reported `unmeasurable` (never scored). `getRoleReadiness`
reused (score 100 / band ready). Notes disclose domain-proxy + provisional coverage.

**CLEANUP** — instances/profiles/templates demo rows = **0 / 0 / 0** confirmed.

---

## 4. Deviations from plan
- Route-level e2e proven via the **503 gate test + thin-wrapper review**; the full
  chain was exercised at the **engine layer** against the real DB (flag toggled in
  a throwaway script) because the running workflow keeps the flag OFF by design.
  The routes are pass-through wrappers over the verified engine functions.

## 5. Status
**COMPLETE — STOP for approval.** Flag default OFF; nothing deployed. Awaiting
sign-off before merge/deploy. To enable in dev, add `FF_COMPETENCY_RUNTIME=1` to
the `Backend API` workflow command.

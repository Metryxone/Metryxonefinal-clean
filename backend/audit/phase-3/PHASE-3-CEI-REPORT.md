# Phase 3 — Competency Employability Intelligence Engine (CEI)

**Status:** Built · flag-gated (`competencyEi` / `FF_COMPETENCY_EI`, default OFF) · live-tested in dev · **STOPPED for approval (no deploy).**
**Date:** 2026-06-19

---

## 1. What this is

An **additive, read-only** engine that COMPOSES the Phase 2 competency-runtime
outputs into an **Employability Intelligence** envelope. It does **not** recompute
any score and does **not** fabricate. It is **DISTINCT** from the legacy
profile-attribute Employability Index (`ei-engine.ts` / `ei_*` / `/api/ei/*` /
`EIGauge`) — that engine is untouched.

### Composes (never recomputes) the 5 Phase-2 functions
`getProfile` · `computeRoleReadinessForSubject` · `computeCompetencyGapEngine` ·
`computeCompetencySignalEngine` · `computeBenchmarkDashboard`.

### Output
- **Employability Index (0–100)** — weighted blend re-normalised over the
  **AVAILABLE** component weights only (missing inputs are NOT imputed).
  Component weights (`cei-w1`): readiness 40 · gap 25 · signals 20 · benchmark 15.
- **Developmental band** — Early / Emerging / Developing / Strong / Excellent
  (developmental language ONLY — never hiring/promotion/suitability).
- **Drivers** — per-component raw score + weighted contribution + lift/drag, with
  honest `unavailable + reason` when a component could not be computed.
- **Strengths** — POSITIVE sources only (readiness met, `potential` signals fired,
  top/upper benchmark bands). NEVER from raw risk-signal magnitude.
- **Development priorities** — from the gap engine's prioritised development needs.
- **Risk flags** — fired `risk` signals only.
- **Coverage vs Confidence — two SEPARATE axes.** Domain-proxy measurement caps
  confidence at 60. k-anonymity suppressions / unmeasurable competencies / missing
  components / unevaluable signals each erode confidence with disclosed factors.
- **Language-policy envelope** — allowed/disallowed term lists + disclaimer.

---

## 2. Honesty posture (per project canon)

| Principle | How it is honoured |
|---|---|
| Compose, never recompute | Inputs taken as-is from Phase-2 service fns; no re-scoring. |
| No imputation | Index re-normalised over AVAILABLE component weight only. |
| Strengths positive-only | Sourced from readiness-met / `potential` signals / top-upper benchmark. Risk signals structurally excluded. |
| Coverage ≠ Confidence | Reported as two independent axes; domain-proxy caps confidence. |
| k-anonymity | Benchmark suppressions counted (already applied upstream), never reconstructed. |
| Honest "not measurable" | No competency profile ⇒ `measurable:false`, `index:null`, explanatory note. |
| Never-throws | `Promise.all` + per-input `safe()` wrapper; input errors recorded in `notes[]`, never crash. |
| Append-only | Snapshots written ONLY on explicit POST; GET reads never write. |

---

## 3. Flag-gating (byte-identical OFF)

- `competencyEi: false` in `FEATURE_FLAGS`; helper `isCompetencyEiEnabled()`.
- Route gate is the **FIRST** middleware → flag OFF returns `503 {feature_disabled}`
  **before any DB touch** (no schema, no read, no write).
- **GET paths never write.** `ensureCeiSchema` (the only DDL) runs **exclusively on
  the POST snapshot path**. All GET-backed reads (history / admin-overview /
  validation) use a read-only `to_regclass` existence probe and degrade gracefully
  when the table is absent (empty history, zeroed overview, validation `gap`). This
  was hardened after the architect review flagged GET-path DDL.
- Frontend nav item self-hides when the flag probe (`GET /admin/overview`) is not
  `ok`, keeping the OFF UI byte-identical.

---

## 4. Surface area

**New files**
- `backend/services/competency-employability-engine.ts` — engine (compose / persist / overview / validation).
- `backend/routes/competency-ei.ts` — `/api/competency-ei/*` routes.
- `backend/migrations/20260619_competency_employability_engine.sql` — `cei_employability_snapshots` (append-only); mirrored by lazy `ensureCeiSchema`.
- `frontend/src/components/superadmin/CompetencyEIPanel.tsx` — read-only admin viewer.

**Touched (additive only)**
- `backend/config/feature-flags.ts` — flag + helper.
- `backend/routes.ts` — import + registration (concernsPool).
- `frontend/src/hooks/useAdminDashboardState.tsx` — flag probe + nav item + filter.
- `frontend/src/components/SuperAdminDashboard.tsx` — lazy import + render branch.

**Routes (all `requireAuth` + `requireSuperAdmin`; subject is operator-supplied → IDOR-gated)**
- `GET  /api/competency-ei/intelligence/:subject` — compute (read-only)
- `POST /api/competency-ei/intelligence/:subject/snapshot` — compute + append
- `GET  /api/competency-ei/intelligence/:subject/history` — snapshot history
- `GET  /api/competency-ei/validation/:subject` — chain validation
- `GET  /api/competency-ei/admin/overview` — platform overview

---

## 5. Live test evidence (dev, flag ON)

Auth: `support@metryxone.com` (super-admin). Backend port 8080.

### Subject `demo_subj_swe` (role `role_be_eng`)
- Index **87.3 → Excellent**.
- Drivers all available: readiness 100 (+40) · gap 100 (+25) · signals 62 (+12.4) · benchmark 66 (+9.9).
- Strengths 4 (3 readiness + 1 `potential` signal). Priorities 0. Risks 0.
- Coverage: index 100% · readiness 75% · competency 75% (1 unmeasurable) · benchmark dims 1/5 · suppressed 0.
- **Confidence 60 / Moderate** — capped by `domain_proxy`; factors: 1 unmeasurable (−5), 5 unevaluable signals (−5).

### Subject `demo_subj_pm` (role `role_pm`)
- Index **89.1 → Excellent**.
- Drivers: readiness 100 (+40) · gap 100 (+25) · signals 86 (+17.2) · benchmark 46 (+6.9).
- Strengths 8. Priorities 0. Risks 0.
- Coverage: index 100% · readiness 80% · competency 83.3% (1 unmeasurable) · benchmark dims 1/5.
- **Confidence 60 / Moderate** — domain-proxy cap; factors: 1 unmeasurable (−5), 2 unevaluable signals (−2).

### Not-measurable path (`nonexistent_subject_zzz`)
- `measurable:false`, `index:null`, `confidence.band:None`, honest note:
  *"subject has no measured competency profile — employability intelligence is not measurable."*

### Validation (both real subjects)
- `ok:true`, **5 pass / 0 gap / 0 fail**: inputs_composed · index_computed ·
  strengths_positive_only · coverage_confidence_separated · snapshot_capability.

### Snapshot + history + overview
- POST snapshot appended one immutable row (`87.30 / Excellent`).
- History reflects it; overview aggregates (total 1, distinct 1, avg 87.3, band dist `{Excellent:1}`).

### Build
- `vite build` ✓ (frontend launch gate) — 48.95s, no errors.

---

## 6. Honest limitations (not defects)

- **Domain-proxy ceiling.** Phase-2 scoring is a domain proxy (canonical
  per-competency map not yet populated), so confidence is capped at 60 by design.
  When `onto_competency_question_map` populates, confidence rises with no rework.
- **Thin benchmark cohort in dev.** Only 1/5 benchmark dimensions have an
  available cohort here; the benchmark driver reflects that honestly. Not a bug.
- **Index high because the demo subjects score well.** Readiness/gap = 100 for
  these seeded subjects; the index is a faithful composite of real Phase-2 output,
  not an inflated number.
- **Weights are constant (`cei-w1`).** No ruleset CRUD this phase (out of scope).

---

## 7. Out of scope (explicitly NOT built)

Career Builder, Career Passport, Employer Portal, Learning Intelligence, Future
Readiness — untouched. Legacy `ei-engine.ts` / `EIGauge` / `/api/ei/*` — untouched.

---

## 8. Deploy posture

**STOPPED for approval.** No deploy performed. Flag default OFF ⇒ shipping this
code is byte-identical to current behaviour until the flag is enabled. To deploy
ON, add `FF_COMPETENCY_EI=1` to the production Backend API command (dev workflow
already carries it for testing).

# Phase 5.11 — Hiring Intelligence · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Phase:** 5.11 — Hiring Intelligence
**Status:** BUILT · flag default OFF · STOP for approval before merge/deploy
**Engine version:** `5.11.0`

---

## 1. Scope & deliverables

Three engines that fold the **operator-recorded** Phase 5.10 interview substrate +
`employer_candidates` operator columns into **six developmental indices**:

| Index | Engine | Contributors (weight) |
|---|---|---|
| Hiring Probability | `hiring_intelligence_engine` | panel recommendation 0.40 · interview evaluation 0.35 · latest decision posture 0.25 |
| Hiring Risk | `hiring_intelligence_engine` | panel negativity 0.40 · concern density 0.30 · latest decision risk 0.30 |
| Success Potential | `success_prediction_engine` | interview evaluation 0.45 · match score 0.30 · assessment score 0.25 |
| Retention Potential | `success_prediction_engine` | operator rating 0.50 · evaluation consistency 0.30 · EI signal 0.20 |
| Leadership Potential | `talent_potential_engine` | leadership-tagged criteria 0.70 · leadership mentions in strengths 0.30 |
| Growth Potential | `talent_potential_engine` | growth/learning-tagged criteria 0.60 · improvement trajectory 0.40 |

**Files added (all net-new; no existing file behaviour changed except additive wiring):**
- `backend/services/hiring-intelligence-shared.ts` — types, `composite()` primitive, `resolveEvidence()`, deterministic folds, lexicons, disclaimer.
- `backend/services/hiring-intelligence-engine.ts`, `success-prediction-engine.ts`, `talent-potential-engine.ts`.
- `backend/routes/hiring-intelligence.ts` — base `/api/hiring-intelligence/*` (all GET).
- `backend/config/feature-flags.ts` — flag `hiringIntelligence` + `isHiringIntelligenceEnabled()`.
- `backend/routes.ts` — import + `registerHiringIntelligenceEngineRoutes(...)`.

---

## 2. Contract compliance

| Requirement | Evidence |
|---|---|
| **Additive** | Net-new files; routes.ts gains one import + one register call; feature-flags gains one flag + one helper. No existing handler altered. |
| **Flag-gated, default OFF** | `hiringIntelligence: false`. Flag-OFF → every route 503 **before** auth/DB (verified: `_meta/status`, `/profile`, `/config` all 503 with no session). |
| **Compose-never-recompute** | All six indices are deterministic weighted folds of already-recorded evidence via the single `composite()` primitive; no re-derivation of upstream scores. |
| **GET-never-writes** | Pure read layer: **no new tables, no migration, no POST, no ensure-schema**. Reads use `to_regclass` probes + degrade. Smoke asserts `pg_class` relation count and interview row counts unchanged across all computes. |
| **Super-admin gated** | `[gate, requireAuth, requireSuperAdmin]` on every route. |
| **IDOR strict job-scoping** | `resolveEvidence()` requires candidate `job_id` to strictly equal the path `jobId`; cross-job/unbound (null) candidate → `invalid_input` (smoke-verified). |
| **never-throws** | Typed `EngineResult`; every DB read wrapped + degrades; engines return typed errors, routes map to 404/400/409. |
| **Honesty-first** | Explicit **Coverage axis** (`coverage_pct`); unmeasured ⇒ `value: null`, `band: null` (NEVER 0) — smoke-verified on the empty candidate. `provenance: 'operator_recorded_composite'` + disclaimer on every output. |
| **Language policy** | Disclaimer states outputs are developmental/directional signals, **NOT** predictions and **NOT** an algorithmic hiring/promotion/suitability verdict. Labels name composites of operator evidence, not forecasts. |
| **DO NOT build Phase 6** | Not started. |

---

## 3. Coverage & honesty notes

- **Retention Potential** is the thinnest-evidenced index: the interview substrate carries no
  direct tenure/retention signal, so it composes operator rating + cross-round evaluation
  consistency + EI signal and **reports coverage honestly** — it abstains (null) when none are
  present rather than inventing a value.
- **Leadership / Growth Potential** use lexicon-based criterion tagging. Coverage discloses how
  much of each theme operators actually assessed; with no matching criteria the index abstains.
- **Hiring Probability / Hiring Risk** are intentionally **not complementary** (risk ≠ 100−prob):
  they emphasise different operator evidence (recommendation/eval/posture vs negativity/concern/risk).

---

## 4. Verification

- **Smoke** `backend/scripts/smoke-hiring-intelligence.ts`: **29/29 passed** (self-cleaning @example.com seed).
  Covers: engine OK, exact composite arithmetic (HP=86.3, Success=75.3), coverage=100 with full
  evidence, **null-abstention** with no evidence, IDOR refusal, not_found (job/candidate),
  determinism (identical output across runs), **GET-never-writes** (relation + row-count snapshots),
  flag-OFF HTTP 503.
- **Flag-OFF live check**: `/api/hiring-intelligence/*` → 503 with `{flag:'hiringIntelligence', env:'FF_HIRING_INTELLIGENCE'}`.
- **Frontend build gate**: `cd frontend && npx vite build` — see build log (backend runs on tsx; no backend typecheck gate).

---

## 5. Activation

Set `FF_HIRING_INTELLIGENCE=1` (or `hiringIntelligence: true`) and restart `Backend API`.
Routes:
- `GET /api/hiring-intelligence/_meta/status`
- `GET /api/hiring-intelligence/config`
- `GET /api/hiring-intelligence/job/:jobId/candidate/:candidateId/{hiring,success,potential,profile}`

No data backfill required — the layer composes existing operator evidence on demand. With no
interview/operator evidence recorded for a candidate, all six indices honestly abstain (null).

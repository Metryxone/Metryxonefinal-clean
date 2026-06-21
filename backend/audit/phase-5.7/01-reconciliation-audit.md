# Phase 5.7 — Assessment-Led Hiring · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Engine:** `hiring_assessment_engine` v5.7.0
**Status:** Built, smoke-verified (32/32), launch gate green. **STOP for approval** (no merge/deploy).

---

## 1. Scope & deliverables

| Deliverable | Artifact | State |
|---|---|---|
| Engine service | `backend/services/hiring-assessment-engine.ts` | DONE |
| Table `assessment_invites` | lazy `ensureHiringAssessmentSchema` + `migrations/20260621_hiring_assessment.sql` | DONE |
| Table `candidate_ranking` | same | DONE |
| Routes | `backend/routes/hiring-assessment-engine.ts` (`/api/hiring-assessment-engine`) | DONE |
| Flag | `hiringAssessment` / `FF_HIRING_ASSESSMENT` / `isHiringAssessmentEnabled()` | DONE |
| Wiring | `routes.ts` import + `registerHiringAssessmentEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` | DONE |
| Smoke | `backend/scripts/smoke-hiring-assessment-engine.ts` (32 checks) | DONE |

Lifecycle capabilities required by the task — **Invitations, Completion, Validation, Scoring, Comparison, Ranking** — all present.

---

## 2. Contract reconciliation

| Contract clause | How it is honoured | Evidence |
|---|---|---|
| **Additive** | Net-new engine, two net-new tables; no existing table mutated (`employer_candidates` read-only — employer-portal.ts keeps ownership of its `assessment_sent` flow). | code review |
| **Flag-gated, default OFF** | `hiringAssessment: false`; route `gate` returns 503 **before** auth/DB/DDL. | smoke: HTTP `_meta/status` + `/ranking` → 503 with flag off |
| **compose-never-recompute** | Score is composed: linked `onto_competency_score_runs.overall` → `employer_candidates.assessment_score` → `competency_profile` proxy → unmeasured. No competency math re-implemented. | smoke scoring A/B/C/D |
| **GET-never-writes** | Reads use `to_regclass` probe + degrade. `ensureHiringAssessmentSchema` reached only on POST paths (invite/complete/snapshot). | smoke: pg_class count identical across 4 read paths |
| **Super-admin gated, IDOR-safe** | `[gate, requireAuth, requireSuperAdmin]` on every route; no client-supplied identity trusted as principal. **Job-scoping** enforced by `candidateInJob()` on createInvite **and** scoreAssessment / validateAssessment / compareAssessments — a candidate's evidence can never be scored/validated/compared against the wrong job. | route guards; smoke cross-job reject on all 4 paths |
| **never-throws** | All ops return `EngineResult`; reads degrade to empty/zeroed/unmeasured. | smoke not_found/invalid_input/conflict paths |
| **Honesty: dual axes** | Coverage (evidence exists, %) and Confidence (source trust band) reported separately, never composited. | smoke "every score has dual axes" |
| **Honesty: unmeasured ≠ 0** | Unmeasured candidate → `assessment_score: null`, `confidence: null`, band `Unmeasured`/`None`; ranked last, never scored 0. | smoke score D + ranking last-row null |
| **Developmental-signal language** | Notes state explicitly: "developmental assessment ranking — NOT a hire/reject/suitability verdict." | engine notes; ranking notes |
| **STOP for approval** | No merge, no deploy; suggest only. | — |

---

## 3. Scoring provenance (compose order) & confidence

| Source (priority) | Trust → Confidence band | Meaning |
|---|---|---|
| `competency_score_run` (linked at completion) | 1.0 → **High** | Measured competency run overall. |
| `recorded_score` (`employer_candidates.assessment_score`) | 0.8 → **Moderate**/High | Recorded result; breakdown not re-derived. |
| `competency_profile_proxy` (avg of JSONB levels) | 0.4 → **Low** | Conservative inference, explicitly flagged low-confidence. |
| `unmeasured` | 0 → **None** | No evidence; `null` score (never 0). |

`composite_score` = assessment score + a small (±2) deterministic EI tiebreak nudge, applied **only** when an assessment score exists (never invents a score).

---

## 4. Validation states (dual-source)

`not_invited` · `invited` · `in_progress` · `completed` (+score → valid) · `expired` · `cancelled` · `scored_no_invite` (a recorded `employer_candidates.assessment_score` with no invite row — the employer-portal flow path). Completion of a cancelled/expired invite is refused (`conflict`/409).

---

## 5. Verification

- **Smoke:** `cd backend && FF_HIRING_ASSESSMENT=1 npx tsx scripts/smoke-hiring-assessment-engine.ts` → **35 passed, 0 failed** (incl. cross-job scoping guard on score/validate/compare). Self-cleans all `@example.com` seed rows.
- **Launch gate:** `cd frontend && npx vite build` → exit 0 (pre-existing chunk-size warning only).
- **Flag-OFF byte-identical:** routes 503 before any work; no DDL until a flag-ON POST.

## 6. Honest limitations (not defects)

- The `competency_profile_proxy` is a conservative inference, deliberately Low-confidence; it is **not** a completed assessment and is labelled as such.
- Recorded-score breakdown is not re-derived (compose-never-recompute) — by design.
- `candidate_ranking` is append-only snapshots; no in-place mutation.
- Ranking orders by assessment evidence only; it is a developmental ordering, **never** a hiring recommendation.

## 7. Out of scope (per task)

Phase 6 — NOT built.

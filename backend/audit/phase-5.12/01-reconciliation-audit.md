# Phase 5.12 — Workforce Intelligence Foundation · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Phase:** 5.12 — Workforce Intelligence Foundation
**Status:** Built · flag-gated default OFF · STOP for approval (no merge/deploy)
**Verification:** `backend/scripts/smoke-workforce-intelligence.ts` → **35 passed, 0 failed**

---

## 1. Scope & Contract

A **PURE read/compose** layer over the existing employer substrate
(`employer_jobs`, `employer_candidates`, `employer_competency_roles`), aggregated at the
**EMPLOYER → department / role / team** level. Produces coverage-gated, abstaining,
disclaimer-stamped **developmental** workforce outputs — **never** hiring / promotion /
suitability verdicts.

| Contract clause | How it is honored |
|---|---|
| **Additive** | No edits to existing engines/routes; new files only + 2-line wiring in `routes.ts` + 1 flag. |
| **Flag-gated, default OFF** | `workforceIntelligence` (`config/feature-flags.ts`, default `false`) / env `FF_WORKFORCE_INTELLIGENCE`. Workflow command does **not** set it → OFF in dev. |
| **Compose-never-recompute** | Deterministic folds (means / coverage / weighted composites) of operator-recorded evidence only. No re-scoring of source signals. |
| **GET-never-writes** | All 8 endpoints are `app.get`. **No** new tables, **no** migration, **no** POST. Existence checked via `relExists` (`to_regclass` probe) → degrade when a table is absent. Smoke asserts `pg_class` relation count + employer row counts unchanged across reads. |
| **Super-admin gated** | Every route mounted with `requireAuth, requireSuperAdmin`. |
| **IDOR strict employer-scoping** | Every read scoped by `employer_id`. Cross-employer rows never leak; a candidate's department resolves **only** through that employer's own job map (unbound job → department `null`). Smoke seeds a 2nd employer + a cross-employer candidate and asserts zero leakage. |
| **Never-throws** | All engines return `EngineResult` (`ok`/`err`); every DB read wrapped; route handlers catch → `err`. |
| **Honesty-first** | Coverage axis on every output; unmeasured = `null` (NEVER 0); provenance `operator_recorded_composite`; `DISCLAIMER` on every payload. |

---

## 2. Deliverables

| Deliverable | File |
|---|---|
| `workforce_intelligence_engine` | `backend/services/workforce-intelligence-engine.ts` (Team Competency Profile · Department Readiness · Talent Distribution) |
| `skill_inventory` | `backend/services/skill-inventory-engine.ts` |
| `capability_mapping` | `backend/services/capability-mapping-engine.ts` (Capability Heatmaps) |
| shared util | `backend/services/workforce-intelligence-shared.ts` |
| routes | `backend/routes/workforce-intelligence.ts` |
| flag + wiring | `backend/config/feature-flags.ts`, `backend/routes.ts` |
| smoke | `backend/scripts/smoke-workforce-intelligence.ts` |

---

## 3. API Surface (base `/api/workforce-intelligence`, all GET, super-admin)

| Method · Path | Output |
|---|---|
| `GET /_meta/status` | flag state (503 when OFF) |
| `GET /config` | weights / bands / provenance / version |
| `GET /employer/:employerId/team-competency` | Team Competency Profile (per job/team) |
| `GET /employer/:employerId/department-readiness` | Department Readiness (per department) |
| `GET /employer/:employerId/skill-inventory` | Skill Inventory (supply/demand, unmet demand) |
| `GET /employer/:employerId/capability-heatmap` | Capability Heatmap (department × competency grid + target gap) |
| `GET /employer/:employerId/talent-distribution` | Talent Distribution (readiness bands) |
| `GET /employer/:employerId/overview` | combined — single evidence load |

Literal sub-paths (`_meta/status`, `config`) registered **before** the `/employer/:employerId/*`
param routes (Express literal-before-param canon).

---

## 4. Composite Math (deterministic — verified by smoke)

- **Team Competency Index** = competency `0.4` · assessment `0.3` · ei `0.2` · rating `0.1` (present contributors re-normalized).
  - Smoke team A: competency mean(75,60)=67.5 · assess 70 · ei mean(60,50)=55 · rating 4→80 → **67.0**, coverage 100. ✓
- **Department Readiness Index** = assessment `0.35` · competency `0.30` · match `0.20` · ei `0.15`.
  - Smoke Engineering: `.35*70 + .30*67.5 + .20*80 + .15*55` = **69.0**, coverage 100. ✓
- **Bands**: ≥75 / ≥50 / ≥25 / <25.
- **Coverage** = measured contributors ÷ eligible (e.g. Communication 2/3 measured → 66.7%). ✓
- **Skill Inventory**: supply (candidate `skills`) vs demand (job `skills`); unmet demand = demanded ∧ supply 0 (smoke: `Go`). Supply coverage 2/5=40%, demand coverage 100%. ✓
- **Capability Heatmap**: cell = department × competency mean; gap = mean − target when `proficiency_targets` present, else `null` (smoke: Eng/Communication 70 − target 90 = −20; Problem Solving no target → gap null). ✓

---

## 5. Honesty / Abstention Evidence

- **null-abstention**: `C_EMPTY` (no scores, no competency, no skills) contributes nothing → counted `unmeasured` (NOT 0) in Talent Distribution; absent competency cells → `null`. ✓
- **Unbound department**: `C_UNBOUND` (employer = EMP, job belongs to a different employer) → department `null`, surfaced in the unassigned bucket, never mis-attributed. ✓
- **Coverage ≠ value**: every output carries `coverage_pct` independent of the index value.
- **Provenance**: `operator_recorded_composite` on every payload; `DISCLAIMER` developmental-only language stamped.

---

## 6. Flag-OFF Byte-Identical Proof

- Flag default `false`; workflow command omits `FF_WORKFORCE_INTELLIGENCE`.
- `GET /api/workforce-intelligence/_meta/status` → **HTTP 503** `{"error":"Workforce Intelligence is not enabled"}` (verified live).
- Smoke asserts the HTTP overview route → **503** while OFF. ✓
- No DDL on any path → flag-OFF is schema-identical and behavior-identical to pre-phase.

---

## 7. Residual / Honest Limitations

- **DEV substrate empty** (`employer_jobs`/`candidates`/`organizations` = 0; skills ref = 131 rows). All non-smoke reads honestly return empty/degraded — this is correct, not a defect.
- **Market enrichment** for skill inventory is best-effort against the `skills` reference; unrecognized skills are reported (never dropped, never fabricated).
- **`m5_*` / `p5_*` deliberately NOT coupled** (separate fragile identity space).
- Targets are optional; absence → gap `null`, never a fabricated 0.

---

## 8. Verdict

Phase 5.12 is **built, flag-gated OFF, and verified** (35/35 smoke). Contract fully honored:
additive · pure-read · compose-never-recompute · IDOR employer-scoped · honesty-first.
**STOP for approval before any merge/deploy.** Phase 6 **not** started.

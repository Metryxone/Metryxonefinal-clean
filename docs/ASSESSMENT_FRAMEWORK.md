# MetryxOne — Canonical Assessment Framework (CAPADEX 3.0 · Program 1 · Phase 1.3)

> **Single source of truth** for "what assessments exist, what they measure, and how complete they are."
> Machine-readable registry: `backend/config/assessment-framework.ts`. Measured numbers: the read-only scan
> `backend/scripts/capadex-1.3-assessment-framework-scan.ts` → `backend/audit/capadex-3.0-assessment-framework/scan.json`.
> Detail deliverables: `backend/audit/capadex-3.0-assessment-framework/01..12 + completion-certification.md`.

## What this is
ONE canonical Assessment Framework that maps **every** MetryxOne assessment to eight axes
(persona · lifecycle · journey · AI · reports · dashboards · outcomes · KPIs), grounded in the
FROZEN taxonomy of `backend/audit/capadex-3.0-product-blueprint-final/08_ASSESSMENT_BLUEPRINT.md`.
It is **enhancement-only**: a pure-data registry + read-only composer over the EXISTING engines.
**No new assessment engine, no V2, no duplicate logic, no taxonomy re-decision.**

## Flag (default OFF, byte-identical including schema)
- `assessmentFrameworkCompletion` / `FF_ASSESSMENT_FRAMEWORK_COMPLETION` — getter `isAssessmentFrameworkCompletionEnabled()`.
- OFF → `/api/assessment-framework/*` data routes 503; public-config `assessment_framework_completion:false`;
  zero DDL (the composer only READS — `to_regclass` probes + filesystem checks).

## API (read-only)
- `GET /api/assessment-framework/enabled` — ungated probe `{enabled}`.
- `GET /api/admin/assessment-framework/framework` — the canonical registry.
- `GET /api/admin/assessment-framework/coverage` — per-type evidence verified vs live FS+DB.
- `GET /api/admin/assessment-framework/gaps` — classified gaps.
- `GET /api/admin/assessment-framework/summary` — rollup + enterprise-ready verdict.
- Admin routes: flag-gate 503 → `requireAuth` → `requireSuperAdmin`; never-throws (200-degraded).

## Canonical 10-type taxonomy (FROZEN) + the 19-name spec crosswalk
The spec's 19-name list (Personality / Psychometric / Skill / Practice / Readiness / Career / Leadership /
Wellness, etc.) are **surfaces/sub-types** that map honestly INTO these 10 core types (see deliverable 03):

| # | Type | Status |
|---|---|---|
| 1 | Entry | IMPLEMENTED |
| 2 | Baseline | IMPLEMENTED |
| 3 | Diagnostic | IMPLEMENTED |
| 4 | Behaviour | IMPLEMENTED |
| 5 | Competency | IMPLEMENTED |
| 6 | Learning | PARTIAL (curated no-sandbox MCQ; content breadth uneven) |
| 7 | Performance | PARTIAL (strong employer-side, thin learner-side) |
| 8 | Progress | IMPLEMENTED (systematic re-measurement via the progression-capture hook — reuse) |
| 9 | Exit | IMPLEMENTED (reached-Mastery eligibility + reached_mastery milestone capture — reuse) |
| 10 | Continuous | IMPLEMENTED (interval re-administration via a read-derived freshness signal; no cron) |

## Closing the loop via REUSE (zero DDL — no new engine)
Progress / Exit / Continuous are instrumented by RE-ADMINISTERING the EXISTING assessments through
`backend/services/capadex/progression-outcome-capture.ts` (`captureProgressionOutcome` writes
`stage_completion`/`reached_mastery` milestones into `validation_loop_outcomes`; `getReassessmentSignal`
derives exit/interval eligibility from `REASSESSMENT_FRESHNESS_DAYS=180`). The FROZEN taxonomy STRUCTURE is
unchanged — only per-type **status** moved. What remains is **ADOPTION**, not engineering: the capture path
is gated by the `longitudinalOutcomeCapture` flag, so non-zero adoption accrues only as real subjects
re-administer. Adoption is reported on a SEPARATE axis (never composited with Coverage):
- `GET /api/admin/assessment-framework/lifecycle-closure` — `composeLifecycleClosure` (Progress/Exit/Continuous subject counts, demo excluded; null≠0).
- `GET /api/admin/assessment-framework/outcomes/persona` — `composePersonaOutcomeLinkage` (read-time join, k-anon k_min=30 suppression; `linkage_present:false`≠zero).

## Measured coverage (from scan.json — re-run the scan for live numbers)
- Status: **8 IMPLEMENTED · 2 PARTIAL · 0 MISSING** of 10.
- Evidence verified present: services 23/23 · routes 21/21 · frontend 15/15 · tables 30/30.
- Gaps: **0 Launch-Critical · 0 High · 1 Medium · 3 Low · 1 Future**.
- Adoption (SEPARATE axis): Progress 0 · Exit 0 · Continuous 0 subjects (honest measured-empty; capture flag-gated). Persona⟂outcome linkage readable, 0 linked outcomes yet.

## Enterprise-ready verdict
**STRUCTURAL_COMPLETE_ADOPTION_PENDING.** YES on structure and on the now-closed growth loop — one
canonical, non-duplicative framework with every assessment mapped to all eight axes and verified against the
live repository, with systematic **Progress / Exit / Continuous** re-measurement instrumented by
**re-administering the existing assessments** (no net-new engines, zero DDL — the frozen taxonomy STRUCTURE
is unchanged; only per-type status moved, so 0 MISSING). What remains is **ADOPTION**, not engineering: the
capture path is gated by `longitudinalOutcomeCapture` and real re-administration volume is reported
separately (currently honest 0; `null≠0`). A **Medium content-breadth** residual stands for Learning +
learner-side Performance (human-authored items, never fabricated). **No Launch-Critical assessment gap
exists.** Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption are reported separately and never composited.

## Honesty & boundaries
- **LBI (`lbi_*`) ⟂ Competency (`onto_*`)** are two products by design — NOT a duplicate to merge.
- Overlaps (e.g. competency-runtime ⟂ -v2; spe-scoring ⟂ caf/scoring) are recorded as
  **consolidation candidates** (recommend + human approval), never silently merged (breaking-risk).
- `null ≠ 0`; absent tables/missing types are honest findings, never fabricated.
- Government / Healthcare / Clinical-Psychology verticals are a **non-clinical boundary marker only**
  ("not validated / not for clinical use") — deferred, out of scope.

## Regenerate
```
cd backend
npx tsx scripts/capadex-1.3-assessment-framework-scan.ts        # SSoT scan → scan.json
npx tsx scripts/capadex-1.3-generate-deliverables.ts            # 12 deliverables + certification
```

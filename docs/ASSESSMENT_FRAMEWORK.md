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
| 6 | Learning | PARTIAL |
| 7 | Performance | PARTIAL (strong employer-side, thin learner-side) |
| 8 | Progress | PARTIAL (deltas exist; cadence does not) |
| 9 | Exit | MISSING (instrument by RE-ADMINISTERING existing assessments — not a new engine) |
| 10 | Continuous | MISSING (substrate exists; no scheduler) |

## Measured coverage (from scan.json — re-run the scan for live numbers)
- Status: **5 IMPLEMENTED · 3 PARTIAL · 2 MISSING** of 10.
- Evidence verified present: services 19/19 · routes 17/17 · frontend 15/15 · tables 24/24.
- Gaps: **0 Launch-Critical · 2 High · 3 Medium · 3 Low · 1 Future**.

## Enterprise-ready verdict
**STRUCTURAL_COMPLETE_BACKHALF_PENDING.** YES on structure and front-half depth — one canonical,
non-duplicative framework with every assessment mapped to all eight axes and verified against the live
repository. NOT YET on the closed growth loop: systematic **Progress / Exit / Continuous** re-measurement
is forward work, to be delivered by **re-administering the existing assessments** (no net-new engines),
per the frozen blueprint. **No Launch-Critical assessment gap exists.**
Coverage ⟂ Confidence ⟂ Outcome are reported separately and never composited.

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

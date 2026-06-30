# CAPADEX 3.0 · Phase 1.3 — Technical Debt Resolved & Recommended

> Deliverable 11 · Generated 2026-06-30T11:44:25.490Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9b3be5dcc291, written 2026-06-30T11:44:25.495Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

## Resolved by this phase
- **No single source of truth for "what assessments exist"** → RESOLVED: `config/assessment-framework.ts` is now the ONE canonical, machine-readable registry mapping every assessment to 8 axes + evidence.
- **Taxonomy drift risk (spec 19 vs blueprint 10)** → RESOLVED: `SPEC_19_CROSSWALK` pins the honest mapping in code.
- **Inaccurate table references** → RESOLVED: registry evidence corrected to the REAL live table names (verified by the scan; 30/30 present).
- **Open growth loop (Progress PARTIAL, Exit + Continuous MISSING)** → RESOLVED via REUSE, **not** a new engine: the existing `services/capadex/progression-outcome-capture.ts` hook (`captureProgressionOutcome` / `getReassessmentSignal`, freshness window 180d) instruments stage_completion (Progress), reached_mastery (Exit) and a read-derived interval signal (Continuous). The FROZEN taxonomy STRUCTURE is unchanged — only per-type status moved (now 0 MISSING). What remains is **ADOPTION**, reported separately in deliverable 09 (Adoption⟂Coverage, never composited).
- **Outcomes carried no persona dimension** → RESOLVED via a READ-TIME join (zero DDL): `composePersonaOutcomeLinkage` attributes realized outcomes per persona with k-anon suppression — no persona column added, no schema change.

## Recommended (NOT actioned — breaking-risk / needs approval)
- **competency-runtime.ts ⟂ competency-runtime-v2.ts** — Migration-in-progress; consolidation is breaking-risk → recommend + human approval, do NOT silently merge.
- **spe-scoring-engine ⟂ caf/scoring-engine** — Similar weighted scoring in different dirs; review for shared util — breaking-risk, recommend only.
- **lbi_questions_legacy** — Deprecated in favour of sdi_items / psychometric_question_bank; retire (archive) on approval, never delete blindly.

_Consolidation candidates are recommendations only. Per the enhancement-only / no-breaking-changes contract, they require explicit human approval and a flag-gated migration plan; this phase does not merge or delete anything._

# CAPADEX 3.0 · Phase 1.3 — Technical Debt Resolved & Recommended

> Deliverable 11 · Generated 2026-06-30T11:23:41.795Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9f33dfe717b5, written 2026-06-30T11:23:41.791Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

## Resolved by this phase
- **No single source of truth for "what assessments exist"** → RESOLVED: `config/assessment-framework.ts` is now the ONE canonical, machine-readable registry mapping every assessment to 8 axes + evidence.
- **Taxonomy drift risk (spec 19 vs blueprint 10)** → RESOLVED: `SPEC_19_CROSSWALK` pins the honest mapping in code.
- **Inaccurate table references** → RESOLVED: registry evidence corrected to the REAL live table names (verified by the scan; 24/24 present).

## Recommended (NOT actioned — breaking-risk / needs approval)
- **competency-runtime.ts ⟂ competency-runtime-v2.ts** — Migration-in-progress; consolidation is breaking-risk → recommend + human approval, do NOT silently merge.
- **spe-scoring-engine ⟂ caf/scoring-engine** — Similar weighted scoring in different dirs; review for shared util — breaking-risk, recommend only.
- **lbi_questions_legacy** — Deprecated in favour of sdi_items / psychometric_question_bank; retire (archive) on approval, never delete blindly.

_Consolidation candidates are recommendations only. Per the enhancement-only / no-breaking-changes contract, they require explicit human approval and a flag-gated migration plan; this phase does not merge or delete anything._

---
name: Assessment Science / Psychometrics / Item Intelligence (CAPADEX 3.0 3.6)
description: Durable lessons for the assessmentScience phase — instrument-quality certification layer composing existing psychometric engines; row-shape/deliverable-count traps vs prior phases.
---

# Assessment Science / Psychometrics / Item Intelligence (CAPADEX 3.0 · Program 3 · Phase 3.6)

Flag `assessmentScience` / `FF_ASSESSMENT_SCIENCE` (default OFF, byte-identical incl. schema). READ-ONLY certification + reuse-before-build mechanisms mirroring 3.1–3.5. Detail in `docs/ASSESSMENT_SCIENCE.md`.

## Scope is INSTRUMENT quality, NOT candidate performance
The single most important boundary (ASCI-D2/D3): this layer measures how GOOD the assessment/question is (item analysis · reliability · validity · quality governance · blueprint validation). It NEVER scores or interprets a candidate, and does NOT do norms/standardization/benchmarking/AI-interpretation/recommendations/reports — that is Phase 3.7. Any "candidate performance analytics" framing is out-of-scope; don't add it here.

**Why:** the phase composes psychometric engines that CAN score people; keeping the seam instrument-only is what makes 3.7 buildable on top without a rewrite.

## k_min ABSTAIN is the honesty spine
Every item-level statistic (difficulty/discrimination/distractor, α/split-half/test-retest/κ/SEM, all validity coefficients) ABSTAINS below `ASCI_K_MIN=30` real responses. The mechanisms return an explicit abstained marker, the workbench renders "abstained" — never a fabricated number. null (unreadable) ≠ 0 (empty) in scalar/rows helpers.

## Reuse-before-build: 0 OPEN gaps, 6 RESOLVED
`ASCI_GAPS=[]`; `RESOLVED_ASCI_GAPS`=6 (GAP-ASCI-1..6: 3 High item/reliability/validity, 3 Medium quality-governance/blueprint/apis). The PARTIAL catalog entries (IRT item-information/exposure/DIF, parallel-forms, face/concurrent/predictive validity, pilot-testing, learning-objective coverage) + the `norm_handoff` mapping row are **Phase-3.7 scope boundaries reported in-line, NOT gaps** — closing them needs norms/AI/reports or real adoption volume that is explicitly 3.7.

## Row-shape / count traps vs prior phases (the drift risk)
- **13 deliverables** (a separate `12-adoption-report.md`, cert is `13-phase-3.6-certification.md`) — generator asserts EXACTLY 13 by the `EXPECTED` array. 3.2/3.3 were 14, 3.4 was 12; do NOT copy a count.
- **Summary field is `ready_for_phase_3_7`** (NOT `ready_for_phase_3_6`) — and there is NO `loop_closure` field. The generator/exec-summary read `ready_for_phase_3_7`.
- **Catalog composers are NOT all exported.** The engine exports only `composeDimensions`, `composeMapping`, `composeRepositoryAlignment`, `composeAdoption`, `classifiedGaps`, `composeSummary`. The per-catalog composers (`composeItemMetrics`/`composeQualityChecks`/`composeReliabilityTypes`/`composeValidityTypes`/`composeGovernanceStages`/`composeBlueprintCoverageControls`) are internal to `composeSummary`. The SCAN computes catalog `status_counts` itself with a local `statusCounts()` helper over the registry arrays (`ITEM_ANALYSIS_METRICS` etc.) and embeds the full registry so the generator reads ONLY scan.json.
- **Two catalog row shapes:** item-analysis / quality-checks rows are `{key,label,status,note}` (→ `catTable`); reliability / validity / governance / blueprint rows are `{key,label,status,evidence[]}` (→ `ctrlTable`). Use the right renderer per catalog or the anchor column corrupts.

## public-config dual import-site 500-trap (same as every phase)
`routes/capadex.ts` `/public-config` `assessment_science` must IMPORT `isAssessmentScienceEnabled` (getter import site) AND set the key. Missing the import → the endpoint 500s (no tsc here to catch it).

## OFF behaviour proven
`/enabled` 503-before-auth; `/api/admin/assessment-science/*` 401 via the global `/api/admin` gate (OFF smoke ∈ {401,403,503}). Overlay `asci_*` tables read ABSENT (scan tbl 6/13) until a flag-gated mechanism write runs — HONEST, not a defect. DDL lives only on the mechanism write paths; cert GETs are `to_regclass`/fs probes.

## Validation discipline (this repo)
Validate the two new tsx panels via esbuild parse (EXIT 0), NEVER `vite build`/`pkill` (kills own shell; vite build pathologically slow here). Scan+generator run under the live `Backend API` workflow flag env.

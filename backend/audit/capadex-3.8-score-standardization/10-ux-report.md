# CAPADEX 3.0 · Program 3 · Phase 3.8 — UX Report (dimension 7 · ux)

> Deliverable 10 · Generated 2026-07-01T17:13:35.500Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:470cd868e0df, written 2026-07-01T17:13:35.497Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The standardization UX — interactive formula builder, rule composer, live preview, interactive graphs, bell-curve & distribution visualization, drill-down, export, progressive disclosure, responsive and accessible surfaces.

**UX criteria:** 12 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (12 total).

| Capability | Status | Anchors |
|---|---|---|
| **Interactive formula builder** (`interactive_formula_builder`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Rule composer** (`rule_composer`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Live preview** (`live_preview`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Interactive graphs** (`interactive_graphs`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Bell-curve visualization** (`bell_curve`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Distribution charts** (`distribution_charts`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Heat maps** (`heat_maps`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx, routes/score-standardization.ts |
| **Drill down** (`drill_down`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Export** (`export`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Progressive disclosure** (`progressive_disclosure`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Responsive design** (`responsive`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Accessibility** (`accessibility`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |

### UX (`ux`) — SUPPORTED
_Interactive formula/rule builders, live preview, interactive graphs (bell-curve + distribution charts), drill-down, export, progressive disclosure, responsive + accessible surfaces. Per-cohort band heat maps are wired (computeHeatmap → POST /compute/heatmap + a workbench heat-map card)._

- **Services**: —
- **Routes**: —
- **Frontend**: components/standardization/StandardizationWorkbench.tsx
- **Tables**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 1/1 · tbl 0/0


_Per-cohort band heat maps are WIRED: `computeHeatmap` (reusing `classifyBand` + an optional custom band set) via POST /compute/heatmap + a workbench heat-map card. Non-finite percentiles are ignored; never fabricated._

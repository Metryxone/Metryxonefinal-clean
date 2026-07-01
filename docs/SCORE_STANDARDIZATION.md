# Enterprise Score Standardization & Interpretation Framework (CAPADEX 3.0 · Program 3 · Phase 3.8)

> Single source of truth for the Score Standardization layer. Detail lives here + `.agents/memory/score-standardization.md`; the Feature Map pointer in `replit.md` is a navigation stub only.

## What it is
The **ONE canonical Enterprise Score Standardization & Interpretation Framework** — a single certified **STANDARDIZATION & INTERPRETATION** layer that COMPOSES the existing pure psychometric substrate (`psychometric-standardization`: `zFromValue`/`zToPercentile`/`zToT`/`zToStanine`/`zToSten`/`zToDeviationScore`) under one registry (`config/score-standardization.ts`) plus an additive `astd_*` overlay. **No duplicate standardization / scoring engine, no V2, no breaking change.** Mirrors Phases 3.3–3.7.

## Scope (freeze)
STANDARDIZATION & INTERPRETATION ONLY — it turns a **SCORED result + norm reference** into standard scores, performance bands and interpretation-rule verdicts and:
- **NEVER** re-scores, re-validates, or builds a norm (those are 3.5 Scoring / 3.6 Science).
- Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are **OUT OF SCOPE** (later phases).

## The ten INDEPENDENT dimensions (reported SEPARATELY — never composited)
`standard_scores · formula_engine · interpretation_rules · governance · super_admin · frontend · ux · apis · testing · documentation`

All ten `axis_dimensions` are SUPPORTED. PARTIAL entries live inside the catalogs and are **data-availability / follow-on boundaries**, NOT gaps:

| Catalog | Result (scan) |
|---|---|
| Standard score types | 12 SUPPORTED |
| Performance bands | 9 (1 PARTIAL — custom org bands) |
| Interpretation rule types | 9 SUPPORTED |
| Config scopes | 8 (5 PARTIAL — industry/org/country/institution/custom) |
| Formula capabilities | 6 SUPPORTED |
| Governance states | 10 SUPPORTED |
| Validation checks | 7 (1 PARTIAL — regression) |
| Super-admin surfaces | 8 (1 PARTIAL — org_overrides) |
| Frontend surfaces | 10 (1 PARTIAL — comparison screen) |
| UX criteria | 12 (1 PARTIAL — heat maps) |

## Formula engine — STRUCTURED AST, no eval
Composite formulas are a **structured AST** evaluated by a whitelisted interpreter (`evaluateFormula`) — **never `eval` / `new Function`**. This is a hard requirement of the phase.

## Standardization honesty
Norm-referenced standardization **ABSTAINS below k_min=30 real members** — never fabricated. Coverage⟂Confidence⟂Adoption are never composited; null≠0.

## Mechanisms (reuse-before-build — pure, no DB unless `persist=true`)
`services/score-standardization-mechanisms.ts` — pure `computeStandardScoreSet` / `evaluateFormula` / `classifyBand` / `evaluateInterpretationRule` reuse the existing `psychometric-standardization` functions + the additive `astd_*` overlay ensure-schema/save. The overlay ensure-schema/save on the **flag-gated write paths are the ONLY DDL sites**.

## Overlay tables (7 `astd_*`)
`astd_formulas` · `astd_standard_scores` · `astd_bands` · `astd_interpretation_rules` · `astd_configs` · `astd_governance_log` · `astd_validations`. Read ABSENT until the flag-gated mechanism POSTs run — HONEST OFF, not a defect.

## Routes
`routes/score-standardization.ts` — `/api/score-standardization/enabled` flag probe (503-before-auth OFF) + super-admin cert GETs + pure mechanism POSTs + overlay `*/save` writes (the ONLY DDL sites). `/api/admin/*` returns 401 OFF via the GLOBAL gate — OFF smoke ∈ {401, 403, 503}.

## Frontend
`components/superadmin/ScoreStandardizationPanel.tsx` + interactive `components/standardization/StandardizationWorkbench.tsx` (conditional-spread nav in `SuperAdminDashboard.tsx`, probes `/enabled`, hidden OFF; ABSTAIN/empty/loading/error states).

## public-config
`routes/capadex.ts` `/public-config` exposes `score_standardization` — this is a **SEPARATE import site** that must `import { isScoreStandardizationEnabled }` or the endpoint 500s.

## SSoT scan + deliverables
- Scan `scripts/capadex-3.8-score-standardization-scan.ts` → `audit/capadex-3.8-score-standardization/scan.json` (computes catalog status_counts itself + embeds full registry).
- Generator `scripts/capadex-3.8-generate-deliverables.ts` reads **ONLY** scan.json → **exactly 15 deliverables** (01→15; 15 = Phase-3.8 Certification; asserts count===15).

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — all ten dimensions SUPPORTED; repo-align svc 11/11 · rt 6/6 · fe 8/8 · tbl 0/9 (the `astd_*` overlay tables read ABSENT until the flag-gated POSTs run, HONEST not a defect); `gaps` = 0 OPEN + 6 RESOLVED via reuse; `ready_for_certification: YES`.

**Engineering closure ⟂ Adoption:** the mechanism EXISTS for every gap but real standardized / interpreted / governed VOLUME across the overlay is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap. STOP for approval (flag stays OFF, no merge/enable/deploy).

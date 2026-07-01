# Enterprise Benchmark Intelligence Platform (CAPADEX 3.0 · Program 3 · Phase 3.9)

> Single source of truth for the Benchmark Intelligence layer. Detail lives here + `.agents/memory/benchmark-intelligence.md`; the Feature Map pointer in `replit.md` is a navigation stub only.

## What it is
The **ONE canonical Enterprise Benchmark Intelligence Platform** — a single certified **BENCHMARK & COMPARISON** layer that COMPOSES the existing benchmark substrate (`peer-benchmark` / `m5-org-benchmark` / `mei-benchmark-engine` / `adaptive-benchmark` / `benchmark-engine` / `comparative-intelligence`) under one registry (`config/benchmark-intelligence.ts`) plus the 3.8 structured-AST formula engine for the composite benchmark index, over an additive `abmk_*` overlay. **No duplicate benchmark / comparison engine, no V2, no breaking change.** Mirrors Phases 3.3–3.8. The reused substrate is composed by **EXISTENCE — never invoked at compose time**.

## Scope (freeze)
BENCHMARK & COMPARISON ONLY — it turns a **STANDARDIZED score (3.8) + a reference group** into cohort-relative z-scores, percentiles, deltas, quartiles, trends and multi-group comparisons and:
- **NEVER** re-scores, re-standardizes, re-validates the instrument, or builds a norm (those are 3.5 Scoring / 3.6 Science / 3.8 Standardization).
- AI-interpretation / recommendation / report / dashboard / candidate-analytics are **OUT OF SCOPE** (later phases).

## The nine INDEPENDENT dimensions (reported SEPARATELY — never composited)
`benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation`

All nine `axis_dimensions` are SUPPORTED. PARTIAL entries live inside the catalogs and are **data-availability / follow-on boundaries**, NOT gaps:

| Catalog | Result (scan) |
|---|---|
| Benchmark types | 17 (7 SUPPORTED · 10 PARTIAL) |
| Comparison dimensions | 11 (7 SUPPORTED · 4 PARTIAL) |
| Time modes | 8 (1 SUPPORTED · 7 PARTIAL) |
| Benchmark config scopes | 7 SUPPORTED |
| Governance states | 8 SUPPORTED |
| Super-admin surfaces | 7 SUPPORTED |
| Frontend surfaces | 10 SUPPORTED |
| UX criteria | 8 SUPPORTED |
| API groups | 5 SUPPORTED |
| Traceability links | 5 SUPPORTED |

## Composite benchmark index — STRUCTURED AST, no eval
The composite benchmark index reuses the 3.8 **structured AST** formula engine, evaluated by a whitelisted interpreter — **never `eval` / `new Function`**. This is a hard requirement of the phase.

## Benchmarking honesty
Benchmarking **ABSTAINS below k_min=30 real members** in the reference group — never fabricated. A result is either suppressed (`suppressed:true`) or abstained (`abstained:true`) with an explicit `reason`. Coverage⟂Confidence⟂Adoption are never composited; null≠0.

## Mechanisms (reuse-before-build — pure, no DB unless `persist=true`)
`services/benchmark-intelligence-mechanisms.ts` — pure `computeReferenceStats` / `computeBenchmark` (z / percentile / delta / quartile) / `computePercentileRank` / `computeGroupComparison` / `computeTrend` / `computeDistribution` / `evaluateBenchmarkFormula` (reuses 3.8 AST) + scoped `resolveConfig` (most-specific-wins) + the additive `abmk_*` overlay ensure-schema/save. The overlay ensure-schema/save on the **flag-gated write paths are the ONLY DDL sites**.

## Overlay tables (6 `abmk_*`)
`abmk_groups` · `abmk_configs` · `abmk_results` · `abmk_governance_log` · `abmk_audit_log` · `abmk_saved_views`. Read ABSENT until the flag-gated mechanism POSTs run — HONEST OFF, not a defect (repo-align tallies 9 table references across dimensions, all ABSENT OFF).

## Routes
`routes/benchmark-intelligence.ts` — `/api/benchmark-intelligence/enabled` flag probe (503-before-auth OFF) + super-admin cert GETs (`/summary`, `/dimensions`, `/gaps`, `/adoption`, `/configs`) + pure mechanism POSTs (`/compute/*`, `/configs/resolve`) + overlay `*/save` writes (the ONLY DDL sites). `/api/admin/*` returns 401 OFF via the GLOBAL gate — OFF smoke ∈ {401, 403, 503}.

## Frontend
`components/superadmin/BenchmarkIntelligencePanel.tsx` + interactive `components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx` (conditional-spread nav in `SuperAdminDashboard.tsx`, probes `/enabled`, hidden OFF; ABSTAIN/empty/loading/error states).

## public-config
`routes/capadex.ts` `/public-config` exposes `benchmark_intelligence` — this is a **SEPARATE import site** that must `import { isBenchmarkIntelligenceEnabled }` or the endpoint 500s.

## SSoT scan + deliverables
- Scan `scripts/capadex-3.9-benchmark-intelligence-scan.ts` → `audit/capadex-3.9-benchmark-intelligence/scan.json` (computes catalog status_counts itself + embeds full registry).
- Generator `scripts/capadex-3.9-generate-deliverables.ts` reads **ONLY** scan.json → **exactly 16 deliverables** (01→16; 16 = Phase-3.9 Certification; asserts count===16; 3.9 adds `13-benchmark-substrate-reuse.md` vs 3.8's 15).

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — all nine dimensions SUPPORTED; repo-align svc 17/17 · rt 5/5 · fe 7/7 · tbl 0/9 (the `abmk_*` overlay tables read ABSENT until the flag-gated POSTs run, HONEST not a defect); `gaps` = 3 OPEN (0 Launch-Critical · 2 Medium · 1 Future) + 10 RESOLVED via reuse; `ready_for_certification: YES`.

**Engineering closure ⟂ Adoption:** the mechanism EXISTS for every closed gap but real benchmarked / governed / audited / saved-view VOLUME across the overlay is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap. STOP for approval (flag stays OFF, no merge/enable/deploy).

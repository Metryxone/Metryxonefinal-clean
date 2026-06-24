# D12 — Global Readiness (NEW domain) · 100X Re-certification

**Verdict: PARTIAL (strong).** **Score: 85/100** (was 75/100 — region content is no longer pure universal-inheritance; each priority region now carries REAL, citable, region-native market and benchmark data, so US/EU/ME/APAC differ meaningfully from India's default and from each other).

## Live evidence
- `global_region_content` table: **EXISTS** (`to_regclass` resolves).
- Universal-inheritance overlay: **2,060** rows (provenance `phase8_global_competency`), **515 per priority region** across `ME`, `EU`, `US`, `APAC` — the deployable-set declaration (role definitions, the competency genome, structural benchmark cohorts, global market signals).
- **Region-native market & benchmark overlay** (provenance `region_native_market_v1`): **17** rows — `US` 6, `ME` 4, `EU` 4, `APAC` 3 (demand + benchmark surfaces).
- **Region-native market signals**: **13** rows in `wos_market_signals` with non-global geography, **5 distinct authoritative sources**, **8/13 role-mapped** to real `onto_roles`, **avg confidence 0.758** (weighted to government statistics).
- **Region-native benchmark cohorts**: **4** (`cohort_type='region'`) — one per priority region, each backed by real wage/workforce/demand statistics in `filters` with full provenance.
- **Per-region differentiation is now real** (engine `resolveRegionContent` / `computeRegionCoverage`):
  | Region | total effective content | demand_intelligence | benchmarks |
  |--------|------------------------:|--------------------:|-----------:|
  | IN (default) | 524 | 81 | 15 |
  | US | 521 | 86 | 11 |
  | EU | 519 | 84 | 11 |
  | ME | 519 | 84 | 11 |
  | APAC | 518 | 83 | 11 |

  Before this task all four non-default regions were identical (515 / demand 81 / benchmarks 10). They now differ from each other, driven by region-native rows.

## Real data embedded (every figure citable, with provenance)
All figures live in `wos_market_signals.context` and `bench_cohorts.filters` with `source_name`, `source_url`, `as_of`, exact `metric_unit`, and a `confidence` reflecting source authority. **Figures are NOT cross-comparable** — each carries its own unit; we never imply comparability.

- **US — U.S. Bureau of Labor Statistics, Employment Projections 2024–34 (OOH), OEWS May 2024 wages** (confidence 0.9):
  Software Developers **+15%** (median **$133,080**, SOC 15-1252) → `role_be_eng`/`role_sr_be_eng`; Computer & Information Systems Managers **+15%** (median **$171,200**, SOC 11-3021) → `role_eng_manager`; Financial Analysts **+6%** (SOC 13-2051) → `role_credit_analyst`; all-occupations baseline **+4%** (macro).
- **EU — Eurostat EU-LFS (ICT specialists 2024) + CEDEFOP Skills Forecast 2035** (confidence 0.88 / 0.75):
  ICT specialists in employment **+4.8% YoY** (10M+ specialists, 5.0% of EU employment) → `role_be_eng`/`role_sr_be_eng`; total EU employment **+0.4% p.a. to 2035** (macro).
- **ME (GCC) — ServiceNow via Gulf Business + ManpowerGroup Employment Outlook 2025** (confidence 0.55–0.6):
  UAE technology-role demand **+54% to 2030** (~91,000 additional tech specialists) → `role_be_eng`; UAE Net Employment Outlook **+48%**, Saudi Arabia **+35%** (macro).
- **APAC — ManpowerGroup Talent Shortage 2025** (confidence 0.55–0.6):
  **77%** of employers report difficulty filling roles (talent scarcity, not growth); **IT & Data the hardest skill area to fill (32%)** → `role_be_eng`.

## Flag-OFF / default-region safety
- The default region (IN) is **byte-identical** to prior behaviour: region-native rows use a non-global geography (`US/EU/ME/APAC`) and `cohort_type='region'`, and the engine's per-surface `baseFilter` excludes exactly those from India's base read/count. Verified: IN base `benchmarks=15`, `demand=81` — unchanged.
- Non-default regions read **only** their region-scoped overlay, so region-native rows surface for their own region and nowhere else.
- Fully **reversible**: all region-native rows carry provenance `region_native_market_v1`; re-running the seed deletes that provenance first (idempotent), and rollback = delete-by-provenance + `DROP COLUMN bench_cohorts.geography`.

## Honest gaps (why 85, not higher)
- **No region-native competency-benchmark *statistics*.** The region cohorts carry real wages / workforce shares / demand figures, but **no per-region competency scores** exist in open data, so `bench_cohort_statistics` is intentionally **not** written for them. Inventing competency distributions per region would be fabrication.
- **Coverage is uneven by source availability, and that is honest.** The US has the richest public occupational data (5 native signals, role-level wages); EU is workforce-share + macro; ME/APAC rely on consultancy/survey figures at lower confidence. We embed what is real per region rather than padding weak regions to look symmetric.
- **Role crosswalk is partial.** Only roles with a clean source occupation are mapped (8/13 signals); the rest are region-level (`role_id` NULL) rather than force-mapped. `role_pm` has no clean BLS/Eurostat occupation, so it gets no fabricated region figure.
- **`readiness_models` remains empty for non-default regions** (`career_readiness_history` is subject-specific user snapshots, not regionalizable reference content) — each non-default region is 4/5 surfaces, the honest finding.

## Why not PASS
A full PASS would require region-native competency statistics and broader role-level coverage in EU/ME/APAC at government-grade confidence — genuine content acquisition that does not exist in open data today and would be fabrication if invented. The structural gap is closed, the dimension now carries real differentiated content with provenance, and the default region stays byte-identical, which is why this is a strong PARTIAL at 85.

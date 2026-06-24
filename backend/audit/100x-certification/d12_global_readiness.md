# D12 — Global Readiness (NEW domain) · 100X Re-certification

**Verdict: PARTIAL (strong).** **Score: 87/100** (was 85/100 — region-native coverage broadened: every one of the 5 platform `onto_roles` now carries at least one region-native market signal, and EU and APAC are lifted off consultancy-only with official government statistics — Eurostat EU-LFS and Singapore MOM).

## Live evidence
- `global_region_content` table: **EXISTS** (`to_regclass` resolves).
- Universal-inheritance overlay: **2,060** rows (provenance `phase8_global_competency`), **515 per priority region** across `ME`, `EU`, `US`, `APAC` — the deployable-set declaration (role definitions, the competency genome, structural benchmark cohorts, global market signals).
- **Region-native market & benchmark overlay** (provenance `region_native_market_v1`): **22** rows — `US` 8, `EU` 5, `ME` 5, `APAC` 4 (demand + benchmark surfaces).
- **Region-native market signals**: **18** rows in `wos_market_signals` with non-global geography, **6 distinct authoritative sources**, **11/18 role-mapped** to real `onto_roles` (**all 5 platform roles now covered**: `role_be_eng`, `role_sr_be_eng`, `role_eng_manager`, `role_pm`, `role_credit_analyst`), **avg confidence 0.763** (weighted to government statistics).
- **Region-native benchmark cohorts**: **4** (`cohort_type='region'`) — one per priority region, each backed by real wage/workforce/demand statistics in `filters` with full provenance.
- **Per-region differentiation is real** (engine `resolveRegionContent` / `computeRegionCoverage`); the table below counts the universal-inheritance base (515 / demand 80 / benchmarks 10 per region) **plus** the region-native overlay:
  | Region | total effective content | demand_intelligence | benchmarks |
  |--------|------------------------:|--------------------:|-----------:|
  | IN (default) | 524 | 81 | 15 |
  | US | 523 | 87 | 11 |
  | EU | 520 | 84 | 11 |
  | ME | 520 | 84 | 11 |
  | APAC | 519 | 83 | 11 |

  Before any region-native work all four non-default regions were identical (515 / demand 80 / benchmarks 10). They now differ from each other and from India, driven by region-native rows.

## Real data embedded (every figure citable, with provenance)
All figures live in `wos_market_signals.context` and `bench_cohorts.filters` with `source_name`, `source_url`, `as_of`, exact `metric_unit`, and a `confidence` reflecting source authority. **Figures are NOT cross-comparable** — each carries its own unit; we never imply comparability.

- **US — U.S. Bureau of Labor Statistics, Employment Projections 2024–34 (OOH), OEWS May 2024 wages** (confidence 0.7–0.9):
  Software Developers **+15%** (median **$133,080**, SOC 15-1252) → `role_be_eng`/`role_sr_be_eng`; Computer & Information Systems Managers **+15%** (median **$171,200**, SOC 11-3021) → `role_eng_manager`; Financial Analysts **+6%** (SOC 13-2051) → `role_credit_analyst`; Project Management Specialists **+6%** (median **$100,750**, SOC 13-1082) → `role_pm` (**proxy** crosswalk, confidence discounted to **0.7** — product ≠ project management); Market Research Analysts **+7%** (median **$76,950**, SOC 13-1161, macro/region-level, no platform role); all-occupations baseline **+3%** (macro, corrected from a prior 4%).
- **EU — Eurostat EU-LFS (ICT specialists 2024) + CEDEFOP Skills Forecast 2035** (confidence 0.75–0.88):
  ICT specialists in employment **+4.8% YoY** (10M+ specialists, 5.0% of EU employment) → `role_be_eng`/`role_sr_be_eng`; the same Eurostat "ICT specialists" definition includes ICT service managers (ISCO-08 group 133), so **+4.8% YoY** is also carried as a **subset** proxy for `role_eng_manager` (confidence 0.88); total EU employment **+0.4% p.a. to 2035** (macro).
- **ME (GCC) — ServiceNow via Gulf Business + ManpowerGroup Employment Outlook 2025** (confidence 0.55–0.6):
  UAE technology-role demand **+54% to 2030** (~91,000 additional tech specialists) → `role_be_eng`, and the same aggregate carried as a **subset** for `role_sr_be_eng` (no seniority split in source, confidence 0.55); UAE Net Employment Outlook **+48%**, Saudi Arabia **+35%** (macro).
- **APAC — Singapore Ministry of Manpower Labour Market Report 4Q 2024 (official) + ManpowerGroup Talent Shortage 2025** (confidence 0.6–0.85):
  Singapore **total employment grew +44,500 in 2024** (official national statistics, overall unemployment 1.9% Dec 2024, confidence 0.85) — lifts APAC off consultancy-only; **77%** of employers report difficulty filling roles (talent scarcity, not growth); **IT & Data the hardest skill area to fill (32%)** → `role_be_eng`.

## Flag-OFF / default-region safety
- The default region (IN) is **byte-identical** to prior behaviour: region-native rows use a non-global geography (`US/EU/ME/APAC`) and `cohort_type='region'`, and the engine's per-surface `baseFilter` excludes exactly those from India's base read/count. Verified: IN base `benchmarks=15`, `demand=81` — unchanged.
- Non-default regions read **only** their region-scoped overlay, so region-native rows surface for their own region and nowhere else.
- Fully **reversible**: all region-native rows carry provenance `region_native_market_v1`; re-running the seed deletes that provenance first (idempotent), and rollback = delete-by-provenance + `DROP COLUMN bench_cohorts.geography`.

## Honest gaps (why 87, not higher)
- **No region-native competency-benchmark *statistics*.** The region cohorts carry real wages / workforce shares / demand figures, but **no per-region competency scores** exist in open data, so `bench_cohort_statistics` is intentionally **not** written for them. Inventing competency distributions per region would be fabrication.
- **Coverage is uneven by source availability, and that is honest.** The US has the richest public occupational data (role-level projections + wages across 5 occupations); EU adds Eurostat ICT-specialist workforce growth (official) + CEDEFOP macro; APAC now has an official Singapore MOM labour figure alongside the consultancy survey; ME remains consultancy/survey-only — no GCC government publishes occupation-level projections in accessible open data, so its figures stay at lower confidence (0.55–0.6). We embed what is real per region rather than padding weak regions to look symmetric.
- **Role crosswalk: all 5 platform roles are now mapped, but some via documented proxies.** 11/18 signals carry a `role_id`; the 7 `role_id`-NULL rows are genuine region-level / macro business-occupation signals (e.g. Market Research Analysts, all-occupations baselines, talent-shortage shares), not force-maps. Two mappings are transparent proxies rather than exact occupations and carry a `crosswalk_quality` tag + discounted confidence: `role_pm` → BLS Project Management Specialists (`proxy`, 0.7, product ≠ project management), and `role_eng_manager` → Eurostat ICT specialists (`subset`, 0.88, ICT service managers are a defined sub-population). `role_sr_be_eng` reuses its base-role aggregate as a `subset` where the source has no seniority split. No figure is invented for a role that has no defensible source occupation.
- **`readiness_models` remains empty for non-default regions** (`career_readiness_history` is subject-specific user snapshots, not regionalizable reference content) — each non-default region is 4/5 surfaces, the honest finding.

## Why not PASS
A full PASS would require region-native competency statistics and government-grade role-level coverage across **all** regions (notably ME) — genuine content acquisition that does not exist in open data today and would be fabrication if invented. The structural gap is closed, every platform role now carries region-native demand evidence, two regions were lifted off consultancy-only with official statistics, all proxy crosswalks are tagged and confidence-discounted, and the default region stays byte-identical — which is why this is a strong PARTIAL at 87.

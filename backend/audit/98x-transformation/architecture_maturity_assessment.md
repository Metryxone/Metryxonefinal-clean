# Architecture Maturity Assessment

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 1
**Date:** 2026-06-23 · Read-only. Evidence = live shared-DB counts + route/service trace + 2 explorer passes. No code/schema/data changed. **No rebuild recommended.**

## How to read maturity here (dual-axis, per platform honesty canon)
Every area is scored on **two independent axes** — they are never composited into a single flattering number:
- **Structural maturity** = is the architecture/engine built? (code + schema present)
- **Activation maturity** = is it wired end-to-end *and seeded/exercised with real data*?

> **The headline finding:** MetryxOne is **structurally ~78% enterprise-grade but activation ~28%**. Almost every "missing" enterprise capability is *already built and pilot-seeded* — Market Intelligence (`m3_*`, ~40 tables), Enterprise Workforce OS (`m5_*`, ~60 tables), Future Readiness (`frp_role_evolution` **5,250 rows**), Career Graph + learning paths (`cg_*`), analytics history (`p4_competency_history` **8,970**, `p4_benchmark_trends` **26,910**), predictive engines + TIG calibration (Brier/ECE/isotonic regression). **The path to 98% is activation, connectivity, and validation loops — not construction.**

---

## Per-area assessment

### 1. Competency Framework
- **Current state:** Curated genome — `onto_competencies` **419**, `onto_competency_type_map` **419** (5 types), `onto_proficiency_levels`/`ref_proficiency_levels` **5/5**, `onto_role_weights` **44**. Canonical & scored against.
- **Enterprise target:** Single authoritative genome, version-controlled, with item-level psychometric backing and one un-ambiguous namespace.
- **Gap:** 3 name-bridged namespaces (curated `onto_*` vs O*NET `ont_*` 160 vs legacy `competency_*` 0); no published reliability/validity stats per competency.
- **Maturity:** Structural **88%** · Activation **70%** → Target **98%**.
- **Actions:** Declare `onto_*` canonical in data (provenance stamp); attach reliability metadata; retire/seal empty legacy shells.
- **Dependencies:** none (foundation). **Business impact:** trust/defensibility. **Technical impact:** low risk (additive).

### 2. Micro Competency Framework
- **Current state:** `onto_competency_hierarchy` **277**, `onto_indicators` **66**. Curated micro-layer present.
- **Target:** Every competency decomposed to assessable micro-indicators with item mapping.
- **Gap:** Indicator coverage thin (66 indicators vs 419 competencies); micro→question mapping (`onto_question_competency_mapping` **23**) shallow.
- **Maturity:** Structural **75%** · Activation **45%** → **98%**.
- **Actions:** Expand indicators to full competency coverage; map items to micro-level. **Deps:** §1. **Business:** granular diagnostics. **Technical:** content effort, low risk.

### 3. Role Architecture
- **Current state:** Curated `onto_roles` **5** + `onto_role_competency_profiles` **14**; O*NET `ont_roles` **1,040** + `map_role_competency` **52,362**; crosswalk `map_ont_onto_role` **5**. Career-Graph `cg_roles` **200**.
- **Target:** Thousands of roles consumable for scoring/estimation via a populated crosswalk.
- **Gap (critical):** only **5 of 1,040** O*NET roles bridged → 99.5% of role breadth unreachable for scoring; 6+ legacy role namespaces.
- **Maturity:** Structural **80%** · Activation **35%** → **98%**.
- **Actions:** Scale the crosswalk (title+competency-name matching already in `role-crosswalk.ts`/`onet-onto-weight-bridge.ts`); consolidate role namespaces by provenance. **Deps:** §1. **Business:** coverage = TAM. **Technical:** the single highest-leverage activation.

### 4. Assessment Engine
- **Current state:** `onto_assessment_blueprints` **6** + `onto_question_blueprints` **7**, `competency_question_templates` **74**, runtime `onto_assessment_instances` **45** / `_responses` **66**.
- **Target:** Blueprint-driven, role-level-aware, psychometrically calibrated item bank at scale.
- **Gap:** runtime uses a domain-proxy shortcut (7-code bank → 5 onto-domains) instead of per-question blueprint; item bank shallow (74); no IRT/item statistics.
- **Maturity:** Structural **70%** · Activation **45%** → **98%**.
- **Actions:** Enforce blueprint→difficulty; grow item bank; add item analysis. **Deps:** §1,§2. **Business:** assessment validity. **Technical:** medium.

### 5. Scoring Engine
- **Current state:** Dual ledger — `onto_competency_score_runs` **2** (rich) + `onto_competency_profiles` **38** (runtime). Reverse-scoring/polarity handled.
- **Target:** Normed, calibrated scores with confidence intervals and benchmark positioning.
- **Gap:** no norming/calibration applied to competency scores; two ledgers must be unioned for any count.
- **Maturity:** Structural **78%** · Activation **55%** → **98%**.
- **Actions:** Add norm tables + confidence; document/union the dual ledger. **Deps:** §4, §6 (benchmarks). **Business:** comparability. **Technical:** medium.

### 6. Employability Index
- **Current state:** Single 8-dim formula authority (`employabilityEngine.ts`); consumes scoring cleanly; no table sprawl.
- **Target:** Outcome-validated index (predicts real placement/progression).
- **Gap:** no outcome validation loop (no realized outcomes captured to test the index).
- **Maturity:** Structural **85%** · Activation **60%** → **98%**.
- **Actions:** Capture outcomes; validate index vs outcomes. **Deps:** §11 outcome capture. **Business:** the defensible IP. **Technical:** low (formula stable).

### 7. Career Builder
- **Current state:** Rich graph — `cg_roles` **200**, `cg_role_edges` **500**, `cg_skill_requirements` **711**, `cg_tracks` **15**, `cg_track_waypoints` **76**, `cg_learning_resources` **76**, `cg_promotion_rules` **40**, `cg_lateral_rules` **25**. **All `cg_user_*` surfaces = 0** (role-readiness/skill-gaps/recs/career-path/learning-recs).
- **Target:** Competency-driven, per-user career paths/gaps/learning plans generated from assessment.
- **Gap:** content exists but **no user activation**; competency→career write-path one-way/unfired.
- **Maturity:** Structural **82%** · Activation **20%** → **98%**.
- **Actions:** Wire assessment → `cg_user_*` generation; persist per-user. **Deps:** §5. **Business:** candidate retention. **Technical:** wiring, not building.

### 8. Career Passport
- **Current state:** `cp_*` 12 tables; `syncPassportFromPlatform` bridges capadex/frp/competency; visibility-gated.
- **Target:** Verifiable, employer-consumable credential linked to assessed competency + outcomes.
- **Gap:** no employer-side verification/consumption; outcome linkage absent.
- **Maturity:** Structural **75%** · Activation **40%** → **98%**.
- **Actions:** Employer verification read; outcome stamps. **Deps:** §9. **Business:** network effect. **Technical:** medium.

### 9. Employer Intelligence
- **Current state:** Full stack — hiring intelligence (`employer-hiring-intelligence.ts`), TIG (`tig_*`), M5. **`employer_jobs`/`employer_candidates`/`tig_*`/`lbi_scores`/`cra_scores` all = 0.** Hiring path is **disjoint from competency scoring** (uses LBI/CRA/heuristic).
- **Target:** Employers operate entirely on competency intelligence (suggest→weight→assess→match→hire).
- **Gap (largest):** zero data + the competency score never reaches the hiring view.
- **Maturity:** Structural **75%** · Activation **5%** → **98%**.
- **Actions:** Bridge `onto_competency_profiles`→`employer_candidates`; suggest from `map_role_competency`; unify assessment generation. **Deps:** §3,§5. **Business:** the enterprise revenue engine. **Technical:** wiring (see Section 4 deliverable).

### 10. Workforce Intelligence
- **Current state:** `m5_*` ~60 tables. Pilot-seeded: `m5_organizational_capabilities` **5**, `m5_succession_candidates` **5**, `m5_enterprise_capability_indices` **5**, `m5_organizational_skill_gaps` **5**, `m5_executive_recommendations` **3**. Forecast/readiness tables (`m5_workforce_readiness_scores`, `m5_future_workforce_forecasts`, `m5_leadership_pipeline_simulations`) = **0**. EIOS pillars (P3/P7 9-box/P8 succession) implemented.
- **Target:** Org-wide capability heatmaps, succession, workforce forecasting on real tenant data.
- **Gap:** no real tenant workforce data (`tenant_capability_profiles` 0); forecasts unfired.
- **Maturity:** Structural **80%** · Activation **10%** → **98%**.
- **Actions:** Onboard ≥1 real enterprise tenant; fire workforce engines on real org data. **Deps:** §9, multi-tenant. **Business:** enterprise upsell. **Technical:** activation + data.

### 11. Market Intelligence
- **Current state:** `m3_*` ~40 tables, pilot-seeded — `m3_market_roles` **5**, `m3_industry_demand` **4**, `m3_skill_demand` **10**, `m3_salary_trends` **5**, `m3_future_skill_forecasts` **4**, `m3_role_market_scores` **5**, `m3_geography_demand` **5**, `m3_transition_probability` **4**, `m3_emerging_role/skill_candidates` **3/3**, `m3_evidence_sources` **9**. Future Readiness rich: `frp_role_evolution` **5,250**, `frp_ai_impact` **41**, `frp_automation_risk` **25**, `frp_industry_forecast` **10**, `frp_skill_library` **41**.
- **Target:** Live market demand/salary/emerging-skill signals feeding role DNA + career paths.
- **Gap:** market tables seeded at demo scale (5 rows); no live ingestion pipeline; `frp_user_*` = 0.
- **Maturity:** Structural **80%** · Activation **15%** → **98%**.
- **Actions:** Stand up a real market-data ingestion (the schema + `m3_source_registry`/`m3_evidence_sources` already model it). **Deps:** §3. **Business:** differentiation. **Technical:** data pipeline, not schema.

---

## Maturity summary

| # | Area | Structural | Activation | Target | Biggest lever |
|---|---|---|---|---|---|
| 1 | Competency Framework | 88% | 70% | 98% | namespace provenance + reliability stats |
| 2 | Micro Competency | 75% | 45% | 98% | indicator + item coverage |
| 3 | Role Architecture | 80% | 35% | 98% | **crosswalk scale (5→1040)** |
| 4 | Assessment Engine | 70% | 45% | 98% | blueprint enforcement + item bank |
| 5 | Scoring Engine | 78% | 55% | 98% | norming/calibration |
| 6 | Employability Index | 85% | 60% | 98% | outcome validation |
| 7 | Career Builder | 82% | 20% | 98% | **wire assessment→cg_user_*** |
| 8 | Career Passport | 75% | 40% | 98% | employer verification + outcomes |
| 9 | Employer Intelligence | 75% | 5% | 98% | **scoring→hiring bridge + data** |
| 10 | Workforce Intelligence | 80% | 10% | 98% | real tenant onboarding |
| 11 | Market Intelligence | 80% | 15% | 98% | live data ingestion |
| **Platform** | | **~78%** | **~28%** | **98%** | **activation, not construction** |

**Conclusion:** the architecture is enterprise-shaped already. Reaching 98% means **closing 6 systemic gaps** (crosswalk scale · competency→career wiring · scoring→employer bridge · validation/outcome loops · norming/calibration · real-tenant/market data) — all additive evolution, **no rebuild**.

---

## Evidence ledger
- **All row counts** (`onto_competencies` 419, `onto_competency_hierarchy` 277, `onto_roles` 5, `ont_roles` 1,040, `map_role_competency` 52,362, `map_ont_onto_role` 5, `onto_competency_score_runs` 2, `onto_competency_profiles` 38, `onto_role_weights` 44, `cg_*` content + `cg_user_*` 0, `m3_*`/`m5_*` pilot, `frp_role_evolution` 5,250, `frp_skill_library` 41, `p4_competency_history` 8,970, `p4_benchmark_trends` 26,910, `bench_competency_benchmarks` 195, `ti_industry_benchmarks` 66, `ti_role_benchmarks` 60, `ont_benchmarks` 0, `tenants` 4, `employer_*`/`lbi_scores`/`cra_scores`/`tig_*` 0) → **live shared-DB `count(*)`, 2026-06-23 session.**
- **Engine/formula facts** (8-dim `employabilityEngine.ts`, dual scoring ledger, domain-proxy shortcut, TIG calibration) → route/service trace + explorer passes (this session) + prior validation `backend/audit/competency-onet-validation/*.md` (committed `da07dd93`).
- **Maturity percentages** are reasoned estimates derived from the two *measured* axes (Structural = code/schema present; Activation = data present + wired), **not** a measured metric — read them as directional.

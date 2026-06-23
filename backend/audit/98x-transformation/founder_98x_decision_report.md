# Founder 98% Decision Report

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 9
**Date:** 2026-06-23 · Read-only. Direct answers only. Evidence = Sections 1–7 + live DB counts.

---

## 1. What prevents MetryxOne from reaching 98%+ maturity today?

**Not missing architecture — missing activation, connectivity, and validation loops.** The platform is **structurally ~78% but activation ~28%**. Six concrete blockers:

1. **The crosswalk chokepoint** — only **5 of 1,040** O*NET roles are bridged to curated roles (`map_ont_onto_role` 5), so 52,362 requirement edges and 99.5% of role breadth never reach scoring.
2. **Competency score never reaches hiring** — `onto_competency_profiles` (38) is disjoint from the employer path (`lbi_scores`/`cra_scores`/`tig_*`, all 0). Employers can't hire on the competency the platform measures.
3. **Career Builder has no per-user activation** — all `cg_user_*` = 0 despite a fully-seeded content graph (200 roles, 711 skill requirements, 76 learning resources).
4. **No realized outcomes** — there is no placement/hire/promotion ground truth, so every predictive/calibration engine (Brier/ECE/isotonic — built and correct) is permanently at cold-start.
5. **No competency↔skill bridge** — competency gaps can't translate into skill/learning recommendations.
6. **International layer absent** — engines are locale/currency-agnostic; no data residency.

---

## 2. Top 20 highest-impact improvements

| # | Improvement | Why it matters |
|---|---|---|
| 1 | Scale O*NET→curated crosswalk (5→1,040) | unlocks 52,362 edges + role breadth |
| 2 | Bridge competency score → employer candidate profile | makes hiring competency-based |
| 3 | Competency↔skill crosswalk | enables gaps→learning |
| 4 | Outcome-event capture | turns every prediction validatable |
| 5 | Assessment-completion automation → `cg_user_*` | activates Career Builder per user |
| 6 | Employer data-backed competency suggestion | replaces hardcoded heuristic |
| 7 | Unify employer assessment via `onto_assessment_blueprints` | one scored assessment, not two |
| 8 | Activate TIG calibration with outcomes | calibrated hiring probabilities |
| 9 | Apply norming to competency scores | comparability/defensibility |
| 10 | Materialize Competency Intelligence read-layer | one source of truth for consumers |
| 11 | Batch-inherit + normalize role weights | role DNA at scale |
| 12 | Materialize + cache Role DNA | 5k–10k role scale |
| 13 | Activate trajectories from `p4_competency_history` (8,970) | progression intelligence |
| 14 | Country/currency dimension | global-scale keystone |
| 15 | Tenant isolation test suite | safe multi-tenant scale |
| 16 | Extend k-anonymity to EIOS heatmaps | compliance for gov/enterprise |
| 17 | Onboard real tenants per type | moves M5/EIOS off 5-row pilots |
| 18 | Live market-data ingestion (`m3_*`) | real demand/salary signals |
| 19 | Fuse market + `frp_role_evolution` (5,250) into DNA | differentiation |
| 20 | Declare `onto_*` canonical + seal legacy shells | removes namespace ambiguity |

---

## 3. Top 10 improvements for employers
1. Competency score → candidate profile bridge. 2. Data-backed competency suggestion from `map_role_competency`. 3. Unified (scored) assessment generation. 4. Governed competency-weighting on jobs. 5. Calibrated hiring-success probability (activate TIG). 6. Role match from role DNA. 7. Real role binding (job→`onto_roles` via crosswalk). 8. Benchmark positioning of candidates (`ti_role_benchmarks` 60). 9. Career Passport verification read. 10. Outcome capture so recommendations improve over time.

## 4. Top 10 improvements for candidates
1. Per-user career paths/gaps/plans (activate `cg_user_*`). 2. Competency→skill→learning recommendations. 3. Progression/trajectory view from history. 4. Norming so scores are comparable. 5. Role-fit across the full role library (crosswalk). 6. Development plans at candidate scope. 7. Future-readiness signals (`frp_role_evolution`) surfaced. 8. Peer benchmarking with k-anonymity (already enforced — surface it). 9. Career Passport that employers can verify. 10. Market-aware path suggestions (`m3_*`).

## 5. Top 10 improvements for scalability
1. Crosswalk fill (breadth). 2. Materialize + cache Role DNA. 3. Batch ingestion (fix N+1 seeding). 4. Weight normalization across sources. 5. Country/currency/region dimension. 6. Tenant isolation verification. 7. k-anonymity on department heatmaps. 8. Live market ingestion pipeline. 9. Materialized Competency Intelligence layer. 10. Real multi-tenant onboarding.

---

## 6. What should NEVER be changed
- **The curated competency genome** (`onto_*`, 419) as the gold standard — keep it canonical; O*NET stays *reference/fallback*, never a replacement.
- **The Employability Index 8-dim formula authority** (single source in `employabilityEngine.ts`) — extend with validation, don't refactor the math.
- **The dual-axis honesty model** (Coverage vs Confidence; Structural vs Activation; k-anonymity k_min=30; never fabricate) — this *is* the defensible IP.
- **The additive/flag-gated discipline** (flag-off = byte-identical) — every evolution must preserve it.
- **The 3-layer Role DNA composition** (curated → O*NET-derived → contextual) — correct as designed.
- **The separation of Competency Assessment (professional, `onto_*`) and LBI (student, `lbi_*`)** — two products by design; do not bridge.

## 7. What should be expanded aggressively
- **The crosswalk** (5→1,040) — the single highest-leverage expansion.
- **Outcome capture + calibration** — the validity moat.
- **Per-user activation** of Career Builder and Employer surfaces (the value is built, unfired).
- **Real-tenant onboarding** to convert 5-row enterprise pilots into real M5/EIOS intelligence.
- **Market + future-readiness signal fusion** into Role DNA (unique differentiator; `frp_role_evolution` 5,250 already exists).

## 8. If I were Chief Product Architect — the roadmap
**Thesis:** MetryxOne has already *built* an enterprise competency intelligence ecosystem; it has not yet *activated* it. Do not build anything new for two quarters — **connect, seed, and validate.**

- **Q1 (0–90d): Make the spine real.** Fill the crosswalk; bridge competency score → employer + career-builder; build the competency↔skill crosswalk; ship outcome capture; activate calibration. *(activation ~28% → ~80%)*
- **Q2 (90–180d): Prove it and scale it.** Norming + back-testing; materialize Role DNA; country/currency + isolation verification; onboard one real tenant per type; live market ingestion + signal fusion. *(→ ~95–98%)*
- **Guardrails:** every change additive + flag-gated; never fabricate (empty stays honest); keep `onto_*` canonical, O*NET reference, EI formula and the two-product boundary intact.

**The 98% platform is not a rebuild away — it is a connectivity-and-validation program away.**

---

## Evidence ledger
- Every count cited (crosswalk `map_ont_onto_role` 5 / `ont_roles` 1,040 / `map_role_competency` 52,362; `onto_competency_profiles` 38; `cg_*` content + `cg_user_*` 0; `employer_*`/`lbi_scores`/`cra_scores`/`tig_*` 0; `frp_role_evolution` 5,250; `p4_competency_history` 8,970; `p4_benchmark_trends` 26,910; `bench_competency_benchmarks` 195; `ti_role_benchmarks` 60; `tenants` 4) → live shared-DB `count(*)`, 2026-06-23 session.
- Per-claim sourcing is itemized in the Evidence ledgers of Sections 1–7; this report synthesizes them and introduces no new measured facts.
- Top-N rankings and the "Chief Product Architect" roadmap are author prioritizations derived from the measured evidence, not measured metrics.

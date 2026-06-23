# Role DNA Scalability Assessment

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 3
**Date:** 2026-06-23 · Read-only. Evidence = live counts + explorer trace of Role DNA services.

## What Role DNA is (today)
A role's "DNA" = its weighted competency vector + expected levels + criticality, composed at request time from three layers (explorer-confirmed):
1. **Curated weights** — `onto_role_weights` (**44**) / `onto_dna_profiles` / `onto_role_competency_profiles` (**14**, adds `criticality`). Human-authored "gold standard".
2. **O*NET-derived fallback** — `onet-onto-weight-bridge.ts` maps `ont_roles` (1,040) → curated via fuzzy title + `COMPETENCY_SYNONYMS`, stamped `source='onet_derived'`, using `map_role_competency` (**52,362**).
3. **Contextual overlays** — `role-dna-runtime-engine.ts` applies industry/seniority/org-maturity modifiers (`role_contextual_weights`).

Snapshot tables `role_dna_master_profiles` / `role_dna_profiles_v2` exist but are **0 rows** — DNA is computed on-demand, not materialized.

## Can it scale? — verdict per target

| Target | Verdict | Evidence / bottleneck |
|---|---|---|
| **10 industries** | ✅ reachable now | `ont_industries` 206 supplies taxonomy; only 2 curated. Crosswalk + bridge already support it. |
| **100 industries** | 🟡 reachable with crosswalk fill | bounded by `map_ont_onto_role` (**5**) — must scale the bridge, not the schema. |
| **500 industries** | 🟡 needs ingestion + caching | O*NET breadth supports it; runtime fuzzy-match cost + N+1 seeding become real. |
| **1000 industries** | 🟡 needs pipeline hardening | schema fine; needs batch ingestion, normalized weights, materialized DNA. |
| **5,000 roles** | 🟡 architecturally yes | `ont_roles` already 1,040; `frp_role_evolution` 5,250 proves the row scale is handled elsewhere. Bridge + materialization required. |
| **10,000 roles** | 🟡 yes with materialization | on-demand fuzzy resolution won't hold at 10k; must persist `role_dna_master_profiles` + cache (`role-dna-cache-engine` exists). |

**Bottom line:** the *design* scales to 10k roles / 1000 industries. The *current activation* is pilot (5 curated roles, 5-row crosswalk). **No rebuild needed — the scaling levers are crosswalk-fill, materialization, and a batch ingestion pass.**

---

## Sub-architecture assessment

| Layer | Backing (rows) | State | Scale readiness |
|---|---|---|---|
| **Industry Architecture** | `onto_industries` 2 / `ont_industries` 206 | curated thin, reference rich | seed curated from reference → ready |
| **Function Architecture** | `onto_functions` 3 / `ont_functions` 30 | thin | same |
| **Department Architecture** | `onto_subfunctions` 4 / `ont_departments` 43 | thin + **naming conflict** | unify label, seed |
| **Role Family Architecture** | `onto_role_families` 4 / `ont_role_families` 31 | thin | seed from reference |
| **Role Architecture** | `onto_roles` 5 / `ont_roles` 1,040 | **chokepoint at crosswalk 5** | **scale the bridge** |
| **Role Competency Profiles** | `onto_role_competency_profiles` 14 / `map_role_competency` 52,362 | curated pilot; O*NET rich | inherit from O*NET where curated absent |
| **Role Weight Models** | `onto_role_weights` 44 | real, small | normalize 0..1 vs 0..100 (honesty contract); batch-fill |
| **Role Readiness Models** | `onto_role_readiness` 1 / `cg_user_role_readiness` 0 / Role-Readiness-V2 engine | engine present, near-zero data | wire assessment → readiness rows |
| **Role Intelligence Models** | `m3_role_market_scores` 5, `m3_role_trends` 5, `frp_role_evolution` 5,250 | market/future signals exist | cross-feed into DNA (unused today) |
| **Role Benchmark Models** | `ti_role_benchmarks` 60, `bench_competency_benchmarks` 195, `p4_benchmark_trends` 26,910 | **substantial benchmark data exists** | wire benchmarks → role DNA positioning |

---

## The 4 scalability bottlenecks (explorer-confirmed, all fixable additively)
1. **Crosswalk fill** — `map_ont_onto_role` 5/1,040. Without it, O*NET breadth never reaches DNA. *(highest leverage)*
2. **Materialization** — DNA computed on-demand via fuzzy matching; persist `role_dna_master_profiles` + use the existing `role-dna-cache-engine` for 5k–10k scale.
3. **N+1 seeding** — `persistSeedResult` inserts per-competency; batch it for large role sets.
4. **Weight normalization across sources** — manual (0..100) + derived (0..1) + contextual must reconcile without silent rescaling (the "honesty contract" in `role-competency-profile.ts`).

## What NOT to do
- Do **not** rebuild Role DNA or replace the curated weights with O*NET — keep curated as gold standard, O*NET as fallback (the existing 3-layer composition is correct).
- Do **not** materialize DNA before the crosswalk + normalization are settled, or you'll snapshot inconsistent weights.

## Recommendation
Scale in this order: **(1) fill crosswalk → (2) batch-inherit O*NET-derived weights for unbridged roles → (3) normalize weights → (4) materialize + cache DNA → (5) cross-feed market (`m3_*`/`frp_*`) + benchmark (`ti_*`/`p4_*`) signals into Role Intelligence/Benchmark layers.** Each step is additive and independently shippable.

---

## Evidence ledger
- **Row counts** (`onto_role_weights` 44, `onto_role_competency_profiles` 14, `onto_roles` 5, `ont_roles` 1,040, `map_role_competency` 52,362, `map_ont_onto_role` 5, `role_dna_master_profiles`/`role_dna_profiles_v2` 0, `onto_role_readiness` 1, `frp_role_evolution` 5,250, `ti_role_benchmarks` 60, `bench_competency_benchmarks` 195, `p4_benchmark_trends` 26,910, industry/function/family/department curated-vs-reference counts) → live shared-DB `count(*)`, 2026-06-23 session.
- **3-layer composition, fuzzy-match resolution, N+1 seeding, weight-normalization honesty contract, cache engine** → explorer trace of `competency-ontology.ts` / `role-dna-runtime-engine.ts` / `onet-onto-weight-bridge.ts` / `role-crosswalk.ts` / `functional-competency-seeding-engine.ts` (this session) + memory `.agents/memory/onto-vs-ont-namespace-bridge.md`, `role-crosswalk.md`.
- **Scale verdicts** (10→1000 industries / 5k→10k roles) are reasoned engineering judgments from the above, not load-test measurements.

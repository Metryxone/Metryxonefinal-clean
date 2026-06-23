# MetryxOne 98% Transformation Roadmap

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 8
**Date:** 2026-06-23 · Read-only plan. Every action is **additive evolution of existing architecture — no rebuild, no replacement.** Evidence for each action lives in Sections 1–7.

## Operating principle
The platform is **structurally ~78% / activation ~28%**. This roadmap moves *activation* to ~98% by **connecting, seeding, and closing validation loops** on systems that already exist. Sequencing respects dependencies: foundation (crosswalk, namespace) → connectivity (scoring→consumers) → validation (outcomes) → scale (tenant/international).

Legend — **Must** (blocks 98%) · **Should** (materially lifts) · **Good** (polish). Maturity = activation %. Effort/Impact/Risk = L/M/H.

---

## 30-Day Actions — *Foundation & highest-leverage connectivity*

| # | Action | Class | Cur→Tgt | Effort | Impact | Risk | Priority |
|---|---|---|---|---|---|---|---|
| 1 | **Scale the O*NET→curated crosswalk** (`map_ont_onto_role` 5→1,040 via existing `role-crosswalk.ts`/bridge) | Must | 35→80% | M | H | M | **P0** |
| 2 | **Scoring→Employer bridge** — populate `employer_candidates.competency_profile` from `onto_competency_profiles` | Must | 5→50% | M | H | M | **P0** |
| 3 | **Declare `onto_*` canonical in data** (provenance stamp; seal empty legacy `competency_*` shells) | Must | 70→90% | L | M | L | P0 |
| 4 | **Build competency↔skill crosswalk** (`onto_competencies`→`cg_skill_requirements`) | Must | 0→70% | M | H | L | **P0** |
| 5 | **Outcome-event capture table** (assessment→placement/hire/reject/promotion) | Must | 0→40% | M | H | L | **P0** |
| 6 | Unify department/subfunction naming across namespaces | Should | 50→90% | L | M | L | P1 |

## 60-Day Actions — *Activate the user & employer surfaces*

| # | Action | Class | Cur→Tgt | Effort | Impact | Risk | Priority |
|---|---|---|---|---|---|---|---|
| 7 | **Assessment-completion automation** → write `cg_user_role_readiness/skill_gaps/recommendations/career_path/learning_recs` | Must | 20→80% | M | H | M | **P0** |
| 8 | **Employer data-backed competency suggestion** (`analyzeRole` seeds from `map_role_competency`/`onto_role_weights`) | Must | 30→80% | M | H | M | P0 |
| 9 | **Unify employer assessment generation** through `onto_assessment_blueprints` | Must | 45→85% | M | H | M | P0 |
| 10 | **Batch-inherit O*NET-derived role weights** for unbridged roles + normalize weights | Should | 35→75% | M | H | M | P1 |
| 11 | **Apply norming** to competency scores (use `bench_competency_benchmarks` 195 / `p4_benchmark_trends` 26,910) | Should | 55→85% | M | M | L | P1 |
| 12 | Materialize the implicit **Competency Intelligence read-layer** (composing view all consumers read) | Should | 40→80% | M | H | M | P1 |

## 90-Day Actions — *Validation loops & scale prep*

| # | Action | Class | Cur→Tgt | Effort | Impact | Risk | Priority |
|---|---|---|---|---|---|---|---|
| 13 | **Activate TIG calibration** (feed captured outcomes → Brier/ECE/isotonic; reach ≥30→`calibrated`) | Must | 10→70% | M | H | M | P0 |
| 14 | **Materialize + cache Role DNA** (`role_dna_master_profiles` via `role-dna-cache-engine`) for 5k–10k roles | Should | 0→70% | M | M | M | P1 |
| 15 | **Activate trajectories** from `p4_competency_history` (8,970) → `p4_growth_trajectories` | Should | 0→70% | M | M | L | P1 |
| 16 | **Add country/currency dimension** to tenant + cost engines (international keystone) | Must | 0→50% | H | H | M | P0 |
| 17 | **Verify tenant isolation** with an explicit isolation test suite | Must | 50→90% | M | H | M | P0 |
| 18 | **Extend k-anonymity** to EIOS department heatmaps | Must | 0→90% | L | M | L | P1 |
| 19 | Back-test harness (predicted vs realized) once outcomes exist | Should | 0→60% | M | M | L | P2 |

## 180-Day Actions — *Real data depth, market fusion, enterprise activation*

| # | Action | Class | Cur→Tgt | Effort | Impact | Risk | Priority |
|---|---|---|---|---|---|---|---|
| 20 | **Onboard ≥1 real tenant per type** (university/enterprise/staffing) → fire M5/EIOS on real org data | Must | 10→70% | H | H | M | P0 |
| 21 | **Live market-data ingestion** (`m3_source_registry`/`m3_evidence_sources` already model it) → scale `m3_*` past 5-row pilot | Should | 15→70% | H | H | M | P1 |
| 22 | **Fuse market + future-readiness signals** (`m3_*`, `frp_role_evolution` 5,250) into Role DNA + forecasting | Should | 15→75% | M | H | M | P1 |
| 23 | **Employer verification of Career Passport** + outcome stamps | Should | 40→80% | M | M | L | P2 |
| 24 | **Expand item bank + add item statistics/IRT** for assessment validity | Should | 45→80% | H | M | M | P2 |
| 25 | Data-residency policy for government/regulated tenants | Good | 0→60% | M | M | M | P2 |
| 26 | Expand micro-indicators to full competency coverage | Good | 45→80% | H | M | L | P3 |

---

## Sequenced critical path to 98%
**Crosswalk (1) → Scoring bridges (2,4,7,8) → Outcome capture (5) → Calibration (13) → International + isolation (16,17) → Real-tenant + market activation (20,21).** Everything else lifts maturity but isn't on the blocking path.

## Maturity trajectory (activation axis)
| Milestone | Platform activation |
|---|---|
| Today | ~28% |
| +30d (foundation wired) | ~45% |
| +60d (user/employer surfaces live) | ~62% |
| +90d (validation loops + intl keystone) | ~80% |
| +180d (real data depth + market fusion) | **~95–98%** |

**No action in this roadmap requires rebuilding, replacing O*NET, the competency framework, the Employability Index, or Career Builder.** Every item is additive and independently shippable.

---

## Evidence ledger
- All counts referenced in actions (crosswalk 5, `onto_competency_profiles` 38, `cg_user_*` 0, `map_role_competency` 52,362, `bench_competency_benchmarks` 195, `p4_benchmark_trends` 26,910, `p4_competency_history` 8,970, `frp_role_evolution` 5,250, `tig_*` 0, `tenants` 4) → live shared-DB `count(*)`, 2026-06-23 session (full per-claim sourcing in Sections 1–7 ledgers).
- **Cur→Tgt maturity, Effort, Impact, Risk, Priority** are reasoned planning estimates derived from the measured Structural/Activation axes — directional, not measured metrics.
- Named services/engines (`role-crosswalk.ts`, `onet-onto-weight-bridge.ts`, `role-dna-cache-engine`, Role-Readiness-V2, `postCompletionHooks`, TIG calibration) are confirmed present via explorer trace this session; verify exact signatures before implementing each action.

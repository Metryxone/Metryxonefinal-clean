# Predictive & Validity Intelligence Assessment

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 6
**Date:** 2026-06-23 · Read-only. Evidence = live counts + explorer trace of predictive/calibration/benchmark services.

## Headline
**The prediction *math* is built and honest; the validation *loops* are empty.** `predictive-intelligence.ts` computes real predictions on-demand, and TIG ships a genuine calibration stack (Brier score, Expected Calibration Error, isotonic/PAV regression, beta-binomial smoothing). What's missing for enterprise-grade validity is **realized outcomes to calibrate against** (`tig_*` = 0) and **populated benchmark norms** (`ont_benchmarks` = 0, though other benchmark tables hold real data).

---

## Capability per prediction type

| Prediction | Existing capability | Missing data / models / signals / loops |
|---|---|---|
| **Competency Benchmarking** | `bench_competency_benchmarks` **195**, `p4_benchmark_trends` **26,910**, `peer-benchmark.ts` (percentile via normal CDF, k_min=30) | wire benchmarks into competency score output; `ont_benchmarks` empty (use the populated tables instead) |
| **Role Benchmarking** | `ti_role_benchmarks` **60**, `m3_role_market_scores` **5** | scale beyond pilot; bind to role DNA |
| **Industry Benchmarking** | `ti_industry_benchmarks` **66**, `m3_industry_demand` **4** | seed depth; live ingestion |
| **Success Prediction** | engine present (composite of csi/lbi/progress) | **no realized outcomes** to define/validate "success"; no outcome table |
| **Readiness Prediction** | Employability-readiness composite + Role-Readiness-V2 | validation vs outcomes; norming |
| **Career Success Prediction** | trajectory detection (`detectTrajectory`, growth-vs-burnout delta) + `p4_competency_history` 8,970 | outcome labels (placements/progression); `p4_growth_trajectories` 0 |
| **Hiring Success Prediction** | TIG calibration (Brier/ECE/isotonic/beta-binomial), status ladder cold_start→provisional(<30)→calibrated(≥30) | **zero hire/reject outcomes** (`tig_*` 0) → stays on identity map (honest cold_start) |
| **Skill Gap Prediction** | gap engine + `cg_skill_requirements` 711 + `m3_skill_demand` 10 / `m3_future_skill_forecasts` 4 | competency↔skill crosswalk; user-level firing (`cg_user_skill_gaps` 0) |
| **Competency Forecasting** | `last+slope` trend forecast (forecast-intelligence) + `m3_competency_market_scores` 7 / `frp_role_evolution` 5,250 | ≥2-session longitudinal data per user at scale; market-signal fusion |

---

## The five requested lenses

### Existing capability (real, evidence-backed)
- **On-demand predictions**: dropout risk, burnout probability, employability readiness, leadership emergence, trajectory (growth vs burnout) — `predictive-intelligence.ts`.
- **Calibration mathematics**: Brier, ECE, isotonic regression (PAV), beta-binomial smoothing — `employer-tig.ts` (+ test).
- **Peer benchmarking with k-anonymity**: percentile estimation, k_min=30 with cohort-widening then hard redaction (`suppression_reason="insufficient_cohort"`), opt-out via `benchmark_exclusions`.
- **Substantial historical/benchmark corpora**: `p4_competency_history` 8,970, `p4_benchmark_trends` 26,910, `bench_competency_benchmarks` 195, `ti_*` benchmarks.

### Missing data
- **Realized outcomes** — the platform captures no placement/promotion/hire/reject ground truth, so every predictive model is *uncalibrated by definition*. **This is the single biggest validity gap.**
- **User-level longitudinal volume** — forecasting needs ≥2 sessions per user at scale (`p4_growth_trajectories` 0).

### Missing models
- **Norming/standardization** of competency scores (no norm tables applied).
- **Competency↔skill mapping** model (blocks skill-gap prediction from competency).
- **IRT / item statistics** for assessment validity.

### Missing signals
- **Market fusion**: `m3_*` / `frp_role_evolution` (5,250) signals exist but don't feed predictions.
- **Outcome signals** (the feedback edge).

### Missing validation loops
- **Calibration is armed but starved** — no outcomes → models honestly stay at `cold_start`/identity map (they do NOT fabricate, which is correct).
- **No back-test harness** comparing predicted vs realized at the platform level.
- **k-anonymity coverage gap**: enforced for peer-benchmarking but not explicitly for EIOS department heatmaps (small-department leakage risk).

---

## Recommendation (additive, no rebuild)
1. **Capture realized outcomes** (a single outcome-event table: assessment→placement/promotion/hire/reject). This one addition turns every existing predictive/calibration engine from cold-start to validatable. *(highest leverage for validity)*
2. **Apply norming** to competency scores using the populated benchmark corpora (`bench_competency_benchmarks`, `p4_benchmark_trends`).
3. **Fuse market signals** (`m3_*`, `frp_role_evolution`) into forecasting.
4. **Extend k-anonymity** to EIOS department heatmaps.
5. **Stand up a back-test harness** that runs the existing Brier/ECE loop once outcomes exist.

The predictive architecture is enterprise-shaped; it needs the **feedback edge (outcomes)** and **norms**, not new models.

---

## Evidence ledger
- **Benchmark/history counts** (`bench_competency_benchmarks` 195, `p4_benchmark_trends` 26,910, `p4_competency_history` 8,970, `p4_growth_trajectories` 0, `ti_industry_benchmarks` 66, `ti_role_benchmarks` 60, `ont_benchmarks` 0, `m3_skill_demand` 10, `m3_future_skill_forecasts` 4, `m3_competency_market_scores` 7, `frp_role_evolution` 5,250, `tig_*` 0) → live shared-DB `count(*)`, 2026-06-23 session.
- **Predictive engine + calibration internals** (dropout/burnout/employability/leadership/trajectory on-demand; Brier, ECE, isotonic/PAV, beta-binomial; cold_start→provisional(<30)→calibrated(≥30); peer-benchmark normal-CDF + k_min=30 cohort-widen/redact + `benchmark_exclusions`) → explorer trace of `predictive-intelligence.ts` / `employer-tig.ts` / `peer-benchmark.ts` (this session) + memory `.agents/memory/predictive-intelligence.md`, `employer-tig-architecture.md`.
- **"No realized outcomes" / "no norm tables applied" / "EIOS heatmap k-anon gap"** are asserted absences from the trace; verify before building the outcome table.

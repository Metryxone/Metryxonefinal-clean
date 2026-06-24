# MX-76X · Section 6 — Global Benchmark Framework

**Constraint:** do not replace the benchmark engine (`services/adaptive-benchmark.ts`). Extend its
cohort resolution; preserve k-anonymity suppression (`n < k_min` → suppressed).

## Benchmark tiers (mapped to `bench_cohorts.cohort_type`)
```
Global Benchmark    ← cohort_type='global'   (1 cohort, present)
Regional Benchmark  ← cohort_type='region'   (4 cohorts APAC/EU/ME/US — EXIST, but LATENT, G4)
Country Benchmark   ← cohort_type='country'  (0 — NOT measurable today, G2)
Industry Benchmark  ← cohort_type='industry' (2 cohorts)
Role Benchmark      ← cohort_type='role'     (5 cohorts)
```
(`function`=3, `layer`=4 also present.) `bench_competency_benchmarks`=195, `bench_cohort_statistics`=15.

## The one true activation here (G4)
`resolveCohort` currently resolves role/function/industry/layer/global. The **4 `region` cohorts
already exist in the table but are never resolved** → regional benchmarking is dormant. Activation =
add `region` (and accept a `country` branch that resolves nothing yet) to `resolveCohort`, behind flag
`globalBenchmarkV2`, byte-identical OFF.

- `geography` column on `bench_cohorts` is the join key (`region` cohorts carry `geography=<code>`).
- Country branch returns `not_measurable` (no country cohort + no ≥k_min country population) — **never
  a fabricated percentile**.

## k-anonymity is preserved, not weakened
Every regional/country aggregate keeps the hard gate: if the cohort's `n < k_min` → `suppressed:true`,
`suppression_reason:'insufficient_cohort_k_anonymity'`, value `null`. Going global must NOT create a
back door to small-cohort exposure. Region cohorts with thin samples will legitimately suppress.

## Coverage truth (measured)
| Tier | Cohorts | Resolvable today | After G4 |
|---|---|---|---|
| Global | 1 | ✅ | ✅ |
| Region | 4 | ❌ (latent) | ✅ (k-gated) |
| Country | 0 | ❌ | ❌ `not_measurable` |
| Industry | 2 | ✅ | ✅ |
| Role | 5 | ✅ | ✅ |

## Verdict
Global/regional/industry/role benchmarking is **achievable now** (region needs the small resolver
activation). Country benchmarking is **honestly not measurable** until real per-country cohorts reach
`k_min` — reported, never faked.

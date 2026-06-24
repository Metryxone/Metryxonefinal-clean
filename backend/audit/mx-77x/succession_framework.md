# MX-77X · Section 5 — Succession Intelligence

**Status:** WORKING on demo_org seed.
**View:** `/api/enterprise-workforce/succession` (`successionView`).
**Engine:** `m5-succession` (successionSummary / candidates / criticalRoles / benchStrength / leadershipGapRisks).
**Tables (live):** `m5_succession_candidates` 5 · `m5_critical_role_successors` 5 ·
`m5_bench_strength_scores` 3 · `m5_leadership_gap_risks` 3 · (`m5_succession_readiness` 0).

## Flow
```
Role → Successor Pool → Readiness → Risk → Succession Index
```
- Successor pool = `m5_succession_candidates` (5); critical roles = `m5_critical_role_successors` (5);
  bench depth = `m5_bench_strength_scores` (3); risk = `m5_leadership_gap_risks` (3).

## Outputs (task-required buckets)
- **Ready Now / Ready 6m / Ready 12m** — derived from each candidate's readiness band (the readiness
  timeline is bucketed from `readiness_score`; candidates with no readiness abstain, never default to "Ready Now").
- **High-Risk Roles** — `m5_leadership_gap_risks` (3).
- **Critical Roles** — `m5_critical_role_successors` (5).

## Coverage ⟂ Confidence
- **Coverage:** candidates/critical present (5/5); bench + gap-risk thinner (3/3); dedicated
  `m5_succession_readiness` is **0** → readiness timeline is computed from candidate fields, not a stored table.
- **Confidence:** seed, single org, n<30 → cohort bench comparisons k-anon suppressed; bands are
  developmental signals, NOT promotion decisions (disclaimer enforced).

## Honest gaps
- No stored succession-readiness snapshots → no longitudinal succession trend yet (would need ≥2 snapshots).

# D2 — Role DNA · 100X Re-certification

**Verdict: PASS.** **Score: 92/100** (was 78 — the three engineering-closable gaps below are now closed: per-role benchmarks derived, 100% snapshot coverage, 0 unlinked roles).

## Live evidence
- Snapshots: **1,040** rows / **1,040** roles; avg confidence **1.000**; high-band **1,040**. Coverage **1,040/1,040 = 100%** of roles.
- Inheritance (`map_role_competency`, active): **52,837** rows / **1,040** roles; **0** NULL weight / min / target; **0** duplicate (role,competency) pairs.
- Competencies per role: min **9** · avg **50.8** · max **92**.
- Roles with no competency links: **0**.
- Per-role benchmark availability: `dna.benchmark.available = true` on **all 1,040** snapshots; family-level `ti_role_benchmarks = 60`.

## What changed (this task — additive, reversible)
- **Per-role benchmarks derived from family rows** — `generateRoleBenchmark` now maps a role's `ont_role_family` → one of the 15 `ti_role_benchmarks` RF cohorts and derives its layer from seniority/leadership, then reads that cohort's band. Marked `basis: 'role_family_layer_aggregate'` with `rfName` / `layer` / `derivedFromFamily` / `rfMatch` provenance — a coarse cohort band applied to the role, **never** a role-specific empirical sample, and no percentile is invented. Roles with no mappable family still abstain honestly.
- **Snapshot coverage 600 → 1,040** — re-materialized every resolvable role (provenance `98x_phase1_expansion`, idempotent DELETE+INSERT, reversible via `--rollback`).
- **19 unlinked roles linked** — all were O*NET Military Specific (SOC 55-*), an entirely-unrated major group with no rated relative to inherit from within its own SOC tiers. Added a cross-group adjacency fallback in `deriveUnratedRoleCompetencies` (55 Military Specific → 33 Protective Service); each now carries a clearly-labelled `source='onet_derived'` transferable competency set (25 links each).

## What Phase 1–9 added
- **Phase 1 — Role DNA Governance** (flag `roleDnaGovernance`): read-only governance over `ont_*` / `map_role_competency` with Coverage ⟂ Confidence kept separate; no-link roles abstain on Confidence/Quality (null) while keeping partial Completeness; write-once decisions reversible by provenance on POST. Byte-identical OFF.

## Honesty notes (Coverage ⟂ Confidence)
- Benchmark `available=true` reflects **Coverage** (a defensible cohort band exists for the role), not role-specific empirical confidence. The band is family × layer granularity (the seed grain of `ti_role_benchmarks`); `basis`/`rfMatch` disclose this so it is never read as a per-role sample.
- The 19 military links are cross-group derived (`onet_derived`, 0.6 governance confidence) — a coarser approximation than within-group inheritance, disclosed in code and provenance.

## Re-run
`npx tsx scripts/audit-100x-certification.ts` (D2 section). Re-materialize/link is re-runnable + reversible:
`npx tsx scripts/activate-onet-role-dna.ts --apply --derive-unrated --limit 1100` (rollback: `--rollback`).

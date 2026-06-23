# D2 — Role DNA · 100X Re-certification

**Verdict: PARTIAL.** **Score: 78/100** (was 75 in 99X — Phase 1 governance surface added; underlying data unchanged).

## Live evidence
- Snapshots: **600** rows / **600** roles; avg confidence **1.000**; high-band **600**. Coverage **600/1040 = 57.7%** of roles.
- Inheritance (`map_role_competency`, active): **52,362** rows / **1,021** roles; **0** NULL weight / min / target; **0** duplicate (role,competency) pairs.
- Competencies per role: min **9** · avg **51.3** · max **92**.
- Roles with no competency links: **19**.
- Per-role benchmark availability: `dna.benchmark.available = false` on **all 600** snapshots; family-level `ti_role_benchmarks = 60`.

## What Phase 1–9 added
- **Phase 1 — Role DNA Governance** (flag `roleDnaGovernance`): read-only governance over `ont_*` / `map_role_competency` with Coverage ⟂ Confidence kept separate; no-link roles abstain on Confidence/Quality (null) while keeping partial Completeness; write-once decisions reversible by provenance on POST. Byte-identical OFF.

## Honest gaps
- **0 role-level benchmarks** — engineering-closable (derive per-role from family rows) but not yet done.
- Snapshot coverage 57.7%; 19 unlinked roles — both engineering-closable.

## Why not higher
Inheritance integrity is genuinely enterprise-grade (0 defects across 52,362 rows), but benchmarks-at-role-granularity and full snapshot coverage are unbuilt; we score the live state, not the roadmap.

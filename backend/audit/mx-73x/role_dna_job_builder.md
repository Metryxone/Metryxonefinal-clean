# MX-73X · Section 3 — Role-DNA Job Builder

> How an employer job auto-derives its competency requirements from Role DNA. No new authoring
> surface is invented — this documents the existing `generateRoleDNA` resolution that the match
> engine already uses, and the honest reachability ceiling.

## Employer drill-down → Role
```
Industry → Function → Department → Role Family → Role
```
These map to the curated ontology (`onto_*`) and O*NET (`ont_*`) crosswalk already in the platform
(see `.agents/memory/onto-vs-ont-namespace-bridge.md`). A job is a row in `employer_jobs`; its
`title` is the resolution key into Role DNA.

## Auto-generated from Role DNA (`generateRoleDNA(pool, title)`)
| Output | Source | Notes |
|---|---|---|
| Required competencies | curated `onto_*` requirements, O*NET inheritance | `RoleDNARequirement[]` |
| Required levels | `expectedLevel` (1–5) / `targetProficiency` | `targetScoreOf()` → 0..100 target |
| Critical competencies | `importanceTier` (critical/important/…) + `weight` | weight drives match denominator |
| Optional competencies | lower-tier requirements | never dropped (equal-weight floor) |
| Benchmark levels | `generateRoleBenchmark` over `ti_role_benchmarks` | abstains (`available:false`) when no row |

## Resolution honesty
- `roleDna.resolved` + `confidence` + `band` are surfaced; an unresolved title yields a low/`none`
  confidence and the match degrades rather than fabricating requirements.
- `requirementSource` records whether requirements are `curated` or O*NET-derived.
- **Ceiling:** roles without curated requirements fall back to O*NET inheritance; roles with no
  benchmark row abstain on benchmark. With 0 `employer_jobs` today this path is exercised only by
  smoke/evidence, not live jobs — operational confirmation needs real postings.

## What MX-73X does NOT add here
No parallel role taxonomy, no hand-authored requirement table, no Role-DNA rewrite. The job builder
is the existing Role-DNA resolution consumed by `computeCompetencyDrivenMatch`.

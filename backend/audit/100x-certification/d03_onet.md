# D3 — O*NET Feeder & Crosswalk · 100X Re-certification

**Verdict: PARTIAL.** **Score: 72/100** (was 70 — Phase 2 crosswalk governance added; data unchanged).

## Live evidence
- `map_role_competency`: **52,362** rows / **1,021** roles / **159** distinct competencies.
- Curated crosswalk `map_ont_onto_role`: **5** total · **3** resolved · **0** human-verified.

## Correct boundary (unchanged, by design)
O*NET feeds roles / competencies / weights and stays **out of scoring** — scoring authority is `onto_*` / `employabilityEngine`. This boundary is the right one and is preserved.

## What Phase 1–9 added
- **Phase 2 — O*NET Crosswalk Governance** (flag `onetCrosswalkGovernance`): read-only governance with Confidence stuck LOW on O*NET-derived links; no role↔industry link → always abstain; `ont_*` INT ids never coerced to `onto_*` TEXT ids. Write-once, reversible-by-provenance on POST.

## Honest gaps
- Curated crosswalk is thin (**5 rows, 0 verified**); no human approval UI yet.
- Hierarchy levels are not O*NET-sourced (curated); O*NET has no industry dimension → only exact-name crosswalk is reachable (honest ceiling).

## Why not higher
The feeder is correct and bounded, but the human-verified crosswalk is minimal; verification is a human-in-the-loop step we will not fake.

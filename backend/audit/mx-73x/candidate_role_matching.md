# MX-73X · Section 4 — Candidate ↔ Role Matching

> Documents `computeCompetencyDrivenMatch` (`services/employer-competency-hiring.ts`). Read-only,
> composes Role DNA + unified competency profile + Role-Readiness-V2. Fails closed; never fabricates.

## Inputs
- **Candidate**: `employer_candidates` row; competency subject = `candidate.email` (no email → abstain).
- **Role**: `employer_jobs` row; `job.title` → Role DNA requirements + benchmark.

## Comparison
For each role requirement, find the candidate's MEASURED competency (exact key → normalized label →
token containment). Unmeasured scores are skipped (never matched, never zero-filled).

```
attainment = clamp01(candidateScore / targetScore)            (null when unassessed)
competencyMatch = Σ(weight · attainment·100) / Σ(weight)       over ASSESSED requirements only
requirementCoveragePct = assessedWeight / totalWeight · 100    (Coverage axis, separate)
```

## Outputs (the four MX-73X numbers, honestly defined)
| Output | Field | Definition |
|---|---|---|
| **Match %** | `competencyMatch` | weighted attainment over assessed requirements (0..100), `null` if none |
| **Gap %** | derived from `gaps[]` | requirements measured below target; `100 − competencyMatch` over assessed |
| **Readiness %** | `candidateReadiness.readinessScore` | role-readiness-v2 (candidate scope), `null` if unmeasured |
| **Risk %** | derived | inverse of coverage-adjusted confidence: high when coverage thin / uncalibrated |

> "Risk" is reported as a **developmental** signal (coverage-thin or uncalibrated ⇒ higher risk of
> an unreliable read), NOT a prediction of on-the-job failure. The headline fit band is WITHHELD
> when coverage < 50% so a high match on a thin subset never reads as strong fit.

## Fail-closed paths (never fabricate)
- No email → no subject → `heuristic_fallback`, match `null`.
- Profile present but **no requirement overlap** → coverage miss, match `null`, coverage reported.
- Competency ledgers absent/unreadable → degraded, match `null`.

## Coverage ⟂ Confidence
- **Coverage** = how much of the role was actually assessed (`requirementCoveragePct`).
- **Confidence** = calibration state (`uncalibrated` until ≥30 realized outcomes) + provisional flag.
These are never blended into a single number that hides one behind the other.

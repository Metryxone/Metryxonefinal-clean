# MX-73X · Section 9 — Candidate Hiring Readiness Experience

> What a candidate sees about their fit for a role. Developmental framing only — never a
> hiring/suitability verdict. Composes the same competency-driven match (candidate-scoped view).

## Candidate-visible surfaces
| View | Source | Honesty |
|---|---|---|
| **Role Match** | `match.competencyMatch` | shown with coverage; band withheld when coverage thin |
| **Readiness** | `match.candidateReadiness` | role-readiness-v2; "not measurable" when unmeasured |
| **Gap Analysis** | `match.gaps` (measured) + `unassessedRequirements` (to assess) | real gaps only; unassessed shown as "not yet assessed", never as a gap |
| **Development Plan** | derived from gaps (focus areas) | developmental actions on measured shortfalls; reuses platform Career Development surfaces |

## Language
Allowed: developmental focus area, readiness, gap, evidence to gather. Disallowed: hireability,
suitability score, pass/fail. The candidate view is a growth signal, not a verdict, and ships the
non-verdict disclaimer.

## Privacy
- A candidate sees only their own match (IDOR-guarded by org/session scope on the employer side;
  candidate-facing reuse follows `resolveEffectiveUserId`).
- Benchmarks shown to candidates obey the same k-anonymity floor (k≥30) — no sub-k percentile.

## Ceiling
With 0 employer candidates, this experience is unexercised on live data; the contracts and honesty
rules are in place for when real candidates are assessed.

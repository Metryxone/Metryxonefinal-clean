# MX-73X · Section 5 — Unified Hiring Score Model  ◀ the real gap closed

> NEW: `services/employer-hiring-score.ts` → `deriveUnifiedHiringScore(match, { eiScore })`.
> Pure derivation over already-computed signals. No DB reads, no writes, no DDL. Additive field
> `hiringScore` on `EmployerCompetencyIntelligence`. Flag-gated (`employerCompetencyHiring`);
> flag-OFF the route 503s → byte-identical.

## Why this exists
Before MX-73X the employer flow produced a competency-only match. The **Employability Index** was
stored on the candidate (`employer_candidates.ei_score`) but **never influenced hiring**, and there
was no single 0–100 hiring number composing the spec's inputs. This model is that number, and it is
the mechanism by which **Employability Index now directly influences hiring**.

## Inputs and base weights
| Component | Value source | Base weight |
|---|---|---|
| Competency Score | `match.competencyMatch` (**required anchor**) | 0.35 |
| Employability Index | `candidate.ei_score` (normalized 0..100) | 0.25 |
| Readiness Score | `match.candidateReadiness.readinessScore` | 0.20 |
| Role Match | `match.roleDna.confidence × 100` (role-intelligence confidence) | 0.10 |
| Benchmark Match | candidate vs released `ti_role_benchmarks` percentiles (k≥30) | 0.10 |

```
hiringScore = Σ_present( value · (baseWeight / Σ_present baseWeight) )   clamped to [0,100]
```

## Honesty rules (enforced + smoke-tested)
1. **Competency is the required anchor.** `competencyMatch == null` → score **WITHHELD** (`null`),
   `withheld:true`. The score is never fabricated from EI/readiness alone.
2. **Null-safe re-normalization.** An absent component is dropped and the weight set re-normalizes
   over present components — an absent input is **never** counted as 0. (Smoke proves
   `EI absent ≠ EI 0`.)
3. **Benchmark abstains under k-anonymity.** Suppressed/absent cohorts contribute nothing.
4. **Inherited provisional/validated/calibration.** Taken from the match; the score is a
   DEVELOPMENTAL decision-support signal with a non-verdict disclaimer, `validated:false` until
   ≥30 realized outcomes.
5. **Transparent contributions.** Every component reports `value`, `baseWeight`, `effectiveWeight`,
   `contribution`, `present`, `source` — the score is fully auditable.

## Bands
`strong` ≥80 · `promising` ≥65 · `developing` ≥50 · `early` <50 · `null` when withheld.

## Verification
`scripts/smoke-employer-hiring-score.ts` — 16/16:
withheld-without-competency · EI influences score · EI-absent excluded & re-normalized (not zeroed)
· effective weights sum to 1 · score ∈ [0,100] · calibration/validated inherited · normalizeEiScore
null-safe & clamped · base weights sum to 1 · flag defaults OFF.

## Honest residual
With 0 employer candidates the score is unexercised on live data. The benchmark component will
abstain until role cohorts reach k≥30. The score is calibrated only after ≥30 realized outcomes.

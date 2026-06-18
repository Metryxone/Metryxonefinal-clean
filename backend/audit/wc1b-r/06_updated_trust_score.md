# WC-1B-R — Updated Trust Score (Simulation Harness Before/After)

The simulation harness drives the REAL public pipeline (question selection → signals → composites → patterns → interventions → report) over HTTP, validating against `TARGETS`. Run with `profileCount=200`, `sampleSize=10` (10 spec personas), `seed=20260604`.

Sources: `audit/wc1b-r/harness_before_flagoff.json` (flag OFF, fresh server) · `audit/wc1b-r/harness_after_flagon.json` (flag ON, fresh server).

| Metric | Before (flag OFF) | After (flag ON) | Δ |
|---|---|---|---|
| **verdict** | pass | pass | — |
| relevance | 0.9580 | 0.9580 | 0 |
| relevance coverage | 1.0000 | 1.0000 | 0 |
| relevance concept | 0.8600 | 0.8600 | 0 |
| relevance concernMatch | 1.0000 | 1.0000 | 0 |
| concernCoverage | 1.0000 | 1.0000 | 0 |
| questionQuality | 1.0000 | 1.0000 | 0 |
| reportUsefulness | 1.0000 | 1.0000 | 0 |
| signalConfidence | 0.8342 | 0.8342 | 0 |
| patternConfidence | 0.5632 | 0.5632 | 0 |
| recommendationQuality | 1.0000 | 1.0000 | 0 |
| coverage (runs/seeded/withSignals/withPatterns/withInterventions/withReport) | 10/10/10/7/6/10 | 10/10/10/7/6/10 | 0 |

## Interpretation (honest)
- **Non-regressive.** Flag ON keeps every harness metric **identical** to baseline and the verdict stays `pass`. Wiring the grounding runtime introduces **zero regression** to the validated pipeline.
- **Why the top-line is unchanged:** the 10 spec personas map to concerns with strong curated Tier-3 seeds, so the grounded **gap-fill rarely fires** for them; and the aggregate metrics are coarse (`withSignals` is binary `>0`), so the conservative, evidence-gated grounded contribution (which does not change *activated* counts for these sessions — see Signal Consumption Report) does not move the aggregates.
- The harness is allowed to fail; it did not. The grounding feature's measurable effect is at the resolver/ranking/explainability surfaces (see those deltas), not in the harness aggregates for the curated-strong spec personas.

## Trust score
**Maintained — no degradation.** Flag-OFF byte-identical (verified separately), flag-ON pass with identical metrics and no test regression (`adaptive-question-pipeline` 25/25).

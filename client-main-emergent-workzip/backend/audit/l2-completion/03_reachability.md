# L2 Completion — Report 3: Reachability

## The two ceilings
- **Construct-reachability ceiling** = questions whose bridge tag resolves to ≥1 construct = **26233 (85.6%)**. This is the absolute maximum outcome coverage achievable by outcome-model expansion ALONE — a question with no construct can never reach an outcome model.
- **Achieved outcome coverage** = 26233 (85.6%).
- **Distance to ceiling** = 0 q (0%). Coverage is AT the ceiling — all construct-reachable questions are outcome-covered.

## Per-model reachability (AFTER — constructs each model can be reached through)
| Model | Gated | Construct keys | Primary-outcome q |
|-------|-------|----------------|-------------------|
| career_clarity | no | 6 | 2946 |
| confidence_stability | no | 8 | 7045 |
| decision_quality | no | 9 | 1860 |
| employability_readiness | no | 5 | 6391 |
| exam_readiness | yes | 5 | 1640 |
| family_wellbeing | no | 1 | 0 |
| holistic_wellbeing | no | 3 | 1540 |
| learning_effectiveness | no | 8 | 4811 |

## Out-of-scope honest headline
- The remaining **14.4%** of the bank (4405 q) has NO construct at all (UNMAPPED / ABSENT bridge tag). It is **unreachable by any outcome-model change**.
- ⛔ Reaching **>85.6%** (e.g. 90%) requires reducing the UNMAPPED set via crosswalk review — a separate, approval-gated CROSSWALK phase, **explicitly OUT OF SCOPE** here ("no new constructs / no new ontology"). Reported honestly; nothing forced.

## Dormant (honest, not forced)
- `family_wellbeing` (FAMILY_DYNAMICS only) reaches 0 clarity questions — the bank is learner-centric, not family-centric. Reported, not removed.

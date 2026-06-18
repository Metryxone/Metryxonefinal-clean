# WC-L0D Deliverable 4 — Personalization Impact
_Generated 2026-06-09T14:43:30.470Z_

Personalization impact is reported as the **ceiling a behaviour-driven personalizer can consume** —
i.e. the share of sessions that carry a behaviour signal it could act on — kept honest (no modelled
uplift; inventing one would be fabrication). It is reported on two axes: session *reach* and signal
*richness*.

| Measure | Before | After | Reading |
|---|---|---|---|
| Behaviour-bearing sessions (reach) | 2/9 (22.2%) | 2/9 (22.2%) | ceiling of sessions a personalizer can touch |
| Construct-dim cells available (richness) | 0/36 (0.0%) | 5/36 (13.9%) | how much construct signal exists to personalize on |
| Within graphed sessions (richness) | 0.0% | 62.5% | construct depth where a graph exists |

## Honest reading
- **Reach is unchanged** (22.2%): a personalizer can still only act on the
  2 sessions that have a behaviour graph. Namespace alignment does not create graphs.
- **Richness rises sharply** within those sessions — from 0.0% to
  62.5% of construct cells — so each behaviour-bearing session now exposes
  motivation / confidence / engagement / adaptability deficits a personalizer can target, where
  before it had only `risk` + `learning_style`.
- The **>88% personalization target is NOT met** and cannot be met by WC-L0D alone: reach is capped
  by the upstream graph-capture gap (WC-L0C FP1/FP2). Reported as the true ceiling, not inflated.

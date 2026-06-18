# Deliverable 6 — Behaviour Readiness
_Generated 2026-06-09T14:01:18.614Z_

Readiness of behaviour intelligence as a PERSISTED + LONGITUDINAL signal, vs. the phase targets.
Reported on the two independent axes; the targets are **not** forced.

## Readiness vs targets (honest)
| Capability | Measure | Result | Target | Met? |
|---|---|---|---|---|
| Behaviour Persistence | rows / completed | 100.0% | >80% | ✅ |
| Behaviour Coverage (signal present) | ≥1 dim / completed | 22.2% | (informative) | — |
| Behaviour History | behaviour-bearing users / emailed | 66.7% | >80% | ❌ |
| Behaviour Trend | eligible users w/ trend | 0.0% | >70% | ❌ |
| Personalization | behaviour-bearing sessions | 22.2% | >90% | ❌ |
| Longitudinal | eligible users w/ behaviour trend | 0.0% | >85% | ❌ |

## Why the targets are not met (real ceilings, surfaced not gamed)
1. **Row-persistence succeeds, signal-presence does not.** Persistence is 100% (every completed
   session has a behaviour row), but the Unified Behavior Graph projected an actual dimension for only
   **2/9** completed sessions. The behavioural spine
   (signals / composites / patterns) is near-empty upstream, so the dimensions are honestly NULL.
2. **History has no two-point continuity.** Of **2** returning users, none has two completed
   sessions that both carry the same behaviour dimension, so **behaviour-trend coverage is 0%** and
   nothing is fabricated to lift it.
3. **Personalization is coverage-bounded.** A behaviour-driven personalizer can only act on a behaviour
   signal that exists; with 22.2% signal presence, behaviour-driven personalization readiness
   is far below 90% — reported truthfully rather than modelled into a target.
4. **The taxonomy is partial by design.** Four of the six requested dimensions (Curiosity, Persistence
   as a standalone, Consistency, Self-Regulation) are not computed by the engine; they are reported as
   not-available rather than invented.

## Forward guarantee (no backfilled fabrication)
- The post-completion hook now resolves behaviour persistence (item 16) and behaviour trends (item 18,
  behind `FF_BEHAVIOUR_TREND_INTELLIGENCE`) for every new completed session. As the upstream
  behavioural spine fills in (more signals/composites/patterns captured), dimension coverage rises,
  and as returning users accrue ≥2 sessions carrying the same dimension, real trend rows appear on
  their own.
- **The single highest-leverage upstream fix is signal capture**, not this layer: WC-L0B is correct
  and ready; its numbers can only rise from REAL captured behaviour, never from fabrication.
- Targets **NOT met today** — reported as the true ceiling per the honesty canon.

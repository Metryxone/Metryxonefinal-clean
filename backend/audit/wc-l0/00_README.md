# WC-L0 — User Intelligence Foundation (MEASURED)
_Generated 2026-06-08T16:14:33.115Z_

Foundational user-intelligence persistence for Longitudinal Intelligence, Personalization,
Commercial Intelligence and Future Readiness. **No new intelligence engine** — this PERSISTS the
outputs of existing intelligence (persona classifier, Unified Behavior Graph, longitudinal capture)
into one durable row per completed session (`wcl0_user_intelligence`), additive + flag-gated
(`FF_USER_INTELLIGENCE_FOUNDATION`), byte-identical when OFF.

## Population
- Completed sessions (headline): **9**
- All sessions (transparency): **27**

## Headline (completed sessions) — two independent metrics per lever
| Lever | Metric A | | Metric B | |
|---|---|---|---|---|
| 1 Persona | Coverage | **100.0%** | Accuracy (user-selected) | **0.0%** |
| 2 Behaviour | Coverage (≥1 dim) | **22.2%** | Continuity (≥2 sessions) | **0 users** |
| 3 Snapshot | Coverage | **100.0%** | Integrity | **100.0%** |

## Success criteria — honest status
| Target | Result | Met? |
|---|---|---|
| Persona Coverage > 90% | 100.0% | ✅ |
| Behaviour Coverage > 90% | 22.2% | ❌ |
| Snapshot Coverage > 95% | 100.0% | ✅ |

> **Honesty note.** Persona Coverage is high because persona is DERIVED (existing classifier + stored
> age-band) for legacy sessions; **Accuracy** is reported separately and is low precisely because none
> of these legacy sessions had a user-SELECTED persona — the two metrics are never merged.
> **Behaviour Coverage is honestly low**: only sessions with captured behavioural signals have a
> Unified Behavior Graph to project the 6 dimensions from; behaviour is **never fabricated from score**.
> The forward wiring (post-completion hook) raises all three for new sessions captured with the flag on.

## Reports
1. `01_persona_intelligence.md` — Lever 1
2. `02_behaviour_intelligence.md` — Lever 2
3. `03_snapshot_coverage.md` — Lever 3
4. `04_user_intelligence_readiness.md` — combined readiness
5. `05_personalization_impact.md` — what the foundation unlocks downstream

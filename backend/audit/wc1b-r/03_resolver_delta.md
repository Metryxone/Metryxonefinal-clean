# WC-1B-R — Resolver Delta (Phase 3 `/analyze`)

Source: `probe_before_flagoff_fresh.json` (flag OFF) vs `probe_after_flagon.json` (flag ON), 5 grounded probe concerns. Both runs hit `POST /api/capadex/concern/analyze` with explicit `concern_id`.

## Key-presence contract (byte-identical OFF)
| Field | Flag OFF | Flag ON |
|---|---|---|
| `resolution_confidence` (core) | unchanged (null for these concern_id resolutions) | **identical** — never mutated |
| `signal_grounding` key present | **absent (5/5)** | **present (5/5)** |
| `resolution_confidence_grounded` key present | absent (5/5) | absent (5/5) — see note |

## `signal_grounding` envelope (flag ON)
| Concern | bridge_tag | grounded | grounded_signal_count | grounded_family_count | mean_similarity |
|---|---|---|---|---|---|
| CONCERN_COM_1718 | ANALYTICAL_DEVELOPMENT | true | 40 | 1 | 0.2288 |
| CONCERN_SEL_1618 | GROWTH_TRACKING | true | 40 | 1 | 0.2498 |
| CONCERN_ACA_1086 | LEADERSHIP_OWNERSHIP | true | 200 | 3 | 0.2521 |
| CONCERN_EMP_17 | EXAMINATION_STRESS | true | 160 | 3 | 0.2548 |
| CONCERN_CAR_6 | EMPLOYABILITY | true | 140 | 3 | 0.3666 |

## Note — `resolution_confidence_grounded` absent even flag-ON (honest finding)
`resolution_confidence_grounded` is an **additive boost on top of an existing base score**: it is only attached when the core resolver returns a numeric `resolution.confidence`. For these probe concerns the `/analyze` path was driven by an explicit `concern_id`, where the core resolver returns `null` confidence (no text-resolution score) — so there is no base to boost and the key is correctly omitted. The `signal_grounding` evidence envelope is still surfaced. When `/analyze` resolves a concern from free text (producing a numeric base confidence), the grounded boost (`min(8, round(mean_similarity*10))`, capped at 100) is attached as a separate key.

## Verdict
- Flag OFF: resolver envelope **byte-identical** to legacy (no new keys, core score untouched).
- Flag ON: additive `signal_grounding` evidence on every grounded concern; core `resolution_confidence` provably unchanged; grounded confidence boost is base-conditional and correctly omitted when no base score exists.

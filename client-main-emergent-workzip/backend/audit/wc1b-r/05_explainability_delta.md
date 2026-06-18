# WC-1B-R — Explainability Delta (Phase 5 `GET /api/capadex/session/:id/grounding`)

New read-only route. Flag gate is checked **before** the UUID guard. Lineage: Concern → Bridge Tag → Grounded Families/Signals → session activation tie-in.

Source: `probe_before_flagoff_fresh.json` (flag OFF) vs `probe_after_flagon.json` (flag ON).

## Delta
| Concern | Flag OFF | Flag ON |
|---|---|---|
| all grounded sessions | `{enabled:false}` | `{enabled:true, grounded, families[], signals[], activated_signal_count}` |

Flag-ON lineage payloads:
| Concern | enabled | grounded | family_count | signal_count | activated_signal_count |
|---|---|---|---|---|---|
| CONCERN_COM_1718 | true | true | 3 | 25 | 0 |
| CONCERN_SEL_1618 | true | true | 3 | 25 | 0 |
| CONCERN_ACA_1086 | true | true | 3 | 25 | 0 |
| CONCERN_EMP_17 | true | **false** | 0 | 0 | 0 |
| CONCERN_CAR_6 | true | true | 3 | 25 | 0 |

## Honest findings
1. **`activated_signal_count = 0`** across the board — consistent with the Signal Consumption Report: grounded signals are surfaced as lineage but activation is evidence-gated, so none of the probe sessions activated a grounded signal. Lineage correctly reports the *available* grounded families/signals for the tag while reporting 0 activated.

2. **CONCERN_EMP_17 returns `grounded:false` via the route while `/analyze` returned `grounded:true` for the same concern (resolver-path divergence).** Cause: the `/grounding` route resolves the bridge tag from the **session** (`master_concern_pk` → tag), whereas `/analyze` used the explicit **`concern_id`**. The session was started with the free-text name "Placement Pressure", which token-matches many master rows; `resolveSeedConcernPk` picked a different bucket (e.g. `LIFESTYLE_PRESSURE`, ungrounded) rather than CONCERN_EMP_17 (`EXAMINATION_STRESS`, grounded). This is **pre-existing free-text resolver behaviour** surfacing through the new lineage, not a wiring defect. Flagged for follow-up (do not "fix" inside this additive task): align the two resolver entrypoints, or persist the analyze-resolved `concern_id` onto the session for lineage to reuse.

## Verdict
- Flag OFF: `{enabled:false}` (byte-identical absence of feature).
- Flag ON: explainable Concern→Tag→Grounded-Signal lineage on grounded sessions; 1/5 sessions exposed a legitimate free-text-vs-concern_id resolver divergence (honest finding, deferred).

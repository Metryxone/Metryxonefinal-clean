# WC-1B-R — Signal Consumption Report

**What is consumed:** grounded atomic signals from `capadex_bridge_tag_signal_grounding`, surfaced (Phase 3/5) and contributed as gap-fill activation seeds (Phase 2). Consumption is **conservative and evidence-gated** — grounded seeds expand the candidate pool but never force-activate.

## Per-tag grounded supply vs. seed contribution (in-process, deterministic)
Source: `audit/wc1b-r/grounding_stats.json`. `GROUNDED_SEED_CAP = 8`.

| Probe concern | Bridge tag | Grounded atomic signals available | Mean similarity | Rank tokens | Grounded seed defs (capped) | Seed confidence (penalised) | Lineage families/signals |
|---|---|---|---|---|---|---|---|
| CONCERN_COM_1718 | ANALYTICAL_DEVELOPMENT | 40 | 0.2288 | 8 | 8 | 0.1373 | 1 / 25 |
| CONCERN_SEL_1618 | GROWTH_TRACKING | 40 | 0.2498 | 8 | 8 | 0.1499 | 1 / 25 |
| CONCERN_ACA_1086 | LEADERSHIP_OWNERSHIP | 200 | 0.2521 | 8 | 8 | 0.1748 | 3 / 25 |
| CONCERN_EMP_17 | EXAMINATION_STRESS | 160 | 0.2548 | 8 | 8 | 0.1600 | 3 / 25 |
| CONCERN_CAR_6 | EMPLOYABILITY | 140 | 0.3666 | 8 | 8 | 0.2320 | 3 / 25 |

**Observations**
- Every grounded tag is capped to **8** seed defs regardless of supply (40–200) — the over-activation guard holds (a single tag could otherwise dump up to 200 atomic signals).
- Seed confidence = tag mean-similarity × **0.6** penalty, uniform across the capped set and **always below curated Tier-3 confidence**. Per-signal similarity still governs *which* 8 are selected (rank DESC); only the stored confidence is flattened to the penalised tag mean.
- Unknown / ungrounded tag (`__NOT_A_REAL_TAG__`): `grounded:false`, **0** rank tokens, **0** seed defs — the empty-contract holds (loader never fabricates).

## Activation outcome (black-box, full session pipeline)
Source: `probe_before_flagoff_fresh.json` (flag OFF) vs `probe_after_flagon.json` (flag ON). Each probe drives the REAL public endpoints: analyze → start → respond → complete → signals/grounding, sessions purged after.

| Concern | Session signals OFF | Session signals ON | Grounded-token overlap ON | `/grounding` activated_signal_count ON |
|---|---|---|---|---|
| all 5 | 3 | 3 | 0 | 0 |

**Honest finding — activation is unchanged (by design).** Grounded seeds are added to the seed-def pool, but `buildSeedSignals(seedDefs, fullEvidence)` scales every seed against the session's **answer-evidence**. The probe sessions' answer-evidence (curated bank questions, generic max-distress answers) does not match the grounded signal keys, so grounded seeds produce zero weight and do not activate. This is the intended conservative behaviour: **grounding expands availability / ranking / explainability, not forced activation.** A grounded seed activates only when a session's actual answers produce evidence matching that grounded signal — which keeps the avg-79/max-200-per-tag supply from flooding sessions.

## Consumption summary
- **Resolver (Phase 3):** consumed as evidence metadata on every grounded concern (5/5 probes).
- **Ranking (Phase 4):** 8 grounded vocab tokens consumed per grounded tag (5/5).
- **Explainability (Phase 5):** lineage consumed (families+signals) on grounded sessions (4/5 — see Explainability Delta for the 1/5 resolver-path divergence).
- **Activation (Phase 2):** grounded seed defs contributed to the pool on all grounded concerns; net activated-signal delta = 0 for the probe set (evidence-gated, conservative).

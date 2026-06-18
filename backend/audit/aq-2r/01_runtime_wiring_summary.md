# AQ-2R · 01 — Runtime Wiring Summary

**Generated:** 2026-06-04T08:41:19.562Z

## What was wired
The AQ-2 per-question metadata layer (`capadex_question_metadata`, 30,638 rows,
100% of the clarity bank, provenance `aq2_reconstruction`) is now consumed by the
**live** clarity-question selection `pickQuestionsFromMaster`
(`backend/routes/capadex-concern-intelligence.ts`).

| Aspect | Detail |
|---|---|
| Feature flag | `runtimeMetadataActivation` (`FF_RUNTIME_METADATA_ACTIVATION`) — **default OFF** |
| Flag OFF | No metadata join, no scoring, no re-rank → **byte-identical legacy ordering** |
| Flag ON | LEFT JOIN metadata by `question_id`; re-rank candidate pool by composite meta score; stage-progression order the final batch |
| Shared scorer | `backend/services/question-metadata-ranking.ts` — imported by BOTH the runtime picker AND this harness (one scorer, no drift) |
| Scope | **Tier-1 master-curated clarity only.** Tier-2 adaptive bank + Tier-3 static fallback carry no AQ-2 metadata and are untouched (honest scoping) |
| Safety | Re-rank wrapped like the WC-1B-R grounded nudge; join-miss rows score 0 and sort last but are **never dropped** |

## Scoring weights (sum = 1.0)
| Dimension | Weight |
|---|---|
| Age | 0.3 |
| Persona | 0.25 |
| Signal | 0.2 |
| Behavior | 0.1 |
| Capability | 0.1 |
| Stage | 0.05 |

Stage progression order: Awareness → Curiosity → Clarity → Growth → Mastery.

## Measurement
Deterministic (no random). 192 envelopes = 16 representative
concerns × 5 ages × 6 personas (in-range
contexts only). 48 out-of-range and 0 empty-pool contexts skipped.
Identical candidate pool per envelope for both arms; only the ordering differs.

> Scope of fidelity: the harness shares the production **scorer** and the **candidate
> gate** (bridge tag + family-age + options≥2). The picker's topical-relevance
> partition and youth-demotion are deliberately held constant — they are orthogonal
> to the metadata re-rank, so isolating the re-rank is exactly what the A/B measures.

# CAPADEX 3.0 · Phase 1.7 — Explainability Validation

> Deliverable 05 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 6 explainability criteria the AI outputs should meet, mapped to the EXISTING explainability substrate (verified vs live FS+DB).

| Item | Category/Audience | Status | Services | Tables | Absent (honest) |
|---|---|---|---|---|---|
| Per-recommendation rationale rendered (`rationale_rendered`) | — | SUPPORTED | 1/1 | 0/0 | — |
| Runtime per-decision explainability (`runtime_explainability`) | — | SUPPORTED | 2/2 | 0/0 | — |
| Evidence traceability (signal → recommendation) (`evidence_traceability`) | — | PARTIAL | 1/1 | 2/2 | — |
| Confidence disclosure (calibration surfaced honestly) (`confidence_disclosure`) | — | PARTIAL | 1/1 | 1/1 | — |
| Reasoning chain persisted + inspectable (`reasoning_chain_persisted`) | — | SUPPORTED | 1/1 | 1/1 | — |
| Explainability surfaced in human-readable report (`human_readable_report`) | — | SUPPORTED | 1/1 | 1/1 | — |

**Rollup:** **4 SUPPORTED · 2 PARTIAL · 0 DEAD_END · 0 MISSING** of 6.

## Definitions & honesty notes
- **Per-recommendation rationale rendered** (`rationale_rendered`, SUPPORTED) — CAPADEX explainability engine renders a rationale per recommendation/decision.
- **Runtime per-decision explainability** (`runtime_explainability`, SUPPORTED) — Runtime explainability over the live evidence at decision time.
- **Evidence traceability (signal → recommendation)** (`evidence_traceability`, PARTIAL) — Recommendations trace to persisted signals; full per-token attribution is a Confidence axis (not fabricated).
- **Confidence disclosure (calibration surfaced honestly)** (`confidence_disclosure`, PARTIAL) — Calibration (Brier/ECE) surfaced via the validation-loop mechanism; abstains until ≥ k_min (null≠0).
- **Reasoning chain persisted + inspectable** (`reasoning_chain_persisted`, SUPPORTED) — Reasoning chains persist to ai_reasoning_chains.
- **Explainability surfaced in human-readable report** (`human_readable_report`, SUPPORTED) — Rationale flows into the generated report body.

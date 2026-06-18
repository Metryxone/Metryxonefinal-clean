# WC-3 · Output 5 — Validation Plan

> Design only. Defines how each layer is validated and what "done" means. Validation is **honest**: a
> layer is allowed to score below target, and metrics are never tuned to force a pass.

## Validation philosophy (inherited)

- **Measure before/after, same basis** — every gain is measured against a documented baseline (WC-2 +
  AQ-2R), never asserted.
- **Allowed to fail** — the simulation/validation harness drives REAL endpoints and may fail; failure
  is a finding, not a thing to tune away.
- **Coverage-weighted** — quality metrics (differentiability, precision) are gated on the
  coverage-weighted form, not the raw mean (the C-1A pilot lesson).
- **k-anonymity ≥ 30** before any cohort-relative metric is reported.

## Per-layer validation framework & success metrics

| Layer | Validation framework | Success metric (target band) | Honest ceiling |
|---|---|---|---|
| **L1 Stage** | Stage-assignment precision vs CSI ground truth; monotonicity; transition-audit completeness | ≥95% sessions staged w/ confidence ≥ band; 0 in-place history edits | 88–92 reachable |
| **L2 Outcome** | Explainability (full lineage %), actionability (≥1 library action %), no-generic check | Explainability ≥85, actionability ≥85, 0 fabricated outcomes | 85–90 (Exam gated) |
| **L3 Journey** | Routing precision vs WC-2 pilot (+39–87 pp); confidence-gate suppression; pathway coverage honesty | ≥4/5 pathways with lift; Exam flagged gated; 0 forced low-confidence routes | 80–88 (Exam corpus) |
| **L4 Personalization** | Within-tag journey divergence (Diversity-Standards ≥0.30); precision pre/post AQ-2R | Precision 0.10→≥0.30; coverage ≥90%; flag-off no regression | 78–85 repo-wide (enrichment-gated) |
| **L5 QIS 2.0** | Coverage-weighted differentiability before/after; QIS-V2 mean delta; signal-blind trend | Differentiability ≥0.30 on enriched pools; QIS-V2 mean → band | 76–82 repo-wide (Waves dependency) |
| **L6 Longitudinal** | Trend monotonicity vs raw scores; drift precision; append-only integrity | ≥2-session users trended; 0 mutations; drift reconciles w/ CSI | 85–92 (accrues over time) |
| **L7 Outcome Validation** | Prediction-vs-observation accuracy; calibration (Brier-style) on real pairs | Calibration computed on real pairs; accuracy reported honestly | 85–92 (accrues over time) |

## Cross-layer validation gates (CI-style)

1. **Flag-off parity** — with all `FF_WC3_*` OFF, output is byte-identical to pre-WC-3 (golden-file
   diff on analyze→picker→result). Hard gate.
2. **Never-throws** — fault injection on each resolver → user request path still 200s; resolver skips.
3. **Determinism** — same input twice → identical output (ORDER BY + sorted adjacency).
4. **Honesty audit** — no fabricated rows; UNCLASSIFIED/degraded surfaced; strengths only from CSI
   positive factors; no hiring/suitability language.
5. **Reversibility** — drop `wc3_*` → system returns to baseline cleanly.

## Composite validation (World-Class Readiness)

Re-score the WC-2 scorecard after each layer lands, using the **same** measurement methodology, and
report the composite delta honestly:

| Checkpoint | Expected composite | Gate |
|---|---|---|
| Design-reachable layers (L1/L2/L6/L7 + L3 partial + L4 wiring) | ~70–76 | architect review per layer |
| + Enrichment-gated (L4/L5 full via C-2 Waves) | ~82–86 | coverage-weighted differentiability ≥0.30 |
| Stated 90+ all-layer | not reachable repo-wide | flagged, realistic bands reported instead |

**No layer is marked "done" by hitting a number** — it is done when its validation framework runs
honestly, the flag-off parity gate passes, and the architect review signs off.

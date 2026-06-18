# CAPADEX WC-1B — Signal Grounding Implementation

**Additive & non-destructive.** Implements the WC-1A approved **GREEN** mappings only (182 bridge tags). Reuses existing atomic signals — **0 new signals, 0 new concerns, 0 new bridge tags, no ontology restructuring.** Fully reversible.
Script `backend/scripts/audit/wc1b-signal-grounding-impl.ts` · migration `backend/migrations/20260605_bridge_tag_signal_grounding.sql`.

---

## What was implemented

Two additive reuse-linkage tables (same layer-pattern as the existing `capadex_concern_signal_map` — they record relationships, they do **not** alter any signal/concern/tag definition):

- `capadex_bridge_tag_family_grounding` — **Bridge Tag ↔ Signal Family** (351 rows).
- `capadex_bridge_tag_signal_grounding` — **Bridge Tag ↔ Atomic Signal** (14,402 rows).

Every row is provenance-stamped `wc1a_green`. The mappings are read **directly from the WC-1A approved artifacts** (`signal_grounding_matrix.csv` GREEN tags + `candidate_signal_reuse_map.csv` families with similarity ≥ 0.2139, the calibrated GREEN floor) — so what is implemented is exactly what was reviewed, with no recompute drift. YELLOW tags are excluded by scope.

## Output (the 6 required items)

| # | Output | Result |
|---|---|---|
| 1 | **Tags Grounded** | **182** GREEN tags (25 → **207** of 328 total grounded) |
| 2 | **Signals Reused** | **5,581** distinct atomic signals → **14,402** bridge-tag↔signal links |
| 3 | **Coverage Improvement** | Signal 7.6% → **63.1%** (+55.5); Concern 42.8% → **90.4%** (+47.6) |
| 4 | **Ontology Health Delta** | 60.8 → **67.8** (**+7.0**) |
| 5 | **Resolver Impact Forecast** | **1,184 concerns** under newly-grounded GREEN tags gain reusable atomic-signal evidence (directional) |
| 6 | **Question Quality Impact Forecast** | **17,100 / 30,638 clarity questions (55.8%)** under grounded tags become signal-targetable (directional) |

## Validation — Coverage Delta

| Metric | Before | After | Δ | Target | Result |
|---|---:|---:|---:|---:|:--:|
| Signal coverage (tags) | 7.6% | **63.1%** | +55.5 | > 60% | **PASS** |
| Concern coverage | 42.8% | **90.4%** | +47.6 | > 85% | **PASS** |
| Ontology Health | 60.8 | **67.8** | +7.0 | > 67 | **PASS** |

> Coverage is measured as the union: a tag counts as grounded if it has native atomic signals (`relational_bridge_tag`) **or** a row in the new grounding table. Health swaps only the signal layer in WC-1's 8-layer mean; the other 7 layers are held at their WC-1 values, so the +7.0 is attributable purely to signal grounding. These figures reproduce the WC-1A GREEN forecast exactly (63.1% / 90.4% / 67.8), confirming the implementation matches the approved plan.

## Verification — guarantees enforced

| Check | Result | Evidence |
|---|:--:|---|
| No signal fabrication | **OK** | 0 grounding rows reference a non-existent `atomic_signal_id` |
| No signal duplication | **OK** | 14,402 atomic rows = 14,402 distinct (bridge_tag, atomic_signal_id) pairs; `UNIQUE` per tag |
| No new signals | **OK** | `capadex_atomic_signals` 15,972 → 15,972 |
| No concern modification | **OK** | `capadex_concerns_master` 2,489 → 2,489 |
| No bridge-tag modification | **OK** | distinct bridge tags 328 → 328; no `relational_bridge_tag` altered |

A signal may legitimately ground more than one tag (reuse) — uniqueness is enforced *within* a tag, never across tags.

## Scope boundary (important)

WC-1B creates the **linkage data and validates coverage**. It does **not** wire this grounding into the live runtime signal-activation / resolver path — that remains a deliberate follow-up (consistent with WC-1A). The Resolver and Question-Quality figures above are therefore **directional forecasts**, not measured runtime accuracy deltas; they are realized only once runtime wiring lands.

## Reversibility

`DELETE FROM capadex_bridge_tag_signal_grounding WHERE provenance='wc1a_green';`
`DELETE FROM capadex_bridge_tag_family_grounding WHERE provenance='wc1a_green';`
(or `DROP TABLE` both). The script is idempotent — re-running reconciles `wc1a_green` rows in place (no duplication/drift).

## Deliverables (`audit/wc1b/`)

- `signal_grounding_summary.json` — full counts, coverage, success criteria, verification, forecasts.
- `signal_linkage_audit.csv` — per (tag, family): similarity, atomic count, evidence strength, sample signals.
- `coverage_delta_report.md` / `.json` — before/after deltas + verification.

---

**STOP — awaiting approval. Changes are additive and reversible. No runtime wiring, no deploy.**

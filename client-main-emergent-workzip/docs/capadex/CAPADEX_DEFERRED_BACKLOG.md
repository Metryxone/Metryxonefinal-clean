# CAPADEX — Deferred Backlog

> Consolidation of approved-but-deferred and future work. Nothing here is executed; this is the
> prioritized backlog for post-v0.9 development. All items are gated, reversible, and behind the
> AQ-2R measurement gate.

## Priority Ladder (ROI = yield × coverage ÷ complexity)

| # | Item | Wave | Status | Expected benefit |
|---|---|---|---|---|
| P1 | Context + Archetype (shipped) → **verify & lock** | Wave 1 | Approved (shipped) | Lock the +145% cov-weighted gain; routing +39–87 pp |
| P2 | **Capability diversification** (coverage-gated) | Wave 2 | Approved w/ mods | +0.30–0.35 cov-weighted where present |
| P3 | **Signal expansion** (grounding-conditional) | Wave 3 | Approved w/ mods | Modest, localized; unblocks signal-driven routing |
| P4 | **Behaviour diversification** (curated) | Wave 4 | Not approved as text-only | Realizes ~7% headroom via curation |
| P5 | **Context-corpus** (Academic / Competitive Exam) | Wave 4 | Approved w/ mods | Closes the Competitive Exam routing-0 gap |

## 1. Signal Expansion

- **3a — 119 weak-grounded tags:** low-confidence, two-key (grounding + per-question evidence)
  assignment; UNCLASSIFIED below the 60% coverage gate.
- **3b — 25 ungrounded tags (incl. flagship pools):** build **WC-class grounding first**, then
  backfill. **No mass-backfill on ungrounded flagship pools** (= fabrication). Risk: High if rushed.

## 2. Capability Diversification

- Enrich **≥60% text-coverage tags first**; broaden evidence beyond question stems (options, anchors,
  curated facets) to lift the ~49% text ceiling. Deterministic, quality-gated, UNCLASSIFIED on no
  evidence. Risk: Medium.

## 3. Behaviour Diversification

- **Curated authoring track** (not text-only auto-enrichment — ~10% coverage proves text alone is
  insufficient). The quality gate rejects generic fallbacks (< 15) to surface weak coverage honestly.
  Risk: Medium.

## 4. Additional Routing Intelligence

- Close the **context corpus gap** — author Academic / Competitive-Exam context into the generic
  pools (today routes 0). Extend the QRS router with the locked context taxonomy. Add a
  **Diversity-Standards CI gate (≥ 0.30 continuous)** so differentiability can't regress.

## 5. Advanced Question Intelligence

- Promote **QIS V2** to the live registry once Waves 2–4 supply the 8-dimension inputs (gate on
  coverage-weighted). Expand registry governance analytics (low-signal/duplicate triage on
  system-wide usage). Per-question distinctness monitoring within buckets.

## 6. Future Research Areas

- WC-class signal grounding methodology for generic/abstract pools.
- Realizing behaviour headroom from interaction telemetry (not just question text).
- Cross-tag context routing precision tuning per readiness context.
- Longitudinal differentiability — does per-question differentiation improve drift/growth detection?

## Expected Benefits (summary)

Reaching the success metrics moves repository differentiability from **0.096 → ≥0.30 (target)** while
holding non-fabrication, raising QIS V2 mean (+10 target), signal coverage (55.8% → 70% target), and
routing precision (+50 pp target) — the gate to **CAPADEX v1.0**.

## Success-Metric Gates (carried from C-1AR)

| Metric | Baseline | Min | Target | Stretch |
|---|---|---|---|---|
| Differentiability (cov-weighted) | 0.096 | 0.18 | **0.30** | 0.45 |
| QIS V2 mean | 51.1 | +5 | +10 | +15 |
| Signal coverage % | 55.8 | 62 | 70 | 80 |
| Capability diff coverage % | 0 | 40 | 55 | 70 |
| Routing precision (pp) | 0 | 30 | 50 | 70 |
| Trust score | 51.1 | +3 | +6 | +10 |

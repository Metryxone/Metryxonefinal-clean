# Phase 6 — Validation Loop Engine Activation

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 6
**Date:** 2026-06-23 · Additive / reversible / flag-gated. Evidence = `count(*)` + memory `predictive-intelligence.md`, `employer-tig-architecture.md`.

## Target loop
```
Assessment → Hiring → Performance → Promotion → Retention → Success Outcomes
   → Validation Models → Competency Calibration
```

## Current state (evidence)
- Calibration machinery is **built**: TIG Brier / ECE / isotonic-PAV / beta-binomial; cold_start → provisional(<30) → calibrated(≥30).
- **Zero realized outcomes**: `tig_*` 0; no hiring/performance/promotion/retention outcome rows → calibration is *starved*, not missing.
- Predictive engines (dropout/burnout/employability/leadership/trajectory) run on-demand and **compose descriptive layers** (never black-box) but currently have no outcome feedback edge.

## Core rule (from spec): **no predictive model operates without validation evidence.**

## Gap closure (additive, flag `FF_VALIDATION_LOOP`, default OFF)
1. **Outcome capture** — new additive tables `outcome_events` (hiring/promotion/performance/retention; subject, event_type, value, occurred_at, source, provenance). Explicit POST writes only — never auto-synthesized.
2. **Outcome→validation wiring** — feed captured outcomes into the existing TIG calibration loop (≥30 → `calibrated`).
3. **Validation dashboards** — read-only aggregates of predicted-vs-realized (Brier/ECE over real outcomes).
4. **Predictive accuracy tracking** — per-model accuracy series; until ≥N outcomes exist, models surface `unvalidated` explicitly (honesty gate).

## Architecture / Data / API impact
- **Architecture:** new `services/validation-loop-engine.ts` + capture routes; reuses existing TIG calibration math. No predictive engine edits.
- **Data:** new additive `outcome_events` (+ optional `validation_runs`) tables; lazy ensure-schema on write path. No existing table altered.
- **API:** additive `POST /api/v2/outcomes/capture`, `GET /api/v2/validation/dashboard`, `GET /api/v2/validation/accuracy/:model` (flag-OFF 503).

## Rollback strategy
- Flag OFF → routes 503; predictive models behave exactly as today (still labelled honestly). Drop new tables to remove. No existing data touched.

## Success metrics
- # real outcomes captured (0 → N); # models moving cold_start → provisional → calibrated.
- 0 predictive outputs presented as validated without ≥ threshold outcomes (honesty invariant).

## Expected maturity gain
- Validation/calibration: ~20% → ~50% structurally; true accuracy maturity is **data-gated** (requires real outcome volume over time) and must not be overclaimed.

## Evidence ledger
- Counts → live `count(*)`, 2026-06-23. Calibration math → memory `predictive-intelligence.md`, `employer-tig-architecture.md`. "Zero realized outcomes" asserted from trace. Maturity = estimate; accuracy explicitly data-gated.

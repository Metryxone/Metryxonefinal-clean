---
name: EI History & Progression (competency-ei Phase 3.11)
description: Canonical trend engine + history/progression composition over persisted EI snapshots; honesty invariants and the two history sources.
---

# EI History & Progression (Phase 3.11)

Additive, flag-gated (`competencyEi`/`FF_COMPETENCY_EI`), compose-never-recompute, never-throws, byte-identical flag-OFF (ZERO new DDL — read-only over tables whose DDL already lives on approved write paths).

## Two distinct history sources (don't conflate)
- **Assessment history** = `employability_scoring_runs` via `listScoringRuns` → `{provisioned, runs[]}`. Headline scoring runs.
- **EI history** = `ei_profile_snapshots` via `listEiProfileHistory` (headline rows) AND `listEiProfileSnapshotsWithProfile` (headline + FULL `profile` JSONB). The profile JSON carries `dimension_scores[] {ei_dimension_id, dimension_name, score|null, band|null}` — this is the ONLY per-dimension history source.

**Why:** snapshots are written only by the explicit POST `/snapshot` path (manual, append-only, no unique constraint). Most demo subjects have 0 snapshots → progression/trend honestly `insufficient_history`. That is correct, not a bug.

## Canonical trend math — ONE impl
`computeMetricTrend(series:{ts,value|null}[], {stableBand=1.0, higherIsBetter=true})` lives in `backend/services/trend-engine.ts`. `computeEiTrend`/`EiTrend`/`EiTrendPoint` were MOVED here; `ei-dashboard-engine.ts` imports + re-exports them so the 3.10 dashboard output is unchanged. Never add a second trend impl — import from trend-engine.

**Polarity trap:** risk-style dimensions are `higherIsBetter:false` → a RISING series maps to `declining`. Get this wrong and risk improvements read as regressions.

## Honesty invariants (enforced, do not relax)
- `>=2` MEASURED (non-null) points required; else `status='insufficient_history'`, direction/delta NULL.
- Per-dimension trend only where that dim is measured `>=2x`; a dim that is NULL in every snapshot stays `insufficient_history` — NEVER 0.
- Coverage (rows exist) vs measured (non-null value) are SEPARATE counts in every payload.

## Composition layers (never recompute)
- `ei-history-engine.ts` `buildEiHistory` composes the two sources + `buildDimensionSeries` (pure pivot of snapshot profiles into per-dim point series). Each DB call guarded → degrades to honest empty.
- `progression-engine.ts` `buildProgression` composes `buildEiHistory` + `computeMetricTrend`: overall (net delta + step transitions) + per-dim growth/decline/stable rollups.

## Routes
GET `/api/competency-ei/{history,progression,trends}/:subject` — guard order `gate → requireAuth → requireSuperAdmin → wrap`. Flag-OFF → 503 before any DB touch; unauth → 401.

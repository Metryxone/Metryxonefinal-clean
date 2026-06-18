# WC-P2 — D03: Behavior Intelligence Readiness
Generated: 2026-06-10T13:48:42.823Z

## Verdict: ⚠️ PARTIAL — Engine Exists, 0 Users Scored

System A provides a genuine behavioral intelligence layer derived from observable
CAPADEX session behaviour. The formula is deterministic and honest.

## Engine State

| Dimension | Formula | Inputs Available | Computable Now |
|-----------|---------|-----------------|----------------|
| Consistency | completed ÷ total | 9/27 sessions | ✅ Yes |
| Persistence | % revisited concerns + completion bonus | 27 sessions, 5 users | ✅ Yes |
| Attention | avg seconds/item (band scored) | time_taken_s available in sessions | ✅ Yes (if timed) |
| Adaptability | score improvement across stage order | score col available | ✅ Yes |
| Velocity | completed sessions/week | created_at available | ✅ Yes |

## Data Gap

| Metric | Value |
|--------|-------|
| CAPADEX sessions available for scoring | 27 |
| Unique users eligible for LBI calculation | 5 |
| Users actually scored (lbi_scores) | 0 |
| calculateLBI() ever called | No — 0 lbi_scores rows |

**Root cause**: `POST /api/lbi/calculate` requires an explicit caller. No automatic
trigger exists — the engine is never called after CAPADEX session completion.

## Learning Style Coverage

| Style | Basis | Data Available |
|-------|-------|---------------|
| impulsive | avg <2s/item | ✅ time_taken_s in sessions |
| disengaged | consistency <35% | ✅ completion rate computable |
| persistent | persistence >55% | ✅ concern revisit computable |
| reflective | slow + low adaptability | ✅ computable |
| exploratory | ≥3 distinct concerns | ✅ concern_name available |

All 5 style branches are computable against existing CAPADEX data. The engine is
dormant, not broken.

## Behavioural Insights Table
- **behavioural_insights rows**: 0
- **Status**: 0 rows — manual admin CSV upload only; no automatic capture
- **Impact**: AI test generator personalization context is empty for all users

## Coverage vs Confidence
- **Coverage**: 100.0% of eligible users computable (5 users exist)
- **Confidence**: 0% — no user has been scored yet
- **Recommendation**: Trigger calculateLBI() on every CAPADEX session completion (post-completion hook) + backfill existing 5 users

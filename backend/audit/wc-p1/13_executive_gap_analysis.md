# WC-P1 — D13: Executive Gap Analysis

**Date**: 2026-06-10T13:27:06.692Z
**Overall Coverage**: 32% | **Overall Confidence**: 23%

---

## Scorecard Summary

| Dimension | Coverage | Confidence | Status |
|---|---|---|---|
| Assessment Readiness | 35% | 20% | ⚠️ PARTIAL |
| Question Bank | 30% | 25% | ⚠️ PARTIAL |
| Competency Framework | 20% | 15% | ❌ LOW |
| Employability Scoring | 65% | 40% | ⚠️ PARTIAL |
| Outcome Intelligence | 25% | 20% | ❌ LOW |
| Recommendations | 40% | 25% | ⚠️ PARTIAL |
| Career Routing | 20% | 15% | ❌ LOW |
| Reporting | 65% | 55% | ⚠️ PARTIAL |
| Personalization | 30% | 25% | ⚠️ PARTIAL |
| Longitudinal | 15% | 10% | ❌ CRITICAL |
| Commercial | 10% | 5% | ❌ CRITICAL |
| **OVERALL** | **32%** | **23%** | **⚠️ NOT READY** |

---

## Top 5 Blocking Gaps (by user impact)

### GAP-1: Formula Divergence — Two EI Scores Exist Simultaneously (CRITICAL)
**Impact**: Every user with an assessment score or education data sees two different EI numbers — the headline gauge (ignores assessment+education) and the modal breakdown (includes them). Undermines the product's core credibility.
**Root cause**: `employabilityEngine.ts` (6-dim) never unified with the 8-dim doc formula. Both were built independently.

### GAP-2: Longitudinal is Dead (0 Snapshots) (CRITICAL)
**Impact**: The CareerVelocityTab trajectory chart, evolution analytics, and "dominant mover" are all empty. Core product promise ("track your progress") is unfulfilled.
**Root cause**: `takeSnapshot()` exists but is never called automatically; no cron configured.

### GAP-3: Occupation Graph Too Sparse (25%) for Career Routing
**Impact**: Trajectory forecasts produce 0 milestones for most users. Role-fit scores are low-signal. Career routing (a documented core feature) is non-functional for production use.
**Root cause**: Seed data is minimal (30 occupations, 3 pathways). Expansion is an owner data action.

### GAP-4: Reference Data Thin (~1% of target)
**Impact**: 69 entities already unresolved; institution tier classification fails for most non-IIT/IIM inputs. Certified credentials mostly unrecognised.
**Root cause**: Phase 1 (reference tables) and Phase 2 (resolver upgrade) are documented as planned but not built.

### GAP-5: Competency Assessment Not Feeding Gauge Score
**Impact**: The single largest EI lever (25pts, documented as "strongest predictor") has zero effect on the headline score. The assessment CTA has no measurable EI impact for the user despite the documentation's emphasis.
**Root cause**: `useHybridEI` was built independently of the assessment flow; the two were never wired.

---

## What IS Ready for Free Consumer Launch

- EI gauge score displays on profile load ✅
- EI breakdown modal (8-dim) with rationale and CTAs ✅
- Improvement roadmap (generic) ✅
- Admin EI governance (ruleset management, calc log audit) ✅
- All EI routes registered and returning non-404 responses ✅
- Career Builder integration (EI score threaded to all tabs) ✅

The EI product is usable and not broken — the score is displayed, the breakdown is detailed, and the CTAs work. The gaps above are about accuracy, completeness, and trust rather than basic functionality.

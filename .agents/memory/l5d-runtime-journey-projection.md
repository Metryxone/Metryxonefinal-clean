---
name: WC-3 L5D Runtime Journey Projection
description: How journey projection composes onto outcome projection, and the honesty traps (downstream ceiling, fallback dilution, exam guard, dormant journey).
---

# WC-3 L5D — Runtime Journey Projection

Projects journeys onto every clarity question via Question→BridgeTag→Construct→Outcome→JourneyRoute, reusing ONLY existing assets (`wc3_outcome_models`, `wc3_journey_routes.model_affinities`, frozen crosswalk). Engine `services/wc3/journey-projection.ts` (pure) + script `scripts/wc3/build-journey-projection.ts` → 9 reports `audit/l5d-runtime/`. Additive; NOT wired into runtime.

## Durable lessons (non-obvious)
- **Journey reach is strictly downstream of outcome reach.** A question with no outcome cannot reach a journey → journey coverage EQUALS outcome coverage (here 80.3%). Do NOT force no-outcome questions onto the mentoring fallback — report them as honest orphans.
  - **Why:** journey fit = Σ(route affinity × outcome-model confidence); zero outcome → zero fit everywhere.
- **A 4th partial layer LOWERS the per-question completeness mean.** (stage+context+outcome+journey)/4 = 90.1% < the 3-layer 93.4%, because the journey layer inherits the 80.3% outcome ceiling. A "Layer-2 95%+" target is UNREACHABLE without lifting the upstream outcome ceiling — report honestly + add a conditional view (journey coverage among outcome-covered ≈ 100%). NEVER fabricate to hit the target.
- **The mentoring fallback has affinity for ALL 7 outcome models.** So every outcome-bearing question reaches ≥1 route (coverage), but concentration is diluted → journey_confidence is structurally low-banded (mean ~0.23, no HIGH band). That is a real property of the route catalog, not a defect — surface it, don't smooth it.
- **Mirror the live exam guard or you over-claim Competitive Exam.** `journey-intelligence.ts` only lets the corpus-pending `competitive_exam` be PRIMARY with DEDICATED EXAM_-prefixed evidence; else it's demoted to secondary (retained, never dropped). Without the guard the projection routed 5,696 q (18.6%) to exam on SHARED constructs (STRESS_MANAGEMENT/ACADEMIC_RECOVERY); with it, 1,640. Offline, "dedicated evidence" is a crosswalk-derived proxy (EXAM_-prefixed construct in the exam_readiness model), not per-session activated matched-constructs — document that approximation.
- **Dormant journey = honest finding.** `family_support` reaches 0 primary because its only outcome `family_wellbeing` is reached by 0 questions upstream (L5C). Report DORMANT; don't fabricate reach.
- **`ranked_journeys` contract:** primary first, then remaining by raw-fit order — so `ranked_journeys[0] === primary_journey` EVEN after an exam-guard demotion (otherwise the raw top (exam) misleads consumers).
- Reused L5C scoring without mutating the frozen `projectOutcome`: added pure export `outcomeModelConfidences(entry, models)` (per-model conf = baseConf × score/total) for the journey layer to compose on.

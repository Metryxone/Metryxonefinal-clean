# WC-P3 D09 — Personalization Readiness

> Generated: 2026-06-10T14:15:54.254Z  
> Verdict: **PARTIAL**

## Scores

| Axis | Score |
|------|-------|
| Structural Coverage | **55%** |
| Activation Confidence | **25%** |

### Coverage Rationale
useCareerBrain hook is real (5 API calls: competency/score, behavioural-memory, behavior-profile, behavior-graph, next-actions). career-behavior-adapter (CAPADEX→Career bridge) is real — pure transformer. Behavior graph service is real (getBehaviorGraph). Constraint engine (P3), Unified Action Engine (P4) pure functions exist. Well-architected degradation — never throws.

### Confidence Rationale
behaviouralMemory=0 → behavior graph dims empty for all users. next-actions returns [] (no behavioural_memory). CareerBrain activates but degrades heavily: behaviorGraph=null, bestNextActions=[], constraintEngine fires on heuristics only. 16 users have competency data (real personalization partial).

## Gaps

- [ ] behavior graph empty → behavior-based personalization degraded for all users
- [ ] bestNextActions returns [] (behavioural_memory=0)
- [ ] Constraint engine fires on heuristic rules only (no graph backing)
- [ ] CAPADEX session → career bridge requires non-null session_id on profile
- [ ] Personalization mostly heuristic; data-driven path blocked by empty behaviour tables

---
*Coverage = structural completeness; Confidence = real data activation (separate axes).*

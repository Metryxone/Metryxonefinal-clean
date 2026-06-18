# WC-P3 D03 — Career Recommendation Readiness

> Generated: 2026-06-10T14:15:54.250Z  
> Verdict: **PARTIAL**

## Scores

| Axis | Score |
|------|-------|
| Structural Coverage | **35%** |
| Activation Confidence | **15%** |

### Coverage Rationale
career_recommendations table exists with 24 rows. PIL Recommendation Intelligence (Phase 7) populates it. Recommendation engine (frontend + backend) exists. Next-actions route (behavioural-memory.ts) exists. HOWEVER: recommendations are CAPADEX session-keyed (session_id), not career-profile-keyed (user_id). A resolution bridge exists (career-behavior-adapter.ts resolves user_id → session_id via behavioural-memory time-series) but no Career Builder route or consumer queries career_recommendations by that path.

### Confidence Rationale
career_recommendations=24 rows from 1 CAPADEX session(s). No user_id column → rows not directly queryable by career profile. The user→session bridge exists architecturally but is data-starved (behaviouralMemory=0 rows). next-actions endpoint returns [] for all users.

## Gaps

- [ ] career_recommendations keyed on session_id not user_id — no Career Builder consumer queries it by user
- [ ] Resolution bridge (behavior-adapter user_id→session_id) exists but inactive: behavioural_memory=0 rows
- [ ] behavioural_memory: 0 rows → next-actions endpoint returns []
- [ ] Recommendation engine heuristic (regex/keyword), not graph-backed
- [ ] PIL library recommendations (capadex_intervention_recommendations) not surfaced in Career Builder UI

---
*Coverage = structural completeness; Confidence = real data activation (separate axes).*

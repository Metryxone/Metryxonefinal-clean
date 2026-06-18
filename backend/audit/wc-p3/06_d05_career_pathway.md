# WC-P3 D05 — Career Pathway Readiness

> Generated: 2026-06-10T14:15:54.251Z  
> Verdict: **PARTIAL**

## Scores

| Axis | Score |
|------|-------|
| Structural Coverage | **45%** |
| Activation Confidence | **20%** |

### Coverage Rationale
M3 market intelligence routes (30+ endpoints) real, with data-availability checks in handlers (NOT auth-gating — data checks prevent 500s, not unauthorised access). mobility_career_paths(3), m3_career_paths(3), occupation_pathways(3), mobility_development_pathways(5) exist with seed data. pathway-engine service exists. Pathway tab (PathwaysTab) exists. pil_growth_pathways(110) is a rich PIL catalog. WOS market forecasts(3).

### Confidence Rationale
m3_career_paths=3 (seed data only). No user-specific pathway assignments. No pathway recommendations personalized per user. wos_market_signals=54 real signal rows (not personalized).

## Gaps

- [ ] m3_career_paths: 3 rows (seed data only, not user-personalized)
- [ ] No pathway assignment → user link
- [ ] PathwaysTab displays static/seed content only
- [ ] PIL growth pathways (110) disconnected from CareerBuilder pathway surface
- [ ] WOS market forecasts: only 3 rows

---
*Coverage = structural completeness; Confidence = real data activation (separate axes).*

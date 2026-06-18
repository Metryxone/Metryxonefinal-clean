---
name: EI Formula Authority (8-dim)
description: Authoritative EI formula is 8-dim in employabilityEngine.ts; classifiers are exported from there and must not be duplicated inline.
---

# EI Formula Authority

The Employability Index has ONE authoritative scoring engine: `frontend/src/lib/engines/employabilityEngine.ts`.

## The 8-dimension formula (sums to 100)

| Dimension     | Max | Field                 |
|---------------|-----|-----------------------|
| Assessment    |  25 | `assessmentScore`     |
| Experience    |  20 | `experienceScore`     |
| Education     |  15 | `educationScore`      |
| Technical     |  15 | `technicalScore`      |
| Certifications|  10 | `certScore`           |
| Soft Skills   |   8 | `softScore`           |
| Projects      |   4 | `projectScore`        |
| Profile       |   3 | `completenessScore`   |

## Rules

- **Single source**: All classifier helpers (`classifyEducation`, `classifyExperience`, `classifyCertifications`, institution/degree/cert tier helpers) live in `employabilityEngine.ts` and are exported. Never duplicate them inline in `CareerBuilderPage.tsx` or anywhere else.
- `eiScore` in CareerBuilderPage = `eiBreakdown.total` (the useMemo that calls the engine classifiers directly). This is the gauge-driving score.
- `useHybridEI.preview.score` = `runEmployabilityEngine({ profile }).score` — these two values are now identical (same formula).
- Backend `computeOfficialEI` in `backend/services/ei-engine.ts` is a separate 6-dim entity-resolved score. It is NOT the gauge driver. Do not change the frontend formula to match the backend formula.
- `CareerMemoryTab` snapshot body uses the `eiScore` prop (the gauge score), NOT `brain.marketReadiness`.
- `DashboardIntelligence.ts` sparkData uses the 8-dim maxes (25/20/15/15/10/8/4/3).

**Why:** There were two conflicting formulas: the 6-dim `runEmployabilityEngine` (used by `useHybridEI.preview`) and the 8-dim inline `eiBreakdown` (the actual gauge driver). The 8-dim inline formula is the authoritative one per the product spec. The engine was rewritten to match it; the inline duplicate was removed.

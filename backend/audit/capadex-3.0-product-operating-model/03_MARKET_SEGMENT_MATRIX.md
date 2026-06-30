# 03 · Market Segment Matrix

Per-segment support classified **IMPLEMENTED / PARTIAL / DORMANT / MISSING**, with repo evidence.
"Implemented" = a dedicated/specialized experience exists; "Partial" = served only by a generic capability or
a thin surface; "Missing" = no meaningful path.

## Education
| Segment | Evidence | Status |
|---|---|---|
| School students (K-12) | `pages/K12SchoolsPage.tsx`; student/parent test flows | **IMPLEMENTED** |
| JEE / NEET / CUET / BITSAT aspirants | `pages/CompetitiveExamPortal.tsx` (21 exam-term hits), `LearningPathsPage.tsx` (17), `StressCheckPage.tsx`, `CoachingPage.tsx` | **IMPLEMENTED (dedicated portal)** |
| Olympiads / other competitive exams | same Competitive Exam portal + learning paths | **PARTIAL** (covered generically within the exam portal, not per-exam specialized) |
| College students | Career Builder, campus-placement engine, student competency | **IMPLEMENTED** |

## Career
| Segment | Evidence | Status |
|---|---|---|
| Freshers | Career Launchpad / Fresher Hub (`fresherHub` namespace) | **IMPLEMENTED** |
| Job aspirants | Career Builder + job substrate (`job_postings`), talent-match | **IMPLEMENTED** |
| Career transition | experience-switcher / stage routing in Career Builder | **IMPLEMENTED** |
| Professionals | competency runtime + career intelligence | **IMPLEMENTED** |

## Enterprise
| Segment | Evidence | Status |
|---|---|---|
| Employees | competency assessment + EI + readiness | **IMPLEMENTED** |
| HR / recruiters | Employer Portal (7 `employer_*` tables), hiring funnel, interview intel | **IMPLEMENTED** |
| Managers | manager-facing views exist but packaging unclear (`PC-4` finding) | **PARTIAL** |
| L&D | competency-framework admin, question factory | **PARTIAL** (admin tooling, no dedicated L&D product surface) |
| Leadership | exec/leadership reporting present; no dedicated leadership journey | **PARTIAL** |

## Public sector / social
| Segment | Evidence | Status |
|---|---|---|
| Government | sector references in onboarding/seed only | **MISSING** (no dedicated experience) |
| Healthcare | sector references only | **MISSING** (no dedicated experience) |
| NGO | institutional-intelligence (MX-302H) names NGO; no dedicated vertical | **PARTIAL (sector tag)** |

## Influencers / supporters
| Segment | Evidence | Status |
|---|---|---|
| Parents | `UnifiedParentDashboard`, `ParentChildGoals`, `ParentEducationPlanner`, `ParentConsentApprovePage`, consent flow | **IMPLEMENTED** |
| Teachers | `TeacherCounsellorSurvey.tsx` (survey only) | **PARTIAL** |
| Counsellors | survey + (clinical lens absent — `PC-2`) | **PARTIAL** |
| Coaches | `CoachingPage.tsx` + mentor surfaces (coach≈mentor mapping) | **PARTIAL** |
| Mentors | full suite (marketplace/profile/agreement/dashboard/session-notes) | **IMPLEMENTED** |
| Institutes / Universities | `UnifiedInstituteDashboard`, `InstituteTestWorkflow`, k-anon institutional intelligence | **IMPLEMENTED** |

## International
| Segment | Evidence | Status |
|---|---|---|
| Multilingual | `i18next` wired in `main.tsx` + multiple pages | **PARTIAL** (framework present; translation-content depth unverified) |
| Multi-region / currency | `global-intelligence.ts`, `region-native-market-seed.ts`, `global-competency-engine.ts`, multi-currency | **PARTIAL** (infra exists; AFRICA/LATAM honest-empty per memory) |

## Summary
- **Strong (IMPLEMENTED): 9 segments** — K-12, exam aspirants, college, freshers, job aspirants, transition,
  professionals, employees, HR, parents, mentors, institutes.
- **PARTIAL: managers, L&D, leadership, Olympiad-specialized, teachers, counsellors, coaches, NGO, multilingual, multi-region.**
- **MISSING (dedicated): government, healthcare.**
- **Recommendation:** treat segment *depth* (not breadth) as the product-maturity lever; do **not** build new
  verticals pre-launch — prioritize the partials that already have substrate (faculty, teachers/counsellors,
  L&D packaging) and explicitly **de-scope** government/healthcare from launch claims.

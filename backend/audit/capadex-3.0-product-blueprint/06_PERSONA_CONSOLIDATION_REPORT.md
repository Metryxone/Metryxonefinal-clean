# 06 · Persona Consolidation Report

ONE persona architecture. Consolidates duplicates, classifies coverage (IMPLEMENTED/PARTIAL/MISSING), grounds
each in repo evidence. Carried from Operating-Model cert `06`/`07` and reconciled with the terminology rule
**Persona (market axis) ≠ Role (auth axis)** and **Mentor≡Coach substrate**.

## Canonical persona architecture (grouped)
### Education
| Persona | Evidence | Coverage |
|---|---|---|
| School student (K-12) | `K12SchoolsPage.tsx`, student/parent flows | **IMPLEMENTED** |
| Competitive-exam aspirant | `CompetitiveExamPortal.tsx`, learning paths | **IMPLEMENTED** |
| College student | Career Builder, campus placement | **IMPLEMENTED** |
| Faculty | nested in Institute dashboards | **PARTIAL** (nested, not first-class) |
| Teacher / Counsellor | `TeacherCounsellorSurvey.tsx` (survey only) | **PARTIAL** |

### Career
| Fresher / job aspirant | Career Launchpad / Fresher Hub | **IMPLEMENTED** |
| Professional / career-transition | competency runtime, career intelligence | **IMPLEMENTED** |

### Enterprise
| Employee | competency + EI + readiness | **IMPLEMENTED** |
| HR / recruiter | Employer Portal (7 `employer_*`), hiring funnel | **IMPLEMENTED** |
| Employer (org) | employer onboarding, job store | **IMPLEMENTED** |
| Manager / Leadership | views exist, packaging unclear | **PARTIAL** |
| L&D | admin tooling only, no L&D product surface | **PARTIAL** |

### Support / influencer
| Parent | `UnifiedParentDashboard`, consent flow | **IMPLEMENTED (segment)** / **PARTIAL (journey tail)** |
| Mentor **≡ Coach** | mentor marketplace/profile/agreement/dashboard; coach maps to same substrate | **IMPLEMENTED (segment)** / **PARTIAL (journey tail)** |
| Institute / University admin | `UnifiedInstituteDashboard`, k-anon intelligence | **IMPLEMENTED** |

### Public sector / social
| Government | sector references in seed only | **MISSING (dedicated)** |
| Healthcare | sector references only | **MISSING (dedicated)** |
| NGO | named in MX-302H, no dedicated vertical | **PARTIAL (sector tag)** |

### Clinical
| Psychologist / clinical counsellor | none | **MISSING (dedicated lens)** |

## Duplicate consolidations made
1. **Mentor + Coach → ONE substrate, two market labels** (code-confirmed shared substrate). Do not count as two
   independent products.
2. **Teacher + Counsellor → one survey-only surface today** (jointly partial).
3. **Manager + Leadership → one enterprise-views cluster** (jointly partial, packaging gap).

## Two-axis honesty (carried from prior cert)
- **Segment coverage** (does a dedicated experience exist?) vs **Persona-journey completeness** (is the full
  journey, incl. completion + continuous-improvement, present?). Parent and Mentor are **IMPLEMENTED as
  segments** but **PARTIAL as journeys** (✗ completion/continuous) — the same back-half gap as everywhere else.

## Coverage summary (honest)
- **First-class personas: ~9** (students×3, fresher, professional, employee, HR, employer, institute).
- **Partial: faculty, teacher/counsellor, manager/leadership, L&D, parent-journey, mentor/coach-journey, NGO.**
- **Missing (dedicated): government, healthcare, psychologist/clinical.**
- **Recommendation:** mature the *partials that already have substrate* (faculty, teacher/counsellor, L&D
  packaging) before building new verticals; **do not claim government/healthcare/clinical** until built.

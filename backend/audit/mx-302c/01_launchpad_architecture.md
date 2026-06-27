# MX-302C — Career Launchpad Dashboard: Architecture & Composition Map

_Generated 2026-06-27T03:43:40.102Z · read-only · flag `careerLaunchpad` currently **ON**_

The Career Launchpad is an **enterprise-grade, fully responsive dashboard** that answers
three questions at a glance — *where am I, what should I do next, how employable am I?*
It is **composition only**: every widget reads a metric/engine that ALREADY exists. No new
metric engineering is introduced. It is gated by the same `careerLaunchpad` flag as MX-302A;
flag-OFF renders the existing Fresher dashboard (`FresherHubTab`) byte-identically.

## 15 widgets → existing source (15 distinct; 16 placements across 3 questions)

| Question | Widget | Composes (existing source) |
|----------|--------|----------------------------|
| Where am I | Career Readiness | useCareerBrain (behavioural + EI/competency fallback) |
| Where am I | Employability Index | employabilityEngine / useHybridEI → EIGauge |
| Where am I | Placement Readiness | Fresher Readiness Index (10-item checklist) |
| Where am I | Competency Progress | competency runtime / longitudinal (via brain.competencyActivation/dimensions) |
| Where am I | Learning Progress | useCareerBrain (learningReadiness + learningPriority) |
| Where am I | Career Timeline | Campus Drive Tracker chronology (localStorage) |
| Where am I | Career Passport | passportClient snapshot (EI band + completeness) |
| How employable | Employability Index | shared with "Where am I" (rendered once per section) |
| How employable | Resume Score | Resume Studio / transparent CV-field completeness |
| How employable | Interview Readiness | useCareerBrain (interviewReadiness) |
| What to do next | Daily AI Brief | MX-302B /guidance (honest LLM→rule-based degradation) |
| What to do next | Recommendations | MX-302B recs → brain.bestNextActions fallback |
| What to do next | Weekly Goals | MX-302B weekly_goals → weeklyActionEngine fallback |
| What to do next | Upcoming Tasks | Readiness checklist gaps + job-tracker pipeline |
| What to do next | Internship Progress | Project Portfolio (Internship items, localStorage) |
| What to do next | Placement Progress | Campus Drive Tracker stages (localStorage) |

- **Where am I**: 7 widgets · **How employable**: 3 · **What to do next**: 6.
- The Employability Index appears under both "Where am I" and "How employable" (counted once → 15 distinct widgets).

## Honesty axes (kept separate, never composited)
- Every widget renders an explicit **EmptyState** when it has no underlying data (`null ≠ 0`); no fabricated scores.
- The Daily AI Brief inherits MX-302B honest degradation: no LLM key → deterministic rule-based brief, labelled "Rule-based".
- Device-local widgets (Timeline / Internship / Placement Progress) read the same Fresher localStorage state and SAY SO; moving that state to the backend is explicit carry-over (out of scope).

## Responsive / mobile
- Responsive widget grid (1→2→3 columns at md/xl) on shared `design-system/tokens`.
- Mobile: section tabs (Dashboard / Where am I / What to do next / How employable / Toolkit) via the shared `TabLayout` (horizontally scrollable), so phones get one focused section at a time rather than a squeezed desktop.
- The full Fresher toolkit (Campus Drives, Projects, Aptitude, First-Job Guide) is preserved unchanged behind the "Toolkit" tab.

## Audit (step 6 — metadata only)
- `POST /api/career-launchpad/telemetry` (flag-gated, requireAuth) records dashboard render + a per-widget availability map through the shared redacting platform-audit logger. No user content or scores are logged — counts + booleans only.

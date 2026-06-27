# MX-302D — Founder Report: Student Career Builder Exposure

_Generated 2026-06-27T04:03:34.328Z · read-only · flag `studentCareerBuilder` = **OFF**_

## Success-criteria checklist

| Criterion | Result | Evidence |
|-----------|:------:|----------|
| Flag default OFF / byte-identical when OFF | ✅ PASS | studentCareerBuilder defaults false. Flag-OFF: StudentDashboard "Career Intel" → student-career-portal (unchanged), CareerBuilderPage renders career-seeker framing, the probe reports {enabled:false}. No schema/DDL/persistence introduced. |
| All 10 features reachable via the SAME existing surfaces | ✅ PASS | 10/10 requested features each map to an existing surface + engine/route (no reimplementation): Best Fit Roles, Career Paths, Alternative Careers, Future Skills, Industry Comparison, Skill Gap, Learning Roadmap, Salary Insights, Career Timeline, Promotion Simulation. |
| No engine / route / page duplication | ✅ PASS | Students use the shared CareerBuilderPage, its hooks (useCareerBrain, useHybridEI) and the existing /api/career/* + /api/competency/* engines. The only new backend surface is a cheap un-gated flag probe; no metric is computed by MX-302D. |
| First-class student entry (not a teaser/URL hack) | ✅ PASS | When ON, the StudentDashboard Quick Actions expose "Career Builder" → career-builder directly. Existing StudentCareerPage CTAs remain. Login default landing intentionally unchanged (students keep exams/LBI as their home; Career Builder is a first-class action FROM the dashboard). |
| Student-framed Employability Dashboard composes existing surfaces | ✅ PASS | Reuses the existing Career Builder dashboard tab (MX-302C Launchpad when careerLaunchpad is ON) — EI, skill gap, Role DNA, recommendations — with student framing. No competing dashboard or new metric engine. |
| Honest degradation inherited (null ≠ 0, no fabrication) | ✅ PASS | Market / salary / future surfaces depend on a populated market_intelligence substrate and AI guidance needs an LLM key; where absent, students see the SAME honest empty/degraded states as career seekers. No fabricated recommendations. |

## Verdict: **STRUCTURAL PASS**

Structural = students reach the full, existing Career Builder as a first-class destination
behind the `studentCareerBuilder` flag; all 10 features are served by the SAME engines/routes
career seekers use (provenance, not reimplementation); flag-OFF is byte-identical; the
Employability Dashboard composes existing surfaces; and honest degradation (null≠0) is inherited.

### Live adoption substrate (separate axis — honest, not composited into the verdict)
- Student / campus_student users in the shared DB: 0
- `career_seeker_profiles` table present (shared profile substrate students write to): yes
- `market_intelligence` rows (drives market / salary / future surfaces): _null (substrate unreadable — honest gap, not 0)_
- `onto_role_competency_profiles` rows (drives Role-DNA fit / Best-Fit Roles): 76

Low/zero adoption or a thin market substrate is expected and honest pre-launch — students see the
SAME honest empty/degraded states career seekers do until the flag is enabled and the substrate is
populated. No metric is fabricated to make the experience look fuller than the data supports.

## STOP — founder approval required before merge/deploy (per project convention).

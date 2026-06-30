# 3 · Persona Coverage Matrix

Measured from registration enums, role/account_type mapping, experience-routing, and persona-keyed
dashboards/assessments. **Honest framing:** "SUPPORTED" means a first-class registration → assessment →
dashboard path exists in code; it does **not** assert the path is outcome-validated (no production data yet).

| Persona | Status | Evidence | Enhancement opportunity |
|---|---|---|---|
| School Student | **SUPPORTED** | `Registration.tsx` role `student`; `students` table; `psychometricAgeBands` A–E1 (age-gated LBI/SDI); `StudentDashboard.tsx` | age-band UX polish; parental-consent clarity (DPDP) |
| JEE / NEET / CUET Aspirant | **SUPPORTED** | `CompetitiveExamPortal.tsx` `EXAM_CONFIG` (JEE_MAIN/ADV, NEET, CUET) — readiness scores, chapter trackers, peer benchmarks | wire readiness scores to real cohort data once traffic exists |
| Competitive Exam Aspirant (GATE/CAT/EAMCET…) | **SUPPORTED** | same `EXAM_CONFIG` (GATE, CAT, EAMCET) | broaden exam configs; honest "no cohort yet" states |
| College Student | **SUPPORTED** | `experience-routing.ts` stage `graduate`; `FresherHubTab.tsx`; Career Launchpad + placement tracking | complete builder/roadmap write-paths (journey #4 partial) |
| Job Aspirant / Fresher | **SUPPORTED** | `Registration.tsx` `career_seeker`; Employability Index™; skill-gap roadmaps | close learning/intervention execution loop |
| Working Professional | **SUPPORTED** | `experience-routing.ts` `mid-career` → Career Command Center | market-intel surfaces depend on data feeds — validate sources |
| HR / Recruiter | **SUPPORTED** | `Registration.tsx` `corporate`; `EmployerPortalPage.tsx`; talent-matching engine | strongest journey; decompose the 10k-line monolith (UX debt) |
| Manager | **SUPPORTED** | `experience-routing.ts` `senior-leadership` → Leadership Studio | confirm self-serve vs enterprise-tier gating |
| Executive | **SUPPORTED (tier-gated)** | `experience-routing.ts` `executive` → Executive Studio; PAIE forecasting | much strategic-risk capability is enterprise-tier, not self-serve — clarify packaging |
| Teacher / Faculty | **PARTIAL** | `registerFacultyRoutes`; `faculty` role; dashboard nested inside `UnifiedInstituteDashboard` | promote faculty to a first-class dashboard surface (currently nested/inferred) |
| Parent | **SUPPORTED** | `UnifiedParentDashboard.tsx`; `parents` + `parent_student_links`; multi-child LBI insights + consent | consent UX + cross-child comparison polish |
| Psychologist / Counsellor | **SUPPORTED (as Mentor)** | `OnboardingRegisterPage.tsx` entity `mentor`; `MentorDashboardPage.tsx`; specialization fields | "psychologist" is a specialization within Mentor — consider an explicit clinical lens if targeted |
| NGO | **SUPPORTED** | `OnboardingRegisterPage.tsx` entity `ngo` (FCRA/registration fields); `NGODashboardPage.tsx` | social-impact reporting depends on program data feeds |

## Coverage summary
- **11 of 15 personas: SUPPORTED** (first-class path in code).
- **1 PARTIAL:** Teacher/Faculty (functional but nested under Institute dashboard rather than first-class).
- **1 nuance:** Psychologist is a *specialization* of Mentor, not a distinct persona surface.
- **0 fully MISSING** personas among the listed set.

## Persona enhancement themes (no new architecture)
1. **PC-1 [Medium]** Promote **Faculty** from a nested view to a first-class dashboard (reuse existing
   institute substrate; no new engine). *Customer impact:* institutional buyers expect a faculty seat.
2. **PC-2 [Low]** Add an explicit **Psychologist/Counsellor clinical lens** if that segment is targeted
   (currently subsumed under Mentor). *Risk:* scope creep — only if a real customer needs it.
3. **PC-3 [Medium]** Persona surfaces that depend on **cohort/market-data feeds** (exam readiness,
   professional market-intel, NGO impact) must show **honest "no cohort yet" states** until pilot traffic
   exists — verify none silently render fabricated/zero values.
4. **PC-4 [Low]** Clarify **Executive/Manager packaging** (self-serve vs enterprise-tier) so the experience
   router never lands a user on a surface their entitlement can't populate.

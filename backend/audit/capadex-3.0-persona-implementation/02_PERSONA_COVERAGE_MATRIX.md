# 02 · Persona Coverage Matrix

Maps **every persona named in the Phase 1.2 spec** to its repository implementation across the layers defined in
`01` (L2 runtime key · L3 UI sub-persona · L4 cohort track · L1 blueprint persona · auth role). Coverage is the
*data/experience-exists* axis; Confidence/journey-completeness is reported separately in `06`. `—` = not present
(`null ≠ 0`).

**Legend:** ✅ dedicated · 🟡 collapsed/partial (shares another persona's substrate) · 🔲 served by auth-role product
(not an assessment persona) · ❌ absent.

## EDUCATION

| Spec persona | L2 `PersonaKey` | L3 sub-persona (id → legacyKey) | L4 track | L1 blueprint | Coverage |
|---|---|---|---|---|---|
| School Student | `student` | `school_primary/middle/high` → `student` | learner | **P1** | ✅ SUPPORTED (3 grade bands) |
| JEE Aspirant | `student` | `competitive_aspirant` → `student` | learner | **P2** | 🟡 collapsed → generic `student` bank |
| NEET Aspirant | `student` | `competitive_aspirant` (same) | learner | **P2** | 🟡 collapsed (no NEET-specific) |
| CUET Aspirant | `student` | *(no UI label; folded in "JEE/NEET/UPSC")* | learner | **P2** | ❌ no dedicated label → 🟡 falls to `student` |
| Competitive-Exam Aspirant | `student` | `competitive_aspirant` | learner | **P2** | 🟡 collapsed |
| College Student | `campus` | `campus_student` → `campus` | learner | **P3** | ✅ SUPPORTED |

## CAREER

| Spec persona | L2 `PersonaKey` | L3 sub-persona | L4 track | L1 blueprint | Coverage |
|---|---|---|---|---|---|
| Fresher | `jobseeker` | `career_explorer` → `jobseeker` | learner* | **P4** | 🟡 bank collapsed; product surface exists (Launchpad/Fresher Hub) |
| Job Aspirant | `jobseeker` | `career_explorer` → `jobseeker` | learner* | **P4** | ✅ SUPPORTED (`jobseeker` bank) |
| Working Professional | `professional` | `early_/mid_career_professional` → `professional` | professional | **P5/P6** | ✅ SUPPORTED |
| Career Transition | `jobseeker` | `career_transition_professional` → `jobseeker` | professional | **P5** | 🟡 collapsed → `jobseeker` bank |

\* `career_explorer` → `learner` track in `cohort-gating.ts:40`, but `legacyKey jobseeker`; "Fresher" framing comes
from the **product** layer (Career Launchpad), not a dedicated assessment bank.

## ENTERPRISE

| Spec persona | L2 `PersonaKey` | Served by | L1 blueprint | Coverage |
|---|---|---|---|---|
| Employee | — | competency/EI dashboards (auth role) | **P6** | 🔲 role-product (no assessment-persona key) — blueprint SUPPORTED |
| Manager | — | enterprise-views cluster | Manager/Leadership (partial) | 🟡 PARTIAL (packaging) |
| HR | — | Employer Portal (role `recruiter`) | **P7** | 🔲 role-product SUPPORTED |
| Learning & Development | — | admin tooling only | L&D (partial) | 🟡 PARTIAL (no L&D product surface) |
| Leadership | — | enterprise-views cluster | Manager/Leadership (partial) | 🟡 PARTIAL |

## OTHER

| Spec persona | L2 `PersonaKey` | L3 sub-persona | L5 PIL lens | L1 blueprint | Coverage |
|---|---|---|---|---|---|
| Parent | `parent` | `parent` → `parent` | `parent` | Parent (impl segment) | ✅ SUPPORTED (segment) / 🟡 journey tail (GAP-J2) |
| Teacher | `teacher` | `teacher_educator` → `teacher` | `teacher` | Teacher/Counsellor (partial) | 🟡 survey-only / dead-end journey (GAP-J1) |
| Counselor | `teacher` | `academic_counsellor` → `teacher` | `counselor` | Teacher/Counsellor (partial) | 🟡 collapsed → `teacher` key (distinct PIL lens only) |
| Institution | — | (auth role `institute`) | — | **P9** | 🔲 role-product SUPPORTED (`UnifiedInstituteDashboard`, k-anon) |

## Coverage tally (honest)

- **Assessment-persona keys (L2): 6** — total mapping from 14 UI sub-personas; **no orphan**.
- **Spec personas with a DEDICATED assessment bank: 5** of the individual/proxy set (`student`, `campus`,
  `jobseeker`, `professional`, `parent`) + `teacher` = **6 banks**.
- **Spec personas collapsed onto a shared bank (🟡): JEE/NEET/CUET/Competitive → student; Career-Transition →
  jobseeker; Counselor → teacher.**
- **Enterprise personas (Employee/Manager/HR/L&D/Leadership): served by auth-role products**, not assessment
  personas — blueprint-aligned (Persona≠Role); 3 marked PARTIAL by the blueprint itself.
- **No fabricated coverage:** CUET dedicated label = absent; clinical/government/healthcare = NOT CLAIMED.

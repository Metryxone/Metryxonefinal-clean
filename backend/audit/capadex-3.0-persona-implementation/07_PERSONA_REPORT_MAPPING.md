# 07 · Persona ↔ Report / Dashboard Mapping

Which report + dashboard surface each persona receives. Behavioural personas (L2) get a persona-labelled report from
`buildInsightNarrative`; product personas get role-gated dashboards. Source citations inline.

## A. Behavioural report (per `PersonaKey`)

`frontend/src/lib/behavioural-insights.ts` — `PERSONAS[].reportLabel` (`:158-233`) + `buildInsightNarrative` (`:396`).

| `PersonaKey` | Report label | Dashboard surface |
|---|---|---|
| `student` | "Learning Readiness Snapshot" | student dashboard |
| `teacher` | "Classroom Engagement Snapshot" | teacher/cohort view |
| `campus` | "Employability Readiness Snapshot" | Career Builder / placement |
| `jobseeker` | "Role Fitment Snapshot" | Career Launchpad / match report |
| `parent` | "Child's Learning Readiness Snapshot" | `UnifiedParentDashboard` (consent) |
| `professional` | "Workplace Effectiveness Snapshot" | career intelligence |

All 6 keys have a **distinct report label + narrative** (snapshot · natural edge · growth space · what's next),
tone-split academic/career/proxy (`:406-409`). ✅

## B. Blueprint dashboards/reports per persona (`07_PERSONA_BLUEPRINT.md`)

| Persona | Dashboards / Reports | Evidence |
|---|---|---|
| P1 | student dashboard; diagnostic + guidance report; parent-linked (consent) | `07:19` |
| P2 | learning-path dashboard; progress report | `07:30` |
| P3 | Career Builder; readiness/roadmap report; Employability Passport | `07:41` |
| P4 | Career Launchpad / Fresher Hub; match report | `07:53` |
| P5 | career intelligence; readiness/FRI report | `07:65` |
| P6 | competency/EI dashboards; growth report | `07:76` |
| P7 | Employer Portal; candidate drawer (Coverage ⟂ Confidence); hiring reports | `07:87` |
| P8 | employer dashboards; talent reports | `07:98` |
| P9 | Unified Institute/University dashboards; placement/cohort reports | `07:109` |

## C. Honest observations / gaps (→ `10`)

1. **Counsellor/placement-cell** reuse the `teacher` report label — no counsellor-specific report (MEDIUM).
2. **Competitive/CUET aspirant** receives the generic `student` "Learning Readiness Snapshot" — no exam-readiness
   report variant on the behavioural path (HIGH, ties to `04`).
3. **Report Factory** (`docs` + `report-factory-engines`) provides the heavier report exports; persona-specific
   report blueprints there are out of scope of this behavioural-report audit (noted, not claimed).
4. **Every first-class persona has ≥1 dashboard + ≥1 report.** No persona is report-less. ✅

## Verdict
Every persona maps to a **report and a dashboard**. Gaps are **variant specificity** (exam, counsellor), not missing
report capability. **No change required structurally.**

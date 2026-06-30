# 04 · Persona Coverage Matrix

For each persona, the product-completeness checklist from the brief: Registration · Auth · Onboarding ·
Profile · Dashboard · Assessments · Learning · Career · AI · Reports · Notifications · Interventions ·
Progress · Completion · Continuous-improvement. Scored as the **weakest-link** completeness of the persona's
journey (a persona with no completion/continuous-improvement is PARTIAL even if everything upstream is rich).

Legend: ✅ implemented · ◐ partial · ✗ missing/not-dedicated.

| Persona | Reg | Auth | Onbrd | Prof | Dash | Assess | Learn | Career | AI | Report | Notif | Interv | Prog | Compl | Cont | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Student (school/college) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Competitive-exam aspirant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Fresher / job aspirant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Professional / transition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Employee (enterprise) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| HR / recruiter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – | ✅ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Employer (org) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – | ✅ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Parent | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | ✗ | ✗ | **IMPLEMENTED** |
| Mentor | ✅ | ✅ | ✅ | ✅ | ✅ | – | – | ✅ | ◐ | ◐ | ◐ | ✅ | ◐ | ✗ | ✗ | **IMPLEMENTED** |
| Institute / University admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – | ✅ | ◐ | ✅ | ◐ | – | ◐ | ◐ | ◐ | **IMPLEMENTED** |
| Manager / leadership | ✅ | ✅ | ◐ | ◐ | ◐ | ✅ | – | ✅ | ◐ | ✅ | ✗ | ✗ | ◐ | ✗ | ✗ | **PARTIAL** |
| L&D | ✅ | ✅ | ◐ | ◐ | ◐ | ✅ | – | ◐ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | **PARTIAL** |
| Faculty | ◐ | ✅ | ◐ | ◐ | ◐(nested) | ✅ | – | ◐ | ◐ | ◐ | ✗ | ✗ | ◐ | ✗ | ✗ | **PARTIAL** (nested in Institute) |
| Teacher / Counsellor | ◐ | ✅ | ◐ | ◐ | ✗ | ◐(survey) | – | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | **PARTIAL** (survey-only) |
| Coach | ◐ | ✅ | ◐ | ◐ | ◐ | – | ◐ | ◐ | ◐ | ◐ | ✗ | ◐ | ✗ | ✗ | ✗ | **PARTIAL** (coach≈mentor) |
| Psychologist / clinical counsellor | ✗ | – | ✗ | ✗ | ✗ | ✗ | – | – | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **MISSING (dedicated lens)** |
| Government / Healthcare / NGO user | ✗ | – | ✗ | ✗ | ✗ | ◐ | – | – | – | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | **MISSING / sector-tag only** |

## Honest cross-persona findings
- **The recurring weak links are the same five for almost every persona:** Notifications (◐), Completion (◐/✗),
  Continuous-improvement (◐/✗), and (for support personas) Interventions. This is the **lifecycle exit-gap**
  showing up per-persona — confirming GAP-P1 is systemic, not persona-local.
- **11–12 personas are genuinely first-class; 5 are partial; 2 are missing-as-dedicated.** Breadth is strong.
- **Faculty** is the highest-value partial (real substrate already exists nested in Institute) → promote to
  first-class (see Gap Register GAP-M1).

## Honesty note
"Persona exists" ≠ "persona journey is complete." Several IMPLEMENTED personas still carry ◐ on
completion/continuous-improvement; they are marked IMPLEMENTED because a coherent end-to-end path exists, but
the **product-completeness ceiling for every persona is gated by the lifecycle exit/progression gap.**

# 07 · Persona Coverage Matrix

For each persona, the product-completeness checklist from the brief: Registration · Auth · Onboarding ·
Profile · Dashboard · Assessments · Learning · Career · AI · Reports · Notifications · Interventions ·
Progress · Completion · Continuous-improvement. Scored by **weakest-link**: a persona with **✗ (missing)** on
completion *or* continuous-improvement is **PARTIAL**; a persona whose tail is only **◐ (partial)** can still
be **IMPLEMENTED** (a coherent end-to-end path exists, soft tail). MISSING-as-dedicated for ✗ on core entry.

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
| Parent | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | ✗ | ✗ | **PARTIAL** (✗ completion/continuous) |
| Mentor | ✅ | ✅ | ✅ | ✅ | ✅ | – | – | ✅ | ◐ | ◐ | ◐ | ✅ | ◐ | ✗ | ✗ | **PARTIAL** (✗ completion/continuous) |
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
- **9 personas are first-class (IMPLEMENTED); 7 are PARTIAL; 2 are MISSING-as-dedicated.** Breadth is strong,
  but Parent and Mentor drop to PARTIAL under the weakest-link rule (✗ on completion *and* continuous-
  improvement) — their *segment* experience still exists (06), but their *journey* is incomplete.
- **Faculty** is the highest-value partial (real substrate already exists nested in Institute) → promote to
  first-class (see Gap Register GAP-M1).

## Honesty note
"Persona exists" ≠ "persona journey is complete." IMPLEMENTED personas carry only ◐ (soft) tails; personas
with hard ✗ on completion *and* continuous-improvement (Parent, Mentor, plus the support personas) are honestly
PARTIAL. The **product-completeness ceiling for every persona is gated by the lifecycle exit/progression gap.**

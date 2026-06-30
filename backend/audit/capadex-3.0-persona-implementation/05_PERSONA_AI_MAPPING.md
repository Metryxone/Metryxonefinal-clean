# 05 · Persona ↔ AI / Recommendation Mapping

How AI responsibilities and recommendation surfaces specialize per persona. The platform's AI is **observation +
diagnosis + grounded recommendation; no verdicts** (blueprint rule, `07:18`) and **abstain-never-fabricate** for
match/prediction (`07:52,86`). Persona shapes (a) the **stakeholder voice/lens**, (b) the **concept tokens** used to
diagnose, and (c) the **recommendation surface**.

## A. AI framing layers (measured)

| Mechanism | Where | Persona role |
|---|---|---|
| **PIL stakeholder lens** (5: student/parent/teacher/counselor/professional) | `backend/services/pil/runtime-guidance-engine.ts` (`mapStakeholder`) | Resolves rich persona + relationship (`parent_child`, `teacher_student`) → a lens → guidance **voice** (a parent sees parent-facing narrative; a student sees student-facing advice for the *same* behavioural archetype) |
| **Concern → archetype resolution** | `runtime-guidance-engine.ts` + `routes/capadex.ts resolveCapadexConcern` | Persona + age route free-text concern to a behavioural archetype; persona SOFT, age HARD (adultness ≥24) |
| **Cohort-normalized benchmarking** | `backend/services/cohort-gating.ts` | Recommendations benchmarked within `(AgeBand × PersonaTrack)`; n<30 masks (Coverage ⟂ Confidence) |
| **Report narrative generator** | `frontend/src/lib/behavioural-insights.ts:396` (`buildInsightNarrative`) | Persona splits voice into `isAcademic` (student/teacher/campus) vs `isCareer` (jobseeker/professional) vs proxy → snapshot/edge/growth copy |
| **Experience routing** | `backend/services/experience-routing.ts` | Persona/stage routes to the matching Studio (Leadership/Fresher/etc.) recommendation surface |

## B. Blueprint AI responsibilities per persona (`07_PERSONA_BLUEPRINT.md`)

| Persona | AI responsibility | Evidence |
|---|---|---|
| P1 | observation + diagnosis + grounded recommendation; **no verdicts** | `07:18` |
| P2 | diagnosis, roadmap recommendation, personalization | `07:29` |
| P3 | competency inference, career recommendation, explainability | `07:40` |
| P4 | match (abstain), recommendation, personalization | `07:52` |
| P5 | competency inference, mobility/transferability recommendation, explainability | `07:64` |
| P6 | inference, recommendation, personalization (org modifiers) | `07:75` |
| P7 | match/shortlist (abstain), explainability; **prediction DORMANT by governance** | `07:86` |
| P8 | talent intelligence, match, explainability | `07:97` |
| P9 | cohort intelligence; honest aggregation (never readiness-proxy) | `07:108` |

## C. Honest observations / gaps (→ `10`)

1. **AI lens count (5) < runtime keys (6):** PIL lenses cover student/parent/teacher/counselor/professional but
   **`campus`/`jobseeker` map onto the nearest lens** (professional/student) rather than a dedicated lens —
   functional, but campus/jobseeker AI voice is borrowed. (LOW/MEDIUM.)
2. **Counselor lens exists in AI (5) but NOT as an assessment persona** (`04`) — i.e. the AI can *speak* counselor
   but the counsellor uses the teacher *bank*. Asymmetry, not a break.
3. **Prediction dormancy is intentional** (P7) — governance design, must NOT be "fixed". Recorded so a future pass
   doesn't mistake dormant for missing.
4. **All AI recommendation is grounded/abstaining** — no fabricated persona recommendations found. ✅

## Verdict
Every persona has an AI responsibility (blueprint) **and** a runtime framing path (lens + concept tokens + narrative
+ cohort benchmark). The only gaps are **lens-granularity** (campus/jobseeker borrow a lens) and the
counselor lens↔bank asymmetry. **No change required structurally; granularity items queued for approval.**

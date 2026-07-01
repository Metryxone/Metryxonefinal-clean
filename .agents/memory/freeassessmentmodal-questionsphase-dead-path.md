---
name: FreeAssessmentModal legacy QuestionsPhase render path is unreachable
description: The persona question banks (resolveQuestionBank) never render in the live runtime — CAPADEX supersedes them.
---

# Legacy QuestionsPhase / resolveQuestionBank banks are unreachable at runtime

`frontend/src/lib/behavioural-insights.ts` exports `QUESTION_BANKS`,
`SUB_PERSONA_QUESTION_BANKS`, and `resolveQuestionBank`. These are consumed ONLY by
the `questions` IIFE in `FreeAssessmentModal.tsx` (~line 1558), which feeds
`allPhaseProps.questions` → `QuestionsPhase` (`assessment/phases/QuestionsPhase.tsx`).
`QuestionsPhase` renders solely at `phase === "questions"` (render switch ~line 3134).

**Nothing in the runtime ever sets `phase = "questions"`.** The live assessment flow
routes the PersonaJourneyWizard → IntroPhase → CAPADEX
(`capadex_analyze → capadex_clarify → capadex_bridge → capadex_q`), rendering
server-provided `capadexItems` via `CapadexQPhase`. So the persona banks resolved by
`resolveQuestionBank` are computed but never painted on screen in production.

**Why this matters:** any audit/claim that "persona X sees campus/career_explorer bank
questions on screen" is about a currently-dead render path, not the live CAPADEX
experience. Do not conflate the two.

**How to test the bank→screen render anyway** (see
`FreeAssessmentModal.personaQuestionRender.test.tsx`): drive the REAL wizard, then stub
IntroPhase as a transition trigger that calls `props.setPhase('questions')` — but ONLY
after `props.selectedPersona` has committed, otherwise the modal's `questions` IIFE
falls back to its `!selectedPersona` → `QUESTION_BANKS.student` default and masks the
persona bank. IntroPhase transitions so fast it may unmount before an assertion can
observe it; wait directly for `question-text`. Clicking a `rating-N` advances via a
250ms `safeTimeout`; the final answer trips `phase='analyzing'`, so stop one click short.

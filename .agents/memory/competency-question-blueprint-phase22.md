---
name: Competency Question Blueprint Engine (Phase 2.2)
description: How question→competency/micro/difficulty/type and competency→pool are grounded and kept honest.
---

# Question Blueprint Engine (Phase 2.2)

Materializes: Competency→Question Pool · Question→Competency · Question→Micro Competency ·
Question→Difficulty Level · Question→Question Type. Behind the SAME `competencyRuntime` flag
(no new flag). Engine `services/question-blueprint.ts`, routes in `routes/competency-runtime.ts`.

## Grounding sources (don't reinvent)
- Question bank = **`competency_question_templates`** (uuid `id`; already has `question_type` +
  `difficulty_band` columns). Questions are keyed by the 7 LEGACY codes (`competency_code` COM/COG/…),
  NOT by onto competency ids — so mapping a question to an onto competency is a separate explicit link.
- Canonical bare Question↔Competency edge already exists as **`onto_competency_question_map`**
  (question_id→competency_id). The Phase-2.2 enriched mapping `mapQuestion` **upserts it in lockstep** —
  do not create a second source of truth for that edge.
- Micro competencies = **`onto_competency_hierarchy`** (`parent_competency_id`→`micro_label/slug`, integer id).
  A mapped micro MUST be a child of its competency (else `micro_competency_mismatch`).
- `ont_assessment_questions` (ont_*) is a DISJOINT namespace — NOT the competency bank; ignore it here.

## Tables (deliverables → onto_*)
- `question_difficulty_framework` → `onto_question_difficulty_framework` (5-level ladder
  foundational/easy/medium/hard/expert, seeded as reference/config — legitimately populated).
- `question_competency_mapping` → `onto_question_competency_mapping`
  (question→competency+micro+difficulty+type; UNIQUE(question_id,competency_id)).
- `question_blueprints` → `onto_question_blueprints` (1:1 per competency; pool_target +
  difficulty/type distributions + honest `coverage`).

## Supported question types (7)
likert · situational_judgment · behavioral · case_study · scenario_based · multiple_choice · forced_choice.
Stored as an engine constant with alias normalization (sjt→situational_judgment, mcq→multiple_choice,
likert_5→likert, ipsative→forced_choice). The 3 deliverable tables are difficulty/mapping/blueprints; the
type vocabulary is the constant + the framework read endpoint (NOT a 4th table).

## Honesty (mirrors Phase 2)
- The bank is EMPTY in dev → pools/mappings are legitimately empty (coverage note), never fabricated.
- Derived blueprint = descriptive mirror of the ACTUAL pool; authored blueprint reports actual-vs-target
  shortfall + per-level/type gaps. `buildQuestionBlueprint` derives when no opts, authors when opts given.
- Difficulty/type inherit from the bank row when omitted in `mapQuestion`; both validated before write.

## Deferred
NOT wired into Phase 2 `generateAssessment` question selection (intentional — don't disturb the live chain).
That wiring is the natural next phase.

# CAPADEX WC-9 — Future Readiness Activation Architecture

**Phase type: DESIGN + AUDIT ONLY.** No code, no schema, no migrations. This phase *specifies* the
back-half WC-8 found missing (Future Concern → Context → **Outcome → Journey → Decision → Product →
Growth Plan → Mentor**). Every catalog row below is expressed against the **exact field set of the
live table it would seed** (seed-ready; final copy/weights finalized at seed time), but nothing is
built here.

> **STATUS: COMPLETE — STOP FOR APPROVAL.** No build follows until the Implementation Roadmap
> (Deliverable 10) is approved.

## Design discipline (inherited project constraints)
- **Additive · flag-gated (default OFF) · byte-identical when OFF · compose-only · never fabricate.**
- **Reuse before invent:** new outcome models reuse the EXISTING construct vocabulary so they
  activate against today's signals/patterns with zero new signal engineering. Where a *new* construct
  or *new content* is genuinely required, it is flagged explicitly (not hidden).
- **Seed rows, not schema:** new outcome models and journey routes are ROWS in `wc3_outcome_models`
  / `wc3_journey_routes` (no DDL). The growth-plan and decision pipelines need **no change** because
  they key off `model_key` — new outcomes flow through automatically.
- **No stub selling / fail-closed safety / D6 gating** carry over from WC-7B/7C.

## Deliverables
| # | File | What it specifies |
|---|------|-------------------|
| 1 | `WC9_FUTURE_OUTCOME_CATALOG.md` | New `wc3_outcome_models` rows (the activation anchor) |
| 2 | `WC9_FUTURE_JOURNEY_CATALOG.md` | New `wc3_journey_routes` rows + model_affinities |
| 3 | `WC9_FUTURE_DECISION_CATALOG.md` | New DC entries the orchestrator emits |
| 4 | `WC9_FUTURE_PRODUCT_MAPPING.md` | Outcome/journey → product + monetization on CAP ladder |
| 5 | `WC9_FUTURE_GROWTH_PLAN_MAPPING.md` | How new outcomes flow through the WC-7B growth bridge |
| 6 | `WC9_FUTURE_MENTOR_MAPPING.md` | Extensions to OUTCOME_MENTOR_MAP / mentor types |
| 7 | `WC9_AI_SKILL_TAXONOMY_REQUIREMENTS.md` | The keystone reference asset (spec) |
| 8 | `WC9_OCCUPATION_EXPOSURE_MODEL_REQUIREMENTS.md` | The second reference asset (spec) |
| 9 | `WC9_ACTIVATION_ARCHITECTURE.md` | End-to-end pipeline wiring + flags |
| 10 | `WC9_IMPLEMENTATION_ROADMAP.md` | Minimum architecture, sequenced, 40→90 |

## Grounding (read-only, captured this phase)
- Live construct vocabulary (from the 7 existing outcome models + `intervention_library.construct_key`):
  `SKILL_AWARENESS, CAREER_READINESS, CAREER_CLARITY, GOAL_ORIENTATION, COMMUNICATION,
  SOCIAL_CONFIDENCE, SELF_ESTEEM, RESILIENCE, EMOTIONAL_REGULATION, STRESS_MANAGEMENT, ANXIETY,
  CRITICAL_THINKING, CREATIVITY, IMPULSE_CONTROL, INTRINSIC_MOTIVATION, EXECUTIVE_FUNCTION,
  HABIT_FORMATION, LEARNING_*, ATTENTION_REGULATION, …`.
- Outcome activation = construct overlap (`outcome-intelligence.ts`). Journey resolution =
  `Σ(model_affinity × model.confidence)`, fallback to `is_fallback` (`journey-intelligence.ts`).
- Growth = `CoachInput{currentScores,targetScores}` keyed by `model_key`, stage→score 20/40/60/80/100.
- Mentor types today: `performance_coach, subject_tutor, exam_strategist, psychological_counsellor`.

## The minimum architecture (one line)
> Seed **5 outcome models + 4 journey routes**, extend the mentor map (**+1 type**), add a **thin
> Future Skill Plan annotation layer** on the existing growth engine, and build **one shared reference
> asset (AI-resilient skill taxonomy + occupation-exposure model)**. No new activation engine, no
> schema churn, no new billing.
>
> **Reachability after this set: 8 of 9 focus areas have a structural path** (Entrepreneurship is the
> only fully-deferred area — gated outcome, no path surfaced). "Structural path exists" ≠
> "content-ready/sellable": Resilience + Employability are content-ready day-1; AI Navigator, Future
> Skills, and Emerging Careers are structurally reachable but `corpus_pending` until their content/
> reference asset lands. Entrepreneurship is a genuine content-first gap, deferred last.

---
name: WC-9 Future Readiness Activation Architecture (design method)
description: How to design the future-readiness back-half (outcome→journey→decision→product→growth→mentor) honestly against CAPADEX's existing pipeline — reuse vs seed vs build, and the reachability-honesty trap.
---

# WC-9 — Future Readiness Activation Architecture (DESIGN+AUDIT)

Deliverables in `backend/audit/wc-9/` (11 markdown). Designs the back-half WC-8 found missing.
No code/schema. Durable *method/decision* lessons below.

## The pipeline already exists — WC-9 is mostly seed + ONE asset pair
The activation engines are all live: outcome activation = construct overlap
(`outcome-intelligence.ts`); journey resolution = `Σ(model_affinity × model.confidence)` with
`is_fallback` (`journey-intelligence.ts`); growth = `growth-plan-bridge` keyed by `model_key`
(stage→score 20/40/60/80/100); mentor = `mentor-bridge` OUTCOME_MENTOR_MAP. So new future-readiness
outcomes/journeys are **seed ROWS** in `wc3_outcome_models` / `wc3_journey_routes` (no DDL), and the
growth/decision pipeline needs **no change** because it keys off `model_key`.
**Why:** modelling these as new engines would have massively overstated the build.

## Reuse-the-construct-vocabulary rule (makes outcomes activatable day-1)
New outcome models MUST draw `construct_keys` from the EXISTING vocabulary (`SKILL_AWARENESS,
RESILIENCE, CREATIVITY, CRITICAL_THINKING, COMMUNICATION, SOCIAL_CONFIDENCE, EMOTIONAL_REGULATION,
INTRINSIC_MOTIVATION`, …). Then they activate against today's signals with zero new signal
engineering. Flag any `[NEW]` construct explicitly (only entrepreneurship needed one →
`OPPORTUNITY_RECOGNITION`, and it's deferred).

## Reskill/Upskill are MECHANISMS, not outcomes
Tempting to add `reskilling`/`upskilling` outcome models — don't. The corpus supports them only as
**growth-plan step annotations** (reskill = high occupation-exposure skill → pivot; upskill = durable
skill below target → deepen). Modelling them as outcomes fabricates a measurement target.

## The keystone: ONE reference asset pair
AI Skill Taxonomy (skills × AI-durability, joined to constructs by `construct_keys`) + Occupation
Exposure Model (roles × exposure, joined to taxonomy + the existing `industryRoles.ts` catalog).
Build once → flips `ai_career_navigator` + `future_skills_planner` from `corpus_pending`→`ready` and
adds skill-level depth to the already-live Employability 2.0. It is the only unavoidable BUILD.

## Reachability-honesty trap (architect Fail, fixed)
Do NOT conflate "structural path exists" with "content-ready/sellable." Canonical framing: **8/9
focus areas get a structural path** (only Entrepreneurship fully deferred — gated outcome, no path),
but Emerging Careers / AI products are `corpus_pending` until content lands; only Resilience +
Employability are day-1 content-ready. A "7/9 lit up" vs "8/9 reachable" mismatch across files reads
as overclaim — pick ONE canonical statement and separate the two axes everywhere.
Also: don't say a reference asset "moves Employability from pending→ready" — Employability is already
live; the asset *deepens* it. And acknowledge the non-asset build work (thin skill-plan annotation
layer, +1 mentor type `career_transition_coach`, flag/offer-gating) rather than claiming "only assets
are new."

## Honest-stub discipline carried from WC-7C
`corpus_pending` routes are shown, never sold (offer stub-guard); D6 confidence gating + D7 fail-
closed safety apply to every new future-readiness surface; decisions must carry real `why[]`
provenance and asset scores must carry `source` + a directional label.

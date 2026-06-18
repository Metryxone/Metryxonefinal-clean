# WC-9 Deliverable 1 — Future Outcome Catalog

New rows for `wc3_outcome_models`. Shape (verbatim from live):
`{model_key, display_label, anchor, construct_keys[], gated, description, composition_spec{anchor, actions, desired_rule}}`.
Activation = a session's active behavioural constructs overlap `construct_keys`. **Construct keys
below are drawn from the live vocabulary** unless tagged `[NEW]`.

## 1. Catalog (5 new outcome models)

### `ai_readiness` — "AI Readiness" *(focus: AI Job Disruption, Reskilling/Upskilling)*
- construct_keys: `SKILL_AWARENESS, CRITICAL_THINKING, CREATIVITY, RESILIENCE, INTRINSIC_MOTIVATION`
- anchor: `l1_stage`; gated: `false`
- composition_spec: `{anchor:"l1_stage", actions:"intervention_library.construct_key", desired_rule:"next_stage_up"}`
- Activatable today? **Yes** — all 5 constructs exist. The *adaptation guidance* (what to learn)
  additionally needs the AI Skill Taxonomy (Deliverable 7) — the outcome activates without it but is
  shallow until the taxonomy lands.

### `career_resilience` — "Career Resilience" *(focus: Career Resilience)*
- construct_keys: `RESILIENCE, EMOTIONAL_REGULATION, STRESS_MANAGEMENT, SELF_ESTEEM, INTRINSIC_MOTIVATION`
- anchor: `l1_stage`; gated: `false`
- Activatable today? **Yes** — composes the largest existing corpus (adaptability/resilience =
  395 concerns / 1,480 Qs, WC-8). Cheapest high-value outcome; **no new content needed.**

### `career_transition_readiness` — "Career Transition Readiness" *(focus: Career Transition, Emerging Careers)*
- construct_keys: `CAREER_CLARITY, CAREER_READINESS, SKILL_AWARENESS, GOAL_ORIENTATION, RESILIENCE`
- anchor: `l1_stage`; gated: `false`
- Activatable today? **Yes** — 403 `CAREER_TRANSITION` L5B Qs already exist (WC-8). Emerging-careers
  *discovery* rides this outcome via a journey (Deliverable 2) rather than a separate outcome.

### `human_skill_advantage` — "Human Skill Advantage" *(focus: Human Skills)*
- construct_keys: `COMMUNICATION, SOCIAL_CONFIDENCE, CREATIVITY, CRITICAL_THINKING, EMOTIONAL_REGULATION`
- anchor: `l1_stage`; gated: `false`
- Activatable today? **Yes** — 295 human-skill concerns. Positioned as the *AI-resilient* skill set;
  cross-feeds `ai_readiness`.

### `entrepreneurial_readiness` — "Entrepreneurial Readiness" *(focus: Entrepreneurship)* — **DEFERRED / `gated:true`**
- construct_keys: `CREATIVITY, IMPULSE_CONTROL, INTRINSIC_MOTIVATION, CRITICAL_THINKING, RESILIENCE, OPPORTUNITY_RECOGNITION [NEW]`
- gated: `true` (mirrors `exam_readiness` gating until corpus ready)
- Activatable today? **No** — only 89 context Qs / 6 concerns (WC-8). Needs founder-trait content
  seeding AND one new construct. Ship gated; do not surface until corpus + `OPPORTUNITY_RECOGNITION`
  exist. **Honest content-first gap, not compose-only.**

## 2. Coverage of the 9 focus areas by outcome
| Focus area | Outcome anchor | Day-1 activatable? |
|------------|----------------|:--:|
| AI Job Disruption | `ai_readiness` | Yes (shallow until taxonomy) |
| Future Employability | `employability_readiness` *(EXISTS — reuse)* | Yes |
| Career Transition | `career_transition_readiness` | Yes |
| Career Resilience | `career_resilience` | **Yes (no new content)** |
| Human Skills | `human_skill_advantage` | Yes |
| Reskilling | *mechanism* → growth plan anchored to `ai_readiness`/`career_transition` | Yes (delivery, not outcome) |
| Upskilling | *mechanism* → growth plan + skill taxonomy | Yes (delivery, not outcome) |
| Emerging Careers | journey on `career_transition_readiness` | Yes (discovery surface) |
| Entrepreneurship | `entrepreneurial_readiness` (gated) | **No — deferred** |

## 3. Honesty notes
- **Reskilling/Upskilling are NOT outcomes** — they are *growth-plan mechanisms* (Deliverable 5).
  Modelling them as outcomes would fabricate a measurement target that the corpus does not support.
- **Construct dependencies:** all new outcomes except `entrepreneurial_readiness` reuse existing
  constructs → zero new signal engineering. Only `OPPORTUNITY_RECOGNITION [NEW]` is required, and
  only for the deferred entrepreneurship outcome.
- **Actions dependency:** `composition_spec.actions` resolves to `intervention_library.construct_key`.
  New outcomes need `intervention_library` rows for their constructs or actions render empty — a
  curation task flagged in the Roadmap (not a blocker for activation/scoring).

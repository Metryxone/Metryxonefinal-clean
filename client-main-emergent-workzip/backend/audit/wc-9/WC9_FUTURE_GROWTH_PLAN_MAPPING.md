# WC-9 Deliverable 5 — Future Growth Plan Mapping

**Key finding: the growth-plan bridge needs NO change to serve future-readiness outcomes.** It keys
off `model_key`, so any new outcome model automatically flows through it. This deliverable specifies
*how* each future outcome maps onto `CoachInput`, and where the **Future Skill Plan** (the one
missing chain link from WC-8 Track E) attaches.

## 1. How it works today (verbatim grounding)
- `growth-plan-bridge.ts` builds `CoachInput{currentScores, targetScores}` keyed by `model_key`.
- Stage → score: `Awareness 20 · Curiosity 40 · Clarity 60 · Growth 80 · Mastery 100` (null→50).
- `createAICoach(pool).growthPlan(input, persist=false)` returns
  `{steps[], total_gap, total_projected_uplift, horizon_months, confidence}` — read-only.

## 2. Future-outcome → growth-plan mapping (automatic)
| Outcome | currentScores key | targetScores rule | Produces |
|---------|-------------------|-------------------|----------|
| `ai_readiness` | `ai_readiness` = stage→score | `next_stage_up` | AI-resilience roadmap |
| `career_resilience` | `career_resilience` | `next_stage_up` | Resilience-building plan |
| `career_transition_readiness` | `career_transition_readiness` | `next_stage_up` | Transition roadmap |
| `human_skill_advantage` | `human_skill_advantage` | `next_stage_up` | Human-skill plan |

No code change: these are new `model_key`s the bridge already accepts.

## 3. The Future Skill Plan (the missing link)
WC-8 Track E showed the chain stops at Mentor. The **Future Skills Planner** completes it by adding a
*skill-level* layer beneath the outcome-level growth plan:
```
Decision → (outcome) Growth Plan  [EXISTS, model_key-keyed]
              ↓ enrich each step with
          Future Skill Plan        [NEW: maps step → AI-resilient skills + reskill/upskill action]
              ↑ requires
          AI Skill Taxonomy (Deliverable 7)  ←  the only new dependency
```
- **Reskilling** = steps where current-skill exposure is HIGH (occupation-exposure model) → replace.
- **Upskilling** = steps where the skill is durable but below target → deepen.
- Both are *growth-plan step annotations*, not new outcomes (consistent with Outcome Catalog §3).

## 4. Personalization (carried forward)
The bridge already prefers real user scores when present (WC-7B). Future plans inherit this — a user
with measured `ai_readiness` constructs gets a personalized plan; absent data degrades to stage-based
defaults, never fabricates a score.

## 5. Honesty note
The growth-plan half is the **cheapest** part of WC-9 — it is already built and outcome-agnostic. The
only growth-related new work is the *Future Skill Plan annotation layer*, and it is wholly gated on
the AI Skill Taxonomy. Until that asset exists, future growth plans are honest **outcome-level** plans
(real, useful) without skill-level detail.

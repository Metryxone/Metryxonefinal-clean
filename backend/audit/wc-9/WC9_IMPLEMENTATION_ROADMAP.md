# WC-9 Deliverable 10 — Implementation Roadmap (40 → 90+)

The minimum architecture to move Future Readiness from ~40% (front-half only) to 90%+, sequenced
cheapest-and-highest-leverage first. **Nothing here is built until approved.**

## The minimum architecture (the answer to the brief's most-important question)
> **5 outcome-model rows + 4 journey-route rows + 1 mentor type + a thin Future Skill Plan
> annotation layer + 1 reference asset pair (AI Skill Taxonomy + Occupation Exposure).**
> That gives **8 of 9 focus areas a structural path** (Entrepreneurship is the only fully-deferred
> area). Structural path ≠ content-ready: Resilience + Employability are content-ready day-1; AI
> Navigator / Future Skills / Emerging Careers are reachable but `corpus_pending` until content/asset
> lands. The pipeline (activation, journey resolution, decision orchestration, growth engine, mentor
> bridge) **already exists** — WC-9 adds **no new engine**, only seed rows + one reference asset pair
> + small targeted wiring.

## Sequenced waves

### Wave 0 — Seed (no new assets, days) → ~40 to ~60
- Seed `career_resilience` outcome + `career_resilience_index` journey (**ready**, composes existing
  corpus — no asset needed).
- Seed `career_transition_readiness` + `human_skill_advantage` outcomes (reuse constructs).
- Reframe Employability Index → **Employability 2.0** (AI-resilience framing; product already live).
- Extend mentor map (+`career_transition_coach`) and decision catalog targets.
- **Revenue now:** Resilience Index + Employability 2.0 monetize on the existing CAP ladder.
- All behind `FF_WC9_FUTURE_OUTCOMES`/`FF_WC9_FUTURE_JOURNEYS`, default OFF.

### Wave 1 — The keystone asset (curation, weeks) → ~60 to ~85
- Build **AI Skill Taxonomy** (~150–300 skills, sourced + directional) and **Occupation Exposure
  Model** (cover `industryRoles.ts` roles).
- Flip `ai_career_navigator` + `future_skills_planner` from `corpus_pending` → `ready`.
- Enable Future Skill Plan annotation layer (reskill/upskill split) on top of the existing growth plan.
- Seed `ai_readiness` outcome to full depth. **AI products become sellable** (stub guard releases).

### Wave 2 — Emerging careers + entrepreneurship (content-first, deferred) → ~85 to 90+
- Emerging-role reference list → `emerging_careers_explorer` ready.
- Entrepreneurship: seed founder-trait content + `OPPORTUNITY_RECOGNITION` construct, then ungate
  `entrepreneurial_readiness`. **Honest content gap — last, not first.**

## Cost / leverage table
| Item | Type | Cost | Lifts |
|------|------|:--:|-------|
| Resilience outcome+journey | seed | Low | Resilience (ready now) |
| Transition / human-skill outcomes | seed | Low | 2 focus areas |
| Employability 2.0 reframe | copy | Low | Employability (live) |
| Mentor + decision targets | seed | Low | mentor/decision reachability |
| **AI Skill Taxonomy** | **asset** | **Med** | **AI + reskill + upskill + employability depth** |
| Occupation Exposure | asset | Med | AI Navigator + reskill/upskill split |
| Emerging-role list | content | Med | Emerging careers |
| Entrepreneurship corpus | content | High | Entrepreneurship (deferred) |

## Why this is the minimum (not less, not more)
- **Not less:** without the AI Skill Taxonomy, three of the highest-value products can't honestly
  ship (they'd be stubs). It is the one unavoidable build.
- **Not more:** no new activation engine, no new billing, no schema churn — the existing
  outcome/journey/decision/growth/mentor pipeline absorbs the new rows. Entrepreneurship is correctly
  deferred rather than faked into compose-only.

## Honesty ledger
- Reachability targets (8/9 areas) are **structural** (a path will exist), not a claim of content
  depth. Depth tracks asset coverage and is reported as it lands.
- All maturity/lift figures here are **directional estimates**; only the WC-8 corpus counts they build
  on are measured.
- `corpus_pending` states keep every not-yet-ready product honest at runtime.

> **STOP — WAIT FOR APPROVAL.** No build, no seed, no schema, no deploy until this roadmap is approved.

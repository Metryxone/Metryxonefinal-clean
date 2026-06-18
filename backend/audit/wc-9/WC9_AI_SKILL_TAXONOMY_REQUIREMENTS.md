# WC-9 Deliverable 7 — AI Skill Taxonomy Requirements

**This is the keystone reference asset.** It is the *single* genuinely-new data structure that
unlocks the two `corpus_pending` AI products — **AI Career Navigator + Future Skills Planner (these
two move `corpus_pending` → `ready`)** — and additionally **deepens the already-live Employability
Index 2.0** with skill-level AI-resilience detail (Employability is live as a reframe today; the
taxonomy adds depth, it does not gate its release). Build once → two products become sellable + one
live product gains depth.

## 1. Purpose
A reference taxonomy of skills classified by **durability under AI** so the system can answer, for any
user, "which of your skills are exposed, which are resilient, and what should you build next." It is
**reference data**, not per-user data — it does not depend on sessions.

## 2. Required structure (proposed `wc9_ai_skill_taxonomy` reference table — NOT created this phase)
| Field | Type | Meaning |
|-------|------|---------|
| `skill_key` | text PK | canonical skill id |
| `display_label` | text | user-facing name |
| `skill_category` | text | technical / cognitive / human / domain |
| `ai_durability` | enum | `augmented` / `automatable` / `resilient` |
| `durability_score` | numeric 0–1 | directional resilience estimate (must be labelled directional) |
| `resilient_alternatives` | text[] | skills to pivot toward when this is automatable |
| `construct_keys` | text[] | bridge to CAPADEX constructs (e.g. CREATIVITY, CRITICAL_THINKING) |
| `source` | text | provenance of the classification (mandatory — never unlabelled) |

## 3. Construct bridge (why it activates cleanly)
`construct_keys` joins the taxonomy to the live CAPADEX construct vocabulary. A user's measured
constructs (RESILIENCE, CREATIVITY, CRITICAL_THINKING, COMMUNICATION…) already map to the
`ai_readiness`/`human_skill_advantage` outcomes; the taxonomy turns those into **named skills with a
durability verdict**, which is exactly the layer the growth plan needs (Deliverable 5).

## 4. Sourcing (honesty-critical)
- Classifications MUST carry a `source` (e.g. published frameworks: WEF Future of Jobs, O*NET,
  OECD skills-for-jobs). **No durability score may be invented without provenance.**
- `durability_score` is a **directional estimate** in every surface, never presented as measured.
- Coverage gaps are honest gaps: a skill with no credible source stays unclassified, not guessed.

## 5. Minimum viable size
~150–300 skills covering the 9 focus domains is enough to make the three products `ready`. This is a
**curation/seed task**, not an engine — it is the highest-leverage, lowest-risk build in WC-9.

## 6. What it does NOT need
No new signal engineering, no per-session writes, no schema beyond this one reference table + its
seed. It is read at journey/growth time and joined by `construct_keys`.

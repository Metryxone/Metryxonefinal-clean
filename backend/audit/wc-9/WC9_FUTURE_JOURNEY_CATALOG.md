# WC-9 Deliverable 2 — Future Journey Catalog

New rows for `wc3_journey_routes`. Shape (verbatim): `{route_key, display_label, product_key,
product_label, product_path, model_affinities{model_key:weight}, corpus_status, is_fallback,
fallback_priority, description}`. Resolution = `Σ(model_affinity × model.confidence)`; highest wins;
zero → `is_fallback`.

## 1. Catalog (4 new routes)

### `ai_career_navigator` — "AI Career Navigator"  *(focus: AI Job Disruption)*
- product_path: `/ai-career-navigator`; corpus_status: **`corpus_pending`** until taxonomy lands
  (mirrors `competitive_exam` stub honesty → forces `confidence_band=CORPUS_PENDING`, no overclaim)
- model_affinities: `{ai_readiness:0.90, human_skill_advantage:0.50, career_transition_readiness:0.40}`
- is_fallback: false; fallback_priority: 35

### `future_skills_planner` — "Future Skills Planner"  *(focus: Reskilling, Upskilling, Emerging Careers)*
- product_path: `/future-skills-planner`; corpus_status: `corpus_pending` until taxonomy lands
- model_affinities: `{ai_readiness:0.70, career_transition_readiness:0.60, employability_readiness:0.50}`
- Note: this route's *output* is a growth plan (Deliverable 5), not a static report.

### `career_resilience_index` — "Career Resilience Index"  *(focus: Career Resilience)*
- product_path: `/career-resilience-index`; corpus_status: **`ready`** (composes existing corpus)
- model_affinities: `{career_resilience:0.90, confidence_stability:0.40, employability_readiness:0.30}`
- **The one new route shippable at `ready` on day one — no reference asset needed.**

### `emerging_careers_explorer` — "Emerging Careers Explorer"  *(focus: Emerging Careers)*
- product_path: `/emerging-careers` (or fold into `career_builder` as a tab)
- corpus_status: `corpus_pending` (needs an emerging-role reference list)
- model_affinities: `{career_transition_readiness:0.70, ai_readiness:0.50}`

## 2. Reused / existing routes
- `employability_index` (**ready**) — primary vehicle for Future Employability + delivery surface for
  the AI-resilience reframe (WC-8 Track D). No change.
- `career_builder` (**ready**), `mentoring` (**ready**, fallback), `lbi` (**ready**) — unchanged.
- Entrepreneurship route: **not catalogued** (deferred with its outcome).

## 3. model_affinities design rule (honesty)
Affinities are seeded so that a future-readiness outcome routes to its *purpose-built* product, but
every new route also lists `employability_readiness`/`career_builder` affinities so that if the
purpose-built corpus is `corpus_pending`, resolution still lands on a **ready** route rather than a
dead end. This mirrors the existing fallback discipline — no future session is ever stranded.

## 4. Coverage summary
| Route | corpus_status | Day-1? | Reference asset needed |
|-------|---------------|:--:|------------------------|
| `career_resilience_index` | ready | **Yes** | none |
| `employability_index` (reuse) | ready | Yes | none |
| `ai_career_navigator` | corpus_pending | After taxonomy | AI Skill Taxonomy + Occupation Exposure |
| `future_skills_planner` | corpus_pending | After taxonomy | AI Skill Taxonomy |
| `emerging_careers_explorer` | corpus_pending | After role list | Emerging-role reference |

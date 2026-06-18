# WC-9 Deliverable 9 — Future Readiness Activation Architecture

End-to-end wiring that converts a detected future concern into an activated journey. Every box is
either **EXISTS (reuse)**, **SEED (rows, no DDL)**, or **BUILD (new asset/code)**.

## 1. The full chain (target)
```
Future Concern            [EXISTS] concerns_master + clarity Qs
   ↓
Future Context            [EXISTS] wc3_question_context (L5B: AI/transition/employability/entrepreneurship)
   ↓
Future Outcome            [SEED]   wc3_outcome_models rows (Deliverable 1) — reuse existing constructs
   ↓                                activation = construct overlap (outcome-intelligence.ts, EXISTS)
Future Journey            [SEED]   wc3_journey_routes rows (Deliverable 2) — Σ(affinity×confidence)
   ↓                                resolution engine EXISTS (journey-intelligence.ts)
Future Decision           [EXISTS] decision-orchestrator → UnifiedDecision (new targets, Deliverable 3)
   ↓
Future Product            [MIXED]  Employability/Resilience=ready; AI products=corpus_pending→BUILD
   ↓
Future Growth Plan        [EXISTS] growth-plan-bridge (model_key-keyed, Deliverable 5) + BUILD skill-plan layer
   ↓
Future Mentor             [EXISTS] mentor-bridge + 1 new type (Deliverable 6)
```

## 2. The new BUILD work (no new engine; mostly seed + one asset pair)
**New data structures (the only genuinely-new structures):**
- **AI Skill Taxonomy** (Deliverable 7) — the keystone reference table; joins by `construct_keys`.
- **Occupation Exposure Model** (Deliverable 8) — joins to taxonomy + Career Builder role catalog.

**Small targeted build work (on top of EXISTING engines — no new engine):**
- A **thin Future Skill Plan annotation layer** on the existing growth-plan bridge (Deliverable 5 §3).
- **One new mentor type** `career_transition_coach` + mentor-map/decision-target rows (Deliverables 6, 3).
- **Flag + offer-gating wiring** so seed rows/products surface only when ready (WC-7C stub guard).

Everything else is **reuse** (activation, journey resolution, decision orchestration, growth engine,
mentor bridge all already exist) or **seed rows** (outcome models / journey routes, no DDL). The
reference assets are session-independent, read at journey/growth time.

## 3. Flag plan (mirrors WC-7B/7C discipline — default OFF, byte-identical OFF)
| Flag (proposed) | Gates |
|-----------------|-------|
| `FF_WC9_FUTURE_OUTCOMES` | exposes new outcome model rows to activation |
| `FF_WC9_FUTURE_JOURNEYS` | exposes new journey routes to resolution |
| `FF_WC9_FUTURE_SKILL_PLAN` | enables the skill-plan annotation layer (needs taxonomy) |
| `FF_WC9_AI_NAVIGATOR` | surfaces AI Career Navigator product (needs taxonomy+exposure) |
- Seed rows are inert until their flag is ON. A `corpus_pending` route never sells (WC-7C guard).
- Safety (D7) fail-closed and D6 confidence gating apply to every new surface.

## 4. Reachability after this architecture
| Chain hop | Before WC-9 | After (full WC-9) |
|-----------|:--:|:--:|
| Concern | ✅ | ✅ |
| Context | ✅ | ✅ |
| Outcome | 1/9 areas | **8/9** (entrepreneurship deferred) |
| Journey | 1/9 | **8/9** |
| Decision | 1/9 | **8/9** |
| Product | 1 live | **2 immediate + 3 after assets** |
| Growth Plan | outcome-level only | **+ skill-level (after taxonomy)** |
| Mentor | partial | **8/9 typed** |

## 5. Design invariants (must hold)
1. **Additive / byte-identical OFF** — flags off ⇒ today's behaviour exactly.
2. **Compose, never recompute** — outcomes/journeys re-shape derived data; assets are reference joins.
3. **Honest stubs** — `corpus_pending` is visible, never sold, never confidence-inflated.
4. **Provenance everywhere** — decisions carry `why[]`; asset scores carry `source` + directional tag.
5. **Reuse the vocabulary** — constructs, role catalog, CAP ladder, mentor types reused before new.

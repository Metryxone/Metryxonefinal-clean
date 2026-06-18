# WC-9 Deliverable 3 — Future Decision Catalog

New decisions the `decision-orchestrator` would emit once the new outcomes/journeys exist. These
extend the DC-1/DC-2 catalog; they are **read-only compositions** of (stage × outcome × route) —
the orchestrator already produces a `UnifiedDecision{stage, primary_outcome, route, confidence,
ambiguity, why[]}`; these rows just enumerate the new (outcome→route→product) triples it can now
resolve. No new decision *mechanism* — only new *targets*.

## 1. Decision rows
| Decision key | Trigger (primary_outcome) | Route resolved | Product | Confidence gate (D6) |
|--------------|---------------------------|----------------|---------|----------------------|
| `activate_ai_readiness` | `ai_readiness` | `ai_career_navigator` (→ employability_index if pending) | AI Career Navigator | ≥0.7 & low ambiguity else show_options |
| `activate_career_resilience` | `career_resilience` | `career_resilience_index` | Career Resilience Index | same |
| `activate_career_transition` | `career_transition_readiness` | `career_builder` / `emerging_careers_explorer` | Career Builder / Explorer | same |
| `activate_future_skills` | `ai_readiness` ∨ `career_transition_readiness` | `future_skills_planner` | Future Skills Planner (growth plan) | same |
| `activate_human_skill_advantage` | `human_skill_advantage` | `employability_index` | Employability Index 2.0 | same |
| `activate_entrepreneurship` *(DEFERRED)* | `entrepreneurial_readiness` (gated) | — | — | suppressed until ungated |

## 2. Decision principles carried forward (unchanged)
- **D6 confidence gating:** below `confidence≥0.7 && ambiguity==='low'` the decision returns
  `show_options` (surface, do not auto-recommend) — identical to WC-7C subscription gating.
- **D7 safety override (fail-closed):** a crisis/escalation audit event suppresses *all* commerce
  and product push regardless of outcome — future-readiness products are no exception.
- **Stub honesty:** when the resolved route is `corpus_pending`, the decision is emitted with
  `confidence_band=CORPUS_PENDING` and the product is marked not-yet-ready (never sold into).

## 3. `why[]` provenance (design)
Each new decision must populate `why[]` with the real chain, e.g.:
`["AI_FUTURE_OF_WORK context dominant (n questions)", "ai_readiness outcome activated via SKILL_AWARENESS+RESILIENCE overlap", "stage=Clarity", "routed to AI Career Navigator (corpus pending → Employability Index)"]`.
Provenance is mandatory — a future-readiness decision with an empty `why[]` is treated as degraded.

## 4. Honesty notes
- These are **target enumerations**, not a new prioritization engine. DC-2 priority weighting applies
  unchanged; future-readiness decisions compete on the same `fit_score`/confidence basis.
- No decision is catalogued for Entrepreneurship until its outcome is ungated — cataloguing it now
  would imply a reachable path that does not exist.

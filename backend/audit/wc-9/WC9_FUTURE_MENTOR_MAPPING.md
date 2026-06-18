# WC-9 Deliverable 6 — Future Mentor Mapping

Extends the WC-7B mentor bridge (`mentor-bridge.ts`) so future-readiness outcomes resolve mentors.
Backend-only, no cross-server call (carried forward). Reuses existing mentor types where they fit;
adds the minimum new types.

## 1. Existing mentor types (verbatim grounding)
`performance_coach · subject_tutor · exam_strategist · psychological_counsellor`
Existing `OUTCOME_MENTOR_MAP` maps outcome model_key → mentor types; `CONCERN_KEYWORD_MAP` is the
fallback when no outcome activated. `match_reason`/`source` provenance is mandatory.

## 2. New OUTCOME_MENTOR_MAP entries
| New outcome | Mentor types | New type? |
|-------------|--------------|-----------|
| `ai_readiness` | `career_transition_coach` [NEW], `performance_coach` | 1 new |
| `career_resilience` | `psychological_counsellor`, `performance_coach` | reuse only |
| `career_transition_readiness` | `career_transition_coach` [NEW], `performance_coach` | reuse + new |
| `human_skill_advantage` | `performance_coach`, `psychological_counsellor` | reuse only |
| `entrepreneurial_readiness` *(deferred)* | `entrepreneurship_mentor` [NEW] | deferred with outcome |

**Only ONE new mentor type is needed for the active set: `career_transition_coach`** (serves AI
disruption + career transition + future skills). `entrepreneurship_mentor` ships with the deferred
entrepreneurship outcome, not now.

## 3. New CONCERN_KEYWORD_MAP fallback entries
For sessions where no future outcome activated but the concern signal is clearly future-facing:
| Bucket | Regex (design) | Mentor types |
|--------|----------------|--------------|
| `ai_disruption` | `/(\bai\b\|automat\|robot\|obsolete\|replaced by)/i` | `career_transition_coach`, `performance_coach` |
| `career_transition` | `/(transition\|switch career\|pivot\|change field\|layoff\|redundan)/i` | `career_transition_coach` |
| `resilience` | `/(burnout\|adapt\|bounce back\|setback\|uncertain)/i` | `psychological_counsellor`, `performance_coach` |
> ⚠️ Keep the `\bai\b` word-boundary (WC-8 lesson: naïve `ai` substring matched train**ing**/ag**ai**n
> and inflated counts ~50×). A greedy regex here would mis-route unrelated sessions to AI mentors.

## 4. Provenance (unchanged contract)
- Outcome source → `"Mentor types derived from the activated outcome [Labels] at stage [Stage]."`
- Keyword source → `"…derived from the concern signal ([Labels]) at stage [Stage]; no outcome model activated."`
- `ready:false` honestly when neither outcome nor keyword matches — never a generic mentor default
  beyond the existing fallback route.

## 5. Honesty note
Mentor activation for future readiness is **almost entirely reuse** — 1 new type, no new mechanism,
no schema. It is the second-cheapest deliverable after growth plans. The mentor *supply* (whether a
`career_transition_coach` exists in the mentor pool) is a separate operational dependency flagged in
the Roadmap — the bridge resolves the *type*, not the inventory.

---
name: Employability Recommendation Engine (Phase 3.9)
description: How the competency-EI recommendation layer composes domains + signals into honest, three-status recommendations.
---

# Employability Recommendation Engine (Phase 3.9)

The recommendation layer (`ei-recommendation-engine.ts` + code-defined
`recommendation-library.ts` / `recommendation-rules.ts`) is the last link in the
competency-EI chain (3.4 profile → 3.5/3.6/3.7 readiness → 3.8 signals → 3.9
recommendations). Flag-gated behind `competencyEi`/`FF_COMPETENCY_EI`; library +
rules are CODE (no table) so flag-OFF is byte-identical with zero DDL.

## Three-status honesty model (the core rule)
Each curated rule resolves to exactly one of:
- **emitted** — trigger MEASURED and satisfied → surface the recommendation.
- **not_applicable** — trigger MEASURED but NOT satisfied (e.g. domain already at/above
  threshold) → an honest non-recommendation, NOT a fabricated rec, NOT withheld.
- **withheld** — trigger UNMEASURED (domain has no score) or signal INDETERMINATE/
  unmeasured → never recommend on absent evidence.

**Why:** the platform's honesty-first contract — Coverage (share of rules whose
trigger is measurable) and the emitted count are SEPARATE axes; collapsing
"measured-but-not-needed" into "withheld" (or vice-versa) corrupts coverage.
**How to apply:** any new rule must map its trigger to one of these three; never
default an unmeasured trigger to a 0/false "not needed".

## Trigger evaluability gotchas
- **Domain triggers**: only the 4 MEASURABLE onto_domains
  (cognitive/interpersonal/behavioral/functional). `dom_strategic` is unmeasurable
  (no bank code) — NEVER write a rule on it; it could only ever be withheld and
  would just drag the coverage denominator down for no value.
- **Signal triggers** (reuse Phase-3.8 `computeEmployabilitySignals`, never
  recompute): only `fired`/`not_met` are CONCLUSIVE. `indeterminate`/`unmeasured`
  → withheld (some contributing competencies unmeasured, so the trigger can't be
  evaluated). Emitted signal recs INHERIT the signal's confidence_band.

## Priority
Deterministic, derived from measured severity: a domain trigger at the `low` band
(<50) lifts the rec to `high`; otherwise the rule's base_priority stands. Never tuned.

## Drift guard
`RECOMMENDATION_LIBRARY` and `RECOMMENDATION_RULES` must stay 1:1 by id. The engine
degrades a library entry with no matching rule to `withheld` (config-gap note),
never fabricates — but keep them in lockstep when adding/removing recs.

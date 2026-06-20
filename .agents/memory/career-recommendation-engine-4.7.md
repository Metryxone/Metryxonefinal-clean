---
name: Career Recommendation Engine (Phase 4.7)
description: Name-collision discipline + honesty model for the 4.7 recommendation aggregator that composes the 4.x career chain into 6 recommendation types.
---

# Career Recommendation Engine (Phase 4.7)

Additive, flag-gated (`careerRecommendation`, env `FF_CAREER_RECOMMENDATION`) read-only
aggregator that COMPOSES the Career Development chain (4.6 → 4.5 → 4.4 → 4.3) with the
live `cg_roles` catalog into SIX recommendation kinds: role / career / industry /
function / future_role / alternative_career.

## Name-collision trap (the main reason this is namespaced)
There are THREE pre-existing "recommendation" surfaces this must NOT clobber:
- `services/career-recommendation-engine.ts` — the CGI ranked next-role engine that
  WRITES `cg_user_recommendations`. Different concern, do not touch.
- `services/recommendation-library.ts` / `recommendation-rules.ts` — Phase-3.9
  Employability code-defined catalogs (different namespace).

**Why:** colliding on these names/tables would silently shadow or overwrite a live
engine. **How to apply:** 4.7 lives in `services/career-recommendation-aggregator.ts`
and owns its own `career_recommendation_library` / `_rules` / `_history` tables, all in
the career-* 4.x chain naming. Grep for an existing "recommendation" symbol before
adding any new one in this codebase.

## Honesty model (Coverage ≠ Confidence)
`personalized` is a per-ITEM property meaning "the rec's CONTENT (selection/ranking)
consumed the subject's measured profile" — NOT a per-type hardcode. It governs whether
the item inherits the development chain's confidence band vs falls back to `Provisional`.

- **Personalized** (content is subject-tailored → inherit chain confidence; honest-empty
  when not measurable):
  - `career` — consumes the measured readiness band + most-material development stream.
  - `role` — pool FILTERED to the subject's anchor function (`dev.target_role` matched
    to `cg_roles.function_area`). `personalized` must equal the disclosed
    `evidence.same_function_as_anchor`; when no anchor matches it degrades to market-wide
    + `Provisional`.
- **Market-only** (catalog ranking, content identical for every subject →
  `personalized:false` + `Provisional` ALWAYS; legitimately fires for unknown subjects,
  cg_roles is real data not fabrication):
  - `industry`, `function` — group means over the catalog.
  - `future_role` — catalog-wide growth/automation-resilience blend. **Trap:** the subject
    may have a measured FRP future-outlook, but the ranking does NOT consume it, so marking
    it personalized off FRP-presence is an OVER-CLAIM. Keep `friMeasured` in `evidence` as
    disclosure only; never let it set `personalized`/confidence.
  - `alternative_career` — uses the anchor ONLY to EXCLUDE the anchor function; conservative
    market-only because transferability is explicitly not asserted.

**Why:** forcing genuinely-tailored types (role/career) to Provisional understates what we
know; letting a subject-identical ranking (future_role) claim personalization inflates it.
Both are dishonest in opposite directions. Invariant:
`personalized_count + market_only_count === total_recommendations`. Smoke asserts the
per-type classes (not just aggregate counts) so neither drift can pass again.

## Contract reminders (same as the rest of the 4.x chain)
- Flag-OFF = byte-identical incl. SCHEMA: route gate is the FIRST statement (503 before
  any DB touch); no `ensure*Schema` is reached with the flag off.
- GET-never-writes: `buildCareerRecommendations` / `loadLibrary` / `loadRules` /
  `listCareerRecommendationHistory` use `to_regclass` probes and fall back to inline
  defaults — DDL lives ONLY on the admin POST paths (seed/CRUD/snapshot).
- Composes, never recomputes: reuses `buildCareerDevelopment` + `listRoles`; ranking is
  min-max scale-free within the candidate set (flat range → 0.5, no false spread).
- History is append-only via the explicit snapshot POST only.

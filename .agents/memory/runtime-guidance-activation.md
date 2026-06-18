---
name: Runtime guidance (PIL) activation
description: Surfacing the admin-authored PIL guidance chain inside the live CAPADEX report — join realities, resolution cascade, and display quirks.
---

# Runtime Intelligence Activation (PIL "Your Growth Path")

Surfaces the existing admin-only PIL chain (archetype → human problems → behaviours →
search intents → interventions → action plan / growth pathway) inside the live
assessment report. Strictly additive, flag-gated, read-only.

## Join realities (non-obvious)
- `archetype_concern_map` has **no `archetype_name` column** — the display name lives in
  `archetype_library` (`archetype_key → archetype_name`). LEFT JOIN it; never SELECT
  `acm.archetype_name`.
- The chain: `capadex_sessions.master_concern_pk → capadex_concerns_master.id →
  .concern_id → archetype_concern_map.archetype_key`. Then PIL libraries key off
  `archetype_key` (+ `stakeholder_type`), and `behavior_library` keys off `concern_id`.
- Stakeholder vocab is American: `student|parent|teacher|counselor|professional`.

## Resolution must cascade + degrade
**Why:** in practice only ~1 of 26 sessions carries `master_concern_pk`; the rest have
free-text `concern_name`, and exact name→`archetype_concern_map.concern_name` match is
rare (~1/5). So `resolveConcernArchetype` cascades master_pk → name_exact →
display_label → conservative token-overlap → none, and an unresolved concern returns a
**degraded** bundle rather than mis-routing. The real lever to improve coverage is
persisting `master_concern_pk` earlier in the funnel (a follow-up), not loosening the matcher.
**How to apply:** keep token-overlap strict (≥2 shared tokens AND ≥60% coverage) and
deterministic (stable tie-break on concern_id then archetype_key; ORDER BY on every
LIMIT 1). Vague phrases must fall to `none`, never guess.

## behavior_library `{token}` placeholders
~64% of `behavior_library.behavior_statement` rows contain authored slot tokens like
`{evaluation}` / `{high_stakes_task}`. Filtering them out guts the list; fabricating
fills breaks read-only canon. Render them legibly instead (strip braces, de-snake) —
display-only normalisation in the report (`humanise()`), no new content.

## Flag / contract shape
- Flag `runtimeIntelligenceActivation` (config/feature-flags.ts, default OFF,
  env `FF_RUNTIME_INTELLIGENCE_ACTIVATION`). Route `GET /api/capadex/session/:id/guidance`
  is PUBLIC (mirrors /explain). **Flag gate runs before the UUID guard**, so flag-OFF is
  inert for ANY input (`{enabled:false}`); flag-ON returns 400 for a bad UUID.
- Engine `buildGuidanceForSession` honours its own never-throw contract (inner fn wrapped
  → degraded bundle on any DB error), independent of the route's `.catch`.
## Degraded ≠ hidden (graceful degradation contract)
**Why:** "graceful degradation" here means *still surface something*, not vanish. A first
pass hid the whole section on `degraded`, which silently dropped the ~13.6% of sessions
whose concern can't be fully mapped — a review-blocking contract violation. Precedent:
the orphan-concern-fallback insight at /explain shows one general-support note for empty
spines rather than nothing.
**How to apply:** Hide the section ONLY when flag-OFF / no response (`enabled===false`) —
that's the byte-identical legacy case. When `enabled && degraded`, render a deterministic
general-support card (static UI copy, NOT engine-authored → stays read-only) plus any
partial resolvables. The engine preserves partials: when no archetype resolves but a
`concern_id` did, it still loads concern-level behaviours (behaviour library keys off
concern_id, not archetype) instead of returning all-empty. `degraded` stays true (chain
incomplete) but the bundle isn't empty. The mount-time fetch still fires (same as omega-x);
"byte-identical" is about the rendered report + data, not zero requests.

---
name: Runtime Intelligence Pipeline (Phase 6A)
description: read-only resolver that stitches the full forward CAPADEX lineage for one session by composing the existing guidance engine
---

# Runtime Intelligence Pipeline resolver

A read-only, flag-gated resolver that walks the full forward chain for ONE assessed
session and returns it as one ordered 8-node / 7-hop lineage:
Response → Signal → Concern → Capability → Problem → Behavior → Archetype → Intervention.

**It is a COMPOSER, not a new engine.** The back half (concern→archetype→problems→
behaviours→interventions/action-plan) already exists, read-only, in the guidance engine's
`buildGuidanceForSession`. Phase 6A only adds the FRONT half (activated session signals +
the capability/problem framing of the concern) and stitches every hop into one lineage.
**Why:** duplicating the back-half loaders would let the two surfaces drift; reuse keeps
them in lockstep. The guidance engine's loaders are intentionally NOT exported — compose
the whole bundle, never re-export internals.

## Degradation must be honest across the WHOLE chain
`degraded` = true if ANY hop fails to resolve (not just the tail), OR no concern resolved,
OR the underlying guidance bundle is degraded.
**Why:** an early version only degraded on tail hops (steps ≥5), so a structurally
incomplete chain missing a middle hop (e.g. Concern→Capability when the concern has no
`capability_problem_map` row) was wrongly reported `degraded:false`. A partial 8-node chain
IS degraded — surface it, never fabricate a hop to hide the gap. Most live sessions are
genuinely degraded here because few concerns have a capability_problem_map row.
**How to apply:** any new hop added to the lineage must be covered by the
`hops.some(h => !h.resolved)` check; each hop owns its own `resolved` flag + honest summary.

## Capability + Problem come from ONE row
`capability_problem_map` stores both framings of a concern in the same row
(`capability_concern_id == problem_concern_id`), so a single lookup by concern_id gives
BOTH `capability_name` and `problem_name`. Don't issue two queries.

## Canon (identical to Phase 6 activation)
- Flag gate (`runtimeIntelligencePipeline`, env `FF_RUNTIME_INTELLIGENCE_PIPELINE`, default
  OFF) is checked BEFORE the UUID guard → flag-OFF is inert `{enabled:false}` for ANY input
  incl. bad uuid (byte-identical legacy). Route mirrors the existing `/guidance` route.
- Orchestrator is try/catch wrapped → returns a degraded payload, NEVER throws.
- Deterministic: ordered SQL + signal cap (8) + stable tie-breaks; pure `assemblePipeline()`
  is fully unit-testable with no DB.
- Newly-added route returns `Cannot GET` until the Backend API workflow is restarted (tsx
  hot-reload does not pick up brand-new route registrations) — restart before smoke-testing.

## Phase 6B — Student Runtime View (frontend presentation)
The student-facing surface is a pure re-grouping of EXISTING engine output, never new data.
Six fixed-order sections in `CapadexReportPhase.tsx`: Top Archetypes · Key Problems ·
Emotional Indicators · Immediate Actions · 7-Day Plan · Growth Opportunities. Five come
from the Phase-6 `/guidance` bundle (already fetched); only **Emotional Indicators** needs
`/pipeline` — hop[0] (`response_to_signal`) activated signals, filtered to
`signal_type==='activated'`, excluding `GENERAL_CONCERN` + implicit telemetry (rapid/hesit).
**Why two flags:** the view degrades section-by-section — guidance OFF hides the whole card
(`enabled===false → null`, byte-identical legacy); pipeline OFF/failure only drops the
Emotional Indicators row.
**How to apply (don't regress):** (1) a separate fetch's state (e.g. `emotionalSignals`)
MUST reset to `[]` at effect start AND on `enabled:false`/catch, or a session switch leaks
the prior session's signals while guidance stays mounted; (2) when restructuring a render
block into buckets, re-audit EVERY field the old block showed (`plan_title`/`total_days`
were silently dropped) — bucketing is lossy unless you check.

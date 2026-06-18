---
name: Concern → Signal mapping engine
description: Non-obvious calibration when mapping CAPADEX concerns onto the signal ontology (Tier-3/atomic/composite) + chain validation.
---

# Concern → Signal Mapping Engine

Maps the concerns master onto the EXISTING signal ontology. Never creates signals; orphans are flagged, never fabricated. Additive data + tooling — does not touch the live picker / runtime activation.

## Calibration lessons (learned against real data)
- **Exact bridge-tag matches are WEAK in practice** — only a handful of concerns share a Tier-3 signal's bridge tag. So **token-semantic matching (curated synonym map per Tier-3 token, scored against concern text + cluster + domain) is the PRIMARY resolver**, not exact bridge match. The fallback cascade ends in a low-confidence atomic GENERAL_CONCERN, then an explicit orphan marker — never silent fallthrough.
- **Compute confidence-band distribution over Tier-3 rows ONLY.** The atomic fallback emits one intentionally-WEAK row per otherwise-unmatched concern (the large majority of concerns). Banding over ALL rows makes the dashboard look dominated by weak mappings; banding over Tier-3 rows shows the real curated-mapping quality.
- **Some Tier-3 signals legitimately never expand to a composite** (a composite needs ≥2 co-active signals in one cluster). A "signal without composite" finding is structural truth, not a bug.

**Why:** quality > coverage %. Inflating coverage by fabricating signals or forcing weak rows into "covered" hides the real gaps the roadmap needs to surface.

**How to apply:** keep token-semantic primary, keep band stats Tier-3-scoped, keep orphans as explicit marker rows rather than a silent GENERAL_CONCERN fallthrough.

## Wiring the map into the LIVE activation runtime (a follow-up, if undertaken)
The map is data-only. To make it fire the Signal→Composite→Pattern→Intervention spine for concerns whose bucket token is NOT itself a Tier-3 token, you seed direct activations — the non-obvious constraints:
- **Sessions carry only concern *text*, no master id** → resolve to the best master concern with the SAME token-overlap logic the analyze route uses (persisting the id at start is the cleaner fix).
- **Seed strength must be data-driven** (mean evidence strength × mapping confidence), built from committed evidence INSIDE the same advisory-locked txn so replays converge (idempotent like the rest of the spine).
- **Seed only Tier-3 strong/moderate rows** — exclude atomic/bridge-tag (not composite-actionable) and orphan/fallback (no fabricated intelligence).
- **Graceful degradation is free:** empty seeds (absent/orphan concern) must leave the pipeline byte-identical.

**Why:** the gap was never the map — evidence is keyed by the coarse bucket token, but composites match the fine Tier-3 tokens; seeding bridges that without recomputing or fabricating.

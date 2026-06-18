---
name: WC-1B signal grounding implementation
description: How bridge-tag↔signal grounding is stored/measured; the additive-reuse pattern and its guardrails.
---

# WC-1B — Signal Grounding Implementation

Implements the WC-1A approved GREEN mappings (182 bridge tags) by **recording reuse relationships**, NOT by restructuring the ontology.

## Storage = additive reuse-linkage tables (never mutate the ontology)
- `capadex_bridge_tag_family_grounding` (tag↔family) + `capadex_bridge_tag_signal_grounding` (tag↔atomic), provenance `wc1a_green`, `UNIQUE(bridge_tag, atomic_signal_id)` / `UNIQUE(bridge_tag, signal_family)`. Same layer-pattern as `capadex_concern_signal_map`.
- **Do NOT** change `capadex_atomic_signals.relational_bridge_tag` to ground a tag — that would be ontology restructuring + a destructive mutation. Grounding is a *new mapping layer* on top of the untouched ontology.
- A signal may legitimately ground multiple tags (reuse); uniqueness is enforced *within* a tag, never across tags.

**Why:** the user's hard constraints were no new signals/concerns/bridge tags + no ontology restructuring + reversible. Additive provenance-stamped tables satisfy all of these and roll back via `DELETE WHERE provenance='wc1a_green'`.

## Measurement rules (else numbers drift on rerun / look fabricated)
- Coverage denominator = **328 distinct `relational_bridge_tag` in `capadex_concerns_master`** (the WC-1/WC-1A denominator). A tag is grounded if it has native atomic signals OR a grounding-table row (UNION).
- **Baseline `before` must be native-only** (`coverage(pool,{nativeOnly:true})`) so it is independent of any prior `wc1a_green` rows — otherwise reruns flatten the delta. `after` = union.
- Health = WC-1's 8-layer mean holding the other 7 layers fixed and swapping only the signal layer = signal-coverage %.
- Implementing exactly GREEN reproduces the WC-1A forecast to the decimal (7.6→63.1 tags / 42.8→90.4 concerns / 60.8→67.8 health) — that exact match is the consistency proof.

## Guardrails the code must ENFORCE (not just assert)
- **Integrity:** drop any `(tag,family)` whose tag ∉ canonical concern-tag set pre-insert, AND a post-write check that 0 non-canonical tags landed. "No new bridge tags" is procedural (free-text column, no FK) so it needs this guard.
- **Verification scoped** `WHERE provenance='wc1a_green'` (shared unique keys → cross-provenance ambiguity otherwise).
- No-fabrication = LEFT JOIN orphan check vs `capadex_atomic_signals` = 0; no-dup = total rows == distinct pairs; immutability = before/after row-count fingerprints on atomic/concerns/distinct-tags.

## Scope boundary
Runtime signal-activation / resolver wiring is **deliberately OUT OF SCOPE** (deferred follow-up). Resolver-impact + question-quality figures are therefore **directional forecasts**, NOT measured runtime deltas — label them as such, never claim measured accuracy gains.

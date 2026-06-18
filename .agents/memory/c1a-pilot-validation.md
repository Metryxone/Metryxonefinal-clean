---
name: C-1A pilot validation (question differentiation)
description: Empirical findings from the sandbox pilot of the C-1A Question Differentiation Architecture on the 10 largest signal-blind bridge tags.
---

# C-1A pilot validation — durable findings

Sandbox pilot (`pilot_c1a_enrichment`, revert = DROP TABLE) on the 10 largest signal-blind
tags (~7,060 Qs) measured the C-2-deferred dimensions (capability/behavior/signal facets)
added on top of the already-shipped Context + Archetype.

**Rule: report differentiation coverage-weighted (realized × classified coverage), never
raw-where-present.** The two frames differed ~2× (+336% raw vs +145% coverage-weighted). A
dimension that differentiates well but fires on a tiny minority of questions is near-worthless;
coverage is the gate.

**Rule: signal backfill requires PER-QUESTION evidence.** Tag-level grounding alone is NOT
evidence for an individual question → must return UNCLASSIFIED. Enforcing this dropped pilot
signal coverage 5.7% → 1.2% (85/7,060). Never force-assign a family from tag grounding.

**Finding that overturns a C-1A assumption:** C-1A ranked signal backfill as "cheapest /
highest-priority #1." The pilot shows the OPPOSITE for the flagship generic pools — 9 of the 10
largest signal-blind tags have ZERO rows in `capadex_bridge_tag_signal_grounding`. (Repo-wide,
119/144 signal-blind tags DO have weak grounding, so backfill is feasible for *smaller* tags,
just not the big generic ones.) The largest/most generic tags are the hardest to ground.

**Contribution to the differentiation gain (coverage-weighted):** Archetype ~62% (high yield AND
~100% coverage, from structured narrative_style), Capability ~31% (only ~49% text coverage),
Behavior ~7% (only ~10% coverage — observable actions rarely extractable from clarity-question
text), Signal <1% (grounding-blocked). **Context = 0 within-tag differentiation by nature — its
value is cross-tag ROUTING** (+39–87pp domain-routing precision in the QRS sim). Measure context
by routing, never by within-tag spread.

**Go/No-Go basis:** Context + Archetype GO (already C-2-shipped, vindicated). Capability
CONDITIONAL (coverage gate + richer evidence than text alone). Behavior NO-GO as text-only
auto-enrichment. Signal NO-GO for flagship tags / CONDITIONAL for the 119 grounded ones. The
prior C-2 ordering (Context+Archetype first, defer the other three) was correct.

**SQL gotcha:** `MAX(evidence_strength)` over text is LEXICAL — 'weak' sorts last alphabetically
and would win. Use an explicit ordinal CASE (weak<moderate<good<strong) then map back.

---
name: Assessment preview per-instance variation
description: Why the CAPADEX Clarity Report Preview read identically across different concerns, and the rule for making per-instance copy actually vary
---

## Per-instance copy must key on the specific entity, not just a broad bucket
**Rule:** When users report "the output looks the same for every X," check whether the
narrative copy is keyed on a coarse bucket (here: the broad 8-category career/academic/
emotional/…) while the truly distinguishing value (the specific concern the user typed)
is never surfaced. Surface the specific entity and weave it into the copy.
**Why:** The Clarity Report Preview (`CapadexBridgePhase.tsx`) had OPENER/REASSURANCE/
CURIOSITY_INTRO/etc. maps keyed only on category, so two different concerns in the same
category rendered word-for-word identical even though backend `ci` data differed slightly.
The distinguishing value (`selectedConcern`, set in the analyze handler) was available but
unused in copy.
**How to apply:** Drive at least the headline identity + one narrative line from the
specific value. Do NOT gate that on a length threshold — a hard "only if short enough"
check silently reverts long inputs to generic copy. Truncate for DISPLAY (CSS truncate /
inline ellipsis), never as a logic fallback that drops personalization.

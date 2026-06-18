---
name: Audit runtime fidelity (fallback classification)
description: An offline audit that classifies "fallback/coverage" must mirror the production resolver, not assume literal static fallback.
---

# Audit must mirror the production resolver, not a naive fallback assumption

When auditing the CAPADEX clarity-question bank for "fallback overuse", the naive
read is: a concern with no curated questions → static fallback. That is WRONG and
reads as fabricated severity.

**Rule:** an offline/read-only audit that reports a runtime behaviour must replicate
the production resolution path, not a simplified one.

**Why:** production `pickQuestionsFromMaster` does NOT drop orphan bridge tags to
static `CLARIFICATION_QUESTIONS`. It calls `resolveCoveredBridgeTag(tag, covered)`
which REMAPS the orphan to a covered bucket via: covered-self → explicit override map
(`ORPHAN_BRIDGE_TAG_FALLBACK`) → ordered keyword rules (`BRIDGE_TAG_KEYWORD_RULES`)
→ `GENERAL_CONCERN` catch-all → only then static. In one run, 524 uncovered concerns
were 488 remapped-to-sibling / 36 GENERAL_CONCERN / **0 truly static**. The real
defect is *loss of concern-specificity* (inheriting another bucket's questions), not
literal static fallback.

**How to apply:** copy the production resolver's constants AND their resolution ORDER
into the audit; emit a per-row `resolves_to` + `route` label so the finding is
falsifiable. If production constants (e.g. `COVERED_BRIDGE_TAGS`, override/keyword
maps) change, re-run and REGENERATE artifacts from the script — never hand-edit the
report. Keep counts that come from live SELECTs (e.g. signal/atomic totals)
interpolated from summary, never hardcoded magic numbers.

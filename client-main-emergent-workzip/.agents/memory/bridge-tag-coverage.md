---
name: Bridge-tag coverage & resolver
description: How clarity-question coverage of concern bridge tags works, and the single-source resolver rule.
---

# Bridge-tag coverage (CAPADEX)

Concerns carry fine-grained `relational_bridge_tag` values (hundreds); clarity
questions are authored against only the 56 canonical `master_bridge_tag` buckets.
The picker joins `clarity.master_bridge_tag = concern.relational_bridge_tag`, so a
concern whose tag has no clarity rows gets NO curated questions unless it is
remapped to a covered sibling.

## Single-source resolver — do not duplicate
The resolver (`COVERED_BRIDGE_TAGS`, `ORPHAN_BRIDGE_TAG_FALLBACK`,
`BRIDGE_TAG_KEYWORD_RULES`, `resolveCoveredBridgeTag`, `classifyBridgeTagRoute`)
lives in ONE module and is imported by both the runtime picker and the read-only
coverage tooling.
**Why:** previously the constants were copy-pasted between the picker and an audit
script — the exact drift trap. If you change routing, change the shared module
only.
**How to apply:** any new tag→bucket logic goes in `bridge-tag-resolver.ts`; every
override target MUST be a member of `COVERED_BRIDGE_TAGS` (verify before adding).

## "Covered" has two distinct meanings — keep both visible
- `coverage_status='covered'` ⇔ the tag actually has clarity rows (`question_count>0`).
- `in_covered_set` ⇔ membership in the canonical `COVERED_BRIDGE_TAGS` set.
These usually agree but are computed independently; surfacing only one causes
"why is this covered but empty?" confusion. Keep both in dashboards/exports.

## Remap, don't bulk-generate
The fix for tags falling back to the generic `GENERAL_CONCERN` bucket is to route
them to the closest covered sibling (hand-verified override or keyword rule), NOT
to auto-seed questions.
**Why:** product constraint — quality > coverage %; bulk-generated questions
degrade production quality. The roadmap only *estimates* curated inventory needed.
**How to apply:** to retire a `general`-route tag, add a semantically-defensible
sibling override; verify with `scripts/audit/coverage-roadmap.ts` that the
`general` route count stays ~0.

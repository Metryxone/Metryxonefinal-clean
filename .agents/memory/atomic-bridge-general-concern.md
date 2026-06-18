---
name: Atomic-signal GENERAL_CONCERN catch-all
description: Why the big "65% unmapped" atomic-signal bucket is mostly correct, and the only safe way to shrink it.
---

# Atomic-signal `relational_bridge_tag = 'GENERAL_CONCERN'` is NOT a defect

The `capadex_atomic_signals` ontology is a **capability** vocabulary, so the large
`GENERAL_CONCERN` catch-all (~65% of 15,972) is **mostly correct**: the overwhelming
majority are POSITIVE capability signals (strengths) that have no specific *concern*
to attach to. The atomic vocab (~6 capability-themed domain tags) and the
`capadex_concerns_master` vocab (~290 help-topic tags) are **disjoint ontologies** —
zero domain-name overlap. So any remap target MUST be validated to exist in the
master set before writing (the script aborts otherwise).

**Why:** A user read the panel's "65% unmapped" as a bug. Force-connecting all of
them was explicitly REJECTED by design — feeding strengths into a problem-diagnosis
engine would corrupt it.

**How to apply:**
- Only **negative** atomic signals (`signal_category='negative'`) that are still
  `GENERAL_CONCERN` are remap candidates, and only when their *family theme*
  unambiguously supports a concern (hand-verified `NEGATIVE_FAMILY_BRIDGE_MAP` in
  `backend/services/atomic-bridge-resolver.ts`). Ethics / cognitive-capability /
  ambiguous families are deliberately FLAGGED for human review, never mapped.
- Of ~1,361 negatives, ~1,006 were resolvable to 23 real concern buckets; ~355
  flagged. Remaining catch-all is ~96% positive → reframe the panel as
  "broad / cross-cutting (mostly strengths)", not "unmapped gap".
- Live runtime is unaffected: omega-x scoring keys off `atomic_signal_id`, not the
  bridge tag. Only the additive concern-signal-map regen + ontology stats/audit
  read the atomic bridge tag.
- Remap script is dry-run-default, `--apply` is txn/idempotent/scoped, `--revert`
  is **guarded** (rolls back only rows still holding the script-assigned tag AND
  still negative — never clobbers later manual curation on the same ids).

## Strengths get their own bucket — `STRENGTH_SIGNAL` (the honest path to "100%")

When a user asks to "make the panel 100%", the answer is NOT to force-map the rest
into concerns. The positive capability signals that were diluting `GENERAL_CONCERN`
get their OWN explicit tag `STRENGTH_SIGNAL` (constant in
`backend/services/atomic-bridge-resolver.ts`). Script
`backend/scripts/audit/classify-strength-signals.ts` (dry-run default, scoped to
`signal_category='positive' AND relational_bridge_tag='GENERAL_CONCERN'`) moved
~8,970 rows out. After: `STRENGTH_SIGNAL` ≈ 8,970, `GENERAL_CONCERN` ≈ 376
(negative + ambiguous = the genuine human-review queue), unsorted = 0.

**Why:** Strengths and concerns are disjoint ontologies; a strength is a real
classification, not an "unmapped" defect. Separating them is honest AND keeps the
diagnosis engine clean.

**How to apply (panel metric MUST stay honest — no vanity 100%):**
- The panel's headline metric is `atomic_resolved_pct = (total - review_queue - unsorted)/total`
  (`routes/capadex-ontology-hub.ts` `/stats`). It reads **97.6%**, NOT 100% —
  "resolved" = committed to a specific concern OR strength; the 376 review-queue
  rows are deliberately NOT counted as resolved. A literal 100% requires HUMAN
  authoring of those 376, never auto-mapping. (Baseline before any of this: ~35%.)
- Do not hardcode `classified = total` — that is a tautology the architect rejects.
  The pct must be a real predicate that only hits 100 when review_queue AND
  unsorted are both 0.
- `STRENGTH_SIGNAL` is an intentional **atomic-only** bridge tag — it does NOT exist
  in `capadex_concerns_master` and is not expected to join. `atomic_bridge_buckets`
  (distinct tag count) therefore includes concern + strength + review tags; label it
  "Bridge buckets", not "Concern buckets".
- `EXAM_STRESS` / `COLLEGE_ADAPT` are legit atomic concern tags that also are NOT in
  master — so "tag ∈ master" is the WRONG classified predicate (undercounts). Use the
  review_queue + unsorted exclusion instead.

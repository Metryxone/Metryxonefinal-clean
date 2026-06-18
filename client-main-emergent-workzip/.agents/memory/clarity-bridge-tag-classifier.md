---
name: Clarity-question master_bridge_tag derivation
description: How clarity rows get their master_bridge_tag join key, and why imports without it silently break joinability.
---

# Clarity bridge-tag classifier & import derivation

The clarity → concerns-master join is **bucket-level**: `capadex_clarity_questions.master_bridge_tag = capadex_concerns_master.relational_bridge_tag`. It is NOT keyed on `concern_id` — clarity has its own legacy concern_id keyspace, so panel counts like "unique concerns / prefixes" being far below the 2,489 master concerns is EXPECTED, not a bug.

`master_bridge_tag` is a SEMANTIC bucket. It is NOT a column the source authors; it is **derived** by the offline audit (`scripts/audit_clarity_questions.py`) via a cascade: curated `PREFIX_TO_MASTER_BRIDGE[concern_id_prefix]` (high precision) → token-heuristic of concern text vs the master vocabulary (last resort) → `'UNMAPPED'` sentinel. The seed only *reads* the tag from the audited CSV.

**The trap:** importing a clarity CSV that lacks a `master_bridge_tag` column makes every row default to the `'UNMAPPED'` sentinel → unjoinable. This silently tanks joinability (seen once: 9,080 orphan rows dropped joinable to 61.2%). It is NOT an import column-reading bug — verify that first (a CSV *with* the column maps fine).

**The fix pattern (single source of truth):** the cascade lives in the pure module `backend/services/clarity-bridge-classifier.ts` (`resolveMasterBridgeTag`, `tokenFallback`, `loadMasterVocabulary`, `PREFIX_TO_MASTER_BRIDGE`), ported from and kept in lockstep with the Python audit. Both the import route and the backfill script import it so they can never drift.
- Import derives only when the incoming tag is blank/missing or the literal `'UNMAPPED'` sentinel; an explicit non-sentinel CSV tag is preserved.
- `loadMasterVocabulary` = distinct `relational_bridge_tag` in master, so token-fallback results are guaranteed joinable; `ORDER BY` makes ties deterministic (lexically-smallest wins).
- Residual no-match rows stay `'UNMAPPED'` — flagged for human curation, **never fabricated**.

**Why:** quality > coverage %. The curated prefix map is high-precision; the token heuristic is a low-precision last resort that can pick a weak bucket on ambiguous text. Honest UNMAPPED gaps are correct.

**How to apply:** if joinability drops after a clarity import, check for an UNMAPPED spike first; backfill existing orphans with `npx tsx backend/scripts/backfill-clarity-bridge-tags.ts` (dry-run, then `--apply`). Keep the TS map and the Python map identical when either changes.

## The stored `concern_id_prefix` column is NOT trustworthy
Some import batches ship a `concern_id_prefix` truncated to 3 chars (`AVOID`→`AVO`, `MULTITASK`→`MUL`, `FEAR`→`FEA`), padded (`LM`→`LM_`), or **collided** (`CONCEPTGAP`/`CONTASS`/`CONVCAR` all → `CON`). Trusting that column shadows curated keys even when the concept IS mapped (e.g. `FEA` missed the existing `FEAR` key → UNMAPPED). The reliable prefix is the **first token of `concern_id`** (regex `^([A-Z]+)_`), which is exactly what the Python audit extracts — so `resolveMasterBridgeTag` must prefer the full `concern_id` prefix and only fall back to the stored column. Curated map keys are therefore keyed by the FULL prefix, never the 3-char truncation.

**Why:** a batch imported without bridge tags AND with a truncated prefix column drove 1,200 rows (48 concerns × 25) to UNMAPPED at 94.9% joinable; preferring the full prefix + adding 48 curated long-tail entries took it to 100% (0 UNMAPPED). All 48 mapped to existing master `relational_bridge_tag` buckets — none fabricated.

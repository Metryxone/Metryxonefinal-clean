# CAPADEX — Ontology Guide

> Consolidation of the existing ontology. No ontology changes were made.

## Concern Hierarchy

```
Domain (20)  →  Family (400)  →  Signal (20)  →  Atomic signal (15,972)
```
- `capadex_domains` → `capadex_families` → `capadex_signals` → `capadex_atomic_signals`.
- The atomic `GENERAL_CONCERN` catch-all is **mostly positive strengths** by design (not a defect);
  only negative catch-alls are remapped, via a hand-verified family map, and the remainder flagged —
  never fabricated.
- Runtime keys off `atomic_signal_id`, not the bridge tag.

## Concerns Master

- `capadex_concerns_master` (~2,489 rows) — the canonical concern catalogue.
- `display_label` = user-facing copy; `concern_area / concern_id / domain / concern_cluster` are join
  keys.
- Public search `/api/concerns/search` supports persona affinity with `personaFallback:true` when
  widening.

## Bridge Tags (the join hub)

- ~325 bridge tags. **Join:** `concerns_master.relational_bridge_tag =
  clarity_questions.master_bridge_tag` (bucket-level, many-to-many; ~325 distinct).
- ⚠️ **`clarity.concern_id` is disjoint from `concerns_master` (0% join)** — the bridge tag is the
  only working ontology bridge. Age/persona/dev-stage inherited from a tag are *ambiguous*
  (multi-persona / wide age span; dev-stage taxonomy collapsed to "Clarity").
- The clarity `master_bridge_tag` is **derived** (curated prefix → token heuristic → UNMAPPED), not
  authored; a clarity import without the column silently defaults all rows to UNMAPPED and tanks
  joinability — a shared classifier runs on import + backfill, residual UNMAPPED never fabricated.

## Master Tags & Signal Grounding

- `capadex_bridge_tag_signal_grounding` — 303 grounded tags / 28,683 rows (by strength: moderate 121
  tags, good 171, strong 42). Of the 144 signal-blind tags, ~119 are weak-grounded and ~25 fully
  ungrounded (including the flagship generic pools).
- `capadex_bridge_tag_family_grounding` — family-level grounding.

## Relationships & Mappings

| Mapping | Table | Rule |
|---|---|---|
| Concern ↔ Clarity | `capadex_concern_clarity_map` | via bridge tag |
| Concern ↔ Signal | `capadex_concern_signal_map` | deterministic cascade: bridge_exact → **token_semantic (primary)** → cluster → domain → fallback → orphan |
| Clarity ↔ Master | (join) | `master_bridge_tag = relational_bridge_tag` |
| Bridge tag ↔ Signal/Family | grounding tables | provenance-stamped reuse-linkage (additive) |

## Governance Rules

- **Single shared resolver** (`services/bridge-tag-resolver.ts`) for runtime + tooling — never copied.
- **Question registry** lifecycle is **human-only** (never auto-deprecated; status transitions
  audited).
- **Ontology change audit** via `m3_ontology_*` and `gov_ontology_reviews` (append-only history;
  history tables never mutated in place).
- **Non-fabrication:** orphans/gaps are honest findings (UNCLASSIFIED / flagged), never invented.
- **Strengths canon:** strengths come only from CSI positive factors / positive longitudinal growth,
  never from raw concern-signal magnitude.

## Extension Rules

- Retire orphan / GENERAL_CONCERN tags by **sibling remap**, never by bulk question generation.
- New grounding is **additive & provenance-stamped** — never mutate `relational_bridge_tag`.
- Coverage means "has clarity rows," which is **not** the same as canonical-set membership — keep the
  distinction explicit.
- Any new ontology edge must derive from a **real linkage row** (one edge per real row; never dedup by
  relation/source/target). For the PIL knowledge graph use the `pil_kg_*` namespace — never the bare
  `kg_*` (live Employability graph).

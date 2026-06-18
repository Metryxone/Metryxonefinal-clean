---
name: PIL Similarity Intelligence engine (Phase 8C)
description: How same-category similarity is detected/persisted over the canonical PIL graph, and the calibration findings that are real (not bugs).
---

# PIL Similarity Intelligence (SimilarityEngine over pil_kg_*)

Detects similar nodes among the 6 PIL categories (concern, behavior, problem, archetype,
intervention, recommendation) using **same-category Jaccard over each node's FULL undirected
neighbor set**. Candidates are bounded to nodes that co-cite ≥1 of the anchor's neighbors
(local adjacency expansion, per-neighbor + maxExpand caps) — never a global O(n²) scan.

## Design rules (keep consistent)
- **`hub_only` (false-match flag) is judged over the FULL shared-neighbor intersection**, not the
  sampled subset surfaced for explainability. Compute the full intersection first, sample only for display.
- **Writing the derived `pil_kg_similarity_index` is NOT a graph mutation.** "Read-only of graph
  structure" means never touching `pil_kg_nodes`/`pil_kg_edges`; the derived index is fair game.
  Reuse the 8A table + `ensureGraphMaturationSchema` — no new migration.
- **Determinism**: sort `score desc → shared_count desc → id asc`; category node order comes from the
  (already sorted) traversal index. Tests assert byte-identical output under shuffled node/edge input.
- **One pure path for API + persistence**: `resolveSimilar` is the single resolver; `computeCategoryMatches`
  (batch) calls it so the persisted index can never drift from live API answers.
- **rebuild returns the batches it scored** so the audit computes ONCE (compute + persist in one pass),
  not twice.

## Performance trap
- Persisting ~40k+ rows with **per-row INSERTs hangs** (tens of thousands of round-trips → >120s timeout).
  Use a **chunked multi-row upsert** (1000 rows/chunk × 5 cols = 5000 params « 65535 limit), method-scoped
  DELETE then bulk INSERT … ON CONFLICT. Compute itself is fast (~5s for all 6 categories).

## Explainability metric (avoid the tautology)
- "match has shared_count>0" is **trivially 100%** (Jaccard pairs share ≥1 neighbor by construction) — do
  NOT report that as explainability. Instead measure **fraction of surfaced shared-neighbor refs that
  resolve to a real, labelled graph node** (integrity check → catches orphan ids / broken reasons).
  Vacuously 1.0 when a category produced no matches.

## Real calibration findings (NOT bugs — never tune to hide)
- **Concern↔concern and intervention↔intervention similarity is heavily hub-dominated** (~97% / ~74%
  hub-only at HUB_DEGREE_THRESHOLD=50): concerns share *popular signals* activated by many concerns, so
  most matches lean on weak high-degree hubs. Surface as false-match-review, don't suppress.
- **Problem coverage is low (~6.6%)** and **archetypes produce ~0 matches** — these high-level categories
  genuinely don't co-cite neighbors. Honest sparse findings; the harness is allowed to report low readiness.
- Readiness = `0.4*coverage + 0.4*explainability + 0.2*(1 - false_match_rate)`; pick HUB threshold a priori
  (50 is defensible in a 62k-node graph), never to make the number look good.

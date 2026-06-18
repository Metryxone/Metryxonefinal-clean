---
name: Graph validation certifier (PIL Phase 8F)
description: How the knowledge-graph readiness certifier composes prior engines, and the vacuous-empty-graph false-positive trap.
---

# PIL Phase 8F — Knowledge Graph readiness certifier

Certifies the PIL knowledge graph production-ready by COMPOSING the 8A–8E read-only engines
(traversal indexSummary, integrity+gap report, similarity category matches, explainability) —
never recomputing their internals. Output is a final recommendation:
`READY FOR PHASE 9` | `ADDITIONAL GRAPH WORK REQUIRED`.

## Vacuous-empty-graph false positive (the trap)
**Rule:** a certifier built from coverage rates + validations MUST have a graph-viability hard
gate (nodes>0 AND edges>0 AND statements>0) evaluated FIRST. Without it an EMPTY graph certifies
READY.
**Why:** rates use `safeRate(num, den)` which returns **1 when den=0**, and the integrity/lineage
validations pass *vacuously* when there are zero statements/nodes. So an empty index scored ~0.75
and passed every gate → false READY. The lower loaders (`loadMaterializedGraph`) degrade to empty
arrays silently, so a degraded load could otherwise be certified production-ready.
**How to apply:** any new readiness/coverage aggregate that defaults empty denominators to a
"perfect" value needs an explicit presence/population gate before the band/quality gates.

## Honest gating canon (do not tune)
- Hard gates = viability + integrity (no orphan statements) + lineage (no unsupported statements) +
  determinism + performance + readiness band ≥ moderate.
- Source-traceability (~56.6% on the real graph) is INFORMATIONAL, **not** a hard gate — it's the
  documented construct-sink architectural limit (recommendations/runtime_interventions anchor on the
  `construct` graph sink, so they're locally supported but don't chain to a concern/question). Never
  fabricate the missing hop; never weight it into the score.
- Weights (READINESS_WEIGHTS) are fixed a priori and sum to 1; the graph is never massaged to a score.

## Determinism + never-throws contract
- Determinism gate = recompute the report twice and compare via canonical **key-sorted JSON**
  deep-equality (strip the `generated_at` timestamp first).
- Only the async orchestrator (`runGraphValidation`) touches the DB; it never throws (falls back to
  `degradedReport()` → NOT_READY) and the ONLY write is an append-only `pil_kg_audit` `readiness_audit`
  row. Keep `degradedReport()`'s `hard_gates` array shape in lockstep with `computeReadinessReport`.

---
name: Behavior Graph consumer surface (Career OS)
description: How the unified Behavior Graph consumer surface maps the backend graph, and the valence rule for "strengths".
---

# Behavior Graph consumer surface

The frontend Career-OS unified surface (`strengths/risks/patterns/contradictions/growthDrivers/growthBlockers/competencySignals/meta`) is assembled deterministically from the persisted backend Unified Behavior Graph. It does NOT recompute intelligence — it reshapes already-persisted data.

## Strengths valence rule (non-obvious)
**CAPADEX session signals are concern-DIAGNOSTIC, not positive-valence.** A high-`strength` signal means a concern behaviour (overthinking, avoidance, …) is strongly present — it is NOT a strength. Deriving "strengths" from signal strength mislabels adverse behaviour as positive.

**Rule:** `strengths` come ONLY from genuinely positive-valence sources. In the graph that is CSI `positive_factors` (`csiFactors` where `kind === 'positive'`). Negative valence lives in `negative_factors` / risks.

**Why:** the graph has no positive/negative flag on signals; valence only exists on CSI factors and on growth `direction`. Treating signal magnitude as valence is the trap.

**How to apply:** any consumer that wants "what's going well" must read CSI positive factors and/or growth `direction ∈ {improving, recovering, emerging}` — never raw signal strength. Active concern signals are represented downstream via patterns, not as strengths.

## User→session bridge
User-level reads bridge to the latest CAPADEX session via `capadex_behavioural_memory` (latest `session_id` by `recorded_at DESC`), then read the persisted per-session graph. Strictly read-only and best-effort: unlinked user → null graph → callers degrade to existing behaviour (no behaviour change when absent).

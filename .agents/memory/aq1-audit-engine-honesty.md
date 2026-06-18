---
name: AQ-1 audit-engine honesty
description: Rules for building a read-only assessment-bank audit engine that won't mislead — measure, don't hardcode; thresholds must match documented definitions.
---

# Building an honest audit/scoring engine

When an engine's output is itself the deliverable (an audit), correctness and intellectual honesty matter more than polish. Hard-won rules:

- **Measure headline claims at run time — never hardcode them.** A "0% join" / "orphaned namespace" finding must be computed by a live query in the same run and the critical-gap text gated on the measured value. A baked-in `const X = true // proven in discovery` reads as measured but isn't, and silently rots.
- **Completeness thresholds in code MUST match the prose definition.** If the report says "Ambiguous = resolves to >1 value," the code must classify `count===1 ? Present : Ambiguous`, not `count>6`. A mismatch can swing a field's Present% by tens of points (here Signal 27.8%→0.3%).
- **Cite derivation stats from the engine, not from discovery scratch notes.** Discovery "avg 2.14 personas/tag" was raw `primary_persona` strings; the bucketed metric the ambiguity claim actually uses is 1.4 buckets/tag. Emit the authoritative number to the JSON and have the markdown quote that.
- **Distinct entity counts can differ between the bank and the ontology** — bank uses 325 distinct `master_bridge_tag`s but `concerns_master` defines 328; state which set a stat is computed over.
- **Overlapping band taxonomies need an explicit half-open rule IN CODE.** Labels like `6-14/14-17/17-24/24-45` overlap at 14/17/24; documenting "boundary→lower-bound band" is not enough — the range table must be non-overlapping (`14-17`→[14,16]) or boundary-only ranges get double-counted as ambiguous.

**Why:** the architect reviewer fails an audit that presents a derived/proxy/hardcoded number as ground truth, even when read-only and the verdict is otherwise sound.

**How to apply:** label every score/threshold as a chosen rubric or proxy where definitive wording appears; regenerate markdown numbers from the engine's JSON after any logic change (grep for stale literals); never tune a metric to flip GREEN/YELLOW/RED — a RED is a real finding.

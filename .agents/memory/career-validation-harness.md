---
name: Career validation harness honesty traps
description: Invariant/honesty pitfalls when a compose-only validation harness reads Phase-4.x career-engine envelopes
---

A read-only super-admin validation harness COMPOSES the career engines (no new scoring) and asserts per-area invariants. It runs under `tsx`, which does NOT type-check, so a wrong composed-envelope field name is silently `undefined` — that can both mask a real break AND fabricate a pass. Verify every field name against the source interface before trusting a green run.

**Trap 1 — sentinel bands count as ABSENT, not as a band.**
The readiness/roadmap engines emit a STRING sentinel (`'Unmeasured'`, confidence `'None'`) for an honestly-unmeasured block, with `score:null`. A naive band↔score coherence check (`hasScore === hasBand`) treats the non-empty sentinel as "has a band" and FALSE-FAILs honest absence.
**Why:** an unmeasured block is coherent (null score + sentinel band), not a fabrication.
**How to apply:** normalise band sentinels (`''/unmeasured/none/n-a`) to "absent" before the coherence comparison.

**Trap 2 — scaffold length ≠ reported count.**
The roadmap envelope ALWAYS carries 3 milestone scaffolds (one per band), but `summary.milestone_count` is the count of POPULATED milestones (`competency_count > 0`). Comparing `milestone_count === milestones.length` false-FAILs every empty/unmeasured roadmap.
**How to apply:** compare reported counts to the engine's own derivation (populated milestones), and use `<=` against the scaffold array length.

**General:** WARN = honest absence and must NEVER be a fail; FAIL is reserved for a real invariant break; `null != 0`. Career Matching (Phase 4.2) was never built → report WARN/not-measurable, never fabricate. If the competency runtime IS provisioned in the dev DB, subject engines actually run, so "unknown subject" exercises the real degraded-envelope path (not just the absent-runtime path).

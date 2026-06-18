# CAPADEX — Changelog

> Consolidation of milestones, decisions, and lessons across the CAPADEX audit & build chain.
> Narrative; no code/data changes.

## Major Milestones

### AQ-1 — Metadata Coverage Audit
Established per-dimension coverage baselines across the clarity bank. **Finding:** coverage was
incomplete and, crucially, derived at **tag** granularity (one value inherited by every question in a
tag).

### AQ-2 — Metadata Reconstruction
Lifted coverage to ≥99% on five of six legacy dimensions (age, persona, stage, capability, behaviour;
signal partial at 55.8%). **Finding:** coverage rose but remained **flat** — high coverage, near-zero
within-tag variation. Mean QIS ≈ 51.1.

### AQ-2R — Runtime Wiring Audit + Shared Scorer
Verified the metadata is actually wired into the runtime picker/scorer. **Finding (pivotal):** the
ceiling is a **data ceiling, not a wiring ceiling** — within-pool re-ranking moved Signal/Construct
~0 *by construction* because every question in a tag is metadata-identical. Delivered the shared
scorer + deterministic harness used as the measurement gate for all later waves.

### C-1 — QSIL (Question Signal Intelligence) Audit
Measured **repository differentiability = 0.096**. `dev_stage` alone carries ~97% of realized
differentiation; capability (286 values) and behaviour (119) are fully covered but **uniform per tag**
(0 contribution); 44.2% of questions are signal-blind (144 tags / 13,538 questions). **Conclusion:**
the problem is **architectural** (flat metadata), not a coverage gap.

### C-1A — QDA (Question Differentiation Architecture)
Designed the fix: per-question, evidence-derived metadata; **two new dimensions** — Context
(8 Primary + 5 Situational) and Archetype (8 forms); **Diversity Standards** (per-tag floors +
differentiability index min 0.30/target 0.45/excellent 0.60); **QIS V2** (8-dim, headroom-weighted);
and the **C-2 rollout blueprint**.

### C-1A Pilot — Sandbox Validation (10 worst tags / ~7,060 Qs)
Validated the architecture in a clearly-namespaced sandbox (`pilot_c1a_enrichment`, revert =
`DROP TABLE`). **Results:** coverage-weighted differentiability **0.098 → 0.240 (+145%)**
(raw-where-present +336%); contribution **Archetype 62.1% · Capability 30.7% · Behaviour 6.8% ·
Signal 0.4% · Context 0% within-tag**; routing **+39 to +87 pp** across 4 of 5 contexts. **Overturned
assumption:** signal backfill is *not* the cheapest-first move on the flagship pools (9/10 ungrounded;
per-question signal evidence survives at 1.2%).

### C-1AR — Rollout Strategy
Converted the pilot into a final, re-sequenced, coverage/grounding-gated **4-wave** rollout
(Archetype/Context shipped → Capability gated → Signal grounding-conditional → Behaviour curated) with
success metrics, governance, and a **GO with modifications** decision.

### C-2 (prior, shipped) — Context + Archetype repository-wide
Context + Archetype enrichment shipped across all ~325 tags. The pilot then measured the *deferred*
dimensions (capability/behaviour/signal) on top of that shipped baseline.

## Key Decisions

1. **Report coverage-weighted, not raw-where-present** — low coverage must never masquerade as high
   differentiation.
2. **Two-key signal rule** — assign a signal only when the tag is grounded **and** the question text
   carries evidence; otherwise UNCLASSIFIED.
3. **Re-sequence the rollout** — Archetype first (highest yield), signal demoted to grounding-
   conditional, behaviour to curated authoring.
4. **Measurement gate is non-negotiable** — every wave runs AQ-2R before/after; no unmeasured claims.
5. **Freeze low-ceiling dims** — age/persona/stage carry no differentiation headroom; don't invest.
6. **Version honestly** — v0.9 now (production-capable runtime), v1.0 gated on Waves 2–4 + the
   differentiability ≥ 0.30 gate.

## Architecture Changes

- Added **Context** and **Archetype** as first-class question dimensions (net-new architecture).
- Introduced **QIS V2** (8-dim, headroom-weighted) and the **Diversity Standards** differentiability
  index as the enforceable health metric.
- Established the **shared scorer / deterministic harness** as the universal measurement gate.

## Lessons Learned

- **High coverage ≠ high differentiation.** Flat tag-level metadata yields ~0 within-tag
  distinguishability regardless of coverage.
- **Sequencing must follow evidence, not intuition.** The "signal first, it's cheapest" plan was
  overturned by the pilot — signal is grounding-blocked; archetype is the real lever.
- **Some headroom isn't realizable from question text.** Behaviour (~10%) needs curated authoring;
  capability caps ~49% from text alone.
- **Honest partials beat fabricated completeness.** UNCLASSIFIED is a feature; orphans/gaps are
  findings, not failures.
- **Strengths are CSI-sourced, never raw signal magnitude** (signals are concern-diagnostic).

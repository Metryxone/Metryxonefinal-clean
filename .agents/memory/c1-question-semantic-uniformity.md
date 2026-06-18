---
name: C-1 question semantic uniformity (QSIL audit)
description: Repository-wide measure of how flat per-question CAPADEX metadata is, and which dimensions actually exist / differentiate.
---

# C-1 QSIL — what the question-metadata layer actually looks like

The C-1 audit measured `capadex_question_metadata` (30,638 rows, 100% join to clarity Qs) for within-bridge-tag uniformity using a Herfindahl index (HHI = Σ pᵢ² over value shares; 1.0 = every question in the tag carries the identical value).

**The durable structural facts (measured, not derivable without re-running the join):**
- The metadata layer is **fully populated but flat**: repository-weighted differentiability ≈ **0.096** (uniformity ≈ 0.904). **All 325 bridge tags are ≥0.80 uniformity** — none below.
- **`dev_stage` is the ONLY dimension that differentiates questions within a tag** (HHI ~0.44; 153/325 tags vary by stage). This is the same dimension AQ-2R found was the only mover.
- **`primary_capability` is single-valued in 100% of tags** (286 distinct values globally, but exactly one per tag) — biggest unused differentiation lever. `age_band` single in 324/325, `primary_behavior` single in 324/325.
- **`signal_family` is absent in 144 tags (13,538 Qs / 44%)** — signal is the worst *coverage* hole, not just uniform.
- **Context and Archetype do NOT exist as question-level columns.** The brief's 10 dimensions include Context (13 vals) + Archetype (8 vals), but the table has no such columns → report 0% populated, never fabricate. (Archetype exists only at *concern* level via `archetype_concern_map`.)
- Low-cardinality dims cap headroom: age_band=4, persona_primary=5, dev_stage=5 globally. Don't over-invest enrichment there; real headroom is capability(286)/behavior(119)/signal(87).
- Allowed-value gaps: persona `Entrepreneur`=0 rows, signal_strength `weak`=0 rows, dev_stage `Curiosity`=1.9%. Vocabulary mixes snake_case and Title Case (normalization debt).

**C-1A (QDA design) sharpening — the architecture lesson:** the defect is a DIFFERENTIATION ARCHITECTURE gap, not missing metadata. Differentiation contribution is single-dimensional: `dev_stage` = 97.4% of all realized differentiation, persona = 2.6%, everything else 0%. Three DISTINCT failure modes need three DIFFERENT fixes — (1) uniformity failure (capability/behavior: full coverage, 1 value/tag, huge headroom → per-question enrichment), (2) coverage failure (signal 44% null → backfill FIRST, can't rank a null column), (3) ceiling failure (age=4/persona=5/stage=5 → low headroom, FREEZE effort). C-2 sequence: signal backfill → stand up Context+Archetype (new columns) → capability/behavior per-question → measure before/after. Tag pools are small (median 40), so diversity standards must be pool-scaled. Deliverables: `backend/audit/c-1a/`.

**Why this matters / how to apply:**
- This is the repository-wide generalization of `aq2r-runtime-metadata-activation.md`: a within-pool re-rank on this metadata moves Signal/Construct ~0 *by construction*, because every dim except stage is uniform inside a tag.
- Any C-2 ("enrich per question") must derive values from evidence (never blind-inherit from the tag), prioritize capability/behavior/signal + stand up context/archetype, and **measure** before/after with the AQ-2R shared scorer — accept honest results, never tune to a target.
- Enrichment unit is **per-question-within-tag**, ranked by `pool_size × uniformity` (top generic-risk tags: EMPLOYABILITY, EMOTIONAL_REGULATION, CAREER_READINESS, COMPETENCY_DEVELOPMENT…). The brief's "Top 500 bridge tags" is impossible — only 325 exist.
- Deliverables: `backend/audit/c-1/` (`C1_QSIL_AUDIT.md` + `c1_qsil_audit.json`).

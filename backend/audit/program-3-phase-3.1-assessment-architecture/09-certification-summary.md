# CAPADEX 3.0 · Program 3 · Phase 3.1 — Certification Summary — Five Axes (never composited)

> Deliverable 09 · Generated 2026-07-01T07:15:13.791Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6a98bbfa5f18, written 2026-07-01T07:15:13.862Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The FIVE axes are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.

## Axis roll-up
| # | Axis | Result |
|---|---|---|
| 1 | Architecture (13 layers) | 13 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING |
| 2 | Lifecycle (10 states) | 3 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING |
| 3 | Governance (7 controls) | 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING |
| 4 | Metadata (18 fields) | 16/18 covered · 6 sources |
| 5 | Repository-alignment | svc 37/38 · rt 14/14 · fe 5/8 · tbl 38/38 |

- **Taxonomy**: 10 canonical types · 22-entry crosswalk.
- **Gaps**: 0 OPEN · 9 RESOLVED (all nine AP-1..AP-9 engineering-closed via reuse). Adoption reported separately, never a gap.

## Architecture decisions (freeze invariants)
- **13-layer decomposition is canonical + frozen** — The architecture is not re-designed; enhancements are additive over these 13 layers.
- **ONE registry + ONE traceability model for BOTH families** — CAPADEX behavioural + CAF competency are overlapping-by-design (different measurement science), unified, never merged.
- **Norms ⟂ Weighting ⟂ Benchmarks kept distinct** — A norm exists only when a real k-sufficient distribution is computed; weighting/benchmark are never reported as norms.
- **Coverage ⟂ Confidence ⟂ Adoption never composited** — Structural coverage, output trustworthiness and usage volume are separate axes; adoption is never a gap.
- **Additive, flag-gated, byte-identical-OFF (incl. schema)** — OFF is byte-identical INCLUDING schema — the certification GETs are read-only, and all enhancement DDL (assessment_group_norms, capadex_clarity_bloom, the bench_cohorts country-type widening) runs ONLY on the flag-gated write paths, so OFF creates 0 tables.
- **Engineering closure ⟂ Adoption** — Every gap is closed by REUSE to ENGINEERING closure (capability built + honest abstention). Real norm/offline/audit/prompt DATA volume is an ADOPTION axis reported separately, never composited into closure and never fabricated.

## Known overlaps (decisions, never silent merges)
- **Concern-diagnostic ⟂ Behaviour-signal** → `KEEP_SEPARATE` — Distinct subjects (overlap in input only); boundary documented in blueprint 04 dictionary.
- **LBI (lbi_*) ⟂ Competency (onto_*)** → `KEEP_SEPARATE` — Two products by design; merging would break the LBI student product.
- **competency-runtime.ts ⟂ competency-runtime-v2.ts** → `CONSOLIDATION_CANDIDATE` — Migration-in-progress; consolidation is breaking-risk → recommend + human approval, do NOT silently merge.
- **FreeAssessmentModal ⟂ AdaptiveAssessmentRuntime** → `KEEP_SEPARATE` — Flagship consumer flow vs flag-gated standalone adaptive runtime (different entry points).
- **spe-scoring-engine ⟂ caf/scoring-engine** → `CONSOLIDATION_CANDIDATE` — Similar weighted scoring in different dirs; review for shared util — breaking-risk, recommend only.
- **lbi_questions_legacy** → `CONSOLIDATION_CANDIDATE` — Deprecated in favour of sdi_items / psychometric_question_bank; retire (archive) on approval, never delete blindly.
- **benchmark-engine ⟂ m5-org-benchmark ⟂ mei-benchmark-engine ⟂ peer-benchmark** → `KEEP_SEPARATE` — Cohort vs org vs employability vs peer benchmarks — different subjects; kept distinct (doc 18 OVL-2).

## Verdict
**STRUCTURAL_COMPLETE_ADOPTION_PENDING.** ONE canonical Assessment Architecture: a FROZEN 13-layer decomposition hosting TWO assessment families (CAPADEX behavioural-signal + CAF competency) under one registry, a 10-type taxonomy with every legacy/spec name folded or honestly marked absent, ONE 10-state assessment lifecycle mapped onto the existing per-artifact states, a governance/control-plane model, an 18-field metadata standard with a per-source coverage crosswalk, and a 15-step Question→Outcome mapping model — each evidence claim verified against the live repository. The FIVE certification axes (architecture · lifecycle · governance · metadata · repository_alignment) are reported SEPARATELY and NEVER composited. All 13/13 layers are SUPPORTED (0 PARTIAL): Norms + Standardization were flipped to SUPPORTED by ENGINEERING-CLOSING the norm-group, standardization, Bloom, country-cohort, offline, accessibility and prompt-governance mechanisms via REUSE-before-build (own additive tables + pure transform modules), and prompt_governance is now SUPPORTED. All nine former additive gaps (AP-1..AP-9) are ENGINEERING-CLOSED (ARCHITECTURE_GAPS = [] → 0 open; RESOLVED_ARCHITECTURE_GAPS = 9), each gated by assessmentArchitectureCompletion so OFF is byte-identical incl. schema (all DDL runs only on the flag-gated write paths). What remains is ADOPTION — real norm/offline/audit/prompt DATA volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; null≠0; no norm/benchmark data fabricated; the architecture is FROZEN and enhanced-only.

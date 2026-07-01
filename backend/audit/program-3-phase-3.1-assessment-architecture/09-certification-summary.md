# CAPADEX 3.0 · Program 3 · Phase 3.1 — Certification Summary — Five Axes (never composited)

> Deliverable 09 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The FIVE axes are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.

## Axis roll-up
| # | Axis | Result |
|---|---|---|
| 1 | Architecture (13 layers) | 11 SUPPORTED · 2 PARTIAL · 0 DEAD_END · 0 MISSING |
| 2 | Lifecycle (10 states) | 3 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING |
| 3 | Governance (7 controls) | 6 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING |
| 4 | Metadata (18 fields) | 16/18 covered · 6 sources |
| 5 | Repository-alignment | svc 31/32 · rt 9/9 · fe 3/6 · tbl 33/33 |

- **Taxonomy**: 10 canonical types · 22-entry crosswalk.
- **Gaps**: 9 additive (0 Launch-Critical · 0 High · 5 Medium · 3 Low · 1 Future).

## Architecture decisions (freeze invariants)
- **13-layer decomposition is canonical + frozen** — The architecture is not re-designed; enhancements are additive over these 13 layers.
- **ONE registry + ONE traceability model for BOTH families** — CAPADEX behavioural + CAF competency are overlapping-by-design (different measurement science), unified, never merged.
- **Norms ⟂ Weighting ⟂ Benchmarks kept distinct** — A norm exists only when a real k-sufficient distribution is computed; weighting/benchmark are never reported as norms.
- **Coverage ⟂ Confidence ⟂ Adoption never composited** — Structural coverage, output trustworthiness and usage volume are separate axes; adoption is never a gap.
- **Additive, flag-gated, byte-identical-OFF (incl. schema)** — This certification is READ-ONLY; the flag gates only the certification routes, zero DDL.

## Known overlaps (decisions, never silent merges)
- **Concern-diagnostic ⟂ Behaviour-signal** → `KEEP_SEPARATE` — Distinct subjects (overlap in input only); boundary documented in blueprint 04 dictionary.
- **LBI (lbi_*) ⟂ Competency (onto_*)** → `KEEP_SEPARATE` — Two products by design; merging would break the LBI student product.
- **competency-runtime.ts ⟂ competency-runtime-v2.ts** → `CONSOLIDATION_CANDIDATE` — Migration-in-progress; consolidation is breaking-risk → recommend + human approval, do NOT silently merge.
- **FreeAssessmentModal ⟂ AdaptiveAssessmentRuntime** → `KEEP_SEPARATE` — Flagship consumer flow vs flag-gated standalone adaptive runtime (different entry points).
- **spe-scoring-engine ⟂ caf/scoring-engine** → `CONSOLIDATION_CANDIDATE` — Similar weighted scoring in different dirs; review for shared util — breaking-risk, recommend only.
- **lbi_questions_legacy** → `CONSOLIDATION_CANDIDATE` — Deprecated in favour of sdi_items / psychometric_question_bank; retire (archive) on approval, never delete blindly.
- **benchmark-engine ⟂ m5-org-benchmark ⟂ mei-benchmark-engine ⟂ peer-benchmark** → `KEEP_SEPARATE` — Cohort vs org vs employability vs peer benchmarks — different subjects; kept distinct (doc 18 OVL-2).

## Verdict
**ARCHITECTURE_COMPLETE_ADDITIVE_GAPS_PENDING.** ONE canonical Assessment Architecture: a FROZEN 13-layer decomposition hosting TWO assessment families (CAPADEX behavioural-signal + CAF competency) under one registry, a 10-type taxonomy with every legacy/spec name folded or honestly marked absent, ONE 10-state assessment lifecycle mapped onto the existing per-artifact states, a governance/control-plane model, an 18-field metadata standard with a per-source coverage crosswalk, and a 15-step Question→Outcome mapping model — each evidence claim verified against the live repository. The FIVE certification axes (architecture · lifecycle · governance · metadata · repository_alignment) are reported SEPARATELY and NEVER composited. 11/13 layers are SUPPORTED; 2/13 (Norms, Standardization) are PARTIAL — a norm/standardization DATA-coverage depth-limit, not an architecture gap. Remaining work is 9 ADDITIVE enhancement gaps (0 Launch-Critical · 0 High · 5 Medium · 3 Low · 1 Future), all additive over the frozen architecture and NONE blocking. The prior out-of-scope remediation code was removed, so these are certified as HONEST OPEN additive work, not closed. Coverage⟂Confidence⟂Adoption never composited; null≠0; no norm/benchmark data fabricated; the architecture is FROZEN and enhanced-only.

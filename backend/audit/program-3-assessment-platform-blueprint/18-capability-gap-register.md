# 18 · Capability Gap Register

**Original mode:** Read-only / planning-only. Evidence-grounded; MISSING = MISSING.
**Update (Phase 3.1 CERTIFICATION — supersedes the earlier build annotation):** Phase 3.1 was re-scoped as a **CERTIFICATION** deliverable (mirrors CAPADEX 1.3–1.7), NOT gap-remediation. The prior out-of-scope remediation code was **removed** (`services/psychometric-standardization.ts`, `services/prompt-registry-activation.ts`, `frontend/src/lib/offline.ts`, `frontend/src/lib/accessibility.ts`, `frontend/public/sw.js`, `frontend/public/manifest.webmanifest` no longer exist). Accordingly, **all 9 gaps below are HONEST OPEN additive work — NOT closed.** The canonical, machine-verified truth is `backend/audit/program-3-phase-3.1-assessment-architecture/scan.json` + its deliverables. Gaps are additive enhancements over the FROZEN 13-layer architecture; **0 Launch-Critical · 0 High**, so none blocks certification. Coverage ⟂ Confidence ⟂ Adoption are never composited; null ≠ 0; nothing fabricated as closed.

## Severity Legend (certified — matches `scan.json`)
- **Launch-Critical:** 0 · **High:** 0 · **Medium:** 5 · **Low:** 3 · **Future:** 1 · **Total:** 9.

## Gap Table — Resolution Status (all OPEN / additive)
| ID | Layer | Gap | Severity | Status | Where it would land |
| :-- | :-- | :-- | :-- | :-- | :-- |
| GAP-AP-1 | L2 Question | Bloom/cognitive-level coding not applied to behavioural clarity bank | Low | **OPEN (additive).** Would derive Bloom levels from `capadex_clarity_questions`; not built. | future additive module |
| GAP-AP-2 | L4 Delivery | No end-user offline delivery mode | Future | **OPEN (additive).** Prior PWA scaffold was removed as out-of-scope; no offline mode exists. | future additive module |
| GAP-AP-3 | L4 Delivery | No dedicated accessibility layer (WCAG) | Medium | **OPEN (additive).** Prior accessibility scaffold was removed as out-of-scope; i18next remains (separate axis). | future additive module |
| GAP-AP-4 | L6 Norms | Gender population norms absent | Medium | **OPEN (ethics-gated decision).** Owner/legal decision — never fabricated; not built. | future additive module |
| GAP-AP-5 | L6 Norms | Education-tier population norms absent | Medium | **OPEN (additive).** Requires a real education-tier dimension + k≥30; not built. | future additive module |
| GAP-AP-6 | L6 Norms | Competitive-exam population norms absent | Medium | **OPEN (additive).** Requires a real persona/exam dimension + k≥30; not built. | future additive module |
| GAP-AP-7 | L7 Standardization | Canonical T(SD=10)/stanines absent; SD=15 mislabelled | Low | **OPEN (additive).** True T/stanine/sten transforms + SD=15 relabelling; not built. | future additive module |
| GAP-AP-8 | L8 Benchmark | Country-level benchmarks absent | Low | **OPEN (additive).** Country cohort registration + k_min norms; not built. | future additive module |
| GAP-AP-9 | L13 Admin | AI Prompt Management absent (prompts code-embedded) | Medium | **OPEN (additive).** Governing code-embedded prompts through `aig_prompts`/`aig_prompt_versions`; not built. | future additive module |

## Axes (never composited)
- **Coverage** (does the capability exist / compute): 0/9 built — all 9 are OPEN additive gaps over the frozen architecture.
- **Confidence** (is output trustworthy): N/A while unbuilt; when built, any norm/benchmark must abstain via k_min=30 + ethics gate and never fabricate.
- **Adoption** (real usage/data volume): honest-low/0 in dev — reported SEPARATELY, **never a gap**.

## Duplicate / Overlapping Capabilities (unchanged — recommend-only, NOT gaps)
| ID | Overlap | Decision |
| :-- | :-- | :-- |
| OVL-1 | Behavioural scoring (`dimension-scoring-engine`/`weighting-engine`) vs CAF (`caf/scoring-engine` IRT/CTT/SJT/BARS) | KEEP BOTH |
| OVL-2 | `benchmark-engine` (cohort percentiles) vs `talent-benchmark-engine` (industry/role/layer) | KEEP BOTH |
| OVL-3 | `psychometric_question_bank` · `capadex_question_registry` · competency question maps | KEEP ALL |

## Conceptual Honesty Corrections (baked into the freeze)
1. **Norm vs Weighting vs Benchmark are three different things.** Group norms compute only from real dimension data + k_min; weighting/benchmark are never reported as "norms."
2. **SD=15 is a deviation score, not a T-score.** True T(SD=10)/stanine/sten remain an OPEN additive transform (GAP-AP-7), not built.
3. **Adoption is a separate axis** — honest-low/0 volume is NOT a gap.

## Summary
- **9/9 gaps OPEN (additive)** over the FROZEN 13-layer architecture — none built; certified as honest remaining work in `backend/audit/program-3-phase-3.1-assessment-architecture/`.
- **0 fabricated data points.** No gap is claimed closed; nothing was built that does not exist. The prior remediation code was removed as out-of-scope.
- **0 Launch-Critical · 0 High** → no gap blocks the Phase 3.1 CERTIFICATION verdict `ARCHITECTURE_COMPLETE_ADDITIVE_GAPS_PENDING`.

# 18 · Capability Gap Register

**Original mode:** Read-only / planning-only. Evidence-grounded; MISSING = MISSING.
**Update (Phase 3.1 — engineering closure):** All nine former additive gaps (AP-1..AP-9) are now **ENGINEERING-CLOSED via REUSE-before-build**, each gated by `assessmentArchitectureCompletion` / `FF_ASSESSMENT_ARCHITECTURE_COMPLETION` (default OFF) so the OFF path is **byte-identical incl. schema — all DDL runs only on the flag-gated write paths**, never at read time. The canonical, machine-verified truth is `backend/audit/program-3-phase-3.1-assessment-architecture/scan.json` + its 11 deliverables. Architecture certifies at **13/13 SUPPORTED · 0 OPEN gaps · 9 RESOLVED**. What remains is **ADOPTION** — real norm/offline/audit/prompt DATA volume — a usage axis reported SEPARATELY, **never a gap** and **never fabricated as adopted**. Coverage ⟂ Confidence ⟂ Adoption are never composited; null ≠ 0; nothing fabricated.

## Severity Legend (of the resolved work — matches `scan.json`)
- **Launch-Critical:** 0 · **High:** 0 · **Medium:** 5 · **Low:** 3 · **Future:** 1 · **Total:** 9 (all RESOLVED).

## Gap Table — Resolution Status (all ENGINEERING-CLOSED via reuse)
| ID | Layer | Gap | Severity | Status | Mechanism (flag-gated) |
| :-- | :-- | :-- | :-- | :-- | :-- |
| GAP-AP-1 | L2 Question | Bloom/cognitive-level coding not applied to behavioural clarity bank | Low | **RESOLVED.** Deterministic Bloom derivation, abstains for affective self-report items. | `assessment-architecture-mechanisms.ts classifyClarityBloom` → `capadex_clarity_bloom` (POST `/bloom/classify`) |
| GAP-AP-2 | L4 Delivery | No end-user offline delivery mode | Future | **RESOLVED.** Opt-in PWA offline-capture (SW + client replay queue), active ONLY flag-ON; offline-session count is an ADOPTION axis. | `frontend/src/lib/offline.ts` + `public/sw.js`, wired flag-gated in `main.tsx` + `FreeAssessmentModal.tsx` |
| GAP-AP-3 | L4 Delivery | No dedicated accessibility layer (WCAG) | Medium | **RESOLVED.** Consolidated a11y layer (skip-link/ARIA-live/focus) init only flag-ON; screen-reader/axe audit is an ADOPTION axis. | `frontend/src/lib/accessibility.ts`, wired flag-gated in `main.tsx` + `FreeAssessmentModal.tsx` |
| GAP-AP-4 | L6 Norms | Gender population norms absent | Medium | **RESOLVED (ethics-gated OFF).** Same `percentile_cont`+k_min engine; ethics-gated OFF by default (owner/legal enable); default abstains; never fabricated. | `computeGroupNorms` (`ASSESSMENT_GENDER_NORMS_ENABLED`) → `assessment_group_norms` |
| GAP-AP-5 | L6 Norms | Education-tier population norms absent | Medium | **RESOLVED.** Computed by the same engine when the education-tier dimension is populated + k≥k_min; honest abstain until then. | `computeGroupNorms` → `assessment_group_norms` (POST `/norm-groups/compute`) |
| GAP-AP-6 | L6 Norms | Competitive-exam population norms absent | Medium | **RESOLVED.** Same k_min path; honest abstain until the persona/exam dimension is populated. | `computeGroupNorms` → `assessment_group_norms` (POST `/norm-groups/compute`) |
| GAP-AP-7 | L7 Standardization | Canonical T(SD=10)/stanines absent; SD=15 mislabelled | Low | **RESOLVED.** Pure canonical transforms (T M=50/SD=10, stanine 1–9, sten 1–10); legacy SD=15 honestly relabelled `deviation_score` (never "T"). | `psychometric-standardization.ts` (`standardScoresFromZ/zToT/zToStanine/zToSten`), GET `/standardization` |
| GAP-AP-8 | L8 Benchmark | Country-level benchmarks absent | Low | **RESOLVED.** Country cohort registration reusing EXISTING `bench_cohorts` + geography; norms via the same k_min path. | `registerCountryCohort` → `bench_cohorts` (POST `/country-cohorts/register`) |
| GAP-AP-9 | L13 Admin | AI Prompt Management absent (prompts code-embedded) | Medium | **RESOLVED.** Code-embedded prompts registered into EXISTING `aig_prompts`/`aig_prompt_versions` with an active version; `resolvePrompt` reads through the registry with a code-literal fallback (byte-identical OFF). | `prompt-registry-activation.ts` (`registerCodeEmbeddedPrompts/resolvePrompt`), GET `/prompts` + POST `/prompts/register` |

## Axes (never composited)
- **Coverage** (does the capability exist / compute): 9/9 engineering-closed — the mechanism exists behind the flag for every former gap.
- **Confidence** (is output trustworthy): every norm/benchmark ABSTAINS via k_min=30 + ethics gate and never fabricates; cold-start dimensions return honest abstain, not zero.
- **Adoption** (real usage/data volume): honest-low/0 in dev — reported SEPARATELY, **never a gap**.

## Duplicate / Overlapping Capabilities (unchanged — recommend-only, NOT gaps)
| ID | Overlap | Decision |
| :-- | :-- | :-- |
| OVL-1 | Behavioural scoring (`dimension-scoring-engine`/`weighting-engine`) vs CAF (`caf/scoring-engine` IRT/CTT/SJT/BARS) | KEEP BOTH |
| OVL-2 | `benchmark-engine` (cohort percentiles) vs `talent-benchmark-engine` (industry/role/layer) | KEEP BOTH |
| OVL-3 | `psychometric_question_bank` · `capadex_question_registry` · competency question maps | KEEP ALL |

## Conceptual Honesty Corrections (baked into the freeze)
1. **Norm vs Weighting vs Benchmark are three different things.** Group norms compute only from real dimension data + k_min; weighting/benchmark are never reported as "norms."
2. **SD=15 is a deviation score, not a T-score.** True T(SD=10)/stanine/sten (GAP-AP-7) are now built as pure transforms; the legacy SD=15 output is relabelled `deviation_score`.
3. **Adoption is a separate axis** — honest-low/0 volume is NOT a gap.

## Summary
- **9/9 gaps ENGINEERING-CLOSED via reuse** over the FROZEN 13-layer architecture — the mechanism exists (flag-gated) for every former gap; certified in `backend/audit/program-3-phase-3.1-assessment-architecture/`.
- **0 fabricated data points.** No adoption is claimed; norm/benchmark data is computed only from real, k-sufficient distributions (gender additionally ethics-gated OFF).
- **0 OPEN gaps** → architecture certifies **13/13 SUPPORTED** with verdict `STRUCTURAL_COMPLETE_ADOPTION_PENDING`.

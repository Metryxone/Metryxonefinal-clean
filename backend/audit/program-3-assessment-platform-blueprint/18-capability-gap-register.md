# 18 · Capability Gap Register

**Original mode:** Read-only / planning-only. Evidence-grounded; MISSING = MISSING.
**Update (Phase 3.1 build):** All 9 gaps ENGINEERING-CLOSED behind the additive, default-OFF flag `assessmentArchitectureCompletion` (`FF_ASSESSMENT_ARCHITECTURE_COMPLETION`). OFF is byte-identical incl. schema (own additive tables + flag-gated write paths only). "Closed" = **built, computes from REAL substrate, and abstains via k_min when data is insufficient** — NEVER fabricated norm/benchmark data. Coverage ⟂ Confidence ⟂ Adoption are never composited; null ≠ 0.

## Severity Legend (original planning snapshot)
- **Launch-Critical:** 0 · **High:** 0 · **Medium:** 5 · **Low:** 3 · **Future:** 1.

## Gap Table — Resolution Status
| ID | Layer | Gap | Severity | Resolution | Where |
| :-- | :-- | :-- | :-- | :-- | :-- |
| GAP-AP-1 | L2 Question | Bloom/cognitive-level coding not applied to behavioural clarity bank | Low | **CLOSED (engineering).** `classifyClarityBank`/`classifyBloom`/`bloomCoverage` derive Bloom levels from `capadex_clarity_questions` into own table `capadex_clarity_bloom`. Dev bank empty → honest `total:0` (adoption axis, not a gap). | `services/assessment-architecture-engine.ts` |
| GAP-AP-2 | L4 Delivery | No end-user offline delivery mode | Future | **FOUNDATION shipped.** Opt-in PWA: `public/sw.js` (app-shell cache-first, network-first `/api`) + `manifest.webmanifest` + `lib/offline.ts` (localStorage response queue, idempotent flush on reconnect). Registered ONLY when flag ON. **Browser online/offline verification = ADOPTION axis (`offline_sessions`), not claimed here.** | `frontend/public/sw.js`, `frontend/src/lib/offline.ts` |
| GAP-AP-3 | L4 Delivery | No dedicated accessibility layer (WCAG) | Medium | **FOUNDATION shipped.** `lib/accessibility.ts`: skip-link, polite ARIA live region + `announce()`, global `:focus-visible`, `.sr-only`, reduced-motion, modal focus-trap. Inits only when flag ON. i18next already mature (separate axis). **Screen-reader/axe audit = ADOPTION axis (`audited_screens`), not claimed here.** | `frontend/src/lib/accessibility.ts` |
| GAP-AP-4 | L6 Norms | Gender population norms absent | Medium | **CLOSED (ethics-gated).** `computeGroupNorms('gender', …)` computes REAL norms only when `ASSESSMENT_GENDER_NORMS_ENABLED=1`; default abstains `ethics_gated_off`. Owner/legal decision preserved — never fabricated. | `services/assessment-architecture-engine.ts` |
| GAP-AP-5 | L6 Norms | Education-tier population norms absent | Medium | **CLOSED (engineering).** `computeGroupNorms('education_tier', …)` writes `assessment_group_norms` when the dimension column exists + k≥30; substrate absent in dev → honest abstain `dimension_source_absent`. | `services/assessment-architecture-engine.ts` |
| GAP-AP-6 | L6 Norms | Competitive-exam population norms absent | Medium | **CLOSED (engineering).** `computeGroupNorms('competitive_exam', …)`; same k_min=30 + honest `dimension_source_absent` abstain until persona/exam dimension is populated. | `services/assessment-architecture-engine.ts` |
| GAP-AP-7 | L7 Standardization | Canonical T(SD=10)/stanines absent; SD=15 mislabelled | Low | **CLOSED.** Pure module adds true **T-score (M=50,SD=10)**, **stanine (1–9)**, **sten (1–10)**, z, percentile transforms; deviation SD=15 relabelled (no longer "T"). | `services/psychometric-standardization.ts` |
| GAP-AP-8 | L8 Benchmark | Country-level benchmarks absent | Low | **CLOSED.** `bench_cohorts` `cohort_type` CHECK widened to add `'country'` (flag-gated write only); `registerCountryCohorts`/`listCountryCohorts` register country cohorts (scaffold rows); norms compute via the same k_min path. | `services/assessment-architecture-engine.ts` |
| GAP-AP-9 | L13 Admin | AI Prompt Management absent (prompts code-embedded) | Medium | **CLOSED.** `CODE_EMBEDDED_PROMPTS` registry (3 slugs) + `registerCodeEmbeddedPrompts` govern prompts through existing `aig_prompts`/`aig_prompt_versions`; `resolvePrompt` reads through registry with literal fallback. | `services/prompt-registry-activation.ts` |

## Axes (never composited)
- **Coverage** (does the capability exist / compute): 9/9 engineering-closed or foundation-shipped.
- **Confidence** (is output trustworthy): governed by k_min=30 + ethics gate; abstains honestly (`ethics_gated_off`, `dimension_source_absent`, cold-start `total:0`).
- **Adoption** (real usage/data volume + browser/audit verification): honest-low/0 in dev — reported SEPARATELY, **never a gap**. AP-2 (`offline_sessions`) and AP-3 (`audited_screens`) require real-browser verification not available in this environment.

## Duplicate / Overlapping Capabilities (unchanged — recommend-only, NOT gaps)
| ID | Overlap | Decision |
| :-- | :-- | :-- |
| OVL-1 | Behavioural scoring (`dimension-scoring-engine`/`weighting-engine`) vs CAF (`caf/scoring-engine` IRT/CTT/SJT/BARS) | KEEP BOTH |
| OVL-2 | `benchmark-engine` (cohort percentiles) vs `talent-benchmark-engine` (industry/role/layer) | KEEP BOTH |
| OVL-3 | `psychometric_question_bank` · `capadex_question_registry` · competency question maps | KEEP ALL |

## Conceptual Honesty Corrections (baked into the freeze)
1. **Norm vs Weighting vs Benchmark are three different things.** Group norms compute only from real dimension data + k_min; weighting/benchmark are never reported as "norms."
2. **SD=15 is a deviation score, not a T-score.** True T(SD=10)/stanine/sten added as additive transforms.
3. **Adoption is a separate axis** — honest-low/0 volume (and pending browser/axe verification) is NOT a gap.

## Summary
- **9/9 gaps engineering-closed or foundation-shipped**, all behind `assessmentArchitectureCompletion`, byte-identical OFF incl. schema.
- **0 fabricated data points.** Every norm/benchmark/Bloom output computes from real substrate or abstains with an explicit honest reason.
- **Remaining is ADOPTION, not engineering:** real assessment volume + browser/screen-reader verification for AP-2/AP-3 — reported on their own axes, never as gaps.

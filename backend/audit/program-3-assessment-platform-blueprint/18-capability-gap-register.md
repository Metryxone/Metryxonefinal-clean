# 18 · Capability Gap Register

**Mode:** Read-only / planning-only. No changes. Evidence-grounded; MISSING = MISSING.

## Severity Legend
- **Launch-Critical** — blocks the core assessment→outcome spine. **Count: 0.**
- **High** — materially limits a shipped capability. **Count: 0.**
- **Medium** — meaningful capability/quality gap; schedule in Program 3. **Count: 5.**
- **Low** — narrow/labelling/breadth gap; additive. **Count: 3.**
- **Future** — out-of-scope-for-now capability. **Count: 1.**

## Gap Table
| ID | Layer | Gap | Evidence Basis | Severity | Type |
| :-- | :-- | :-- | :-- | :-- | :-- |
| GAP-AP-1 | L2 Question | Bloom/cognitive-level coding present for CAF/academic (`BLOOM_MULTIPLIERS`, `aiTestGenerator.bloomsLevel`) but **not applied to the behavioural `psychometric_question_bank`** | Verified via grep | Low | PARTIAL |
| GAP-AP-2 | L4 Delivery | No end-user **offline delivery** mode (only internal validation harnesses) | Explorer + grep | Future | MISSING |
| GAP-AP-3 | L4 Delivery | No dedicated **accessibility** layer (WCAG/screen-reader/keyboard/contrast) in core assessment components; localization ≠ a11y | Explorer | Medium | MISSING |
| GAP-AP-4 | L6 Norms | **Gender population norms** absent (may be a deliberate ethics/legal decision) | grep (no gender in norm/benchmark) | Medium | MISSING |
| GAP-AP-5 | L6 Norms | **Education-tier population norms** (student/school/college/university) absent; segments exist for benchmarking, not as norm groups | Explorer | Medium | MISSING |
| GAP-AP-6 | L6 Norms | **Competitive-exam population norms** (JEE/NEET/CUET) absent; persona *banks* exist, norm tables don't | Explorer | Medium | MISSING |
| GAP-AP-7 | L7 Standardization | Canonical **T-scores (SD=10)** and **stanines** absent; existing SD=15 "T-like" scale is a deviation score (mislabel to correct) | grep in `caf/scoring-engine.ts` | Low | PARTIAL |
| GAP-AP-8 | L8 Benchmark | **Country-level benchmarks** absent (industry/org/region present) | Explorer | Low | MISSING |
| GAP-AP-9 | L13 Admin | **AI Prompt Management** absent — no versioned/governed prompt registry (prompts code-embedded) | Explorer | Medium | MISSING |

## Duplicate / Overlapping Capabilities (intentional — recommend-only consolidation, NOT gaps)
| ID | Overlap | Assessment | Decision |
| :-- | :-- | :-- | :-- |
| OVL-1 | Two scoring stacks: CAPADEX `dimension-scoring-engine.ts`/`weighting-engine.ts` (behavioural) vs CAF `caf/scoring-engine.ts` (IRT/CTT/SJT/BARS) | Science-distinct for different question families | KEEP BOTH; unified score-provenance view = recommend-only |
| OVL-2 | Two benchmark engines: `benchmark-engine.ts` (cohort percentiles) vs `talent-benchmark-engine.ts` (industry/role/layer) | Different granularities | KEEP BOTH; unified benchmark-provenance view = recommend-only |
| OVL-3 | Three question stores: `psychometric_question_bank` · `capadex_question_registry` · `competency_question_templates`/`onto_competency_question_map` | Role-distinct (bank vs registry vs competency) | KEEP ALL; unified question-registry view = recommend-only |

> Overlaps are recommend-only consolidation candidates. Removing either scoring stack, benchmark engine, or question store would **break** a shipped assessment family — they are not duplication defects.

## Conceptual Honesty Corrections (to bake into the freeze, no code change)
1. **Norm vs Weighting vs Benchmark are three different things.** Only **age** has real population norms. Weighting policies (seniority/industry/geo) and benchmark cohorts must never be reported as "norms." (Drives GAP-AP-4/5/6 and Layer-6 PARTIAL.)
2. **SD=15 is a deviation score, not a T-score.** Relabel; add true T(SD=10)/stanine as additive transforms. (GAP-AP-7.)
3. **Outcome/KPI adoption is a separate axis** — honest-low/0 volume is NOT a gap.

## Summary
- **0 Launch-Critical · 0 High · 5 Medium · 3 Low · 1 Future.**
- No gap blocks launch. The 5 Medium gaps (accessibility + 3 norm populations + AI prompt mgmt) are the highest-value Program-3 enhancements. All gaps are additive over the frozen architecture.

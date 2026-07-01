# CAPADEX 3.0 · Program 3 · Phase 3.1 — Gap Register (0 OPEN · engineering-closed)

> Deliverable 10 · Generated 2026-07-01T07:15:13.791Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6a98bbfa5f18, written 2026-07-01T07:15:13.862Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

**0 OPEN gaps: 0 Launch-Critical · 0 High · 0 Medium · 0 Low · 0 Future.**

All nine former additive gaps (AP-1..AP-9) are **ENGINEERING-CLOSED** via REUSE-before-build, each gated by `assessmentArchitectureCompletion` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). What remains is **ADOPTION** — real norm/offline/audit/prompt DATA volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; norm/benchmark data is NEVER fabricated (compute only from real, k-sufficient distributions; gender norms owner/legal-gated).

## Open gaps
_None — all engineering gaps are closed._

## Resolved gaps (9) — engineering-closed via reuse
Severity of resolved work: 0 Launch-Critical · 0 High · 5 Medium · 3 Low · 1 Future.

### GAP-AA-1 — Bloom/cognitive-level coding for the behavioural clarity bank
- **Layer**: L2 Question
- **Severity (was)**: Low
- **Resolution**: Deterministic Bloom-level derivation of the clarity bank into an OWN additive table, abstaining for affective self-report items.
- **Mechanism**: services/assessment-architecture-mechanisms.ts classifyClarityBloom → capadex_clarity_bloom (POST /bloom/classify).
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-2 — End-user offline delivery mode
- **Layer**: L4 Delivery
- **Severity (was)**: Future
- **Resolution**: Opt-in PWA offline-capture foundation (service worker + client replay queue) active ONLY when the flag is ON; real offline-session count is an ADOPTION axis.
- **Mechanism**: frontend/src/lib/offline.ts + public/sw.js, wired flag-gated in main.tsx + FreeAssessmentModal.tsx.
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-3 — Dedicated accessibility (WCAG) layer
- **Layer**: L4 Delivery
- **Severity (was)**: Medium
- **Resolution**: Consolidated a11y layer (skip-link/ARIA-live/focus) initialised only when the flag is ON; screen-reader/axe audit is an ADOPTION axis.
- **Mechanism**: frontend/src/lib/accessibility.ts, wired flag-gated in main.tsx + FreeAssessmentModal.tsx.
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-4 — Gender population norms
- **Layer**: L6 Norms
- **Severity (was)**: Medium
- **Resolution**: Same percentile_cont+k_min engine computes REAL gender norms — ethics-gated OFF by default (owner/legal enable); default abstains; never fabricated.
- **Mechanism**: services/assessment-architecture-mechanisms.ts computeGroupNorms (ASSESSMENT_GENDER_NORMS_ENABLED) → assessment_group_norms.
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-5 — Education-tier population norms
- **Layer**: L6 Norms
- **Severity (was)**: Medium
- **Resolution**: Computed by the same engine when the education-tier dimension is populated + k≥k_min; honest abstain until then.
- **Mechanism**: services/assessment-architecture-mechanisms.ts computeGroupNorms → assessment_group_norms (POST /norm-groups/compute).
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-6 — Competitive-exam population norms
- **Layer**: L6 Norms
- **Severity (was)**: Medium
- **Resolution**: Same k_min path; honest abstain until the persona/exam dimension is populated.
- **Mechanism**: services/assessment-architecture-mechanisms.ts computeGroupNorms → assessment_group_norms (POST /norm-groups/compute).
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-7 — Canonical T(M=50,SD=10)/stanine/sten breadth; SD=15 relabelled
- **Layer**: L7 Standardization
- **Severity (was)**: Low
- **Resolution**: Pure canonical transforms added (T M=50/SD=10, stanine 1–9, sten 1–10); legacy SD=15 transform honestly relabelled deviation_score (never "T").
- **Mechanism**: services/psychometric-standardization.ts (standardScoresFromZ/zToT/zToStanine/zToSten), surfaced GET /standardization.
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-8 — Country-level benchmarks
- **Layer**: L8 Benchmark
- **Severity (was)**: Low
- **Resolution**: Country cohort registration reusing the EXISTING bench_cohorts + geography; norms compute via the same k_min path.
- **Mechanism**: services/assessment-architecture-mechanisms.ts registerCountryCohort → bench_cohorts (POST /country-cohorts/register).
- **Adoption axis (separate, never a gap)**: —

### GAP-AA-9 — AI Prompt Management (prompts governed, not code-embedded-only)
- **Layer**: L13 Admin
- **Severity (was)**: Medium
- **Resolution**: Code-embedded prompts registered into the EXISTING aig_prompts/aig_prompt_versions with an active version; resolvePrompt reads through the registry with a code-literal fallback (byte-identical OFF).
- **Mechanism**: services/prompt-registry-activation.ts (registerCodeEmbeddedPrompts/resolvePrompt), surfaced GET /prompts + POST /prompts/register.
- **Adoption axis (separate, never a gap)**: —

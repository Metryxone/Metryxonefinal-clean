# CAPADEX 3.0 · Program 3 · Phase 3.1 — Remaining Gaps (classified · additive)

> Deliverable 10 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

**9 remaining gaps: 0 Launch-Critical · 0 High · 5 Medium · 3 Low · 1 Future.**

These are ADDITIVE enhancement gaps over the FROZEN architecture. None blocks the certification (0 Launch-Critical, 0 High). The prior out-of-scope remediation code was removed, so these are certified as HONEST OPEN work — **not** fabricated as closed. Coverage⟂Confidence⟂Adoption never composited; norm/benchmark data is NEVER fabricated (compute only from real, k-sufficient distributions; gender norms owner/legal-gated).

## Launch-Critical
_None._

## High
_None._

## Medium
### GAP-AA-3 — No dedicated accessibility (WCAG) layer
- **Layer**: L4 Delivery
- **Evidence**: i18next is mature (separate axis) but there is no consolidated a11y layer (skip-link/ARIA-live/focus-trap).
- **Remediation (additive, flag-gated)**: Additive a11y layer initialised only when flag ON; screen-reader/axe audit is an ADOPTION axis.

### GAP-AA-4 — Gender population norms absent
- **Layer**: L6 Norms
- **Evidence**: Only age norms populated; no gender norm distribution.
- **Remediation (additive, flag-gated)**: Ethics-gated: compute REAL norms only under an explicit owner/legal enable; default abstains; never fabricated.

### GAP-AA-5 — Education-tier population norms absent
- **Layer**: L6 Norms
- **Evidence**: No education-tier norm distribution; dimension source not yet populated.
- **Remediation (additive, flag-gated)**: Compute via the same engine when the dimension column exists + k≥30; honest abstain until then.

### GAP-AA-6 — Competitive-exam population norms absent
- **Layer**: L6 Norms
- **Evidence**: No competitive-exam norm distribution.
- **Remediation (additive, flag-gated)**: Same k_min=30 path; honest abstain until the persona/exam dimension is populated.

### GAP-AA-9 — AI Prompt Management absent (prompts code-embedded)
- **Layer**: L13 Admin
- **Evidence**: Prompts embedded in code; aig_prompts/aig_prompt_versions substrate exists but is not the prompt source.
- **Remediation (additive, flag-gated)**: Additive: govern prompts through aig_prompts/aig_prompt_versions with literal fallback; flag-gated.

## Low
### GAP-AA-1 — Bloom/cognitive-level coding not applied to the behavioural clarity bank
- **Layer**: L2 Question
- **Evidence**: Clarity bank has no Bloom-level column; cognitive coding exists only for the CAF item bank.
- **Remediation (additive, flag-gated)**: Additive: derive Bloom levels from the clarity bank into an own table; flag-gated, byte-identical OFF.

### GAP-AA-7 — Canonical T(SD=10)/stanine/sten breadth absent; SD=15 must not be labelled "T"
- **Layer**: L7 Standardization
- **Evidence**: Percentile/z/deviation exist; canonical T/stanine/sten transforms do not.
- **Remediation (additive, flag-gated)**: Additive pure transforms (T M=50/SD=10, stanine 1–9, sten 1–10); relabel deviation SD=15.

### GAP-AA-8 — Country-level benchmarks absent
- **Layer**: L8 Benchmark
- **Evidence**: Cohort/industry/role/layer benchmarks exist; no country cohort.
- **Remediation (additive, flag-gated)**: Additive country cohort registration; norms compute via the same k_min path.

## Future
### GAP-AA-2 — No end-user offline delivery mode
- **Layer**: L4 Delivery
- **Evidence**: Delivery is online-only; no PWA/offline queue.
- **Remediation (additive, flag-gated)**: Additive opt-in PWA foundation; browser online/offline verification is an ADOPTION axis, not claimed structurally.

---
name: Honestly-orphaned concern fallback insight
description: How CAPADEX gives empty-spine (honestly-orphaned) concerns a safe low-confidence fallback without inflating the measured spine.
---

# Honestly-Orphaned Concern Fallback Insight

A small set of concerns resolve to NO seedable Tier-3 mapping → the activation spine fires nothing (no signals/composites/patterns/interventions). The decision was to give those users ONE conservative, explicitly low-confidence general-support insight — never blank, never fabricated.

## Rule
- The fallback is built **read-only at the report-insight layer** (`capadex-insight-explainer.ts` `explainSession`, surfaced via `/api/capadex/session/:id/explain` as a separate top-level `fallback` field). Pure helper `concern-fallback-insight.ts`.
- It is emitted **only** when the measured spine is empty (`signalCount===0 && patternCount===0 && recommendationCount===0`). Any real measured output → `fallback` is null, response byte-identical.
- It carries `is_fallback: true`, `confidence_band: 'low'`, `source: 'general_support'` + a plain-language disclaimer so it is visibly distinct from measured intelligence.

**Why:** a fallback must NOT be a seed signal. Seeding feeds Signal→Composite→Pattern→Intervention, so a fabricated seed would dishonestly inflate composites/patterns — exactly what the seeding guardrails and quality-over-coverage canon forbid. Keeping the fallback OUTSIDE the spine (read-only, never persisted/seeded) makes "never inflates composites/patterns" structurally true, not just hopefully true.

**How to apply:** if extending fallback behaviour, keep it out of the seeding/activation path; gate it on the spine being genuinely empty; and keep the explicit low-confidence markers so the report can render it as not-measured. The frontend report's "no interventions" branch (on-screen + PDF) is relabelled "General Guidance — Low Confidence" to match.

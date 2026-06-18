---
name: Runtime Intelligence Experience Layer (Phase 6B)
description: surfacing the runtime intelligence pipeline to Student/Parent/Counselor stakeholders + explainability, read-only
---

# Stakeholder experience layer over the runtime pipeline

Read-only, flag-gated presentation of the SAME runtime intelligence to three
audiences via a toggle on the report (Student default / Parent / Counselor) plus
an explainability ("Why am I seeing this?") view. It is a COMPOSER over the
existing guidance bundle + pipeline lineage + strength-discovery — never a new
engine, never recomputes.

## Canon — what each stakeholder section may source from
- **Parent "Child Strengths" → ONLY discoverStrengths (StrengthProfile / CSI
  positive_factors).** Empty profile → honest note, NEVER fabricate strengths from
  signals. (Same canon as behavior-graph-consumer.md.)
- **Counselor "Priority Risks" → ONLY actionable lifecycle states.** Mirror the
  intervention engine's `ACTIONABLE_LIFECYCLES = {'active','dominant'}`. Suppressed
  / weakened / archived / missing-lifecycle rows are de-emphasised and must NOT
  surface as priority risks — even when high-severity/high-strength.
  **Why:** Phase-2 contradiction suppression de-emphasises rows on purpose;
  showing them as "priority" contradicts the runtime's own judgement. A first pass
  filtered only GENERAL_CONCERN and leaked suppressed rows.
  **How to apply:** filter signals on lifecycle BEFORE severity-ranking.

## Degradation / flag rules (same as the rest of the runtime surface)
- Backend routes gated by `isRuntimeIntelligenceActivationEnabled()` → OFF returns
  `{enabled:false}`; strict-UUID → 400 BEFORE any query; builder `.catch` →
  degraded 200, never 500.
- Frontend: stakeholder toggle renders ONLY when `runtime-summary.summaries`
  present; flag-off / fetch-fail → only the legacy Student view shows (byte-identical
  legacy report). Student view keeps its OWN richer data path (guidance bundle +
  activated emotional signals from /pipeline), NOT the engine's student summary —
  the engine's student summary is only consumed by the runtime-summary route.

## Palette discipline
Report owns the single `B` palette; pass it as a prop into every runtime panel so
the panels can never drift from the report's colours.

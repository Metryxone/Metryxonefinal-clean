# 02 · Assessment Platform Vision

**Mode:** Read-only / planning-only. No changes.

## Product Philosophy
> The CAPADEX Assessment Platform **begins with Question Intelligence** and **ends with Measurable Outcomes.**

Assessment is not a quiz engine — it is the front door to a continuous, measurable growth loop. Every question exists to produce a signal; every signal is scored, normed, standardized, benchmarked, interpreted by AI, turned into a recommendation, driven into learning and progression, reported, analyzed, and finally validated as a **realized outcome** (mastery, placement, hire, performance uplift). The loop then re-enters at re-measurement.

## The Canonical Spine (frozen)
```
Question → Assessment → Delivery → Scoring → Norms → Standardization
→ Benchmarking → AI Interpretation → Recommendations → Learning
→ Progression → Reports → Analytics → Outcomes → (re-measure)
```
This spine is already the operating model of the platform, materialized as the FROZEN registries:
- `config/assessment-framework.ts` — assessment taxonomy & lifecycle
- `config/customer-journey.ts` — 8-step journey spine + persona journeys
- `config/progression-model.ts` — 15-step continuous growth loop
- `config/outcome-kpi-model.ts` — outcome types + KPI families
- `config/ai-orchestration-model.ts` — AI interpretation spine

## Design Principles (inherited, non-negotiable)
1. **ONE of everything.** One assessment platform, one question platform, one scoring framework, one norm framework, one standardization framework, one report framework, one administration model, one traceability model. Duplicate stacks are reconciled, not multiplied.
2. **Additive & flag-gated.** New capability ships behind a feature flag; flag-off is byte-identical to prior behaviour **including schema**.
3. **Reuse-before-build.** New phases re-shape already-computed data by composing existing engines; they do not fork parallel engines.
4. **Honesty over optimism.** Coverage ⟂ Confidence ⟂ Adoption, never composited. `null ≠ 0`. Absent capability is reported absent.
5. **Measurable outcomes are the terminal axis.** The platform is judged by whether assessment drives a validated outcome, not by how many questions it serves.

## Audience & Personas (traced in `17-...traceability-matrix.md`)
The platform serves 9 canonical personas (students / competitive aspirants / job-seekers / professionals / people-managers / senior-leadership / L&D / faculty / parents-counsellors) across the lifecycle stages `CAP_CUR → CAP_INS → CAP_GRW → CAP_MAS`, each with persona-targeted question banks, journeys, reports, and outcome models.

## What "World-Class" Means Here
- Psychometrically defensible scoring (reliability, validity, reverse-item checks, confidence) — **present**.
- Norm-referenced interpretation across the populations we serve — **partially present** (age norms real; gender/education/competitive-exam norms absent — see gap register).
- Explainable AI interpretation with evidence and confidence — **present**.
- Multi-audience, multi-language reporting with visualization — **present**.
- Outcome validation closing the loop — **present** (engineering-complete; adoption volume is a separate, honest axis).

## Vision Statement (for the freeze)
CAPADEX is **one assessment platform** that turns a single behavioural/competency assessment into a lifelong, persona-aware, outcome-validated growth instrument — measurable, explainable, and honest about what it does and does not yet know.

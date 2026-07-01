# CAPADEX 3.0 · Program 3 · Phase 3.6 — Blueprint Validation Report (dimension 5 · blueprint_validation)

> Deliverable 06 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Blueprint (test specification) validation — competency/behaviour/domain/skill/objective coverage + Bloom / difficulty / time distribution — validated against a declared blueprint via the pure `validateBlueprint` mechanism + the additive `asci_blueprints` overlay. A clean pre-publish gate on the instrument design.

**Blueprint coverage controls:** 7 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Anchors |
|---|---|---|
| **Competency coverage** (`competency_coverage`) | SUPPORTED | services/assessment-blueprint-engine.ts, services/assessment-science-mechanisms.ts, asci_blueprints |
| **Behaviour coverage** (`behaviour_coverage`) | SUPPORTED | services/assessment-blueprint-engine.ts, asci_blueprints |
| **Domain coverage** (`domain_coverage`) | SUPPORTED | services/assessment-blueprint-engine.ts, asci_blueprints |
| **Skill coverage** (`skill_coverage`) | SUPPORTED | services/assessment-blueprint-engine.ts, asci_blueprints |
| **Learning-objective coverage** (`objective_coverage`) | PARTIAL | services/assessment-blueprint-engine.ts, asci_blueprints |
| **Bloom-level distribution** (`bloom_distribution`) | SUPPORTED | services/assessment-blueprint-engine.ts, asci_blueprints |
| **Difficulty distribution** (`difficulty_distribution`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_blueprints |
| **Time / weight distribution** (`time_distribution`) | SUPPORTED | services/assessment-blueprint-engine.ts, asci_blueprints |

### Blueprint Validation (`blueprint_validation`) — SUPPORTED
_ONE canonical blueprint-validation layer (asci_blueprints) validating competency/behaviour/domain/skill coverage + Bloom / difficulty / time distribution against a blueprint (composing assessment-blueprint-engine.generateBlueprint). Learning-objective coverage stays PARTIAL until objectives are first-class. No duplicate blueprint engine._

- **Services**: services/assessment-blueprint-engine.ts, services/assessment-science-mechanisms.ts
- **Routes**: routes/assessment-science.ts
- **Frontend**: components/science/PsychometricsWorkbench.tsx
- **Tables**: assessment_blueprints, asci_blueprints
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 1/2


# CAPADEX 3.0 · Program 3 · Phase 3.8 — Standardization Config Scopes Report

> Deliverable 06 · Generated 2026-07-01T15:58:21.450Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:71e5cbf5bb8c, written 2026-07-01T15:58:21.449Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A standardization config (formula + band set + rule set) can be scoped — assessment / persona / lifecycle / industry / organization / country / institution / custom — and stored + applied via the additive `astd_configs` overlay.

**Standardization config scopes:** 3 SUPPORTED · 5 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Note |
|---|---|---|
| **Assessment-specific** (`assessment`) | SUPPORTED | Per-assessment standardization config (formula / band set / rule set) keyed by assessment_slug. |
| **Persona-specific** (`persona`) | SUPPORTED | Per-persona standardization config keyed by persona. |
| **Lifecycle-specific** (`lifecycle`) | SUPPORTED | Per-lifecycle-stage standardization config keyed by canonical stage. |
| **Industry-specific** (`industry`) | PARTIAL | Industry-scoped config can be stored + applied; PARTIAL until real industry configs are populated. |
| **Organization-specific** (`organization`) | PARTIAL | Organization override config can be stored + applied; PARTIAL until real org overrides are populated. |
| **Country-specific** (`country`) | PARTIAL | Country-scoped config can be stored + applied; a data-availability boundary, not an engineering gap. |
| **Institution-specific** (`institution`) | PARTIAL | Institution-scoped config can be stored + applied; PARTIAL until real institution configs are populated. |
| **Custom configuration** (`custom`) | PARTIAL | Fully custom scoped config (astd_configs.scope=custom); PARTIAL until real custom configs are populated. |

_Industry / organization / country / institution / custom scopes are PARTIAL: the mechanism can store + apply them but a real populated config per scope is a data-availability boundary, NOT an engineering gap._

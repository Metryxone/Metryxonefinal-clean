# CAPADEX 3.0 · Program 3 · Phase 3.8 — Standardization Config Scopes Report

> Deliverable 06 · Generated 2026-07-01T17:13:35.500Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:470cd868e0df, written 2026-07-01T17:13:35.497Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A standardization config (formula + band set + rule set) can be scoped — assessment / persona / lifecycle / industry / organization / country / institution / custom — and stored + applied via the additive `astd_configs` overlay.

**Standardization config scopes:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Note |
|---|---|---|
| **Assessment-specific** (`assessment`) | SUPPORTED | Per-assessment standardization config (formula / band set / rule set) keyed by assessment_slug. |
| **Persona-specific** (`persona`) | SUPPORTED | Per-persona standardization config keyed by persona. |
| **Lifecycle-specific** (`lifecycle`) | SUPPORTED | Per-lifecycle-stage standardization config keyed by canonical stage. |
| **Industry-specific** (`industry`) | SUPPORTED | Industry-scoped config is stored (saveConfig scope=industry) AND resolved/applied deterministically via resolveConfig + CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve, most-specific-wins). Real populated industry configs are an ADOPTION axis (honest 0), never a coverage gap. |
| **Organization-specific** (`organization`) | SUPPORTED | Organization override config is stored (saveConfig scope=organization) AND resolved via resolveConfig — organization has top precedence in CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated org overrides are an ADOPTION axis (honest 0), never a coverage gap. |
| **Country-specific** (`country`) | SUPPORTED | Country-scoped config is stored (saveConfig scope=country) AND resolved via resolveConfig + CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated country configs are an ADOPTION axis (honest 0), never a coverage gap. |
| **Institution-specific** (`institution`) | SUPPORTED | Institution-scoped config is stored (saveConfig scope=institution) AND resolved via resolveConfig — institution ranks just below organization in CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated institution configs are an ADOPTION axis (honest 0), never a coverage gap. |
| **Custom configuration** (`custom`) | SUPPORTED | Fully custom scoped config (astd_configs.scope=custom) is stored (saveConfig) AND resolved via resolveConfig + CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated custom configs are an ADOPTION axis (honest 0), never a coverage gap. |

_Industry / organization / country / institution / custom scopes are WIRED: stored (`saveConfig`) AND resolved most-specific-wins via `resolveConfig` + `CONFIG_SCOPE_PRECEDENCE` (POST /configs/resolve). A real populated config per scope is an ADOPTION axis (honest 0), NOT a coverage gap._

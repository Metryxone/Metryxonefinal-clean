# CAPADEX 3.0 · Program 3 · Phase 3.8 — API Report (dimension 8 · apis)

> Deliverable 11 · Generated 2026-07-01T15:58:21.450Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:71e5cbf5bb8c, written 2026-07-01T15:58:21.449Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified standardization API surface at `/api/admin/score-standardization/*` (super-admin cert GETs) + `/api/score-standardization/enabled` (flag probe) + the mechanism POST paths (compute/{standard-scores,formula/validate,formula/evaluate,band,interpretation,validation}) and the overlay write paths (formulas / standard-scores / bands / interpretation-rules / configs / validations save + list GETs + governance transition).

## Traceability model (6 scored-result→standardized-artefact links)
Each link → the artefact it carries + the EXISTING source it REUSES (reuse-before-build).

**Traceability status:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

| Link | Source (reused) | Status | Note |
|---|---|---|---|
| **Raw score** (`raw_score`) | `services/assessment-scoring-mechanisms.ts / scoring_runs` | SUPPORTED | The measurable raw score produced by the 3.5 scoring engine — the standardization input. |
| **Assessment version** (`assessment_version`) | `astd_standard_scores.assessment_slug + detail.assessment_version` | SUPPORTED | The assessment version the raw score was produced against — carried on every standard-score row. |
| **Formula version** (`formula_version`) | `astd_formulas.version + astd_standard_scores.formula_key/formula_version` | SUPPORTED | The versioned formula (AST) used to standardize — carried on every standard-score row. |
| **Norm version** (`norm_version`) | `aint_norm_tables (3.7) + astd_standard_scores.norm_key` | SUPPORTED | The norm reference (3.7 aint_norm_tables) the score was standardized against — carried on every standard-score row. |
| **Standardization version** (`standardization_version`) | `astd_configs.version + astd_standard_scores.config_key/config_version` | SUPPORTED | The versioned standardization config (scope + band set + rule set) applied — carried on every standard-score row. |
| **Interpretation rule** (`interpretation_rule`) | `astd_interpretation_rules + astd_standard_scores.rule_key` | SUPPORTED | The interpretation rule that produced the band / risk / readiness verdict — carried on every standard-score row. |

### APIs (`apis`) — SUPPORTED
_standardization / transformation / interpretation / configuration / version / validation endpoints under /api/admin/score-standardization, composing the pure psychometric substrate + the astd_* overlay. Read certifications are GET (to_regclass/fs probes); pure standardization / formula / interpretation computes are pure POSTs; overlay writes + governance transitions are flag-gated POSTs._

- **Services**: services/score-standardization-engine.ts, services/score-standardization-mechanisms.ts
- **Routes**: routes/score-standardization.ts
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 0/0

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs (`compute/*`) are **PURE** (no DB, no eval) unless `persist=true`; the overlay save routes + governance transition are the **ONLY** DDL sites, gated by `scoreStandardization` + super-admin.
- Formulas are a STRUCTURED AST evaluated by a whitelisted interpreter — no `eval` / `new Function`.
- Norm-referenced standardization ABSTAINS below k_min=30 real members — never fabricated.
- Flag OFF → `/enabled` 503, `/api/admin/score-standardization/*` 401, public-config `score_standardization:false`; standardization flow + schema byte-identical.

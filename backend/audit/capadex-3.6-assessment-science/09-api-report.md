# CAPADEX 3.0 · Program 3 · Phase 3.6 — API Report (dimension 8 · apis)

> Deliverable 09 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified science API surface at `/api/admin/assessment-science/*` (super-admin cert GETs) + `/api/assessment-science/enabled` (flag probe) + the mechanism POST paths (compute/{item-analysis,reliability,validity,item-information,item-dif} · validate/{question-quality,blueprint}) and the overlay write paths (item-stats/reliability/validity/quality/blueprint/governance save + list GETs).

## Mapping model (10 response→instrument-quality steps)
Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).

**Mapping status:** 9 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING.

| Step | Target | Source (reused) | Status | Note |
|---|---|---|---|---|
| **Authored item** (`authored_item`) | Assessment Builder (3.3) | `config/assessment-builder.ts` | SUPPORTED | Item analysis consumes the questions authored by the 3.3 builder (author→science handoff). |
| **Delivered response** (`delivered_response`) | Assessment Delivery (3.4) | `services/assessment-delivery-mechanisms.ts` | SUPPORTED | Item statistics are computed over responses captured at delivery (deliver→science handoff). |
| **Scored response** (`scored_response`) | Assessment Scoring (3.5) | `services/assessment-scoring-mechanisms.ts` | SUPPORTED | Reliability/validity consume the measurable scores produced by the 3.5 scoring engine (score→science handoff). |
| **Item statistics** (`item_statistics`) | Item Analysis (this phase) | `services/assessment-science-mechanisms.ts` | SUPPORTED | Every question maps to difficulty/discrimination/distractor/quality statistics in asci_item_stats. |
| **Reliability** (`reliability`) | Reliability (this phase) | `asci_reliability` | SUPPORTED | Every assessment maps to α/split-half/test-retest/inter-rater/SEM/CI in asci_reliability. |
| **Validity** (`validity`) | Validity (this phase) | `asci_validity` | SUPPORTED | Every assessment maps to face/content/construct/criterion/… validity evidence in asci_validity. |
| **Quality flags** (`quality_flags`) | Quality Governance (this phase) | `asci_quality_flags` | SUPPORTED | Every question maps to quality flags + governance stage in asci_quality_flags/asci_governance. |
| **Blueprint** (`blueprint`) | Blueprint Validation (this phase) | `services/assessment-blueprint-engine.ts` | SUPPORTED | Every assessment maps to a validated blueprint (coverage + distribution) in asci_blueprints. |
| **Science repository** (`science_repository`) | Science Repository (this phase) | `asci_repository` | SUPPORTED | Versioned science artefacts (stats/reliability/validity/blueprints) are catalogued in asci_repository. |
| **Norm & benchmark handoff** (`norm_handoff`) | Norms & Standardization (3.7) | `config/assessment-science.ts` | PARTIAL | Science ends at instrument quality (item stats/reliability/validity/quality/blueprint); norms, standardization, benchmarking, AI-interpretation, recommendations, report intelligence & candidate performance analytics are the Phase 3.7 scope (out of this engine). |

### Science APIs (`apis`) — SUPPORTED
_item-analysis / reliability / validity / quality / blueprint / repository endpoints under /api/admin/assessment-science, composing the existing psychometric services. Read certifications are GET (to_regclass/fs probes); overlay writes are flag-gated POSTs._

- **Services**: services/assessment-science-engine.ts, services/assessment-science-mechanisms.ts
- **Routes**: routes/assessment-science.ts
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 0/0

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs (`compute/*`, `validate/*`) are **PURE** (no DB) unless `persist=true`; the overlay save routes are the **ONLY** DDL sites, gated by `assessmentScience` + super-admin.
- Item-level statistics ABSTAIN below k_min=30 real responses — never fabricated.
- Flag OFF → `/enabled` 503, `/api/admin/assessment-science/*` 401, public-config `assessment_science:false`; science flow + schema byte-identical.

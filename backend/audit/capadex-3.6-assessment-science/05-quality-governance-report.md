# CAPADEX 3.0 · Program 3 · Phase 3.6 — Quality & Governance Report (dimension 4 · quality_governance)

> Deliverable 05 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Deterministic question-quality checks (6) + the scientific/SME review · pilot · approval · versioning · audit governance stages (7). Quality checks run no scoring — a pure authoring gate via `validateQuestionQuality`; governance is recorded in the additive `asci_quality_flags` / `asci_governance` overlay only on the flag-gated write path.

## Question-quality checks (6)
**Question-quality checks:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Note |
|---|---|---|
| **Duplicate / near-duplicate detection** (`duplicate_detection`) | SUPPORTED | Normalised-text overlap flag across the item bank (pure token heuristic). |
| **Ambiguity check** (`ambiguity_check`) | SUPPORTED | Flags vague qualifiers / double-barrelled stems (pure lexicon heuristic). |
| **Bias / sensitive-language check** (`bias_language_check`) | SUPPORTED | Flags biased or sensitive phrasing for human review (pure lexicon heuristic, advisory only). |
| **Reading difficulty** (`reading_difficulty`) | SUPPORTED | Sentence / word-length readability proxy per stem (pure heuristic). |
| **Option balance** (`option_balance`) | SUPPORTED | Flags unbalanced option length / count / "all/none of the above" for MCQ (pure heuristic). |
| **Clarity / completeness check** (`clarity_check`) | SUPPORTED | Flags missing stem / options / key / negation phrasing (pure structural heuristic). |

## Governance stages (7)
**Governance stages:** 6 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Anchors |
|---|---|---|
| **Scientific review** (`scientific_review`) | SUPPORTED | services/quality-validator.ts, services/assessment-science-mechanisms.ts, asci_governance |
| **SME review** (`sme_review`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_governance |
| **Pilot testing** (`pilot_testing`) | PARTIAL | services/assessment-science-mechanisms.ts, asci_governance |
| **Validation review** (`validation_review`) | SUPPORTED | services/quality-validator.ts, services/assessment-science-mechanisms.ts, asci_governance |
| **Approval workflow** (`approval_workflow`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_governance |
| **Version control** (`version_control`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_repository |
| **Audit trail** (`audit_trail`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_governance |

### Quality & Governance (`quality_governance`) — SUPPORTED
_ONE canonical question-quality + governance layer (asci_quality_flags / asci_governance) applying 6 pure question-quality checks (duplicate/ambiguity/bias/readability/option-balance/clarity) + scientific/SME/validation review, approval workflow, versioning & audit trail (composing quality-validator.ts). Advisory only — flags for human review, never auto-edits or auto-retires. Pilot testing stays PARTIAL until real pilot cohorts run._

- **Services**: services/quality-validator.ts, services/assessment-science-mechanisms.ts, services/assessment-science-engine.ts
- **Routes**: routes/assessment-science.ts
- **Frontend**: components/science/PsychometricsWorkbench.tsx
- **Tables**: asci_quality_flags, asci_governance
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 0/2


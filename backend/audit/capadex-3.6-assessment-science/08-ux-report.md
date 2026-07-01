# CAPADEX 3.0 · Program 3 · Phase 3.6 — UX Report (dimension 7 · ux)

> Deliverable 08 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The psychometrics workbench is interactive (item drill-down, reliability preview, quality flags, blueprint gaps) with honest ABSTAIN / empty / loading / error states — a value below k_min renders as an explicit "abstained" marker, never a fabricated number; null (unreadable) renders as "not measurable", distinct from 0 (empty).

### Science UX (`ux`) — SUPPORTED
_The psychometrics workbench is interactive: item drill-down, reliability/validity preview, quality-flag triage, blueprint coverage bars, with HONEST empty / loading / error / ABSTAIN states (item stats show "insufficient responses (< k_min)" rather than fabricating a value). null≠0 is surfaced in the UI (— for unknown, 0 for measured-empty)._

- **Services**: —
- **Routes**: —
- **Frontend**: components/science/PsychometricsWorkbench.tsx, components/superadmin/AssessmentSciencePanel.tsx
- **Tables**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 2/2 · tbl 0/0

# CAPADEX 3.0 · Program 3 · Phase 3.6 — Validity Report (dimension 3 · validity)

> Deliverable 04 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Face, content, construct, criterion, concurrent, predictive, convergent & discriminant validity — via the pure `computeValidity` mechanism + the additive `asci_validity` overlay. Each type ABSTAINS per-type below k_min=30 aligned pairs; a coefficient is NEVER fabricated.

**Validity types:** 5 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Anchors |
|---|---|---|
| **Face validity** (`face`) | PARTIAL | services/assessment-science-mechanisms.ts, asci_validity |
| **Content validity** (`content`) | SUPPORTED | services/assessment-blueprint-engine.ts, services/assessment-science-mechanisms.ts, asci_validity |
| **Construct validity** (`construct`) | SUPPORTED | services/sci-psychometric-engine.ts, services/psychometric-intelligence-engine.ts, asci_validity |
| **Criterion validity** (`criterion`) | SUPPORTED | services/sci-psychometric-engine.ts, asci_validity |
| **Concurrent validity** (`concurrent`) | PARTIAL | services/sci-psychometric-engine.ts, asci_validity |
| **Predictive validity** (`predictive`) | PARTIAL | services/assessment-science-mechanisms.ts, asci_validity |
| **Convergent validity** (`convergent`) | SUPPORTED | services/psychometric-intelligence-engine.ts, asci_validity |
| **Discriminant validity** (`discriminant`) | SUPPORTED | services/psychometric-intelligence-engine.ts, asci_validity |

### Validity (`validity`) — SUPPORTED
_ONE canonical validity layer (asci_validity) evidencing content (blueprint coverage), construct (constructValidity/factorLoading), criterion/concurrent (correlation with an external criterion) and convergent/discriminant validity via the pure computeValidity mechanism. Face & predictive validity stay PARTIAL (need human ratings / longitudinal outcomes). No duplicate validity engine._

- **Services**: services/sci-psychometric-engine.ts, services/psychometric-intelligence-engine.ts, services/assessment-blueprint-engine.ts, services/assessment-science-mechanisms.ts
- **Routes**: routes/assessment-science.ts
- **Frontend**: components/science/PsychometricsWorkbench.tsx
- **Tables**: asci_validity, asci_blueprints
- **Verified**: svc 4/4 · rt 1/1 · fe 1/1 · tbl 0/2


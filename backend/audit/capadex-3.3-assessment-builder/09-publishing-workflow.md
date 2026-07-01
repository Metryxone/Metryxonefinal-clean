# CAPADEX 3.0 · Program 3 · Phase 3.3 — Publishing / Approval Workflow (dimension 5)

> Deliverable 09 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The draft→review→approved→published→active→deprecated→archived workflow (7 states) with HUMAN approval, recorded in the additive `ab_workflow` ledger. Publishing is gated on a passed validation run + a human approval transition — no auto-publish.

**Workflow states:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Draft** (`draft`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |
| **In review** (`review`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |
| **Approved** (`approved`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |
| **Published** (`published`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |
| **Active** (`active`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |
| **Deprecated** (`deprecated`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |
| **Archived** (`archived`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_workflow |

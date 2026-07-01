# CAPADEX 3.0 · Program 3 · Phase 3.3 — Version Management (dimension 4)

> Deliverable 07 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Full version lifecycle on the additive append-only `ab_assessment_versions` ledger — major/minor/draft versions, snapshot, compare, rollback, clone. Each transition snapshots content so rollback/compare are lossless (no destructive edit).

**Version capabilities:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Major version** (`major_version`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |
| **Minor version** (`minor_version`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |
| **Draft version** (`draft_version`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |
| **Compare versions** (`compare`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |
| **Rollback version** (`rollback`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |
| **Clone version** (`clone`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |
| **Audit history** (`audit_history`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessment_versions |

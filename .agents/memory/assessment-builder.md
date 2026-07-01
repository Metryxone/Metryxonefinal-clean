---
name: Enterprise Assessment Builder (CAPADEX 3.0 3.3)
description: Authoring-only certification phase — flag assessmentBuilder; mirrors 3.2; the non-obvious scan/generator/public-config traps.
---

# Enterprise Assessment Builder (CAPADEX 3.0 · Program 3 · Phase 3.3)

The ONE canonical **AUTHORING** certification layer over the existing assessment services (CAF builder / blueprint / assembly / writer / architecture). **Scope is AUTHORING ONLY** — design/compose/configure/validate/version/approve/publish — explicitly **NOT** delivery/scoring/psychometrics; do not add or certify those here. Flag `assessmentBuilder`, default OFF, byte-identical incl. schema. Reuse-before-build; own additive `ab_*` overlay (never forks `caf_assessments`). Mirrors Phase 3.2 EXACTLY.

## Durable traps / decisions
- **public-config dual import-site**: `routes/capadex.ts` `/public-config` must IMPORT `isAssessmentBuilderEnabled` for key `assessment_builder` or it 500s. There is NO tsc here, so a missed import is only caught at runtime — always grep the import line, not just the key.
- **Cert routes live under `/api/admin/assessment-builder/*`, not `/api/assessment-builder/*`** (only `/enabled` is unprefixed). OFF smoke: `/enabled`→503 (flag-gate before auth), admin cert routes→401 (global `/api/admin` gate). Testing the wrong prefix gives a misleading 404.
- **Scan→generator ROW-SHAPE lock**: the generator reads ONLY `scan.json`. The registry row shapes differ BOTH from 3.2 and from 1.7 — pure catalogs are `{key,label,status,note}` (catTable helper) vs control lists `{key,label,status,evidence_present,evidence[]}` (ctrlTable helper); `mapping_model` rows are `{key,label,target,source,status,note}` and have NO `reuses:{}` object (unlike 1.7's spine). Diff the actual shapes before adapting a prior-phase generator or the rendered tables silently corrupt.
- **DDL only on flag+super-admin gated mechanism write paths** (`assertEnabled()` before any `CREATE TABLE`). Read/composer paths do ZERO DDL and are never-throws (`readScalar` null-on-error / 0-on-no-rows) so unreadable ≠ empty.
- **7 dimensions never composited**: `composeSummary` emits SEPARATE blocks; there is no aggregate score. Verdict `STRUCTURAL_COMPLETE_ADOPTION_PENDING`; `AB_GAPS=[]` with `RESOLVED_AB_GAPS` (AB-1..AB-7). Adoption is a SEPARATE usage axis, honest null/`—` while OFF — NEVER a gap, NEVER fabricated.

→ Full inventory in `docs/ASSESSMENT_BUILDER.md`; deliverables in `backend/audit/capadex-3.3-assessment-builder/`.

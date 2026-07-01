# Enterprise Assessment Builder (CAPADEX 3.0 · Program 3 · Phase 3.3)

The **ONE canonical Enterprise Assessment Builder** — a single certified **AUTHORING** layer that COMPOSES the existing assessment services (CAF builder, blueprint engines, assembly, writer, architecture) under one registry plus an additive `ab_*` overlay. **No duplicate builder, no V2, no breaking change.**

- **Scope: AUTHORING ONLY** — design / compose / configure / validate / version / approve / publish. It does **NOT** deliver, score, or run psychometrics (those live in other phases/engines).
- **Flag**: `assessmentBuilder` / `FF_ASSESSMENT_BUILDER` (default **OFF**, byte-identical incl. schema). All DDL runs **only on the flag-gated write paths** (mechanism POSTs), never at read time.
- **Mirrors Phase 3.2** (Question Management Platform) EXACTLY: pure-data registry ⟂ read-only composer ⟂ mechanism helpers ⟂ flag-gated routes ⟂ super-admin panel ⟂ SSoT scan + generator → 13 deliverables + completion certification.

## Files
- `backend/config/assessment-builder.ts` — pure-data registry: `AB_AXES`, `AB_DIMENSIONS`, `DESIGNER_ACTIONS`, `STRUCTURE_LEVELS`, `COMPOSITION_CAPS`, `REUSABLE_TEMPLATES`, `BLUEPRINT_CAPS`, `RULE_TYPES`, `CONFIG_OPTIONS`, `VERSION_CAPABILITIES`, `VALIDATION_CHECKS`, `WORKFLOW_STATES`, `MAPPING_MODEL`, `AB_DECISIONS`, `AB_GAPS` (`[]`), `RESOLVED_AB_GAPS` (AB-1..AB-7).
- `backend/services/assessment-builder-engine.ts` — read-only composer (`composeDimensions`, `composeDesignerActions`, `composeStructureLevels`, `composeCompositionCaps`, `composeTemplates`, `composeBlueprintCaps`, `composeRuleTypes`, `composeConfigOptions`, `composeVersioning`, `composeValidationChecks`, `composeWorkflow`, `composeMapping`, `composeRepositoryAlignment`, `composeAdoption`, `classifiedGaps`, `composeSummary`). GET-only, never-throws, `readScalar` null-on-error / 0-on-no-rows.
- `backend/services/assessment-builder-mechanisms.ts` — the ONLY DDL/write sites (create/edit/clone/version/blueprint-bind/validate/workflow), each flag + super-admin gated; own additive `ab_*` tables.
- `backend/routes/assessment-builder.ts` — `/api/assessment-builder/enabled` (flag probe, 503-before-auth OFF) + super-admin cert GETs (`/model`, `/dimensions`, `/blueprint`, `/rules`, `/config`, `/versioning`, `/validation`, `/workflow`, `/mapping`, `/adoption`, `/gaps`, `/summary`) + mechanism GET/POST. Flag-gate 503 → requireAuth → requireSuperAdmin, never-throws.
- `frontend/src/components/superadmin/AssessmentBuilderPanel.tsx` — super-admin console (7 dims + adoption axis), lazy-imported into `SuperAdminDashboard.tsx`; nav tab probes `/api/assessment-builder/enabled` (hidden OFF).
- `backend/scripts/capadex-3.3-assessment-builder-scan.ts` → `backend/audit/capadex-3.3-assessment-builder/scan.json` (SSoT for every number).
- `backend/scripts/capadex-3.3-generate-deliverables.ts` — reads **ONLY** scan.json → 13 deliverables + completion-certification (docs can never drift).

## public-config
`routes/capadex.ts` `/public-config` exposes `assessment_builder` — it must **IMPORT `isAssessmentBuilderEnabled`** (SEPARATE import site) or the endpoint 500s (no tsc here).

## The SEVEN INDEPENDENT certification dimensions (reported SEPARATELY — never composited)
1. **builder** — Assessment Builder / Designer (can an assessment be designed, composed & configured?)
2. **blueprint** — Blueprint Framework (distribution + mix + time/marks defined & bound?)
3. **validation** — Validation Framework (structure/blueprint/rules/config/readiness before publish?)
4. **version_management** — major/minor/draft tracked, comparable, rollback-able & clonable?
5. **publishing** — draft→review→approved→published→active→deprecated→archived with human approval?
6. **apis** — CRUD/builder/blueprint/version/validation/publishing authoring APIs?
7. **frontend** — builder UI (compose/blueprint/rules/validation/preview/version/approval)?

## Honesty invariants
- **Coverage ⟂ Confidence ⟂ Adoption never composited**; `null` (unreadable) ≠ `0` (empty); never fabricated.
- **Gaps**: `AB_GAPS = []` (0 OPEN). `RESOLVED_AB_GAPS` = AB-1..AB-7, each ENGINEERING-CLOSED via REUSE-before-build (own additive `ab_*` overlay + helpers), gated by `assessmentBuilder`.
- **Adoption** is a SEPARATE usage axis — real authored/managed assessment VOLUME across the `ab_*` overlay — reported separately, NEVER a gap and NEVER fabricated as adopted (honest `—`/null while OFF).
- **Verdict**: `STRUCTURAL_COMPLETE_ADOPTION_PENDING` — mechanism CODE-complete via reuse; what remains is adoption, not engineering.

→ Deliverables: `backend/audit/capadex-3.3-assessment-builder/` · Memory: `.agents/memory/assessment-builder.md`.

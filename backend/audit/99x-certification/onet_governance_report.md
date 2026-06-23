# §3 — O*NET Governance & Intelligence Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts` + code trace

## Verdict: 🟡 PARTIAL — O*NET correctly positioned as a reference/feeder layer (✅), governance controls present (✅), but curated crosswalk volume is tiny and **0 verified**

## Table inventory & mapping assessment

| Surface | Verdict | Evidence |
|---|---|---|
| `ont_roles` | ✅ | 1040 roles |
| `ont_industries` / `ont_functions` / `ont_departments` / `ont_role_families` | ✅ / 🟡 | 206 / 30 / 43 / 31; functions have no industry FK |
| `map_role_competency` (Role→Competency) | ✅ | **52,362** rows · 1021 roles · 159 competencies · **0 duplicate** (role,competency) pairs |
| `map_ont_onto_role` (curated↔O\*NET role bridge) | 🟡 | **5 rows · 3 resolved · 0 verified** — capped at curated `onto_roles`=5 |
| Industry/Function/Dept/Family **O\*NET mapping** | ❌ | O\*NET supplies roles+competencies only; the hierarchy is curated/derived, **not O\*NET-sourced** |

| Assessment axis | Finding |
|---|---|
| Crosswalk coverage | Role-DNA profiles: 600 (broad). Curated role bridge: 5 (narrow). Definition-dependent. |
| Crosswalk confidence | Every snapshot carries `confidence` + `confidence_band` (all `high`) |
| Duplicate mappings | **0** duplicate role-competency pairs |
| Missing mappings | 19 roles with no competency link; 437 of 1040 roles without an expansion snapshot |
| Role / Competency mapping accuracy | Title/code/alias matching with confidence; weak `partial_title` matches **abstain** for manual review |

## Governance controls (code-verified)

- **Provenance stamping:** derived weights `source='onet_derived'`; resolved roles `match_method='onet_activation_resolved'`; DNA snapshots `provenance='98x_phase1_expansion'` (`onet-onto-weight-bridge.ts`, `onet-activation.ts`, `role-dna-expansion-engine.ts`).
- **Curated-wins precedence:** a curated `(dna_profile_id, competency_id)` weight ALWAYS overrides a derived row; derived rows fill only un-curated competencies (`onet-onto-weight-bridge.ts`).
- **Manual override:** `map_ont_onto_role` is treated as a human-confirmable mapping that overrides the runtime title matcher when `ontologyHierarchyV2` is enabled.
- **Approval workflow:** confidence-gated auto-resolution for `code`/`exact_title`/`alias`; weak matches abstain. *Gap:* `verified=false` on all 5 rows — no human has signed off; no review UI.
- **Rollback / idempotency:** `rollbackExpansion`, `rollbackBridgeResolution`; every run rebuilds `onet_derived` rows from scratch, never touching curated rows.

## Success criterion — O*NET stays reference, not scoring
✅ **MET.** Scoring authority is `onto_*` competency-runtime / `employabilityEngine.ts`. O\*NET only feeds
Role-DNA requirements/weights and (potential) benchmarks. No scoring path reads O\*NET as a score source.

**Closable additively:** human-verify the curated crosswalks (flip `verified`), add a lightweight approval
surface, expand curated `onto_roles` beyond 5.

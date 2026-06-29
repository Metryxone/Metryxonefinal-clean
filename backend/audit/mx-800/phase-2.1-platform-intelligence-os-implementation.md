# MX-800 Phase 2.1 — Platform Intelligence Operating System (PIOS): Constitution & Foundation — Implementation

> Scope: implement **Parts 3–7** of the supplied PIOS specification — Registry · Metadata ·
> Orchestration Foundation · Governance · Validation — over the **existing** intelligence engines.
> Parts 1–2 (audit + constitution) were delivered earlier (`phase-2.1-platform-intelligence-audit.*`,
> `phase-2.1-platform-intelligence-constitution.md`).
>
> **ENHANCEMENT-ONLY. No rebuild, no V2, no parallel/duplicate engine, no business-logic change, NO
> dormant activation, no dashboards/reasoning/prediction/automation.** Flag-gated and reversible:
> flag OFF → byte-identical legacy behaviour incl. schema.

## Honesty contract (user preference — honesty over optimism, never fabricate)
- **Intelligence-Exists ≠ Connected ≠ Orchestrated. Built ≠ Activated. Registered ≠ Used.**
- **Coverage ⟂ Confidence ⟂ Evidence** reported as SEPARATE axes — never blended into one verdict.
- `confidence` here is **STRUCTURAL-ONLY** (file existence + flag registry + doc refs). Runtime/outcome
  confidence is **NOT** measured in 2.1 (requires runtime evidence → a future phase) and is encoded as
  explicit `null`, never a fabricated number.
- `owner` is **honest-NULL** across catalog entries (not yet assigned) — surfaced as a real governance gap.
- `present` is **MEASURED** (filesystem); `activation_state` is **DERIVED** from the live flag.
- `null ≠ 0`: a metric with a 0 denominator is `null`.

## What was built (additive)
| Artifact | Path | Purpose |
| --- | --- | --- |
| Flag | `backend/config/feature-flags.ts` → `platformIntelligenceRegistry` (default **false**) + `isPlatformIntelligenceRegistryEnabled()` | Gates the whole foundation. Env `FF_PLATFORM_INTELLIGENCE_REGISTRY`. |
| Migration | `backend/migrations/20261221_platform_intelligence_registry.sql` | `platform_intelligence_registry` + `platform_intelligence_audit_snapshots`. |
| Service | `backend/services/platform-intelligence-registry.ts` | Curated, file-verified intelligence catalog + all Part 3–7 getters/writers + lazy ensure-schema. |
| Routes | `backend/routes/platform-intelligence-registry.ts` (BASE `/api/admin/platform-intelligence-registry`) | `/enabled` probe, gate→auth→superadmin reads + 3 writes. |
| Wiring | `backend/routes.ts` | `registerPlatformIntelligenceRegistryRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`. |
| Validation | `backend/scripts/mx800-2.1-registry-validate.ts` | 22 checks — **22 passed, 0 failed**. |

## Part-by-part

### Part 3 — Platform Intelligence Registry (IMPLEMENTED)
One canonical registry table. Each entry carries: id, name, type, domain, owner (honest-NULL),
lifecycle_state (**MANAGED**), activation_state (**DERIVED** from flag), present (**MEASURED** fs),
inputs, outputs, dependencies, evidence, confidence (structural), explainability, repository_refs
(verified), documentation_refs, compatibility, version, flag_key, lifecycle_uid (**soft** ref into the
MX-700 `platform_lifecycle` registry — referenced, **never duplicated**).
- `GET /registry`, `GET /registry/:uid`, `POST /discover`, `POST /register`.
- Re-discovery refreshes DERIVED fields and **preserves** MANAGED `lifecycle_state`/`owner`
  (validated: a human-set `managed_active`/`owner.test` survives a second discover).
- Reads compose the **in-code file-verified catalog** even before discovery (honest, never empty-by-accident);
  persisted MANAGED fields overlay it when present.

### Part 4 — Intelligence Metadata (IMPLEMENTED)
`GET /metadata/:uid` composes metadata from the curated catalog. Engine **source is untouched** —
metadata describes the engines, it does not modify them.

### Part 5 — Orchestration FOUNDATION (IMPLEMENTED — metadata-level only)
`GET /orchestration` (discovery/registration/coordination/composition graph from declared
dependencies/routing/explainability), `GET /orchestration/route?id=&type=` (resolves an intelligence to
its repository refs — **metadata routing, never execution**), `GET /explain/:uid`.
- **Explicitly does NOT execute engines and does NOT reason/predict/recommend/automate** (out of scope).
- Posture reported honestly: **Connected** via one registry contract, **NOT Orchestrated execution**.

### Part 6 — Governance baseline (IMPLEMENTED)
`GET /governance` measures per-entry completeness across 7 standardized facets
(metadata/evidence/confidence/explainability/ownership/repository_refs/compatibility), with per-facet
coverage and **honest gaps**. Measured `governance_completeness ≈ 0.87`; `ownership` coverage ≈ 0.08
(honest-NULL, never fabricated to 100%). `null` when there are no entries (never a fabricated 0).

### Part 7 — Validation (IMPLEMENTED)
`GET /validation` asserts the discipline and returns a **STRUCTURAL** verdict (`VALIDATED`): one
intelligence registry, no duplicate registry rows, no duplicate engines (reuse — file-verified), no
duplicate orchestration, soft-reference (not duplicate) of the lifecycle registry, no business-logic
change, **no dormant activation**, compatibility preserved. The verdict is explicitly labelled
STRUCTURAL — **not** a runtime/outcome claim.

### Audit / drift
`POST /audit/capture` (append-only snapshot — a write path, owns lazy ensure-schema), `GET /audit/snapshots`,
`GET /audit/drift` (≥2 snapshots). Reads probe via `to_regclass` and degrade to `ready:false`.

## Deliberately OUT OF SCOPE (deferred, per spec — encoded as honest nulls, not failures)
- Runtime/outcome **confidence** measurement (needs runtime evidence).
- **Reasoning / prediction / recommendation / automation** layers.
- **Dashboards / frontend** (no UI panel — STOP clause).
- Actual cross-engine **orchestrated execution** (this is a coordination FOUNDATION only).

## Reversibility / byte-identical-OFF (verified)
- Flag OFF → every route `503` before any auth/DB touch (global `/api/admin` auth gate fronts even
  `/enabled`, so OFF smoke ∈ {401,403,503} — confirmed live).
- Lazy ensure-schema runs **only** on flag-ON write paths → OFF creates **0 tables**.
- The validator's dev-DB writes were **dropped** after validation, restoring byte-identical-OFF in the
  shared dev database (`to_regclass` → null for both tables).

## Verification
- `npx esbuild` parse — clean.
- Backend API restarted — route registered, clean boot, all sibling suites (isolation/privacy/voice/avatar) green.
- `FF_PLATFORM_INTELLIGENCE_REGISTRY=1 npx tsx scripts/mx800-2.1-registry-validate.ts` → **22 passed, 0 failed**.
- Flag-OFF HTTP smoke on `/registry`, `/summary`, `POST /discover` → all ∈ {401,403,503}.

## STOP
Phase 2.1 (Parts 1–7) complete. **Freeze after approval — no merge/deploy without sign-off.** Phase 2.2
(Repository Intelligence Engine) is a future phase.

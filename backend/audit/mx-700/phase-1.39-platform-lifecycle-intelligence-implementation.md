# MX-700 Phase 1.39 — Platform Lifecycle Intelligence Engine (Implementation)

**Status:** Implemented (flag OFF, byte-identical incl. schema). Awaiting approval. **No deploy.**
**Flag:** `platformLifecycleIntelligence` · env `FF_PLATFORM_LIFECYCLE_INTELLIGENCE` (default OFF)
**Base route:** `/api/admin/platform-lifecycle-intelligence`
**Composes:** Phase 1.37 Foundation (`platform-lifecycle`) + Phase 1.38 Management (`platform-lifecycle-management`)

---

## 1. What this is

A **READ-ONLY intelligence tier** over the lifecycle registry that the 1.37 Foundation already
discovered and the 1.38 Management already governs. It **measures, validates, explains and scores**
that lifecycle information continuously. It introduces:

- **NO parallel registry** — it reads the existing `platform_lifecycle_registry` / `platform_capability_catalog` / `platform_lifecycle_relationships` / `platform_lifecycle_state_history` and the 1.38 management tables.
- **NO duplicate engines** — it COMPOSES the Foundation getters (`getRepositoryHealth`, `getValidation`, `getSummary`) and Management `getManagementSummary`, then adds measurements on top.
- **NO business-logic change** — the repository remains the single source of truth; every number is derived from MEASURED evidence.

It adds exactly **one** new table (`platform_lifecycle_intelligence_snapshots`, append-only) which
is written **only** by the Lifecycle Audit Engine. With the flag OFF that table is never created.

---

## 2. The 9 engines

| # | Engine | Endpoint | What it measures |
|---|--------|----------|------------------|
| 1 | **Lifecycle Evidence** | `GET /evidence` | Per-source evidence (repository / runtime / database / documentation / feature_flags / migration_history / git). Each carries **coverage ⟂ confidence** as SEPARATE axes + a `verification_status`. Git is best-effort repo-level last-commit; honest `unavailable` when no `.git`. |
| 2 | **Lifecycle Confidence** | `GET /confidence` | Verifiability of the evidence, **independent** from coverage: repository/implementation/compatibility/migration/documentation confidence + evidence_quality. Each is a measured ratio (e.g. repo refs that resolve on disk ÷ refs present). |
| 3 | **Lifecycle Explainability** | `GET /explain/:uid` | For one entity: why (last recorded transition) / evidence / impact (measured dependents) / dependencies / compatibility / migration+version ledger / alternatives (replacement) / repository references. Unknown uid → `found:false` (no fabrication). |
| 4 | **Lifecycle Health** | `GET /health` | completeness / consistency / integrity / coverage / compliance / readiness / stability — each a measured ratio, reported separately (never composited). |
| 5 | **Repository Health** | `GET /repository-health` | COMPOSES Foundation `getRepositoryHealth` + adds large-files (measured line counts), orphan-modules (candidates: no relationship linkage), circular-dependencies (cycle detection over the relationship graph), documentation-coverage. |
| 6 | **Compatibility Intelligence** | `GET /compatibility` | backward/forward/migration/api/module/database/feature_flag compatibility. Measured status counts + migration ordering regressions; STRUCTURAL guarantees (additive/flag-OFF) clearly marked as such, not faked as runtime-measured. |
| 7 | **Lifecycle Validation** | `GET /validation` | COMPOSES Foundation `getValidation` + metadata validation (invalid states / missing version / missing dependency metadata / repository-integrity broken references). |
| 8 | **Lifecycle Audit (drift)** | `GET /audit/drift`, `GET /audit/snapshots`, `POST /audit/capture` | Append-only point-in-time snapshots; drift = current − previous per metric (MEASURED deltas; null when a side is unmeasurable). **`POST /audit/capture` is the ONLY write path.** |
| 9 | **Lifecycle Metrics** | `GET /metrics` | 6 SEPARATE measured scores (lifecycle_health / repository_health / compatibility / evidence / confidence / architecture_stability) + tech-debt indicators. **Deliberately NO composited "overall" score.** |

Plus `GET /summary` (composes metrics + management views + latest snapshot), `GET /enabled`
(flag probe), `GET /feature-flag` (super-admin UI gate, `res.ok`).

---

## 3. Honesty contract (per user preference)

- **Coverage ⟂ Confidence ⟂ Evidence ⟂ Health** — reported as separate axes, **never** blended into one verdict. `getLifecycleMetrics` intentionally exposes no `overall`/`composite` field.
- **null ≠ zero** — every ratio returns `null` when its denominator is 0 (not 0). Drift deltas are `null` when one side is unmeasurable.
- **Built ≠ Activated, Registered ≠ Used, Table-exists ≠ Populated** — runtime evidence counts only capabilities whose `activation_state` is definitively measured; database evidence separates *present* from *populated*.
- **Honest gaps, never fabricated** — git per-entity history, per-endpoint API contracts, forward-compatibility are marked as explicit scope boundaries / `unavailable`, not invented. Orphan modules are labelled **candidates**, not asserted dead. Dormant capabilities are flagged as built-but-deactivated-by-design, **not** debt.

---

## 4. Flag-OFF byte-identical guarantee

- Route-level `gate` returns **503 before any auth/DB touch** when the flag is OFF.
- The lazy `ensureIntelligenceSchema` runs **only** inside `captureAuditSnapshot` (the write path), which is itself behind the gate → with the flag OFF the snapshot table is never created.
- All read engines are **GET-never-writes**: they probe via `to_regclass` / `schemaReady` and degrade to `ready:false`; they never run DDL.

---

## 5. Validation evidence

**esbuild bundle:** PASS (routes + service + script bundle clean).

**Service-level validation** (`backend/scripts/mx700-1.39-validate.ts`, flag forced ON, self-cleaning) — **19/19 PASS**:

```
PASS  evidence has 7 sources
PASS  evidence coverage & confidence are number|null (separate axes)
PASS  git evidence degrades honestly (available=true)
PASS  confidence axes measured (number|null)
PASS  health dimensions all number|null
PASS  repo-health adds circular_deps=0 large_files=7
PASS  compatibility intelligence ready
PASS  validation composes foundation + metadata
PASS  all 6 scores number|null (separate axes)
PASS  NO composited "overall" score (honesty)
  scores: {"lifecycle_health_score":75.64,"repository_health_score":50.22,"compatibility_score":100,"evidence_score":83.72,"confidence_score":99.99,"architecture_stability":100}
PASS  explain(capability:advancedCompetencyRuntimeV2) composes why/evidence/impact
PASS  explain unknown uid -> found:false (no fabrication)
PASS  audit snapshot #1 captured
PASS  audit snapshot #2 captured
PASS  snapshots list returns >=2
PASS  drift computed between latest 2 (number|null deltas)
PASS  summary declares it COMPOSES 1.37 + 1.38
PASS  cleanup complete (0 test snapshots remain)
```

**Flag-OFF HTTP smoke** (live workflow, flag OFF): every route ∈ **{401, 403, 503}** — nothing
reaches the service or DDL. (The global `app.use('/api/admin')` auth gate returns 401 before the
route-level flag gate, and global CSRF returns 403 on the POST; both are established platform
behaviour — see `.agents/memory/platform-intelligence-console.md`. The flag-gate 503-before-DB
guarantee is still enforced at the route level for any path that gets past the global gate.)

---

## 6. Files

- `backend/config/feature-flags.ts` — flag `platformLifecycleIntelligence` + `isPlatformLifecycleIntelligenceEnabled()`
- `backend/migrations/20261218_platform_lifecycle_intelligence.sql` — append-only snapshot table
- `backend/services/platform-lifecycle-intelligence.ts` — 9 engines + audit capture
- `backend/routes/platform-lifecycle-intelligence.ts` — admin routes (registered in `routes.ts`)
- `backend/scripts/mx700-1.39-validate.ts` — service-level validation

## 7. STOP clause honoured

No SuperAdmin dashboards/panels, no tech-debt automation, no notifications, no workflow
orchestration, no future phases. Frontend intentionally omitted (intelligence is API-only this phase).
